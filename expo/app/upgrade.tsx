import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Crown,
  ShieldCheck,
  Zap,
  Check,
  Infinity as InfinityIcon,
  Bell,
  Users,
  Music,
  Sparkles,
  Gift,
  BadgeCheck,
  Building2,
  FileText,
  HandCoins,
  MapPin,
  BarChart3,
  Headphones,
  Loader2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { palette, tabularNums } from '@/constants/theme';
import { useApp } from '@/store/AppContext';
import { usePaywall } from '@/store/PaywallContext';
import DarkRailHeader from '@/components/DarkRailHeader';
import RailBackButton from '@/components/RailBackButton';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useToast } from '@/hooks/useToast';
import {
  PLANS,
  Plan,
  SubscriptionTier,
  DISCOUNT_WINBACK_LABEL,
  DISCOUNT_WINBACK_PRICE,
  PaywallTrigger,
} from '@/lib/tiers';
import { ENTERPRISE_PLAN, PRICING } from '@/config/app';
import { useLivePrices } from '@/hooks/useLivePrices';

type TierTab = 'premium' | 'family' | 'enterprise';

// ── Revenue projection visible to founder in code comments ──────────────────
// ✅ CONFIRMED IN APP STORE CONNECT (June 2026 — all 175 territories):
// Premium:      $13.99/mo  |   $99.99/yr — Tier 14 / Tier 100
// Family:      $23.99/mo  |  $179.99/yr
// Enterprise:   $350/mo  |  $3,000/yr — HOA/community (up to 250 homes)
// Lifetime:    $500 one-time          — sacred number, Ahayah Ashar Ahayah
//
// ⚠️  7-day trial blocked until first App Review approval (Apple platform constraint)
// ⚠️  family_annual productId needs ASC product created before enabling
//
// Enterprise revenue target (conservative):
//    50 HOAs × $3,000/yr  =  $150,000/yr
//   100 HOAs × $3,000/yr  =  $300,000/yr
//   200 HOAs × $3,000/yr  =  $600,000/yr
//   100 HOAs × $350/mo    =  $420,000/yr (full monthly)
// ─────────────────────────────────────────────────────────────────────────────

const TOP_FEATURES = [
  { icon: ShieldCheck,  label: 'Theft Shield — real-time porch risk before every drop' },
  { icon: Zap,          label: 'Live tracking refreshed every 90 seconds' },
  { icon: Bell,         label: 'Out-for-delivery alert the moment it ships' },
] as const;

const PREMIUM_FEATURES = [
  { icon: InfinityIcon, label: 'Unlimited packages — every carrier, no cap' },
  { icon: ShieldCheck,  label: 'Theft Shield: risk-scored before every delivery' },
  { icon: Zap,          label: 'Live tracking every 90 seconds — not 10 minutes' },
  { icon: Bell,         label: 'Instant push: out-for-delivery and delivered' },
  { icon: FileText,     label: 'Tax invoicing — quarterly & annual PDFs ready to file' },
  { icon: Music,        label: 'Custom delivery chimes' },
  { icon: Sparkles,     label: 'Widgets and Live Activities (iOS)' },
  { icon: BadgeCheck,   label: 'Zero ads — clean and fast, always' },
] as const;

const FAMILY_EXTRAS = [
  { icon: Users,      label: 'Every household member protected — one price, 5 accounts' },
  { icon: Bell,       label: 'Shared theft alerts — anyone who sees it, everyone knows' },
  { icon: FileText,   label: 'One consolidated tax invoice for the whole household' },
  { icon: BadgeCheck, label: 'Priority support — skip the queue' },
] as const;

const ENTERPRISE_FEATURES = [
  { icon: Building2,  label: '250 homes under one subscription — $1.00/home/mo at annual' },
  { icon: MapPin,     label: 'Community-wide theft network — one alert reaches every resident' },
  { icon: Users,      label: 'Unlimited resident accounts — no per-seat charges, ever' },
  { icon: BarChart3,  label: 'HOA admin dashboard: delivery density, theft patterns, stats' },
  { icon: FileText,   label: 'Automated tax invoices — monthly, quarterly, annual PDFs' },
  { icon: Headphones, label: 'Dedicated 24/7 HOA support line — not a ticket queue' },
  { icon: BadgeCheck, label: 'White-glove board onboarding included at no extra cost' },
] as const;

