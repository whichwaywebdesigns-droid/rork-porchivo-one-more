/**
 * ResidentDashboard — the signed-in resident's property dashboard (/resident).
 *
 * Gates:
 *   - No session          → redirect to /resident/login
 *   - No active membership→ friendly "not linked to a community" panel
 *   - Member              → community header + their packages & announcements
 *
 * All reads are RLS-scoped (shipments filter on homeowner_id; announcements on
 * the membership's org_id), so this page shows exactly what the resident owns.
 */

import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  PackageCheck,
  Megaphone,
  LogOut,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { OrgAnnouncementRow, ResidentOrg } from "@/lib/portalTypes";
import { RESIDENT_ROLE_LABELS, isDeliveryComplete, type ResidentShipment } from "@/lib/portalTypes";
import { useResidentAuth } from "@/providers/ResidentAuthProvider";
import { useResidentOrg } from "@/hooks/useResidentOrg";
import { BRAND } from "@/config/brand";

function CenterPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-desk min-h-screen flex items-center justify-center px-4">
      <div className="paper-sheet w-full max-w-md rounded-xl px-8 py-10 text-center">{children}</div>
    </div>
  );
}

const DELIVERY_LABELS: Record<string, string> = {
  pending: "Preparing",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delivered_to_homeowner: "Delivered to you",
};

