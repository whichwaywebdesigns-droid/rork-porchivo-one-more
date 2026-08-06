import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import {
  Bell,
  Truck,
  ShieldCheck,
  HandHeart,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Settings as SettingsIcon,
  BellRing,
} from 'lucide-react-native';

import { palette, space, radius, type as ttype, elevation } from '@/constants/theme';
import { useAnalytics } from '@/store/AnalyticsContext';
import { log } from '@/lib/logger';

interface TrackingNotificationsProps {
  onContinue: () => void;
  onSkip: () => void;
}

type PermStatus = 'undetermined' | 'granted' | 'denied';

interface ReasonTile {
  icon: React.ReactNode;
  title: string;
  body: string;
  tint: string;
}

const REASONS: ReasonTile[] = [
  {
    icon: <Truck size={20} color={palette.navy} strokeWidth={2.2} />,
    title: 'Out-for-delivery alerts',
    body: 'Know the moment your package leaves the truck — before it hits your porch.',
    tint: palette.sky,
  },
  {
    icon: <ShieldCheck size={20} color={palette.sage} strokeWidth={2.2} />,
    title: 'Porch theft warnings',
    body: 'Get pinged about suspicious activity on your block as it happens.',
    tint: palette.sageSoft,
  },
  {
    icon: <HandHeart size={20} color={palette.ember} strokeWidth={2.2} />,
    title: 'Porch Partner updates',
    body: 'See when a trusted neighbor picks up or returns a package for you.',
    tint: palette.emberSoft,
  },
];

