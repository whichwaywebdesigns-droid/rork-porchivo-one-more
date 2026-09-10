/**
 * useResidentOrg — resolves the signed-in user's ACTIVE membership in any
 * Porchivo community (any role, unlike the staff-gated usePortalOrg) plus the
 * organization record, for the resident property dashboard.
 */

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { ResidentMembership, ResidentOrg } from "@/lib/portalTypes";
import { useResidentAuth } from "@/providers/ResidentAuthProvider";

interface ResidentOrgResult {
  membership: ResidentMembership | null;
  org: ResidentOrg | null;
}

async function fetchResidentOrg(userId: string): Promise<ResidentOrgResult> {
  const { data: memberships, error: mErr } = await supabase
    .from("org_memberships")
    .select("org_id, role, unit_number")
    .eq("user_id", userId)
    .eq("status", "active");

  if (mErr) throw new Error("Could not load your community membership.");

  const rows = (memberships ?? []) as Array<{
    org_id: string;
    role: string;
    unit_number: string | null;
  }>;
  if (rows.length === 0) return { membership: null, org: null };

  // A user should belong to one household community; take the first active row.
  const match = rows[0];

  const { data: orgRows, error: oErr } = await supabase
    .from("organizations")
    .select("id, name, type, total_units, plan_tier")
    .eq("id", match.org_id)
    .maybeSingle();

  if (oErr) throw new Error("Could not load your community details.");

  return {
    membership: {
      orgId: match.org_id,
      role: match.role as ResidentMembership["role"],
      unitNumber: match.unit_number,
    },
    org: (orgRows as ResidentOrg | null) ?? null,
  };
}

export function useResidentOrg() {
  const { session } = useResidentAuth();
  const userId = session?.user?.id ?? null;

  const query = useQuery({
    queryKey: ["resident", "org", userId],
    queryFn: () => {
      if (!userId) throw new Error("not signed in");
      return fetchResidentOrg(userId);
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
