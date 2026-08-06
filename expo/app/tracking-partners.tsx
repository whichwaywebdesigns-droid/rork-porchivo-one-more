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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Users,
  MapPin,
  Star,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Navigation,
  HandHeart,
  ShieldCheck,
  Gift,
} from 'lucide-react-native';

import { palette, space, radius, type as ttype, elevation } from '@/constants/theme';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useApp } from '@/store/AppContext';
import { PorchPartner } from '@/types';
import { mockPorchPartners } from '@/mocks/porchPartners';
import { log } from '@/lib/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrackingPartnersProps {
  onContinue: () => void;
  onSkip: () => void;
}

type LocStatus = 'undetermined' | 'granted' | 'denied';

interface NearbyPartner extends PorchPartner {
  /** Pseudo-angle on the mini-map radar, in radians */
  angle: number;
  /** Normalized radius (0–1) from center on the mini-map */
  ringDist: number;
}

// ── Mock radar placement for partners ──────────────────────────────────
function placeOnRadar(partners: PorchPartner[]): NearbyPartner[] {
  return partners
    .filter((p) => p.status === 'active')
    .slice(0, 4)
    .map((p, i) => ({
      ...p,
      angle: (i / 4) * Math.PI * 2 + 0.3,
      ringDist: 0.35 + (p.distance / 0.5) * 0.4,
    }));
}

