import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import {
  Bell,
  Truck,
  PackageCheck,
  HandHeart,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useOnboardingFlow } from '@/store/OnboardingFlowContext';
import {
  OnboardingScreen,
  PrimaryCTA,
  SecondaryAction,
  FadeSlideIn,
} from '@/components/onboarding';
import { log } from '@/lib/logger';

type PermState = 'undetermined' | 'granted' | 'denied';

interface AlertReason {
  icon: React.ReactNode;
  title: string;
  body: string;
  delay: number;
}

/**
 * Android-first notification opt-in screen that leads the onboarding funnel.
 *
 * Android's ~81% notification opt-in rate makes push the highest-ROI retention
 * channel at zero cost. By placing this step before the rest of onboarding, we
 * capture the channel early — before the user has reason to decline. The
 * framing is protective ("know the moment your first delivery arrives") rather
 * than promotional, which aligns with why users install Porchivo.
 */
export default function DeliveryAlertsScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { track } = useAnalytics();
  const { updateSetup } = useOnboardingFlow();
  const params = useLocalSearchParams<{ mode?: string; next?: string }>();

  const [permState, setPermState] = useState<PermState>('undetermined');
  const [requesting, setRequesting] = useState<boolean>(false);
  const [grantedFlash, setGrantedFlash] = useState<boolean>(false);

  // ── Entrance animations ──────────────────────────────────────────────────
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;
  const bellScale = useRef(new Animated.Value(0.3)).current;
  const bellOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(heroSlide, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 5 }),
      Animated.spring(bellScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
      Animated.timing(bellOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Pulsing ring around the bell — conveys "alert" without being noisy.
    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.5, duration: 1400, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 0.5, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    ringLoop.start();

    // Track that the prompt was shown.
    track('onboarding_push_prompt_shown', { surface: 'delivery_alerts', platform: Platform.OS });

    void checkExistingPermission();

    return () => ringLoop.stop();
  }, []);

  const checkExistingPermission = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const result = await Notifications.getPermissionsAsync();
      if (result.status === 'granted') {
        setPermState('granted');
      } else if (result.status === 'denied' && !result.canAskAgain) {
        setPermState('denied');
      }
    } catch {
      // Non-fatal — treat as undetermined
    }
  }, []);

  const goNext = useCallback(() => {
    const nextRoute = params.next ?? '/welcome-features';
    const mode = params.mode ?? 'signup';
    router.replace({
      pathname: nextRoute as never,
      params: { mode },
    } as never);
  }, [params, router]);

  const handleEnable = useCallback(async () => {
    if (Platform.OS === 'web') {
      goNext();
      return;
    }

    setRequesting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Set up Android notification channel before requesting permission.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('delivery-alerts', {
          name: 'Delivery Alerts',
          description: 'Out-for-delivery, arrival, and handoff notifications',
          importance: Notifications.AndroidImportance.HIGH,
          enableVibrate: true,
          showBadge: true,
        });
      }

      const result = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });

      const granted = result.status === 'granted';
      setPermState(granted ? 'granted' : result.canAskAgain ? 'undetermined' : 'denied');

      updateSetup({ notificationsEnabled: granted });

      if (granted) {
        track('onboarding_push_allowed', { surface: 'delivery_alerts', platform: Platform.OS });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Play a brief success flash, then advance.
        setGrantedFlash(true);
        Animated.spring(successScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 16,
          bounciness: 10,
        }).start();

        setTimeout(goNext, 900);
      } else {
        track('onboarding_push_denied', {
          surface: 'delivery_alerts',
          platform: Platform.OS,
          canAskAgain: result.canAskAgain,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        // Still advance — notifications are optional, don't block onboarding.
        setTimeout(goNext, 600);
      }
    } catch (e) {
      log('[DeliveryAlerts] permission error:', e);
      // Non-fatal — advance anyway.
      setTimeout(goNext, 400);
    } finally {
      setRequesting(false);
    }
  }, [goNext, track, updateSetup]);

  const handleSkip = useCallback(() => {
    void Haptics.selectionAsync();
    track('onboarding_push_denied', { surface: 'delivery_alerts', platform: Platform.OS, reason: 'skipped' });
    updateSetup({ notificationsEnabled: false });
    goNext();
  }, [goNext, track, updateSetup]);

  // ── Reason cards ──────────────────────────────────────────────────────────
  const reasons: AlertReason[] = [
    {
      icon: <Truck size={22} color={Colors.primary} strokeWidth={2.2} />,
      title: 'Out for delivery',
      body: 'Know the moment your package leaves the truck — before it reaches your porch.',
      delay: 120,
    },
    {
      icon: <PackageCheck size={22} color={Colors.success} strokeWidth={2.2} />,
      title: 'Arrived at your porch',
      body: 'Get pinged the second a delivery is logged at your address. No more checking the door.',
      delay: 200,
    },
    {
      icon: <HandHeart size={22} color={Colors.secondary} strokeWidth={2.2} />,
      title: 'Porch Partner handoff',
      body: 'See when a trusted neighbor picks up or safely stores a package for you.',
      delay: 280,
    },
  ];

  const ctaLabel = permState === 'granted' ? 'Alerts on — Continue' : 'Enable delivery alerts';

  return (
    <OnboardingScreen
      glow={false}
      footer={
        <View>
          <PrimaryCTA
            label={requesting ? 'Setting up…' : ctaLabel}
            onPress={handleEnable}
            loading={requesting}
            testID="delivery-alerts-enable"
          />
          <SecondaryAction
            label="Maybe later"
            onPress={handleSkip}
            testID="delivery-alerts-skip"
          />
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.hero,
            { opacity: heroFade, transform: [{ translateY: heroSlide }] },
          ]}
        >
          <View style={styles.bellWrap}>
            {/* Pulsing ring */}
            <Animated.View
              style={[
                styles.bellRing,
                {
                  borderColor: Colors.primary,
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />
            {/* Bell tile */}
            <Animated.View
              style={[
                styles.bellTile,
                {
                  backgroundColor: Colors.primary,
                  opacity: bellOpacity,
                  transform: [{ scale: bellScale }],
                },
              ]}
            >
              <Bell size={40} color={Colors.onPrimary} strokeWidth={2} />
            </Animated.View>

            {/* Success overlay — scales in when granted */}
            {grantedFlash ? (
              <Animated.View
                style={[
                  styles.successOverlay,
                  { transform: [{ scale: successScale }] },
                ]}
              >
                <View style={[styles.successCircle, { backgroundColor: Colors.success }]}>
                  <CheckCircle2 size={36} color={Colors.onPrimary} strokeWidth={2.5} />
                </View>
              </Animated.View>
            ) : null}
          </View>

          <Text style={[styles.eyebrow, { color: Colors.secondary }]}>
            YOUR FIRST DELIVERY
          </Text>
          <Text style={[styles.title, { color: Colors.slate }]}>
            Enable alerts for your first delivery
          </Text>
          <Text style={[styles.subtitle, { color: Colors.slateLight }]}>
            Porchivo watches your porch so you don't have to. Get pinged the moment
            something matters — no spam, ever.
          </Text>
        </Animated.View>

        {/* ── Reason cards ─────────────────────────────────────────────── */}
        {reasons.map((r) => (
          <FadeSlideIn key={r.title} delay={r.delay} offset={10}>
            <View
              style={[
                styles.reasonCard,
                {
                  backgroundColor: Colors.surface,
                  borderColor: Colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.reasonIcon,
                  {
                    backgroundColor: Colors.skyBlue,
                  },
                ]}
              >
                {r.icon}
              </View>
              <View style={styles.reasonText}>
                <Text style={[styles.reasonTitle, { color: Colors.slate }]}>
                  {r.title}
                </Text>
                <Text style={[styles.reasonBody, { color: Colors.slateLight }]}>
                  {r.body}
                </Text>
              </View>
            </View>
          </FadeSlideIn>
        ))}

        {/* ── Trust line ───────────────────────────────────────────────── */}
        <FadeSlideIn delay={360} offset={8}>
          <View style={styles.trustRow}>
            <ShieldCheck size={14} color={Colors.slateLighter} strokeWidth={2} />
            <Text style={[styles.trustText, { color: Colors.slateLighter }]}>
              Only protective alerts. No marketing, no spam. Change anytime in Settings.
            </Text>
          </View>
        </FadeSlideIn>
      </ScrollView>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 12,
  },
  bellWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  bellRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2.5,
  },
  bellTile: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2B4A',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 10,
  },
  successOverlay: {
    position: 'absolute',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E9C6A',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 34,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  reasonIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonText: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  reasonBody: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  trustText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
});
