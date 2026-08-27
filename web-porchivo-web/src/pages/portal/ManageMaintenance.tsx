/**
 * ManageMaintenance — open maintenance-request queue (maintenance_requests).
 * Staff can move requests through statuses; history is written by the
 * database trigger server-side, so this screen only touches the status column.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { MaintenanceRequestRow } from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";

/** Statuses staff can transition an OPEN request into (maintenance_status enum minus 'submitted'). */
const NEXT_STATUSES = [
  "acknowledged",
  "scheduled",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
] as const;
type NextStatus = (typeof NEXT_STATUSES)[number];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "submitted":
      return "bg-blue-100 text-blue-800";
    case "acknowledged":
      return "bg-indigo-100 text-indigo-800";
    case "scheduled":
      return "bg-purple-100 text-purple-800";
    case "in_progress":
      return "bg-orange-100 text-orange-900";
    case "on_hold":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-brand-navy-700 text-brand-text-muted";
  }
}

export default function ManageMaintenancePage() {
  const { org } = usePortalOrg();
  const queryClient = useQueryClient();
  const orgId = org?.id;

  const [updateError, setUpdateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ["portal", "maintenance-open", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select(
          "id, title, description, category, status, priority, location_detail, is_urgent, created_at",
        )
        .eq("org_id", orgId)
        .not("status", "in", "(completed,cancelled)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as MaintenanceRequestRow[];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: NextStatus }) => {
      const { error } = await supabase
        .from("maintenance_requests")
        .update({ status: next })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_d, variables) => {
      setBusyId(null);
      setUpdateError(null);
      // Moving to completed/cancelled removes it from this queue view.
      void queryClient.invalidateQueries({ queryKey: ["portal", "maintenance-open", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["portal", "dashboard-counts", orgId] });
      if (variables.next === "completed") {
        void queryClient.invalidateQueries({ queryKey: ["portal", "dashboard-counts", orgId] });
      }
    },
    onError: (err: Error) => {
      setBusyId(null);
      setUpdateError(
        err.message.toLowerCase().includes("row-level")
          ? "Your account can't update maintenance requests. Ask your HOA admin."
          : "Couldn't update the request. Please try again.",
      );
    },
  });

  const rows = queueQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Maintenance queue</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Open requests filed by residents of {org?.name ?? "your community"}.
        </p>
      </div>

      {updateError && (
        <p className="text-[13px] text-red-600 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2.5" role="alert">
          {updateError}
        </p>
      )}

      {queueQuery.isLoading ? (
        <div className="py-16 flex justify-center">
          <div className="w-7 h-7 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="paper-sheet rounded-xl px-8 py-14 text-center">
          <Wrench className="w-9 h-9 text-brand-text-muted mx-auto mb-3" />
          <p className="text-sm font-semibold text-brand-text-primary mb-1">Queue clear</p>
          <p className="text-[13px] text-brand-text-secondary max-w-sm mx-auto">
            No open requests. Completed and cancelled requests drop off this board automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="paper-sheet rounded-xl px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.is_urgent && (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wide">
                        Urgent
                      </span>
                    )}
                    <h3 className="text-[15px] font-semibold text-brand-text-primary">{row.title}</h3>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(row.status)}`}>
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-brand-text-muted">
                    {[
                      row.category ? row.category.replace(/_/g, " ") : null,
                      row.location_detail ?? null,
                      `filed ${new Date(row.created_at).toLocaleDateString()}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {row.description && (
                    <p className="mt-1.5 text-[13px] text-brand-text-secondary leading-relaxed">
                      {row.description.length > 220 ? `${row.description.slice(0, 220)}…` : row.description}
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-[12px] font-semibold text-brand-text-muted flex-shrink-0">
                  Move to
                  <select
                    value=""
                    disabled={busyId !== null}
                    onChange={(e) => {
                      const next = e.target.value as NextStatus;
                      if (!next) return;
                      setBusyId(row.id);
                      statusMutation.mutate({ id: row.id, next });
                    }}
                    className="rounded-md border border-brand-navy-500/70 bg-transparent px-2 py-1.5 text-[12px] text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-tape-gold/40 disabled:opacity-50"
                  >
                    <option value="" disabled>status…</option>
                    {NEXT_STATUSES.filter((s) => s !== row.status).map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
