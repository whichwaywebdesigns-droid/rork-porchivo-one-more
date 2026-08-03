import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Truck,
  Banknote,
  ShieldCheck,
  Star,
  Calendar,
  AlertTriangle,
  HandHeart,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { palette, tabularNums } from '@/constants/theme';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import {
  fetchMyAssignments,
  acceptAssignment,
  declineAssignment,
  confirmPickup,
  fetchMyVerification,
  formatCents,
} from '@/lib/partnerVerification';
import { PartnerAssignment, AssignmentStatus } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWindow(start: string | null, end: string | null): string {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; color: string; bg: string; Icon: any }> = {
  requested: { label: 'New Request',   color: palette.ember,      bg: palette.emberSoft,  Icon: Clock },
  accepted:  { label: 'Accepted',      color: Colors.primary,     bg: Colors.skyBlue,     Icon: CheckCircle },
  active:    { label: 'Package held',  color: Colors.secondary,   bg: Colors.peach,       Icon: Package },
  completed: { label: 'Completed',     color: Colors.success,     bg: Colors.successLight, Icon: CheckCircle },
  cancelled: { label: 'Cancelled',     color: Colors.slateLight,  bg: Colors.borderLight,  Icon: XCircle },
  disputed:  { label: 'Disputed',      color: Colors.danger,      bg: Colors.dangerLight,  Icon: AlertTriangle },
};

