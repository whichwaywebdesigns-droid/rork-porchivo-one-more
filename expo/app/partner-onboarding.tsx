import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import {
  ShieldCheck,
  BadgeDollarSign,
  UserCheck,
  Star,
  Banknote,
  ArrowRight,
  Package,
  CreditCard,
  CheckCircle,
} from 'lucide-react-native';
import { palette } from '@/constants/theme';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import {
  PARTNER_SHARE_PCT,
  calculateRate,
  getQuantityTier,
  PLATFORM_FEE_PCT,
} from '@/lib/partnerRates';
import type { PackageSize, GeoTier } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');

const HOW_IT_WORKS = [
  {
    step: '1',
    icon: UserCheck,
    color: Colors.primary,
    bg: Colors.skyBlue,
    title: 'Verify your identity',
    desc: 'A quick government ID + selfie check (takes ~2 min). Required to handle neighbours\u2019 packages for compensation.',
  },
  {
    step: '2',
    icon: CreditCard,
    color: '#7C3AED',
    bg: '#F5F3FF',
    title: 'Connect your payout account',
    desc: 'Link your bank via Stripe Connect. You keep 85\u2009% of every hold — Porchivo takes 15\u2009% to cover platform costs.',
  },
  {
    step: '3',
    icon: Package,
    color: Colors.secondary,
    bg: Colors.peach,
    title: 'Accept hold requests',
    desc: 'Homeowners near you send requests. Accept, pick up the package from their porch, and hold it securely.',
  },
  {
    step: '4',
    icon: Banknote,
    color: Colors.success,
    bg: Colors.successLight,
    title: 'Get paid automatically',
    desc: 'Once the homeowner confirms delivery, your earnings are transferred to your bank within 2 business days.',
  },
];

const TRUST_TIERS = [
  { tier: 'Basic', color: palette.slate500, desc: 'Unverified — free holds only' },
  { tier: 'ID Verified', color: Colors.primary, desc: 'Gov ID confirmed — can earn' },
  { tier: 'Trusted', color: Colors.success, desc: '20+ holds · 4.5★ avg rating' },
  { tier: 'Elite', color: palette.gold, desc: '50+ holds · 4.8★ avg rating' },
];

// ─── Payout Calculator ───────────────────────────────────────────────────────

const SIZE_OPTIONS: { id: PackageSize; label: string; emoji: string; desc: string }[] = [
  { id: 'small',  label: 'Small',  emoji: '📦', desc: 'Under 2 lbs' },
  { id: 'medium', label: 'Medium', emoji: '🗃️', desc: '2–15 lbs'   },
  { id: 'large',  label: 'Large',  emoji: '📫', desc: '15+ lbs'    },
];

const GEO_OPTIONS: { id: GeoTier; label: string; tag: string }[] = [
  { id: 'tier3', label: 'Standard',    tag: '' },
  { id: 'tier2', label: 'Large City',  tag: '+20%' },
  { id: 'tier1', label: 'Major Metro', tag: '+40%' },
];

