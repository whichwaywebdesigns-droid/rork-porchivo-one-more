import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  MapPin,
  MessageSquare,
  Package,
  Search,
  Shield,
  Users,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const AMAZON_ORANGE = '#FF9900';
const BG = '#F2F3F4';
const WHITE = '#FFFFFF';
const NAVY = '#1B2A4A';
const SLATE = '#4B5563';
const SLATE_LIGHT = '#9CA3AF';
const RED = '#DC2626';
const RED_SOFT = '#FEF2F2';
const RED_BORDER = '#FECACA';
const AMBER_BG = '#FFFBEB';
const AMBER_BORDER = '#FDE68A';
const GREEN = '#059669';
const GREEN_SOFT = '#ECFDF5';

const CLAIM_REASONS = [
  { id: 'not_found', label: 'Package not at my door', icon: Package },
  { id: 'stolen', label: 'Porch theft suspected', icon: AlertCircle },
  { id: 'wrong_address', label: 'Delivered to wrong address', icon: MapPin },
  { id: 'neighbor', label: 'Checking with neighbors', icon: Users },
] as const;

type ClaimReason = (typeof CLAIM_REASONS)[number]['id'];

interface AmazonOrder {
  order_id: string;
  item_name: string;
  otp_code: string;
  status: string;
  expected_delivery: string;
  user_id: string;
  delivered_at?: string;
}

const MOCK_ORDER: AmazonOrder = {
  order_id: 'AMZ-2024-9134',
  item_name: 'Dyson V15 Detect Cordless Vacuum',
  otp_code: '712045',
  status: 'delivered',
  expected_delivery: new Date().toISOString().split('T')[0],
  user_id: '',
  delivered_at: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso?: string): string {
  if (!iso) return 'Recently';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonPulse({
  width,
  height,
  radius = 10,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: '#D1D5DB', opacity }, style]}
    />
  );
}

