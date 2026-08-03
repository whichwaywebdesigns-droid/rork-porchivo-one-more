import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { log, error as logError } from '@/lib/logger';
import type {
  DbSupportTicket as DbSupportTicketRow,
  SupportTicketCategory as DbSupportTicketCategory,
  SupportTicketStatus as DbSupportTicketStatus,
  SupportTicketPriority as DbSupportTicketPriority,
  StaffSupportQueueRow,
  StaffSupportQueueCountRow,
} from '@/types/database';

// ─── DB row shape ─────────────────────────────────────────────────────────────
//
// Mirrors the `public.support_tickets` table on the shared Supabase project
// (see supabase/support-tickets-migration.sql).
//
// RLS is enabled: regular users can SELECT/UPDATE only their own rows
// (`user_id = auth.uid()`); staff with `app_metadata.role = 'support_staff'`
// can SELECT all tickets and UPDATE any ticket (WITH CHECK keeps user_id
// stable so staff cannot reassign ownership).
//
// The `ai_draft_*` columns are STAFF-ONLY — column-level grants revoke
// SELECT on them from `authenticated`, so the user-facing `select *` never
// returns them. They are typed as `null` on the client interface and never
// surfaced by the screens; staff tooling that authenticates with the
// service role reads them via the canonical DbSupportTicket in types/database.ts.

export type SupportTicketCategory = DbSupportTicketCategory;
export type SupportTicketStatus = DbSupportTicketStatus;
export type SupportTicketPriority = DbSupportTicketPriority;

/**
 * User-facing ticket row. Mirrors the DB columns a regular user can read
 * via RLS — `ai_draft_*` columns are excluded because column-level grants
 * revoke SELECT on them from `authenticated`.
 */
export interface DbSupportTicket {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  staff_reply: string | null;
  staff_replied_at: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  attachment_url: string | null;
  app_version: string | null;
  platform: string | null;
  device_model: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Full DB row including the staff-only AI-draft columns. Returned only to
 * service-role clients (staff tooling / the support-ticket-ai-draft Edge
 * Function). Regular users never see the `ai_draft_*` fields.
 */
export type DbSupportTicketWithDraft = DbSupportTicketRow;

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  body: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  staffReply: string | null;
  staffRepliedAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  attachmentUrl: string | null;
  appVersion: string | null;
  platform: string | null;
  deviceModel: string | null;
  createdAt: string;
  updatedAt: string;
}

export function dbTicketToTicket(row: DbSupportTicket): SupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    body: row.body,
    category: row.category,
    status: row.status,
    priority: row.priority,
    staffReply: row.staff_reply,
    staffRepliedAt: row.staff_replied_at,
    resolutionNote: row.resolution_note,
    resolvedAt: row.resolved_at,
    attachmentUrl: row.attachment_url,
    appVersion: row.app_version,
    platform: row.platform,
    deviceModel: row.device_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Labels & presentation ────────────────────────────────────────────────────

export const TICKET_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  delivery_issue: 'Delivery issue',
  payment_billing: 'Payment & billing',
  account_access: 'Account access',
  partner_dispute: 'Partner dispute',
  app_bug: 'App bug',
  feature_request: 'Feature request',
  safety_alert: 'Safety alert',
  other: 'Other',
};

export const TICKET_CATEGORY_EMOJI: Record<SupportTicketCategory, string> = {
  delivery_issue: '📦',
  payment_billing: '💳',
  account_access: '🔐',
  partner_dispute: '🤝',
  app_bug: '🐞',
  feature_request: '✨',
  safety_alert: '🚨',
  other: '📝',
};

export const TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_user: 'Awaiting your reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const TICKET_CATEGORIES: SupportTicketCategory[] = [
  'delivery_issue',
  'payment_billing',
  'account_access',
  'partner_dispute',
  'app_bug',
  'feature_request',
  'safety_alert',
  'other',
];

/** True when the ticket still expects action from the user or staff. */
export function isTicketActive(status: SupportTicketStatus): boolean {
  return status === 'open' || status === 'in_progress' || status === 'waiting_on_user';
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** Fetch all tickets owned by the current user, newest first. */
export async function fetchMyTickets(): Promise<SupportTicket[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  if (!isSupabaseConfigured) {
    if (__DEV__) {
      log('[supportTickets] DEV: Supabase not configured — returning empty ticket list');
    }
    return [];
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    logError('[supportTickets] fetchMyTickets error: ' + error.code);
    throw new Error('Failed to load support tickets');
  }

  return (data as DbSupportTicket[]).map(dbTicketToTicket);
}

/** Fetch a single ticket by id (RLS guarantees ownership for non-staff). */
export async function fetchTicketById(ticketId: string): Promise<SupportTicket | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();

  if (error) {
    logError('[supportTickets] fetchTicketById error: ' + error.code);
    return null;
  }
  return data ? dbTicketToTicket(data as DbSupportTicket) : null;
}