const TRIGGER_COPY: Record<PaywallTrigger, { title: string; subtitle: string }> = {
  first_delivery: {
    title: 'Your porch needs this.',
    subtitle: '1 in 5 packages gets stolen. Porchivo subscribers get real-time risk scores, instant theft alerts, and live tracking on every delivery.',
  },
  package_limit: {
    title: 'Free tracking stops here.',
    subtitle: 'Porchivo protects serious porch owners. Upgrade to track every delivery, every carrier — with no cap.',
  },
  day7_hard: {
    title: 'Porchivo requires a subscription.',
    subtitle: 'Your free access has ended. Subscribers get full Theft Shield, live tracking, and tax invoicing.',
  },
  theft_shield: {
    title: 'Theft Shield is a paid feature.',
    subtitle: 'Real-time risk scores and theft alerts are exclusive to Porchivo subscribers. Your porch isn\'t protected until you upgrade.',
  },
  household: {
    title: 'One plan. Every household member.',
    subtitle: 'A single Family plan protects everyone under your roof — shared alerts, full Theft Shield, and consolidated tax invoicing.',
  },
  ups_amazon: {
    title: 'Unlock Hidden Carrier Features.',
    subtitle: 'OTP delivery verification, A-to-Z claim filing, UPS intercept, live driver tracking, and Access Points — carrier superpowers reserved for Porchivo subscribers.',
  },
  manual: {
    title: 'Protect what you\'re waiting for.',
    subtitle: 'Full Theft Shield, live tracking, and quarterly tax invoicing. Everything your porch needs.',
  },
};

const TAB_LABELS: Record<TierTab, string> = {
  premium: 'Premium',
  family: 'Family',
  enterprise: 'HOA',
};

