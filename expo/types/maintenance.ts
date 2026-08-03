// ─────────────────────────────────────────────────────────────────────────────
// Porchivo · Maintenance Requests — domain types
// Additive: does NOT modify existing types files.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enumerations ──────────────────────────────────────────────────────────────

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'structural'
  | 'pest_control'
  | 'landscaping'
  | 'common_area'
  | 'appliance'
  | 'security'
  | 'parking'
  | 'elevator'
  | 'amenity'
  | 'other';

export type MaintenancePriority = 'low' | 'normal' | 'high' | 'emergency';

export type MaintenanceStatus =
  | 'submitted'
  | 'acknowledged'
  | 'scheduled'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type MaintenanceResolution =
  | 'completed_by_staff'
  | 'completed_by_vendor'
  | 'resident_resolved'
  | 'duplicate'
  | 'outside_scope'
  | 'cancelled_by_resident'
  | 'other';

// ── Core entity ───────────────────────────────────────────────────────────────

export interface MaintenanceRequest {
  id: string;
  orgId: string;
  unitId: string | null;
  unitNumber: string | null;
  reporterId: string;
  reporterName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  description: string | null;
  locationDetail: string | null;
  preferredTime: string | null;
  allowEntry: boolean;
  isUrgent: boolean;
  residentVisibleNote: string | null;
  resolutionCode: MaintenanceResolution | null;
  scheduledFor: string | null;
  completedAt: string | null;
  dueDate: string | null;
  photoUrl: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceCounts {
  open_count: number;
  emergency_count: number;
  in_progress_count: number;
  scheduled_count: number;
  completed_today: number;
  unassigned_count: number;
}

export interface MaintenanceComment {
  id: string;
  requestId: string;
  authorId: string;
  authorName: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

// ── Display metadata ──────────────────────────────────────────────────────────

export interface MaintenanceMeta {
  label: string;
  icon: string;
  color: string;
}

export const CATEGORY_META: Record<MaintenanceCategory, MaintenanceMeta> = {
  plumbing:    { label: 'Plumbing',     icon: 'droplets',     color: '#0891B2' },
  electrical:  { label: 'Electrical',   icon: 'zap',          color: '#D4A000' },
  hvac:        { label: 'HVAC',         icon: 'thermometer',  color: '#E07B00' },
  structural:  { label: 'Structural',   icon: 'hard-hat',     color: '#6B7280' },
  pest_control:{ label: 'Pest Control', icon: 'bug',          color: '#16A34A' },
  landscaping: { label: 'Landscaping',  icon: 'tree-pine',    color: '#2E9B6F' },
  common_area: { label: 'Common Area',  icon: 'building-2',   color: '#3A7BD5' },
  appliance:   { label: 'Appliance',    icon: 'plug',         color: '#8B5CF6' },
  security:    { label: 'Security',     icon: 'shield',       color: '#1D4ED8' },
  parking:     { label: 'Parking',      icon: 'car',          color: '#0891B2' },
  elevator:    { label: 'Elevator',     icon: 'arrow-up-down',color: '#C2410C' },
  amenity:     { label: 'Amenity',      icon: 'waves',        color: '#059669' },
  other:       { label: 'Other',        icon: 'wrench',       color: '#6B7F99' },
};

export const PRIORITY_META: Record<MaintenancePriority, { label: string; color: string; bgColor: string }> = {
  low:       { label: 'Low',       color: '#6B7F99', bgColor: '#6B7F9920' },
  normal:    { label: 'Normal',    color: '#3A7BD5', bgColor: '#3A7BD520' },
  high:      { label: 'High',      color: '#E07B00', bgColor: '#E07B0020' },
  emergency: { label: 'Emergency', color: '#DC2626', bgColor: '#DC262620' },
};

export const STATUS_META: Record<MaintenanceStatus, { label: string; color: string; icon: string }> = {
  submitted:    { label: 'Submitted',    color: '#6B7F99', icon: 'send' },
  acknowledged: { label: 'Acknowledged', color: '#3A7BD5', icon: 'eye' },
  scheduled:    { label: 'Scheduled',    color: '#8B5CF6', icon: 'calendar' },
  in_progress:  { label: 'In Progress',  color: '#E07B00', icon: 'hammer' },
  on_hold:      { label: 'On Hold',      color: '#D4A000', icon: 'pause-circle' },
  completed:    { label: 'Completed',    color: '#2E9B6F', icon: 'check-circle' },
  cancelled:    { label: 'Cancelled',    color: '#DC2626', icon: 'x-circle' },
};

export const RESOLUTION_META: Record<MaintenanceResolution, string> = {
  completed_by_staff:     'Completed by Staff',
  completed_by_vendor:    'Completed by Vendor',
  resident_resolved:      'Resident Self-Resolved',
  duplicate:              'Duplicate Request',
  outside_scope:          'Outside Scope',
  cancelled_by_resident:  'Cancelled by Resident',
  other:                  'Other',
};

// ── Ordered category list for submission grid ─────────────────────────────────

export const SUBMISSION_CATEGORIES: MaintenanceCategory[] = [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'structural',
  'common_area',
  'landscaping',
  'pest_control',
  'security',
  'parking',
  'elevator',
  'amenity',
  'other',
];

export const PRIORITY_OPTIONS: MaintenancePriority[] = ['low', 'normal', 'high', 'emergency'];

// ── Status transition helpers ─────────────────────────────────────────────────

/**
 * Valid next statuses a staff member can transition to from a given status.
 * Prevents nonsensical transitions.
 */
export function nextMaintenanceStatuses(current: MaintenanceStatus): MaintenanceStatus[] {
  switch (current) {
    case 'submitted':    return ['acknowledged', 'scheduled', 'in_progress', 'cancelled'];
    case 'acknowledged': return ['scheduled', 'in_progress', 'on_hold', 'cancelled'];
    case 'scheduled':    return ['in_progress', 'on_hold', 'cancelled'];
    case 'in_progress':  return ['on_hold', 'completed', 'cancelled'];
    case 'on_hold':      return ['in_progress', 'scheduled', 'cancelled'];
    case 'completed':    return [];
    case 'cancelled':    return ['submitted'];
    default:             return [];
  }
}

/** True when request is not in a terminal state. */
export function isActiveRequest(status: MaintenanceStatus): boolean {
  return !['completed', 'cancelled'].includes(status);
}

// ── RPC row mapper ────────────────────────────────────────────────────────────

/** Map a raw RPC row (snake_case) to a typed MaintenanceRequest. */
export function maintRequestFromRpc(row: Record<string, unknown>): MaintenanceRequest {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    unitId: (row.unit_id as string | null) ?? null,
    unitNumber: (row.unit_number as string | null) ?? null,
    reporterId: row.reporter_id as string,
    reporterName: (row.reporter_name as string) ?? 'Unknown',
    assigneeId: (row.assignee_id as string | null) ?? null,
    assigneeName: (row.assignee_name as string | null) ?? null,
    category: (row.category as MaintenanceCategory) ?? 'other',
    priority: (row.priority as MaintenancePriority) ?? 'normal',
    status: (row.status as MaintenanceStatus) ?? 'submitted',
    title: (row.title as string) ?? 'Untitled Request',
    description: (row.description as string | null) ?? null,
    locationDetail: (row.location_detail as string | null) ?? null,
    preferredTime: (row.preferred_time as string | null) ?? null,
    allowEntry: (row.allow_entry as boolean) ?? false,
    isUrgent: (row.is_urgent as boolean) ?? false,
    residentVisibleNote: (row.resident_visible_note as string | null) ?? null,
    resolutionCode: (row.resolution_code as MaintenanceResolution | null) ?? null,
    scheduledFor: (row.scheduled_for as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    photoUrl: (row.photo_url as string | null) ?? null,
    commentCount: Number(row.comment_count ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Map a resident-facing RPC row (fewer fields). */
export function myMaintRequestFromRpc(row: Record<string, unknown>): MaintenanceRequest {
  return {
    id: row.id as string,
    orgId: '',
    unitId: null,
    unitNumber: null,
    reporterId: '',
    reporterName: 'You',
    assigneeId: null,
    assigneeName: null,
    category: (row.category as MaintenanceCategory) ?? 'other',
    priority: (row.priority as MaintenancePriority) ?? 'normal',
    status: (row.status as MaintenanceStatus) ?? 'submitted',
    title: (row.title as string) ?? 'Untitled Request',
    description: (row.description as string | null) ?? null,
    locationDetail: (row.location_detail as string | null) ?? null,
    preferredTime: (row.preferred_time as string | null) ?? null,
    allowEntry: false,
    isUrgent: false,
    residentVisibleNote: (row.resident_visible_note as string | null) ?? null,
    resolutionCode: (row.resolution_code as MaintenanceResolution | null) ?? null,
    scheduledFor: (row.scheduled_for as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    dueDate: null,
    photoUrl: null,
    commentCount: Number(row.comment_count ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
