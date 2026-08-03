import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Truck,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmazonOrder {
  order_id: string;
  item_name: string;
  otp_code: string;
  status: string;
  expected_delivery: string;
  user_id: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AMAZON_ORANGE = '#FF9900';
const BG = '#F2F3F4';
const WHITE = '#FFFFFF';
const NAVY = '#1B2A4A';
const SLATE = '#4B5563';
const SLATE_LIGHT = '#9CA3AF';
const WARNING_BG = '#FFF8EC';
const WARNING_BORDER = '#FFD580';

// Mock fallback — used when Supabase has no matching row (preview / demo)
const MOCK_ORDER: AmazonOrder = {
  order_id: 'AMZ-2024-7291',
  item_name: 'Sony WH-1000XM5 Noise Cancelling Headphones',
  otp_code: '483917',
  status: 'out_for_delivery',
  expected_delivery: new Date().toISOString().split('T')[0],
  user_id: '',
};

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
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: '#D1D5DB',
          opacity,
        },
        style,
      ]}
    />
  );
}

function SkeletonScreen() {
  return (
    <View style={sk.wrap}>
      {/* OTP card skeleton */}
      <View style={sk.card}>
        <SkeletonPulse width="50%" height={14} style={{ marginBottom: 20 }} />
        <SkeletonPulse width="70%" height={12} style={{ marginBottom: 28 }} />
        <SkeletonPulse width="80%" height={56} radius={16} style={{ alignSelf: 'center', marginBottom: 20 }} />
        <SkeletonPulse width="60%" height={11} style={{ alignSelf: 'center', marginBottom: 24 }} />
        <SkeletonPulse width="40%" height={40} radius={12} style={{ alignSelf: 'center' }} />
      </View>
      {/* Warning card skeleton */}
      <View style={[sk.card, { marginTop: 16 }]}>
        <SkeletonPulse width="55%" height={14} style={{ marginBottom: 18 }} />
        {[80, 90, 70, 85].map((w, i) => (
          <SkeletonPulse key={i} width={`${w}%`} height={11} style={{ marginBottom: 12 }} />
        ))}
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 0 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 5,
  },
});

// ─── OTP Digit display ───────────────────────────────────────────────────────

function OTPDisplay({ code }: { code: string }) {
  const digits = code.split('');
  return (
    <View style={otp.row}>
      {digits.map((d, i) => (
        <View key={i} style={otp.digitBox}>
          <Text style={otp.digit}>{d}</Text>
        </View>
      ))}
    </View>
  );
}

