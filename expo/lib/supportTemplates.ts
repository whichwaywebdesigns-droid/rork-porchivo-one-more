import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';
import type {
  DbSupportReplyTemplate,
  SupportTicketCategory,
} from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportTemplateCategory = SupportTicketCategory | 'all';

/** Staff-facing template row, mapped from the DB shape. */
export interface SupportReplyTemplate {
  id: string;
  label: string;
  body: string;
  category: SupportTicketCategory | null;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function dbToTemplate(row: DbSupportReplyTemplate): SupportReplyTemplate {
  return {
    id: row.id,
    label: row.label,
    body: row.body,
    category: row.category,
    isDefault: row.is_default,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all staff reply templates. RLS guarantees only support_staff /
 * super_admin receive rows; an empty list is returned on access error so
 * the picker still renders gracefully.
 *
 * @param categoryFilter  Optional category filter; 'all' / null returns every template.
 */
export async function fetchSupportReplyTemplates(
  categoryFilter?: SupportTemplateCategory,
): Promise<SupportReplyTemplate[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from('support_reply_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('label', { ascending: true });

  if (categoryFilter && categoryFilter !== 'all') {
    query = query.eq('category', categoryFilter);
  }

  const { data, error } = await query;

  if (error) {
    logError('[supportTemplates] fetchSupportReplyTemplates error: ' + error.code);
    return [];
  }

  return ((data ?? []) as DbSupportReplyTemplate[]).map(dbToTemplate);
}

export interface SaveTemplateInput {
  /** Omit for create; include for update. */
  id?: string;
  label: string;
  body: string;
  category?: SupportTicketCategory | null;
}

/**
 * Create or update a staff reply template. RLS requires a support_staff /
 * super_admin session. Throws on error.
 */
export async function saveSupportReplyTemplate(
  input: SaveTemplateInput,
): Promise<SupportReplyTemplate> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
  const label = input.label.trim();
  const body = input.body.trim();
  if (!label) throw new Error('Template label must not be empty');
  if (!body) throw new Error('Template body must not be empty');

  if (input.id) {
    const { data, error } = await supabase
      .from('support_reply_templates')
      .update({
        label,
        body,
        category: input.category ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) {
      logError('[supportTemplates] update error: ' + error.code);
      throw new Error(error.message || 'Failed to update template');
    }
    return dbToTemplate(data as DbSupportReplyTemplate);
  }

  const { data, error } = await supabase
    .from('support_reply_templates')
    .insert({
      label,
      body,
      category: input.category ?? null,
      is_default: false,
    })
    .select('*')
    .single();
  if (error) {
    logError('[supportTemplates] insert error: ' + error.code);
    throw new Error(error.message || 'Failed to create template');
  }
  return dbToTemplate(data as DbSupportReplyTemplate);
}

/**
 * Delete a staff reply template. RLS requires a support_staff / super_admin
 * session. Throws on error.
 */
export async function deleteSupportReplyTemplate(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
  const { error } = await supabase
    .from('support_reply_templates')
    .delete()
    .eq('id', id);
  if (error) {
    logError('[supportTemplates] delete error: ' + error.code);
    throw new Error(error.message || 'Failed to delete template');
  }
}

// ─── Placeholder substitution ─────────────────────────────────────────────────

/**
 * Replace `{{token}}` placeholders in a template body with the provided values.
 * Unknown placeholders are left intact so staff can spot a missed substitution.
 *
 * Common tokens used by the seeded templates:
 *   {{first_name}}  {{building_name}}  {{unit}}  {{date}}  {{time}}  {{version}}
 */
export function substituteTemplatePlaceholders(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (full, key: string) => {
    const v = values[key];
    return v !== undefined && v.length > 0 ? v : full;
  });
}

// ─── Query keys (for React Query invalidation) ───────────────────────────────

export const SUPPORT_TEMPLATES_QUERY_KEY = ['support-reply-templates'] as const;
