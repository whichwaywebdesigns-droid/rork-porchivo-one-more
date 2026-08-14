import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Star,
  Package,
  ArrowUpRight,
  ShieldCheck,
  Wallet,
  Truck,
  RefreshCw,
  HandHeart,
  DollarSign,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { palette, tabularNums } from '@/constants/theme';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import {
  fetchMyVerification,
  fetchMyAssignments,
  fetchMyPayouts,
  initiateConnectOnboarding,
  completeAssignment,
  triggerPayout,
  formatCents,
} from '@/lib/partnerVerification';
import * as WebBrowser from 'expo-web-browser';
import {
  PartnerAssignment,
  PartnerPayout,
  PartnerVerification,
  TIER_LABELS,
  TIER_COLORS,
  AssignmentStatus,
  PayoutRecordStatus,
} from '@/types';

WebBrowser.maybeCompleteAuthSession();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Badge components ─────────────────────────────────────────────────────────

function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  const map: Record<AssignmentStatus, { label: string; color: string; bg: string }> = {
    requested: { label: 'Requested', color: palette.gold,       bg: palette.goldSoft },
    accepted:  { label: 'Accepted',  color: Colors.primary,     bg: Colors.skyBlue },
    active:    { label: 'Active',    color: Colors.secondary,   bg: Colors.peach },
    completed: { label: 'Completed', color: Colors.success,     bg: Colors.successLight },
    cancelled: { label: 'Cancelled', color: Colors.slateLight,  bg: Colors.borderLight },
    disputed:  { label: 'Disputed',  color: Colors.danger,      bg: Colors.dangerLight },
  };
  const c = map[status];
  return (
    <View style={[badgeStyles.pill, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

function PayoutStatusBadge({ status }: { status: PayoutRecordStatus }) {
  const map: Record<PayoutRecordStatus, { label: string; color: string; bg: string }> = {
    pending:    { label: 'Processing', color: palette.gold,     bg: palette.goldSoft },
    in_transit: { label: 'In Transit', color: Colors.primary,   bg: Colors.skyBlue },
    paid:       { label: 'Paid',       color: Colors.success,   bg: Colors.successLight },
    failed:     { label: 'Failed',     color: Colors.danger,    bg: Colors.dangerLight },
    cancelled:  { label: 'Cancelled',  color: Colors.slateLight,bg: Colors.borderLight },
  };
  const c = map[status];
  return (
    <View style={[badgeStyles.pill, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    alignSelf: 'flex-start' as const,
  },
  text: { fontSize: 11, fontWeight: '700' as const },
});

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color, icon: Icon }: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: any;
}) {
  return (
    <View style={summaryStyles.card}>
      <View style={[summaryStyles.iconWrap, { backgroundColor: `${color}18` }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={summaryStyles.value}>{value}</Text>
      <Text style={summaryStyles.label}>{label}</Text>
      {sub && <Text style={summaryStyles.sub}>{sub}</Text>}
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: palette.ink,
    letterSpacing: -0.5,
    ...tabularNums,
  },
  label: {
    fontSize: 11,
    color: Colors.slateLight,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  sub: {
    fontSize: 10,
    color: Colors.slateLighter,
    textAlign: 'center' as const,
  },
});

// ─── Assignment row with actions ──────────────────────────────────────────────

function AssignmentRow({
  assignment,
  onComplete,
  onPayout,
  isMutating,
}: {
  assignment: PartnerAssignment;
  onComplete?: (id: string) => void;
  onPayout?: (id: string) => void;
  isMutating?: boolean;
}) {
  const canComplete = onComplete && (assignment.status === 'active');
  const canPayout = onPayout &&
    assignment.status === 'completed' &&
    assignment.partnerEarnCents > 0 &&
    assignment.paymentStatus !== 'captured';

  return (
    <View style={rowStyles.card}>
      <View style={rowStyles.iconWrap}>
        <Package size={16} color={Colors.primary} />
      </View>
      <View style={rowStyles.body}>
        <View style={rowStyles.topLine}>
          <AssignmentStatusBadge status={assignment.status} />
          {assignment.homeownerRating != null && (
            <View style={rowStyles.ratingMini}>
              <Star size={10} color={palette.gold} fill={palette.gold} />
              <Text style={rowStyles.ratingMiniText}>{assignment.homeownerRating}</Text>
            </View>
          )}
        </View>
        {assignment.expectedDeliveryDate && (
          <Text style={rowStyles.date}>
            Expected {new Date(assignment.expectedDeliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        )}
        <Text style={rowStyles.amount}>
          {assignment.status === 'completed'
            ? `Earned ${formatCents(assignment.partnerEarnCents)}`
            : `Rate: ${formatCents(assignment.agreedRateCents)}`}
        </Text>
        <Text style={rowStyles.created}>Requested {formatDate(assignment.createdAt)}</Text>

        {canComplete && (
          <TouchableOpacity
            style={rowStyles.actionBtn}
            onPress={() => onComplete(assignment.id)}
            disabled={isMutating}
            activeOpacity={0.85}
          >
            {isMutating
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <CheckCircle size={14} color={Colors.white} />
            }
            <Text style={rowStyles.actionBtnText}>Mark Complete</Text>
          </TouchableOpacity>
        )}

        {canPayout && (
          <TouchableOpacity
            style={[rowStyles.actionBtn, { backgroundColor: '#7C3AED' }]}
            onPress={() => onPayout(assignment.id)}
            disabled={isMutating}
            activeOpacity={0.85}
          >
            {isMutating
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <DollarSign size={14} color={Colors.white} />
            }
            <Text style={rowStyles.actionBtnText}>Release Payment</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function PayoutRow({ payout }: { payout: PartnerPayout }) {
  return (
    <View style={rowStyles.card}>
      <View style={[rowStyles.iconWrap, { backgroundColor: Colors.successLight }]}>
        <Banknote size={16} color={Colors.success} />
      </View>
      <View style={rowStyles.body}>
        <View style={rowStyles.topLine}>
          <Text style={rowStyles.payoutAmount}>{formatCents(payout.amountCents)}</Text>
          <PayoutStatusBadge status={payout.status} />
        </View>
        <Text style={rowStyles.date}>
          {payout.paidAt ? `Paid ${formatDate(payout.paidAt)}` : `Initiated ${formatDate(payout.initiatedAt)}`}
        </Text>
        {payout.stripeTransferId && (
          <Text style={rowStyles.txId} numberOfLines={1}>Transfer: {payout.stripeTransferId}</Text>
        )}
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 3 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  payoutAmount: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.success,
    ...tabularNums,
  },
  amount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.slate700,
  },
  date: {
    fontSize: 12,
    color: Colors.slateLight,
  },
  created: {
    fontSize: 11,
    color: Colors.slateLighter,
  },
  txId: {
    fontSize: 10,
    color: Colors.slateLighter,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  ratingMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingMiniText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: palette.gold,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    alignSelf: 'flex-start' as const,
    marginTop: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PartnerEarningsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useApp();
  const [connectLoading, setConnectLoading] = React.useState(false);

  const { data: verification, isLoading: verifLoading, refetch: refetchVerif } = useQuery({
    queryKey: ['partner-verification'],
    queryFn: fetchMyVerification,
    staleTime: 1000 * 60,
  });

  const { data: assignments = [], isLoading: assignLoading, refetch: refetchAssignments } = useQuery({
    queryKey: ['partner-assignments'],
    queryFn: () => fetchMyAssignments('partner'),
    staleTime: 1000 * 30,
  });

  const { data: payouts = [], isLoading: payoutsLoading, refetch: refetchPayouts } = useQuery({
    queryKey: ['partner-payouts'],
    queryFn: fetchMyPayouts,
    staleTime: 1000 * 30,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['partner-assignments-holds'] });
    },
  });

  const payoutMutation = useMutation({
    mutationFn: (id: string) => triggerPayout(id),
    onSuccess: (data) => {
      if (!data) {
        Alert.alert('Error', 'Payout failed. Check that your bank account is connected.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['partner-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['partner-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['partner-verification'] });
      Alert.alert('Payment Released!', `${formatCents(data.partnerEarnCents)} is on its way to your bank. Expected in 2 business days.`);
    },
  });

  const handleComplete = useCallback((id: string) => {
    Alert.alert(
      'Mark Hold Complete',
      'Confirm that you have handed the package back to the homeowner.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => completeMutation.mutate(id) },
      ],
    );
  }, [completeMutation]);

  const handlePayout = useCallback((id: string) => {
    Alert.alert(
      'Release Payment to Partner',
      'This will transfer the agreed amount to your partner\'s bank account. Confirm?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release Payment', onPress: () => payoutMutation.mutate(id) },
      ],
    );
  }, [payoutMutation]);

  const handleConnectBank = useCallback(async () => {
    if (connectLoading) return;
    setConnectLoading(true);
    try {
      const result = await initiateConnectOnboarding();
      if (!result) {
        Alert.alert('Error', 'Could not start bank setup. Make sure your identity is verified.');
        return;
      }
      if (result.alreadyConnected) {
        await refetchVerif();
        return;
      }
      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.onboardingUrl,
        'porchivo://partner-verify/connect-return',
        { showInRecents: false },
      );
      if (browserResult.type === 'success') {
        await refetchVerif();
      }
    } finally {
      setConnectLoading(false);
    }
  }, [connectLoading, refetchVerif]);

  const isLoading = verifLoading || assignLoading || payoutsLoading;

  const handleRefresh = useCallback(() => {
    refetchVerif();
    refetchAssignments();
    refetchPayouts();
  }, [refetchVerif, refetchAssignments, refetchPayouts]);

  // ── Computed stats ──────────────────────────────────────────────────────────
  const thisMonthEarnings = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return payouts
      .filter(p => p.status === 'paid' && p.paidAt && new Date(p.paidAt).getTime() >= startOfMonth)
      .reduce((sum, p) => sum + p.amountCents, 0);
  }, [payouts]);

  const pendingEarnings = useMemo(() =>
    assignments
      .filter(a => a.status === 'completed' && a.paymentStatus !== 'captured')
      .reduce((sum, a) => sum + a.partnerEarnCents, 0),
    [assignments],
  );

  const activeAssignments = useMemo(
    () => assignments.filter(a => a.status === 'accepted' || a.status === 'active'),
    [assignments],
  );

  const completedPendingPayout = useMemo(
    () => assignments.filter(a => a.status === 'completed' && a.partnerEarnCents > 0 && a.paymentStatus !== 'captured'),
    [assignments],
  );

  const recentPayouts = useMemo(() => payouts.slice(0, 5), [payouts]);
  const recentAssignments = useMemo(() => assignments.slice(0, 6), [assignments]);

  if (!user) return null;

  const isVerified = verification?.idvStatus === 'verified';
  const isPayoutActive = verification?.payoutStatus === 'active';
  const tier = verification?.tier ?? 'basic';
  const tierColor = TIER_COLORS[tier];
  const tierLabel = TIER_LABELS[tier];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Earnings',
          headerStyle: { backgroundColor: palette.canvas },
          headerShadowVisible: false,
          headerTintColor: Colors.primary,
          headerRight: () => (
            <TouchableOpacity onPress={handleRefresh} style={{ marginRight: 8 }} activeOpacity={0.7}>
              <RefreshCw size={18} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          {/* ── Verification banner if not verified ── */}
          {!isVerified && (
            <TouchableOpacity
              style={styles.verifBanner}
              onPress={() => router.push('/partner-verify' as any)}
              activeOpacity={0.85}
              testID="verif-banner"
            >
              <ShieldCheck size={20} color={Colors.primary} />
              <View style={styles.verifBannerBody}>
                <Text style={styles.verifBannerTitle}>Verify your identity to earn</Text>
                <Text style={styles.verifBannerSub}>Free holds available now · Paid holds after verification</Text>
              </View>
              <ChevronRight size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {/* ── Partner tier badge ── */}
          {verification && (
            <View style={styles.tierRow}>
              <View style={[styles.tierBadge, { backgroundColor: `${tierColor}18` }]}>
                <Star size={13} color={tierColor} fill={tierColor} />
                <Text style={[styles.tierBadgeText, { color: tierColor }]}>{tierLabel}</Text>
              </View>
              {verification.averageRating != null && (
                <View style={styles.ratingRow}>
                  <Star size={12} color={palette.gold} fill={palette.gold} />
                  <Text style={styles.ratingText}>
                    {verification.averageRating.toFixed(1)} avg rating
                  </Text>
                </View>
              )}
              <Text style={styles.completedCount}>
                {verification.completedAssignments} holds completed
              </Text>
            </View>
          )}

          {/* ── Summary cards ── */}
          <View style={styles.summaryRow}>
            <SummaryCard
              label="Lifetime"
              value={formatCents(verification?.lifetimeEarningsCents ?? 0)}
              icon={TrendingUp}
              color={Colors.primary}
            />
            <SummaryCard
              label="This month"
              value={formatCents(thisMonthEarnings)}
              icon={Banknote}
              color={Colors.success}
            />
            <SummaryCard
              label="Pending"
              value={formatCents(pendingEarnings)}
              sub="awaiting release"
              icon={Clock}
              color={palette.gold}
            />
          </View>

          {/* ── Completed awaiting payout ── */}
          {completedPendingPayout.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Release Payments</Text>
              <View style={styles.payoutAlert}>
                <AlertTriangle size={16} color={palette.gold} />
                <Text style={styles.payoutAlertText}>
                  {completedPendingPayout.length} completed hold{completedPendingPayout.length > 1 ? 's' : ''} waiting for payment release — tap below to transfer earnings.
                </Text>
              </View>
              {completedPendingPayout.map(a => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  onPayout={handlePayout}
                  isMutating={payoutMutation.isPending}
                />
              ))}
            </View>
          )}

          {/* ── Active assignments ── */}
          {activeAssignments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Holds</Text>
              {activeAssignments.map(a => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  onComplete={handleComplete}
                  isMutating={completeMutation.isPending}
                />
              ))}
            </View>
          )}

          {/* ── View all holds shortcut ── */}
          <TouchableOpacity
            style={styles.holdsLink}
            onPress={() => router.push('/partner-holds' as any)}
            activeOpacity={0.8}
          >
            <HandHeart size={16} color={Colors.primary} />
            <Text style={styles.holdsLinkText}>View all hold requests</Text>
            <ChevronRight size={14} color={Colors.primary} />
          </TouchableOpacity>

          {/* ── Payout history ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payouts</Text>
            {recentPayouts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Banknote size={32} color={Colors.slateLighter} />
                <Text style={styles.emptyTitle}>No payouts yet</Text>
                <Text style={styles.emptySub}>
                  {isVerified
                    ? 'Accept hold requests to start earning.'
                    : 'Verify your identity first to earn from holds.'}
                </Text>
                {!isVerified && (
                  <TouchableOpacity
                    style={styles.emptyAction}
                    onPress={() => router.push('/partner-verify' as any)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.emptyActionText}>Verify Identity</Text>
                    <ArrowUpRight size={14} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              recentPayouts.map(payout => (
                <PayoutRow key={payout.id} payout={payout} />
              ))
            )}
          </View>

          {/* ── Assignment history ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hold History</Text>
            {recentAssignments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Package size={32} color={Colors.slateLighter} />
                <Text style={styles.emptyTitle}>No holds yet</Text>
                <Text style={styles.emptySub}>
                  Homeowners near you will send requests once you're active.
                </Text>
              </View>
            ) : (
              recentAssignments.map(a => (
                <AssignmentRow key={a.id} assignment={a} />
              ))
            )}
          </View>

          {/* ── Connect payout CTA ── */}
          {isVerified && !isPayoutActive && (
            <TouchableOpacity
              style={[styles.payoutCta, connectLoading && { opacity: 0.6 }]}
              onPress={handleConnectBank}
              disabled={connectLoading}
              activeOpacity={0.85}
              testID="connect-payout-cta"
            >
              <View style={styles.payoutCtaLeft}>
                <View style={styles.payoutCtaIcon}>
                  {connectLoading
                    ? <ActivityIndicator size="small" color="#7C3AED" />
                    : <Wallet size={20} color="#7C3AED" />
                  }
                </View>
                <View>
                  <Text style={styles.payoutCtaTitle}>
                    {connectLoading ? 'Opening Stripe…' : 'Connect your bank'}
                  </Text>
                  <Text style={styles.payoutCtaSub}>Required to receive paid hold earnings</Text>
                </View>
              </View>
              {!connectLoading && <ChevronRight size={16} color="#7C3AED" />}
            </TouchableOpacity>
          )}

          {isPayoutActive && (
            <View style={styles.payoutActiveRow}>
              <Wallet size={15} color={Colors.success} />
              <Text style={styles.payoutActiveText}>Bank connected — payouts are active</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  verifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.skyBlue,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  verifBannerBody: { flex: 1 },
  verifBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  verifBannerSub: { fontSize: 12, color: Colors.slateLight, marginTop: 2 },

  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tierBadgeText: { fontSize: 12, fontWeight: '700' as const },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '600' as const, color: palette.slate700 },
  completedCount: { fontSize: 12, color: Colors.slateLight, fontWeight: '500' as const },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: palette.ink,
    marginBottom: 10,
    letterSpacing: -0.2,
  },

  payoutAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: palette.goldSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  payoutAlertText: { flex: 1, fontSize: 13, color: palette.gold, lineHeight: 18, fontWeight: '500' as const },

  holdsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.skyBlue,
    borderRadius: 12,
    padding: 13,
    marginBottom: 20,
  },
  holdsLinkText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: Colors.primary },

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const, color: palette.ink, marginTop: 4 },
  emptySub: { fontSize: 13, color: Colors.slateLight, textAlign: 'center' as const, lineHeight: 19 },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    backgroundColor: Colors.skyBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyActionText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },

  payoutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 8,
  },
  payoutCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  payoutCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutCtaTitle: { fontSize: 14, fontWeight: '700' as const, color: '#5B21B6' },
  payoutCtaSub: { fontSize: 12, color: '#7C3AED', marginTop: 2 },

  payoutActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  payoutActiveText: { fontSize: 13, fontWeight: '600' as const, color: Colors.success },
});
