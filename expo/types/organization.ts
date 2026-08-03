// ─── Organization domain types ────────────────────────────────────────────────
// Additive — these do NOT modify existing homeowner / partner types in index.ts.
// Org roles are completely separate from the profile `role` column
// ('homeowner' | 'partner' | 'both'). A homeowner can also be an hoa_admin.

/** The context / product mode an organization operates in. */
export type OrgType = 'hoa' | 'condo' | 'multifamily' | 'property_management';

/**
 * Role within an organization.
 * Separate from the profiles.role field (homeowner / partner).
 */
export type OrgRole =
  | 'resident'
  | 'board_member'
  | 'hoa_admin'
  | 'property_staff'
  | 'property_manager'
  | 'super_admin';

/** Lifecycle state of an org membership request. */
export type OrgMembershipStatus = 'pending' | 'active' | 'suspended' | 'removed';

export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * How body_variations rotate when multiple phrase alternatives are configured.
 *  sequential — cycles by view_count index
 *  random     — seeded-random that changes daily per announcement id
 *  daily      — changes every calendar day
 *  weekly     — changes every calendar week
 */
export type VariationMode = 'sequential' | 'random' | 'daily' | 'weekly';

export type PackageLogStatus =
  | 'received'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'returned_to_sender'
  | 'exception';

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  address: string;
  city: string;
  state: string;
  zip: string;
  totalUnits: number | null;
  logoUrl: string | null;
  inviteCode: string | null;
  adminUserId: string | null;
  isVerified: boolean;
  isActive: boolean;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  orgId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  totalUnits: number | null;
  managerUserId: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgUnit {
  id: string;
  propertyId: string;
  orgId: string;
  unitNumber: string;
  floor: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMembership {
  id: string;
  userId: string;
  orgId: string;
  unitId: string | null;
  role: OrgRole;
  status: OrgMembershipStatus;
  joinedAt: string | null;
  invitedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields from get_my_org_context RPC
  org?: Organization;
  unitNumber?: string | null;
}

export type AnnouncementCategory =
  | 'general'
  | 'package'
  | 'maintenance'
  | 'safety'
  | 'meeting'
  | 'parking'
  | 'amenity'
  | 'emergency';

export interface OrgAnnouncement {
  id: string;
  orgId: string;
  authorId: string;
  /** Cached display name from profiles — avoids join on list render. */
  authorDisplayName: string | null;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  category: AnnouncementCategory;
  isPinned: boolean;
  expiresAt: string | null;
  /** NULL = published immediately. Future timestamp = scheduled. */
  scheduledAt: string | null;
  viewCount: number;
  /**
   * Alternative body strings. When null/empty the primary `body` is used.
   * The active variation is resolved client-side via resolveDisplayBody().
   */
  bodyVariations: string[] | null;
  variationMode: VariationMode | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Phrase variation resolver ─────────────────────────────────────────────────

/** Stable daily seed from an announcement id (changes every 24 h). */
function dailySeed(id: string): number {
  const day = Math.floor(Date.now() / 86400000);
  const str = id + day;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/**
 * Resolve which body string a resident sees right now.
 * Falls back to `body` when no variations are configured.
 */
export function resolveDisplayBody(item: OrgAnnouncement): string {
  const { body, bodyVariations, variationMode, viewCount } = item;
  if (!bodyVariations || bodyVariations.length === 0) return body;
  const all = [body, ...bodyVariations];
  const len = all.length;
  switch (variationMode) {
    case 'daily':      return all[Math.floor(Date.now() / 86400000) % len];
    case 'weekly':     return all[Math.floor(Date.now() / (86400000 * 7)) % len];
    case 'sequential': return all[viewCount % len];
    case 'random':
    default:           return all[dailySeed(item.id) % len];
  }
}

export interface PackageLogItem {
  id: string;
  orgId: string;
  propertyId: string | null;
  unitId: string | null;
  residentId: string | null;
  loggedBy: string;
  shipmentId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  status: PackageLogStatus;
  notes: string | null;
  photoUrl: string | null;
  receivedAt: string;
  pickedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Package Operations Board ─────────────────────────────────────────────────

export type PackageSizeHint = 'small' | 'medium' | 'large' | 'oversized';

/**
 * Enriched package row returned by get_org_packages_board() RPC.
 * Includes joined unit_number and logged_by_name for display without extra fetches.
 */
export interface PackageBoardItem {
  id: string;
  orgId: string;
  propertyId: string | null;
  unitId: string | null;
  unitNumber: string | null;
  residentId: string | null;
  loggedBy: string;
  loggedByName: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: PackageLogStatus;
  notes: string | null;
  description: string | null;
  sizeHint: PackageSizeHint | null;
  locationInOffice: string | null;
  exceptionReason: string | null;
  photoUrl: string | null;
  receivedAt: string;
  pickedUpAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Row returned by get_package_board_counts() RPC */
export interface PackageBoardCount {
  status: PackageLogStatus;
  count: number;
}

/** Map a raw RPC row to a PackageBoardItem */
export function packageBoardRowToItem(row: Record<string, unknown>): PackageBoardItem {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    propertyId: (row.property_id as string | null) ?? null,
    unitId: (row.unit_id as string | null) ?? null,
    unitNumber: (row.unit_number as string | null) ?? null,
    residentId: (row.resident_id as string | null) ?? null,
    loggedBy: row.logged_by as string,
    loggedByName: (row.logged_by_name as string) ?? 'Staff',
    carrier: (row.carrier as string | null) ?? null,
    trackingNumber: (row.tracking_number as string | null) ?? null,
    status: (row.status as PackageLogStatus) ?? 'received',
    notes: (row.notes as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    sizeHint: (row.size_hint as PackageSizeHint | null) ?? null,
    locationInOffice: (row.location_in_office as string | null) ?? null,
    exceptionReason: (row.exception_reason as string | null) ?? null,
    photoUrl: (row.photo_url as string | null) ?? null,
    receivedAt: (row.received_at as string) ?? new Date().toISOString(),
    pickedUpAt: (row.picked_up_at as string | null) ?? null,
    notifiedAt: (row.notified_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Carrier metadata ─────────────────────────────────────────────────────────

export interface CarrierMeta {
  label: string;
  color: string;
  abbrev: string;
}

export const CARRIER_META: Record<string, CarrierMeta> = {
  UPS:       { label: 'UPS',       color: '#8B4513', abbrev: 'UPS' },
  FedEx:     { label: 'FedEx',     color: '#4D148C', abbrev: 'FDX' },
  USPS:      { label: 'USPS',      color: '#004B87', abbrev: 'USPS' },
  Amazon:    { label: 'Amazon',    color: '#FF9900', abbrev: 'AMZ' },
  DHL:       { label: 'DHL',       color: '#D40511', abbrev: 'DHL' },
  OnTrac:    { label: 'OnTrac',    color: '#E31837', abbrev: 'OT' },
  LaserShip: { label: 'LaserShip', color: '#00A3E0', abbrev: 'LS' },
  Other:     { label: 'Other',     color: '#6B7F99', abbrev: '?' },
};

/** Return carrier display metadata; falls back gracefully for unknown carriers. */
export function carrierMeta(carrier: string | null): CarrierMeta {
  if (!carrier) return CARRIER_META['Other'];
  return CARRIER_META[carrier] ?? { label: carrier, color: '#6B7F99', abbrev: carrier.slice(0, 3).toUpperCase() };
}

// ─── Package status display ───────────────────────────────────────────────────

export const PKG_STATUS_LABELS: Record<PackageLogStatus, string> = {
  received:           'Received',
  ready_for_pickup:   'Ready for Pickup',
  picked_up:          'Picked Up',
  returned_to_sender: 'Returned',
  exception:          'Exception',
};

// ─── Resident Directory ────────────────────────────────────────────────────────

/** Raw row returned by the get_org_directory() RPC. */
export interface DirectoryRow {
  membership_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  unit_number: string | null;
  role: string;
  joined_at: string | null;
  /** Only non-null for staff/admin callers */
  email: string | null;
  /** Only non-null for staff/admin callers */
  phone: string | null;
}

/**
 * Enriched directory entry with client-side display helpers.
 * Initials, avatar color, and section letter are derived from raw data.
 */
export interface ResidentDirectoryEntry {
  membershipId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  unitNumber: string | null;
  role: OrgRole;
  joinedAt: string | null;
  /** Redacted to null unless caller is staff/admin */
  email: string | null;
  /** Redacted to null unless caller is staff/admin */
  phone: string | null;
  /** Derived: up to 2 initials from displayName */
  initials: string;
  /** Derived: deterministic color from userId */
  avatarColor: string;
  /** Derived: uppercase first letter of displayName for SectionList headers */
  sectionLetter: string;
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

export interface AdminDashboardStats {
  total_members: number;
  pending_members: number;
  suspended_members: number;
  packages_received: number;
  packages_ready: number;
  packages_picked_up: number;
  packages_exception: number;
  packages_today: number;
  total_announcements: number;
  active_announcements: number;
  pinned_announcements: number;
  admin_actions_today: number;
}

export interface PendingMember {
  membership_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  unit_number: string | null;
  created_at: string;
  notes: string | null;
  /** Derived client-side */
  initials: string;
  avatarColor: string;
}

// ─── Property Management ─────────────────────────────────────────────────────

export interface PropertyRow {
  id: string;
  orgId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  totalUnits: number | null;
  managerUserId: string | null;
  managerName: string | null;
  isActive: boolean;
  notes: string | null;
  unitCount: number;
  occupiedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnitRow {
  id: string;
  propertyId: string;
  orgId: string;
  unitNumber: string;
  floor: number | null;
  notes: string | null;
  residentName: string | null;
  residentId: string | null;
  membershipId: string | null;
  createdAt: string;
}

export interface PropertySummaryStats {
  total_properties: number;
  active_properties: number;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
}

export function propertyRowFromRpc(row: Record<string, unknown>): PropertyRow {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    address: (row.address as string) ?? '',
    city: (row.city as string) ?? '',
    state: (row.state as string) ?? '',
    zip: (row.zip as string) ?? '',
    totalUnits: (row.total_units as number | null) ?? null,
    managerUserId: (row.manager_user_id as string | null) ?? null,
    managerName: (row.manager_name as string | null) ?? null,
    isActive: (row.is_active as boolean) ?? true,
    notes: (row.notes as string | null) ?? null,
    unitCount: (row.unit_count as number) ?? 0,
    occupiedCount: (row.occupied_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function unitRowFromRpc(row: Record<string, unknown>): UnitRow {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    orgId: row.org_id as string,
    unitNumber: row.unit_number as string,
    floor: (row.floor as number | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    residentName: (row.resident_name as string | null) ?? null,
    residentId: (row.resident_id as string | null) ?? null,
    membershipId: (row.membership_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ─── Community Analytics ────────────────────────────────────────────────────

export interface DailyVolume {
  day: string;
  count: number;
}

export interface CarrierCount {
  carrier: string;
  count: number;
}

export interface TypeCount {
  type: string;
  count: number;
}

export interface SeverityCount {
  severity: string;
  count: number;
}

export interface TrendTagCount {
  tag: string;
  count: number;
}

export interface RoleCount {
  role: OrgRole;
  count: number;
}

export interface PackageAnalytics {
  total: number;
  received: number;
  ready: number;
  picked_up: number;
  exception: number;
  returned: number;
  today: number;
  this_week: number;
  avg_pickup_hours: number | null;
  overdue_count: number;
  by_carrier: CarrierCount[];
  daily_volumes: DailyVolume[];
}

export interface IncidentAnalytics {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  escalated: number;
  overdue: number;
  this_week: number;
  avg_resolution_hours: number | null;
  sla_compliance_pct: number;
  by_type: TypeCount[];
  by_severity: SeverityCount[];
  top_trend_tags: TrendTagCount[];
}

export interface CommunityAnalyticsData {
  total_members: number;
  pending_members: number;
  suspended_members: number;
  new_this_month: number;
  new_this_week: number;
  by_role: RoleCount[];
  total_announcements: number;
  announcements_this_month: number;
  total_announcement_views: number;
  total_properties: number;
  total_units: number;
  occupied_units: number;
  admin_actions_this_month: number;
}

export interface CommunityHealthScore {
  score: number;
  pkg_score: number;
  inc_score: number;
  member_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'Healthy' | 'Fair' | 'Needs Attention' | 'Critical';
}

// ─── Role Management ────────────────────────────────────────────────────────

/**
 * Full member row returned by get_org_members_admin() RPC.
 * Includes profile data, unit assignment, and invite provenance.
 */
export interface MemberAdminRow {
  membershipId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  unitNumber: string | null;
  role: OrgRole;
  status: OrgMembershipStatus;
  joinedAt: string | null;
  invitedBy: string | null;
  invitedByName: string | null;
  notes: string | null;
  createdAt: string;
  /** Derived client-side */
  initials: string;
  avatarColor: string;
}

/** Roles an hoa_admin can assign to another member (super_admin excluded). */
export const ASSIGNABLE_ROLES: OrgRole[] = [
  'resident',
  'board_member',
  'property_staff',
  'property_manager',
  'hoa_admin',
];

export function memberAdminRowFromRpc(row: Record<string, unknown>): MemberAdminRow {
  const displayName = (row.display_name as string) ?? 'Unknown';
  return {
    membershipId: row.membership_id as string,
    userId: row.user_id as string,
    displayName,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    unitNumber: (row.unit_number as string | null) ?? null,
    role: (row.role as OrgRole) ?? 'resident',
    status: (row.status as OrgMembershipStatus) ?? 'pending',
    joinedAt: (row.joined_at as string | null) ?? null,
    invitedBy: (row.invited_by as string | null) ?? null,
    invitedByName: (row.invited_by_name as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    initials: initialsForName(displayName),
    avatarColor: avatarColorForId(row.user_id as string),
  };
}

// ─── RPC response shape ───────────────────────────────────────────────────────

/** Row returned by get_my_org_context() */
export interface OrgContextRow {
  membership_id: string;
  org_id: string;
  org_name: string;
  org_type: OrgType;
  org_logo_url: string | null;
  org_is_verified: boolean;
  unit_id: string | null;
  unit_number: string | null;
  role: OrgRole;
  status: OrgMembershipStatus;
  joined_at: string | null;
}

// ─── Role capability helpers ───────────────────────────────────────────────────

/** Roles that can perform administrative actions. */
export const ADMIN_ROLES: OrgRole[] = ['hoa_admin', 'super_admin'];

/** Roles that have staff-level visibility (packages, residents). */
export const STAFF_ROLES: OrgRole[] = [
  'hoa_admin',
  'property_manager',
  'property_staff',
  'super_admin',
];

/** Roles that can post announcements. */
export const ANNOUNCEMENT_ROLES: OrgRole[] = [
  'board_member',
  'hoa_admin',
  'property_manager',
  'property_staff',
  'super_admin',
];

/** Roles that can see full contact details in the directory. */
export const DIRECTORY_STAFF_ROLES: OrgRole[] = [
  'hoa_admin',
  'property_manager',
  'property_staff',
  'super_admin',
];

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  hoa: 'HOA',
  condo: 'Condo',
  multifamily: 'Multifamily',
  property_management: 'Property Mgmt',
};

export const ORG_TYPE_DESCRIPTIONS: Record<OrgType, string> = {
  hoa: 'Homeowners Association',
  condo: 'Condominium Association',
  multifamily: 'Apartment / Multifamily',
  property_management: 'Property Management Company',
};

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  resident: 'Resident',
  board_member: 'Board Member',
  hoa_admin: 'HOA Admin',
  property_staff: 'Staff',
  property_manager: 'Property Manager',
  super_admin: 'Super Admin',
};

export const MEMBERSHIP_STATUS_LABELS: Record<OrgMembershipStatus, string> = {
  pending: 'Pending Approval',
  active: 'Active',
  suspended: 'Suspended',
  removed: 'Removed',
};

// ─── Community Calendar ───────────────────────────────────────────────────

export type CalendarEventCategory =
  | 'meeting'
  | 'maintenance'
  | 'amenity'
  | 'social'
  | 'deadline'
  | 'inspection'
  | 'emergency'
  | 'other';

export type CalendarEventStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export type CalendarRsvpStatus = 'going' | 'maybe' | 'not_going';

export interface CalendarEvent {
  id: string;
  orgId: string;
  createdBy: string;
  creatorName: string;
  title: string;
  description: string | null;
  category: CalendarEventCategory;
  status: CalendarEventStatus;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  isRecurring: boolean;
  recurrenceRule: string | null;
  recurrenceEndDate: string | null;
  isPublic: boolean;
  notifyResidents: boolean;
  maxAttendees: number | null;
  isCancelled: boolean;
  cancelledReason: string | null;
  rsvpGoing: number;
  rsvpMaybe: number;
  myRsvp: CalendarRsvpStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpcomingEventRow {
  id: string;
  title: string;
  category: CalendarEventCategory;
  startsAt: string;
  location: string | null;
  isPublic: boolean;
}

export interface CalendarEventMeta {
  label: string;
  color: string;
  icon: string;
}

export const CALENDAR_CATEGORY_META: Record<CalendarEventCategory, CalendarEventMeta> = {
  meeting:     { label: 'Meeting',     color: '#3A7BD5', icon: 'building-2' },
  maintenance: { label: 'Maintenance', color: '#E07B00', icon: 'wrench' },
  amenity:     { label: 'Amenity',     color: '#2E9B6F', icon: 'waves' },
  social:      { label: 'Social',      color: '#8B5CF6', icon: 'party-popper' },
  deadline:    { label: 'Deadline',    color: '#C2410C', icon: 'timer' },
  inspection:  { label: 'Inspection',  color: '#0891B2', icon: 'search' },
  emergency:   { label: 'Emergency',   color: '#DC2626', icon: 'alert-triangle' },
  other:       { label: 'Other',       color: '#6B7F99', icon: 'pin' },
};

export function calendarEventFromRpc(row: Record<string, unknown>): CalendarEvent {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    createdBy: row.created_by as string,
    creatorName: (row.creator_name as string) ?? 'Staff',
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    category: (row.category as CalendarEventCategory) ?? 'other',
    status: (row.status as CalendarEventStatus) ?? 'scheduled',
    location: (row.location as string | null) ?? null,
    startsAt: row.starts_at as string,
    endsAt: (row.ends_at as string | null) ?? null,
    allDay: (row.all_day as boolean) ?? false,
    isRecurring: (row.is_recurring as boolean) ?? false,
    recurrenceRule: (row.recurrence_rule as string | null) ?? null,
    recurrenceEndDate: (row.recurrence_end_date as string | null) ?? null,
    isPublic: (row.is_public as boolean) ?? true,
    notifyResidents: (row.notify_residents as boolean) ?? false,
    maxAttendees: (row.max_attendees as number | null) ?? null,
    isCancelled: (row.is_cancelled as boolean) ?? false,
    cancelledReason: (row.cancelled_reason as string | null) ?? null,
    rsvpGoing: Number(row.rsvp_going ?? 0),
    rsvpMaybe: Number(row.rsvp_maybe ?? 0),
    myRsvp: (row.my_rsvp as CalendarRsvpStatus | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function upcomingEventFromRpc(row: Record<string, unknown>): UpcomingEventRow {
  return {
    id: row.id as string,
    title: row.title as string,
    category: (row.category as CalendarEventCategory) ?? 'other',
    startsAt: row.starts_at as string,
    location: (row.location as string | null) ?? null,
    isPublic: (row.is_public as boolean) ?? true,
  };
}

// ─── Avatar color palette ──────────────────────────────────────────────────────
// Deterministic colors for directory avatars — matches Porchivo's brand palette.

export const AVATAR_COLORS = [
  '#3A7BD5', // primary blue
  '#E07B00', // secondary orange
  '#2E9B6F', // success green
  '#8B5CF6', // violet
  '#0891B2', // teal
  '#C2410C', // rust
  '#1D4ED8', // deep blue
] as const;

/** Derive a stable avatar color from a userId string. */
export function avatarColorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

/** Derive initials (up to 2 chars) from a display name. */
export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Map a DirectoryRow to a ResidentDirectoryEntry with display helpers. */
export function directoryRowToEntry(row: DirectoryRow): ResidentDirectoryEntry {
  return {
    membershipId: row.membership_id,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    unitNumber: row.unit_number,
    role: row.role as OrgRole,
    joinedAt: row.joined_at,
    email: row.email,
    phone: row.phone,
    initials: initialsForName(row.display_name),
    avatarColor: avatarColorForId(row.user_id),
    sectionLetter: row.display_name.charAt(0).toUpperCase() || '#',
  };
}
