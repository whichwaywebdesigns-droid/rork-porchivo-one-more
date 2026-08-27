/**
 * ManageDashboard — at-a-glance summary cards (pending members, open
 * maintenance, announcements, subscription state) plus quick navigation.
 */

import { Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Wrench, Megaphone, ChevronRight } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { PortalOrg } from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";

interface OutletData { org: PortalOrg }
const QUICK_LINKS = [
  { to: "/manage/members", label: "Review pending members", icon: Users },
  { to: "/manage/maintenance", label: "Work the maintenance queue", icon: Wrench },
  { to: "/manage/announcements", label: "Post an announcement", icon: Megaphone },
];

export default function ManageDashboardPage() {
  const ctx = useOutletContext<OutletData | null>();
  const orgFromCtx = ctx?.org;
  const hookOrg = usePortalOrg().org;
  const org = orgFromCtx ?? hookOrg;

  const orgId = org?.id;

  const counts = useQuery({
    queryKey: ["portal", "dashboard-counts", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const [pending, openMaint, announcements] = await Promise.all([
        supabase.from("org_memberships").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
        supabase.from("maintenance_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).not("status", "in", "(completed,cancelled)"),
        supabase.from("org_announcements").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      ]);
      return {
        pending: pending.count ?? 0,
        openMaint: openMaint.count ?? 0,
        announcements: announcements.count ?? 0,
      };
    },
  });

  const statCards = [
    { label: "Pending members", value: counts.data?.pending ?? 0, to: "/manage/members" },
    { label: "Open maintenance", value: counts.data?.openMaint ?? 0, to: "/manage/maintenance" },
    { label: "Announcements posted", value: counts.data?.announcements ?? 0, to: "/manage/announcements" },
  ];

  const planLabel = org?.plan_tier
    ? `${org.plan_tier.charAt(0).toUpperCase()}${org.plan_tier.slice(1)} plan`
    : "No subscription";
  const periodLabel = org?.current_period_end
    ? `Renews ${new Date(org.current_period_end).toLocaleDateString()}`
    : "Start a community plan to unlock tools for every resident.";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Community dashboard</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Everything happening across {org?.name ?? "your community"} at a glance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="group label-card bg-card rounded-xl px-5 py-4 flex items-center justify-between hover:bg-brand-navy-700/60 transition-colors"
          >
            <div>
              <div className="text-3xl font-bold text-brand-text-primary tabular-nums">{card.value}</div>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-brand-text-muted mt-0.5">
                {card.label}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-brand-text-muted group-hover:translate-x-0.5 group-hover:text-brand-orange transition-all" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Subscription summary */}
        <div className="paper-sheet rounded-xl px-6 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mb-3">Subscription</div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xl font-bold text-brand-text-primary">{planLabel}</span>
            {org?.subscription_status && (
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                  org.subscription_status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                {org.subscription_status}
              </span>
            )}
          </div>
          <p className="text-[13px] text-brand-text-secondary">{periodLabel}</p>
          <Link
            to="/manage/billing"
            className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue-light hover:text-brand-blue transition-colors"
          >
            Manage billing <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Quick actions */}
        <div className="paper-sheet rounded-xl px-6 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mb-3">Quick actions</div>
          <ul className="space-y-2.5">
            {QUICK_LINKS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="group flex items-center gap-2.5 text-[14px] text-brand-text-primary hover:text-brand-orange transition-colors"
                >
                  <item.icon className="w-4 h-4 text-brand-text-muted group-hover:text-brand-orange transition-colors" />
                  {item.label}
                  <ChevronRight className="ml-auto w-3.5 h-3.5 text-brand-text-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