export default function UpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium, isEntitled, tier, purchasePlan, restorePurchase } = useApp();
  const { onPaywallSuccess, onPaywallDismiss } = usePaywall();
  const { track } = useAnalytics();
  const toast = useToast();
  const params = useLocalSearchParams<{ trigger?: string }>();
  // PaywallContext always sets an explicit trigger in the URL params.
  // No screen-level isDay7HardPaywall fallback needed.
  const trigger: PaywallTrigger = (params.trigger as PaywallTrigger | undefined) ?? 'manual';

  const initialTab: TierTab = trigger === 'household' ? 'family' : 'premium';
  const [tab, setTab] = useState<TierTab>(initialTab);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    if (trigger === 'household') return 'family_annual';
    return 'premium_annual';
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showAllFeatures, setShowAllFeatures] = useState<boolean>(false);


  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const tabOrder: TierTab[] = ['premium', 'family', 'enterprise'];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    track('paywall_view', { trigger, isPremium });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate tab indicator
  useEffect(() => {
    const idx = tabOrder.indexOf(tab);
    Animated.spring(tabIndicatorAnim, {
      toValue: idx,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [tab]);

  const plansForTab: Plan[] = useMemo(() => {
    return PLANS.filter((p) => p.tier === tab);
  }, [tab]);

  const lifetime = useMemo(() => PLANS.find((p) => p.tier === 'lifetime')!, []);

  // Live, localized store prices. Falls back to config labels in preview/Expo Go.
  const { priceFor, perMonthFor, isLoading: pricesLoading } = useLivePrices();

  const handleSelectTab = useCallback((t: TierTab) => {
    Haptics.selectionAsync();
    setTab(t);
    if (t === 'premium') setSelectedPlanId('premium_annual');
    else if (t === 'family') setSelectedPlanId('family_annual');
    else setSelectedPlanId('enterprise_annual');
    setShowAllFeatures(false);
    track('paywall_tab_change', { tab: t });
  }, [track]);

  const handleSelectPlan = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedPlanId(id);
    track('paywall_plan_select', { planId: id });
  }, [track]);

  const handlePurchase = useCallback(async (planId: string) => {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    if (plan.hasFreeTrial) {
      track('trial_start', { planId: plan.id, tier: plan.tier, trialDays: plan.trialDays ?? 0 });
    }
    try {
      const ok = await purchasePlan(plan);
      setIsProcessing(false);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        track('purchase_success', { planId: plan.id, tier: plan.tier, period: plan.period, hasFreeTrial: !!plan.hasFreeTrial });
        const tierLabel =
          plan.tier === 'enterprise' ? 'Enterprise'
          : plan.tier === 'family' ? 'Family'
          : plan.tier === 'lifetime' ? 'Lifetime'
          : 'Premium';
        const msg = plan.hasFreeTrial
          ? `Your ${plan.trialDays}-day free trial has started. Welcome to Porchivo ${tierLabel}!`
          : `Welcome to Porchivo ${tierLabel}!`;
        Alert.alert("You're in!", msg, [{
          text: 'Awesome',
          onPress: () => {
            // Retrieve and clear the pending action before navigating back.
            // The 200 ms delay lets the back-transition initiate before the
            // resume action (typically another router.push) executes.
            const resumeAction = onPaywallSuccess();
            router.back();
            if (resumeAction) {
              setTimeout(resumeAction, 200);
            }
          },
        }]);
      }
    } catch (error: any) {
      setIsProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      track('purchase_fail', { planId: plan.id, message: error?.message ?? 'unknown' });
      toast.error(error?.message ?? 'Purchase failed. Something went wrong — please try again.');
    }
  }, [purchasePlan, router, track, toast]);

  const handleRestore = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsProcessing(true);
    track('restore_attempt');
    try {
      const restored = await restorePurchase();
      setIsProcessing(false);
      if (restored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        track('restore_success');
        toast.success('Your subscription has been restored.');
        const resumeAction = onPaywallSuccess();
        router.back();
        if (resumeAction) {
          setTimeout(resumeAction, 200);
        }
      } else {
        toast.info("No previous purchase found for this account.");
      }
    } catch (error: unknown) {
      setIsProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      track('restore_fail', { message: error instanceof Error ? error.message : 'unknown' });
      toast.error(error instanceof Error ? error.message : 'Restore failed. Please try again.');
    }
  }, [restorePurchase, router, track, onPaywallSuccess, toast]);

  // Guard against already-subscribed users landing on paywall.
  // isEntitled is backend-authoritative (falls back to RC SDK isPremium).
  if (isEntitled && tier !== 'free') {
    const tierLabel =
      tier === 'enterprise' ? 'Enterprise' :
      tier === 'lifetime' ? 'Lifetime unlocked' :
      tier === 'family' ? 'Family plan active' : "You're Premium!";
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DarkRailHeader status="PREMIUM" dotColor={palette.gold} />
        <View style={styles.topBar}>
          <RailBackButton onPress={() => { track('paywall_dismiss', { trigger, alreadyPremium: true }); onPaywallDismiss(); router.back(); }} testID="upgrade-back" />
        </View>
        <View style={styles.alreadyPremium}>
          <View style={styles.premiumBadgeLg}>
            <Crown size={32} color={palette.gold} />
          </View>
          <Text style={styles.alreadyTitle}>{tierLabel}</Text>
          <Text style={styles.alreadySub}>Thanks for supporting Porchivo.</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Back to App</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const copy = TRIGGER_COPY[trigger];
  const isEnterprise = tab === 'enterprise';

  // Tab indicator width — each tab is 1/3 of the bar
  const tabBarInnerWidth = 3; // relative units

  const currentFeatures =
    tab === 'enterprise' ? ENTERPRISE_FEATURES :
    tab === 'family' ? FAMILY_EXTRAS :
    TOP_FEATURES;

  const ctaLabel = (() => {
    if (isProcessing) return 'Processing...';
    const p = PLANS.find((x) => x.id === selectedPlanId);
    if (p?.hasFreeTrial) return `Start ${p.trialDays}-day trial — then ${p.tier === 'enterprise' ? 'HOA' : p.tier === 'family' ? 'Family' : 'Premium'}`;
    void priceFor;
    if (p?.tier === 'enterprise') return p.period === 'annual' ? 'Unlock Enterprise — Annual' : 'Unlock Enterprise — Monthly';
    if (p?.tier === 'family') return p.period === 'annual' ? 'Unlock Family — Annual' : 'Unlock Family — Monthly';
    if (p?.period === 'annual') return 'Unlock Porchivo — Annual';
    return 'Unlock Porchivo — Monthly';
  })();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <DarkRailHeader
        status={isEnterprise ? 'HOA · ENTERPRISE' : trigger === 'day7_hard' ? 'LIMITED OFFER' : 'PORCHIVO PRO'}
        dotColor={isEnterprise ? '#22C55E' : palette.gold}
      />
      <View style={styles.topBar}>
        <RailBackButton onPress={() => {
          track('paywall_dismiss', { trigger });
          // Always go back — PaywallContext handles session state.
          // No special-case for day7_hard: the module-level flag in PaywallContext
          // prevents re-firing once the session flag is set.
          onPaywallDismiss();
          router.back();
        }} testID="upgrade-back" />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.crownCircle, isEnterprise && styles.crownCircleEnterprise]}>
            {isEnterprise ? (
              <Building2 size={30} color="#22C55E" />
            ) : (
              <Crown size={32} color={palette.railAccent} />
            )}
          </View>

          <View style={[styles.kickerPill, isEnterprise && styles.kickerPillEnterprise]}>
            {isEnterprise ? (
              <Building2 size={11} color="#16A34A" />
            ) : (
              <Sparkles size={11} color={palette.gold} />
            )}
            <Text style={[styles.kickerText, isEnterprise && styles.kickerTextEnterprise]}>
              {isEnterprise ? 'Porchivo Enterprise — HOA & Property Mgmt' : 'Porchivo Pro'}
            </Text>
          </View>

          <Text style={styles.heroTitle}>{isEnterprise ? 'Protect Your Whole Community' : copy.title}</Text>
          <Text style={styles.heroSubtitle}>
            {isEnterprise
              ? '$1.00 per home per month (annual). One bill. 250 homes protected. Community theft network, Partner marketplace, and automated tax invoicing — built for HOA boards that mean business.'
              : copy.subtitle}
          </Text>

          {trigger === 'day7_hard' && !isEnterprise && (
            <View style={styles.discountBanner}>
              <Gift size={14} color={palette.railAccent} />
              <Text style={styles.discountText}>
                One-time offer: {DISCOUNT_WINBACK_LABEL} — {DISCOUNT_WINBACK_PRICE}
              </Text>
            </View>
          )}

          {/* Day-7 escape hatch: keeps free users from uninstalling when no trial is available */}
          {trigger === 'day7_hard' && !isEnterprise && (
            <TouchableOpacity
              style={styles.limitedFreeBtn}
              onPress={() => {
                track('paywall_dismiss', { trigger, method: 'limited_free' });
                onPaywallDismiss();
                router.back();
              }}
              activeOpacity={0.7}
              testID="btn-limited-free"
            >
              <Text style={styles.limitedFreeText}>Continue with limited free</Text>
              <Text style={styles.limitedFreeSub}>Track 1 package · 10-min refresh</Text>
            </TouchableOpacity>
          )}

          {isEnterprise && (
            <View style={styles.revenueRow}>
              <View style={styles.revenueStat}>
                <Text style={styles.revenueNum}>250</Text>
                <Text style={styles.revenueLabel}>homes covered</Text>
              </View>
              <View style={styles.revenueDivider} />
              <View style={styles.revenueStat}>
                <Text style={styles.revenueNum}>{ENTERPRISE_PLAN.annual.perMonthLabel.replace('/mo', '')}</Text>
                <Text style={styles.revenueLabel}>per month (annual)</Text>
              </View>
              <View style={styles.revenueDivider} />
              <View style={styles.revenueStat}>
                <Text style={styles.revenueNum}>14</Text>
                <Text style={styles.revenueLabel}>day free trial</Text>
              </View>
            </View>
          )}

          {!isEnterprise && tab === 'premium' && (
            <View style={styles.priceAnchorRow}>
              <Text style={styles.priceAnchorText}>
                <Text style={styles.priceAnchorHighlight}>{priceFor('premium_annual') ?? PRICING.annual.displayPrice}</Text>{' '}
                billed yearly · just{' '}
                <Text style={styles.priceAnchorHighlight}>{perMonthFor('premium_annual') ?? PRICING.annual.perMonthLabel}</Text>{' '}
                to protect every delivery
              </Text>
            </View>
          )}

          {!isEnterprise && (
            <View style={styles.socialProofRow}>
              <View style={styles.socialAvatarStack}>
                {['#3B7DD8', '#F97316', '#22C55E', '#A855F7'].map((c, i) => (
                  <View key={i} style={[styles.socialAvatar, { backgroundColor: c, marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }]} />
                ))}
              </View>
              <View style={styles.socialTextWrap}>
                <View style={styles.starsRow}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Text key={i} style={styles.starChar}>★</Text>
                  ))}
                </View>
                <Text style={styles.socialProofText}>119M packages stolen in the US last year</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── 3-Tab bar ── */}
        <View style={styles.tabBar}>
          {tabOrder.map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tabItem, active && styles.tabItemActive, t === 'enterprise' && styles.tabItemEnterprise, active && t === 'enterprise' && styles.tabItemEnterpriseActive]}
                onPress={() => handleSelectTab(t)}
                activeOpacity={0.8}
                testID={`tab-${t}`}
              >
                {t === 'enterprise' && <Building2 size={12} color={active ? '#16A34A' : Colors.slateLight} />}
                {t === 'family' && <Users size={12} color={active ? palette.railAccent : Colors.slateLight} />}
                {t === 'premium' && <Crown size={12} color={active ? palette.railAccent : Colors.slateLight} />}
                <Text style={[styles.tabText, active && styles.tabTextActive, active && t === 'enterprise' && styles.tabTextEnterprise]}>
                  {TAB_LABELS[t]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.autoRenewLabel}>
          <Text style={styles.autoRenewLabelText}>AUTO-RENEWABLE SUBSCRIPTION</Text>
        </View>

        {/* ── Plan cards ── */}
        <View style={styles.plansWrap}>
          {plansForTab.map((plan) => {
            const selected = selectedPlanId === plan.id;
            const isAnnual = plan.period === 'annual';
            const accentColor = isEnterprise ? '#16A34A' : palette.gold;
            const selectedBg = isEnterprise ? '#F0FDF4' : '#FFFBF1';
            const selectedBorder = isEnterprise ? '#16A34A' : palette.railAccent;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  selected && [styles.planCardSelected, { borderColor: selectedBorder, backgroundColor: selectedBg, shadowColor: selectedBorder }],
                  isAnnual && styles.planCardAnnual,
                ]}
                onPress={() => handleSelectPlan(plan.id)}
                activeOpacity={0.85}
                testID={`plan-${plan.id}`}
              >
                {isAnnual && (
                  <View style={[styles.popularBadge, { backgroundColor: accentColor }]}>
                    <Text style={styles.popularBadgeText}>
                      {plan.hasFreeTrial ? `${plan.trialDays}-DAY FREE TRIAL` : 'BEST VALUE'}
                    </Text>
                  </View>
                )}
                <View style={styles.planRow}>
                  <View style={styles.planLeft}>
                    <Text style={styles.planTitle}>
                      {plan.period === 'annual' ? 'Annual' : 'Monthly'}
                    </Text>
                    {plan.pricePerMonthLabel && isAnnual ? (
                      <Text style={styles.planSub}>{(perMonthFor(plan.id) ?? plan.pricePerMonthLabel)} billed yearly</Text>
                    ) : (
                      <Text style={styles.planSub}>{plan.priceSubLabel}</Text>
                    )}
                  </View>
                  <View style={styles.planRight}>
                    <Text style={[styles.planPrice, tabularNums]}>{priceFor(plan.id) ?? plan.priceLabel}</Text>
                    {plan.savingsLabel && (
                      <View style={[styles.savingsPill, isEnterprise && styles.savingsPillEnterprise]}>
                        <Text style={[styles.savingsText, isEnterprise && styles.savingsTextEnterprise]}>{plan.savingsLabel}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.radio, selected && { borderColor: selectedBorder }]}>
                    {selected && <View style={[styles.radioDot, { backgroundColor: selectedBorder }]} />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Feature list ── */}
        <View style={[styles.featuresBlock, isEnterprise && styles.featuresBlockEnterprise]}>
          {currentFeatures.map((f, i) => {
            const Icon = f.icon;
            const iconColor = isEnterprise ? '#16A34A' : Colors.primary;
            const iconBg = isEnterprise ? '#DCFCE7' : Colors.skyBlue;
            return (
              <View key={i} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: iconBg }]}>
                  <Icon size={14} color={iconColor} />
                </View>
                <Text style={[styles.featureLabel, { color: Colors.slate }]}>{f.label}</Text>
                <Check size={14} color={isEnterprise ? '#16A34A' : Colors.success} />
              </View>
            );
          })}
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity
          style={[styles.ctaBtn, isEnterprise && styles.ctaBtnEnterprise, (isProcessing || pricesLoading) && styles.ctaBtnDisabled]}
          onPress={() => handlePurchase(selectedPlanId)}
          disabled={isProcessing || pricesLoading}
          activeOpacity={0.9}
          testID="cta-purchase"
        >
          {pricesLoading ? (
            <Loader2 size={18} color={palette.railAccent} />
          ) : isEnterprise ? (
            <Building2 size={18} color="#fff" />
          ) : (
            <Crown size={18} color={palette.railAccent} />
          )}
          <Text style={[styles.ctaText, isEnterprise && styles.ctaTextEnterprise]}>
            {pricesLoading ? 'Loading prices...' : ctaLabel}
          </Text>
        </TouchableOpacity>

        {/* ── Expand full features (premium only) ── */}
        {tab === 'premium' && (
          <TouchableOpacity
            style={styles.expandRow}
            onPress={() => { Haptics.selectionAsync(); setShowAllFeatures((v) => !v); }}
            activeOpacity={0.7}
            testID="toggle-all-features"
          >
            <Text style={styles.expandText}>{showAllFeatures ? 'Hide full feature list' : 'See all Premium features'}</Text>
          </TouchableOpacity>
        )}

        {tab === 'premium' && showAllFeatures && (
          <View style={styles.allFeaturesBlock}>
            {PREMIUM_FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <View key={`all-${i}`} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Icon size={14} color={Colors.primary} />
                  </View>
                  <Text style={[styles.featureLabel, { color: Colors.slate }]}>{f.label}</Text>
                  <Check size={14} color={Colors.success} />
                </View>
              );
            })}
          </View>
        )}

        {/* ── Cross-sell links ── */}
        {tab === 'premium' && (
          <View style={styles.upsellRow}>
            <TouchableOpacity style={styles.upsellLink} onPress={() => handleSelectTab('family')} activeOpacity={0.7} testID="household-link">
              <Users size={13} color={Colors.primary} />
              <Text style={styles.upsellLinkText}>Sharing with family? → Family plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.upsellLink} onPress={() => handleSelectTab('enterprise')} activeOpacity={0.7} testID="enterprise-link">
              <Building2 size={13} color="#16A34A" />
              <Text style={[styles.upsellLinkText, { color: '#16A34A' }]}>Running an HOA? → Enterprise plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'family' && (
          <TouchableOpacity style={styles.upsellLink} onPress={() => handleSelectTab('premium')} activeOpacity={0.7} testID="family-back-to-premium">
            <Text style={styles.upsellLinkText}>Solo user? → Premium plan</Text>
          </TouchableOpacity>
        )}

        {tab === 'enterprise' && (
          <View style={styles.enterpriseNote}>
            <Text style={styles.enterpriseNoteText}>
              Need a custom quote for more than 250 homes or multiple properties? Email{' '}
              <Text style={styles.enterpriseNoteEmail}>enterprise@porchivo.com</Text>
            </Text>
          </View>
        )}

        {/* ── Cancel note ── */}
        <Text style={styles.cancelNote}>
          {(() => {
            const p = PLANS.find((x) => x.id === selectedPlanId);
            if (!p) return 'Billed through your app store account. Manage anytime in settings.';
            if (p.hasFreeTrial) {
              return `${p.trialDays}-day trial. Charged ${p.priceLabel}/${p.period === 'annual' ? 'year' : 'month'} after trial ends. Auto-renews. Cancel in settings before trial ends to avoid charge.`;
            }
            if (p.period === 'lifetime') return 'One-time purchase. Yours forever — no recurring charges.';
            return `${p.priceLabel} billed ${p.period === 'annual' ? 'annually' : 'monthly'}. Auto-renews. Manage or cancel anytime in your device settings.`;
          })()}
        </Text>

        {/* ── Lifetime (premium only) ── */}
        {/* ── Lifetime card (always visible on Premium tab) ── */}
        {tab === 'premium' && (
          <View style={styles.lifetimeCard}>
            <View style={styles.lifetimeHeader}>
              <View style={styles.lifetimeIconWrap}>
                <InfinityIcon size={18} color={palette.gold} />
              </View>
              <View style={styles.lifetimeText}>
                <Text style={styles.lifetimeTitle}>Lifetime unlock</Text>
                <Text style={styles.lifetimeSub}>Pay once, use forever. No subscription.</Text>
              </View>
              <Text style={[styles.lifetimePrice, tabularNums]}>{priceFor(lifetime.id) ?? lifetime.priceLabel}</Text>
            </View>
            <TouchableOpacity
              style={styles.lifetimeBtn}
              onPress={() => handlePurchase(lifetime.id)}
              disabled={isProcessing || pricesLoading}
              activeOpacity={0.85}
              testID="cta-lifetime"
            >
              <Text style={styles.lifetimeBtnText}>Get Lifetime Access</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={isProcessing} activeOpacity={0.7}>
          <Text style={styles.restoreBtnText}>Restore Purchase</Text>
        </TouchableOpacity>

        <Text style={styles.legalText}>
          {Platform.OS === 'android'
            ? 'Payment will be charged to your Google Play account. Subscriptions auto-renew unless canceled 24h before the end of the period. Manage in Google Play > Payments & subscriptions.'
            : Platform.OS === 'ios'
              ? 'Payment will be charged to your Apple ID. Subscriptions auto-renew unless canceled 24h before the end of the period. Manage in Settings > Apple ID > Subscriptions.'
              : 'Subscriptions auto-renew unless canceled 24h before the end of the period. Manage in your device settings.'}
        </Text>

        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => router.push('/privacy-policy' as any)} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/terms-of-service' as any)} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.railBg,
    borderWidth: 1,
    borderColor: palette.railAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: palette.railBg,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  crownCircleEnterprise: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  kickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  kickerPillEnterprise: {
    backgroundColor: '#DCFCE7',
  },
  kickerText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  kickerTextEnterprise: {
    color: '#16A34A',
    textTransform: 'none' as const,
    letterSpacing: 0,
    fontSize: 12,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    color: Colors.slate,
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  priceAnchorRow: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  priceAnchorText: {
    fontSize: 13,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 18,
  },
  priceAnchorHighlight: {
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  discountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.railBg,
    borderWidth: 1,
    borderColor: palette.railBorderSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 14,
  },
  discountText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: palette.railAccent,
    letterSpacing: 0.4,
  },
  limitedFreeBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  limitedFreeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.slate,
  },
  limitedFreeSub: {
    fontSize: 11,
    color: Colors.slateLight,
    marginTop: 1,
  },

  // Revenue stats (enterprise)
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 0,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  revenueStat: {
    flex: 1,
    alignItems: 'center',
  },
  revenueNum: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#16A34A',
    letterSpacing: -0.5,
  },
  revenueLabel: {
    fontSize: 10,
    color: '#4ADE80',
    fontWeight: '600' as const,
    marginTop: 2,
    textAlign: 'center',
  },
  revenueDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#BBF7D0',
  },
  socialProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  socialAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  socialTextWrap: { gap: 2 },
  starsRow: { flexDirection: 'row', gap: 1 },
  starChar: { color: palette.gold, fontSize: 11 },
  socialProofText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.slateLight,
  },

  // 3-tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: palette.railBg,
  },
  tabItemEnterprise: {},
  tabItemEnterpriseActive: {
    backgroundColor: '#166534',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slateLight,
  },
  tabTextActive: {
    color: Colors.white,
  },
  tabTextEnterprise: {
    color: '#fff',
  },

  autoRenewLabel: {
    alignItems: 'center',
    marginBottom: 8,
  },
  autoRenewLabelText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.slateLighter,
    letterSpacing: 0.8,
  },

  // Plan cards
  plansWrap: {
    gap: 10,
    marginBottom: 20,
  },
  planCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    padding: 16,
    backgroundColor: Colors.white,
  },
  planCardSelected: {
    borderWidth: 2,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  planCardAnnual: {
    paddingTop: 20,
  },
  popularBadge: {
    position: 'absolute' as const,
    top: -9,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planLeft: { flex: 1 },
  planTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.slate,
  },
  planSub: {
    fontSize: 12,
    color: Colors.slateLight,
    marginTop: 2,
  },
  planRight: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.slate,
  },
  savingsPill: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  savingsPillEnterprise: {
    backgroundColor: '#DCFCE7',
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  savingsTextEnterprise: {
    color: '#16A34A',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Features
  featuresBlock: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
  },
  featuresBlockEnterprise: {
    backgroundColor: '#F0FDF4',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  featureIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.slate,
  },
  expandRow: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  allFeaturesBlock: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 8,
  },

  // CTA
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.railBg,
    borderRadius: 999,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: palette.railBorderSoft,
    shadowColor: palette.railBg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtnEnterprise: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
    shadowColor: '#16A34A',
  },
  ctaBtnDisabled: { opacity: 0.7 },
  ctaSpinner: {
    marginRight: 6,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: '#F2EDE3',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  ctaTextEnterprise: {
    color: '#fff',
  },

  // Cross-sell
  upsellRow: {
    gap: 4,
    marginTop: 4,
  },
  upsellLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  upsellLinkText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },

  // Enterprise contact note
  enterpriseNote: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  enterpriseNoteText: {
    fontSize: 12,
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 18,
  },
  enterpriseNoteEmail: {
    fontWeight: '700' as const,
    textDecorationLine: 'underline' as const,
  },

  cancelNote: {
    fontSize: 12,
    color: Colors.slateLight,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },

  // Lifetime
  lifetimeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  lifetimeToggleText: {
    fontSize: 13,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  lifetimeCard: {
    backgroundColor: palette.goldSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F4E2A8',
  },
  lifetimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  lifetimeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifetimeText: { flex: 1 },
  lifetimeTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: palette.gold,
  },
  lifetimeSub: {
    fontSize: 12,
    color: palette.gold,
    marginTop: 1,
  },
  lifetimePrice: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: palette.gold,
  },
  lifetimeBtn: {
    backgroundColor: palette.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  lifetimeBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },

  // Restore / Legal
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  restoreBtnText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  legalText: {
    fontSize: 11,
    color: Colors.slateLighter,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  legalLink: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  legalDot: {
    color: Colors.slateLighter,
  },

  // Already premium
  alreadyPremium: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  premiumBadgeLg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  alreadyTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.slate,
    marginBottom: 8,
  },
  alreadySub: {
    fontSize: 15,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
