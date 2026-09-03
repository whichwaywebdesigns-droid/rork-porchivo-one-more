/**
 * ManageAmenities — amenity reservations (org_amenities +
 * org_amenity_reservations). Manager-portal parity with the resident app:
 * staff manage the amenity list, see every upcoming confirmed booking with
 * the reserving member's name, cancel any booking, and can book slots
 * themselves. Double-booking is impossible — the DB-level GiST exclusion
 * constraint rejects overlapping confirmed slots (23P01 → friendly message).
 * Community plan and up (Starter gated).
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  isCommunityPlanOrHigher,
  type OrgAmenityRow,
  type OrgReservationRow,
} from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";
import { usePortalAuth } from "@/providers/PortalAuthProvider";

/** First slot of the bookable day (8 AM), last start hour (7 PM → ends 8 PM). */
const FIRST_HOUR = 8;
const LAST_HOUR = 19;
const HOUR_MS = 3600_000;
const DAY_MS = 86_400_000;

function amenityEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("pool")) return "🏊";
  if (n.includes("gym") || n.includes("fitness")) return "💪";
  if (n.includes("club")) return "🏛️";
  if (n.includes("tennis") || n.includes("court") || n.includes("pickle")) return "🎾";
  if (n.includes("bbq") || n.includes("grill")) return "🔥";
  if (n.includes("park") || n.includes("garden")) return "🌳";
  if (n.includes("lounge") || n.includes("library")) return "🛋️";
  if (n.includes("dog") || n.includes("pet")) return "🐕";
  return "🏷️";
}

function fmtRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const day = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = (d: Date): string => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time(s)} – ${time(e)}`;
}

export default function ManageAmenitiesPage() {
  const { org } = usePortalOrg();
  const { userId } = usePortalAuth();
  const queryClient = useQueryClient();
  const orgId = org?.id;
  const planAllowed = isCommunityPlanOrHigher(org?.plan_tier);

  const [amenityName, setAmenityName] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pickedAmenity, setPickedAmenity] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<number>(0);

  const amenitiesQuery = useQuery({
    queryKey: ["portal", "amenities", orgId],
    enabled: Boolean(orgId) && planAllowed,
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error } = await supabase
        .from("org_amenities")
        .select("id, org_id, name")
        .eq("org_id", orgId)
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as OrgAmenityRow[];
    },
  });

  const reservationsQuery = useQuery({
    queryKey: ["portal", "amenity-reservations", orgId],
    enabled: Boolean(orgId) && planAllowed,
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error } = await supabase
        .from("org_amenity_reservations")
        .select("id, amenity_id, reserved_by, starts_at, ends_at, status, created_at, member:profiles(name)")
        .eq("org_id", orgId)
        .eq("status", "confirmed")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      // supabase-js infers the embedded join as an array without generated types;
      // PostgREST actually returns an object — same shape the resident app relies on.
      return (data ?? []) as unknown as OrgReservationRow[];
    },
  });

  const days = useMemo<Array<{ date: Date; label: string; sub: string }>>(() => {
    const out: Array<{ date: Date; label: string; sub: string }> = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() + i * DAY_MS);
      out.push({
        date: d,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        sub: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      });
    }
    return out;
  }, []);

  const amenities = amenitiesQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];
  const amenityNameById = useMemo(() => new Map(amenities.map((a) => [a.id, a.name])), [amenities]);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["portal", "amenities", orgId] });
    void queryClient.invalidateQueries({ queryKey: ["portal", "amenity-reservations", orgId] });
  };

  const addAmenity = useMutation({
    mutationFn: async () => {
      if (!orgId || !userId) throw new Error("no org");
      const { error } = await supabase.from("org_amenities").insert({
        org_id: orgId,
        name: amenityName.trim(),
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setAmenityName("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["portal", "amenities", orgId] });
    },
    onError: (err: Error) => setFormError(err.message.includes("duplicate key") ? "That amenity already exists." : err.message),
  });

  const removeAmenity = useMutation({
    mutationFn: async (amenityId: string) => {
      const { error } = await supabase.from("org_amenities").delete().eq("id", amenityId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidateAll,
    onError: (err: Error) => setFormError(err.message),
  });

  const reserve = useMutation({
    mutationFn: async (slot: { start: Date; end: Date }) => {
      if (!orgId || !userId || !pickedAmenity) throw new Error("no org");
      const { error } = await supabase.from("org_amenity_reservations").insert({
        org_id: orgId,
        amenity_id: pickedAmenity,
        reserved_by: userId,
        starts_at: slot.start.toISOString(),
        ends_at: slot.end.toISOString(),
        status: "confirmed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFormError(null);
      invalidateAll();
    },
    onError: (err: Error & { code?: string }) => {
      setFormError(
        err.code === "23P01"
          ? "That slot was just booked by someone else — pick another time."
          : err.message,
      );
    },
  });

  const cancelReservation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error } = await supabase
        .from("org_amenity_reservations")
        .update({ status: "cancelled" })
        .eq("id", reservationId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidateAll,
    onError: (err: Error) => setFormError(err.message),
  });

  if (!planAllowed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Amenity reservations</h1>
        </div>
        <div className="paper-sheet rounded-xl px-6 py-8 text-center">
          <CalendarClock className="w-8 h-8 text-brand-orange mx-auto mb-3" />
          <h2 className="text-lg font-bold text-brand-text-primary mb-2">Community feature</h2>
          <p className="text-sm text-brand-text-secondary leading-relaxed max-w-md mx-auto">
            Amenity reservations are available on the Community plan and up. Upgrade your community's plan to let
            residents book the pool, clubhouse, and more.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Amenity reservations</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Residents book hourly slots in the app — every upcoming booking lands here.
        </p>
      </div>

      {formError && <p className="text-[13px] text-red-600" role="alert">{formError}</p>}

      {/* Amenity manager */}
      <div className="paper-sheet rounded-xl px-6 py-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mb-3">Amenities</div>
        {amenities.length === 0 ? (
          <p className="text-[13px] text-brand-text-muted mb-3">
            Add the amenities residents can book — pool, clubhouse, tennis court…
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {amenities.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy-500/70 bg-brand-navy-800/60 px-3 py-1.5 text-[13px] font-semibold text-brand-text-primary"
              >
                <span aria-hidden>{amenityEmoji(a.name)}</span>
                {a.name}
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  disabled={removeAmenity.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove ${a.name} and its reservations?`)) removeAmenity.mutate(a.id);
                  }}
                  className="ml-0.5 text-brand-text-muted hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={amenityName}
            onChange={(e) => setAmenityName(e.target.value)}
            placeholder="New amenity name…"
            maxLength={60}
            onKeyDown={(e) => {
              if (e.key === "Enter" && amenityName.trim()) addAmenity.mutate();
            }}
            className="flex-1 rounded-lg border border-brand-navy-500/70 bg-white/70 dark:bg-brand-navy-800/60 px-3.5 py-2.5 text-[14px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-tape-gold/50 focus:border-tape-gold transition-colors"
          />
          <button
            type="button"
            disabled={!amenityName.trim() || addAmenity.isPending}
            onClick={() => addAmenity.mutate()}
            className="btn-orange inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] disabled:opacity-60"
          >
            {addAmenity.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      {/* Upcoming reservations */}
      <div>
        <h2 className="text-[15px] font-bold text-brand-text-primary mb-3">Upcoming</h2>
        {reservationsQuery.isLoading || amenitiesQuery.isLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-7 h-7 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
          </div>
        ) : reservations.length === 0 ? (
          <p className="text-[13px] text-brand-text-muted">No upcoming reservations yet.</p>
        ) : (
          <ul className="space-y-3">
            {reservations.map((r) => {
              const mine = r.reserved_by === userId;
              return (
                <li key={r.id} className="paper-sheet rounded-xl px-5 py-4 flex items-center gap-4">
                  <span className="w-10 h-10 rounded-lg bg-brand-navy-700 flex items-center justify-center flex-shrink-0" aria-hidden>
                    {amenityEmoji(amenityNameById.get(r.amenity_id) ?? "")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold text-brand-text-primary truncate">
                      {amenityNameById.get(r.amenity_id) ?? "Amenity"}
                      {mine ? " · You" : ""}
                    </h3>
                    <p className="text-[12px] text-brand-text-muted">
                      {fmtRange(r.starts_at, r.ends_at)}
                      {!mine && r.member?.name ? ` · Reserved by ${r.member.name}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cancel reservation"
                    disabled={cancelReservation.isPending}
                    onClick={() => {
                      if (window.confirm("Cancel this reservation?")) cancelReservation.mutate(r.id);
                    }}
                    className="p-2 rounded-lg text-brand-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Booking (parity with the resident app's reserve sheet) */}
      {amenities.length > 0 ? (
        <div className="paper-sheet rounded-xl px-6 py-5 space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted">Book a slot</div>
          <div className="flex flex-wrap gap-2">
            {amenities.map((a) => {
              const active = a.id === pickedAmenity;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPickedAmenity(a.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? "border-brand-orange/70 bg-brand-orange/15 text-brand-orange"
                      : "border-brand-navy-500/70 bg-brand-navy-800/60 text-brand-text-muted hover:text-brand-text-primary"
                  }`}
                >
                  <span aria-hidden>{amenityEmoji(a.name)}</span>
                  {a.name}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => {
              const active = i === pickedDay;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPickedDay(i)}
                  className={`flex flex-col items-center w-14 flex-shrink-0 rounded-xl border py-2 transition-colors ${
                    active
                      ? "bg-brand-orange border-brand-orange text-white"
                      : "border-brand-navy-500/70 bg-brand-navy-800/60 text-brand-text-secondary hover:text-brand-text-primary"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase">{d.label}</span>
                  <span className="text-[13px] font-bold">{d.sub}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i).map((hour) => {
              const slotStart = new Date(days[pickedDay].date);
              slotStart.setHours(hour, 0, 0, 0);
              const slotEnd = new Date(slotStart.getTime() + HOUR_MS);
              const past = slotStart.getTime() < Date.now();
              const label = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? "AM" : "PM"}`;
              return (
                <button
                  key={hour}
                  type="button"
                  disabled={past || !pickedAmenity || reserve.isPending}
                  onClick={() => reserve.mutate({ start: slotStart, end: slotEnd })}
                  className="rounded-lg border border-brand-navy-500/70 bg-brand-navy-800/60 px-3 py-2 text-[13px] font-semibold text-brand-text-primary transition-colors hover:border-brand-orange/60 disabled:opacity-35 disabled:hover:border-brand-navy-500/70"
                >
                  {label}
                </button>
              );
            })}
          </div>
          {!pickedAmenity ? (
            <p className="text-[12px] text-brand-text-muted">Pick an amenity first, then tap a time to book.</p>
          ) : (
            <p className="text-[12px] text-brand-text-muted">Tap a time to book that 1-hour slot for yourself.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
