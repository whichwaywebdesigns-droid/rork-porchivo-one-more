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
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Home,
  Info,
  MapPin,
  Navigation,
  Package,
  Shield,
  Truck,
} from 'lucide-react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

const UPS_BROWN = '#351C15';
const UPS_GOLD = '#FFB500';
const UPS_GOLD_SOFT = '#FFF8E1';
const UPS_GOLD_BORDER = '#FFD54F';
const BG = '#F2F3F4';
const WHITE = '#FFFFFF';
const NAVY = '#1B2A4A';
const SLATE = '#4B5563';
const SLATE_LIGHT = '#9CA3AF';
const GREEN = '#059669';
const GREEN_SOFT = '#ECFDF5';
const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.07,
  shadowRadius: 18,
  elevation: 5,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type InterceptOption = 'hold' | 'reroute' | 'reschedule';

interface InterceptChoice {
  id: InterceptOption;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  eta: string;
  fee: string;
}

// ─── Mock in-transit package ─────────────────────────────────────────────────

const MOCK_PACKAGE = {
  tracking: '1Z999AA10123456784',
  description: 'Apple MacBook Pro 14"',
  origin: 'Louisville, KY',
  current: 'Indianapolis, IN',
  destination: 'Chicago, IL',
  eta: 'Tomorrow by 8 PM',
  stops_away: 12,
};

