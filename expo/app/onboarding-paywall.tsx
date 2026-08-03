import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Infinity as InfinityIcon,
  ScrollText,
  Workflow,
  Headphones,
  ShieldCheck,
  Lock,
  ReceiptText,
  Users,
  Building2,
  LayoutDashboard,
  ReceiptText as InvoiceIcon,
  BellRing,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useOnboardingFlow } from '@/store/OnboardingFlowContext';
import { paywallSubcopy } from '@/config/onboardingExperiments';
import { useExperiments } from '@/store/ExperimentsContext';
import { onboardingPlansForRole } from '@/lib/tiers';
import type { Plan, SubscriptionTier } from '@/lib/tiers';
import { useLivePrices } from '@/hooks/useLivePrices';
import {
  OnboardingScreen,
  PricingCard,
  PrimaryCTA,
  SecondaryAction,
  FadeSlideIn,
} from '@/components/onboarding';

type PlanKey = 'annual' | 'monthly';

interface TierContent {
  badge: string;
  headline: string;
  benefits: { label: string; icon: React.ReactElement }[];
}

/** Per-tier paywall framing. The routed tier decides which set the user sees. */
const TIER_CONTENT: Record<SubscriptionTier, TierContent> = {
  premium: {
    badge: 'PORCHIVO PRO',
    headline: 'Unlock Pro for full delivery visibility.',
    benefits: [
      { label: 'Unlimited package tracking', icon: <InfinityIcon size={18} /> },
      { label: 'Advanced delivery logs', icon: <ScrollText size={18} /> },
      { label: 'Out-for-delivery alerts', icon: <BellRing size={18} /> },
      { label: 'Theft shield & risk scores', icon: <ShieldCheck size={18} /> },
    ],
  },
  family: {
    badge: 'PORCHIVO FAMILY',
    headline: 'Cover your whole household with one plan.',
    benefits: [
      { label: 'Everything in Pro', icon: <InfinityIcon size={18} /> },
      { label: 'Up to 5 household members', icon: <Users size={18} /> },
      { label: 'Shared delivery handoffs', icon: <Workflow size={18} /> },
      { label: 'Tax-ready delivery invoicing', icon: <InvoiceIcon size={18} /> },
    ],
  },
  enterprise: {
    badge: 'PORCHIVO FOR BUILDINGS',
    headline: 'Run delivery operations for your whole building.',
    benefits: [
      { label: 'Coverage for up to 250 homes', icon: <Building2 size={18} /> },
      { label: 'Community operations dashboard', icon: <LayoutDashboard size={18} /> },
      { label: 'Team & front-desk workflows', icon: <Workflow size={18} /> },
      { label: 'Priority support', icon: <Headphones size={18} /> },
    ],
  },
  lifetime: {
    badge: 'PORCHIVO PRO',
    headline: 'Unlock Pro for full delivery visibility.',
    benefits: [
      { label: 'Unlimited package tracking', icon: <InfinityIcon size={18} /> },
      { label: 'Advanced delivery logs', icon: <ScrollText size={18} /> },
      { label: 'Out-for-delivery alerts', icon: <BellRing size={18} /> },
      { label: 'Theft shield & risk scores', icon: <ShieldCheck size={18} /> },
    ],
  },
  free: {
    badge: 'PORCHIVO PRO',
    headline: 'Unlock Pro for full delivery visibility.',
    benefits: [
      { label: 'Unlimited package tracking', icon: <InfinityIcon size={18} /> },
      { label: 'Advanced delivery logs', icon: <ScrollText size={18} /> },
      { label: 'Out-for-delivery alerts', icon: <BellRing size={18} /> },
      { label: 'Theft shield & risk scores', icon: <ShieldCheck size={18} /> },
    ],
  },
};

const TRUST = [
  { label: 'Cancel anytime', icon: <ShieldCheck size={14} /> },
  { label: 'Secure checkout', icon: <Lock size={14} /> },
  { label: 'Clear billing terms', icon: <ReceiptText size={14} /> },
];