export default function TrackingPartnersScreen({
  onContinue,
  onSkip,
}: TrackingPartnersProps): React.ReactElement {
  const { track } = useAnalytics();
  const { completeOnboarding, session, user } = useApp();

  const [locStatus, setLocStatus] = useState<LocStatus>('undetermined');
  const [requesting, setRequesting] = useState<boolean>(false);
  const [hasJoined, setHasJoined] = useState<boolean>(false);

  const nearbyPartners = useRef<NearbyPartner[]>(placeOnRadar(mockPorchPartners)).current;

  // ── Animations ──────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const radarSweep = useRef(new Animated.Value(0)).current;
  const pinAnims = useRef<Animated.Value[]>(
    nearbyPartners.map(() => new Animated.Value(0)),
  ).current;
  const joinedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    track('onboarding_step_view', { step: 'porch_partners' });

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

    // Continuous radar sweep
    Animated.loop(
      Animated.timing(radarSweep, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }),
    ).start();

    // Staggered partner pin entrance
    nearbyPartners.forEach((_, i) => {
      setTimeout(() => {
        Animated.spring(pinAnims[i], {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 10,
        }).start();
      }, 400 + i * 150);
    });
  }, []);

  const handleEnableLocation = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLocStatus('granted');
      return;
    }

    if (locStatus === 'denied') {
      Alert.alert(
        'Location turned off',
        'Open Settings to allow approximate location for Porchivo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }

    if (locStatus === 'granted') return;

    setRequesting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const Location = await import('expo-location');
      // Request foreground permissions — Android 12+ lets the user choose
      // "Approximate" (coarse) only. We do NOT request precise separately.
      const result = await Location.requestForegroundPermissionsAsync();
      const granted = result.status === 'granted';

      setLocStatus(granted ? 'granted' : result.canAskAgain ? 'undetermined' : 'denied');

      track(granted ? 'system_permission_granted' : 'system_permission_denied', {
        permission: 'location_coarse',
        platform: Platform.OS,
      });

      log('[TrackingPartners] Location permission:', result.status);

      if (granted) {
        // Get a coarse position — Low accuracy, NOT precise
        try {
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          log('[TrackingPartners] Coarse location obtained');
        } catch (e) {
          log('[TrackingPartners] Coarse position error (non-fatal):', e);
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (e) {
      log('[TrackingPartners] Location request error:', e);
      setLocStatus('undetermined');
    } finally {
      setRequesting(false);
    }
  }, [locStatus, track]);

  const handleJoin = useCallback(() => {
    if (!hasJoined) {
      setHasJoined(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(joinedAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 10,
      }).start();

      track('partner_joined', { source: 'onboarding', partner_count: nearbyPartners.length });

      // Update onboarding with location consent if granted
      const userId = session?.user?.id ?? user?.id;
      if (userId && locStatus === 'granted') {
        void completeOnboarding({
          hasLocationConsent: true,
          hasPreciseLocationConsent: false,
        }).catch((e) => log('[TrackingPartners] onboarding update error:', e));
      }
    }

    setTimeout(onContinue, 800);
  }, [hasJoined, track, nearbyPartners.length, onContinue, session, user, locStatus, completeOnboarding]);

  const handleSkip = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('partner_skipped', { source: 'onboarding' });
    track('onboarding_step_skipped', { step: 'porch_partners' });

    // Still record location consent if granted
    const userId = session?.user?.id ?? user?.id;
    if (userId && locStatus === 'granted') {
      void completeOnboarding({
        hasLocationConsent: true,
        hasPreciseLocationConsent: false,
      }).catch((e) => log('[TrackingPartners] onboarding update error:', e));
    }

    onSkip();
  }, [track, onSkip, session, user, locStatus, completeOnboarding]);

  // ── Radar sweep interpolation ───────────────────────────────────────
  const sweepRotate = radarSweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const RADAR_SIZE = 200;
  const RADAR_RADIUS = RADAR_SIZE / 2;

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
                s === 5 && styles.stepDotActive,
                s < 5 && styles.stepDotDone,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step 5 of 6</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.eyebrow}>PORCH PARTNERS</Text>
          <Text style={styles.title}>Your neighborhood, protected together</Text>
          <Text style={styles.subtitle}>
            Trusted neighbors can grab packages off your porch and hold them safely until you&apos;re home.
          </Text>
        </Animated.View>

        {/* Radar mini-map */}
        <Animated.View
          style={[
            styles.radarSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.radarContainer}>
            {/* Radar rings */}
            <View style={[styles.radarRing, { width: RADAR_SIZE, height: RADAR_SIZE, borderRadius: RADAR_RADIUS }]} />
            <View style={[styles.radarRing, { width: RADAR_SIZE * 0.66, height: RADAR_SIZE * 0.66, borderRadius: RADAR_RADIUS * 0.66 }]} />
            <View style={[styles.radarRing, { width: RADAR_SIZE * 0.33, height: RADAR_SIZE * 0.33, borderRadius: RADAR_RADIUS * 0.33 }]} />

            {/* Cross hairs */}
            <View style={[styles.radarCrossH, { width: RADAR_SIZE }]} />
            <View style={[styles.radarCrossV, { height: RADAR_SIZE }]} />

            {/* Sweep */}
            <Animated.View
              style={[
                styles.radarSweep,
                {
                  width: RADAR_RADIUS,
                  height: 2,
                  transform: [{ rotate: sweepRotate }],
                  transformOrigin: 'left center',
                },
              ]}
            />

            {/* Center pin (user) */}
            <View style={styles.userPin}>
              <MapPin size={18} color={palette.surface} strokeWidth={2.5} />
            </View>

            {/* Partner pins */}
            {nearbyPartners.map((partner, i) => {
              const x = RADAR_RADIUS + Math.cos(partner.angle) * partner.ringDist * RADAR_RADIUS;
              const y = RADAR_RADIUS + Math.sin(partner.angle) * partner.ringDist * RADAR_RADIUS;
              return (
                <Animated.View
                  key={partner.id}
                  style={[
                    styles.partnerPinWrap,
                    {
                      left: x - 16,
                      top: y - 16,
                      opacity: pinAnims[i],
                      transform: [
                        {
                          scale: pinAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.partnerPin}>
                    <Users size={12} color={palette.navy} strokeWidth={2.5} />
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* Location status */}
          {locStatus !== 'granted' ? (
            <TouchableOpacity
              style={[styles.locButton, requesting && styles.locButtonDisabled]}
              onPress={handleEnableLocation}
              disabled={requesting}
              activeOpacity={0.85}
              testID="btn-enable-location"
            >
              <Navigation size={16} color={palette.navy} strokeWidth={2.2} />
              <Text style={styles.locButtonText}>
                {requesting
                  ? 'Finding neighbors…'
                  : locStatus === 'denied'
                    ? 'Open Settings'
                    : 'Show neighbors near me'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.locGrantedRow}>
              <CheckCircle2 size={14} color={palette.sage} strokeWidth={2.2} />
              <Text style={styles.locGrantedText}>Approximate location on</Text>
            </View>
          )}
        </Animated.View>

        {/* Nearby partners list */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.sectionTitle}>
            {nearbyPartners.length} active neighbors nearby
          </Text>

          {nearbyPartners.map((partner, i) => (
            <Animated.View
              key={partner.id}
              style={[
                styles.partnerCard,
                {
                  opacity: pinAnims[i],
                  transform: [
                    {
                      translateY: pinAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.partnerAvatar}>
                <Text style={styles.partnerInitials}>
                  {partner.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={styles.partnerInfo}>
                <View style={styles.partnerNameRow}>
                  <Text style={styles.partnerName}>{partner.name}</Text>
                  {partner.isVolunteer ? (
                    <View style={styles.volunteerBadge}>
                      <Gift size={9} color={palette.sage} strokeWidth={2.5} />
                      <Text style={styles.volunteerBadgeText}>Free</Text>
                    </View>
                  ) : null}
                  <View style={styles.ratingBadge}>
                    <Star size={11} color={palette.gold ?? '#C8941E'} strokeWidth={2} fill="#C8941E" />
                    <Text style={styles.ratingText}>{partner.rating.toFixed(1)}</Text>
                  </View>
                </View>
                <View style={styles.partnerMetaRow}>
                  <MapPin size={11} color={palette.slate300} strokeWidth={2} />
                  <Text style={styles.partnerMeta}>{partner.street}</Text>
                  <Text style={styles.partnerDot}>·</Text>
                  <Text style={styles.partnerMeta}>{partner.distance} mi</Text>
                  <Text style={styles.partnerDot}>·</Text>
                  <Text style={styles.partnerMeta}>{partner.completedHolds} holds</Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        {/* Value props */}
        <View style={styles.valueProps}>
          <View style={styles.valuePropRow}>
            <View style={[styles.valuePropIcon, { backgroundColor: palette.sageSoft }]}>
              <ShieldCheck size={16} color={palette.sage} strokeWidth={2.2} />
            </View>
            <Text style={styles.valuePropText}>Packages held safely until you return</Text>
          </View>
          <View style={styles.valuePropRow}>
            <View style={[styles.valuePropIcon, { backgroundColor: palette.emberSoft }]}>
              <HandHeart size={16} color={palette.ember} strokeWidth={2.2} />
            </View>
            <Text style={styles.valuePropText}>Help neighbors protect their deliveries too</Text>
          </View>
        </View>

        {/* Joined confirmation */}
        {hasJoined ? (
          <Animated.View
            style={[
              styles.joinedBanner,
              {
                opacity: joinedAnim,
                transform: [
                  {
                    scale: joinedAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <CheckCircle2 size={20} color={palette.sage} strokeWidth={2.2} />
            <Text style={styles.joinedText}>You&apos;ve joined the neighborhood!</Text>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.ctaButton, hasJoined && styles.ctaButtonJoined]}
          onPress={handleJoin}
          disabled={requesting}
          activeOpacity={0.85}
          accessibilityLabel="Join my neighborhood"
          accessibilityRole="button"
          testID="btn-join-neighborhood"
        >
          {hasJoined ? (
            <CheckCircle2 size={20} color={palette.sage} strokeWidth={2.2} />
          ) : (
            <Users size={20} color={palette.surface} strokeWidth={2.2} />
          )}
          <Text style={[styles.ctaText, hasJoined && styles.ctaTextJoined]}>
            {hasJoined ? 'Joined!' : 'Join My Neighborhood'}
          </Text>
          {!hasJoined && <ArrowRight size={18} color={palette.surface} strokeWidth={2.5} />}
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

const RADAR_SIZE_STYLE = 200;

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
    paddingBottom: space.xl,
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
  // ── Radar ───────────────────────────────────────────────────────────
  radarSection: {
    alignItems: 'center',
    marginBottom: space.xxl,
  },
  radarContainer: {
    width: RADAR_SIZE_STYLE,
    height: RADAR_SIZE_STYLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: palette.slate200,
    borderStyle: 'dashed',
  },
  radarCrossH: {
    position: 'absolute',
    height: 1,
    backgroundColor: palette.slate200,
  },
  radarCrossV: {
    position: 'absolute',
    width: 1,
    backgroundColor: palette.slate200,
  },
  radarSweep: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    backgroundColor: palette.navy,
    opacity: 0.15,
    borderRadius: 2,
  },
  userPin: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised,
  },
  partnerPinWrap: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  partnerPin: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.navy,
    ...elevation.low,
  },
  // ── Location button ─────────────────────────────────────────────────
  locButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: palette.sky,
    paddingVertical: 12,
    paddingHorizontal: space.xxl,
    borderRadius: radius.pill,
  },
  locButtonDisabled: {
    opacity: 0.6,
  },
  locButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: palette.navy,
  },
  locGrantedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locGrantedText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.sage,
  },
  // ── Partner list ────────────────────────────────────────────────────
  sectionTitle: {
    ...ttype.headline,
    color: palette.ink,
    fontSize: 15,
    marginBottom: space.md,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    ...elevation.low,
  },
  partnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInitials: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: palette.surface,
    letterSpacing: 0.5,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  partnerName: {
    ...ttype.headline,
    color: palette.ink,
    fontSize: 15,
  },
  volunteerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.sageSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  volunteerBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: palette.sage,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.goldSoft ?? '#FFF8E6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#C8941E',
  },
  partnerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partnerMeta: {
    ...ttype.caption,
    color: palette.slate500,
    fontSize: 12,
  },
  partnerDot: {
    color: palette.slate300,
    fontSize: 12,
  },
  // ── Value props ─────────────────────────────────────────────────────
  valueProps: {
    gap: space.md,
    marginTop: space.lg,
    paddingHorizontal: space.xs,
  },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  valuePropIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePropText: {
    ...ttype.body,
    color: palette.slate700,
    fontSize: 14,
    flex: 1,
  },
  // ── Joined banner ───────────────────────────────────────────────────
  joinedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: palette.sageSoft,
    borderRadius: radius.md,
    paddingVertical: space.md,
    marginTop: space.lg,
  },
  joinedText: {
    ...ttype.headline,
    color: palette.sage,
    fontSize: 15,
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
  ctaButtonJoined: {
    backgroundColor: palette.sageSoft,
    elevation: 0,
    shadowOpacity: 0,
  },
  ctaText: {
    color: palette.surface,
    fontSize: 17,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  ctaTextJoined: {
    color: palette.sage,
  },
  skipText: {
    ...ttype.caption,
    color: palette.slate500,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
