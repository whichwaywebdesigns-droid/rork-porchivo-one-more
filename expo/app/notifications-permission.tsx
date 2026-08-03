import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import {
  Bell,
  Truck,
  ShieldCheck,
  HandHeart,
  AlertTriangle,
  CheckCircle2,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { palette, radius, space, type as ttype, elevation } from '@/constants/theme';
import Button from '@/components/ui/Button';
import { log } from "@/lib/logger";

type PermStatus = 'undetermined' | 'granted' | 'denied' | 'unsupported';

const REASONS: { icon: React.ReactNode; title: string; body: string; tint: string }[] = [
  {
    icon: <Truck size={20} color={palette.navy} />,
    title: 'Out-for-delivery alerts',
    body: 'Know the moment your package leaves the truck — before it hits your porch.',
    tint: palette.sky,
  },
  {
    icon: <ShieldCheck size={20} color={palette.sage} />,
    title: 'Porch theft warnings',
    body: 'Get pinged about suspicious activity on your block as it happens.',
    tint: palette.sageSoft,
  },
  {
    icon: <HandHeart size={20} color={palette.ember} />,
    title: 'Porch Partner updates',
    body: 'See when a trusted neighbor picks up or returns a package for you.',
    tint: palette.emberSoft,
  },
];

export default function NotificationsPermissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ next?: string }>();
  const [status, setStatus] = useState<PermStatus>('undetermined');
  const [requesting, setRequesting] = useState<boolean>(false);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  const bellPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bellPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(bellPulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    ).start();

    void checkStatus();
  }, [fade, slide, bellPulse]);

  const checkStatus = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus('unsupported');
      return;
    }
    try {
      const result = await Notifications.getPermissionsAsync();
      if (result.status === 'granted') setStatus('granted');
      else if (result.status === 'denied' && !result.canAskAgain) setStatus('denied');
      else setStatus('undetermined');
    } catch (e) {
      log('[NotificationsPermission] check error:', e);
      setStatus('undetermined');
    }
  }, []);

  const goNext = useCallback(() => {
    if (params.next) {
      router.replace(params.next as never);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/(home)' as never);
    }
  }, [params.next, router]);

  const handleEnable = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Push notifications are unsupported on web.');
      goNext();
      return;
    }

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

    setRequesting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
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
      log('[NotificationsPermission] status:', result.status);
      if (granted) {
        setTimeout(goNext, 600);
      }
    } catch (e) {
      log('[NotificationsPermission] request error:', e);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setRequesting(false);
    }
  }, [status, goNext]);

  const handleSkip = useCallback(() => {
    void Haptics.selectionAsync();
    goNext();
  }, [goNext]);

  const ctaLabel =
    status === 'granted'
      ? 'Notifications on — Continue'
      : status === 'denied'
        ? 'Open Settings'
        : 'Turn on alerts';

  const bellScale = bellPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const ringOpacity = bellPulse.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.45] });
  const ringScale = bellPulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.4] });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.hero, { opacity: fade, transform: [{ translateY: slide }] }]}>
          <View style={styles.bellWrap}>
            <Animated.View
              style={[
                styles.bellRing,
                { opacity: ringOpacity, transform: [{ scale: ringScale }] },
              ]}
            />
            <Animated.View style={[styles.bellTile, { transform: [{ scale: bellScale }] }]}>
              <Bell size={36} color={palette.surface} strokeWidth={2} />
            </Animated.View>
          </View>

          <Text style={styles.eyebrow}>STAY AHEAD OF THIEVES</Text>
          <Text style={styles.title}>Get pinged the moment something matters</Text>
          <Text style={styles.subtitle}>
            Porchivo only sends alerts that protect your packages — never marketing, never spam.
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <View style={styles.reasonCard}>
            {REASONS.map((r, i) => (
              <View
                key={r.title}
                style={[
                  styles.reasonRow,
                  i < REASONS.length - 1 ? styles.reasonRowDivider : null,
                ]}
              >
                <View style={[styles.reasonIcon, { backgroundColor: r.tint }]}>{r.icon}</View>
                <View style={styles.reasonText}>
                  <Text style={styles.reasonTitle}>{r.title}</Text>
                  <Text style={styles.reasonBody}>{r.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {status === 'denied' ? (
            <View style={styles.deniedBanner}>
              <AlertTriangle size={16} color={palette.ember} />
              <Text style={styles.deniedText}>
                Notifications are turned off in {Platform.OS === 'ios' ? 'iOS' : 'app'} Settings. Tap below to re-enable.
              </Text>
            </View>
          ) : null}

          {status === 'granted' ? (
            <View style={styles.grantedBanner}>
              <CheckCircle2 size={16} color={palette.sage} />
              <Text style={styles.grantedText}>You&apos;re all set — alerts are on.</Text>
            </View>
          ) : null}

          <Text style={styles.privacy}>
            We&apos;ll show the system permission prompt next. You can change this anytime in Settings.
          </Text>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <Button
          label={requesting ? 'Asking…' : ctaLabel}
          onPress={handleEnable}
          loading={requesting}
          variant={status === 'granted' ? 'tonal' : 'primary'}
          size="lg"
          fullWidth
          icon={
            status === 'denied' ? (
              <SettingsIcon size={18} color={palette.surface} />
            ) : status === 'granted' ? (
              <CheckCircle2 size={18} color={palette.navy} />
            ) : (
              <Bell size={18} color={palette.surface} />
            )
          }
          testID="notifications-permission-cta"
        />
        <View style={{ height: space.sm }} />
        <Button
          label="Not now"
          onPress={handleSkip}
          variant="ghost"
          size="md"
          fullWidth
          testID="notifications-permission-skip"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  scroll: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: space.xxl,
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
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: palette.navy,
  },
  bellTile: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.navy,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 8,
  },
  eyebrow: {
    ...ttype.overline,
    color: palette.ember,
    marginBottom: 8,
  },
  title: {
    ...ttype.display,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    ...ttype.body,
    color: palette.slate500,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: space.sm,
  },
  reasonCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: 4,
    ...elevation.low,
    marginBottom: space.lg,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.lg,
  },
  reasonRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.slate100,
  },
  reasonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonText: { flex: 1 },
  reasonTitle: {
    ...ttype.headline,
    color: palette.ink,
    marginBottom: 2,
  },
  reasonBody: {
    ...ttype.caption,
    color: palette.slate500,
    lineHeight: 18,
  },
  deniedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.emberSoft,
    marginBottom: space.md,
  },
  deniedText: {
    flex: 1,
    fontSize: 13,
    color: palette.emberDeep,
    fontWeight: '500' as const,
  },
  grantedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: palette.sageSoft,
    marginBottom: space.md,
  },
  grantedText: {
    flex: 1,
    fontSize: 13,
    color: palette.sage,
    fontWeight: '600' as const,
  },
  privacy: {
    fontSize: 12,
    color: palette.slate300,
    textAlign: 'center',
    marginTop: space.sm,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    backgroundColor: palette.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.slate100,
  },
});
