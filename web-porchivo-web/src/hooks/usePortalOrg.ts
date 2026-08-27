/**
 * usePortalOrg — resolves the signed-in user's ACTIVE staff membership
 * (roles allowed into the portal) plus the organization record.
 * Returns null membership when the user is not an org admin/staff.
 */

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { PortalMembership, PortalOrg } from "@/lib/portalTypes";
import { usePortalAuth } from "@/providers/PortalAuthProvider";

interface PortalOrgResult {
  membership: PortalMembership | null;
  org: PortalOrg | null;
}

async function fetchPortalOrg(userId: string): Promise<PortalOrgResult> {
  const { data: memberships, error: mErr } = await supabase
    .from("org_memberships")
    .select("org_id, role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (mErr) throw new Error("Could not load your organization membership.");

  const rows = (memberships ?? []) as Array<{ org_id: string; role: string }>;
  const staffRoles = new Set([
    "hoa_admin",
    "property_manager",
    "property_staff",
    "board_member",
    "super_admin",
  ]);
  const match = rows.find((r) => staffRoles.has(r.role));
  if (!match) return { membership: null, org: null };

  const { data: orgRows, error: oErr } = await supabase
    .from("organizations")
    .select(
      "id, name, type, invite_code, total_units, plan_tier, subscription_status, current_period_end",
    )
    .eq("id", match.org_id)
    .maybeSingle();

  if (oErr) throw new Error("Could not load organization details.");

  return {
    membership: { orgId: match.org_id, role: match.role as PortalMembership["role"] },
    org: (orgRows as PortalOrg | null) ?? null,
  };
}

export function usePortalOrg() {
  const { session } = usePortalAuth();
  const userId = session?.user?.id ?? null;

  const query = useQuery({
    queryKey: ["portal", "org", userId],
    queryFn: () => {
      if (!userId) throw new Error("not signed in");
      return fetchPortalOrg(userId);
    },
    enabled: Boolean(session?.user?.id),
    staleTime: 60_000,
  });

  return {
    membership: query.data?.membership ?? null,
    org: query.data?.org ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
