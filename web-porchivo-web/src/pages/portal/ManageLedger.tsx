/**
 * ManageLedger — payments ledger (org_payments, Community plan and up,
 * staff-only). Manager-portal parity with the resident app's Payments Ledger
 * screen: collected totals, monthly totals, every payment with the paying
 * member's name, and a one-tap CSV export (built client-side — no schema or
 * edge function needed).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Receipt } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { isCommunityPlanOrHigher, type OrgPaymentRow } from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";

const STATUS_CLASSES: Record<string, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  refunded: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** CSV-escape a field: wrap in quotes, double any inner quotes. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function ManageLedgerPage() {
  const { org } = usePortalOrg();
  const orgId = org?.id;
  const planAllowed = isCommunityPlanOrHigher(org?.plan_tier);

  const ledgerQuery = useQuery({
    queryKey: ["portal", "ledger", orgId],
    enabled: Boolean(orgId) && planAllowed,
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error } = await supabase
        .from("org_payments")
        .select("id, amount_cents, status, paid_at, created_at, member:profiles(name)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      // supabase-js infers the embedded join as an array without generated types;
      // PostgREST actually returns an object — same shape the resident app relies on.
      return (data ?? []) as unknown as OrgPaymentRow[];
    },
  });

  const stats = useMemo(() => {
    const rows = ledgerQuery.data ?? [];
    const paid = rows.filter((r) => r.status === "paid");
    const totalAll = paid.reduce((sum, r) => sum + r.amount_cents, 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const totalMonth = paid
      .filter((r) => (r.paid_at ? new Date(r.paid_at).getTime() : 0) >= monthStart)
      .reduce((sum, r) => sum + r.amount_cents, 0);
    return { totalAll, totalMonth, paidCount: paid.length };
  }, [ledgerQuery.data]);

  const exportCsv = (): void => {
    const rows = ledgerQuery.data ?? [];
    if (rows.length === 0) return;
    const lines = ["Date,Member,Amount,Status"];
    for (const r of rows) {
      lines.push(
        [
          csvField(r.paid_at ?? r.created_at),
          csvField(r.member?.name ?? "Unknown"),
          csvField(fmtMoney(r.amount_cents)),
          csvField(r.status),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `porchivo-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (!planAllowed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">Payments ledger</h1>
        </div>
        <div className="paper-sheet rounded-xl px-6 py-8 text-center">
          <Receipt className="w-8 h-8 text-brand-orange mx-auto mb-3" />
          <h2 className="text-lg font-bold text-brand-text-primary mb-2">Community feature</h2>
          <p className="text-sm text-brand-text-secondary leading-relaxed max-w-md mx-auto">
            The payments ledger is available on the Community plan and up. Upgrade your community's plan to track
            dues and assessments and export them as CSV.
          </p>
        </div>
      </div>
    );
  }

  const rows = ledgerQuery.data ?? [];
  const hasRows = rows.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Payments ledger</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Dues and assessments collected from residents of {org?.name ?? "your community"}.
        </p>
      </div>

      {/* Summary + export */}
      <div className="paper-sheet rounded-xl px-6 py-5">
        <div className="grid grid-cols-3 divide-x divide-brand-navy-500/40 text-center">
          <div>
            <div className="text-xl font-bold text-brand-text-primary tabular-nums">{fmtMoney(stats.totalAll)}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mt-0.5">Collected all-time</div>
          </div>
          <div>
            <div className="text-xl font-bold text-brand-text-primary tabular-nums">{fmtMoney(stats.totalMonth)}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mt-0.5">This month</div>
          </div>
          <div>
            <div className="text-xl font-bold text-brand-text-primary tabular-nums">{stats.paidCount}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mt-0.5">Paid payments</div>
          </div>
        </div>
        <button
          type="button"
          disabled={!hasRows || ledgerQuery.isLoading}
          onClick={exportCsv}
          className="btn-orange mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] disabled:opacity-60"
        >
          {ledgerQuery.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export CSV
        </button>
      </div>

      {/* Payment list */}
      {ledgerQuery.isLoading ? (
        <div className="py-10 flex justify-center">
          <div className="w-7 h-7 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : !hasRows ? (
        <p className="text-[13px] text-brand-text-muted">
          No payments yet — dues and assessments will appear here as residents pay.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="paper-sheet rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-brand-text-primary truncate">
                  {r.member?.name ?? "Unknown resident"}
                </h3>
                <p className="text-[12px] text-brand-text-muted">{fmtDate(r.paid_at ?? r.created_at)}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[15px] font-bold text-brand-text-primary tabular-nums">
                  {fmtMoney(r.amount_cents)}
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    STATUS_CLASSES[r.status] ?? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
