/** Shared types + role gates for the manager portal. Mirrors server-side rules. */

export type PortalRole =
  | "hoa_admin"
  | "property_manager"
  | "property_staff"
  | "board_member"
  | "super_admin";

export interface PortalMembership {
  orgId: string;
  role: PortalRole;
}

export interface PortalOrg {
  id: string;
  name: string;
  type: string;
  invite_code: string | null;
  total_units: number | null;
  plan_tier: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
}

export interface PendingMemberRow {
  membership_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  unit_number: string | null;
  created_at: string;
  notes: string | null;
}

export interface OrgAnnouncementRow {
  id: string;
  title: string;
  body: string;
  priority: string;
  is_pinned: boolean;
  created_at: string;
}

export interface OrgDocumentRow {
  id: string;
  org_id: string;
  name: string;
  external_url: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface OrgAmenityRow {
  id: string;
  org_id: string;
  name: string;
}

export interface OrgReservationRow {
  id: string;
  amenity_id: string;
  reserved_by: string;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
  member: { name: string | null } | null;
}

export interface OrgPaymentRow {
  id: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  member: { name: string | null } | null;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface MaintenanceRequestRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  location_detail: string | null;
  is_urgent: boolean;
  created_at: string;
}

/* ── Role gates (client-side mirrors of the security-definer RPC checks) ── */

// Can view pending members / maintenance queue
export function canViewAdminTools(role: PortalRole): boolean {
  return (
    role === "hoa_admin" ||
    role === "property_manager" ||
    role === "property_staff" ||
    role === "board_member" ||
    role === "super_admin"
  );
}

// Matches approve/deny/get_pending_members RPC allowlists
export function canDecideMembers(role: PortalRole): boolean {
  return role === "hoa_admin" || role === "property_manager" || role === "super_admin";
}

// Matches regenerate_org_invite_code allowlist
export function canRegenInviteCode(role: PortalRole): boolean {
  return role === "hoa_admin" || role === "super_admin";
}

// Amenities + payments ledger start on the Community plan (Starter excluded,
// matching the mobile tier gate and the Pricing comparison rows).
export function isCommunityPlanOrHigher(planTier: string | null | undefined): boolean {
  return planTier === "community" || planTier === "professional" || planTier === "enterprise";
}

// API access is Enterprise-only (matches the Pricing comparison rows).
export function isEnterprisePlan(planTier: string | null | undefined): boolean {
  return planTier === "enterprise";
}

export const ROLE_LABELS: Record<PortalRole, string> = {
  hoa_admin: "HOA Admin",
  property_manager: "Property Manager",
  property_staff: "Staff",
  board_member: "Board Member",
  super_admin: "Super Admin",
};
