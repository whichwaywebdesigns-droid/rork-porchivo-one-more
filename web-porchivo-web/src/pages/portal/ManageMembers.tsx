/**
 * ManageMembers — pending-membership queue backed by the existing
 * security-definer RPCs (`get_pending_members` / approve / deny).
 * Approve/deny buttons render only for roles the RPC would accept.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, UserPlus, Inbox } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { canDecideMembers, type PendingMemberRow } from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";

export default function ManageMembersPage() {
  const { membership, org } = usePortalOrg();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canDecide = membership ? canDecideMembers(membership.role) : false;
  const orgId = org?.id;

  const pendingQuery = useQuery({
    queryKey: ["portal", "pending-members", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error } = await supabase.rpc("get_pending_members", { p_org_id: orgId });
      if (error) throw new Error(error.message);
      return (data ?? []) as PendingMemberRow[];
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approve" | "deny" }) => {
      if (!orgId) throw new Error("no org");
      const rpcName = decision === "approve" ? "approve_org_membership" : "deny_org_membership";
      const { error } = await supabase.rpc(rpcName, { p_membership_id: id, p_org_id: orgId });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      setBusyId(null);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["portal", "pending-members", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["portal", "dashboard-counts", orgId] });
      if (variables.decision === "deny") {
        void queryClient.invalidateQueries({ queryKey: ["portal", "org"] });
      }
    },
    onError: (err: Error) => {
      setBusyId(null);
      setActionError(err.message.includes("permission_denied")
        ? "You don't have permission to make that change."
        : "Something went wrong. Please try again.");
    },
  });

  const rows = pendingQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Pending members</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Residents who asked to join {org?.name ?? "your community"} using your invite code.
        </p>
      </div>

      {!canDecide && (
        <p className="text-[12px] text-brand-text-muted bg-brand-navy-900/60 border border-brand-navy-500/50 rounded-lg px-4 py-2.5">
          You're viewing in read-only mode — approving or denying requires an HOA Admin,
          Property Manager, or Super Admin role.
        </p>
      )}

      {actionError && (
        <p className="text-[13px] text-red-600 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2.5" role="alert">
          {actionError}
        </p>
      )}

      {pendingQuery.isLoading ? (
        <div className="py-16 flex justify-center">
          <div className="w-7 h-7 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : pendingQuery.isError ? (
        <p className="text-[13px] text-brand-text-secondary">
          Couldn't load the queue right now. Refresh the page to try again.
        </p>
      ) : rows.length === 0 ? (
        <div className="paper-sheet rounded-xl px-8 py-14 text-center">
          <Inbox className="w-9 h-9 text-brand-text-muted mx-auto mb-3" />
          <p className="text-sm font-semibold text-brand-text-primary mb-1">Queue clear</p>
          <p className="text-[13px] text-brand-text-secondary leading-relaxed max-w-sm mx-auto">
            No residents waiting for approval. Share your invite code from the Invite Code tab
            to bring more neighbors in.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.membership_id} className="paper-sheet rounded-xl px-5 py-4 flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-brand-text-primary truncate">{row.display_name}</p>
                <p className="text-[12px] text-brand-text-muted mt-0.5">
                  {row.unit_number ? `Unit ${row.unit_number} · ` : ""}requested{" "}
                  {new Date(row.created_at).toLocaleDateString()}
                </p>
              </div>
              {canDecide ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setBusyId(row.membership_id);
                      decideMutation.mutate({ id: row.membership_id, decision: "approve" });
                    }}
                    disabled={busyId !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700/90 hover:bg-green-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setBusyId(row.membership_id);
                      decideMutation.mutate({ id: row.membership_id, decision: "deny" });
                    }}
                    disabled={busyId !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-navy-500/70 text-brand-text-secondary hover:text-brand-text-primary hover:border-brand-navy-500 text-[13px] font-medium transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Deny
                  </button>
                </div>
              ) : (
                <UserPlus className="w-4 h-4 text-brand-text-muted" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
