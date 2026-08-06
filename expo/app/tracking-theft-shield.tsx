import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
} from 'lucide-react-native';

import * as Haptics from 'expo-haptics';
import { palette, space, radius, type as ttype, elevation } from '@/constants/theme';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

interface TrackingTheftShieldProps {
  onContinue: () => void;
  onSkip: () => void;
}

interface RiskFactor {
  label: string;
  delta: number;
}

interface RiskScoreResponse {
  zip: string;
  score: number;
  level: string;
  factors: RiskFactor[];
  cached: boolean;
}

// ── Risk level helpers ──────────────────────────────────────────────────

type RiskColor = { primary: string; soft: string; text: string };

function getRiskStyle(score: number): { label: string; icon: React.ReactNode; colors: RiskColor } {
  if (score >= 65) {
    return {
      label: 'HIGH RISK',
      icon: <ShieldX size={28} color={palette.surface} strokeWidth={2.2} />,
      colors: { primary: palette.rose, soft: palette.roseSoft, text: palette.rose },
    };
  }
  if (score >= 35) {
    return {
      label: 'MODERATE RISK',
      icon: <ShieldAlert size={28} color={palette.surface} strokeWidth={2.2} />,
      colors: { primary: '#D97706', soft: '#FFF8EC', text: '#D97706' },
    };
  }
  return {
    label: 'LOW RISK',
    icon: <ShieldCheck size={28} color={palette.surface} strokeWidth={2.2} />,
    colors: { primary: palette.sage, soft: palette.sageSoft, text: palette.sage },
  };
}