const otp = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 24,
  },
  digitBox: {
    width: 44,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFF8EC',
    borderWidth: 2,
    borderColor: WARNING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AMAZON_ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  digit: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 28,
    fontWeight: '800' as const,
    color: NAVY,
    letterSpacing: 0,
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CodeReadyScreen() {
  const { order_id } = useLocalSearchParams<{ order_id?: string }>();
  const router = useRouter();
  const { user } = useApp();

  const [order, setOrder] = useState<AmazonOrder | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [understood, setUnderstood] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);

  // ── Animations ──────────────────────────────────────────────────────────────
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  const otpTranslateY = useRef(new Animated.Value(-70)).current;
  const otpOpacity = useRef(new Animated.Value(0)).current;

  const warnTranslateY = useRef(new Animated.Value(70)).current;
  const warnOpacity = useRef(new Animated.Value(0)).current;

  const copyScale = useRef(new Animated.Value(1)).current;
  const confirmScale = useRef(new Animated.Value(1)).current;

  // Status dot pulse
  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.55,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulseOpacity, pulseScale]);

  // ── Fetch order ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      try {
        let query = supabase
          .from('amazon_orders')
          .select('*')
          .eq('status', 'out_for_delivery');

        if (order_id) {
          query = query.eq('order_id', order_id);
        } else if (user?.id) {
          query = query.eq('user_id', user.id);
        }

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

  // ── Entrance animations on load ─────────────────────────────────────────────
  useEffect(() => {
    if (isLoading || !order) return;

    Animated.parallel([
      Animated.spring(otpTranslateY, {
        toValue: 0,
        tension: 55,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(otpOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();

    const warnDelay = setTimeout(() => {
      Animated.parallel([
        Animated.spring(warnTranslateY, {
          toValue: 0,
          tension: 55,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(warnOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
      ]).start();
    }, 200);

    return () => clearTimeout(warnDelay);
  }, [isLoading, order, otpOpacity, otpTranslateY, warnOpacity, warnTranslateY]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!order) return;

    Animated.sequence([
      Animated.spring(copyScale, { toValue: 0.92, useNativeDriver: true, speed: 80 }),
      Animated.spring(copyScale, { toValue: 1, useNativeDriver: true, speed: 80 }),
    ]).start();

    await Clipboard.setStringAsync(order.otp_code);

    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, [order, copyScale]);

  const handleConfirm = useCallback(async () => {
    if (!order || !understood || confirming) return;

    Animated.sequence([
      Animated.spring(confirmScale, { toValue: 0.96, useNativeDriver: true, speed: 80 }),
      Animated.spring(confirmScale, { toValue: 1, useNativeDriver: true, speed: 80 }),
    ]).start();

    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setConfirming(true);
    try {
      await supabase
        .from('amazon_orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('order_id', order.order_id);
    } catch {
      // Non-critical — always navigate back on confirm
    } finally {
      setConfirming(false);
      router.back();
    }
  }, [order, understood, confirming, confirmScale, router]);

  const handleToggle = useCallback(
    (value: boolean) => {
      setUnderstood(value);
      if (value && Platform.OS !== 'web') {
        void Haptics.selectionAsync();
      }
    },
    [],
  );

  // ── Derived ──────────────────────────────────────────────────────────────────
  const itemLabel = useMemo(() => {
    if (!order) return '';
    const max = 38;
    return order.item_name.length > max
      ? order.item_name.slice(0, max) + '…'
      : order.item_name;
  }, [order]);

  const bulletPoints = useMemo(
    () => [
      'Inspect the outer packaging for damage before signing',
      'Open the box and verify contents are present',
      'If anything is missing or damaged — do NOT give the OTP code',
      'Amazon will not investigate theft if the OTP was already provided',
    ],
    [],
  );

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Code Ready',
          headerStyle: { backgroundColor: BG },
          headerShadowVisible: false,
          headerTintColor: NAVY,
        }}
      />

      {/* ── Status Banner ──────────────────────────────────────────────────── */}
      <View style={styles.banner}>
        {/* Pulsing dot */}
        <View style={styles.dotWrap}>
          <Animated.View
            style={[
              styles.dotRing,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <View style={styles.dotCore} />
        </View>

        <Truck size={15} color={AMAZON_ORANGE} strokeWidth={2.5} />
        <Text style={styles.bannerText}>Your driver is on the way</Text>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
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
            {/* ── OTP Card (drops from top) ──────────────────────────────── */}
            <Animated.View
              style={[
                styles.otpCard,
                {
                  opacity: otpOpacity,
                  transform: [{ translateY: otpTranslateY }],
                },
              ]}
            >
              {/* Card header */}
              <View style={styles.otpCardHeader}>
                <View style={styles.otpBadge}>
                  <Text style={styles.otpBadgeText}>SECURE CODE</Text>
                </View>
                <Text style={styles.otpCardTitle}>Your One-Time Password</Text>
                {!!itemLabel && (
                  <Text style={styles.itemName}>{itemLabel}</Text>
                )}
              </View>

              {/* Digit boxes */}
              {order && <OTPDisplay code={order.otp_code} />}

              {/* Instruction */}
              <Text style={styles.otpInstruction}>
                Read this code to your driver to confirm delivery
              </Text>

              {/* Copy button */}
              <Animated.View style={{ transform: [{ scale: copyScale }] }}>
                <TouchableOpacity
                  style={[styles.copyBtn, copied && styles.copyBtnDone]}
                  onPress={handleCopy}
                  activeOpacity={0.85}
                  accessibilityLabel="Copy OTP code to clipboard"
                >
                  {copied ? (
                    <CheckCircle2 size={17} color={WHITE} strokeWidth={2.5} />
                  ) : (
                    <Copy size={17} color={AMAZON_ORANGE} strokeWidth={2} />
                  )}
                  <Text
                    style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}
                  >
                    {copied ? 'Copied to Clipboard!' : 'Copy Code'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>

            {/* ── Warning Card (slides from bottom) ─────────────────────── */}
            <Animated.View
              style={[
                styles.warnCard,
                {
                  opacity: warnOpacity,
                  transform: [{ translateY: warnTranslateY }],
                },
              ]}
            >
              {/* Warning header */}
              <View style={styles.warnHeader}>
                <View style={styles.warnIconWrap}>
                  <AlertTriangle
                    size={18}
                    color={AMAZON_ORANGE}
                    strokeWidth={2.5}
                  />
                </View>
                <Text style={styles.warnTitle}>Before You Dismiss the Driver</Text>
              </View>

              <View style={styles.divider} />

              {/* Bullet points */}
              <View style={styles.bullets}>
                {bulletPoints.map((point, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{point}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.divider} />

              {/* I Understand toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabels}>
                  <Check
                    size={15}
                    color={understood ? '#059669' : SLATE_LIGHT}
                    strokeWidth={2.5}
                  />
                  <Text style={[styles.toggleLabel, understood && styles.toggleLabelActive]}>
                    I Understand
                  </Text>
                </View>
                <Switch
                  value={understood}
                  onValueChange={handleToggle}
                  trackColor={{ false: '#E5E7EB', true: '#34D399' }}
                  thumbColor={understood ? '#059669' : '#9CA3AF'}
                  ios_backgroundColor="#E5E7EB"
                  accessibilityLabel="I understand the delivery instructions"
                />
              </View>
            </Animated.View>

            <View style={styles.footerSpacer} />
          </>
        )}
      </ScrollView>

      {/* ── Confirm Button ───────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Animated.View style={{ transform: [{ scale: confirmScale }], width: '100%' }}>
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (!understood || isLoading || confirming) && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!understood || isLoading || confirming}
            activeOpacity={0.88}
            accessibilityLabel="Confirm delivery"
          >
            {confirming ? (
              <Text style={[styles.confirmBtnText, styles.confirmBtnTextDisabled]}>
                Confirming…
              </Text>
            ) : (
              <Text
                style={[
                  styles.confirmBtnText,
                  !understood && styles.confirmBtnTextDisabled,
                ]}
              >
                I've Confirmed My Delivery
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: WHITE,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EAEC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: AMAZON_ORANGE,
    opacity: 0.3,
  },
  dotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AMAZON_ORANGE,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: NAVY,
    flex: 1,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 24,
  },

  // OTP Card
  otpCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  otpCardHeader: {
    alignItems: 'flex-start',
    gap: 6,
  },
  otpBadge: {
    backgroundColor: '#FFF0D6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  otpBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: AMAZON_ORANGE,
    letterSpacing: 1.2,
  },
  otpCardTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: NAVY,
    lineHeight: 26,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: SLATE,
    lineHeight: 18,
  },
  otpInstruction: {
    fontSize: 13,
    color: SLATE,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: AMAZON_ORANGE,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    backgroundColor: '#FFFBF5',
  },
  copyBtnDone: {
    backgroundColor: AMAZON_ORANGE,
    borderColor: AMAZON_ORANGE,
  },
  copyBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: AMAZON_ORANGE,
  },
  copyBtnTextDone: {
    color: WHITE,
  },

  // Warning Card
  warnCard: {
    backgroundColor: WARNING_BG,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: WARNING_BORDER,
    padding: 20,
    shadowColor: '#CC7700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  warnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  warnIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFE8B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#92400E',
    flex: 1,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: WARNING_BORDER,
    opacity: 0.5,
    marginVertical: 14,
  },
  bullets: {
    gap: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AMAZON_ORANGE,
    marginTop: 5,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#78350F',
    fontWeight: '500' as const,
  },

  // I Understand toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: SLATE,
  },
  toggleLabelActive: {
    color: '#059669',
  },

  // Footer
  footerSpacer: {
    height: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E9EAEC',
  },
  confirmBtn: {
    backgroundColor: AMAZON_ORANGE,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AMAZON_ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: WHITE,
    letterSpacing: 0.2,
  },
  confirmBtnTextDisabled: {
    color: SLATE_LIGHT,
  },
});
