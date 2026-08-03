// ─── Activity / Audit History Types ──────────────────────────────────────────
// Additive — does not touch existing type files.
// Describes entries written by DB triggers and the get_org_audit_log() RPC.

export type AuditEntityType =
  | 'member'
  | 'package'
  | 'announcement'
  | 'incident'
  | 'property'
  | 'unit'
  | 'role'
  | 'org';

export type AuditActionType =
  // ── Member lifecycle
  | 'member_joined'
  | 'member_approved'
  | 'member_denied'
  | 'member_suspended'
  | 'member_reinstated'
  | 'member_removed'
  | 'member_invited'
  | 'role_assigned'
  // ── Package operations
  | 'package_logged'
  | 'package_status_updated'
  | 'package_exception_flagged'
  // ── Announcements
  | 'announcement_posted'
  | 'announcement_updated'
  | 'announcement_deleted'
  // ── Incidents
  | 'incident_filed'
  | 'incident_assigned'
  | 'incident_escalated'
  | 'incident_resolved'
  | 'incident_closed'
  | 'incident_status_changed'
  // ── Properties / units
  | 'property_created'
  | 'property_updated'
  | 'unit_created'
  | 'unit_removed'
  // ── Org settings
  | 'invite_code_regenerated'
  | 'org_settings_updated';

/** A single timestamped action in the community audit trail. */
export interface AuditLogEntry {
  id: string;
  orgId: string;
  actorId: string | null;
  actorName: string;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string | null;
  entityLabel: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** 30-day activity count for a single entity category (from get_org_audit_summary). */
export interface AuditSummaryRow {
  entityType: AuditEntityType;
  actionCount: number;
  lastAction: string;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Human-readable verb + entity chip for an audit entry. */
export interface AuditDisplay {
  verb: string;
  entityChip: string | null;
  /** Badge color for the timeline node and chip tint. */
  color: string;
}

const COLORS: Record<AuditEntityType, string> = {
  member:       '#3A7BD5',
  package:      '#E07B00',
  announcement: '#D97706',
  incident:     '#D94040',
  property:     '#2E9B6F',
  unit:         '#0891B2',
  role:         '#8B5CF6',
  org:          '#6B7F99',
};

export function auditEntityColor(entityType: AuditEntityType): string {
  return COLORS[entityType] ?? '#6B7F99';
}

export function auditDisplay(entry: AuditLogEntry): AuditDisplay {
  const label = entry.entityLabel ?? 'item';
  const color = auditEntityColor(entry.entityType);

  switch (entry.actionType) {
    // Member
    case 'member_joined':
      return { verb: 'requested to join', entityChip: null, color };
    case 'member_approved':
      return { verb: 'approved', entityChip: label, color };
    case 'member_denied':
      return { verb: 'declined request from', entityChip: label, color };
    case 'member_suspended':
      return { verb: 'suspended', entityChip: label, color };
    case 'member_reinstated':
      return { verb: 'reinstated', entityChip: label, color };
    case 'member_removed':
      return { verb: 'removed', entityChip: label, color };
    case 'member_invited':
      return { verb: 'invited', entityChip: label, color };
    case 'role_assigned': {
      const role = (entry.metadata?.role as string | undefined)?.replace(/_/g, ' ') ?? '';
      return { verb: `set role to ${role} for`, entityChip: label, color: COLORS.role };
    }
    // Package
    case 'package_logged':
      return { verb: 'logged a package', entityChip: label ? `Unit ${label}` : null, color };
    case 'package_status_updated': {
      const status = (entry.metadata?.status as string | undefined)?.replace(/_/g, ' ') ?? 'updated';
      return { verb: `marked package ${status}`, entityChip: label ? `Unit ${label}` : null, color };
    }
    case 'package_exception_flagged':
      return { verb: 'flagged package exception', entityChip: label ? `Unit ${label}` : null, color: COLORS.incident };
    // Announcement
    case 'announcement_posted':
      return { verb: 'posted', entityChip: label, color };
    case 'announcement_updated':
      return { verb: 'updated post', entityChip: label, color };
    case 'announcement_deleted':
      return { verb: 'deleted post', entityChip: label, color };
    // Incident
    case 'incident_filed':
      return { verb: 'filed incident', entityChip: label, color };
    case 'incident_assigned':
      return { verb: 'took ownership of', entityChip: label, color };
    case 'incident_escalated':
      return { verb: 'escalated', entityChip: label, color };
    case 'incident_resolved':
      return { verb: 'resolved', entityChip: label, color: COLORS.property };
    case 'incident_closed':
      return { verb: 'closed', entityChip: label, color: COLORS.property };
    case 'incident_status_changed':
      return { verb: 'updated incident', entityChip: label, color };
    // Property / unit
    case 'property_created':
      return { verb: 'added property', entityChip: label, color };
    case 'property_updated':
      return { verb: 'updated property', entityChip: label, color };
    case 'unit_created':
      return { verb: 'added unit', entityChip: label, color };
    case 'unit_removed':
      return { verb: 'removed unit', entityChip: label, color };
    // Org
    case 'invite_code_regenerated':
      return { verb: 'regenerated invite code', entityChip: null, color: COLORS.org };
    case 'org_settings_updated':
      return { verb: 'updated org settings', entityChip: null, color: COLORS.org };
    default:
      return { verb: (entry.actionType as string).replace(/_/g, ' '), entityChip: label, color };
  }
}

/** Map a raw RPC row to AuditLogEntry. */
export function auditRowToEntry(row: Record<string, unknown>, orgId: string): AuditLogEntry {
  return {
    id: row.id as string,
    orgId,
    actorId: (row.actor_id as string | null) ?? null,
    actorName: (row.actor_name as string) ?? 'System',
    actionType: row.action_type as AuditActionType,
    entityType: row.entity_type as AuditEntityType,
    entityId: (row.entity_id as string | null) ?? null,
    entityLabel: (row.entity_label as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

/** FILTER_TABS config — matches the screen's filter chips. */
export interface AuditFilterTab {
  id: AuditEntityType | 'all';
  label: string;
  entityType: AuditEntityType | null;
}

export const AUDIT_FILTER_TABS: AuditFilterTab[] = [
  { id: 'all',          label: 'All',        entityType: null },
  { id: 'member',       label: 'Members',    entityType: 'member' },
  { id: 'package',      label: 'Packages',   entityType: 'package' },
  { id: 'incident',     label: 'Incidents',  entityType: 'incident' },
  { id: 'announcement', label: 'Posts',      entityType: 'announcement' },
  { id: 'property',     label: 'Properties', entityType: 'property' },
];

/** Entity type icon name mapping (for lucide-react-native). */
export type AuditIconName =
  | 'UserCheck'
  | 'Package'
  | 'AlertTriangle'
  | 'Megaphone'
  | 'Building2'
  | 'Hash'
  | 'Shield'
  | 'Settings';

export const AUDIT_ENTITY_ICON: Record<AuditEntityType, AuditIconName> = {
  member:       'UserCheck',
  package:      'Package',
  incident:     'AlertTriangle',
  announcement: 'Megaphone',
  property:     'Building2',
  unit:         'Hash',
  role:         'Shield',
  org:          'Settings',
};
