import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { useOfflineQueue } from '@/store/OfflineQueueContext';
import { log, warn } from '@/lib/logger';
import {
  Organization,
  OrgMembership,
  OrgContextRow,
  OrgAnnouncement,
  AnnouncementCategory,
  OrgType,
  OrgRole,
  AnnouncementPriority,
  VariationMode,
  ADMIN_ROLES,
  STAFF_ROLES,
  ANNOUNCEMENT_ROLES,
  type AdminDashboardStats,
  type PendingMember,
  type PackageLogStatus,
  type PackageSizeHint,
  type CalendarRsvpStatus,
} from '@/types/organization';
import type { IncidentType, IncidentSeverity, IncidentStatus, IncidentResolutionCode } from '@/types/incidents';

// ─── DB row → domain mappers ──────────────────────────────────────────────────

function rowToOrg(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as OrgType,
    address: (row.address as string) ?? '',
    city: (row.city as string) ?? '',
    state: (row.state as string) ?? '',
    zip: (row.zip as string) ?? '',
    totalUnits: (row.total_units as number | null) ?? null,
    logoUrl: (row.logo_url as string | null) ?? null,
    inviteCode: (row.invite_code as string | null) ?? null,
    adminUserId: (row.admin_user_id as string | null) ?? null,
    isVerified: (row.is_verified as boolean) ?? false,
    isActive: (row.is_active as boolean) ?? true,
    website: (row.website as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function contextRowToMembership(row: OrgContextRow, userId: string): OrgMembership {
  return {
    id: row.membership_id,
    userId,
    orgId: row.org_id,
    unitId: row.unit_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    invitedBy: null,
    notes: null,
    createdAt: row.joined_at ?? new Date().toISOString(),
    updatedAt: row.joined_at ?? new Date().toISOString(),
    unitNumber: row.unit_number,
    org: {
      id: row.org_id,
      name: row.org_name,
      type: row.org_type,
      address: '',
      city: '',
      state: '',
      zip: '',
      totalUnits: null,
      logoUrl: row.org_logo_url,
      inviteCode: null,
      adminUserId: null,
      isVerified: row.org_is_verified,
      isActive: true,
      website: null,
      contactEmail: null,
      contactPhone: null,
      notes: null,
      createdAt: '',
      updatedAt: '',
    },
  };
}

function announcementRow(row: Record<string, unknown>): OrgAnnouncement {
  const rawVariations = row.body_variations;
  const bodyVariations: string[] | null =
    Array.isArray(rawVariations) && rawVariations.length > 0
      ? (rawVariations as string[])
      : null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    authorId: row.author_id as string,
    authorDisplayName: (row.author_display_name as string | null) ?? null,
    title: row.title as string,
    body: row.body as string,
    priority: (row.priority as AnnouncementPriority) ?? 'normal',
    category: (row.category as AnnouncementCategory) ?? 'general',
    isPinned: (row.is_pinned as boolean) ?? false,
    expiresAt: (row.expires_at as string | null) ?? null,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    viewCount: (row.view_count as number) ?? 0,
    bodyVariations,
    variationMode: (row.variation_mode as VariationMode | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const [OrganizationProvider, useOrganization] = createContextHook(() => {
  const { session } = useApp();
  const { isOnline, enqueue } = useOfflineQueue();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? null;

  // ── Membership context query (RPC) ────────────────────────────────────────
  const membershipQuery = useQuery({
    queryKey: ['org-context', userId],
    queryFn: async () => {
      if (!userId) return [];
      log('[OrgContext] Fetching org context...');
      const { data, error } = await supabase.rpc('get_my_org_context');
      if (error) {
        warn('[OrgContext] get_my_org_context error:', error.code);
        return [];
      }
      const rows = (data ?? []) as OrgContextRow[];
      return rows.map((r) => contextRowToMembership(r, userId));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // ── Active membership (first active, or first pending) ────────────────────
  const activeMembership = useMemo<OrgMembership | null>(() => {
    const memberships = membershipQuery.data ?? [];
    return (
      memberships.find((m) => m.status === 'active') ??
      memberships.find((m) => m.status === 'pending') ??
      null
    );
  }, [membershipQuery.data]);

  const activeOrg: Organization | null = activeMembership?.org ?? null;
  const orgRole: OrgRole | null = activeMembership?.role ?? null;

  // ── Role convenience booleans ─────────────────────────────────────────────
  const isOrgMember = activeMembership?.status === 'active';
  const isOrgPending = activeMembership?.status === 'pending';
  const isOrgAdmin = isOrgMember && !!orgRole && ADMIN_ROLES.includes(orgRole);
  const isOrgStaff = isOrgMember && !!orgRole && STAFF_ROLES.includes(orgRole);
  const canPostAnnouncements =
    isOrgMember && !!orgRole && ANNOUNCEMENT_ROLES.includes(orgRole);

  // ── Org search (for join flow) ────────────────────────────────────────────
  const searchOrgs = useCallback(
    async (query: string, type?: OrgType): Promise<Organization[]> => {
      log('[OrgContext] Searching orgs:', query);
      let q = supabase
        .from('organizations')
        .select('*')
        .eq('is_active', true)
        .ilike('name', `%${query}%`)
        .limit(20);
      if (type) q = q.eq('type', type);
      const { data, error } = await q;
      if (error) {
        warn('[OrgContext] Org search error:', error.code);
        return [];
      }
      return ((data ?? []) as Record<string, unknown>[]).map(rowToOrg);
    },
    []
  );

  const searchByInviteCode = useCallback(async (code: string): Promise<Organization | null> => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('invite_code', code.toUpperCase().trim())
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return null;
    return rowToOrg(data as Record<string, unknown>);
  }, []);

  // ── Request membership ────────────────────────────────────────────────────
  const requestMembershipMutation = useMutation({
    mutationFn: async ({
      orgId,
      unitId,
    }: {
      orgId: string;
      unitId?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('org_memberships')
        .insert({
          user_id: userId,
          org_id: orgId,
          unit_id: unitId ?? null,
          role: 'resident',
          status: 'pending',
        })
        .select()
        .single();
      if (error) {
        warn('[OrgContext] Membership request error:', error.code);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-context', userId] });
    },
  });

  // ── Create org (claim flow for admins) ───────────────────────────────────
  const createOrgMutation = useMutation({
    mutationFn: async ({
      name,
      type,
      address,
      city,
      state,
      zip,
      totalUnits,
    }: {
      name: string;
      type: OrgType;
      address: string;
      city: string;
      state: string;
      zip: string;
      totalUnits?: number;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      // Generate a 6-char invite code
      const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();

      // Insert org
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name,
          type,
          address,
          city,
          state,
          zip,
          total_units: totalUnits ?? null,
          admin_user_id: userId,
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (orgError) {
        warn('[OrgContext] Create org error:', orgError.code);
        throw orgError;
      }

      const org = rowToOrg(orgData as Record<string, unknown>);

      // Auto-join as hoa_admin with active status
      const { error: memberError } = await supabase.from('org_memberships').insert({
        user_id: userId,
        org_id: org.id,
        role: 'hoa_admin',
        status: 'active',
        joined_at: new Date().toISOString(),
      });

      if (memberError) {
        warn('[OrgContext] Auto-join error:', memberError.code);
        // Non-fatal — org is created, user can re-join
      }

      return org;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-context', userId] });
    },
  });

  // ── Announcements ─────────────────────────────────────────────────────────
  const announcementsQuery = useQuery({
    queryKey: ['org-announcements', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase
        .from('org_announcements')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        warn('[OrgContext] Announcements fetch error:', error.code);
        return [];
      }
      return ((data ?? []) as Record<string, unknown>[]).map(announcementRow);
    },
    enabled: !!activeOrg?.id && isOrgMember,
    staleTime: 1000 * 60 * 2,
  });

  // ── Post announcement mutation ──────────────────────────────────────────
  const postAnnouncementMutation = useMutation({
    mutationFn: async ({
      title,
      body,
      priority = 'normal',
      category = 'general',
      isPinned = false,
      scheduledAt,
      expiresAt,
      authorDisplayName,
      bodyVariations,
      variationMode,
    }: {
      title: string;
      body: string;
      priority?: AnnouncementPriority;
      category?: AnnouncementCategory;
      isPinned?: boolean;
      scheduledAt?: string | null;
      expiresAt?: string | null;
      authorDisplayName?: string | null;
      bodyVariations?: string[] | null;
      variationMode?: VariationMode | null;
    }) => {
      if (!userId || !activeOrg?.id) throw new Error('Not authenticated or no active org');
      const hasVariations = bodyVariations && bodyVariations.length > 0;
      const { data, error } = await supabase
        .from('org_announcements')
        .insert({
          org_id: activeOrg.id,
          author_id: userId,
          author_display_name: authorDisplayName ?? null,
          title: title.trim(),
          body: body.trim(),
          priority,
          category,
          is_pinned: isPinned,
          scheduled_at: scheduledAt ?? null,
          expires_at: expiresAt ?? null,
          body_variations: hasVariations ? bodyVariations : null,
          variation_mode: hasVariations ? (variationMode ?? 'daily') : null,
        })
        .select()
        .single();
      if (error) {
        warn('[OrgContext] Post announcement error:', error.code);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-announcements', activeOrg?.id] });
    },
  });

  // ── Package log (staff) ───────────────────────────────────────────────────
  const packageLogQuery = useQuery({
    queryKey: ['org-package-log', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase
        .from('package_log_items')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('received_at', { ascending: false })
        .limit(50);
      if (error) {
        warn('[OrgContext] Package log fetch error:', error.code);
        return [];
      }
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: !!activeOrg?.id && isOrgStaff,
    staleTime: 1000 * 60 * 1,
  });

  // ── Approve membership ─────────────────────────────────────────────────────
  const approveMembershipMutation = useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('approve_org_membership', {
        p_membership_id: membershipId,
        p_org_id: activeOrg.id,
      });
      if (error) {
        warn('[OrgContext] Approve membership error:', error.code);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-pending-members', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  // ── Deny membership ───────────────────────────────────────────────────────
  const denyMembershipMutation = useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('deny_org_membership', {
        p_membership_id: membershipId,
        p_org_id: activeOrg.id,
      });
      if (error) {
        warn('[OrgContext] Deny membership error:', error.code);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-pending-members', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  // ── Log a package (staff) ──────────────────────────────────────────────────
  const logPackageMutation = useMutation({
    mutationFn: async ({
      carrier,
      tracking,
      unitNumber,
      notes,
      description,
      sizeHint,
      location,
    }: {
      carrier: string;
      tracking?: string | null;
      unitNumber?: string | null;
      notes?: string | null;
      description?: string | null;
      sizeHint?: PackageSizeHint | null;
      location?: string | null;
    }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('log_org_package', {
        p_org_id: activeOrg.id,
        p_carrier: carrier,
        p_tracking: tracking ?? null,
        p_unit_number: unitNumber ?? null,
        p_notes: notes ?? null,
        p_description: description ?? null,
        p_size_hint: sizeHint ?? null,
        p_location: location ?? null,
      });
      if (error) {
        warn('[OrgContext] Log package error:', error.code);
        throw error;
      }
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-package-log', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-package-board', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  // ── Update package status (staff) ────────────────────────────────────────
  const updatePackageStatusMutation = useMutation({
    mutationFn: async ({
      packageId,
      newStatus,
      notes,
      exceptionReason,
    }: {
      packageId: string;
      newStatus: PackageLogStatus;
      notes?: string | null;
      exceptionReason?: string | null;
    }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('update_org_package_status', {
        p_package_id: packageId,
        p_org_id: activeOrg.id,
        p_new_status: newStatus,
        p_notes: notes ?? null,
        p_exception_reason: exceptionReason ?? null,
      });
      if (error) {
        warn('[OrgContext] Update package status error:', error.code);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-package-log', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-package-board', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  // ── File an incident ─────────────────────────────────────────────────────
  const fileIncidentMutation = useMutation({
    mutationFn: async ({
      type,
      severity,
      title,
      description,
      unitNumber,
      packageLogId,
    }: {
      type: IncidentType;
      severity: IncidentSeverity;
      title: string;
      description?: string | null;
      unitNumber?: string | null;
      packageLogId?: string | null;
    }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('file_org_incident', {
        p_org_id: activeOrg.id,
        p_type: type,
        p_severity: severity,
        p_title: title.trim(),
        p_description: description ?? null,
        p_unit_number: unitNumber ?? null,
        p_package_log_id: packageLogId ?? null,
      });
      if (error) {
        warn('[OrgContext] File incident error:', error.code);
        throw error;
      }
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-incidents', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-incident-counts', activeOrg?.id] });
    },
  });

  // ── Update incident status (staff) ────────────────────────────────────────
  const updateIncidentStatusMutation = useMutation({
    mutationFn: async ({
      incidentId,
      newStatus,
      note,
      resolutionCode,
      resolutionNotes,
      escalationTarget,
      residentUpdate,
    }: {
      incidentId: string;
      newStatus: IncidentStatus;
      note?: string | null;
      resolutionCode?: IncidentResolutionCode | null;
      resolutionNotes?: string | null;
      escalationTarget?: string | null;
      residentUpdate?: string | null;
    }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('update_incident_status_rpc', {
        p_incident_id: incidentId,
        p_org_id: activeOrg.id,
        p_new_status: newStatus,
        p_note: note ?? null,
        p_resolution_code: resolutionCode ?? null,
        p_resolution_notes: resolutionNotes ?? null,
        p_escalation_target: escalationTarget ?? null,
        p_resident_update: residentUpdate ?? null,
      });
      if (error) {
        warn('[OrgContext] Update incident status error:', error.code);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-incidents', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-incident-counts', activeOrg?.id] });
    },
  });

  // ── Create property ───────────────────────────────────────────────────────
  const createPropertyMutation = useMutation({
    mutationFn: async ({
      name, address, city, state, zip, totalUnits, notes,
    }: {
      name: string; address: string; city: string;
      state: string; zip: string; totalUnits?: number | null; notes?: string | null;
    }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('create_org_property', {
        p_org_id: activeOrg.id,
        p_name: name.trim(),
        p_address: address.trim(),
        p_city: city.trim(),
        p_state: state.trim(),
        p_zip: zip.trim(),
        p_total_units: totalUnits ?? null,
        p_notes: notes ?? null,
      });
      if (error) { warn('[OrgContext] Create property error:', error.code); throw error; }
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-properties', activeOrg?.id] });
    },
  });

  // ── Create unit ───────────────────────────────────────────────────────────
  const createUnitMutation = useMutation({
    mutationFn: async ({
      propertyId, unitNumber, floor, notes,
    }: {
      propertyId: string; unitNumber: string; floor?: number | null; notes?: string | null;
    }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('create_org_unit', {
        p_property_id: propertyId,
        p_org_id: activeOrg.id,
        p_unit_number: unitNumber.trim(),
        p_floor: floor ?? null,
        p_notes: notes ?? null,
      });
      if (error) { warn('[OrgContext] Create unit error:', error.code); throw error; }
      return data as string;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['org-property-units', vars.propertyId] });
      void queryClient.invalidateQueries({ queryKey: ['org-properties', activeOrg?.id] });
    },
  });

  // ── Bulk create units ─────────────────────────────────────────────────────
  const bulkCreateUnitsMutation = useMutation({
    mutationFn: async ({ propertyId, unitNumbers }: { propertyId: string; unitNumbers: string[] }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('bulk_create_units', {
        p_property_id: propertyId,
        p_org_id: activeOrg.id,
        p_unit_numbers: unitNumbers,
      });
      if (error) { warn('[OrgContext] Bulk create units error:', error.code); throw error; }
      return data as number;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['org-property-units', vars.propertyId] });
      void queryClient.invalidateQueries({ queryKey: ['org-properties', activeOrg?.id] });
    },
  });

  // ── Remove unit ───────────────────────────────────────────────────────────
  const removeUnitMutation = useMutation({
    mutationFn: async ({ unitId, propertyId }: { unitId: string; propertyId: string }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('remove_org_unit', {
        p_unit_id: unitId,
        p_org_id: activeOrg.id,
      });
      if (error) { warn('[OrgContext] Remove unit error:', error.code); throw error; }
      return propertyId;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['org-property-units', vars.propertyId] });
      void queryClient.invalidateQueries({ queryKey: ['org-properties', activeOrg?.id] });
    },
  });

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refreshOrgContext = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['org-context', userId] }),
      queryClient.invalidateQueries({ queryKey: ['org-announcements', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-package-log', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-pending-members', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-package-board', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-incidents', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-incident-counts', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-properties', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-members-admin', activeOrg?.id] }),
    ]);
  }, [queryClient, userId, activeOrg?.id]);

  // role management mutations
  const assignMemberRoleMutation = useMutation({
    mutationFn: async ({ membershipId, newRole }: { membershipId: string; newRole: OrgRole }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('assign_org_member_role', {
        p_membership_id: membershipId,
        p_org_id: activeOrg.id,
        p_new_role: newRole,
      });
      if (error) { warn('[OrgContext] Assign role error:', error.code); throw error; }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-members-admin', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  const suspendMemberMutation = useMutation({
    mutationFn: async ({ membershipId, reason }: { membershipId: string; reason?: string }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('suspend_org_member', {
        p_membership_id: membershipId,
        p_org_id: activeOrg.id,
        p_reason: reason ?? null,
      });
      if (error) { warn('[OrgContext] Suspend member error:', error.code); throw error; }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-members-admin', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  const reinstateMemberMutation = useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('reinstate_org_member', {
        p_membership_id: membershipId,
        p_org_id: activeOrg.id,
      });
      if (error) { warn('[OrgContext] Reinstate member error:', error.code); throw error; }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-members-admin', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ membershipId }: { membershipId: string }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('remove_org_member', {
        p_membership_id: membershipId,
        p_org_id: activeOrg.id,
      });
      if (error) { warn('[OrgContext] Remove member error:', error.code); throw error; }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-members-admin', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  const inviteMemberByEmailMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: OrgRole }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('invite_org_member_by_email', {
        p_org_id: activeOrg.id,
        p_email: email.trim().toLowerCase(),
        p_role: role,
      });
      if (error) { warn('[OrgContext] Invite member error:', error.code); throw error; }
      return data as string | null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-members-admin', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] });
    },
  });

  // ── Maintenance: submit request ─────────────────────────────────────────────
  const submitMaintenanceMutation = useMutation({
    mutationFn: async ({
      category,
      priority,
      title,
      description,
      location,
      preferredTime,
      allowEntry,
      unitId,
    }: {
      category: string;
      priority: string;
      title: string;
      description?: string | null;
      location?: string | null;
      preferredTime?: string | null;
      allowEntry?: boolean;
      unitId?: string | null;
    }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('submit_maintenance_request', {
        p_org_id:      activeOrg.id,
        p_category:    category,
        p_priority:    priority,
        p_title:       title,
        p_description: description ?? null,
        p_location:    location ?? null,
        p_preferred:   preferredTime ?? null,
        p_allow_entry: allowEntry ?? false,
        p_unit_id:     unitId ?? null,
      });
      if (error) { warn('[OrgContext] Submit maintenance error:', error.code); throw error; }
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenance-queue', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['maintenance-counts', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['my-maintenance', activeOrg?.id] });
    },
  });

  // ── Maintenance: update status ───────────────────────────────────────────────
  const updateMaintenanceStatusMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
      note,
      resolution,
    }: {
      requestId: string;
      status: string;
      note?: string | null;
      resolution?: string | null;
    }) => {
      const { error } = await supabase.rpc('update_maintenance_status', {
        p_request_id: requestId,
        p_status:     status,
        p_note:       note ?? null,
        p_resolution: resolution ?? null,
      });
      if (error) { warn('[OrgContext] Update maintenance status error:', error.code); throw error; }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenance-queue', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['maintenance-counts', activeOrg?.id] });
    },
  });

  // ── Calendar: create event ──────────────────────────────────────────────────
  const createCalendarEventMutation = useMutation({
    mutationFn: async ({
      title,
      description,
      category,
      location,
      startsAt,
      endsAt,
      allDay,
      isRecurring,
      recurrenceRule,
      isPublic,
      notifyResidents,
      maxAttendees,
    }: {
      title: string;
      description?: string | null;
      category?: string;
      location?: string | null;
      startsAt: string;
      endsAt?: string | null;
      allDay?: boolean;
      isRecurring?: boolean;
      recurrenceRule?: string | null;
      isPublic?: boolean;
      notifyResidents?: boolean;
      maxAttendees?: number | null;
    }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('create_org_calendar_event', {
        p_org_id: activeOrg.id,
        p_title: title,
        p_description: description ?? null,
        p_category: category ?? 'other',
        p_location: location ?? null,
        p_starts_at: startsAt,
        p_ends_at: endsAt ?? null,
        p_all_day: allDay ?? false,
        p_is_recurring: isRecurring ?? false,
        p_recurrence_rule: recurrenceRule ?? null,
        p_is_public: isPublic ?? true,
        p_notify_residents: notifyResidents ?? false,
        p_max_attendees: maxAttendees ?? null,
      });
      if (error) { warn('[OrgContext] Create calendar event error:', error.code); throw error; }
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-calendar', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-upcoming-events', activeOrg?.id] });
    },
  });

  // ── Calendar: cancel event ───────────────────────────────────────────────────
  const cancelCalendarEventMutation = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason?: string }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('cancel_org_calendar_event', {
        p_event_id: eventId,
        p_org_id: activeOrg.id,
        p_reason: reason ?? null,
      });
      if (error) { warn('[OrgContext] Cancel event error:', error.code); throw error; }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-calendar', activeOrg?.id] });
      void queryClient.invalidateQueries({ queryKey: ['org-upcoming-events', activeOrg?.id] });
    },
  });

  // ── Calendar: upsert RSVP ────────────────────────────────────────────────────
  const upsertEventRsvpMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: CalendarRsvpStatus }) => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { error } = await supabase.rpc('upsert_event_rsvp', {
        p_event_id: eventId,
        p_org_id: activeOrg.id,
        p_status: status,
      });
      if (error) { warn('[OrgContext] RSVP error:', error.code); throw error; }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-calendar', activeOrg?.id] });
    },
  });

  const regenerateInviteCodeMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrg?.id) throw new Error('No active org');
      const { data, error } = await supabase.rpc('regenerate_org_invite_code', {
        p_org_id: activeOrg.id,
      });
      if (error) { warn('[OrgContext] Regenerate invite code error:', error.code); throw error; }
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-context', userId] });
    },
  });

  // ── Offline-aware wrappers for key mutations ────────────────────────────
  const postAnnouncementWithOffline = useCallback(async (
    params: {
      title: string;
      body: string;
      priority?: AnnouncementPriority;
      category?: AnnouncementCategory;
      isPinned?: boolean;
      scheduledAt?: string | null;
      expiresAt?: string | null;
      authorDisplayName?: string | null;
      bodyVariations?: string[] | null;
      variationMode?: VariationMode | null;
    },
  ) => {
    if (!isOnline && activeOrg?.id && userId) {
      const hasVariations = params.bodyVariations && params.bodyVariations.length > 0;
      enqueue({
        type: "insert",
        target: "org_announcements",
        payload: {
          org_id: activeOrg.id,
          author_id: userId,
          author_display_name: params.authorDisplayName ?? null,
          title: params.title.trim(),
          body: params.body.trim(),
          priority: params.priority ?? 'normal',
          category: params.category ?? 'general',
          is_pinned: params.isPinned ?? false,
          scheduled_at: params.scheduledAt ?? null,
          expires_at: params.expiresAt ?? null,
          body_variations: hasVariations ? params.bodyVariations : null,
          variation_mode: hasVariations ? (params.variationMode ?? 'daily') : null,
        },
        queryKeysToInvalidate: [["org-announcements"], ["announcements"]],
      });
      return;
    }
    return postAnnouncementMutation.mutateAsync(params);
  }, [isOnline, enqueue, activeOrg?.id, userId, postAnnouncementMutation]);

  const submitMaintenanceWithOffline = useCallback(async (
    params: {
      category: string;
      priority: string;
      title: string;
      description?: string | null;
      location?: string | null;
      preferredTime?: string | null;
      allowEntry?: boolean;
      unitId?: string | null;
    },
  ) => {
    if (!isOnline && activeOrg?.id) {
      enqueue({
        type: "rpc",
        target: "submit_maintenance_request",
        payload: {
          p_org_id: activeOrg.id,
          p_category: params.category,
          p_priority: params.priority,
          p_title: params.title,
          p_description: params.description ?? null,
          p_location: params.location ?? null,
          p_preferred: params.preferredTime ?? null,
          p_allow_entry: params.allowEntry ?? false,
          p_unit_id: params.unitId ?? null,
        },
        queryKeysToInvalidate: [["maintenance-queue"], ["maintenance-counts"], ["my-maintenance"]],
      });
      return;
    }
    return submitMaintenanceMutation.mutateAsync(params);
  }, [isOnline, enqueue, activeOrg?.id, submitMaintenanceMutation]);

  const updateMaintenanceStatusWithOffline = useCallback(async (
    params: {
      requestId: string;
      status: string;
      note?: string | null;
      resolution?: string | null;
    },
  ) => {
    if (!isOnline) {
      enqueue({
        type: "rpc",
        target: "update_maintenance_status",
        payload: {
          p_request_id: params.requestId,
          p_status: params.status,
          p_note: params.note ?? null,
          p_resolution: params.resolution ?? null,
        },
        queryKeysToInvalidate: [["maintenance-queue"], ["maintenance-counts"], ["my-maintenance"]],
      });
      return;
    }
    return updateMaintenanceStatusMutation.mutateAsync(params);
  }, [isOnline, enqueue, updateMaintenanceStatusMutation]);

  return useMemo(
    () => ({
      // State
      isLoading: membershipQuery.isLoading,
      activeMembership,
      activeOrg,
      orgRole,
      allMemberships: membershipQuery.data ?? [],
      announcements: announcementsQuery.data ?? [],
      packageLog: packageLogQuery.data ?? [],
      isAnnouncementsLoading: announcementsQuery.isLoading,
      isPackageLogLoading: packageLogQuery.isLoading,
      // Role booleans
      isOrgMember,
      isOrgPending,
      isOrgAdmin,
      isOrgStaff,
      canPostAnnouncements,
      // Actions
      searchOrgs,
      searchByInviteCode,
      requestMembership: requestMembershipMutation.mutateAsync,
      isRequestingMembership: requestMembershipMutation.isPending,
      createOrg: createOrgMutation.mutateAsync,
      isCreatingOrg: createOrgMutation.isPending,
      postAnnouncement: postAnnouncementWithOffline,
      isPostingAnnouncement: postAnnouncementMutation.isPending,
      approveMembership: approveMembershipMutation.mutateAsync,
      isApprovingMembership: approveMembershipMutation.isPending,
      denyMembership: denyMembershipMutation.mutateAsync,
      isDenyingMembership: denyMembershipMutation.isPending,
      logPackage: logPackageMutation.mutateAsync,
      isLoggingPackage: logPackageMutation.isPending,
      updatePackageStatus: updatePackageStatusMutation.mutateAsync,
      isUpdatingPackageStatus: updatePackageStatusMutation.isPending,
      fileIncident: fileIncidentMutation.mutateAsync,
      isFilingIncident: fileIncidentMutation.isPending,
      updateIncidentStatus: updateIncidentStatusMutation.mutateAsync,
      isUpdatingIncidentStatus: updateIncidentStatusMutation.isPending,
      // Property management
      createProperty: createPropertyMutation.mutateAsync,
      isCreatingProperty: createPropertyMutation.isPending,
      createUnit: createUnitMutation.mutateAsync,
      isCreatingUnit: createUnitMutation.isPending,
      bulkCreateUnits: bulkCreateUnitsMutation.mutateAsync,
      isBulkCreatingUnits: bulkCreateUnitsMutation.isPending,
      removeUnit: removeUnitMutation.mutateAsync,
      isRemovingUnit: removeUnitMutation.isPending,
      // Role management
      assignMemberRole: assignMemberRoleMutation.mutateAsync,
      isAssigningMemberRole: assignMemberRoleMutation.isPending,
      suspendMember: suspendMemberMutation.mutateAsync,
      isSuspendingMember: suspendMemberMutation.isPending,
      reinstateMember: reinstateMemberMutation.mutateAsync,
      isReinstatingMember: reinstateMemberMutation.isPending,
      removeMember: removeMemberMutation.mutateAsync,
      isRemovingMember: removeMemberMutation.isPending,
      inviteMemberByEmail: inviteMemberByEmailMutation.mutateAsync,
      isInvitingMember: inviteMemberByEmailMutation.isPending,
      regenerateInviteCode: regenerateInviteCodeMutation.mutateAsync,
      isRegeneratingInviteCode: regenerateInviteCodeMutation.isPending,
      // Maintenance
      submitMaintenance: submitMaintenanceWithOffline,
      isSubmittingMaintenance: submitMaintenanceMutation.isPending,
      updateMaintenanceStatus: updateMaintenanceStatusWithOffline,
      isUpdatingMaintenanceStatus: updateMaintenanceStatusMutation.isPending,
      // Calendar
      createCalendarEvent: createCalendarEventMutation.mutateAsync,
      isCreatingCalendarEvent: createCalendarEventMutation.isPending,
      cancelCalendarEvent: cancelCalendarEventMutation.mutateAsync,
      isCancellingCalendarEvent: cancelCalendarEventMutation.isPending,
      upsertEventRsvp: upsertEventRsvpMutation.mutateAsync,
      isUpsertingRsvp: upsertEventRsvpMutation.isPending,
      refreshOrgContext,
    }),
    [
      membershipQuery.isLoading,
      membershipQuery.data,
      activeMembership,
      activeOrg,
      orgRole,
      announcementsQuery.data,
      announcementsQuery.isLoading,
      packageLogQuery.data,
      packageLogQuery.isLoading,
      isOrgMember,
      isOrgPending,
      isOrgAdmin,
      isOrgStaff,
      canPostAnnouncements,
      searchOrgs,
      searchByInviteCode,
      requestMembershipMutation.mutateAsync,
      requestMembershipMutation.isPending,
      createOrgMutation.mutateAsync,
      createOrgMutation.isPending,
      postAnnouncementWithOffline,
      postAnnouncementMutation.isPending,
      approveMembershipMutation.mutateAsync,
      approveMembershipMutation.isPending,
      denyMembershipMutation.mutateAsync,
      denyMembershipMutation.isPending,
      logPackageMutation.mutateAsync,
      logPackageMutation.isPending,
      updatePackageStatusMutation.mutateAsync,
      updatePackageStatusMutation.isPending,
      fileIncidentMutation.mutateAsync,
      fileIncidentMutation.isPending,
      updateIncidentStatusMutation.mutateAsync,
      updateIncidentStatusMutation.isPending,
      createPropertyMutation.mutateAsync,
      createPropertyMutation.isPending,
      createUnitMutation.mutateAsync,
      createUnitMutation.isPending,
      bulkCreateUnitsMutation.mutateAsync,
      bulkCreateUnitsMutation.isPending,
      removeUnitMutation.mutateAsync,
      removeUnitMutation.isPending,
      assignMemberRoleMutation.mutateAsync,
      assignMemberRoleMutation.isPending,
      suspendMemberMutation.mutateAsync,
      suspendMemberMutation.isPending,
      reinstateMemberMutation.mutateAsync,
      reinstateMemberMutation.isPending,
      removeMemberMutation.mutateAsync,
      removeMemberMutation.isPending,
      inviteMemberByEmailMutation.mutateAsync,
      inviteMemberByEmailMutation.isPending,
      regenerateInviteCodeMutation.mutateAsync,
      regenerateInviteCodeMutation.isPending,
      submitMaintenanceWithOffline,
      submitMaintenanceMutation.isPending,
      updateMaintenanceStatusWithOffline,
      updateMaintenanceStatusMutation.isPending,
      createCalendarEventMutation.mutateAsync,
      createCalendarEventMutation.isPending,
      cancelCalendarEventMutation.mutateAsync,
      cancelCalendarEventMutation.isPending,
      upsertEventRsvpMutation.mutateAsync,
      upsertEventRsvpMutation.isPending,
      refreshOrgContext,
    ]
  );
});