function StatusBadge({ status }: { status: AssignmentStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.Icon;
  return (
    <View style={[badge.pill, { backgroundColor: c.bg }]}>
      <Icon size={11} color={c.color} />
      <Text style={[badge.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' as const },
  text: { fontSize: 11, fontWeight: '700' as const },
});

// ─── Assignment card ──────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  onAccept,
  onDecline,
  onPickup,
}: {
  assignment: PartnerAssignment;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onPickup: (id: string) => void;
}) {
  const isPaid = assignment.agreedRateCents > 0;
  const showAcceptDecline = assignment.status === 'requested';
  const showPickup = assignment.status === 'accepted';
  const isFinished = assignment.status === 'completed' || assignment.status === 'cancelled';

  return (
    <View style={card.container}>
      {/* Header */}
      <View style={card.header}>
        <View style={[card.iconWrap, isPaid ? card.iconPaid : card.iconFree]}>
          {isPaid ? <Banknote size={18} color="#7C3AED" /> : <HandHeart size={18} color={Colors.success} />}
        </View>
        <View style={card.headerBody}>
          <StatusBadge status={assignment.status} />
          <Text style={card.rateText}>
            {isPaid ? formatCents(assignment.partnerEarnCents) + ' your cut' : 'Free hold — community favor'}
          </Text>
        </View>
        {assignment.homeownerRating != null && (
          <View style={card.ratingRow}>
            <Star size={12} color={palette.gold} fill={palette.gold} />
            <Text style={card.ratingText}>{assignment.homeownerRating}</Text>
          </View>
        )}
      </View>

      {/* Details */}
      {(assignment.expectedDeliveryDate || assignment.pickupWindowStart) && (
        <View style={card.detailsRow}>
          {assignment.expectedDeliveryDate && (
            <View style={card.detailItem}>
              <Calendar size={13} color={Colors.slateLight} />
              <Text style={card.detailText}>
                Expected {formatDate(assignment.expectedDeliveryDate)}
              </Text>
            </View>
          )}
          {assignment.pickupWindowStart && (
            <View style={card.detailItem}>
              <Clock size={13} color={Colors.slateLight} />
              <Text style={card.detailText}>
                {formatWindow(assignment.pickupWindowStart, assignment.pickupWindowEnd)}
              </Text>
            </View>
          )}
        </View>
      )}

      {assignment.notes && (
        <View style={card.notesBox}>
          <Text style={card.notesText} numberOfLines={2}>{assignment.notes}</Text>
        </View>
      )}

      <Text style={card.timestamp}>Requested {formatDate(assignment.createdAt)}</Text>

      {/* Actions */}
      {showAcceptDecline && (
        <View style={card.actions}>
          <TouchableOpacity
            style={[card.actionBtn, card.declineBtn]}
            onPress={() => onDecline(assignment.id)}
            activeOpacity={0.8}
          >
            <XCircle size={16} color={Colors.danger} />
            <Text style={[card.actionBtnText, { color: Colors.danger }]}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[card.actionBtn, card.acceptBtn]}
            onPress={() => onAccept(assignment.id)}
            activeOpacity={0.85}
          >
            <CheckCircle size={16} color={Colors.white} />
            <Text style={[card.actionBtnText, { color: Colors.white }]}>Accept Hold</Text>
          </TouchableOpacity>
        </View>
      )}

      {showPickup && (
        <TouchableOpacity
          style={[card.actionBtn, card.pickupBtn]}
          onPress={() => onPickup(assignment.id)}
          activeOpacity={0.85}
        >
          <Truck size={16} color={Colors.white} />
          <Text style={[card.actionBtnText, { color: Colors.white }]}>Confirm I Have the Package</Text>
          <ChevronRight size={14} color={Colors.white} />
        </TouchableOpacity>
      )}

      {assignment.status === 'active' && (
        <View style={card.heldBanner}>
          <Package size={14} color={Colors.secondary} />
          <Text style={card.heldText}>Package is in your possession — waiting for homeowner to confirm delivery.</Text>
        </View>
      )}

      {isFinished && assignment.status === 'completed' && (
        <View style={card.completedBanner}>
          <CheckCircle size={14} color={Colors.success} />
          <Text style={card.completedText}>
            Completed {assignment.completionConfirmedAt ? formatDate(assignment.completionConfirmedAt) : ''}.
            {isPaid ? ` ${formatCents(assignment.partnerEarnCents)} transferred to your bank.` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconPaid: { backgroundColor: '#EDE9FE' },
  iconFree: { backgroundColor: Colors.successLight },
  headerBody: { flex: 1, gap: 4 },
  rateText: { fontSize: 13, fontWeight: '700' as const, color: palette.ink, ...tabularNums },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, fontWeight: '700' as const, color: palette.gold },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { fontSize: 12, color: Colors.slateLight },
  notesBox: { backgroundColor: palette.canvas, borderRadius: 10, padding: 10, marginBottom: 8 },
  notesText: { fontSize: 13, color: palette.slate700, lineHeight: 18 },
  timestamp: { fontSize: 11, color: Colors.slateLighter, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700' as const },
  declineBtn: { backgroundColor: Colors.dangerLight },
  acceptBtn: { backgroundColor: Colors.primary, flex: 1.6 },
  pickupBtn: {
    backgroundColor: Colors.secondary,
    flex: 1,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  heldBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    backgroundColor: Colors.peach,
    borderRadius: 10,
    padding: 10,
  },
  heldText: { flex: 1, fontSize: 12, color: Colors.secondary, lineHeight: 17, fontWeight: '500' as const },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    padding: 10,
  },
  completedText: { flex: 1, fontSize: 12, color: Colors.success, lineHeight: 17, fontWeight: '500' as const },
});

// ─── Section tabs ─────────────────────────────────────────────────────────────

type Tab = 'active' | 'history';

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PartnerHoldsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useApp();
  const [tab, setTab] = React.useState<Tab>('active');

  const { data: verification } = useQuery({
    queryKey: ['partner-verification'],
    queryFn: fetchMyVerification,
    staleTime: 1000 * 60,
  });

  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['partner-assignments-holds'],
    queryFn: () => fetchMyAssignments('partner'),
    staleTime: 1000 * 20,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-assignments-holds'] });
      queryClient.invalidateQueries({ queryKey: ['partner-assignments'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: declineAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-assignments-holds'] });
    },
  });

  const pickupMutation = useMutation({
    mutationFn: confirmPickup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-assignments-holds'] });
      queryClient.invalidateQueries({ queryKey: ['partner-assignments'] });
    },
  });

  const handleAccept = useCallback((id: string) => {
    Alert.alert(
      'Accept Hold Request',
      'You agree to receive this package and hold it safely until the homeowner returns.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => acceptMutation.mutate(id),
        },
      ],
    );
  }, [acceptMutation]);

  const handleDecline = useCallback((id: string) => {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this hold request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => declineMutation.mutate(id) },
      ],
    );
  }, [declineMutation]);

  const handlePickup = useCallback((id: string) => {
    Alert.alert(
      'Confirm Package Pickup',
      'Confirm you have physically received and secured this package.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => pickupMutation.mutate(id) },
      ],
    );
  }, [pickupMutation]);

  const activeItems = assignments.filter(a =>
    a.status === 'requested' || a.status === 'accepted' || a.status === 'active'
  );
  const historyItems = assignments.filter(a =>
    a.status === 'completed' || a.status === 'cancelled' || a.status === 'disputed'
  );
  const displayed = tab === 'active' ? activeItems : historyItems;

  const isVerified = verification?.idvStatus === 'verified';

  if (!user) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Holds',
          headerStyle: { backgroundColor: palette.canvas },
          headerShadowVisible: false,
          headerTintColor: Colors.primary,
        }}
      />

      {/* Verification gate */}
      {!isVerified && (
        <TouchableOpacity
          style={styles.verifBanner}
          onPress={() => router.push('/partner-verify' as any)}
          activeOpacity={0.85}
        >
          <ShieldCheck size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifBannerTitle}>Verify identity to accept paid holds</Text>
            <Text style={styles.verifBannerSub}>Free holds are available now — tap to unlock paid holds</Text>
          </View>
          <ChevronRight size={16} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Tab strip */}
      <View style={styles.tabRow}>
        {(['active', 'history'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'active' ? `Active${activeItems.length ? ` (${activeItems.length})` : ''}` : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />
          }
        >
          {displayed.length === 0 ? (
            <View style={styles.emptyState}>
              {tab === 'active' ? (
                <>
                  <View style={styles.emptyIconWrap}>
                    <HandHeart size={36} color={Colors.slateLighter} />
                  </View>
                  <Text style={styles.emptyTitle}>No active holds</Text>
                  <Text style={styles.emptySub}>
                    When a homeowner sends you a hold request, it'll appear here. Make sure you've completed your profile and are set to active.
                  </Text>
                  {!isVerified && (
                    <TouchableOpacity
                      style={styles.emptyAction}
                      onPress={() => router.push('/partner-verify' as any)}
                      activeOpacity={0.85}
                    >
                      <ShieldCheck size={15} color={Colors.primary} />
                      <Text style={styles.emptyActionText}>Verify Identity to Unlock Paid Holds</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.emptyIconWrap}>
                    <Package size={36} color={Colors.slateLighter} />
                  </View>
                  <Text style={styles.emptyTitle}>No completed holds yet</Text>
                  <Text style={styles.emptySub}>Your completed and declined hold requests will appear here.</Text>
                </>
              )}
            </View>
          ) : (
            displayed.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onPickup={handlePickup}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

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
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  verifBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  verifBannerSub: { fontSize: 12, color: Colors.slateLight, marginTop: 2 },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: Colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600' as const, color: Colors.slateLight },
  tabTextActive: { color: palette.ink, fontWeight: '700' as const },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 16 },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: palette.ink },
  emptySub: { fontSize: 14, color: Colors.slateLight, textAlign: 'center' as const, lineHeight: 20 },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: Colors.skyBlue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionText: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
});
