/**
 * SubscriptionStatusCard — Reusable org plan/tier dashboard widget.
 *
 * Fetches `plan_tier`, `billing_cycle`, `subscription_status`, and
 * `current_period_end` from the `organizations` table for the active org.
 *
 * Visible to all org members (residents see their community's plan status).
 * Admins get an additional "Manage" link → /manage-subscription.
 *
 * Designed for embedding in the More tab, a home dashboard, or any
 * community-tier screen.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  PauseCircle,
  CreditCard,
  ChevronRight,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { warn } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgSubscriptionData {
  plan_tier: string;
  billing_cycle: string;
  subscription_status: string;
  current_period_end: string | null;
  name: string;
}

// ─── Plan metadata ───────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  community: 'Community',
  professional: 'Professional',
  enterprise: 'Property Manager',
};

interface StatusMeta {
  label: string;
  icon: typeof CheckCircle2;
  colorKey: 'success' | 'danger' | 'gold' | 'secondary' | 'slateLighter';
}
const STATUS_META: Record<string, StatusMeta> = {
  active: { label: 'Active', icon: CheckCircle2, colorKey: 'success' },
  pending: { label: 'Pending', icon: Clock, colorKey: 'gold' },
  past_due: { label: 'Past Due', icon: AlertCircle, colorKey: 'danger' },
  canceled: { label: 'Canceled', icon: XCircle, colorKey: 'slateLighter' },
  trialing: { label: 'Trial', icon: Clock, colorKey: 'secondary' },
  none: { label: 'No Plan', icon: PauseCircle, colorKey: 'slateLighter' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SubscriptionStatusCard() {
  const Colors = useColors();
  const router = useRouter();
  const { activeOrg, isOrgAdmin } = useOrganization();

  const subQuery = useQuery({
    queryKey: ['org-subscription-status', activeOrg?.id],
    queryFn: async (): Promise<OrgSubscriptionData | null> => {
      if (!activeOrg?.id) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('plan_tier, billing_cycle, subscription_status, current_period_end, name')
        .eq('id', activeOrg.id)
        .maybeSingle();
      if (error) {
        warn('[SubStatusCard] Fetch error:', error.code);
        return null;
      }
      return data as OrgSubscriptionData;
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 2,
  });

  // ── Loading state ─────────────────────────────────────────────────────────
  if (subQuery.isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: Colors.primary + '14' }]}>
            <Building2 size={20} color={Colors.primary} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: Colors.slate }]}>Plan Status</Text>
            <Text style={[styles.subtitle, { color: Colors.slateLighter }]}>Loading…</Text>
          </View>
          <ActivityIndicator size="small" color={Colors.slateLighter} />
        </View>
      </View>
    );
  }

  const sub = subQuery.data;
  const planLabel = sub ? PLAN_LABELS[sub.plan_tier] ?? sub.plan_tier : 'No Plan';
  const statusKey = sub?.subscription_status ?? 'none';
  const statusMeta = STATUS_META[statusKey] ?? STATUS_META.none;
  const StatusIcon = statusMeta.icon;
  const statusColor = Colors[statusMeta.colorKey];
  const renewalDate = formatDate(sub?.current_period_end ?? null);
  const daysLeft = daysUntil(sub?.current_period_end ?? null);
  const isCanceled = statusKey === 'canceled';
  const isPastDue = statusKey === 'past_due';

  return (
    <View style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: Colors.primary + '14' }]}>
          <Building2 size={20} color={Colors.primary} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: Colors.slate }]} numberOfLines={1}>
            {sub?.name ?? activeOrg?.name ?? 'Community'}
          </Text>
          <Text style={[styles.subtitle, { color: Colors.slateLighter }]}>
            {planLabel} Plan · {sub?.billing_cycle === 'annual' ? 'Annual' : 'Monthly'}
          </Text>
        </View>
        {/* Status badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusColor + '18' },
          ]}
        >
          <StatusIcon size={13} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* ── Renewal / expiry row ───────────────────────────────────────────── */}
      {renewalDate && (
        <View
          style={[
            styles.renewalRow,
            { borderTopColor: Colors.borderLight },
          ]}
        >
          <Clock size={14} color={Colors.slateLighter} />
          <Text style={[styles.renewalLabel, { color: Colors.slateLighter }]}>
            {isCanceled ? 'Expires' : 'Renews'}
          </Text>
          <Text style={[styles.renewalDate, { color: Colors.slate }]}>
            {renewalDate}
          </Text>
          {daysLeft !== null && daysLeft >= 0 && !isCanceled && (
            <Text
              style={[
                styles.daysLeft,
                {
                  color:
                    isPastDue
                      ? Colors.danger
                      : daysLeft <= 7
                        ? Colors.gold
                        : Colors.slateLighter,
                },
              ]}
            >
              {daysLeft}d left
            </Text>
          )}
        </View>
      )}

      {/* ── Past due warning ──────────────────────────────────────────────── */}
      {isPastDue && (
        <View style={[styles.warningRow, { backgroundColor: Colors.danger + '0A' }]}>
          <AlertCircle size={13} color={Colors.danger} />
          <Text style={[styles.warningText, { color: Colors.danger }]}>
            Payment failed — update billing to avoid disruption
          </Text>
        </View>
      )}

      {/* ── Admin manage link ──────────────────────────────────────────────── */}
      {isOrgAdmin && (
        <TouchableOpacity
          style={[styles.manageRow, { borderTopColor: Colors.borderLight }]}
          onPress={() => router.push('/manage-subscription')}
          activeOpacity={0.7}
        >
          <View style={[styles.manageIcon, { backgroundColor: Colors.primary + '14' }]}>
            <CreditCard size={15} color={Colors.primary} />
          </View>
          <Text style={[styles.manageText, { color: Colors.slate }]}>
            Manage Subscription
          </Text>
          <ChevronRight size={15} color={Colors.slateLighter} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },

  renewalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  renewalLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  renewalDate: {
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  daysLeft: {
    fontSize: 12,
    fontWeight: '700' as const,
  },

  warningRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
    lineHeight: 16,
  },

  manageRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  manageIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
