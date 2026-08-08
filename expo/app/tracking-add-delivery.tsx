import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Package,
  ClipboardPaste,
  ArrowRight,
  CheckCircle2,
  Mail,
  Lock,
  User as UserIcon,
  X,
  ChevronRight,
  ScanBarcode,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { palette, space, radius, type as ttype, elevation } from '@/constants/theme';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useApp } from '@/store/AppContext';
import { usePackages } from '@/store/PackagesContext';
import { Carrier } from '@/types';
import { detectCarrier, carrierLabel, isValidTrackingFormat } from '@/lib/carrierDetect';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { recordConsent } from '@/lib/consent';
import { log } from '@/lib/logger';
import { useRouter } from 'expo-router';
import BarcodeScannerModal from '@/components/BarcodeScannerModal';

interface TrackingAddDeliveryProps {
  onContinue?: () => void;
  onSkip?: () => void;
}

const CARRIER_CHIPS: Carrier[] = ['Amazon', 'UPS', 'FedEx', 'USPS', 'Other'];

export default function TrackingAddDeliveryScreen({
  onContinue,
  onSkip,
}: TrackingAddDeliveryProps): React.ReactElement {
  const { track } = useAnalytics();
  const { session, user, completeOnboarding } = useApp();
  const { addPackage } = usePackages();
  const router = useRouter();

  // Fallbacks for deep-link access — route into the step manager instead of crashing
  const safeContinue = useCallback(() => {
    if (onContinue) onContinue();
    else router.replace('/tracking-onboarding' as never);
  }, [onContinue, router]);
  const safeSkip = useCallback(() => {
    if (onSkip) onSkip();
    else router.replace('/tracking-onboarding' as never);
  }, [onSkip, router]);

  // ── Form state ──────────────────────────────────────────────────────
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [packageName, setPackageName] = useState<string>('');
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [clipboardDetected, setClipboardDetected] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(false);

  // Auth form state
  const [showAuthForm, setShowAuthForm] = useState<boolean>(false);
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ── Animations ──────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const authFormAnim = useRef(new Animated.Value(0)).current;
  const carrierChipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    track('onboarding_step_view', { step: 'add_delivery' });

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

    // Check clipboard for a tracking number on mount
    void checkClipboard();
  }, []);

  // Auto-detect carrier as user types
  useEffect(() => {
    if (isValidTrackingFormat(trackingNumber)) {
      const detected = detectCarrier(trackingNumber);
      setSelectedCarrier(detected);
      Animated.spring(carrierChipAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 16,
        bounciness: 10,
      }).start();
    } else {
      setSelectedCarrier(null);
      carrierChipAnim.setValue(0);
    }
  }, [trackingNumber, carrierChipAnim]);

  const checkClipboard = useCallback(async () => {
    try {
      const hasString = await Clipboard.hasStringAsync();
      if (!hasString) return;
      const clipText = await Clipboard.getStringAsync();
      if (!clipText) return;
      // Check if clipboard content looks like a tracking number (10+ alphanumeric, no spaces)
      const cleaned = clipText.trim().replace(/\s+/g, '');
      if (cleaned.length >= 10 && cleaned.length <= 30 && /^[0-9A-Za-z]+$/.test(cleaned)) {
        setClipboardDetected(true);
      }
    } catch {
      // Clipboard access may fail on some platforms — silently ignore
    }
  }, []);

  const handlePasteClipboard = useCallback(async () => {
    try {
      const clipText = await Clipboard.getStringAsync();
      if (clipText) {
        const cleaned = clipText.trim().replace(/\s+/g, '');
        setTrackingNumber(cleaned);
        setClipboardDetected(false);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Silently ignore clipboard errors
    }
  }, []);

  const handleManualCarrierSelect = useCallback(
    (carrier: Carrier) => {
      setSelectedCarrier(carrier);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  const handleBarcodeScanned = useCallback((data: string) => {
    setTrackingNumber(data);
    setShowScanner(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const expandAuthForm = useCallback(() => {
    setShowAuthForm(true);
    Animated.spring(authFormAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 8,
    }).start();
  }, [authFormAnim]);

  // ── Submit: add package + auth if needed ────────────────────────────
  const handleAddPackage = useCallback(async () => {
    if (!trackingNumber.trim()) {
      Alert.alert('Missing Info', 'Please enter a tracking number.');
      return;
    }
    if (!isValidTrackingFormat(trackingNumber)) {
      Alert.alert('Invalid Format', 'Tracking numbers should be at least 10 characters.');
      return;
    }

    const carrier = selectedCarrier ?? detectCarrier(trackingNumber);
    const name = packageName.trim() || 'My Package';
    const userId = session?.user?.id ?? user?.id ?? null;

    // If user is already authenticated, add package directly
    if (userId) {
      try {
        addPackage(
          {
            name,
            carrier,
            trackingNumber: trackingNumber.trim(),
            expectedDeliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            expectedDeliveryWindowStart: null,
            expectedDeliveryWindowEnd: null,
            addressNickname: 'Home',
            customAddressLabel: null,
            notesForPartner: '',
            porchPartnerId: null,
          },
          userId,
        );
        track('delivery_added_first', { carrier, has_account: true });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        safeContinue();
        return;
      } catch (err: any) {
        if (err?.message === 'FREE_LIMIT_REACHED') {
          Alert.alert('Free Limit', 'You can track 1 active package on the free plan.');
        } else {
          Alert.alert('Error', 'Could not add package. Please try again.');
        }
        return;
      }
    }

    // Not authenticated — need to show auth form or submit auth
    if (!showAuthForm) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      track('onboarding_auth_started', { mode: 'signup', trigger: 'add_package' });
      expandAuthForm();
      return;
    }

    // Auth form is visible — validate and submit
    if (!authName.trim()) {
      Alert.alert('Missing Info', 'Please enter your name.');
      return;
    }
    if (!authEmail.trim() || !authEmail.includes('@')) {
      Alert.alert('Missing Info', 'Please enter a valid email.');
      return;
    }
    if (authPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert('Setup Required', 'The app backend is not configured yet.');
      return;
    }

    setIsSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      log('[TrackingOnboarding] Signing up user for first delivery');
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: {
          data: { name: authName.trim(), full_name: authName.trim() },
        },
      });

      if (error) {
        Alert.alert('Sign Up Failed', error.message);
        setIsSubmitting(false);
        return;
      }

      // Email confirmation required
      if (data.user && !data.session) {
        Alert.alert(
          'Check Your Email',
          'We sent a confirmation link. Please confirm your account, then return to add your package.',
        );
        setIsSubmitting(false);
        return;
      }

      // Record consent for new user
      if (data.user?.id) {
        void recordConsent(data.user.id);
      }

      const newUserId = data.user?.id ?? data.session?.user?.id;
      if (!newUserId) {
        Alert.alert('Error', 'Could not create account. Please try again.');
        setIsSubmitting(false);
        return;
      }

      track('onboarding_auth_completed', { mode: 'signup' });

      // Now add the package with the new user ID
      try {
        addPackage(
          {
            name,
            carrier,
            trackingNumber: trackingNumber.trim(),
            expectedDeliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            expectedDeliveryWindowStart: null,
            expectedDeliveryWindowEnd: null,
            addressNickname: 'Home',
            customAddressLabel: null,
            notesForPartner: '',
            porchPartnerId: null,
          },
          newUserId,
        );

        // Complete onboarding for the new user — pass the session from signUp
        // directly, because the auth state listener may not have propagated it
        // into AppContext yet (race condition that caused silent no-ops).
        try {
          await completeOnboarding({
            name: authName.trim(),
            email: authEmail.trim(),
            role: 'homeowner',
            hasLocationConsent: false,
          }, data.session);
        } catch {
          // Non-fatal — onboarding completion can retry later (Step 6)
          log('[TrackingOnboarding] Onboarding completion deferred');
        }

        track('delivery_added_first', { carrier, has_account: true });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        safeContinue();
      } catch (err: any) {
        if (err?.message === 'FREE_LIMIT_REACHED') {
          Alert.alert('Free Limit', 'You can track 1 active package on the free plan.');
        } else {
          Alert.alert('Error', 'Account created but could not add package. Please try again from the home screen.');
          safeContinue();
        }
      }
    } catch {
      Alert.alert('Connection Error', 'Unable to reach the server. Check your internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    trackingNumber,
    packageName,
    selectedCarrier,
    session,
    user,
    showAuthForm,
    authName,
    authEmail,
    authPassword,
    addPackage,
    track,
    completeOnboarding,
    safeContinue,
    expandAuthForm,
  ]);

  const handleSkip = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('onboarding_step_skipped', { step: 'add_delivery' });
    safeSkip();
  }, [track, safeSkip]);

  const authFormHeight = authFormAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 320],
  });
  const authFormOpacity = authFormAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Step indicator */}
        <View style={styles.stepBar}>
          <View style={styles.stepDots}>
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <View
                key={s}
                style={[styles.stepDot, s === 2 && styles.stepDotActive, s < 2 && styles.stepDotDone]}
              />
            ))}
          </View>
          <Text style={styles.stepLabel}>Step 2 of 6</Text>
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
            <View style={styles.iconTile}>
              <Package size={28} color={palette.surface} strokeWidth={2} />
            </View>
            <Text style={styles.title}>Add your first delivery</Text>
            <Text style={styles.subtitle}>
              Paste a tracking number and we'll start watching it for you.
            </Text>
          </Animated.View>

          {/* Tracking number input */}
          <Animated.View
            style={[
              styles.inputSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.label}>Tracking Number</Text>
            <View style={styles.trackingInputWrap}>
              <TextInput
                style={styles.trackingInput}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
                placeholder="Paste, type, or scan tracking number"
                placeholderTextColor={palette.slate300}
                autoCapitalize="characters"
                autoCorrect={false}
                testID="input-tracking-number"
              />
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => setShowScanner(true)}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityLabel="Scan barcode with camera"
                accessibilityRole="button"
                testID="btn-scan-barcode"
              >
                <ScanBarcode size={18} color={palette.navy} strokeWidth={2.2} />
              </TouchableOpacity>
              {clipboardDetected && !trackingNumber ? (
                <TouchableOpacity
                  style={styles.pasteButton}
                  onPress={handlePasteClipboard}
                  hitSlop={8}
                >
                  <ClipboardPaste size={16} color={palette.navy} strokeWidth={2.2} />
                  <Text style={styles.pasteText}>Paste</Text>
                </TouchableOpacity>
              ) : trackingNumber.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setTrackingNumber('');
                    setSelectedCarrier(null);
                  }}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <X size={16} color={palette.slate300} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Carrier auto-detect chip */}
            {selectedCarrier && (
              <Animated.View
                style={[
                  styles.carrierChipRow,
                  {
                    opacity: carrierChipAnim,
                    transform: [
                      {
                        scale: carrierChipAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <CheckCircle2 size={14} color={palette.sage} strokeWidth={2.2} />
                <Text style={styles.carrierDetectedText}>
                  Detected: <Text style={styles.carrierDetectedBold}>{carrierLabel(selectedCarrier)}</Text>
                </Text>
              </Animated.View>
            )}

            {/* Manual carrier override chips */}
            {trackingNumber.length > 0 && (
              <View style={styles.carrierChipsRow}>
                {CARRIER_CHIPS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.carrierChip,
                      selectedCarrier === c && styles.carrierChipActive,
                    ]}
                    onPress={() => handleManualCarrierSelect(c)}
                  >
                    <Text
                      style={[
                        styles.carrierChipText,
                        selectedCarrier === c && styles.carrierChipTextActive,
                      ]}
                    >
                      {carrierLabel(c)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Package name (optional) */}
            <Text style={[styles.label, { marginTop: space.xxl }]}>
              Package Name <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.nameInput}
              value={packageName}
              onChangeText={setPackageName}
              placeholder="e.g. New headphones"
              placeholderTextColor={palette.slate300}
              testID="input-package-name"
            />
          </Animated.View>

          {/* Inline auth form */}
          <Animated.View
            style={{
              maxHeight: authFormHeight,
              opacity: authFormOpacity,
              overflow: 'hidden',
            }}
          >
            <View style={styles.authSection}>
              <View style={styles.authDivider}>
                <View style={styles.authDividerLine} />
                <Text style={styles.authDividerText}>Create your free account</Text>
                <View style={styles.authDividerLine} />
              </View>
              <Text style={styles.authHint}>
                Your packages sync securely across devices. No spam, ever.
              </Text>

              <View style={styles.authField}>
                <UserIcon size={16} color={palette.slate300} />
                <TextInput
                  style={styles.authInput}
                  value={authName}
                  onChangeText={setAuthName}
                  placeholder="Your name"
                  placeholderTextColor={palette.slate300}
                  autoCapitalize="words"
                  testID="input-auth-name"
                />
              </View>

              <View style={styles.authField}>
                <Mail size={16} color={palette.slate300} />
                <TextInput
                  style={styles.authInput}
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  placeholder="Email address"
                  placeholderTextColor={palette.slate300}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="input-auth-email"
                />
              </View>

              <View style={styles.authField}>
                <Lock size={16} color={palette.slate300} />
                <TextInput
                  style={styles.authInput}
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="Password (min 6 chars)"
                  placeholderTextColor={palette.slate300}
                  secureTextEntry
                  testID="input-auth-password"
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Footer: CTA + Skip */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.ctaButton, isSubmitting && styles.ctaButtonDisabled]}
            onPress={handleAddPackage}
            disabled={isSubmitting}
            activeOpacity={0.85}
            accessibilityLabel={showAuthForm ? 'Create account and track' : 'Add and track package'}
            accessibilityRole="button"
            testID="btn-add-package"
          >
            <Text style={styles.ctaText}>
              {isSubmitting
                ? 'Creating account...'
                : showAuthForm
                  ? 'Create Account & Track'
                  : 'Add & Track Package'}
            </Text>
            <ArrowRight size={20} color={palette.surface} strokeWidth={2.5} />
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
      </KeyboardAvoidingView>
      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={handleBarcodeScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  flex: {
    flex: 1,
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
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
    ...elevation.raised,
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
  // ── Input section ───────────────────────────────────────────────────
  inputSection: {
    width: '100%',
  },
  label: {
    ...ttype.headline,
    color: palette.ink,
    fontSize: 15,
    marginBottom: space.sm,
  },
  optional: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: palette.slate300,
  },
  trackingInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.slate200,
    paddingHorizontal: space.lg,
    ...elevation.low,
  },
  trackingInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: palette.ink,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.sky,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  scanButton: {
    padding: 6,
    marginLeft: 2,
  },
  pasteText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: palette.navy,
  },
  clearBtn: {
    padding: 6,
  },
  // ── Carrier detection ───────────────────────────────────────────────
  carrierChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.sm,
    paddingHorizontal: space.xs,
  },
  carrierDetectedText: {
    ...ttype.caption,
    color: palette.slate700,
    fontSize: 13,
  },
  carrierDetectedBold: {
    fontWeight: '700' as const,
    color: palette.ink,
  },
  carrierChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space.md,
  },
  carrierChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.slate200,
  },
  carrierChipActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  carrierChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.slate700,
  },
  carrierChipTextActive: {
    color: palette.surface,
  },
  // ── Package name ────────────────────────────────────────────────────
  nameInput: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.slate200,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 15,
    color: palette.ink,
  },
  // ── Auth form ───────────────────────────────────────────────────────
  authSection: {
    marginTop: space.xxl,
    paddingBottom: space.lg,
  },
  authDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.sm,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.slate200,
  },
  authDividerText: {
    ...ttype.overline,
    color: palette.slate500,
    fontSize: 11,
  },
  authHint: {
    ...ttype.caption,
    color: palette.slate300,
    textAlign: 'center',
    marginBottom: space.xl,
    paddingHorizontal: space.md,
  },
  authField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.slate200,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  authInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: palette.ink,
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