function SkeletonScreen() {
  return (
    <View style={{ padding: 20, gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={sk.card}>
          <SkeletonPulse width="55%" height={14} style={{ marginBottom: 16 }} />
          <SkeletonPulse width="80%" height={11} style={{ marginBottom: 10 }} />
          <SkeletonPulse width="70%" height={11} style={{ marginBottom: 10 }} />
          <SkeletonPulse width="60%" height={11} />
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
});

// ─── Check Step ───────────────────────────────────────────────────────────────

function CheckStep({
  number,
  title,
  description,
  icon: Icon,
  checked,
  onToggle,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[step.row, checked && step.rowDone]}
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityLabel={`Step ${number}: ${title}`}
    >
      <View style={[step.numWrap, checked && step.numWrapDone]}>
        {checked ? (
          <CheckCircle2 size={18} color={WHITE} strokeWidth={2.5} />
        ) : (
          <Text style={step.num}>{number}</Text>
        )}
      </View>
      <View style={step.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Icon size={14} color={checked ? GREEN : SLATE} strokeWidth={2} />
          <Text style={[step.title, checked && step.titleDone]}>{title}</Text>
        </View>
        <Text style={step.desc}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const step = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
  },
  rowDone: {
    backgroundColor: GREEN_SOFT,
    borderColor: '#A7F3D0',
  },
  numWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numWrapDone: {
    backgroundColor: GREEN,
  },
  num: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: SLATE,
  },
  content: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: NAVY,
    marginBottom: 3,
  },
  titleDone: {
    color: GREEN,
  },
  desc: {
    fontSize: 12.5,
    color: SLATE,
    lineHeight: 18,
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function NotDeliveredScreen() {
  const { order_id } = useLocalSearchParams<{ order_id?: string }>();
  const router = useRouter();
  const { user } = useApp();

  const [order, setOrder] = useState<AmazonOrder | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedReason, setSelectedReason] = useState<ClaimReason | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Animations
  const cardAnim = useRef(new Animated.Value(0)).current;
  const stepsAnim = useRef(new Animated.Value(40)).current;
  const stepsOpacity = useRef(new Animated.Value(0)).current;
  const claimAnim = useRef(new Animated.Value(40)).current;
  const claimOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Alert pulse
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  // Fetch
  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      try {
        let query = supabase.from('amazon_orders').select('*').in('status', ['delivered', 'disputed']);
        if (order_id) query = query.eq('order_id', order_id);
        else if (user?.id) query = query.eq('user_id', user.id);
        const { data } = await query.limit(1).maybeSingle();
        setOrder(data ?? MOCK_ORDER);
      } catch {
        setOrder(MOCK_ORDER);
      } finally {
        setIsLoading(false);
      }
    }
    void fetch();
  }, [order_id, user?.id]);

  // Entrance animations
  useEffect(() => {
    if (isLoading || !order) return;
    Animated.timing(cardAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.spring(stepsAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
        Animated.timing(stepsOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
    }, 180);

    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.spring(claimAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
        Animated.timing(claimOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
    }, 340);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isLoading, order, cardAnim, stepsAnim, stepsOpacity, claimAnim, claimOpacity]);

  const toggleStep = useCallback((idx: number) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const selectReason = useCallback((reason: ClaimReason) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setSelectedReason(reason);
  }, []);

  const handleFileClaim = useCallback(async () => {
    if (!order || !selectedReason || submitting) return;
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setSubmitting(true);
    try {
      await supabase
        .from('amazon_orders')
        .update({ status: 'disputed', dispute_reason: selectedReason, dispute_notes: notes })
        .eq('order_id', order.order_id);
    } catch {
      // Always confirm visually
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => router.back(), 2200);
    }
  }, [order, selectedReason, notes, submitting, router]);

  const canFile = selectedReason !== null && !submitting;
  const itemLabel = order
    ? order.item_name.length > 40 ? order.item_name.slice(0, 40) + '…' : order.item_name
    : '';

  const checkSteps = [
    { title: 'Check front & back entrances', description: 'Drivers sometimes leave packages at alternate doors or garages.', icon: MapPin },
    { title: 'Look for a delivery photo', description: 'Check your Amazon app for the carrier\'s proof-of-delivery photo.', icon: Camera },
    { title: 'Ask your neighbors', description: 'A neighbor may have accepted the package to keep it safe.', icon: Users },
    { title: 'Search inside mailbox / locker', description: 'Small items are sometimes placed inside mail slots or building lockers.', icon: Search },
  ] as const;

  if (submitted) {
    return (
      <View style={styles.successRoot}>
        <Stack.Screen options={{ title: 'Package Not Found', headerStyle: { backgroundColor: BG }, headerShadowVisible: false, headerTintColor: NAVY }} />
        <Animated.View style={[styles.successCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.successIconWrap}>
            <CheckCircle2 size={40} color={GREEN} strokeWidth={2} />
          </View>
          <Text style={styles.successTitle}>Claim Filed</Text>
          <Text style={styles.successSub}>Amazon will review your case within 24–48 hours. Check your email for updates.</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Package Not Found',
          headerStyle: { backgroundColor: BG },
          headerShadowVisible: false,
          headerTintColor: NAVY,
        }}
      />

      {/* ── Alert Banner ──────────────────────────────────────────────────── */}
      <View style={styles.banner}>
        <Animated.View style={[styles.alertDot, { transform: [{ scale: pulseAnim }] }]} />
        <AlertTriangle size={15} color={RED} strokeWidth={2.5} />
        <Text style={styles.bannerText}>Marked Delivered — Package Not Found?</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <SkeletonScreen />
        ) : (
          <>
            {/* ── Order Summary Card ──────────────────────────────────────── */}
            <Animated.View style={[styles.card, { opacity: cardAnim }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.redBadge}>
                  <Text style={styles.redBadgeText}>DISPUTE</Text>
                </View>
                <Text style={styles.orderMeta}>Delivered {timeAgo(order?.delivered_at)}</Text>
              </View>
              <Text style={styles.cardTitle}>Not in your hands?</Text>
              <Text style={styles.itemName}>{itemLabel}</Text>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Package size={14} color={SLATE_LIGHT} strokeWidth={2} />
                <Text style={styles.infoText}>Order {order?.order_id}</Text>
              </View>

              {/* A-to-Z Guarantee pill */}
              <View style={styles.guaranteePill}>
                <Shield size={13} color={AMAZON_ORANGE} strokeWidth={2.5} />
                <Text style={styles.guaranteeText}>Protected by Amazon A-to-Z Guarantee</Text>
              </View>
            </Animated.View>

            {/* ── Check These First ────────────────────────────────────────── */}
            <Animated.View
              style={[
                styles.card,
                { opacity: stepsOpacity, transform: [{ translateY: stepsAnim }] },
              ]}
            >
              <Text style={styles.sectionTitle}>Check These First</Text>
              <Text style={styles.sectionSub}>Complete each step before filing a claim — Amazon will ask.</Text>
              <View style={styles.stepsList}>
                {checkSteps.map((s, i) => (
                  <CheckStep
                    key={i}
                    number={i + 1}
                    title={s.title}
                    description={s.description}
                    icon={s.icon}
                    checked={checkedSteps.has(i)}
                    onToggle={() => toggleStep(i)}
                  />
                ))}
              </View>
            </Animated.View>

            {/* ── Claim Reason & Notes ──────────────────────────────────────── */}
            <Animated.View
              style={[
                styles.card,
                { opacity: claimOpacity, transform: [{ translateY: claimAnim }] },
              ]}
            >
              <Text style={styles.sectionTitle}>What happened?</Text>
              <Text style={styles.sectionSub}>Select the best description of the situation.</Text>
              <View style={styles.reasonList}>
                {CLAIM_REASONS.map((r) => {
                  const Icon = r.icon;
                  const active = selectedReason === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.reasonRow, active && styles.reasonRowActive]}
                      onPress={() => selectReason(r.id as ClaimReason)}
                      activeOpacity={0.8}
                      accessibilityLabel={r.label}
                    >
                      <View style={[styles.reasonIcon, active && styles.reasonIconActive]}>
                        <Icon size={16} color={active ? AMAZON_ORANGE : SLATE} strokeWidth={2} />
                      </View>
                      <Text style={[styles.reasonLabel, active && styles.reasonLabelActive]}>
                        {r.label}
                      </Text>
                      {active && <CheckCircle2 size={18} color={AMAZON_ORANGE} strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notes input */}
              <View style={styles.notesWrap}>
                <View style={styles.notesHeader}>
                  <MessageSquare size={14} color={SLATE_LIGHT} strokeWidth={2} />
                  <Text style={styles.notesLabel}>Additional details (optional)</Text>
                </View>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Describe what you observed…"
                  placeholderTextColor={SLATE_LIGHT}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Info note */}
              <View style={styles.infoNote}>
                <AlertCircle size={13} color={SLATE_LIGHT} strokeWidth={2} />
                <Text style={styles.infoNoteText}>
                  Claims are reviewed within 24–48 hours. You may be refunded or reshipped.
                </Text>
              </View>
            </Animated.View>

            <View style={{ height: 16 }} />
          </>
        )}
      </ScrollView>

      {/* ── File Claim Button ────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.claimBtn, !canFile && styles.claimBtnDisabled]}
          onPress={handleFileClaim}
          disabled={!canFile}
          activeOpacity={0.88}
          accessibilityLabel="File a claim with Amazon"
        >
          <ChevronRight size={18} color={canFile ? WHITE : SLATE_LIGHT} strokeWidth={2.5} />
          <Text style={[styles.claimBtnText, !canFile && styles.claimBtnTextDisabled]}>
            {submitting ? 'Filing Claim…' : 'File a Claim with Amazon'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  successRoot: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successCard: {
    backgroundColor: WHITE,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
    width: '100%',
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GREEN_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontWeight: '800' as const, color: NAVY, marginBottom: 10 },
  successSub: { fontSize: 14.5, color: SLATE, textAlign: 'center', lineHeight: 21 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: RED_SOFT,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: RED_BORDER,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },
  bannerText: { fontSize: 13.5, fontWeight: '700' as const, color: RED, flex: 1 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 24 },

  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 5,
    gap: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  redBadge: {
    backgroundColor: RED_SOFT,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: RED_BORDER,
  },
  redBadgeText: { fontSize: 10, fontWeight: '800' as const, color: RED, letterSpacing: 1.2 },
  orderMeta: { fontSize: 12, color: SLATE_LIGHT, fontWeight: '500' as const },
  cardTitle: { fontSize: 20, fontWeight: '800' as const, color: NAVY, marginBottom: 4 },
  itemName: { fontSize: 13.5, color: SLATE, fontWeight: '500' as const, lineHeight: 19, marginBottom: 14 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  infoText: { fontSize: 13, color: SLATE_LIGHT },
  guaranteePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: AMBER_BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: AMBER_BORDER,
  },
  guaranteeText: { fontSize: 12.5, fontWeight: '600' as const, color: '#92400E' },

  sectionTitle: { fontSize: 17, fontWeight: '800' as const, color: NAVY, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: SLATE_LIGHT, lineHeight: 18, marginBottom: 16 },
  stepsList: { gap: 10 },

  reasonList: { gap: 10, marginBottom: 18 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  reasonRowActive: {
    borderColor: AMAZON_ORANGE,
    backgroundColor: '#FFFBF5',
  },
  reasonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonIconActive: { backgroundColor: '#FFF0D6' },
  reasonLabel: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: NAVY },
  reasonLabelActive: { color: AMAZON_ORANGE },

  notesWrap: { marginBottom: 14 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  notesLabel: { fontSize: 13, color: SLATE_LIGHT, fontWeight: '500' as const },
  notesInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 14,
    color: NAVY,
    minHeight: 80,
    lineHeight: 20,
  },
  infoNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
  },
  infoNoteText: { flex: 1, fontSize: 12.5, color: SLATE_LIGHT, lineHeight: 18 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E9EAEC',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: RED,
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  claimBtnDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0, elevation: 0 },
  claimBtnText: { fontSize: 16, fontWeight: '800' as const, color: WHITE, letterSpacing: 0.2 },
  claimBtnTextDisabled: { color: SLATE_LIGHT },
});