function formatCurrency(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

function PayoutCalculator() {
  const [size, setSize] = useState<PackageSize>('medium');
  const [geo, setGeo] = useState<GeoTier>('tier3');
  const [weeklyCount, setWeeklyCount] = useState(3);

  // Animated counter
  const animatedEarn = useRef(new Animated.Value(0)).current;
  const [displayedEarnCents, setDisplayedEarnCents] = useState(0);
  const [displayedMonthlyCents, setDisplayedMonthlyCents] = useState(0);
  const listenerRef = useRef<string | null>(null);
  const prevEarn = useRef(0);

  // Size selector animated indicator
  const sizeIndicatorX = useRef(new Animated.Value(0)).current;
  const geoIndicatorX = useRef(new Animated.Value(0)).current;
  const bonusScale = useRef(new Animated.Value(0)).current;
  const bonusOpacity = useRef(new Animated.Value(0)).current;

  const sizeIndex = SIZE_OPTIONS.findIndex(s => s.id === size);
  const geoIndex  = GEO_OPTIONS.findIndex(g => g.id === geo);

  const calcEarnings = useCallback(() => {
    const cycleCount = weeklyCount; // approx 1 cycle/week for bonus tier
    return calculateRate(size, geo, cycleCount);
  }, [size, geo, weeklyCount]);

  // Animate number counter
  useEffect(() => {
    const breakdown = calcEarnings();
    const targetEarn  = breakdown.partnerEarnCents;
    const targetMonthly = Math.round(targetEarn * weeklyCount * 4.33);

    if (listenerRef.current) animatedEarn.removeListener(listenerRef.current);
    listenerRef.current = animatedEarn.addListener(({ value }) => {
      setDisplayedEarnCents(Math.round(value));
      const ratio = targetEarn > 0 ? value / targetEarn : 0;
      setDisplayedMonthlyCents(Math.round(ratio * targetMonthly));
    });

    Animated.timing(animatedEarn, {
      toValue: targetEarn,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    prevEarn.current = targetEarn;
    return () => { if (listenerRef.current) animatedEarn.removeListener(listenerRef.current); };
  }, [size, geo, weeklyCount]);

  // Animate size pill
  useEffect(() => {
    Animated.spring(sizeIndicatorX, {
      toValue: sizeIndex,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [sizeIndex]);

  // Animate geo pill
  useEffect(() => {
    Animated.spring(geoIndicatorX, {
      toValue: geoIndex,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [geoIndex]);

  // Quantity bonus pop-in
  const qTier = getQuantityTier(weeklyCount);
  const showBonus = qTier.bonusCentsPerPackage > 0;
  useEffect(() => {
    if (showBonus) {
      Animated.spring(bonusScale,   { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 12 }).start();
      Animated.timing(bonusOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(bonusScale,   { toValue: 0, duration: 160, useNativeDriver: true }).start();
      Animated.timing(bonusOpacity, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    }
  }, [showBonus]);

  const changeSize = (s: PackageSize) => {
    Haptics.selectionAsync();
    setSize(s);
  };
  const changeGeo = (g: GeoTier) => {
    Haptics.selectionAsync();
    setGeo(g);
  };
  const changeCount = (delta: number) => {
    const next = Math.max(1, Math.min(30, weeklyCount + delta));
    if (next !== weeklyCount) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setWeeklyCount(next);
    }
  };

  const breakdown = calcEarnings();
  const grossCents   = breakdown.grossCents;
  const feeCents     = breakdown.platformFeeCents;
  const earnCents    = breakdown.partnerEarnCents;
  const partnerPct   = grossCents > 0 ? (earnCents / grossCents) : 0;
  const annualCents  = Math.round(earnCents * weeklyCount * 52);

  const PILL_W = (SCREEN_W - 40 - 8) / 3; // 3-col pill width
  const GEO_W  = (SCREEN_W - 40 - 8) / 3;

  return (
    <View style={calcStyles.root}>

      {/* ── Size selector ── */}
      <Text style={calcStyles.label}>Package size</Text>
      <View style={calcStyles.pillRow}>
        {/* Sliding background */}
        <Animated.View
          style={[
            calcStyles.pillSlider,
            { width: PILL_W, transform: [{ translateX: Animated.multiply(sizeIndicatorX, PILL_W + 4) }] },
          ]}
        />
        {SIZE_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[calcStyles.pill, { width: PILL_W }]}
            onPress={() => changeSize(s.id)}
            activeOpacity={0.85}
          >
            <Text style={[calcStyles.pillEmoji]}>{s.emoji}</Text>
            <Text style={[calcStyles.pillLabel, size === s.id && calcStyles.pillLabelActive]}>{s.label}</Text>
            <Text style={[calcStyles.pillSub,   size === s.id && calcStyles.pillSubActive]}>{s.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Geo tier ── */}
      <Text style={[calcStyles.label, { marginTop: 18 }]}>Your market</Text>
      <View style={[calcStyles.pillRow, calcStyles.geoRow]}>
        <Animated.View
          style={[
            calcStyles.geoPillSlider,
            { width: GEO_W, transform: [{ translateX: Animated.multiply(geoIndicatorX, GEO_W + 4) }] },
          ]}
        />
        {GEO_OPTIONS.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[calcStyles.geoPill, { width: GEO_W }]}
            onPress={() => changeGeo(g.id)}
            activeOpacity={0.85}
          >
            <Text style={[calcStyles.geoPillLabel, geo === g.id && calcStyles.geoPillLabelActive]}>
              {g.label}
            </Text>
            {g.tag ? (
              <View style={calcStyles.geoTag}>
                <Text style={calcStyles.geoTagText}>{g.tag}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Volume stepper ── */}
      <Text style={[calcStyles.label, { marginTop: 18 }]}>Packages per week</Text>
      <View style={calcStyles.stepperRow}>
        <TouchableOpacity
          style={[calcStyles.stepBtn, weeklyCount <= 1 && calcStyles.stepBtnDisabled]}
          onPress={() => changeCount(-1)}
          activeOpacity={0.7}
        >
          <Text style={calcStyles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={calcStyles.stepDisplay}>
          <Text style={calcStyles.stepValue}>{weeklyCount}</Text>
          <Text style={calcStyles.stepUnit}>pkgs / wk</Text>
        </View>
        <TouchableOpacity
          style={[calcStyles.stepBtn, weeklyCount >= 30 && calcStyles.stepBtnDisabled]}
          onPress={() => changeCount(1)}
          activeOpacity={0.7}
        >
          <Text style={calcStyles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {/* Volume quick-picks */}
      <View style={calcStyles.quickPicks}>
        {[1, 3, 5, 10, 20].map(v => (
          <TouchableOpacity
            key={v}
            style={[calcStyles.quickChip, weeklyCount === v && calcStyles.quickChipActive]}
            onPress={() => { Haptics.selectionAsync(); setWeeklyCount(v); }}
            activeOpacity={0.8}
          >
            <Text style={[calcStyles.quickChipText, weeklyCount === v && calcStyles.quickChipTextActive]}>
              {v}×
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Live result card ── */}
      <View style={calcStyles.resultCard}>

        {/* Quantity bonus badge */}
        <Animated.View
          style={[
            calcStyles.bonusBadge,
            { opacity: bonusOpacity, transform: [{ scale: bonusScale }] },
          ]}
        >
          <Text style={calcStyles.bonusBadgeText}>
            🎉 Volume bonus +{formatCurrency(qTier.bonusCentsPerPackage)}/hold
          </Text>
        </Animated.View>

        {/* Per-hold earnings */}
        <View style={calcStyles.resultTop}>
          <View>
            <Text style={calcStyles.resultEyebrow}>YOUR CUT PER HOLD</Text>
            <Text style={calcStyles.resultEarn}>{formatCurrency(displayedEarnCents)}</Text>
          </View>
          <View style={calcStyles.resultRight}>
            <Text style={calcStyles.resultMonthlyLabel}>est. monthly</Text>
            <Text style={calcStyles.resultMonthly}>{formatCurrency(displayedMonthlyCents)}</Text>
            <Text style={calcStyles.resultAnnual}>{formatCurrency(annualCents)}/yr</Text>
          </View>
        </View>

        {/* Split bar */}
        <View style={calcStyles.splitSection}>
          <View style={calcStyles.splitBar}>
            <Animated.View
              style={[
                calcStyles.splitFill,
                { flex: partnerPct },
              ]}
            />
            <View style={[calcStyles.splitFee, { flex: 1 - partnerPct }]} />
          </View>
          <View style={calcStyles.splitLegend}>
            <View style={calcStyles.legendItem}>
              <View style={[calcStyles.legendDot, { backgroundColor: palette.sage }]} />
              <Text style={calcStyles.legendText}>You {PARTNER_SHARE_PCT}%  {formatCurrency(earnCents)}</Text>
            </View>
            <View style={calcStyles.legendItem}>
              <View style={[calcStyles.legendDot, { backgroundColor: palette.slate300 }]} />
              <Text style={calcStyles.legendText}>Fee {PLATFORM_FEE_PCT}%  {formatCurrency(feeCents)}</Text>
            </View>
          </View>
        </View>

        <Text style={calcStyles.resultGross}>
          Homeowner pays {formatCurrency(grossCents)} per hold
        </Text>
      </View>

    </View>
  );
}

const calcStyles = StyleSheet.create({
  root: {
    backgroundColor: '#F0F7FF',
    borderRadius: 20,
    padding: 18,
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: palette.slate500,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  // Size pill row
  pillRow: {
    flexDirection: 'row',
    backgroundColor: '#DDEAF8',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    position: 'relative' as const,
  },
  pillSlider: {
    position: 'absolute' as const,
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    shadowColor: palette.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  pill: {
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderRadius: 9,
    zIndex: 1,
  },
  pillEmoji: { fontSize: 18, marginBottom: 2 },
  pillLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: palette.slate500,
  },
  pillLabelActive: { color: palette.navy },
  pillSub: {
    fontSize: 10,
    color: palette.slate300,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  pillSubActive: { color: palette.slate500 },
  // Geo row
  geoRow: {},
  geoPillSlider: {
    position: 'absolute' as const,
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: palette.navy,
    borderRadius: 9,
    zIndex: 0,
  },
  geoPill: {
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderRadius: 9,
    zIndex: 1,
    gap: 3,
  },
  geoPillLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: palette.slate500,
  },
  geoPillLabelActive: { color: '#FFFFFF' },
  geoTag: {
    backgroundColor: 'rgba(30,156,106,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  geoTagText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: palette.sage,
  },
  // Volume stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'center',
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: {
    fontSize: 22,
    fontWeight: '300' as const,
    color: '#FFFFFF',
    lineHeight: 26,
  },
  stepDisplay: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  stepValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: palette.navy,
    letterSpacing: -0.5,
  },
  stepUnit: {
    fontSize: 11,
    color: palette.slate500,
    fontWeight: '600' as const,
    marginTop: -2,
  },
  // Quick picks
  quickPicks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#DDEAF8',
  },
  quickChipActive: { backgroundColor: palette.warmOrange },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: palette.slate500,
  },
  quickChipTextActive: { color: '#FFFFFF' },
  // Result card
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginTop: 18,
    shadowColor: palette.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  bonusBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  bonusBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#92600A',
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  resultEyebrow: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: palette.slate500,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  resultEarn: {
    fontSize: 40,
    fontWeight: '900' as const,
    color: palette.sage,
    letterSpacing: -1,
    lineHeight: 46,
  },
  resultRight: { alignItems: 'flex-end' as const },
  resultMonthlyLabel: {
    fontSize: 10,
    color: palette.slate300,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  resultMonthly: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: palette.navy,
    letterSpacing: -0.5,
  },
  resultAnnual: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: palette.slate500,
    marginTop: 2,
  },
  // Split bar
  splitSection: { gap: 8, marginBottom: 12 },
  splitBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#EBF0F8',
  },
  splitFill: {
    backgroundColor: palette.sage,
    borderRadius: 5,
  },
  splitFee: {
    backgroundColor: '#D8E4F0',
    borderRadius: 5,
  },
  splitLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: palette.slate500,
    fontWeight: '600' as const,
  },
  resultGross: {
    fontSize: 11,
    color: palette.slate300,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
});

function StepCard({
  step,
  icon: Icon,
  color,
  bg,
  title,
  desc,
}: (typeof HOW_IT_WORKS)[number]) {
  return (
    <View style={styles.stepCard}>
      <View style={[styles.stepIconWrap, { backgroundColor: bg }]}>
        <Icon size={22} color={color} />
      </View>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{step}</Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
}

export default function PartnerOnboardingScreen() {
  const router = useRouter();
  const { user } = useApp();
  const ctaScale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(ctaScale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const pressOut = () =>
    Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  if (!user) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Become a Paid Partner',
          headerStyle: { backgroundColor: palette.canvas },
          headerShadowVisible: false,
          headerTintColor: Colors.primary,
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroIconOuter}>
            <View style={styles.heroIconInner}>
              <BadgeDollarSign size={36} color={Colors.primary} />
            </View>
          </View>
          <Text style={styles.heroTitle}>Earn money protecting{'\n'}your neighbours' packages</Text>
          <Text style={styles.heroSubtitle}>
            Become a verified Porch Partner and get compensated for every hold you complete — all within the Porchivo network you already trust.
          </Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>$3–$25</Text>
              <Text style={styles.heroStatLabel}>per hold</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{PARTNER_SHARE_PCT}%</Text>
              <Text style={styles.heroStatLabel}>you keep</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>2 days</Text>
              <Text style={styles.heroStatLabel}>to payout</Text>
            </View>
          </View>
        </View>

        {/* ── How it works ── */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>HOW IT WORKS</Text>
          <Text style={styles.sectionTitle}>Four steps to your first payout</Text>
          {HOW_IT_WORKS.map((step) => (
            <StepCard key={step.step} {...step} />
          ))}
        </View>

        {/* ── Payout Calculator ── */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>EARNINGS CALCULATOR</Text>
          <Text style={styles.sectionTitle}>See exactly what you'll make</Text>
          <PayoutCalculator />
        </View>

        {/* ── Trust tiers ── */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>TRUST TIERS</Text>
          <Text style={styles.sectionTitle}>Build your reputation, unlock more</Text>
          <View style={styles.tiersCard}>
            {TRUST_TIERS.map((t, i) => (
              <View
                key={t.tier}
                style={[styles.tierRow, i < TRUST_TIERS.length - 1 && styles.tierRowBorder]}
              >
                <View style={[styles.tierBadge, { backgroundColor: `${t.color}18` }]}>
                  <Star size={12} color={t.color} fill={t.color} />
                  <Text style={[styles.tierBadgeText, { color: t.color }]}>{t.tier}</Text>
                </View>
                <Text style={styles.tierDesc}>{t.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Requirements ── */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>REQUIREMENTS</Text>
          <Text style={styles.sectionTitle}>What you need to get started</Text>
          {[
            'Be 18+ years old',
            'Live in a Porchivo-covered neighbourhood',
            'Valid government-issued ID (passport, driver\'s license, or national ID)',
            'A US bank account for payouts (via Stripe Connect)',
            'Smartphone with the Porchivo app',
          ].map((req) => (
            <View key={req} style={styles.reqRow}>
              <CheckCircle size={16} color={Colors.success} />
              <Text style={styles.reqText}>{req}</Text>
            </View>
          ))}
        </View>

        {/* ── CTA ── */}
        <View style={styles.ctaSection}>
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPressIn={pressIn}
              onPressOut={pressOut}
              onPress={() => router.push('/partner-verify' as any)}
              activeOpacity={1}
              testID="start-verification-btn"
            >
              <ShieldCheck size={20} color={Colors.white} />
              <Text style={styles.ctaText}>Start Identity Verification</Text>
              <ArrowRight size={18} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.ctaNote}>
            Takes about 2 minutes · Powered by Stripe Identity
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Hero
  hero: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  heroIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  heroIconInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: palette.ink,
    textAlign: 'center' as const,
    lineHeight: 31,
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 22,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.canvas,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: '100%',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  heroStatLabel: {
    fontSize: 11,
    color: Colors.slateLight,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.borderLight,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  sectionOverline: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: palette.ink,
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Step cards
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  stepIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  stepBody: { flex: 1 },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: palette.ink,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    color: Colors.slateLight,
    lineHeight: 19,
  },

  // Earnings table
  earningsTable: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.skyBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  earningsHeaderCell: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  earningsHeaderRight: { textAlign: 'right' as const },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  earningsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  earningsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: palette.ink,
  },
  earningsValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  earningsNote: {
    fontSize: 11,
    color: Colors.slateLighter,
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 16,
  },

  // Tiers
  tiersCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tierRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 100,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  tierDesc: {
    flex: 1,
    fontSize: 13,
    color: Colors.slateLight,
  },

  // Requirements
  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  reqText: {
    flex: 1,
    fontSize: 14,
    color: palette.slate700,
    lineHeight: 20,
  },

  // CTA
  ctaSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    alignItems: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: SCREEN_W - 40,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    textAlign: 'center' as const,
  },
  ctaNote: {
    fontSize: 12,
    color: Colors.slateLighter,
    marginTop: 12,
    textAlign: 'center' as const,
  },
});
