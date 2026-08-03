// ─────────────────────────────────────────────────────────────────────────────
// Porchivo · Incident Review Queue — domain types
// Additive: does NOT modify organization.ts or any existing types.
// ─────────────────────────────────────────────────────────────────────────────

import type { OrgRole } from './organization';

// ── Enumerations ──────────────────────────────────────────────────────────────

export type IncidentType =
  | 'missing_package'
  | 'delivered_not_found'
  | 'misdelivered'
  | 'damaged'
  | 'tampered'
  | 'suspicious_activity'
  | 'held_too_long'
  | 'wrong_pickup'
  | 'rule_violation'
  | 'carrier_failure'
  | 'duplicate_complaint'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus =
  | 'flagged'
  | 'intake'
  | 'investigating'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type IncidentResolutionCode =
  | 'package_found'
  | 'misdelivery_corrected'
  | 'resident_recovered'
  | 'carrier_contacted'
  | 'replacement_handled'
  | 'insufficient_evidence'
  | 'duplicate'
  | 'escalated_board'
  | 'escalated_security'
  | 'escalated_carrier'
  | 'monitoring'
  | 'other';

// ── Entity ────────────────────────────────────────────────────────────────────

export interface IncidentReport {
  id: string;
  orgId: string;
  unitId: string | null;
  unitNumber: string | null;
  reporterId: string;
  reporterName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  packageLogId: string | null;
  relatedIncidentId: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string | null;
  residentVisibleUpdate: string | null;
  resolutionCode: IncidentResolutionCode | null;
  dueDate: string | null;
  closedAt: string | null;
  escalationTarget: string | null;
  trendTags: string[];
  commentCount: number;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentCounts {
  open_count: number;
  escalated_count: number;
  overdue_count: number;
  unassigned_count: number;
  flagged_count: number;
}

// ── Display metadata ──────────────────────────────────────────────────────────

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  missing_package:     'Missing Package',
  delivered_not_found: 'Delivered, Not Found',
  misdelivered:        'Misdelivered',
  damaged:             'Damaged',
  tampered:            'Opened / Tampered',
  suspicious_activity: 'Suspicious Activity',
  held_too_long:       'Held Too Long',
  wrong_pickup:        'Wrong Pickup',
  rule_violation:      'Rule Violation',
  carrier_failure:     'Carrier Failure',
  duplicate_complaint: 'Duplicate',
  other:               'Other',
};

export const INCIDENT_TYPE_EMOJI: Record<IncidentType, string> = {
  missing_package:     '📦',
  delivered_not_found: '🔍',
  misdelivered:        '🔀',
  damaged:             '💥',
  tampered:            '🔓',
  suspicious_activity: '⚠️',
  held_too_long:       '⏰',
  wrong_pickup:        '🤝',
  rule_violation:      '📋',
  carrier_failure:     '🚚',
  duplicate_complaint: '♻️',
  other:               '❓',
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  flagged:      'Flagged',
  intake:       'In Review',
  investigating: 'Investigating',
  escalated:    'Escalated',
  resolved:     'Resolved',
  closed:       'Closed',
};

export const INCIDENT_RESOLUTION_LABELS: Record<IncidentResolutionCode, string> = {
  package_found:         'Package Found',
  misdelivery_corrected: 'Misdelivery Corrected',
  resident_recovered:    'Resident Recovered Item',
  carrier_contacted:     'Carrier Contacted',
  replacement_handled:   'Replacement / Refund Handled',
  insufficient_evidence: 'Insufficient Evidence',
  duplicate:             'Duplicate Incident',
  escalated_board:       'Escalated to Board',
  escalated_security:    'Escalated to Security',
  escalated_carrier:     'Escalated to Carrier / Vendor',
  monitoring:            'Pattern Under Observation',
  other:                 'Other',
};

// ── Resolution options grouped for picker ─────────────────────────────────────