const INTERCEPT_OPTIONS: InterceptChoice[] = [
  {
    id: 'hold',
    title: 'Hold at UPS Location',
    subtitle: 'Pick up at your nearest UPS Access Point or Customer Center',
    icon: Building2,
    eta: 'Available by tomorrow',
    fee: 'Free',
  },
  {
    id: 'reroute',
    title: 'Deliver to New Address',
    subtitle: 'Redirect to a different address in the same metro area',
    icon: Home,
    eta: '+1–2 business days',
    fee: '$11.99',
  },
  {
    id: 'reschedule',
    title: 'Reschedule Delivery Date',
    subtitle: 'Hold the package and attempt delivery on a date you choose',
    icon: Calendar,
    eta: 'Up to 5 business days out',
    fee: 'Free',
  },
];

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ShipmentProgress() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 0.52, duration: 1100, delay: 300, useNativeDriver: false }).start();
  }, [progress]);

  const stages = ['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'];
  return (
    <View style={prog.wrap}>
      <View style={prog.track}>
        <Animated.View style={[prog.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        {stages.map((_, i) => (
          <View
            key={i}
            style={[prog.dot, i < 2 && prog.dotActive, i === 1 && prog.dotCurrent]}
          />
        ))}
      </View>
      <View style={prog.labels}>
        {stages.map((s, i) => (
          <Text key={i} style={[prog.label, i === 1 && prog.labelActive]}>{s}</Text>
        ))}
      </View>
    </View>
  );
}

const prog = StyleSheet.create({
  wrap: { marginTop: 10, marginBottom: 4 },
  track: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    marginBottom: 10,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 6,
    backgroundColor: UPS_GOLD,
    borderRadius: 3,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D1D5DB',
    borderWidth: 2,
    borderColor: WHITE,
    zIndex: 1,
  },
  dotActive: { backgroundColor: UPS_GOLD },
  dotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: UPS_BROWN,
    borderColor: WHITE,
    borderWidth: 2,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 10, color: SLATE_LIGHT, textAlign: 'center', flex: 1 },
  labelActive: { color: UPS_BROWN, fontWeight: '700' as const },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function InterceptScreen() {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<InterceptOption | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(INTERCEPT_OPTIONS.map(() => new Animated.Value(50))).current;
  const cardOpacities = useRef(INTERCEPT_OPTIONS.map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confirmScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();

    INTERCEPT_OPTIONS.forEach((_, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(cardAnims[i], { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
          Animated.timing(cardOpacities[i], { toValue: 1, duration: 350, useNativeDriver: true }),
        ]).start();
      }, 200 + i * 100);
    });

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [headerAnim, cardAnims, cardOpacities, pulseAnim]);

  const selectOption = useCallback((id: InterceptOption) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setSelectedOption(id);
  }, []);

  const handleRequest = useCallback(async () => {
    if (!selectedOption || submitting) return;
    Animated.sequence([
      Animated.spring(confirmScale, { toValue: 0.96, useNativeDriver: true, speed: 80 }),
      Animated.spring(confirmScale, { toValue: 1, useNativeDriver: true, speed: 80 }),
    ]).start();
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1400));
    setSubmitting(false);
    setConfirmed(true);
    setTimeout(() => router.back(), 2400);
  }, [selectedOption, submitting, confirmScale, router]);

  if (confirmed) {
    return (
      <View style={styles.successRoot}>
        <Stack.Screen options={{ title: 'Package Intercept', headerStyle: { backgroundColor: BG }, headerShadowVisible: false, headerTintColor: NAVY }} />
        <View style={styles.successCard}>
          <Animated.View style={[styles.successIcon, { transform: [{ scale: pulseAnim }] }]}>
            <CheckCircle2 size={44} color={GREEN} strokeWidth={2} />
          </Animated.View>
          <Text style={styles.successTitle}>Request Submitted</Text>
          <Text style={styles.successSub}>UPS will process your intercept within 1 business day. Track updates in the UPS app.</Text>
          <View style={styles.successBadge}>
            <Shield size={13} color={UPS_BROWN} strokeWidth={2} />
            <Text style={styles.successBadgeText}>UPS My Choice® Active</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Package Intercept',
          headerStyle: { backgroundColor: BG },
          headerShadowVisible: false,
          headerTintColor: NAVY,
        }}
      />

      {/* Banner */}
      <View style={styles.banner}>
        <Animated.View style={[styles.truckWrap, { transform: [{ scale: pulseAnim }] }]}>
          <Truck size={15} color={UPS_GOLD} strokeWidth={2.5} />
        </Animated.View>
        <Text style={styles.bannerText}>Package is In Transit — Intercept Window Open</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Shipment Status Card ─────────────────────────────────────── */}
        <Animated.View style={[styles.shipCard, { opacity: headerAnim }]}>
          <View style={styles.shipHeader}>
            <View style={styles.upsBadge}>
              <Text style={styles.upsBadgeText}>UPS MY CHOICE®</Text>
            </View>
            <View style={styles.inTransitBadge}>
              <View style={styles.inTransitDot} />
              <Text style={styles.inTransitText}>In Transit</Text>
            </View>
          </View>

          <Text style={styles.packageDesc}>{MOCK_PACKAGE.description}</Text>
          <Text style={styles.trackingNum}>{MOCK_PACKAGE.tracking}</Text>

          <ShipmentProgress />

          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <Navigation size={12} color={SLATE_LIGHT} strokeWidth={2} />
              <Text style={styles.routeLabel}>{MOCK_PACKAGE.origin}</Text>
            </View>
            <ArrowRight size={14} color={SLATE_LIGHT} strokeWidth={2} />
            <View style={[styles.routePoint, styles.routeCurrent]}>
              <MapPin size={12} color={UPS_BROWN} strokeWidth={2} />
              <Text style={[styles.routeLabel, { color: UPS_BROWN, fontWeight: '700' as const }]}>
                {MOCK_PACKAGE.current}
              </Text>
            </View>
            <ArrowRight size={14} color={SLATE_LIGHT} strokeWidth={2} />
            <View style={styles.routePoint}>
              <Home size={12} color={SLATE_LIGHT} strokeWidth={2} />
              <Text style={styles.routeLabel}>{MOCK_PACKAGE.destination}</Text>
            </View>
          </View>

          <View style={styles.etaRow}>
            <Clock size={13} color={UPS_GOLD} strokeWidth={2.5} />
            <Text style={styles.etaText}>Estimated arrival: <Text style={styles.etaBold}>{MOCK_PACKAGE.eta}</Text></Text>
          </View>
        </Animated.View>

        {/* ── Intercept Options ────────────────────────────────────────── */}
        <Text style={styles.optionsHeading}>Choose an Intercept Option</Text>

        {INTERCEPT_OPTIONS.map((opt, i) => {
          const Icon = opt.icon;
          const active = selectedOption === opt.id;
          return (
            <Animated.View
              key={opt.id}
              style={{
                opacity: cardOpacities[i],
                transform: [{ translateY: cardAnims[i] }],
              }}
            >
              <TouchableOpacity
                style={[styles.optionCard, active && styles.optionCardActive]}
                onPress={() => selectOption(opt.id)}
                activeOpacity={0.85}
                accessibilityLabel={opt.title}
              >
                <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                  <Icon size={20} color={active ? UPS_GOLD : SLATE} strokeWidth={2} />
                </View>
                <View style={styles.optionBody}>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{opt.title}</Text>
                  <Text style={styles.optionSub}>{opt.subtitle}</Text>
                  <View style={styles.optionMeta}>
                    <View style={styles.optionMetaChip}>
                      <Clock size={11} color={SLATE_LIGHT} strokeWidth={2} />
                      <Text style={styles.optionMetaText}>{opt.eta}</Text>
                    </View>
                    <View style={[styles.optionMetaChip, opt.fee === 'Free' && styles.freeChip]}>
                      <Text style={[styles.optionMetaText, opt.fee === 'Free' && styles.freeText]}>
                        {opt.fee}
                      </Text>
                    </View>
                  </View>
                </View>
                {active && <CheckCircle2 size={22} color={UPS_GOLD} strokeWidth={2} />}
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Info note */}
        <View style={styles.infoNote}>
          <Info size={13} color={SLATE_LIGHT} strokeWidth={2} />
          <Text style={styles.infoText}>
            Intercept requests must be submitted before the package reaches the local facility. Same-day delivery cannot be intercepted.
          </Text>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Request Button ────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Animated.View style={{ transform: [{ scale: confirmScale }], width: '100%' }}>
          <TouchableOpacity
            style={[styles.requestBtn, !selectedOption && styles.requestBtnDisabled]}
            onPress={handleRequest}
            disabled={!selectedOption || submitting}
            activeOpacity={0.88}
            accessibilityLabel="Request package intercept"
          >
            <Package size={17} color={selectedOption ? UPS_BROWN : SLATE_LIGHT} strokeWidth={2.5} />
            <Text style={[styles.requestBtnText, !selectedOption && styles.requestBtnTextDisabled]}>
              {submitting ? 'Requesting Intercept…' : 'Request Intercept'}
            </Text>
            {selectedOption && !submitting && (
              <ChevronRight size={17} color={UPS_BROWN} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </Animated.View>
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
    width: '100%',
    ...CARD_SHADOW,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: GREEN_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontWeight: '800' as const, color: NAVY, marginBottom: 10 },
  successSub: { fontSize: 14.5, color: SLATE, textAlign: 'center', lineHeight: 22, marginBottom: 18 },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UPS_GOLD_SOFT,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: UPS_GOLD_BORDER,
  },
  successBadgeText: { fontSize: 12.5, fontWeight: '700' as const, color: UPS_BROWN },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: UPS_BROWN,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  truckWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,181,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { fontSize: 13.5, fontWeight: '700' as const, color: WHITE, flex: 1 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 14, paddingBottom: 24 },

  shipCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 22,
    ...CARD_SHADOW,
  },
  shipHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  upsBadge: {
    backgroundColor: UPS_BROWN,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  upsBadgeText: { fontSize: 9.5, fontWeight: '800' as const, color: UPS_GOLD, letterSpacing: 1 },
  inTransitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inTransitDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: UPS_GOLD },
  inTransitText: { fontSize: 11.5, fontWeight: '700' as const, color: '#E65100' },
  packageDesc: { fontSize: 19, fontWeight: '800' as const, color: NAVY, marginBottom: 3 },
  trackingNum: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: SLATE_LIGHT,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
    gap: 4,
  },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  routeCurrent: {
    backgroundColor: UPS_GOLD_SOFT,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    flex: 1.2,
  },
  routeLabel: { fontSize: 10.5, color: SLATE_LIGHT, flexShrink: 1 },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: UPS_GOLD_SOFT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: UPS_GOLD_BORDER,
  },
  etaText: { fontSize: 13, color: UPS_BROWN },
  etaBold: { fontWeight: '700' as const },

  optionsHeading: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: NAVY,
    marginTop: 4,
    marginBottom: -2,
    paddingHorizontal: 2,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    ...CARD_SHADOW,
  },
  optionCardActive: {
    borderColor: UPS_GOLD,
    backgroundColor: UPS_GOLD_SOFT,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionIconActive: { backgroundColor: 'rgba(255,181,0,0.2)' },
  optionBody: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700' as const, color: NAVY, marginBottom: 3 },
  optionTitleActive: { color: UPS_BROWN },
  optionSub: { fontSize: 12.5, color: SLATE_LIGHT, lineHeight: 17, marginBottom: 8 },
  optionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  freeChip: { backgroundColor: '#ECFDF5' },
  optionMetaText: { fontSize: 11, color: SLATE_LIGHT, fontWeight: '500' as const },
  freeText: { color: GREEN, fontWeight: '700' as const },

  infoNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12.5, color: SLATE_LIGHT, lineHeight: 18 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E9EAEC',
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: UPS_GOLD,
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: UPS_GOLD,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  requestBtnDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0, elevation: 0 },
  requestBtnText: { fontSize: 16, fontWeight: '800' as const, color: UPS_BROWN, letterSpacing: 0.2 },
  requestBtnTextDisabled: { color: SLATE_LIGHT },
});