export default function ResidentDashboardPage() {
  const { session, userId, email, isLoadingSession, signOut } = useResidentAuth();
  const { membership, org, isLoading: isLoadingOrg, isError, refetch } = useResidentOrg();

  // ── Gates ────────────────────────────────────────────────────────────────
  if (!isSupabaseConfigured) {
    return (
      <CenterPanel>
        <ShieldAlert className="w-10 h-10 text-brand-orange mx-auto mb-4" />
        <h1 className="text-lg font-bold text-brand-text-primary mb-2">Portal not configured</h1>
        <p className="text-sm text-brand-text-secondary leading-relaxed">
          Supabase environment variables are missing from this deployment.
        </p>
      </CenterPanel>
    );
  }

  // Session restore in progress → spinner, never redirect mid-restore.
  const isResolving = isLoadingSession || (Boolean(session) && isLoadingOrg);
  if (isResolving) {
    return (
      <div className="page-desk min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/resident/login" replace />;

  if (isError || !membership || !org) {
    return (
      <CenterPanel>
        <ShieldAlert className="w-10 h-10 text-brand-orange mx-auto mb-4" />
        <h1 className="text-lg font-bold text-brand-text-primary mb-2">No community linked</h1>
        <p className="text-sm text-brand-text-secondary leading-relaxed mb-6">
          {email ?? "This account"} isn't an active member of a Porchivo community yet. Ask your
          HOA or property manager for an invite to join.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-brand-text-secondary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-brand-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to site
          </Link>
          <button
            onClick={() => void signOut()}
            className="text-sm font-medium text-brand-blue-light hover:text-brand-blue transition-colors"
          >
            Sign out
          </button>
        </div>
      </CenterPanel>
    );
  }

  return <ResidentDashboardBody userId={userId} org={org} unitNumber={membership.unitNumber} roleLabel={RESIDENT_ROLE_LABELS[membership.role]} onSignOut={() => void signOut()} />;
}

/* ── Authenticated body (kept separate so the gate stays cheap) ─────────── */

function ResidentDashboardBody({
  userId,
  org,
  unitNumber,
  roleLabel,
  onSignOut,
}: {
  userId: string;
  org: ResidentOrg;
  unitNumber: string | null;
  roleLabel: string;
  onSignOut: () => void;
}) {
  const shipments = useQuery({
    queryKey: ["resident", "shipments", userId],
    queryFn: async (): Promise<ResidentShipment[]> => {
      const { data, error } = await supabase
        .from("shipments")
        .select("id, status, carrier, packages_expected, delivery_status, created_at")
        .eq("homeowner_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error("Could not load your packages.");
      return (data ?? []) as ResidentShipment[];
    },
    staleTime: 30_000,
  });

  const announcements = useQuery({
    queryKey: ["resident", "announcements", org.id],
    queryFn: async (): Promise<OrgAnnouncementRow[]> => {
      const { data, error } = await supabase
        .from("org_announcements")
        .select("id, title, body, priority, is_pinned, created_at")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw new Error("Could not load community announcements.");
      return (data ?? []) as OrgAnnouncementRow[];
    },
    staleTime: 60_000,
  });

  const rows = shipments.data ?? [];
  const activeCount = rows.filter((s) => s.status === "open" || s.status === "accepted").length;
  const deliveredCount = rows.filter((s) => isDeliveryComplete(s.delivery_status)).length;

  const statCards = [
    { label: "Packages waiting", value: activeCount, icon: Package },
    { label: "Delivered", value: deliveredCount, icon: PackageCheck },
    { label: "Announcements", value: announcements.data?.length ?? 0, icon: Megaphone },
  ];

  return (
    <div className="page-desk min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-brand-navy-800/95 backdrop-blur border-b border-brand-navy-500/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="label-header whitespace-nowrap">Porchivo Resident</span>
            <span className="hidden sm:block text-sm font-semibold text-brand-text-primary truncate">
              {org.name}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {unitNumber && (
              <span className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-brand-navy-900 border border-brand-navy-500/60 text-[11px] font-semibold text-brand-text-muted">
                Unit {unitNumber}
              </span>
            )}
            <span className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-brand-navy-900 border border-brand-navy-500/60 text-[11px] font-semibold text-brand-text-muted">
              {roleLabel}
            </span>
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 text-[13px] text-brand-text-muted hover:text-brand-text-secondary transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">{org.name}</h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            Your packages and community updates, all in one place.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="label-card bg-card rounded-xl px-5 py-4 flex items-center gap-4">
              <card.icon className="w-6 h-6 text-brand-orange flex-shrink-0" />
              <div>
                <div className="text-3xl font-bold text-brand-text-primary tabular-nums">{card.value}</div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-brand-text-muted mt-0.5">
                  {card.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Recent packages */}
          <section className="paper-sheet rounded-xl px-6 py-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mb-3">
              Recent packages
            </h2>
            {shipments.isLoading ? (
              <p className="text-[13px] text-brand-text-muted">Loading…</p>
            ) : shipments.isError ? (
              <p className="text-[13px] text-red-600">Couldn't load packages right now.</p>
            ) : rows.length === 0 ? (
              <p className="text-[13px] text-brand-text-secondary leading-relaxed">
                Nothing on your porch yet. When a delivery is scheduled you'll see it here.
              </p>
            ) : (
              <ul className="divide-y divide-brand-navy-500/40">
                {rows.slice(0, 5).map((s) => (
                  <li key={s.id} className="py-2.5 flex items-center gap-3">
                    <Package className="w-4 h-4 text-brand-text-muted flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] text-brand-text-primary font-medium truncate">
                        {s.carrier ?? "Package"}
                        {s.packages_expected ? ` · ${s.packages_expected}` : ""}
                      </div>
                      <div className="text-[12px] text-brand-text-muted">
                        {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-secondary whitespace-nowrap">
                      {DELIVERY_LABELS[s.delivery_status ?? ""] ?? "Pending"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Community announcements */}
          <section className="paper-sheet rounded-xl px-6 py-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mb-3">
              From your community
            </h2>
            {announcements.isLoading ? (
              <p className="text-[13px] text-brand-text-muted">Loading…</p>
            ) : (announcements.data ?? []).length === 0 ? (
              <p className="text-[13px] text-brand-text-secondary leading-relaxed">
                No announcements yet from {org.name}.
              </p>
            ) : (
              <ul className="space-y-4">
                {(announcements.data ?? []).map((a) => (
                  <li key={a.id} className="group">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-brand-text-primary">{a.title}</span>
                      {a.is_pinned && (
                        <span className="px-1.5 py-0.5 rounded-full bg-brand-orange/12 text-brand-orange text-[10px] font-bold uppercase tracking-wide">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-brand-text-secondary leading-relaxed mt-1 line-clamp-3">
                      {a.body}
                    </p>
                    <div className="text-[11px] text-brand-text-muted mt-1">
                      {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-8 pt-2 flex items-center justify-between">
        <p className="text-[11px] text-brand-text-muted">
          Resident portal · {BRAND.name}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[12px] text-brand-text-muted hover:text-brand-text-secondary transition-colors"
        >
          back to porchivo.com <ChevronRight className="w-3 h-3" />
        </Link>
      </footer>
    </div>
  );
}
