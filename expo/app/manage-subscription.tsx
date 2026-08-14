/**
 * ManageSubscriptionScreen — Org admin subscription management
 *
 * Shows: plan tier, billing cycle, subscription status, renewal date,
 * invite code (with regenerate), and a link to Stripe billing portal
 * for payment method updates, invoice downloads, and cancellation.
 *
 * Admin-only — gated by isOrgAdmin from OrganizationContext.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Building2,
  CreditCard,
  Copy,
  RefreshCw,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Users,
  Zap,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { log, warn } from '@/lib/logger';

WebBrowser.maybeCompleteAuthSession();

interface OrgSubscription {
  id: string;
  name: string;
  plan_tier: string;
  billing_cycle: string;
  subscription_status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  invite_code: string | null;
  max_units: number | null;
  total_units: number | null;
  trial_ends_at: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  community: 'Community',
  professional: 'Professional',
  enterprise: 'Property Manager',
};

const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  starter: { monthly: 49, annual: 499 },
  community: { monthly: 99, annual: 999 },
  professional: { monthly: 179, annual: 1799 },
  enterprise: { monthly: 299, annual: 2990 },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#2E9B6F', bg: '#2E9B6F18' },
  pending: { label: 'Pending', color: '#E07B00', bg: '#E07B0018' },
  past_due: { label: 'Past Due', color: '#DC2626', bg: '#DC262618' },
  canceled: { label: 'Canceled', color: '#6B7F99', bg: '#6B7F9918' },
  trialing: { label: 'Trial', color: '#3A7BD5', bg: '#3A7BD518' },
  none: { label: 'No Subscription', color: '#6B7F99', bg: '#6B7F9918' },
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function ManageSubscriptionScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { activeOrg, isOrgAdmin, regenerateInviteCode, isRegeneratingInviteCode, refreshOrgContext } = useOrganization();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // ── Fetch org subscription data ──────────────────────────────────────────────
  const subQuery = useQuery({
    queryKey: ['org-subscription', activeOrg?.id],
    queryFn: async (): Promise<OrgSubscription | null> => {
      if (!activeOrg?.id) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, plan_tier, billing_cycle, subscription_status, current_period_end, stripe_customer_id, invite_code, max_units, total_units, trial_ends_at')
        .eq('id', activeOrg.id)
        .maybeSingle();
      if (error) {
        warn('[ManageSub] Fetch error:', error.code);
        return null;
      }
      return data as OrgSubscription;
    },
    enabled: !!activeOrg?.id && isOrgAdmin,
    staleTime: 1000 * 60 * 2,
  });

  const sub = subQuery.data;
  const statusMeta = sub ? STATUS_META[sub.subscription_status] ?? STATUS_META.none : STATUS_META.none;
  const renewalDate = formatDate(sub?.current_period_end ?? null);
  const daysLeft = daysUntil(sub?.current_period_end ?? null);
  const planLabel = sub ? PLAN_LABELS[sub.plan_tier] ?? sub.plan_tier : '—';
  const planPrice = sub && PLAN_PRICES[sub.plan_tier]
    ? sub.billing_cycle === 'monthly'
      ? PLAN_PRICES[sub.plan_tier].monthly
      : PLAN_PRICES[sub.plan_tier].annual
    : null;

  // ── Refresh ──────────────────────────────────────────────────────────────────
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['org-subscription', activeOrg?.id] }),
      refreshOrgContext(),
    ]);
    setRefreshing(false);
  };

  // ── Copy invite code ─────────────────────────────────────────────────────────
  const handleCopyCode = useCallback(() => {
    if (!sub?.invite_code) return;
    Alert.alert('Invite Code', `Your invite code is: ${sub.invite_code}\n\nShare this with residents so they can join your community.`);
  }, [sub?.invite_code]);

  // ── Share invite code ────────────────────────────────────────────────────────
  const handleShareCode = useCallback(async () => {
    if (!sub?.invite_code) return;
    try {
      await Share.share({
        message: `Join our community on Porchivo! Use invite code: ${sub.invite_code}`,
      });
    } catch {
      // User cancelled or share failed
    }
  }, [sub?.invite_code]);

  // ── Regenerate invite code ───────────────────────────────────────────────────
  const handleRegenerateCode = useCallback(async () => {
    Alert.alert(
      'Regenerate Invite Code',
      'This will invalidate the current code. Anyone using the old code will no longer be able to join. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            try {
              await regenerateInviteCode();
              await queryClient.invalidateQueries({ queryKey: ['org-subscription', activeOrg?.id] });
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not regenerate invite code');
            }
          },
        },
      ],
    );
  }, [regenerateInviteCode, queryClient, activeOrg?.id]);

  // ── Open Stripe billing portal ───────────────────────────────────────────────
  const handleOpenBillingPortal = useCallback(async () => {
    if (!activeOrg?.id) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-billing-portal', {
        body: { orgId: activeOrg.id },
      });
      if (error) throw new Error(error.message ?? 'Failed to open billing portal');
      if (!data?.url) throw new Error('No portal URL returned');

      await WebBrowser.openAuthSessionAsync(
        data.url,
        'porchivo://manage-subscription',
        { showInRecents: false, preferEphemeralSession: false },
      );

      // Refresh after returning from portal
      await queryClient.invalidateQueries({ queryKey: ['org-subscription', activeOrg?.id] });
    } catch (e: any) {
      const msg = e?.message ?? 'Could not open billing portal';
      warn('[ManageSub] Portal error:', msg);
      Alert.alert('Billing Portal', msg);
    } finally {
      setPortalLoading(false);
    }
  }, [activeOrg?.id, queryClient]);

  // ── Not an admin ─────────────────────────────────────────────────────────────
  if (!isOrgAdmin) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: Colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Manage Subscription',
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.slate,
            headerShadowVisible: false,
          }}
        />
        <AlertCircle size={40} color={Colors.slateLighter} />
        <Text style={[styles.emptyTitle, { color: Colors.slate }]}>Admin Access Required</Text>
        <Text style={[styles.emptyBody, { color: Colors.slateLight }]}>
          Only community administrators can manage the subscription.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Manage Subscription',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.slate,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Plan Status Card ─────────────────────────────────────────────────── */}
        <View style={[styles.planCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <View style={styles.planCardHeader}>
            <View style={[styles.planIcon, { backgroundColor: Colors.primary + '18' }]}>
              <Building2 size={22} color={Colors.primary} />
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planName, { color: Colors.slate }]} numberOfLines={1}>
                {sub?.name ?? activeOrg?.name ?? 'Community'}
              </Text>
              <Text style={[styles.planTier, { color: Colors.slateLighter }]}>
                {planLabel} Plan
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          </View>

          {/* Price + billing cycle */}
          {planPrice !== null && (
            <View style={[styles.priceRow, { borderTopColor: Colors.borderLight }]}>
              <View>
                <Text style={[styles.priceLabel, { color: Colors.slateLighter }]}>
                  {sub?.billing_cycle === 'annual' ? 'Annual billing' : 'Monthly billing'}
                </Text>
                <Text style={[styles.priceAmount, { color: Colors.slate }]}>
                  ${planPrice}
                  <Text style={[styles.priceInterval, { color: Colors.slateLighter }]}>
                    {' '}/{sub?.billing_cycle === 'annual' ? 'yr' : 'mo'}
                  </Text>
                </Text>
              </View>
              {sub?.billing_cycle === 'monthly' && (
                <View style={[styles.saveHint, { backgroundColor: Colors.successLight }]}>
                  <Text style={[styles.saveHintText, { color: Colors.success }]}>Switch to annual to save 15%</Text>
                </View>
              )}
            </View>
          )}

          {/* Renewal date */}
          {renewalDate && (
            <View style={[styles.renewalRow, { borderTopColor: Colors.borderLight }]}>
              <Clock size={16} color={Colors.slateLighter} />
              <View style={styles.renewalInfo}>
                <Text style={[styles.renewalLabel, { color: Colors.slateLighter }]}>
                  {sub?.subscription_status === 'canceled' ? 'Expires' : 'Renews'}
                </Text>
                <Text style={[styles.renewalDate, { color: Colors.slate }]}>{renewalDate}</Text>
              </View>
              {daysLeft !== null && daysLeft >= 0 && sub?.subscription_status !== 'canceled' && (
                <Text style={[styles.daysLeft, { color: daysLeft <= 7 ? Colors.danger : Colors.slateLighter }]}>
                  {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ── Unit Capacity ────────────────────────────────────────────────────── */}
        {sub?.max_units !== null && sub?.max_units !== undefined && (
          <View style={[styles.capacityCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <View style={styles.capacityHeader}>
              <Users size={16} color={Colors.secondary} />
              <Text style={[styles.capacityTitle, { color: Colors.slate }]}>Unit Capacity</Text>
            </View>
            <View style={styles.capacityBarWrap}>
              <View style={[styles.capacityBar, { backgroundColor: Colors.borderLight }]}>
                <View
                  style={[
                    styles.capacityFill,
                    {
                      backgroundColor: (sub.total_units ?? 0) >= sub.max_units ? Colors.danger : Colors.primary,
                      width: `${Math.min(100, ((sub.total_units ?? 0) / sub.max_units) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.capacityText, { color: Colors.slateLight }]}>
                {sub.total_units ?? 0} / {sub.max_units} units
              </Text>
            </View>
          </View>
        )}

        {/* ── Invite Code Section ──────────────────────────────────────────────── */}
        {sub?.invite_code && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
              COMMUNITY INVITE CODE
            </Text>
            <View style={[styles.inviteCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Text style={[styles.inviteLabel, { color: Colors.slateLighter }]}>
                Share this code with residents
              </Text>
              <View style={styles.inviteCodeRow}>
                <Text style={[styles.inviteCode, { color: Colors.primary }]}>
                  {sub.invite_code}
                </Text>
                <View style={styles.inviteActions}>
                  <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7} style={styles.inviteActionBtn}>
                    <Copy size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShareCode} activeOpacity={0.7} style={styles.inviteActionBtn}>
                    <Users size={18} color={Colors.success} />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleRegenerateCode}
                disabled={isRegeneratingInviteCode}
                activeOpacity={0.7}
                style={styles.regenerateBtn}
              >
                <RefreshCw size={13} color={Colors.slateLight} />
                <Text style={[styles.regenerateText, { color: Colors.slateLight }]}>
                  {isRegeneratingInviteCode ? 'Regenerating…' : 'Regenerate code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Billing Portal ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
            BILLING
          </Text>
          <View style={[styles.billingCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <TouchableOpacity
              onPress={handleOpenBillingPortal}
              disabled={portalLoading || !sub?.stripe_customer_id}
              activeOpacity={0.75}
              style={styles.billingRow}
            >
              <View style={[styles.billingIcon, { backgroundColor: Colors.primary + '18' }]}>
                <CreditCard size={18} color={Colors.primary} />
              </View>
              <View style={styles.billingInfo}>
                <Text style={[styles.billingLabel, { color: Colors.slate }]}>
                  {portalLoading ? 'Opening…' : 'Stripe Billing Portal'}
                </Text>
                <Text style={[styles.billingHint, { color: Colors.slateLighter }]}>
                  Update card, download invoices, cancel
                </Text>
              </View>
              <ExternalLink size={15} color={Colors.slateLighter} />
            </TouchableOpacity>

            {!sub?.stripe_customer_id && (
              <View style={[styles.noBilling, { borderTopColor: Colors.borderLight }]}>
                <AlertCircle size={14} color={Colors.slateLighter} />
                <Text style={[styles.noBillingText, { color: Colors.slateLighter }]}>
                  No billing account linked. Contact support if you need to update payment.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Quick Tips ───────────────────────────────────────────────────────── */}
        <View style={[styles.tipsCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <View style={styles.tipRow}>
            <View style={[styles.tipIcon, { backgroundColor: Colors.primary + '18' }]}>
              <Zap size={14} color={Colors.primary} />
            </View>
            <Text style={[styles.tipText, { color: Colors.slateLight }]}>
              Residents always join for free — share your invite code widely.
            </Text>
          </View>
          <View style={[styles.tipRow, { borderTopColor: Colors.borderLight }]}>
            <View style={[styles.tipIcon, { backgroundColor: Colors.successLight }]}>
              <CheckCircle2 size={14} color={Colors.success} />
            </View>
            <Text style={[styles.tipText, { color: Colors.slateLight }]}>
              Upgrading your plan is instant via the Stripe portal.
            </Text>
          </View>
        </View>

        {/* ── Contact Support ──────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/settings' as any)}
          activeOpacity={0.7}
          style={styles.supportLink}
        >
          <Text style={[styles.supportText, { color: Colors.slateLighter }]}>
            Need help? Contact support
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, marginTop: 16 },
  emptyBody: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },

  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // Plan card
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  planCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planInfo: { flex: 1 },
  planName: { fontSize: 16, fontWeight: '700' as const, marginBottom: 2 },
  planTier: { fontSize: 13 },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700' as const },

  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  priceLabel: { fontSize: 12, fontWeight: '600' as const, marginBottom: 2 },
  priceAmount: { fontSize: 22, fontWeight: '800' as const },
  priceInterval: { fontSize: 14, fontWeight: '500' as const },
  saveHint: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveHintText: { fontSize: 11, fontWeight: '600' as const },

  renewalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
  renewalInfo: { flex: 1 },
  renewalLabel: { fontSize: 12, fontWeight: '600' as const, marginBottom: 2 },
  renewalDate: { fontSize: 14, fontWeight: '600' as const },
  daysLeft: { fontSize: 12, fontWeight: '600' as const },

  // Capacity card
  capacityCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  capacityHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  capacityTitle: { fontSize: 14, fontWeight: '600' as const },
  capacityBarWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
  },
  capacityBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    borderRadius: 4,
  },
  capacityText: { fontSize: 12, fontWeight: '600' as const },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 10,
  },

  // Invite code
  inviteCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  inviteLabel: { fontSize: 12, marginBottom: 8 },
  inviteCodeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
  },
  inviteCode: { fontSize: 32, fontWeight: '800' as const, letterSpacing: 4 },
  inviteActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  inviteActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenerateBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    paddingVertical: 4,
  },
  regenerateText: { fontSize: 12, fontWeight: '500' as const },

  // Billing portal
  billingCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  billingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  billingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingInfo: { flex: 1 },
  billingLabel: { fontSize: 15, fontWeight: '600' as const, marginBottom: 2 },
  billingHint: { fontSize: 12 },
  noBilling: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  noBillingText: { fontSize: 12, flex: 1, lineHeight: 16 },

  // Tips
  tipsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tipRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Support link
  supportLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  supportText: { fontSize: 13, fontWeight: '500' as const },
});
