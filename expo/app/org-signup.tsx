/**
 * OrgSignupScreen — B2B community signup with Stripe Checkout
 *
 * 3-step flow for HOA board members / property managers:
 * 1. Organization details (name, type, address, units)
 * 2. Plan selection (Starter / Community / Professional / Enterprise)
 * 3. Stripe Checkout (in-app browser) → success confirmation
 *
 * Residents never see this screen. It's linked from:
 *   - Profile > "Create Your Community" (for free-tier users)
 *   - Join Community > "Claim" tab
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { getLocales } from 'expo-localization';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Users,
  Zap,
  Shield,
  CreditCard,
  Sparkles,
  ArrowRight,
  Copy,
  Share2,
  Lock,
} from 'lucide-react-native';
import { useColors, getColors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/store/OrganizationContext';
import { log, warn } from '@/lib/logger';
import type { OrgType } from '@/types/organization';

WebBrowser.maybeCompleteAuthSession();

const SUCCESS_REDIRECT = 'porchivo://org-signup/success';
const CANCEL_REDIRECT = 'porchivo://org-signup/cancelled';

// ─── MXN pricing (Mexico-market push) ─────────────────────────────────────────
// Fixed MXN prices, reviewed quarterly — must match MXN_PLANS in the
// create-org-checkout edge function. Starter + Professional only; prices
// are IVA-incluido (16% VAT inside the gross amount).
const MXN_PLANS: Record<string, { monthly: number; annual: number; setupFee: number }> = {
  starter: { monthly: 1490, annual: 14900, setupFee: 0 },
  professional: { monthly: 3690, annual: 36900, setupFee: 3690 },
};

function formatPrice(amount: number, currency: 'usd' | 'mxn'): string {
  return currency === 'mxn' ? `$${amount.toLocaleString('en-US')} MXN` : `$${amount}`;
}

/**
 * Parse session_id and org_id from the Stripe redirect URL.
 * Format: porchivo://org-signup/success?session_id={CHECKOUT_SESSION_ID}&org_id={orgId}
 * Falls back to the cached values from the checkout response if parsing fails.
 */
function parseRedirectUrl(url: string | undefined | null): { sessionId: string | null; orgId: string | null } {
  if (!url) return { sessionId: null, orgId: null };
  try {
    const parsed = new URL(url);
    const sessionId = parsed.searchParams.get('session_id');
    const orgId = parsed.searchParams.get('org_id');
    return { sessionId, orgId };
  } catch {
    // URL constructor may fail on some platforms for custom schemes;
    // fall back to manual parsing
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return { sessionId: null, orgId: null };
    const params = new URLSearchParams(url.slice(qIndex + 1));
    return {
      sessionId: params.get('session_id'),
      orgId: params.get('org_id'),
    };
  }
}

// ─── Plan definitions (must match edge function + pricing page) ───────────────

interface PlanDef {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  maxUnits: number | null;
  setupFee?: number;
  features: string[];
  popular?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Up to 50 units',
    monthlyPrice: 99,
    annualPrice: 990,
    maxUnits: 50,
    features: [
      'Community announcements',
      '5GB document library',
      'Maintenance requests',
      'Package tracking',
      'Porch Partner',
      'Email support',
    ],
  },
  {
    id: 'community',
    name: 'Community',
    tagline: 'Up to 200 units',
    monthlyPrice: 249,
    annualPrice: 2490,
    maxUnits: 200,
    features: [
      'Everything in Starter, plus:',
      'HOA dues collection & payments',
      'Payment history & receipts',
      'Ledger exports',
      'Amenity reservations',
      'Board member roles',
      'Priority email support',
    ],
    popular: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Up to 500 units, 3 communities',
    monthlyPrice: 499,
    annualPrice: 4990,
    maxUnits: 500,
    setupFee: 500,
    features: [
      'Everything in Community, plus:',
      'Multi-community dashboard',
      'Advanced maintenance workflows',
      'Vendor assignment',
      'Custom branding',
      'Resident directory',
      'Phone + email support',
      '$500 one-time onboarding',
    ],
  },
  {
    id: 'enterprise',
    name: 'Property Manager',
    tagline: 'Up to 2,000 units & communities',
    monthlyPrice: 1499,
    annualPrice: 14990,
    maxUnits: 2000,
    setupFee: 1500,
    features: [
      'Everything in Professional, plus:',
      'Unlimited communities',
      'White-label options',
      'API access',
      'Dedicated account manager',
      'Custom onboarding',
      'SLA-backed support',
      '$1,500 one-time onboarding',
    ],
  },
];