export default function TrackingNotificationsScreen({
  onContinue,
  onSkip,
}: TrackingNotificationsProps): React.ReactElement {
  const { track } = useAnalytics();

  const [status, setStatus] = useState<PermStatus>('undetermined');
  const [requesting, setRequesting] = useState<boolean>(false);

  // ── Animations ──────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const bellPulse = useRef(new Animated.Value(0)).current;
  const tileAnims = useRef<Animated.Value[]>(
    REASONS.map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    track('onboarding_step_view', { step: 'notifications' });

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 8,
      }),
    ]).start();

    // Continuous bell ring pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(bellPulse, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(bellPulse, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Staggered tile entrance
    REASONS.forEach((_, i) => {
      setTimeout(() => {
        Animated.spring(tileAnims[i], {
          toValue: 1,
          useNativeDriver: true,
          speed: 14,
          bounciness: 8,
        }).start();
      }, 200 + i * 120);
    });

    void checkStatus();
  }, []);

  const checkStatus = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const result = await Notifications.getPermissionsAsync();
      if (result.status === 'granted') {
        setStatus('granted');
      } else if (result.status === 'denied' && !result.canAskAgain) {
        setStatus('denied');
      } else {
        setStatus('undetermined');
      }
    } catch (e) {
      log('[TrackingNotifications] check error:', e);
      setStatus('undetermined');
    }
  }, []);

  const handleEnable = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Push notifications are unsupported on web.');
      onContinue();
      return;
    }

    // If already denied and can't ask again → open Settings
    if (status === 'denied') {
      Alert.alert(
        'Notifications turned off',
        'Open Settings to enable notifications for Porchivo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }

    if (status === 'granted') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onContinue();
      return;
    }

    setRequesting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('notification_priming_accepted', { platform: Platform.OS });

    try {
      // Android: set up notification channel BEFORE requesting permissions
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Porchivo Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3A7BD5',
        });
        await Notifications.setNotificationChannelAsync('delivery-alerts', {
          name: 'Delivery Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          description: 'Out-for-delivery and delivery status updates',
          vibrationPattern: [0, 250, 250, 250],
        });
        await Notifications.setNotificationChannelAsync('theft-warnings', {
          name: 'Theft Warnings',
          importance: Notifications.AndroidImportance.MAX,
          description: 'Urgent porch theft and suspicious activity alerts',
          vibrationPattern: [0, 400, 200, 400],
        });
        log('[TrackingNotifications] Android channels configured');
      }

      // Request system permission
      const result = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      const granted = result.status === 'granted';
      setStatus(granted ? 'granted' : result.canAskAgain ? 'undetermined' : 'denied');

      void Haptics.notificationAsync(
        granted
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );

      track(granted ? 'system_permission_granted' : 'system_permission_denied', {
        permission: 'notifications',
        platform: Platform.OS,
      });

      log('[TrackingNotifications] Permission result:', result.status);

      if (granted) {
        // Brief celebration then continue
        setTimeout(onContinue, 700);
      }
    } catch (e) {
      log('[TrackingNotifications] Request error:', e);
      Alert.alert('Something went wrong', 'Please try enabling notifications from Settings.');
    } finally {
      setRequesting(false);
    }
  }, [status, track, onContinue]);

  const handleSkip = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('notification_priming_declined', { platform: Platform.OS });
    track('onboarding_step_skipped', { step: 'notifications' });
    onSkip();
  }, [track, onSkip]);

  // ── Derived display values ──────────────────────────────────────────
  const bellScale = bellPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const ringOpacity = bellPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.0, 0.0],
  });
  const ringScale = bellPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.45],
  });

  const ctaLabel =
    status === 'granted'
      ? 'Continue'
      : status === 'denied'
        ? 'Open Settings'
        : 'Turn on Alerts';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Step indicator */}
      <View style={styles.stepBar}>
        <View style={styles.stepDots}>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                s === 4 && styles.stepDotActive,
                s < 4 && styles.stepDotDone,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step 4 of 6</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.bellWrap}>
            <Animated.View
              style={[
                styles.bellRing,
                { opacity: ringOpacity, transform: [{ scale: ringScale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.bellTile,
                { transform: [{ scale: bellScale }] },
              ]}
            >
              {status === 'granted' ? (
                <BellRing size={36} color={palette.surface} strokeWidth={2} />
              ) : (
                <Bell size={36} color={palette.surface} strokeWidth={2} />
              )}
            </Animated.View>
          </View>

          <Text style={styles.eyebrow}>STAY AHEAD OF THIEVES</Text>
          <Text style={styles.title}>Get pinged the moment something matters</Text>
          <Text style={styles.subtitle}>
            Porchivo only sends alerts that protect your packages — never marketing, never spam.
          </Text>
        </Animated.View>

        {/* Reason tiles */}
        <View style={styles.reasonsWrap}>
          {REASONS.map((reason, i) => (
            <Animated.View
              key={reason.title}
              style={[
                styles.reasonCard,
                {
                  opacity: tileAnims[i],
                  transform: [
                    {
                      translateY: tileAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.reasonIcon, { backgroundColor: reason.tint }]}>
                {reason.icon}
              </View>
              <View style={styles.reasonText}>
                <Text style={styles.reasonTitle}>{reason.title}</Text>
                <Text style={styles.reasonBody}>{reason.body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Status banners */}
        {status === 'granted' ? (
          <Animated.View style={[styles.banner, styles.grantedBanner, { opacity: fadeAnim }]}>
            <CheckCircle2 size={16} color={palette.sage} strokeWidth={2.2} />
            <Text style={styles.grantedText}>You&apos;re all set — alerts are on.</Text>
          </Animated.View>
        ) : null}

        {status === 'denied' ? (
          <Animated.View style={[styles.banner, styles.deniedBanner, { opacity: fadeAnim }]}>
            <AlertTriangle size={16} color={palette.ember} strokeWidth={2.2} />
            <Text style={styles.deniedText}>
              Notifications are turned off in {Platform.OS === 'ios' ? 'iOS' : 'app'} Settings.
              Tap below to re-enable.
            </Text>
          </Animated.View>
        ) : null}

        {/* Privacy hint */}
        <Text style={styles.privacy}>
          We&apos;ll show the system permission prompt next. You can change this anytime in Settings.
        </Text>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.ctaButton, requesting && styles.ctaButtonDisabled]}
          onPress={handleEnable}
          disabled={requesting}
          activeOpacity={0.85}
          accessibilityLabel={ctaLabel}
          accessibilityRole="button"
          testID="btn-enable-notifications"
        >
          {status === 'denied' ? (
            <SettingsIcon size={20} color={palette.surface} strokeWidth={2.2} />
          ) : status === 'granted' ? (
            <CheckCircle2 size={20} color={palette.surface} strokeWidth={2.2} />
          ) : (
            <Bell size={20} color={palette.surface} strokeWidth={2.2} />
          )}
          <Text style={styles.ctaText}>{requesting ? 'Asking…' : ctaLabel}</Text>
          {status !== 'granted' && !requesting ? (
            <ArrowRight size={18} color={palette.surface} strokeWidth={2.5} />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
          accessibilityLabel="Skip for now"
          accessibilityRole="button"
          testID="btn-skip"
        >
          <Text style={styles.skipText}>Skip for now</Text>
          <ChevronRight size={14} color={palette.slate300} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  // ── Step indicator ──────────────────────────────────────────────────
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xxl,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.slate200,
  },
  stepDotActive: {
    backgroundColor: palette.navy,
    width: 24,
  },
  stepDotDone: {
    backgroundColor: palette.sage,
  },
  stepLabel: {
    ...ttype.caption,
    color: palette.slate500,
    fontSize: 12,
  },
  // ── Scroll ──────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: space.xxl,
    paddingBottom: space.xxxl,
  },
  // ── Header ──────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },
  bellWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  bellRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2.5,
    borderColor: palette.navy,
  },
  bellTile: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.navy,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
  eyebrow: {
    ...ttype.overline,
    color: palette.ember,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    ...ttype.displayMd,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  subtitle: {
    ...ttype.body,
    color: palette.slate500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: space.sm,
  },
  // ── Reason tiles ────────────────────────────────────────────────────
  reasonsWrap: {
    gap: space.md,
    marginBottom: space.lg,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    ...elevation.low,
  },
  reasonIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonText: {
    flex: 1,
  },
  reasonTitle: {
    ...ttype.headline,
    color: palette.ink,
    fontSize: 15,
    marginBottom: 3,
  },
  reasonBody: {
    ...ttype.caption,
    color: palette.slate500,
    lineHeight: 19,
    fontSize: 13,
  },
  // ── Banners ─────────────────────────────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: space.md,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  grantedBanner: {
    backgroundColor: palette.sageSoft,
  },
  grantedText: {
    flex: 1,
    fontSize: 13,
    color: palette.sage,
    fontWeight: '600' as const,
  },
  deniedBanner: {
    backgroundColor: palette.emberSoft,
  },
  deniedText: {
    flex: 1,
    fontSize: 13,
    color: palette.emberDeep,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  // ── Privacy ─────────────────────────────────────────────────────────
  privacy: {
    fontSize: 12,
    color: palette.slate300,
    textAlign: 'center',
    marginTop: space.sm,
    lineHeight: 17,
  },
  // ── Footer ──────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xxl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    backgroundColor: palette.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.slate100,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: palette.navy,
    paddingVertical: 17,
    paddingHorizontal: space.xxxl,
    borderRadius: radius.pill,
    minWidth: 280,
    ...elevation.raised,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: palette.surface,
    fontSize: 17,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  skipText: {
    ...ttype.caption,
    color: palette.slate500,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