export const RESOLUTION_OPTIONS: { code: IncidentResolutionCode; label: string; icon: string }[] = [
  { code: 'package_found',         label: 'Package Found',            icon: '✅' },
  { code: 'misdelivery_corrected', label: 'Misdelivery Corrected',    icon: '🔀' },
  { code: 'resident_recovered',    label: 'Resident Recovered Item',  icon: '👤' },
  { code: 'carrier_contacted',     label: 'Carrier Contacted',        icon: '🚚' },
  { code: 'replacement_handled',   label: 'Replacement / Refund',     icon: '🔄' },
  { code: 'insufficient_evidence', label: 'Insufficient Evidence',    icon: '🔎' },
  { code: 'duplicate',             label: 'Duplicate',                icon: '♻️' },
  { code: 'escalated_board',       label: 'Escalated to Board',       icon: '🏛️' },
  { code: 'escalated_security',    label: 'Escalated to Security',    icon: '🔒' },
  { code: 'escalated_carrier',     label: 'Escalated to Carrier',     icon: '📮' },
  { code: 'monitoring',            label: 'Under Observation',        icon: '👁️' },
  { code: 'other',                 label: 'Other',                    icon: '❓' },
];

// ── Status lifecycle helpers ──────────────────────────────────────────────────

/**
 * Returns the valid next statuses from a given status.
 * Prevents nonsensical transitions (e.g. closed → flagged).
 */
export function nextIncidentStatuses(current: IncidentStatus): IncidentStatus[] {
  switch (current) {
    case 'flagged':      return ['intake', 'closed'];
    case 'intake':       return ['investigating', 'escalated', 'resolved', 'closed'];
    case 'investigating': return ['escalated', 'resolved', 'closed'];
    case 'escalated':    return ['investigating', 'resolved', 'closed'];
    case 'resolved':     return ['closed', 'investigating'];
    case 'closed':       return [];
    default:             return [];
  }
}

/** True if the status is still actionable (not terminal). */
export function isActiveStatus(status: IncidentStatus): boolean {
  return !['resolved', 'closed'].includes(status);
}

// ── Severity color system ─────────────────────────────────────────────────────
// Returns a hex color string for a given severity level.
// Caller must have access to the color system for semantic colors.
// These are raw fallback values; prefer using Colors from useColors() in components.

export const SEVERITY_HEX: Record<IncidentSeverity, string> = {
  low:      '#6B7F99',   // slate
  medium:   '#D4A000',   // gold
  high:     '#E07B00',   // orange / secondary
  critical: '#DC2626',   // red / danger
};

// ── Roles that can manage incidents ──────────────────────────────────────────

export const INCIDENT_MANAGER_ROLES: OrgRole[] = [
  'hoa_admin',
  'property_manager',
  'property_staff',
  'board_member',
  'super_admin',
];

// ── Row mapper ────────────────────────────────────────────────────────────────

/** Map a raw RPC row (snake_case) to a typed IncidentReport. */
export function incidentRowToReport(row: Record<string, unknown>): IncidentReport {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    unitId: (row.unit_id as string | null) ?? null,
    unitNumber: (row.unit_number as string | null) ?? null,
    reporterId: row.reporter_id as string,
    reporterName: (row.reporter_name as string) ?? 'Unknown',
    assigneeId: (row.assignee_id as string | null) ?? null,
    assigneeName: (row.assignee_name as string | null) ?? null,
    packageLogId: (row.package_log_id as string | null) ?? null,
    relatedIncidentId: (row.related_incident_id as string | null) ?? null,
    type: (row.type as IncidentType) ?? 'other',
    severity: (row.severity as IncidentSeverity) ?? 'medium',
    status: (row.status as IncidentStatus) ?? 'flagged',
    title: (row.title as string) ?? 'Untitled Incident',
    description: (row.description as string | null) ?? null,
    residentVisibleUpdate: (row.resident_visible_update as string | null) ?? null,
    resolutionCode: (row.resolution_code as IncidentResolutionCode | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    closedAt: (row.closed_at as string | null) ?? null,
    escalationTarget: (row.escalation_target as string | null) ?? null,
    trendTags: Array.isArray(row.trend_tags) ? (row.trend_tags as string[]) : [],
    commentCount: Number(row.comment_count ?? 0),
    evidenceCount: Number(row.evidence_count ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