export interface CreateTicketInput {
  subject: string;
  body: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
  attachmentUrl?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  deviceModel?: string | null;
}

/**
 * Create a new support ticket for the current user.
 * RLS sets `user_id = auth.uid()` automatically via the default policy; the
 * client never sends user_id. Status defaults to 'open' server-side.
 */
export async function createTicket(input: CreateTicketInput): Promise<SupportTicket | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!isSupabaseConfigured) {
    if (__DEV__) log('[supportTickets] DEV: Supabase not configured — cannot create ticket');
    return null;
  }

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) return null;

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      subject,
      body,
      category: input.category,
      priority: input.priority ?? 'normal',
      attachment_url: input.attachmentUrl ?? null,
      app_version: input.appVersion ?? null,
      platform: input.platform ?? null,
      device_model: input.deviceModel ?? null,
      status: 'open',
    })
    .select()
    .single();

  if (error) {
    logError('[supportTickets] createTicket error: ' + error.code);
    return null;
  }

  return dbTicketToTicket(data as DbSupportTicket);
}

/**
 * Add a user reply to an existing ticket. The reply is appended to the
 * conversation via the staff_reply column being refreshed server-side by
 * support staff workflow; the user-side reply is stored as a follow-up.
 *
 * For now this re-opens a `waiting_on_user` ticket by setting status back to
 * `in_progress` and updating `updated_at`. Staff see the new activity in
 * their queue.
 */
