import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';

// Required for auth session to complete on web (no-op on native)
WebBrowser.maybeCompleteAuthSession();
import {
  ShieldCheck,
  UserCheck,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Banknote,
  Clock,
  XCircle,
  Wallet,
  Sparkles,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { palette, radius, space } from '@/constants/theme';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import {
  fetchMyVerification,
  initiateVerification,
  pollVerificationStatus,
  initiateConnectOnboarding,
  pollConnectStatus,
  idvStatusLabel,
} from '@/lib/partnerVerification';
import { PartnerVerification, IdvStatus } from '@/types';

type VerifyStep = 'overview' | 'id_pending' | 'id_polling' | 'id_done' | 'payout_intro' | 'payout_pending' | 'payout_polling' | 'payout_done';

const REDIRECT_URL = 'porchivo://partner-verify/callback';
const CONNECT_RETURN_URL = 'porchivo://partner-verify/connect-return';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: IdvStatus }) {
  const config: Record<IdvStatus, { label: string; color: string; bg: string; Icon: any }> = {
    not_started:    { label: 'Not started',    color: Colors.slateLighter, bg: Colors.borderLight, Icon: Clock },
    pending:        { label: 'In progress',    color: Colors.primary,      bg: Colors.skyBlue,     Icon: Clock },
    requires_input: { label: 'Action needed',  color: palette.gold,        bg: palette.goldSoft,   Icon: AlertTriangle },
    verified:       { label: 'Verified',       color: Colors.success,      bg: Colors.successLight, Icon: CheckCircle },
    cancelled:      { label: 'Cancelled',      color: Colors.slateLight,   bg: Colors.borderLight, Icon: XCircle },
    failed:         { label: 'Failed',         color: Colors.danger,       bg: Colors.dangerLight,  Icon: AlertTriangle },
  };
  const c = config[status];
  const Icon = c.Icon;
  return (
    <View style={[statusPillStyles.pill, { backgroundColor: c.bg }]}>
      <Icon size={12} color={c.color} />
      <Text style={[statusPillStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const statusPillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start' as const,
  },
  text: { fontSize: 12, fontWeight: '700' as const },
});

function ProgressDots({ step }: { step: number; total?: number }) {
  const total = 3;
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i === step && dotStyles.active,
            i < step && dotStyles.done,
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  active: { backgroundColor: Colors.primary, width: 20 },
  done: { backgroundColor: Colors.success },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PartnerVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ callback?: string }>();
  const queryClient = useQueryClient();
  const { user } = useApp();

  const [step, setStep] = useState<VerifyStep>('overview');
  const [isInitiating, setIsInitiating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pollingVerif, setPollingVerif] = useState<PartnerVerification | null>(null);
  const [_clientSecret, setClientSecret] = useState<string | null>(null);
  const successScale = useRef(new Animated.Value(0.8)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const connectScale = useRef(new Animated.Value(0.8)).current;
  const connectOpacity = useRef(new Animated.Value(0)).current;

  const { data: verification, refetch: refetchVerif } = useQuery({
    queryKey: ['partner-verification'],
    queryFn: fetchMyVerification,
    staleTime: 1000 * 30,
  });

  // Handle deep-link callbacks
  useEffect(() => {
    if (params.callback === 'true') {
      void handleReturnFromStripe();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.callback]);

  useEffect(() => {
    if (params.callback === 'connect-return') {
      void handleReturnFromConnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.callback]);

  const handleReturnFromStripe = useCallback(async () => {
    setStep('id_polling');
    setIsPolling(true);
    try {
      const result = await pollVerificationStatus();
      setPollingVerif(result);
      queryClient.setQueryData(['partner-verification'], result);
      setStep('id_done');
      if (result?.idvStatus === 'verified') {
        Animated.parallel([
          Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
          Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
      }
    } finally {
      setIsPolling(false);
    }
  }, [queryClient, successScale, successOpacity]);

  const handleReturnFromConnect = useCallback(async () => {
    setStep('payout_polling');
    setIsPolling(true);
    try {
      const result = await pollConnectStatus();
      setPollingVerif(result);
      queryClient.setQueryData(['partner-verification'], result);
      setStep('payout_done');
      if (result?.payoutStatus === 'active') {
        Animated.parallel([
          Animated.spring(connectScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
          Animated.timing(connectOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
      }
    } finally {
      setIsPolling(false);
    }
  }, [queryClient, connectScale, connectOpacity]);

  const handleStartConnect = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const result = await initiateConnectOnboarding();
      if (!result) {
        Alert.alert('Error', 'Could not start bank setup. Make sure your identity is verified and try again.');
        return;
      }
      if (result.alreadyConnected) {
        await refetchVerif();
        setStep('payout_done');
        return;
      }

      // Open Stripe Express onboarding inside in-app browser
      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.onboardingUrl,
        CONNECT_RETURN_URL,
        { showInRecents: false, preferEphemeralSession: false },
      );

      if (browserResult.type === 'success') {
        void handleReturnFromConnect();
      } else {
        setStep('payout_pending');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, refetchVerif, handleReturnFromConnect]);

  const handleStartVerification = useCallback(async () => {
    if (isInitiating) return;
    setIsInitiating(true);
    try {
      const result = await initiateVerification();
      if (!result) {
        Alert.alert('Error', 'Could not start verification. Please try again.');
        return;
      }
      if (result.alreadyVerified) {
        await refetchVerif();
        setStep('id_done');
        return;
      }

      // Stash client_secret for potential future native SDK use
      if ('clientSecret' in result && result.clientSecret) {
        setClientSecret(result.clientSecret as string);
      }

      // Open Stripe-hosted IDV page inside an in-app browser sheet.
      // SFSafariViewController (iOS) / Chrome Custom Tab (Android) — user never
      // fully leaves the app, and the browser auto-closes on the porchivo:// redirect.
      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.verificationUrl,
        REDIRECT_URL,
        {
          showInRecents: false,
          preferEphemeralSession: false, // keep cookies so Stripe can prefill
        },
      );

      if (browserResult.type === 'success') {
        // Stripe redirected back → auto-start polling, no manual tap needed
        void handleReturnFromStripe();
      } else {
        // User dismissed the browser (swipe-down / back button) before completing
        setStep('id_pending');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsInitiating(false);
    }
  }, [isInitiating, refetchVerif, handleReturnFromStripe]);

  if (!user) return null;

  const currentVerif = pollingVerif ?? verification;
  const idvStatus: IdvStatus = currentVerif?.idvStatus ?? 'not_started';
  const isVerified = idvStatus === 'verified';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Partner Verification',
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
        {/* ── Progress ── */}
        <View style={styles.progressSection}>
          <ProgressDots step={isVerified ? 2 : step === 'payout_intro' ? 2 : 0} />
          <Text style={styles.progressLabel}>
            {isVerified ? 'Identity verified' : step === 'payout_intro' ? 'Connect payout' : 'Verify identity'}
          </Text>
        </View>

        {/* ── STEP: Overview ─────────────────────────────────────────────── */}
        {step === 'overview' && (
          <View>
            <View style={styles.card}>
              <View style={styles.cardIconWrap}>
                <UserCheck size={28} color={Colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Identity Verification</Text>
              <StatusPill status={idvStatus} />
              <Text style={styles.cardBody}>
                To handle neighbours' packages for compensation, we need to confirm your identity.
                This is a one-time process powered by Stripe Identity.
              </Text>

              <View style={styles.whatYouNeed}>
                <Text style={styles.whatTitle}>What you'll need</Text>
                {[
                  "Government-issued photo ID (passport, driver's license, or national ID)",
                  "Your phone's camera for a short liveness selfie",
                  'About 2 minutes of your time',
                ].map((item) => (
                  <View key={item} style={styles.needRow}>
                    <CheckCircle size={14} color={Colors.success} />
                    <Text style={styles.needText}>{item}</Text>
                  </View>
                ))}
              </View>

              {idvStatus === 'requires_input' && currentVerif?.idvFailureReason && (
                <View style={styles.warningBanner}>
                  <AlertTriangle size={16} color={palette.gold} />
                  <Text style={styles.warningText}>
                    Previous attempt: {currentVerif.idvFailureReason.replace(/_/g, ' ')}. Please try again with a clearer photo.
                  </Text>
                </View>
              )}

              {idvStatus === 'failed' && (
                <View style={[styles.warningBanner, styles.errorBanner]}>
                  <AlertTriangle size={16} color={Colors.danger} />
                  <Text style={[styles.warningText, { color: Colors.danger }]}>
                    Verification failed. Contact support if this keeps happening.
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isInitiating && styles.btnDisabled]}
              onPress={handleStartVerification}
              disabled={isInitiating}
              activeOpacity={0.85}
              testID="start-idv-btn"
            >
              {isInitiating ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <ShieldCheck size={20} color={Colors.white} />
              )}
              <Text style={styles.primaryBtnText}>
                {isInitiating
                  ? 'Launching Stripe…'
                  : idvStatus === 'requires_input' || idvStatus === 'cancelled' || idvStatus === 'failed'
                    ? 'Retry Verification'
                    : 'Verify My Identity'}
              </Text>
              {!isInitiating && <ChevronRight size={18} color={Colors.white} />}
            </TouchableOpacity>

            <Text style={styles.secureNote}>
              🔒 Your ID is securely processed by Stripe. Porchivo never stores document images.
            </Text>

            {/* If they already opened Stripe but haven't returned via deeplink */}
            {idvStatus === 'pending' && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setStep('id_polling')}
                activeOpacity={0.8}
                testID="already-done-btn"
              >
                <RefreshCw size={16} color={Colors.primary} />
                <Text style={styles.secondaryBtnText}>I already completed it — check status</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── STEP: ID Pending (user dismissed browser before completing) ── */}
        {step === 'id_pending' && (
          <View style={styles.card}>
            <View style={[styles.cardIconWrap, { backgroundColor: Colors.skyBlue }]}>
              <ExternalLink size={28} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Verification paused</Text>
            <Text style={styles.cardBody}>
              You closed the verification before finishing. Tap below to pick up where you left off — it only takes about 2 minutes.
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 24 }]}
              onPress={handleStartVerification}
              activeOpacity={0.85}
              testID="resume-idv-btn"
            >
              <ShieldCheck size={18} color={Colors.white} />
              <Text style={styles.primaryBtnText}>Continue Verification</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleReturnFromStripe}
              activeOpacity={0.8}
              testID="check-status-btn"
            >
              <RefreshCw size={16} color={Colors.primary} />
              <Text style={styles.secondaryBtnText}>I already finished — check my status</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP: Polling ── */}
        {step === 'id_polling' && (
          <View style={[styles.card, styles.centeredCard]}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.cardTitle, { marginTop: 20 }]}>Checking your result…</Text>
            <Text style={styles.cardBody}>
              This usually takes a few seconds. We're confirming your result with Stripe.
            </Text>
          </View>
        )}

        {/* ── STEP: ID Done ── */}
        {step === 'id_done' && (
          <View>
            {idvStatus === 'verified' ? (
              <Animated.View
                style={[styles.card, styles.centeredCard, { opacity: successOpacity, transform: [{ scale: successScale }] }]}
              >
                <View style={styles.successIcon}>
                  <CheckCircle size={40} color={Colors.white} />
                </View>
                <Text style={styles.successTitle}>Identity Verified!</Text>
                <Text style={styles.cardBody}>
                  Your government ID has been confirmed. You're now an ID-Verified partner — homeowners can see your trust badge when selecting partners.
                </Text>

                <View style={styles.verifiedDetails}>
                  {currentVerif?.legalFirstName && (
                    <Text style={styles.verifiedName}>
                      {currentVerif.legalFirstName} {currentVerif.legalLastName}
                    </Text>
                  )}
                  <Text style={styles.verifiedSub}>Verified Partner · {new Date().toLocaleDateString()}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 24 }]}
                  onPress={() => setStep('payout_intro')}
                  activeOpacity={0.85}
                  testID="next-payout-btn"
                >
                  <CreditCard size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Set Up Payout Account</Text>
                  <ChevronRight size={16} color={Colors.white} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => router.back()}
                  activeOpacity={0.8}
                  testID="skip-payout-btn"
                >
                  <Text style={styles.secondaryBtnText}>Do this later</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : idvStatus === 'requires_input' ? (
              <View style={styles.card}>
                <View style={[styles.cardIconWrap, { backgroundColor: palette.goldSoft }]}>
                  <AlertTriangle size={28} color={palette.gold} />
                </View>
                <Text style={styles.cardTitle}>Action needed</Text>
                <StatusPill status="requires_input" />
                <Text style={styles.cardBody}>
                  Stripe couldn't fully verify your ID. This usually means the photo was blurry or the ID was cut off. Please try again.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 20 }]}
                  onPress={() => setStep('overview')}
                  activeOpacity={0.85}
                >
                  <RefreshCw size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={[styles.cardIconWrap, { backgroundColor: Colors.borderLight }]}>
                  <Clock size={28} color={Colors.slateLight} />
                </View>
                <Text style={styles.cardTitle}>Still processing</Text>
                <Text style={styles.cardBody}>
                  Stripe is still reviewing your submission. Come back in a few minutes — we'll update your status automatically.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 20 }]}
                  onPress={handleReturnFromStripe}
                  activeOpacity={0.85}
                >
                  <RefreshCw size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Check again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── STEP: Payout Intro ── */}
        {step === 'payout_intro' && (
          <View>
            <View style={styles.card}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Banknote size={28} color="#7C3AED" />
              </View>
              <Text style={styles.cardTitle}>Connect Your Bank</Text>
              <Text style={styles.cardBody}>
                To receive payments from homeowners, connect your bank account via Stripe Connect. This takes ~3 minutes and only needs to be done once.
              </Text>

              <View style={styles.payoutInfoRows}>
                {[
                  { label: 'You keep', value: '85% of each hold', color: Colors.success },
                  { label: 'Porchivo fee', value: '15%', color: Colors.slateLight },
                  { label: 'Transfer speed', value: '2 business days', color: Colors.primary },
                  { label: 'Minimum payout', value: '$1.00', color: Colors.primary },
                ].map((row) => (
                  <View key={row.label} style={styles.payoutInfoRow}>
                    <Text style={styles.payoutInfoLabel}>{row.label}</Text>
                    <Text style={[styles.payoutInfoValue, { color: row.color }]}>{row.value}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.stripeNote}>
                Stripe Connect is the same technology used by DoorDash, Lyft, and Instacart to pay their contractors.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#7C3AED' }, isConnecting && styles.btnDisabled]}
              onPress={handleStartConnect}
              disabled={isConnecting}
              activeOpacity={0.85}
              testID="connect-bank-btn"
            >
              {isConnecting
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Wallet size={20} color={Colors.white} />
              }
              <Text style={styles.primaryBtnText}>
                {isConnecting ? 'Launching Stripe…' : 'Connect Bank via Stripe'}
              </Text>
              {!isConnecting && <ExternalLink size={16} color={Colors.white} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>Set up later — start accepting free holds</Text>
            </TouchableOpacity>

            <Text style={styles.secureNote}>
              🔒 Banking details are handled entirely by Stripe. Porchivo cannot access your account numbers.
            </Text>
          </View>
        )}

        {/* ── STEP: Connect Pending (dismissed browser before finishing) ── */}
        {step === 'payout_pending' && (
          <View style={styles.card}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#F5F3FF' }]}>
              <ExternalLink size={28} color="#7C3AED" />
            </View>
            <Text style={styles.cardTitle}>Bank setup paused</Text>
            <Text style={styles.cardBody}>
              You closed the Stripe form before finishing. Tap below to pick up where you left off.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#7C3AED', marginTop: 24 }, isConnecting && styles.btnDisabled]}
              onPress={handleStartConnect}
              disabled={isConnecting}
              activeOpacity={0.85}
            >
              {isConnecting
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Wallet size={18} color={Colors.white} />
              }
              <Text style={styles.primaryBtnText}>Continue Bank Setup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleReturnFromConnect}
              activeOpacity={0.8}
            >
              <RefreshCw size={16} color={Colors.primary} />
              <Text style={styles.secondaryBtnText}>I already finished — check my status</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP: Connect Polling ── */}
        {step === 'payout_polling' && (
          <View style={[styles.card, styles.centeredCard]}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={[styles.cardTitle, { marginTop: 20 }]}>Confirming your bank…</Text>
            <Text style={styles.cardBody}>
              Stripe is confirming your account details. This usually takes a few seconds.
            </Text>
          </View>
        )}

        {/* ── STEP: Connect Done ── */}
        {step === 'payout_done' && (
          <View>
            {(currentVerif?.payoutStatus === 'active') ? (
              <Animated.View
                style={[styles.card, styles.centeredCard, { opacity: connectOpacity, transform: [{ scale: connectScale }] }]}
              >
                <View style={[styles.successIcon, { backgroundColor: '#7C3AED' }]}>
                  <Sparkles size={36} color={Colors.white} />
                </View>
                <Text style={styles.successTitle}>Bank Connected!</Text>
                <Text style={styles.cardBody}>
                  You're all set to receive payments directly to your bank account. Earnings from paid holds will land within 2 business days of completion.
                </Text>
                <View style={styles.verifiedDetails}>
                  <Text style={[styles.verifiedSub, { color: '#7C3AED' }]}>Payout Account Active · Stripe Connect</Text>
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 24, backgroundColor: '#7C3AED' }]}
                  onPress={() => router.back()}
                  activeOpacity={0.85}
                >
                  <CheckCircle size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Done — Start Earning</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <View style={styles.card}>
                <View style={[styles.cardIconWrap, { backgroundColor: Colors.borderLight }]}>
                  <Clock size={28} color={Colors.slateLight} />
                </View>
                <Text style={styles.cardTitle}>Account pending review</Text>
                <Text style={styles.cardBody}>
                  Stripe is still reviewing your account. This can take up to 24 hours. We'll update your status automatically.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 20 }]}
                  onPress={handleReturnFromConnect}
                  activeOpacity={0.85}
                >
                  <RefreshCw size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Check again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()} activeOpacity={0.8}>
                  <Text style={styles.secondaryBtnText}>I'll check later</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
  },

  // Progress
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slateLight,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  centeredCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  cardIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: palette.ink,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  cardBody: {
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center' as const,
  },

  // What you need
  whatYouNeed: {
    marginTop: 16,
    backgroundColor: palette.canvas,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  whatTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.slateLighter,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  needRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  needText: {
    flex: 1,
    fontSize: 13,
    color: palette.slate700,
    lineHeight: 19,
  },

  // Warning
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    backgroundColor: palette.goldSoft,
    borderRadius: 10,
    padding: 12,
  },
  errorBanner: {
    backgroundColor: Colors.dangerLight,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: palette.gold,
    lineHeight: 18,
    fontWeight: '500' as const,
  },

  // Success
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: palette.ink,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  verifiedDetails: {
    marginTop: 16,
    alignItems: 'center',
  },
  verifiedName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: palette.ink,
  },
  verifiedSub: {
    fontSize: 13,
    color: Colors.success,
    marginTop: 4,
    fontWeight: '600' as const,
  },

  // Payout info
  payoutInfoRows: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  payoutInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  payoutInfoLabel: {
    fontSize: 14,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  payoutInfoValue: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  stripeNote: {
    marginTop: 14,
    fontSize: 12,
    color: Colors.slateLighter,
    lineHeight: 17,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    textAlign: 'center' as const,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: Colors.skyBlue,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
  },
  secureNote: {
    fontSize: 12,
    color: Colors.slateLighter,
    textAlign: 'center' as const,
    marginTop: 6,
    lineHeight: 17,
  },
});