function factorIcon(delta: number): React.ReactNode {
  if (delta > 5) return <TrendingUp size={14} color={palette.rose} strokeWidth={2.2} />;
  if (delta < -1) return <TrendingDown size={14} color={palette.sage} strokeWidth={2.2} />;
  return <Minus size={14} color={palette.slate300} strokeWidth={2.2} />;
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export default function TrackingTheftShieldScreen({
  onContinue,
  onSkip,
}: TrackingTheftShieldProps): React.ReactElement {
  const { track } = useAnalytics();
  const { session, user } = useApp();

  const [zipCode, setZipCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [, setRiskLevel] = useState<string>('');
  const [factors, setFactors] = useState<RiskFactor[]>([]);
  const [displayScore, setDisplayScore] = useState<number>(0);

  // ── Animations ──────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const gaugeAnim = useRef(new Animated.Value(0)).current;
  const factorsAnim = useRef(new Animated.Value(0)).current;
  const shieldPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    track('onboarding_step_view', { step: 'theft_shield' });
    track('theftshield_viewed');

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

    // Continuous shield pulse while waiting for score
    Animated.loop(
      Animated.sequence([
        Animated.timing(shieldPulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(shieldPulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // ── Fetch risk score from edge function ─────────────────────────────
  const handleFetchScore = useCallback(async () => {
    const cleanZip = zipCode.trim();
    if (!/^\d{5}$/.test(cleanZip)) {
      Alert.alert('Invalid ZIP', 'Please enter a valid 5-digit ZIP code.');
      return;
    }

    const userId = session?.user?.id ?? user?.id;
    if (!userId) {
      Alert.alert('Sign In Required', 'Please add a delivery first to create your account.');
      return;
    }

    setIsLoading(true);
    scoreAnim.setValue(0);
    setDisplayScore(0);
    gaugeAnim.setValue(0);
    factorsAnim.setValue(0);

    try {
      log('[TheftShield] Fetching risk score for ZIP:', cleanZip);
      const { data, error } = await supabase.functions.invoke<RiskScoreResponse>(
        'risk-score',
        { body: { zip: cleanZip } },
      );

      if (error) {
        log('[TheftShield] Edge function error:', error.message);
        Alert.alert('Error', 'Could not fetch risk score. Please try again.');
        setIsLoading(false);
        return;
      }

      if (!data || typeof data.score !== 'number') {
        Alert.alert('Error', 'Unexpected response from risk score service.');
        setIsLoading(false);
        return;
      }

      log('[TheftShield] Score:', data.score, 'Level:', data.level);

      // Set score data first
      setRiskScore(data.score);
      setRiskLevel(data.level);
      setFactors(data.factors ?? []);
      setIsLoading(false);

      void Haptics.notificationAsync(
        data.score >= 65
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );

      // Animate count-up: 600ms ease-out with listener for text display
      scoreAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
      Animated.timing(scoreAnim, {
        toValue: data.score,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        scoreAnim.removeAllListeners();
        setDisplayScore(data.score);
      });

      // Animate gauge ring fill
      Animated.timing(gaugeAnim, {
        toValue: data.score / 100,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      // Stagger factors appearance after score completes
      setTimeout(() => {
        Animated.spring(factorsAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 8,
        }).start();
      }, 650);
    } catch (err) {
      log('[TheftShield] Fetch error:', err);
      Alert.alert('Connection Error', 'Unable to reach the server. Check your internet connection.');
      setIsLoading(false);
    }
  }, [zipCode, session, user, scoreAnim, gaugeAnim, factorsAnim]);

  const handleContinue = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('onboarding_step_complete', { step: 'theft_shield', risk_score: riskScore ?? -1 });
    onContinue();
  }, [track, onContinue, riskScore]);

  const handleSkip = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('onboarding_step_skipped', { step: 'theft_shield' });
    onSkip();
  }, [track, onSkip]);

  // ── Derived display values ──────────────────────────────────────────
  const ringScale = shieldPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const ringOpacity = shieldPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.0, 0.0],
  });

  const currentStyle = riskScore !== null ? getRiskStyle(riskScore) : null;

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
                s === 3 && styles.stepDotActive,
                s < 3 && styles.stepDotDone,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>Step 3 of 6</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.eyebrow}>THEFT SHIELD</Text>
          <Text style={styles.title}>How safe is your porch?</Text>
          <Text style={styles.subtitle}>
            Enter your ZIP code to see your neighborhood's package theft risk score.
          </Text>
        </Animated.View>

        {/* ZIP input or score display */}
        {riskScore === null && !isLoading ? (
          <Animated.View
            style={[
              styles.inputCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.zipInputWrap}>
              <MapPin size={18} color={palette.navy} strokeWidth={2.2} />
              <TextInput
                style={styles.zipInput}
                value={zipCode}
                onChangeText={(text) => setZipCode(text.replace(/[^0-9]/g, '').slice(0, 5))}
                placeholder="Enter ZIP code"
                placeholderTextColor={palette.slate300}
                keyboardType="number-pad"
                maxLength={5}
                testID="input-zip-code"
              />
            </View>
            <TouchableOpacity
              style={[styles.scoreButton, zipCode.length !== 5 && styles.scoreButtonDisabled]}
              onPress={handleFetchScore}
              disabled={zipCode.length !== 5}
              activeOpacity={0.85}
              testID="btn-get-score"
            >
              <Text style={styles.scoreButtonText}>Get My Risk Score</Text>
              <ArrowRight size={18} color={palette.surface} strokeWidth={2.5} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Loading state */}
        {isLoading && (
          <View style={styles.loadingCard}>
            <View style={styles.shieldWrap}>
              <Animated.View
                style={[
                  styles.shieldRing,
                  {
                    opacity: ringOpacity,
                    transform: [{ scale: ringScale }],
                  },
                ]}
              />
              <View style={styles.shieldTile}>
                <ShieldCheck size={36} color={palette.navy} strokeWidth={2} />
              </View>
            </View>
            <Text style={styles.loadingText}>Analyzing your area...</Text>
            <Text style={styles.loadingHint}>
              Checking delivery density, theft reports, and timing patterns
            </Text>
          </View>
        )}

        {/* Score reveal */}
        {riskScore !== null && !isLoading && currentStyle ? (
          <>
            {/* Score gauge */}
            <View style={[styles.scoreGauge, { backgroundColor: currentStyle.colors.soft }]}>
              <View style={[styles.scoreShieldTile, { backgroundColor: currentStyle.colors.primary }]}>
                {currentStyle.icon}
              </View>
              <Text style={[styles.scoreNumber, { color: currentStyle.colors.text }]}>
                {displayScore}
              </Text>
              <Text style={styles.scoreOutOf}>out of 100</Text>
              <View style={[styles.levelBadge, { backgroundColor: currentStyle.colors.primary }]}>
                <Text style={styles.levelBadgeText}>{currentStyle.label}</Text>
              </View>
            </View>

            {/* Risk factors */}
            <Animated.View
              style={[
                styles.factorsSection,
                {
                  opacity: factorsAnim,
                  transform: [
                    {
                      translateY: factorsAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.factorsTitle}>What's driving your score</Text>
              {factors.map((factor, i) => (
                <View key={i} style={styles.factorRow}>
                  <View style={styles.factorIconWrap}>
                    {factorIcon(factor.delta)}
                  </View>
                  <Text style={styles.factorLabel}>{factor.label}</Text>
                  <Text
                    style={[
                      styles.factorDelta,
                      {
                        color:
                          factor.delta > 5
                            ? palette.rose
                            : factor.delta < -1
                              ? palette.sage
                              : palette.slate500,
                      },
                    ]}
                  >
                    {formatDelta(factor.delta)}
                  </Text>
                </View>
              ))}
            </Animated.View>
          </>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {riskScore !== null && !isLoading ? (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleContinue}
            activeOpacity={0.85}
            testID="btn-continue"
          >
            <Text style={styles.ctaText}>Continue</Text>
            <ArrowRight size={20} color={palette.surface} strokeWidth={2.5} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, styles.ctaButtonOutline]}
            onPress={handleSkip}
            activeOpacity={0.85}
            testID="btn-skip"
          >
            <Text style={[styles.ctaText, { color: palette.navy }]}>Skip for now</Text>
            <ChevronRight size={20} color={palette.navy} strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        {riskScore !== null && !isLoading && (
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
          >
            <Text style={styles.skipText}>Skip for now</Text>
            <ChevronRight size={14} color={palette.slate300} strokeWidth={2} />
          </TouchableOpacity>
        )}
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
  eyebrow: {
    ...ttype.overline,
    color: palette.ember,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: space.sm,
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
  // ── ZIP input card ──────────────────────────────────────────────────
  inputCard: {
    alignItems: 'center',
    gap: space.lg,
  },
  zipInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.slate200,
    paddingHorizontal: space.lg,
    width: '100%',
    gap: space.sm,
    ...elevation.low,
  },
  zipInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '700' as const,
    color: palette.ink,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  scoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: palette.navy,
    paddingVertical: 16,
    paddingHorizontal: space.xxxl,
    borderRadius: radius.pill,
    minWidth: 240,
    ...elevation.raised,
  },
  scoreButtonDisabled: {
    opacity: 0.4,
  },
  scoreButtonText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  // ── Loading state ───────────────────────────────────────────────────
  loadingCard: {
    alignItems: 'center',
    paddingVertical: space.xxxl + 20,
  },
  shieldWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xxl,
  },
  shieldRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2.5,
    borderColor: palette.navy,
  },
  shieldTile: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: palette.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...ttype.headline,
    color: palette.ink,
    fontSize: 18,
    marginBottom: space.xs,
  },
  loadingHint: {
    ...ttype.caption,
    color: palette.slate500,
    textAlign: 'center',
    paddingHorizontal: space.xxl,
    lineHeight: 20,
  },
  // ── Score gauge ─────────────────────────────────────────────────────
  scoreGauge: {
    alignItems: 'center',
    borderRadius: radius.xxl,
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xxl,
    marginBottom: space.xxl,
    ...elevation.low,
  },
  scoreShieldTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: '900' as const,
    letterSpacing: -2,
    lineHeight: 70,
  },
  scoreOutOf: {
    ...ttype.caption,
    color: palette.slate500,
    fontSize: 14,
    marginTop: space.xs,
    marginBottom: space.lg,
  },
  levelBadge: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
  },
  levelBadgeText: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
  },
  // ── Risk factors ────────────────────────────────────────────────────
  factorsSection: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.xxl,
    ...elevation.low,
  },
  factorsTitle: {
    ...ttype.headline,
    color: palette.ink,
    fontSize: 16,
    marginBottom: space.lg,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.slate100,
    gap: space.md,
  },
  factorIconWrap: {
    width: 24,
    alignItems: 'center',
  },
  factorLabel: {
    ...ttype.body,
    flex: 1,
    color: palette.slate700,
    fontSize: 14,
  },
  factorDelta: {
    fontSize: 15,
    fontWeight: '800' as const,
    fontFamily: 'monospace',
  },
  // ── Footer ──────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xxl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
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
  ctaButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: palette.navy,
    elevation: 0,
    shadowOpacity: 0,
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