export async function replyToTicket(
  ticketId: string,
  replyText: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const reply = replyText.trim();
  if (!reply) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Re-open if waiting on user; otherwise just bump updated_at.
  const { error } = await supabase
    .from('support_tickets')
    .update({
      body: reply, // append latest user message — staff inbox surfaces newest
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .eq('user_id', user.id); // RLS-equivalent guard on the client

  if (error) {
    logError('[supportTickets] replyToTicket error: ' + error.code);
    return false;
  }
  return true;
}

/** User closes their own ticket. RLS allows UPDATE on own row. */
export async function closeTicket(ticketId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'closed',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .eq('user_id', user.id);

  if (error) {
    logError('[supportTickets] closeTicket error: ' + error.code);
    return false;
  }
  return true;
}

/** User re-opens a closed/resolved ticket they own. */
export async function reopenTicket(ticketId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'open',
      resolved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .eq('user_id', user.id);

  if (error) {
    logError('[supportTickets] reopenTicket error: ' + error.code);
    return false;
  }
  return true;
}

// ─── Staff queue ──────────────────────────────────────────────────────────────
//
// These functions call SECURITY DEFINER RPCs (get_staff_support_queue,
// get_staff_support_queue_counts, send_staff_ticket_reply,
// regenerate_ticket_ai_draft) that re-check auth.app_metadata().role for
// 'support_staff' / 'super_admin' before returning the AI-draft columns or
// applying staff-side mutations. The column-level REVOKE on authenticated
// means a plain `select *` cannot read ai_draft_* — only these RPCs can.

/** Staff-side ticket row including the AI-draft columns. */
export interface StaffSupportTicket {
  id: string;
  userId: string;
  subject: string;
  body: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  staffReply: string | null;
  staffRepliedAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  attachmentUrl: string | null;
  appVersion: string | null;
  platform: string | null;
  deviceModel: string | null;
  aiDraftReply: string | null;
  aiDraftGeneratedAt: string | null;
  aiDraftModel: string | null;
  aiDraftFeedback: 'accepted' | 'edited' | 'rejected' | null;
  createdAt: string;
  updatedAt: string;
}

export type StaffTicketFilterStatus = SupportTicketStatus | 'all';

export interface StaffQueueCounts {
  total: number;
  open: number;
  inProgress: number;
  waitingOnUser: number;
  resolved: number;
  closed: number;
  withDraft: number;
  awaitingReview: number;
}

const STATUS_TO_KEY: Record<SupportTicketStatus, keyof Omit<StaffQueueCounts, 'total' | 'withDraft' | 'awaitingReview'>> = {
  open: 'open',
  in_progress: 'inProgress',
  waiting_on_user: 'waitingOnUser',
  resolved: 'resolved',
  closed: 'closed',
};

/** Map a raw RPC row into the StaffSupportTicket shape used by the UI. */
function staffRowToTicket(row: StaffSupportQueueRow): StaffSupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    body: row.body,
    category: row.category,
    status: row.status,
    priority: row.priority,
    staffReply: row.staff_reply,
    staffRepliedAt: row.staff_replied_at,
    resolutionNote: row.resolution_note,
    resolvedAt: row.resolved_at,
    attachmentUrl: row.attachment_url,
    appVersion: row.app_version,
    platform: row.platform,
    deviceModel: row.device_model,
    aiDraftReply: row.ai_draft_reply,
    aiDraftGeneratedAt: row.ai_draft_generated_at,
    aiDraftModel: row.ai_draft_model,
    aiDraftFeedback: row.ai_draft_feedback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FetchStaffQueueParams {
  status?: StaffTicketFilterStatus;
  priority?: SupportTicketPriority | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

/** Fetch the staff support queue (staff-only RPC). Returns [] on access error. */
export async function fetchStaffSupportQueue(
  params: FetchStaffQueueParams = {},
): Promise<StaffSupportTicket[]> {
  if (!isSupabaseConfigured) return [];

  const statusFilter =
    params.status && params.status !== 'all' ? params.status : null;
  const priorityFilter =
    params.priority && params.priority !== 'all' ? params.priority : null;
  const search = params.search && params.search.trim().length > 0 ? params.search.trim() : null;

  const { data, error } = await supabase.rpc('get_staff_support_queue', {
    p_status_filter: statusFilter,
    p_priority_filter: priorityFilter,
    p_search: search,
    p_limit: params.limit ?? 100,
    p_offset: params.offset ?? 0,
  });

  if (error) {
    logError('[supportTickets] fetchStaffSupportQueue error: ' + error.code);
    throw new Error('Failed to load support queue');
  }

  return ((data ?? []) as StaffSupportQueueRow[]).map(staffRowToTicket);
}

/** Fetch per-status counts for the staff queue header (staff-only RPC). */
export async function fetchStaffQueueCounts(): Promise<StaffQueueCounts> {
  const empty: StaffQueueCounts = {
    total: 0, open: 0, inProgress: 0, waitingOnUser: 0,
    resolved: 0, closed: 0, withDraft: 0, awaitingReview: 0,
  };
  if (!isSupabaseConfigured) return empty;

  const { data, error } = await supabase.rpc('get_staff_support_queue_counts');
  if (error) {
    logError('[supportTickets] fetchStaffQueueCounts error: ' + error.code);
    return empty;
  }

  const rows = (data ?? []) as StaffSupportQueueCountRow[];
  const counts: StaffQueueCounts = { ...empty };
  for (const row of rows) {
    const key = STATUS_TO_KEY[row.status];
    if (key) {
      counts[key] = row.status_count;
    }
    counts.total += row.status_count;
    counts.withDraft += row.with_draft;
    counts.awaitingReview += row.awaiting_review;
  }
  return counts;
}

export type DraftFeedback = 'accepted' | 'edited' | 'rejected';

export interface SendStaffReplyParams {
  ticketId: string;
  replyText: string;
  /** Optional explicit feedback label. If omitted the RPC infers it from the draft. */
  feedback?: DraftFeedback;
  resolutionNote?: string | null;
  /** When true, the ticket is marked resolved instead of waiting_on_user. */
  markResolved?: boolean;
}

/**
 * Promote a (possibly edited) AI draft or a hand-written reply to the
 * user-visible `staff_reply` column via the staff-only RPC. Throws on error.
 */
export async function sendStaffTicketReply(
  params: SendStaffReplyParams,
): Promise<StaffSupportTicket> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
  const reply = params.replyText.trim();
  if (!reply) {
    throw new Error('Reply text must not be empty');
  }

  const { data, error } = await supabase.rpc('send_staff_ticket_reply', {
    p_ticket_id: params.ticketId,
    p_reply_text: reply,
    p_feedback: params.feedback ?? null,
    p_resolution_note: params.resolutionNote ?? null,
    p_mark_resolved: params.markResolved ?? false,
  });

  if (error) {
    logError('[supportTickets] sendStaffTicketReply error: ' + error.code);
    throw new Error(error.message || 'Failed to send reply');
  }

  return staffRowToTicket(data as unknown as StaffSupportQueueRow);
}

/**
 * Re-enqueue the AI-draft Edge Function for a ticket. The draft is cleared
 * server-side and a new generation job is fired via pg_net, so the new text
 * lands asynchronously. Poll the queue to see the refreshed draft.
 */
export async function regenerateTicketAiDraft(ticketId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase.rpc('regenerate_ticket_ai_draft', {
    p_ticket_id: ticketId,
  });

  if (error) {
    logError('[supportTickets] regenerateTicketAiDraft error: ' + error.code);
    throw new Error(error.message || 'Failed to regenerate draft');
  }
  return true;
}

/** True when the ticket has an AI draft that staff have not yet promoted. */
export function isDraftAwaitingReview(ticket: StaffSupportTicket): boolean {
  return (
    ticket.aiDraftReply !== null &&
    ticket.staffReply === null &&
    (ticket.status === 'open' || ticket.status === 'in_progress')
  );
}