const ORG_TYPES: { type: OrgType; label: string; emoji: string }[] = [
  { type: 'hoa', label: 'HOA', emoji: '🏡' },
  { type: 'condo', label: 'Condo', emoji: '🏢' },
  { type: 'multifamily', label: 'Multifamily', emoji: '🏬' },
  { type: 'property_management', label: 'Property Mgmt', emoji: '🏗️' },
];

type Step = 'details' | 'plan' | 'launching' | 'confirming' | 'success' | 'cancelled';

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrgSignupScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { refreshOrgContext } = useOrganization();

  // Step state
  const [step, setStep] = useState<Step>('details');

  // Form state — org details
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('hoa');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [zip, setZip] = useState('');
  const [totalUnits, setTotalUnits] = useState('');

  // Plan state
  const [selectedPlan, setSelectedPlan] = useState<string>('community');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  // Currency — defaults to MXN on Spanish devices (Mexico-market push);
  // MXN is only available for Starter and Professional.
  const [currency, setCurrency] = useState<'usd' | 'mxn'>(
    (getLocales()?.[0]?.languageCode ?? 'en') === 'es' ? 'mxn' : 'usd',
  );

  // Checkout state
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs mirroring sessionId/orgId for the deep link listener (avoids stale closures)
  const sessionIdRef = useRef<string | null>(null);
  const orgIdRef = useRef<string | null>(null);

  // Success state
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [createdOrgName, setCreatedOrgName] = useState<string>('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  React.useEffect(() => {
    animateIn();
  }, [step, animateIn]);

  // ── Auto-navigation timer ref (cleared on unmount) ──────────────────────
  const autoNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Validate details step ──────────────────────────────────────────────────
  // State allows 2–5 chars so Mexican states (e.g. JAL, NLE) work alongside US.
  const detailsValid = orgName.trim().length > 0 && address.trim().length > 0 && city.trim().length > 0 && stateField.length >= 2 && stateField.length <= 5 && zip.length >= 5;

  // ── Launch Stripe Checkout ─────────────────────────────────────────────────
  const handleLaunchCheckout = useCallback(async () => {
    if (!orgName.trim()) return;
    setError(null);
    setStep('launching');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-org-checkout', {
        body: {
          name: orgName.trim(),
          type: orgType,
          address: address.trim(),
          city: city.trim(),
          state: stateField.trim(),
          zip: zip.trim(),
          totalUnits: totalUnits ? parseInt(totalUnits, 10) : undefined,
          planTier: selectedPlan,
          billingCycle,
          currency,
          returnUrl: SUCCESS_REDIRECT,
        },
      });

      if (fnError) {
        throw new Error(fnError.message ?? 'Failed to create checkout session');
      }

      if (!data?.checkoutUrl) {
        throw new Error('No checkout URL returned');
      }

      setCheckoutUrl(data.checkoutUrl);
      setSessionId(data.sessionId);
      setOrgId(data.orgId);
      sessionIdRef.current = data.sessionId;
      orgIdRef.current = data.orgId;
      setCreatedOrgName(orgName.trim());

      // Open Stripe Checkout in in-app browser — openAuthSessionAsync
      // intercepts the porchivo:// redirect callback automatically.
      const browserResult = await WebBrowser.openAuthSessionAsync(
        data.checkoutUrl,
        SUCCESS_REDIRECT,
        { showInRecents: false, preferEphemeralSession: false },
      );

      if (browserResult.type === 'success') {
        // Extract session_id and org_id from the redirect URL query params.
        // These are appended by Stripe on the success_url redirect and are
        // more authoritative than the cached values from the checkout response.
        const { sessionId: urlSid, orgId: urlOid } = parseRedirectUrl(
          'url' in browserResult ? (browserResult as { url?: string }).url : null,
        );
        const finalSid = urlSid ?? data.sessionId;
        const finalOid = urlOid ?? data.orgId;

        log('[OrgSignup] Stripe redirect callback received', { finalSid, finalOid });

        // Verify the payment via confirm-org-signup edge function
        setStep('confirming');
        await handleConfirmSignup(finalSid, finalOid);
      } else {
        // User dismissed the browser before completing
        setStep('cancelled');
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Something went wrong. Please try again.';
      warn('[OrgSignup] Checkout error:', msg);
      setError(msg);
      setStep('plan');
    }
  }, [orgName, orgType, address, city, stateField, zip, totalUnits, selectedPlan, billingCycle, currency]);

  // ── Confirm signup after Stripe redirect ───────────────────────────────────
  const handleConfirmSignup = useCallback(async (sid: string, oid: string) => {
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('confirm-org-signup', {
        body: { sessionId: sid, orgId: oid },
      });

      if (fnError) {
        throw new Error(fnError.message ?? 'Failed to verify payment');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        setInviteCode(data.org?.inviteCode ?? null);
        setCreatedOrgName(data.org?.name ?? createdOrgName);
        // Refresh org context so the tab layout switches to community tier
        await refreshOrgContext();
        setStep('success');
        // Auto-navigate to the community dashboard after a brief delay
        // so the user can see their invite code before being redirected.
        autoNavTimerRef.current = setTimeout(() => {
          log('[OrgSignup] Auto-navigating to community dashboard after 200');
          router.replace('/(tabs)/(home)' as any);
        }, 4000);
      } else {
        throw new Error(data?.error ?? 'Payment verification failed');
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Could not verify your payment. Contact support if you were charged.';
      warn('[OrgSignup] Confirm error:', msg);
      setError(msg);
      setStep('cancelled');
    }
  }, [createdOrgName, refreshOrgContext]);

  // ── Retry confirmation (if user returns from Stripe manually) ──────────────
  const handleRetryConfirm = useCallback(() => {
    if (sessionId && orgId) {
      setStep('confirming');
      void handleConfirmSignup(sessionId, orgId);
    }
  }, [sessionId, orgId, handleConfirmSignup]);

  // ── Deep link listener (safety net for cases where ─────────────────────────
  // openAuthSessionAsync doesn't intercept the redirect, e.g. on Android
  // when the browser fully leaves the app and returns via intent).
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      log('[OrgSignup] Deep link received:', url);
      if (url.startsWith(SUCCESS_REDIRECT)) {
        const { sessionId: dlSid, orgId: dlOid } = parseRedirectUrl(url);
        if (dlSid && dlOid && (dlSid !== sessionIdRef.current || dlOid !== orgIdRef.current)) {
          sessionIdRef.current = dlSid;
          orgIdRef.current = dlOid;
          setStep('confirming');
          void handleConfirmSignup(dlSid, dlOid);
        }
      } else if (url.startsWith(CANCEL_REDIRECT)) {
        setStep('cancelled');
      }
    };

    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => {
      sub.remove();
      if (autoNavTimerRef.current) {
        clearTimeout(autoNavTimerRef.current);
        autoNavTimerRef.current = null;
      }
    };
  }, [handleConfirmSignup]);

  // ── Copy invite code ───────────────────────────────────────────────────────
  const handleCopyCode = useCallback(() => {
    if (!inviteCode) return;
    // Clipboard copy — using the basic approach to avoid extra imports
    Alert.alert('Invite Code', `Your invite code is: ${inviteCode}\n\nShare this with residents so they can join your community.`);
  }, [inviteCode]);

  // ── Step indicator ─────────────────────────────────────────────────────────
  const currentStepIndex = step === 'details' ? 0 : step === 'plan' ? 1 : 2;
  const stepLabels = ['Details', 'Plan', 'Payment'];

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorRow}>
      {stepLabels.map((label, i) => (
        <React.Fragment key={label}>
          <View style={styles.stepDotWrap}>
            <View style={[
              styles.stepDot,
              {
                backgroundColor: i <= currentStepIndex ? Colors.primary : Colors.borderLight,
                borderColor: i <= currentStepIndex ? Colors.primary : Colors.border,
              },
            ]}>
              {i < currentStepIndex ? (
                <Check size={14} color="#fff" />
              ) : (
                <Text style={[styles.stepDotText, { color: i <= currentStepIndex ? '#fff' : Colors.slateLighter }]}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={[
              styles.stepLabel,
              { color: i <= currentStepIndex ? Colors.slate : Colors.slateLighter },
            ]}>
              {label}
            </Text>
          </View>
          {i < stepLabels.length - 1 && (
            <View style={[styles.stepLine, { backgroundColor: i < currentStepIndex ? Colors.primary : Colors.borderLight }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  // ─── Input style helper ────────────────────────────────────────────────────
  const inputStyle = [styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }];
  const labelStyle = [styles.fieldLabel, { color: Colors.slateLighter }];

  // ─── Step: Details ─────────────────────────────────────────────────────────
  const renderDetailsStep = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Text style={[styles.headline, { color: Colors.slate }]}>Tell us about your community</Text>
      <Text style={[styles.subtext, { color: Colors.slateLight }]}>
        This information helps residents find your community and sets up your admin dashboard.
      </Text>

      {/* Org type selector */}
      <Text style={labelStyle}>Community type</Text>
      <View style={styles.typeGrid}>
        {ORG_TYPES.map((t) => (
          <TouchableOpacity
            key={t.type}
            style={[
              styles.typeChip,
              {
                backgroundColor: orgType === t.type ? Colors.primary : Colors.surface,
                borderColor: orgType === t.type ? Colors.primary : Colors.border,
              },
            ]}
            onPress={() => setOrgType(t.type)}
            activeOpacity={0.75}
          >
            <Text style={styles.typeChipEmoji}>{t.emoji}</Text>
            <Text style={[styles.typeChipLabel, { color: orgType === t.type ? '#fff' : Colors.slateLight }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={labelStyle}>Community name *</Text>
      <TextInput
        style={inputStyle}
        placeholder={`e.g. Oakwood HOA`}
        placeholderTextColor={Colors.slateLighter}
        value={orgName}
        onChangeText={setOrgName}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Text style={labelStyle}>Street address *</Text>
      <TextInput
        style={inputStyle}
        placeholder="123 Main St"
        placeholderTextColor={Colors.slateLighter}
        value={address}
        onChangeText={setAddress}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <View style={styles.rowInputs}>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>City *</Text>
          <TextInput
            style={inputStyle}
            placeholder="Austin"
            placeholderTextColor={Colors.slateLighter}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>
        <View style={{ width: 64 }}>
          <Text style={labelStyle}>State *</Text>
          <TextInput
            style={inputStyle}
            placeholder="TX"
            placeholderTextColor={Colors.slateLighter}
            value={stateField}
            onChangeText={(v) => setStateField(v.toUpperCase().slice(0, 2))}
            autoCapitalize="characters"
            maxLength={5}
            returnKeyType="next"
          />
        </View>
        <View style={{ width: 90 }}>
          <Text style={labelStyle}>ZIP *</Text>
          <TextInput
            style={inputStyle}
            placeholder="78701"
            placeholderTextColor={Colors.slateLighter}
            value={zip}
            onChangeText={setZip}
            keyboardType="number-pad"
            maxLength={5}
            returnKeyType="next"
          />
        </View>
      </View>

      <Text style={labelStyle}>Total units (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="e.g. 48"
        placeholderTextColor={Colors.slateLighter}
        value={totalUnits}
        onChangeText={setTotalUnits}
        keyboardType="number-pad"
        returnKeyType="done"
      />

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: detailsValid ? Colors.primary : Colors.borderLight }, !detailsValid && { opacity: 0.6 }]}
        onPress={() => detailsValid && setStep('plan')}
        disabled={!detailsValid}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>Continue to Plan Selection</Text>
        <ChevronRight size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  // ─── Step: Plan ────────────────────────────────────────────────────────────
  // ─── Currency switch (MXN restricted to Starter + Professional) ────────────
  const handleSwitchCurrency = useCallback((next: 'usd' | 'mxn') => {
    setCurrency(next);
    if (next === 'mxn' && !MXN_PLANS[selectedPlan]) {
      setSelectedPlan('starter');
    }
  }, [selectedPlan]);

  const renderPlanStep = () => {
    const selectedPlanDef = PLANS.find((p) => p.id === selectedPlan)!;
    const mxnSelected = currency === 'mxn' ? MXN_PLANS[selectedPlan] : null;
    const price = mxnSelected
      ? (billingCycle === 'monthly' ? mxnSelected.monthly : mxnSelected.annual)
      : (billingCycle === 'monthly' ? selectedPlanDef.monthlyPrice : selectedPlanDef.annualPrice);

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text style={[styles.headline, { color: Colors.slate }]}>Choose your plan</Text>
        <Text style={[styles.subtext, { color: Colors.slateLight }]}>
          Residents always join for free. Your subscription unlocks community features for everyone.
        </Text>

        {/* Currency toggle — MXN is the Mexico-market push (Starter + Professional) */}
        <View style={[styles.currencyToggle, { borderColor: Colors.border }]}>
          {(['usd', 'mxn'] as const).map((cur) => {
            const active = currency === cur;
            return (
              <TouchableOpacity
                key={cur}
                style={[styles.currencyChip, active && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                onPress={() => handleSwitchCurrency(cur)}
                activeOpacity={0.75}
              >
                <Text style={[styles.currencyChipText, { color: active ? '#fff' : Colors.slateLight }]}>
                  {cur === 'usd' ? 'USD $' : 'MXN $'}
                </Text>
              </TouchableOpacity>
            );
          })}
          {currency === 'mxn' && (
            <Text style={[styles.currencyNote, { color: Colors.slateLighter }]}>
              Precios fijos en pesos — IVA incluido
            </Text>
          )}
        </View>

        {/* Billing cycle toggle */}
        <View style={[styles.billingToggle, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <TouchableOpacity
            style={[styles.billingTab, billingCycle === 'monthly' && { backgroundColor: Colors.primary }]}
            onPress={() => setBillingCycle('monthly')}
            activeOpacity={0.75}
          >
            <Text style={[styles.billingTabText, { color: billingCycle === 'monthly' ? '#fff' : Colors.slateLight }]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.billingTab, billingCycle === 'annual' && { backgroundColor: Colors.primary }]}
            onPress={() => setBillingCycle('annual')}
            activeOpacity={0.75}
          >
            <Text style={[styles.billingTabText, { color: billingCycle === 'annual' ? '#fff' : Colors.slateLight }]}>
              Annual
            </Text>
            <View style={[styles.saveBadge, { backgroundColor: billingCycle === 'annual' ? 'rgba(255,255,255,0.25)' : Colors.successLight }]}>
              <Text style={[styles.saveBadgeText, { color: billingCycle === 'annual' ? '#fff' : Colors.success }]}>2 months free</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const mxnPlan = currency === 'mxn' ? MXN_PLANS[plan.id] : null;
            const planPrice = mxnPlan
              ? (billingCycle === 'monthly' ? mxnPlan.monthly : mxnPlan.annual)
              : (billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice);
            // MXN only covers Starter + Professional — other tiers stay USD-only
            const mxnUnavailable = currency === 'mxn' && !mxnPlan;

            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: Colors.surface,
                    borderColor: isSelected ? Colors.primary : Colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    opacity: mxnUnavailable ? 0.55 : 1,
                  },
                ]}
                onPress={() => setSelectedPlan(plan.id)}
                activeOpacity={0.8}
              >
                {plan.popular && (
                  <View style={[styles.popularBadge, { backgroundColor: Colors.primary }]}>
                    <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                  </View>
                )}
                <View style={styles.planCardHeader}>
                  <View style={styles.planCardInfo}>
                    <Text style={[styles.planName, { color: Colors.slate }]}>{plan.name}</Text>
                    <Text style={[styles.planTagline, { color: Colors.slateLighter }]}>{plan.tagline}</Text>
                  </View>
                  <View style={styles.planPriceWrap}>
                    <Text style={[styles.planPrice, { color: Colors.slate }]}>
                      {formatPrice(planPrice, currency)}
                    </Text>
                    <Text style={[styles.planPriceInterval, { color: Colors.slateLighter }]}>
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </Text>
                  </View>
                </View>
                {mxnUnavailable && (
                  <View style={styles.mxnOnlyNote}>
                    <Text style={[styles.mxnOnlyText, { color: Colors.slateLighter }]}>
                      Available in USD only
                    </Text>
                  </View>
                )}
                <View style={[styles.planFeatureList, { borderTopColor: Colors.borderLight }]}>
                  {plan.features.map((rawFeature, i) => {
                    // Swap the USD onboarding line for the MXN equivalent
                    const feature = currency === 'mxn' && mxnPlan && mxnPlan.setupFee > 0
                      ? `${formatPrice(mxnPlan.setupFee, 'mxn')} one-time onboarding — IVA incluido`
                      : rawFeature;
                    return (
                    <View key={i} style={styles.planFeatureRow}>
                      {feature === 'Everything in Starter, plus:' || feature === 'Everything in Community, plus:' || feature === 'Everything in Professional, plus:' ? (
                        <Text style={[styles.planFeatureHeader, { color: Colors.slate }]}>{feature}</Text>
                      ) : (
                        <>
                          <Check size={13} color={Colors.success} />
                          <Text style={[styles.planFeatureText, { color: Colors.slateLight }]}>{feature}</Text>
                        </>
                      )}
                    </View>
                    );
                  })}
                </View>
                {isSelected && (
                  <View style={[styles.selectedIndicator, { backgroundColor: Colors.primary }]}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Error message */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: Colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: Colors.danger }]}>{error}</Text>
          </View>
        )}

        {/* Total + checkout button */}
        <View style={[styles.checkoutBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <View>
            <Text style={[styles.totalLabel, { color: Colors.slateLighter }]}>
              Total {billingCycle === 'monthly' ? 'per month' : 'per year'}{currency === 'mxn' ? ' — IVA incluido' : ''}
            </Text>
            <Text style={[styles.totalAmount, { color: Colors.slate }]}>
              {formatPrice(price, currency)}
              <Text style={[styles.totalInterval, { color: Colors.slateLighter }]}>
                {' '}/{billingCycle === 'monthly' ? 'mo' : 'yr'}
              </Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={handleLaunchCheckout}
            activeOpacity={0.85}
          >
            <Lock size={15} color="#fff" />
            <Text style={styles.checkoutBtnText}>Continue to Payment</Text>
            <ArrowRight size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setStep('details')} activeOpacity={0.7} style={styles.backLink}>
          <ChevronLeft size={16} color={Colors.slateLight} />
          <Text style={[styles.backLinkText, { color: Colors.slateLight }]}>Back to details</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ─── Step: Launching ───────────────────────────────────────────────────────
  const renderLaunchingStep = () => (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={[styles.centerTitle, { color: Colors.slate }]}>Preparing checkout…</Text>
      <Text style={[styles.centerBody, { color: Colors.slateLight }]}>
        Setting up your community and Stripe payment session.
      </Text>
    </View>
  );

  // ─── Step: Confirming ──────────────────────────────────────────────────────
  const renderConfirmingStep = () => (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={[styles.centerTitle, { color: Colors.slate }]}>Verifying payment…</Text>
      <Text style={[styles.centerBody, { color: Colors.slateLight }]}>
        Confirming your subscription with Stripe. This usually takes a few seconds.
      </Text>
    </View>
  );

  // ─── Step: Success ─────────────────────────────────────────────────────────
  const renderSuccessStep = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={styles.centerState}>
        <View style={[styles.successIcon, { backgroundColor: Colors.success }]}>
          <CheckCircle2 size={48} color="#fff" />
        </View>
        <Text style={[styles.successTitle, { color: Colors.slate }]}>Community is live!</Text>
        <Text style={[styles.successBody, { color: Colors.slateLight }]}>
          {createdOrgName} is now on Porchivo. Your subscription is active and community features are unlocked.
        </Text>

        {inviteCode && (
          <View style={[styles.inviteCodeCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Text style={[styles.inviteCodeLabel, { color: Colors.slateLighter }]}>YOUR INVITE CODE</Text>
            <View style={styles.inviteCodeRow}>
              <Text style={[styles.inviteCode, { color: Colors.primary }]}>{inviteCode}</Text>
              <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
                <Copy size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.inviteCodeHint, { color: Colors.slateLighter }]}>
              Share this code with residents so they can join your community in the app.
            </Text>
          </View>
        )}

        <View style={[styles.nextStepsCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <Text style={[styles.nextStepsTitle, { color: Colors.slate }]}>What's next?</Text>
          <View style={styles.nextStepRow}>
            <View style={[styles.nextStepIcon, { backgroundColor: Colors.primary + '18' }]}>
              <Users size={18} color={Colors.primary} />
            </View>
            <Text style={[styles.nextStepText, { color: Colors.slateLight }]}>
              Invite residents using your code — they join for free
            </Text>
          </View>
          <View style={styles.nextStepRow}>
            <View style={[styles.nextStepIcon, { backgroundColor: Colors.successLight }]}>
              <Zap size={18} color={Colors.success} />
            </View>
            <Text style={[styles.nextStepText, { color: Colors.slateLight }]}>
              Post your first community announcement
            </Text>
          </View>
          <View style={styles.nextStepRow}>
            <View style={[styles.nextStepIcon, { backgroundColor: Colors.goldSoft }]}>
              <Shield size={18} color={Colors.gold} />
            </View>
            <Text style={[styles.nextStepText, { color: Colors.slateLight }]}>
              Set up maintenance request categories for your property
            </Text>
          </View>
        </View>

        <Text style={[styles.autoNavHint, { color: Colors.slateLighter }]}>
          Redirecting to your dashboard in a moment…
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: Colors.primary, marginTop: 24 }]}
          onPress={() => {
            if (autoNavTimerRef.current) {
              clearTimeout(autoNavTimerRef.current);
              autoNavTimerRef.current = null;
            }
            router.replace('/(tabs)/(home)' as any);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Go to Community Dashboard</Text>
          <ChevronRight size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ─── Step: Cancelled ───────────────────────────────────────────────────────
  const renderCancelledStep = () => (
    <View style={styles.centerState}>
      <View style={[styles.cancelledIcon, { backgroundColor: Colors.borderLight }]}>
        <CreditCard size={36} color={Colors.slateLight} />
      </View>
      <Text style={[styles.centerTitle, { color: Colors.slate }]}>Payment not completed</Text>
      <Text style={[styles.centerBody, { color: Colors.slateLight }]}>
        You closed the checkout before finishing. Your community has been saved but isn't active yet.
      </Text>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: Colors.dangerLight }]}>
          <Text style={[styles.errorText, { color: Colors.danger }]}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: Colors.primary, marginTop: 24 }]}
        onPress={handleRetryConfirm}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>I Already Paid — Verify</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => {
          setStep('plan');
          setError(null);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.secondaryBtnText, { color: Colors.slateLight }]}>Back to plan selection</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Layout ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 4),
              backgroundColor: Colors.surface,
              borderBottomColor: Colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={() => {
            if (step === 'details') router.back();
            else if (step === 'plan') setStep('details');
            else router.back();
          }} activeOpacity={0.7} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Create Community</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Step indicator (hidden during loading/success/cancelled) */}
        {(step === 'details' || step === 'plan') && (
          <View style={[styles.stepIndicatorContainer, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
            {renderStepIndicator()}
          </View>
        )}

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'details' && renderDetailsStep()}
          {step === 'plan' && renderPlanStep()}
          {step === 'launching' && renderLaunchingStep()}
          {step === 'confirming' && renderConfirmingStep()}
          {step === 'success' && renderSuccessStep()}
          {step === 'cancelled' && renderCancelledStep()}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const Colors = getColors(false);

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' as const },

  stepIndicatorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotWrap: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stepDotText: { fontSize: 12, fontWeight: '700' as const },
  stepLabel: { fontSize: 11, fontWeight: '600' as const },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 16,
    borderRadius: 1,
  },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  headline: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4, marginBottom: 8 },
  subtext: { fontSize: 14, lineHeight: 20, marginBottom: 20 },

  // Inputs
  fieldLabel: { fontSize: 12, fontWeight: '600' as const, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    marginBottom: 4,
  },
  rowInputs: { flexDirection: 'row', gap: 8, marginBottom: 0 },

  // Type chips
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeChipEmoji: { fontSize: 15 },
  typeChipLabel: { fontSize: 13, fontWeight: '600' as const },

  // Primary button
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
    marginBottom: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },

  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '500' as const },

  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  backLinkText: { fontSize: 14, fontWeight: '500' as const },

  // Currency toggle
  currencyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  currencyChipText: { fontSize: 12, fontWeight: '700' as const },
  currencyNote: { fontSize: 11, fontWeight: '600' as const, marginLeft: 2 },
  mxnOnlyNote: { paddingHorizontal: 16, paddingTop: 10 },
  mxnOnlyText: { fontSize: 11, fontWeight: '600' as const },

  // Billing toggle
  billingToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  billingTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 9,
  },
  billingTabText: { fontSize: 14, fontWeight: '600' as const },
  saveBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  saveBadgeText: { fontSize: 10, fontWeight: '700' as const },

  // Plan cards
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomLeftRadius: 10,
  },
  popularBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5 },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
  },
  planCardInfo: { flex: 1 },
  planName: { fontSize: 17, fontWeight: '700' as const },
  planTagline: { fontSize: 12, marginTop: 2 },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: { fontSize: 24, fontWeight: '800' as const },
  planPriceInterval: { fontSize: 13, fontWeight: '500' as const },
  planFeatureList: {
    padding: 16,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureHeader: { fontSize: 13, fontWeight: '700' as const },
  planFeatureText: { fontSize: 13, flex: 1, lineHeight: 18 },
  selectedIndicator: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Checkout bar
  checkoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  totalLabel: { fontSize: 12, fontWeight: '600' as const },
  totalAmount: { fontSize: 22, fontWeight: '800' as const },
  totalInterval: { fontSize: 14, fontWeight: '500' as const },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  checkoutBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },

  // Error banner
  errorBanner: {
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  errorText: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },

  // Center states (loading, confirming, success, cancelled)
  centerState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  centerTitle: { fontSize: 20, fontWeight: '700' as const, marginTop: 20, textAlign: 'center' },
  centerBody: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },

  // Success
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: { fontSize: 24, fontWeight: '800' as const, marginTop: 20, letterSpacing: -0.4 },
  successBody: { fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },

  inviteCodeCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  inviteCodeLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2 },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  inviteCode: { fontSize: 32, fontWeight: '800' as const, letterSpacing: 4 },
  inviteCodeHint: { fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 17 },

  nextStepsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 16,
  },
  nextStepsTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 14 },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  nextStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Cancelled
  cancelledIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Auto-nav hint text
  autoNavHint: {
    fontSize: 13,
    fontStyle: 'italic' as const,
    marginTop: 16,
    textAlign: 'center',
  },
});