export default function OnboardingPaywallScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { track } = useAnalytics();
  const { purchasePlan } = useApp();
  const { role, painPoint } = useOnboardingFlow();
  const { paywall } = useExperiments().experiment;
  // Live store prices (localized per region/currency). Falls back to config
  // display labels in Expo Go / web preview where the SDK is unavailable.
  const { priceFor, perMonthFor } = useLivePrices();

  // Route the paywall to the tier that fits the user's role (config/app.ts §11).
  const planSet = onboardingPlansForRole(role);
  const tierContent = TIER_CONTENT[planSet.tier];
  const plans: Record<PlanKey, Plan> = { annual: planSet.annual, monthly: planSet.monthly };

  const [selected, setSelected] = useState<PlanKey>(planSet.emphasized);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const goToApp = () => router.replace('/(tabs)/(home)' as any);

  const handlePurchase = async () => {
    if (purchasing) return;
    setError(null);
    setPurchasing(true);
    track('paywall_plan_select', {
      plan: selected,
      tier: planSet.tier,
      role: role ?? 'unknown',
      source: 'onboarding',
    });
    try {
      const plan = plans[selected];
      const success = await purchasePlan(plan);
      if (success) {
        track('purchase_success', { plan: selected, tier: planSet.tier });
        goToApp();
        return;
      }
      track('purchase_fail', { plan: selected, tier: planSet.tier });
      setError('Purchase did not complete. You can try again or continue for now.');
    } catch {
      // In preview / non-production builds in-app purchases are unavailable.
      setError('Purchases aren’t available in this build. You can continue with free access.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleContinueFree = () => {
    track('paywall_dismiss', { source: 'onboarding', via: 'free_continue' });
    goToApp();
  };

  // CTA model follows whether the routed annual plan actually offers a trial.
  const annualHasTrial = planSet.annual.hasFreeTrial === true;
  const annualPrice = priceFor(planSet.annual.id) ?? planSet.annual.priceLabel;
  const ctaLabel = annualHasTrial ? 'Start free trial' : 'Continue with Pro';
  const trialNote = annualHasTrial
    ? `${planSet.annual.trialDays}-day free trial, then ${annualPrice}/yr. Cancel anytime.`
    : 'Billed through the App Store. Cancel anytime.';

  const renderPlan = (key: PlanKey) => {
    const isAnnual = key === 'annual';
    const plan = plans[key];
    const emphasized = planSet.emphasized === key;
    // Prefer the real, localized store price; fall back to the config label.
    const livePrice = priceFor(plan.id) ?? plan.priceLabel;
    const livePerMonth = isAnnual
      ? (perMonthFor(plan.id) ?? plan.pricePerMonthLabel ?? '')
      : '';
    return (
      <PricingCard
        key={key}
        title={isAnnual ? 'Annual' : 'Monthly'}
        price={livePrice}
        cadence={isAnnual ? 'per year' : 'per month'}
        detail={
          isAnnual
            ? `${livePerMonth} · billed annually`.trim()
            : 'Billed monthly'
        }
        badge={isAnnual ? plan.savingsLabel : undefined}
        selected={selected === key}
        emphasized={emphasized}
        onPress={() => setSelected(key)}
        testID={`plan-${key}`}
      />
    );
  };

  return (
    <OnboardingScreen
      footer={
        <>
          <PrimaryCTA
            label={ctaLabel}
            onPress={handlePurchase}
            loading={purchasing}
            showArrow={false}
            testID="paywall-cta"
          />
          <Text style={[styles.trialNote, { color: Colors.slateLighter }]}>{trialNote}</Text>
          {paywall.allowFreeContinue ? (
            <SecondaryAction
              label="Continue with limited free access"
              onPress={handleContinueFree}
              testID="paywall-continue-free"
            />
          ) : null}
        </>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeSlideIn>
          <View style={[styles.proBadge, { backgroundColor: Colors.skyBlue }]}>
            <Text style={[styles.proBadgeText, { color: Colors.primary }]}>{tierContent.badge}</Text>
          </View>
          <Text style={[styles.title, { color: Colors.slate }]}>
            {planSet.tier === 'premium' ? paywall.headline : tierContent.headline}
          </Text>
          <Text style={[styles.subtitle, { color: Colors.slateLight }]}>
            {paywallSubcopy(role, painPoint)}
          </Text>
        </FadeSlideIn>

        <FadeSlideIn delay={120}>
          <View
            style={[
              styles.benefitsCard,
              { backgroundColor: Colors.surface, borderColor: Colors.border, shadowColor: Colors.cardShadow },
            ]}
          >
            {tierContent.benefits.map((b, i) => (
              <View
                key={b.label}
                style={[
                  styles.benefitRow,
                  i < tierContent.benefits.length - 1 && { borderBottomColor: Colors.border, borderBottomWidth: 1 },
                ]}
              >
                <View style={[styles.benefitIcon, { backgroundColor: Colors.skyBlue }]}>
                  {React.cloneElement(b.icon as React.ReactElement<{ color?: string }>, {
                    color: Colors.primary,
                  })}
                </View>
                <Text style={[styles.benefitLabel, { color: Colors.slate }]}>{b.label}</Text>
              </View>
            ))}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={200}>
          <View style={styles.plans}>{(['annual', 'monthly'] as PlanKey[]).map(renderPlan)}</View>
        </FadeSlideIn>

        {error ? (
          <Text style={[styles.error, { color: Colors.slateLight }]}>{error}</Text>
        ) : null}

        <FadeSlideIn delay={260}>
          <View style={styles.trustRow}>
            {TRUST.map((t) => (
              <View key={t.label} style={styles.trustItem}>
                {React.cloneElement(t.icon as React.ReactElement<{ color?: string }>, {
                  color: Colors.success,
                })}
                <Text style={[styles.trustText, { color: Colors.slateLight }]}>{t.label}</Text>
              </View>
            ))}
          </View>
        </FadeSlideIn>
      </ScrollView>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  proBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 14,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 22,
    marginBottom: 22,
  },
  benefitsCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  plans: {
    gap: 12,
  },
  trialNote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 14,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 20,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
