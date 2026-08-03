import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Eye,
  EyeOff,
  Fingerprint,
  ScanFace,
  ChevronLeft,
  HelpCircle,
  Mail,
  Lock,
  User,
  Shield,
  ChevronRight,
  Check,
  Sparkles,
  Wand2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured, pingSupabase } from '@/lib/supabase';
import { recordConsent } from '@/lib/consent';
import {
  InfoSheet,
  SecuritySuccessOverlay,
  PorchLightScene,
  PorchLightStatus,
  StarfieldBackground,
} from '@/components/onboarding';
import type { PorchLightStage } from '@/components/onboarding';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Storage keys ─────────────────────────────────────────────────────────────
const LAST_NAME_KEY = 'porchivo_last_name';
const LAST_INITIAL_KEY = 'porchivo_last_initial';
const LAST_EMAIL_KEY = 'porchivo_saved_email';
const REMEMBER_ME_KEY = 'porchivo_remember_me';

// ─── Types ────────────────────────────────────────────────────────────────────
type ScreenState = 'init' | 'returning' | 'auth';
type AuthMode = 'signin' | 'signup';
/** Which primary credential path is shown — biometric is the default; the
 *  email path collapses to magic link with a tucked password fallback. */
type CredentialPath = 'biometric' | 'magiclink' | 'password';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning,';
  if (h >= 12 && h < 17) return 'Good afternoon,';
  if (h >= 17 && h < 21) return 'Good evening,';
  return 'Good night,';
}

// (porch-light hero replaces the avatar — initial color helper unused now)

// ─── Ambient Orb ─────────────────────────────────────────────────────────────
type OrbProps = {
  anim: Animated.Value;
  color: string;
  size: number;
  baseX: number;
  baseY: number;
  dX: number;
  dY: number;
  opacity: number;
};

function AmbientOrb({ anim, color, size, baseX, baseY, dX, dY, opacity }: OrbProps) {
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, dX] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, dY] });
  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: baseX - size / 2,
          top: baseY - size / 2,
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[color, 'transparent']}
        style={{ flex: 1, borderRadius: size / 2 }}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('init');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [credentialPath, setCredentialPath] = useState<CredentialPath>('biometric');

  // Returning user data
  const [returningName, setReturningName] = useState<string>('');
  const [, setReturningInitial] = useState<string>('');

  // Biometrics
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null);
  const [isBiometricLoading, setIsBiometricLoading] = useState<boolean>(false);
  const [biometricTriggered, setBiometricTriggered] = useState<boolean>(false);

  // Form
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    identifier?: string;
    password?: string;
    name?: string;
    terms?: string;
  }>({});

  // Magic link
  const [magicLinkSent, setMagicLinkSent] = useState<boolean>(false);

  // Security success overlay
  const [showSecurityOverlay, setShowSecurityOverlay] = useState<boolean>(false);
  const pendingRouteRef = useRef<(() => void) | null>(null);

  // Bottom sheets
  const [sheet, setSheet] = useState<'encryption' | 'terms' | 'privacy' | null>(null);

  // Porch-light hero stage — mirrors biometric load + verified bloom
  const porchStage: PorchLightStage = showSecurityOverlay
    ? 'verified'
    : isBiometricLoading
    ? 'authenticating'
    : 'idle';

  // ── Dev test ──────────────────────────────────────────────────────────────
  const [pendingAutoSubmit, setPendingAutoSubmit] = useState<boolean>(false);
  const [isDevAutoSigningIn, setIsDevAutoSigningIn] = useState<boolean>(false);

  // ── Animations ────────────────────────────────────────────────────────────
  const masterFade = useRef(new Animated.Value(0)).current;
  const returningFade = useRef(new Animated.Value(0)).current;
  const returningSlide = useRef(new Animated.Value(40)).current;
  const avatarScale = useRef(new Animated.Value(0.7)).current;
  const avatarPulse = useRef(new Animated.Value(1)).current;
  const bioShimmer = useRef(new Animated.Value(0)).current;
  const bioButtonScale = useRef(new Animated.Value(1)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;
  const modeSlide = useRef(new Animated.Value(0)).current;
  const submitButtonScale = useRef(new Animated.Value(1)).current;

  // Orb animations
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  const orb3 = useRef(new Animated.Value(0)).current;

  // Refs
  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  // ── Orb loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = (anim: Animated.Value, dur: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: dur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: dur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    loop(orb1, 9000);
    loop(orb2, 13000);
    loop(orb3, 11000);
  }, [orb1, orb2, orb3]);

  // ── Master fade in ────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(masterFade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [masterFade]);

  // ── Init: check for returning user + biometrics ───────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [savedName, savedInitial, savedEmail, remMe] = await Promise.all([
          AsyncStorage.getItem(LAST_NAME_KEY),
          AsyncStorage.getItem(LAST_INITIAL_KEY),
          AsyncStorage.getItem(LAST_EMAIL_KEY),
          AsyncStorage.getItem(REMEMBER_ME_KEY),
        ]);

        if (remMe !== null) setRememberMe(remMe === 'true');
        if (savedEmail) setIdentifier(savedEmail);

        const isReturning = !!(savedName && savedEmail);

        // Check biometric availability
        let bioType: 'face' | 'fingerprint' | null = null;
        try {
          const hasHw = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHw && isEnrolled) {
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
              bioType = 'face';
            } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
              bioType = 'fingerprint';
            }
          }
        } catch {
          // Biometrics not available — continue without
        }

        setBiometricType(bioType);

        if (isReturning) {
          setReturningName(savedName!.split(' ')[0]);
          setReturningInitial(savedInitial || savedName!.charAt(0).toUpperCase());
          setScreenState('returning');
          setCredentialPath(bioType ? 'biometric' : 'magiclink');
          // Animate in returning view
          Animated.parallel([
            Animated.spring(returningSlide, {
              toValue: 0,
              tension: 60,
              friction: 9,
              useNativeDriver: true,
            }),
            Animated.timing(returningFade, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.spring(avatarScale, {
              toValue: 1,
              tension: 70,
              friction: 8,
              delay: 150,
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Pulse the avatar ring
            Animated.loop(
              Animated.sequence([
                Animated.timing(avatarPulse, {
                  toValue: 1.12,
                  duration: 1800,
                  easing: Easing.inOut(Easing.ease),
                  useNativeDriver: true,
                }),
                Animated.timing(avatarPulse, {
                  toValue: 1,
                  duration: 1800,
                  easing: Easing.inOut(Easing.ease),
                  useNativeDriver: true,
                }),
              ])
            ).start();

            // Shimmer loop on bio button
            if (bioType) {
              Animated.loop(
                Animated.timing(bioShimmer, {
                  toValue: 1,
                  duration: 2800,
                  easing: Easing.linear,
                  useNativeDriver: true,
                })
              ).start();
            }
          });
        } else {
          // New user — default to magic link (passwordless-first)
          setAuthMode(params.mode === 'signin' ? 'signin' : 'signup');
          setCredentialPath('magiclink');
          setScreenState('auth');
          animateFormIn();
        }
      } catch {
        setAuthMode(params.mode === 'signin' ? 'signin' : 'signup');
        setCredentialPath('magiclink');
        setScreenState('auth');
        animateFormIn();
      }
    }
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-prompt biometrics after brief delay ──────────────────────────────
  useEffect(() => {
    if (screenState === 'returning' && biometricType && credentialPath === 'biometric' && !biometricTriggered) {
      setBiometricTriggered(true);
      const timer = setTimeout(() => {
        void handleBiometricAuth();
      }, 700);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenState, biometricType, credentialPath]);

  function animateFormIn() {
    Animated.parallel([
      Animated.timing(formFade, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }),
      Animated.spring(formSlide, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }

  const switchToAuth = useCallback((mode: AuthMode = 'signin') => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAuthMode(mode);
    setErrors({});
    // New users default to magic link; returning users with biometric keep biometric
    setCredentialPath(biometricType ? 'biometric' : 'magiclink');
    setScreenState('auth');
    formFade.setValue(0);
    formSlide.setValue(20);
    animateFormIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricType]);

  // ── Security overlay → route handoff ──────────────────────────────────────
  const handleSecurityComplete = useCallback(() => {
    setShowSecurityOverlay(false);
    const next = pendingRouteRef.current;
    pendingRouteRef.current = null;
    if (next) next();
  }, []);

  const triggerSuccessAndRoute = useCallback((route: () => void) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    pendingRouteRef.current = route;
    setShowSecurityOverlay(true);
  }, []);

  // ── Biometric auth ────────────────────────────────────────────────────────
  const handleBiometricAuth = useCallback(async () => {
    if (isBiometricLoading) return;
    setIsBiometricLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(bioButtonScale, {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(bioButtonScale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock Porchivo`,
        fallbackLabel: 'Use email instead',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        // Check if Supabase session is still valid
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          triggerSuccessAndRoute(() => router.replace('/(tabs)/(home)' as any));
        } else {
          // Session expired — gracefully drop to magic-link form
          Alert.alert(
            'Session Expired',
            'Your session has expired. Sign in with your email to continue — no password needed.',
            [{ text: 'Continue', onPress: () => switchToAuth('signin') }]
          );
        }
      }
    } catch {
      // Biometric failed or cancelled — do nothing
    } finally {
      setIsBiometricLoading(false);
    }
  }, [isBiometricLoading, bioButtonScale, router, switchToAuth, triggerSuccessAndRoute]);

  // ── Form validation ───────────────────────────────────────────────────────
  const validateEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateMagicLink = useCallback((): boolean => {
    const errs: typeof errors = {};
    if (!identifier.trim()) {
      errs.identifier = 'Email is required';
    } else if (!validateEmail(identifier)) {
      errs.identifier = 'Enter a valid email address';
    }
    if (authMode === 'signup' && !name.trim()) {
      errs.name = 'Full name is required';
    }
    if (authMode === 'signup' && !acceptedTerms) {
      errs.terms = 'You must accept the Terms of Service and Privacy Policy';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [identifier, name, authMode, acceptedTerms]);

  const validatePassword = useCallback((): boolean => {
    const errs: typeof errors = {};
    if (!identifier.trim()) {
      errs.identifier = 'Email is required';
    } else if (!validateEmail(identifier)) {
      errs.identifier = 'Enter a valid email address';
    }
    if (!password.trim()) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }
    if (authMode === 'signup' && !name.trim()) {
      errs.name = 'Full name is required';
    }
    if (authMode === 'signup' && !acceptedTerms) {
      errs.terms = 'You must accept the Terms of Service and Privacy Policy';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [identifier, password, name, authMode, acceptedTerms]);

  const getSupabaseErrorMessage = (error: string): string => {
    if (error.includes('Invalid login credentials'))
      return 'Incorrect email or password. Please try again.';
    if (error.includes('Email not confirmed'))
      return 'Please confirm your email before signing in.';
    if (error.includes('User already registered'))
      return 'An account with this email already exists. Try signing in.';
    if (error.includes('Password should be at least'))
      return 'Password must be at least 8 characters.';
    if (error.includes('rate limit'))
      return 'Too many attempts. Please wait a moment and try again.';
    if (error.includes('Signups not allowed'))
      return 'Sign ups are currently disabled. Please contact support.';
    // Never surface raw Supabase error strings — they may expose internal schema details
    return 'Something went wrong. Please try again.';
  };

  // ── Persist returning-user fields ─────────────────────────────────────────
  const persistReturningUser = useCallback(
    async (displayName: string, email: string) => {
      const firstName = displayName.trim().split(' ')[0];
      await Promise.all([
        AsyncStorage.setItem(LAST_NAME_KEY, firstName),
        AsyncStorage.setItem(LAST_INITIAL_KEY, displayName.charAt(0).toUpperCase()),
        AsyncStorage.setItem(LAST_EMAIL_KEY, email.trim()),
        AsyncStorage.setItem(REMEMBER_ME_KEY, 'true'),
      ]);
    },
    []
  );

  // ── Magic link submit ─────────────────────────────────────────────────────
  const handleMagicLink = useCallback(async () => {
    if (isSubmitting) return;
    if (!validateMagicLink()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(submitButtonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(submitButtonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    try {
      if (!isSupabaseConfigured) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Setup Required', 'The app backend is not configured yet.');
        setIsSubmitting(false);
        return;
      }

      // Sign up with email + passwordless metadata if creating an account.
      // We send a magic link; Supabase confirms the email and creates the
      // account on click. This keeps the default path passwordless.
      const redirectTo = 'porchivo://reset-password';
      if (authMode === 'signup') {
        // Create the account first (passwordless metadata), then send a link.
        // Many Supabase projects disallow anonymous sign-up; we use a
        // long random password client-side is NOT used here. Instead we send
        // a magic link directly — when the user clicks it, Supabase creates
        // or signs in the account. Sign-up vs sign-in collapses to one flow.
        const { error } = await supabase.auth.signInWithOtp({
          email: identifier.trim(),
          options: {
            emailRedirectTo: redirectTo,
            data: { name: name.trim(), full_name: name.trim() },
          },
        });
        if (error) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Could not send link', getSupabaseErrorMessage(error.message));
          setIsSubmitting(false);
          return;
        }
        // Record consent (non-blocking)
        void recordConsent(identifier.trim()).catch(() => {});
        await persistReturningUser(name || identifier, identifier);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: identifier.trim(),
          options: { emailRedirectTo: redirectTo },
        });
        if (error) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Could not send link', getSupabaseErrorMessage(error.message));
          setIsSubmitting(false);
          return;
        }
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMagicLinkSent(true);
    } catch (err: any) {
      const probe = await pingSupabase();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const detail = !probe.ok
        ? 'Server unreachable. Check your internet connection.'
        : 'Something went wrong. Please try again.';
      Alert.alert('Connection Error', detail);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    validateMagicLink,
    submitButtonScale,
    authMode,
    identifier,
    name,
    persistReturningUser,
  ]);

  // ── Password submit (fallback path) ───────────────────────────────────────
  const handlePasswordSubmit = useCallback(async () => {
    if (isSubmitting) return;
    if (!validatePassword()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(submitButtonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(submitButtonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    try {
      if (!isSupabaseConfigured) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Setup Required', 'The app backend is not configured yet.');
        setIsSubmitting(false);
        return;
      }

      if (authMode === 'signup') {
        let data, error;
        try {
          const result = await supabase.auth.signUp({
            email: identifier.trim(),
            password,
            options: { data: { name: name.trim(), full_name: name.trim() } },
          });
          data = result.data;
          error = result.error;
        } catch {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Connection Error', 'Unable to reach the server. Check your internet connection.');
          setIsSubmitting(false);
          return;
        }

        if (error) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Sign Up Failed', getSupabaseErrorMessage(error.message));
          setIsSubmitting(false);
          return;
        }

        if (data.user && !data.session) {
          Alert.alert(
            'Check Your Email',
            'We sent a confirmation link to your email. Please confirm your account, then sign in.',
            [{ text: 'OK', onPress: () => setAuthMode('signin') }]
          );
          setIsSubmitting(false);
          return;
        }

        if (data.user?.id) {
          void recordConsent(data.user.id);
        }

        await persistReturningUser(name, identifier);
        triggerSuccessAndRoute(() => router.push('/role-selection' as any));
      } else {
        let data, error;
        try {
          const result = await supabase.auth.signInWithPassword({
            email: identifier.trim(),
            password,
          });
          data = result.data;
          error = result.error;
        } catch {
          const probe = await pingSupabase();
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const detail = !probe.ok
            ? probe.error === 'not_configured'
              ? 'Supabase URL or API key is missing.'
              : `Server unreachable (${probe.error ?? probe.status ?? 'no response'}).`
            : 'Request failed before reaching auth.';
          Alert.alert('Connection Error', `${detail}\n\nCheck your internet connection.`);
          setIsSubmitting(false);
          return;
        }

        if (error) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Sign In Failed', getSupabaseErrorMessage(error.message));
          setIsSubmitting(false);
          return;
        }

        if (rememberMe) {
          const profile = data.user?.user_metadata;
          const displayName: string =
            (profile?.name as string | undefined) ||
            (profile?.full_name as string | undefined) ||
            '';
          if (displayName) {
            await persistReturningUser(displayName, identifier);
          } else {
            await Promise.all([
              AsyncStorage.setItem(REMEMBER_ME_KEY, 'true'),
              AsyncStorage.setItem(LAST_EMAIL_KEY, identifier.trim()),
            ]);
          }
        } else {
          await Promise.all([
            AsyncStorage.setItem(REMEMBER_ME_KEY, 'false'),
            AsyncStorage.removeItem(LAST_EMAIL_KEY),
          ]);
        }

        let alreadyOnboarded = false;
        try {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('is_onboarded')
            .eq('id', data.user!.id)
            .single();
          alreadyOnboarded = !!profileRow?.is_onboarded;
        } catch {
          // Profile lookup failed — fall through to role-selection
        }
        if (alreadyOnboarded) {
          triggerSuccessAndRoute(() => router.replace('/(tabs)/(home)' as any));
        } else {
          triggerSuccessAndRoute(() => router.push('/role-selection' as any));
        }
      }
    } catch (err: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        Alert.alert('Connection Error', 'Unable to reach the server. Check your internet connection.');
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    validatePassword,
    submitButtonScale,
    router,
    authMode,
    identifier,
    password,
    name,
    rememberMe,
    persistReturningUser,
    triggerSuccessAndRoute,
  ]);

  // ── Auth mode toggle ──────────────────────────────────────────────────────
  const toggleAuthMode = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAuthMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setErrors({});
    setMagicLinkSent(false);
    Animated.spring(modeSlide, {
      toValue: authMode === 'signin' ? 1 : 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [authMode, modeSlide]);

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgotPassword = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (identifier.trim() && validateEmail(identifier.trim())) {
      Alert.alert(
        'Reset Password',
        `We'll send a reset link to ${identifier.trim()}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Reset Link',
            onPress: async () => {
              try {
                const { error } = await supabase.auth.resetPasswordForEmail(
                  identifier.trim(),
                  { redirectTo: 'porchivo://reset-password' }
                );
                if (error) {
                  Alert.alert('Error', getSupabaseErrorMessage(error.message));
                } else {
                  Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
                }
              } catch {
                Alert.alert('Error', 'Could not send reset email. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Reset Password',
        'Enter your email address above, then tap "Forgot?".'
      );
    }
  }, [identifier]);

  // ── Dev helpers ───────────────────────────────────────────────────────────
  const getQaCredentials = useCallback(
    (): { email: string; password: string } => ({
      email: process.env.EXPO_PUBLIC_QA_EMAIL ?? '',
      password: process.env.EXPO_PUBLIC_QA_PASSWORD ?? '',
    }),
    []
  );

  const handleDevTestLogin = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { email, password: pw } = getQaCredentials();
    setAuthMode('signin');
    setIdentifier(email);
    setPassword(pw);
    setErrors({});
    setCredentialPath('password');
    if (screenState !== 'auth') switchToAuth('signin');
  }, [getQaCredentials, screenState, switchToAuth]);

  /**
   * Dev auto-sign-in: tries signInWithPassword first, and if the QA account
   * doesn't exist, automatically signs up. This bypasses the magic-link flow
   * (which can't work in the browser preview) and creates the account if
   * needed — one tap gets you into the app.
   */
  const handleDevAutoSignIn = useCallback(async () => {
    if (isDevAutoSigningIn || isSubmitting) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { email, password: pw } = getQaCredentials();

    // Show the credentials in the form for visibility
    setAuthMode('signin');
    setIdentifier(email);
    setPassword(pw);
    setErrors({});
    setCredentialPath('password');
    if (screenState !== 'auth') switchToAuth('signin');

    setIsDevAutoSigningIn(true);

    try {
      if (!isSupabaseConfigured) {
        Alert.alert('Setup Required', 'The app backend is not configured yet.');
        return;
      }

      // Step 1: Try signing in with the QA credentials
      let result = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });

      // Step 2: If the account doesn't exist, create it
      if (result.error && /invalid login credentials/i.test(result.error.message)) {
        const signUpResult = await supabase.auth.signUp({
          email,
          password: pw,
          options: {
            data: { name: 'QA Tester', full_name: 'QA Tester' },
          },
        });

        if (signUpResult.error) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Dev Sign In Failed',
            getSupabaseErrorMessage(signUpResult.error.message),
          );
          return;
        }

        if (signUpResult.data.user && !signUpResult.data.session) {
          // Email confirmation is enabled in Supabase. Try to auto-confirm
          // the QA test user via the dev-confirm-user edge function, then
          // retry the sign-in. If the edge function isn't deployed or fails,
          // fall back to the manual-instructions alert.
          const { error: confirmError } = await supabase.functions.invoke(
            'dev-confirm-user',
            { body: JSON.stringify({ email }) },
          );

          if (confirmError) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
              'Email Confirmation Required',
              'The QA account was created but Supabase requires email confirmation,\n'
                + 'and the auto-confirm edge function is not deployed.\n\n'
                + 'To fix: deploy the function with\n'
                + '  supabase functions deploy dev-confirm-user --no-verify-jwt\n\n'
                + 'Or manually confirm the user in Supabase Dashboard → Authentication → Users.',
            );
            return;
          }

          // Email confirmed — retry sign-in with the same credentials
          const retryResult = await supabase.auth.signInWithPassword({
            email,
            password: pw,
          });

          if (retryResult.error) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
              'Dev Sign In Failed',
              getSupabaseErrorMessage(retryResult.error.message),
            );
            return;
          }

          result = {
            data: retryResult.data as any,
            error: null,
          };
        } else {
          result = {
            data: signUpResult.data as any,
            error: null,
          };
        }
      } else if (result.error) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Dev Sign In Failed', getSupabaseErrorMessage(result.error.message));
        return;
      }

      // Step 3: Success — persist and route
      if (result.data?.user) {
        void recordConsent(result.data.user.id).catch(() => {});
        await persistReturningUser('QA Tester', email);

        // Check if already onboarded
        let alreadyOnboarded = false;
        try {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('is_onboarded')
            .eq('id', result.data.user!.id)
            .single();
          alreadyOnboarded = !!profileRow?.is_onboarded;
        } catch {
          // Profile doesn't exist yet — go to role selection
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (alreadyOnboarded) {
          triggerSuccessAndRoute(() => router.replace('/(tabs)/(home)' as any));
        } else {
          triggerSuccessAndRoute(() => router.push('/role-selection' as any));
        }
      }
    } catch (err: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        Alert.alert('Connection Error', 'Unable to reach Supabase. Check your internet connection.');
      } else {
        Alert.alert('Dev Sign In Error', 'Something went wrong. Check console for details.');
      }
    } finally {
      setIsDevAutoSigningIn(false);
    }
  }, [
    isDevAutoSigningIn,
    isSubmitting,
    getQaCredentials,
    screenState,
    switchToAuth,
    persistReturningUser,
    triggerSuccessAndRoute,
    router,
  ]);

  // Kept for backward compat — tap still just fills the form
  const handleDevTestLongPress = useCallback(() => {
    void handleDevAutoSignIn();
  }, [handleDevAutoSignIn]);

  useEffect(() => {
    if (!pendingAutoSubmit || !identifier || !password) return;
    setPendingAutoSubmit(false);
    void handleDevAutoSignIn();
  }, [pendingAutoSubmit, identifier, password, handleDevAutoSignIn]);

  // ── Shimmer translate for bio button ──────────────────────────────────────
  const shimmerTranslate = bioShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_W, SCREEN_W],
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Background gradient ──────────────────────────────────────────── */}
      <LinearGradient
        colors={['#050C1E', '#080F25', '#0D1833']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* ── Ambient orbs ─────────────────────────────────────────────────── */}
      <AmbientOrb
        anim={orb1}
        color="rgba(58, 123, 213, 0.55)"
        size={380}
        baseX={-40}
        baseY={80}
        dX={30}
        dY={-20}
        opacity={0.6}
      />
      <AmbientOrb
        anim={orb2}
        color="rgba(232, 98, 42, 0.45)"
        size={320}
        baseX={SCREEN_W + 60}
        baseY={520}
        dX={-25}
        dY={20}
        opacity={0.5}
      />
      <AmbientOrb
        anim={orb3}
        color="rgba(74, 143, 232, 0.35)"
        size={260}
        baseX={SCREEN_W / 2}
        baseY={300}
        dX={20}
        dY={-15}
        opacity={0.35}
      />

      {/* ── Noise overlay (subtle texture) ───────────────────────────────── */}
      <View style={styles.noiseOverlay} pointerEvents="none" />

      <Animated.View style={[styles.flex, { opacity: masterFade }]}>

        {/* ══════════════════════════════════════════════════════════════════
            RETURNING USER VIEW — biometric unlock is the single primary action
        ══════════════════════════════════════════════════════════════════ */}
        {screenState === 'returning' && (
          <Animated.View
            style={[
              styles.flex,
              {
                opacity: returningFade,
                transform: [{ translateY: returningSlide }],
              },
            ]}
          >
            <View
              style={[
                styles.returningContainer,
                { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
              ]}
            >
              {/* Eyebrow + wordmark — the night-sky opener from the concept */}
              <View style={styles.returningMark}>
                <Text style={styles.returningEyebrow}>
                  Neighborhood watch, reimagined
                </Text>
                <Text style={styles.wordmark}>Porchivo</Text>
              </View>

              {/* Spacer pushes the porch-light hero into the vertical center */}
              <View style={styles.returningTopSpacer} />

              {/* Porch-light hero — the signature scene */}
              <View style={styles.porchHeroWrap}>
                <PorchLightScene stage={porchStage} size={260} />
                <View style={styles.porchStatusWrap}>
                  <PorchLightStatus stage={porchStage} />
                </View>
              </View>

              {/* Greeting — compact, sits under the scene */}
              <View style={styles.greetingBlock}>
                <Text style={styles.greetingTime}>{getTimeGreeting()}</Text>
                <Text style={styles.greetingName}>{returningName}</Text>
              </View>

              {/* Primary action — biometric unlock (default). Amber porch-light CTA. */}
              {biometricType ? (
                <>
                  <Animated.View
                    style={[
                      styles.bioButtonOuter,
                      { transform: [{ scale: bioButtonScale }] },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.bioButton}
                      onPress={handleBiometricAuth}
                      disabled={isBiometricLoading}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={['#FFE3B0', '#F5A855']}
                        style={styles.bioButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        {/* Shimmer sweep */}
                        <Animated.View
                          style={[
                            styles.shimmerOverlay,
                            { transform: [{ translateX: shimmerTranslate }] },
                          ]}
                          pointerEvents="none"
                        />
                        {isBiometricLoading ? (
                          <Text style={styles.bioButtonTextDark}>
                            {porchStage === 'verified' ? 'Verified' : 'Checking Face ID…'}
                          </Text>
                        ) : (
                          <>
                            {biometricType === 'face' ? (
                              <ScanFace size={22} color="#0B1526" />
                            ) : (
                              <Fingerprint size={22} color="#0B1526" />
                            )}
                            <Text style={styles.bioButtonTextDark}>
                              {biometricType === 'face'
                                ? 'Continue with Face ID'
                                : 'Continue with Touch ID'}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* OR divider */}
                  <View style={styles.porchDividerRow}>
                    <View style={styles.porchDividerLine} />
                    <Text style={styles.porchDividerText}>OR</Text>
                    <View style={styles.porchDividerLine} />
                  </View>

                  {/* Tucked fallback — email magic link, secondary border style */}
                  <TouchableOpacity
                    style={styles.porchEmailBtn}
                    onPress={() => switchToAuth('signin')}
                    activeOpacity={0.85}
                  >
                    <Mail size={16} color="rgba(201,214,232,0.8)" />
                    <Text style={styles.porchEmailBtnText}>Continue with email</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.bioButton}
                  onPress={() => switchToAuth('signin')}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={['#FFE3B0', '#F5A855']}
                    style={styles.bioButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Mail size={20} color="#0B1526" />
                    <Text style={styles.bioButtonTextDark}>Continue with email</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Trust line — the concept's encrypted-end-to-end copy */}
              <Text style={styles.trustLineText}>
                Encrypted end-to-end. Your address is only ever shared with your verified neighbors.
              </Text>

              {/* Not me? */}
              <TouchableOpacity
                style={styles.notMeBtn}
                onPress={() => switchToAuth('signin')}
                activeOpacity={0.7}
              >
                <Text style={styles.notMeText}>
                  Not {returningName}?
                </Text>
                <ChevronRight size={13} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            AUTH VIEW — passwordless-first: magic link primary,
            biometric option front-and-center, password tucked underneath
        ══════════════════════════════════════════════════════════════════ */}
        {screenState === 'auth' && (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              contentContainerStyle={[
                styles.authScrollContent,
                { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View
                style={{
                  opacity: formFade,
                  transform: [{ translateY: formSlide }],
                }}
              >
                {/* Back / header */}
                <View style={styles.authHeader}>
                  {returningName ? (
                    <TouchableOpacity
                      style={styles.authBackBtn}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setScreenState('returning');
                        returningFade.setValue(0);
                        returningSlide.setValue(20);
                        Animated.parallel([
                          Animated.timing(returningFade, {
                            toValue: 1,
                            duration: 350,
                            useNativeDriver: true,
                          }),
                          Animated.spring(returningSlide, {
                            toValue: 0,
                            tension: 60,
                            friction: 9,
                            useNativeDriver: true,
                          }),
                        ]).start();
                      }}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={22} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.authBackBtn}
                      onPress={() => router.back()}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={22} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Brand */}
                <View style={styles.brandBlock}>
                  <View style={styles.shieldIconRing}>
                    <LinearGradient
                      colors={['#1A4BAA', '#3A7BD5']}
                      style={styles.shieldIconGradient}
                    >
                      <Shield size={26} color="#fff" />
                    </LinearGradient>
                  </View>
                  <Text style={styles.brandName}>PORCHIVO</Text>
                  <Text style={styles.brandTagline}>Neighborhood Safety</Text>
                </View>

                {/* Security trust pill — visible during signup */}
                {authMode === 'signup' && (
                  <TouchableOpacity
                    style={styles.securityPill}
                    onPress={() => setSheet('encryption')}
                    activeOpacity={0.7}
                    testID="security-pill"
                  >
                    <Lock size={12} color="#4A8FE8" />
                    <Text style={styles.securityPillText}>
                      Your data is encrypted from sign-up
                    </Text>
                    <ChevronRight size={12} color="rgba(74,143,232,0.6)" />
                  </TouchableOpacity>
                )}

                {/* Mode toggle */}
                <View style={styles.modeToggleContainer}>
                  <View style={styles.modeToggle}>
                    <View
                      style={[
                        styles.modeToggleIndicator,
                        authMode === 'signup' && styles.modeToggleIndicatorRight,
                      ]}
                    />
                    <TouchableOpacity
                      style={styles.modeToggleBtn}
                      onPress={() => {
                        if (authMode !== 'signin') toggleAuthMode();
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.modeToggleText,
                          authMode === 'signin' && styles.modeToggleTextActive,
                        ]}
                      >
                        Sign In
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modeToggleBtn}
                      onPress={() => {
                        if (authMode !== 'signup') toggleAuthMode();
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.modeToggleText,
                          authMode === 'signup' && styles.modeToggleTextActive,
                        ]}
                      >
                        Create Account
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Magic link confirmation state ────────────────────────── */}
                {magicLinkSent ? (
                  <View style={styles.magicSentCard}>
                    <View style={styles.magicSentIcon}>
                      <Check size={30} color="#4A8FE8" strokeWidth={3} />
                    </View>
                    <Text style={styles.magicSentTitle}>Check your email</Text>
                    <Text style={styles.magicSentSub}>
                      We sent a secure sign-in link to{'\n'}
                      <Text style={styles.magicSentEmail}>{identifier.trim()}</Text>
                      {'\n\n'}Tap the link on your device to continue — no password needed.
                    </Text>
                    <TouchableOpacity
                      style={styles.magicSentResendBtn}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMagicLinkSent(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.magicSentResendText}>Use a different email</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.formCard}>
                    {/* Biometric quick-unlock option — front and center for returning users */}
                    {biometricType && authMode === 'signin' && (
                      <TouchableOpacity
                        style={styles.biometricQuickRow}
                        onPress={handleBiometricAuth}
                        disabled={isBiometricLoading}
                        activeOpacity={0.85}
                        testID="biometric-quick"
                      >
                        <View style={styles.biometricQuickIconWrap}>
                          {biometricType === 'face' ? (
                            <ScanFace size={20} color="#4A8FE8" />
                          ) : (
                            <Fingerprint size={20} color="#4A8FE8" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.biometricQuickTitle}>
                            {biometricType === 'face' ? 'Use Face ID' : 'Use Touch ID'}
                          </Text>
                          <Text style={styles.biometricQuickSub}>
                            Fastest way back in
                          </Text>
                        </View>
                        <ChevronRight size={16} color="rgba(74,143,232,0.6)" />
                      </TouchableOpacity>
                    )}

                    {/* Name (signup only) */}
                    {authMode === 'signup' && (
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <View
                          style={[
                            styles.inputRow,
                            errors.name ? styles.inputRowError : null,
                          ]}
                        >
                          <User size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
                          <TextInput
                            ref={nameRef}
                            style={styles.textInput}
                            placeholder="Your full name"
                            placeholderTextColor="rgba(255,255,255,0.28)"
                            value={name}
                            onChangeText={(t) => {
                              setName(t);
                              if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                            }}
                            autoCapitalize="words"
                            returnKeyType="next"
                            onSubmitEditing={() => passwordRef.current?.focus()}
                            testID="name-input"
                          />
                        </View>
                        {errors.name && (
                          <Text style={styles.errorText}>{errors.name}</Text>
                        )}
                      </View>
                    )}

                    {/* Email */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email Address</Text>
                      <View
                        style={[
                          styles.inputRow,
                          errors.identifier ? styles.inputRowError : null,
                        ]}
                      >
                        <Mail size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="you@example.com"
                          placeholderTextColor="rgba(255,255,255,0.28)"
                          value={identifier}
                          onChangeText={(t) => {
                            setIdentifier(t);
                            if (errors.identifier)
                              setErrors((p) => ({ ...p, identifier: undefined }));
                          }}
                          onEndEditing={() => {
                            if (identifier.trim())
                              void AsyncStorage.setItem(LAST_EMAIL_KEY, identifier.trim()).catch(() => {});
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          returnKeyType={credentialPath === 'password' ? 'next' : 'done'}
                          onSubmitEditing={() => {
                            if (credentialPath === 'password') passwordRef.current?.focus();
                            else if (authMode !== 'signup' || (name && acceptedTerms))
                              void handleMagicLink();
                          }}
                          testID="identifier-input"
                        />
                      </View>
                      {errors.identifier && (
                        <Text style={styles.errorText}>{errors.identifier}</Text>
                      )}
                    </View>

                    {/* Password — only on the password fallback path */}
                    {credentialPath === 'password' && (
                      <View style={styles.inputGroup}>
                        <View style={styles.passwordLabelRow}>
                          <Text style={styles.inputLabel}>Password</Text>
                          {authMode === 'signin' && (
                            <TouchableOpacity
                              onPress={handleForgotPassword}
                              activeOpacity={0.7}
                              testID="forgot-password"
                            >
                              <Text style={styles.forgotText}>Forgot?</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View
                          style={[
                            styles.inputRow,
                            errors.password ? styles.inputRowError : null,
                          ]}
                        >
                          <Lock size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
                          <TextInput
                            ref={passwordRef}
                            style={[styles.textInput, styles.passwordInput]}
                            placeholder={
                              authMode === 'signup'
                                ? 'Create a strong password'
                                : 'Enter your password'
                            }
                            placeholderTextColor="rgba(255,255,255,0.28)"
                            value={password}
                            onChangeText={(t) => {
                              setPassword(t);
                              if (errors.password)
                                setErrors((p) => ({ ...p, password: undefined }));
                            }}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="done"
                            onSubmitEditing={handlePasswordSubmit}
                            testID="password-input"
                          />
                          <TouchableOpacity
                            style={styles.eyeBtn}
                            onPress={() => setShowPassword((p) => !p)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            testID="toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff size={17} color="rgba(255,255,255,0.4)" />
                            ) : (
                              <Eye size={17} color="rgba(255,255,255,0.4)" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {errors.password && (
                          <Text style={styles.errorText}>{errors.password}</Text>
                        )}
                      </View>
                    )}

                    {/* Remember me (signin only) */}
                    {authMode === 'signin' && (
                      <TouchableOpacity
                        style={styles.rememberRow}
                        onPress={() => setRememberMe((p) => !p)}
                        activeOpacity={0.7}
                        testID="remember-me-switch"
                      >
                        <View
                          style={[
                            styles.rememberCheckbox,
                            rememberMe && styles.rememberCheckboxChecked,
                          ]}
                        >
                          {rememberMe && <Check size={11} color="#fff" strokeWidth={3} />}
                        </View>
                        <Text style={styles.rememberText}>Keep me signed in</Text>
                      </TouchableOpacity>
                    )}

                    {/* Terms (signup only) */}
                    {authMode === 'signup' && (
                      <>
                        <TouchableOpacity
                          style={styles.termsRow}
                          onPress={() => {
                            setAcceptedTerms((p) => !p);
                            if (errors.terms)
                              setErrors((p) => ({ ...p, terms: undefined }));
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: acceptedTerms }}
                          testID="terms-checkbox"
                        >
                          <View
                            style={[
                              styles.rememberCheckbox,
                              acceptedTerms && styles.rememberCheckboxChecked,
                            ]}
                          >
                            {acceptedTerms && <Check size={11} color="#fff" strokeWidth={3} />}
                          </View>
                          <Text style={styles.termsText}>
                            I agree to the{' '}
                            <Text
                              style={styles.termsLink}
                              onPress={() => setSheet('terms')}
                            >
                              Terms of Service
                            </Text>
                            {' '}and{' '}
                            <Text
                              style={styles.termsLink}
                              onPress={() => setSheet('privacy')}
                            >
                              Privacy Policy
                            </Text>
                          </Text>
                        </TouchableOpacity>
                        {errors.terms && (
                          <Text style={styles.errorText}>{errors.terms}</Text>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Submit button — primary action mirrors the active path */}
                {!magicLinkSent && (
                  <Animated.View style={{ transform: [{ scale: submitButtonScale }] }}>
                    <TouchableOpacity
                      style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                      onPress={
                        credentialPath === 'password' ? handlePasswordSubmit : handleMagicLink
                      }
                      disabled={isSubmitting}
                      activeOpacity={0.88}
                      testID="submit-btn"
                    >
                      <LinearGradient
                        colors={
                          isSubmitting
                            ? ['#1A4BAA', '#1A4BAA']
                            : ['#1A4BAA', '#3A7BD5', '#4A8FE8']
                        }
                        style={styles.submitBtnGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        {credentialPath !== 'password' && !isSubmitting && (
                          <Wand2 size={18} color="#fff" strokeWidth={2.4} />
                        )}
                        <Text style={styles.submitBtnText}>
                          {isSubmitting
                            ? authMode === 'signin'
                              ? 'Sending link…'
                              : 'Sending link…'
                            : credentialPath === 'password'
                            ? authMode === 'signin'
                              ? 'Sign In'
                              : 'Create Account'
                            : authMode === 'signin'
                            ? 'Send me a sign-in link'
                            : 'Send me a setup link'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {/* Tucked password fallback — secondary, never competing */}
                {!magicLinkSent && credentialPath !== 'password' && (
                  <TouchableOpacity
                    style={styles.fallbackToggle}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCredentialPath('password');
                      setErrors({});
                    }}
                    activeOpacity={0.7}
                    testID="use-password-fallback"
                  >
                    <Lock size={12} color="rgba(255,255,255,0.32)" />
                    <Text style={styles.fallbackToggleText}>
                      Prefer a password? Use password instead
                    </Text>
                  </TouchableOpacity>
                )}
                {!magicLinkSent && credentialPath === 'password' && (
                  <TouchableOpacity
                    style={styles.fallbackToggle}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCredentialPath('magiclink');
                      setErrors({});
                      setPassword('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Wand2 size={12} color="rgba(255,255,255,0.32)" />
                    <Text style={styles.fallbackToggleText}>
                      Go back to passwordless sign-in
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Switch mode */}
                <TouchableOpacity
                  style={styles.switchModeBtn}
                  onPress={toggleAuthMode}
                  activeOpacity={0.7}
                  testID="switch-mode"
                >
                  <Text style={styles.switchModeText}>
                    {authMode === 'signin'
                      ? "Don't have an account? "
                      : 'Already have an account? '}
                    <Text style={styles.switchModeLink}>
                      {authMode === 'signin' ? 'Create one' : 'Sign in'}
                    </Text>
                  </Text>
                </TouchableOpacity>

                {/* Guest mode entry — try before signup */}
                <TouchableOpacity
                  style={styles.guestBtn}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/guest-browse' as any);
                  }}
                  activeOpacity={0.7}
                  testID="guest-mode"
                >
                  <Sparkles size={12} color="rgba(74,143,232,0.7)" />
                  <Text style={styles.guestText}>Just looking? Browse a demo neighborhood</Text>
                </TouchableOpacity>

                {/* Support */}
                <TouchableOpacity
                  style={styles.supportBtn}
                  onPress={() => {
                    Alert.alert('Support', 'Contact us at support@porchivo.com', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Email Support',
                        onPress: () =>
                          Linking.openURL(
                            'mailto:support@porchivo.com?subject=Porchivo%20Support'
                          ),
                      },
                    ]);
                  }}
                  activeOpacity={0.7}
                  testID="support-link"
                >
                  <HelpCircle size={13} color="rgba(255,255,255,0.25)" />
                  <Text style={styles.supportText}>Need help? Contact support</Text>
                </TouchableOpacity>

                {/* Dev test — tap fills credentials, long press auto-signs-in */}
                {__DEV__ && (
                  <TouchableOpacity
                    style={styles.devBtn}
                    onPress={handleDevTestLogin}
                    onLongPress={handleDevTestLongPress}
                    delayLongPress={500}
                    activeOpacity={0.6}
                    disabled={isDevAutoSigningIn || isSubmitting}
                    testID="dev-test-login"
                  >
                    <Text style={styles.devText}>
                      {isDevAutoSigningIn
                        ? 'Signing in…'
                        : 'dev auto sign-in (long press)'}
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* Init state — blank (orbs visible) */}
        {screenState === 'init' && <View style={styles.flex} />}
      </Animated.View>

      {/* Security success micro-interaction overlay */}
      <SecuritySuccessOverlay
        visible={showSecurityOverlay}
        onComplete={handleSecurityComplete}
      />

      {/* Bottom sheets — replace full-screen legal takeovers */}
      <InfoSheet
        visible={sheet === 'encryption'}
        onClose={() => setSheet(null)}
        eyebrow="Security"
        title="Your data is encrypted"
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetP}>
            Porchivo encrypts your personal data in transit and at rest. Your street address
            is never shown to a Porch Partner without your explicit, per-delivery consent —
            partners see only an approximate area until you grant access.
          </Text>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Shield size={15} color="#4A8FE8" />
            </View>
            <Text style={styles.sheetBulletText}>
              AES-256 encryption on stored profile and shipment data
            </Text>
          </View>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Lock size={15} color="#4A8FE8" />
            </View>
            <Text style={styles.sheetBulletText}>
              Biometric unlock (Face ID / Touch ID) secures your local session
            </Text>
          </View>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Eye size={15} color="#4A8FE8" />
            </View>
            <Text style={styles.sheetBulletText}>
              Approximate locations hide your exact home until you opt in per delivery
            </Text>
          </View>
        </View>
      </InfoSheet>

      <InfoSheet
        visible={sheet === 'terms'}
        onClose={() => setSheet(null)}
        eyebrow="Legal"
        title="Terms of Service"
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetP}>
            By creating an account you agree to the Porchivo Terms of Service. The full
            document covers acceptable use, community guidelines, partner obligations,
            and limitation of liability.
          </Text>
          <Text style={styles.sheetP}>
            Highlights:
          </Text>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Check size={15} color="#4A8FE8" />
            </View>
            <Text style={styles.sheetBulletText}>
              Use Porchivo for lawful, neighborhood-safety purposes only
            </Text>
          </View>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Check size={15} color="#4A8FE8" />
            </View>
            <Text style={styles.sheetBulletText}>
              Respect neighbor privacy — no sharing addresses or photos beyond the app
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSheet(null);
              router.push('/terms-of-service' as any);
            }}
            activeOpacity={0.7}
            style={styles.sheetLinkRow}
          >
            <Text style={styles.sheetLinkText}>Read full Terms of Service</Text>
            <ChevronRight size={14} color="#4A8FE8" />
          </TouchableOpacity>
        </View>
      </InfoSheet>

      <InfoSheet
        visible={sheet === 'privacy'}
        onClose={() => setSheet(null)}
        eyebrow="Legal"
        title="Privacy Policy"
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetP}>
            Porchivo collects the minimum data needed to coordinate package safety in your
            neighborhood: your name, email, approximate block location, and shipment
            metadata you choose to track.
          </Text>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Lock size={15} color="#4A8FE8" />
            </View>
            <Text style={styles.sheetBulletText}>
              We never sell your data. No third-party ad trackers.
            </Text>
          </View>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Shield size={15} color="#4A8FE8" />
            </View>
            <Text style={styles.sheetBulletText}>
              You can export or delete your account at any time from Settings.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSheet(null);
              router.push('/privacy-policy' as any);
            }}
            activeOpacity={0.7}
            style={styles.sheetLinkRow}
          >
            <Text style={styles.sheetLinkText}>Read full Privacy Policy</Text>
            <ChevronRight size={14} color="#4A8FE8" />
          </TouchableOpacity>
        </View>
      </InfoSheet>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050C1E',
  },
  flex: {
    flex: 1,
  },
  orb: {
    position: 'absolute' as const,
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 12, 30, 0.12)',
  },

  // ── Returning User ──────────────────────────────────────────────────────
  returningContainer: {
    flex: 1,
    alignItems: 'center' as const,
    paddingHorizontal: 28,
  },
  returningMark: {
    alignItems: 'center' as const,
    gap: 6,
  },
  returningEyebrow: {
    color: 'rgba(201, 214, 232, 0.55)',
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  wordmark: {
    color: '#FBF7F0',
    fontSize: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
  },
  returningTopSpacer: {
    flex: 1,
    maxHeight: 56,
    minHeight: 24,
  },
  porchHeroWrap: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 14,
  },
  porchStatusWrap: {
    marginTop: 8,
    height: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  greetingBlock: {
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  greetingTime: {
    color: 'rgba(201, 214, 232, 0.5)',
    fontSize: 14,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  greetingName: {
    color: '#FBF7F0',
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -1.2,
  },
  bioButtonOuter: {
    width: '100%',
    marginBottom: 14,
  },
  bioButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden' as const,
    shadowColor: '#F5A855',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  bioButtonGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 18,
    gap: 10,
    overflow: 'hidden' as const,
  },
  shimmerOverlay: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ skewX: '-20deg' }],
  },
  bioButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  bioButtonTextDark: {
    color: '#0B1526',
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  porchDividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 4,
    marginBottom: 4,
    width: '100%',
  },
  porchDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(201, 214, 232, 0.15)',
  },
  porchDividerText: {
    color: 'rgba(201, 214, 232, 0.4)',
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
  },
  porchEmailBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201, 214, 232, 0.2)',
    marginBottom: 12,
  },
  porchEmailBtnText: {
    color: '#FBF7F0',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  trustLineText: {
    color: 'rgba(201, 214, 232, 0.35)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center' as const,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  notMeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 'auto' as const,
    paddingVertical: 12,
  },
  notMeText: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 13,
    fontWeight: '500' as const,
  },

  // ── Auth form ──────────────────────────────────────────────────────────
  authScrollContent: {
    paddingHorizontal: 24,
  },
  authHeader: {
    marginBottom: 16,
  },
  authBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  brandBlock: {
    alignItems: 'center' as const,
    marginBottom: 18,
  },
  shieldIconRing: {
    width: 68,
    height: 68,
    borderRadius: 22,
    overflow: 'hidden' as const,
    marginBottom: 12,
    shadowColor: '#3A7BD5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  shieldIconGradient: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: 4,
    marginBottom: 4,
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 1.5,
  },
  securityPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    alignSelf: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(74,143,232,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(74,143,232,0.22)',
    marginBottom: 20,
  },
  securityPillText: {
    color: '#7FB0F2',
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  modeToggleContainer: {
    alignItems: 'center' as const,
    marginBottom: 22,
  },
  modeToggle: {
    flexDirection: 'row' as const,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative' as const,
  },
  modeToggleIndicator: {
    position: 'absolute' as const,
    top: 4,
    left: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: 'rgba(58, 123, 213, 0.85)',
    borderRadius: 10,
  },
  modeToggleIndicatorRight: {
    left: undefined,
    right: 4,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center' as const,
    zIndex: 1,
  },
  modeToggleText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    marginBottom: 16,
    gap: 4,
  },
  biometricQuickRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: 'rgba(74,143,232,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(74,143,232,0.22)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  biometricQuickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74,143,232,0.18)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  biometricQuickTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700' as const,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  biometricQuickSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    minHeight: 52,
  },
  inputRowError: {
    borderColor: 'rgba(229, 72, 77, 0.7)',
    backgroundColor: 'rgba(229, 72, 77, 0.06)',
  },
  inputIcon: {
    marginLeft: 14,
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute' as const,
    right: 14,
    height: 52,
    justifyContent: 'center' as const,
  },
  passwordLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  forgotText: {
    color: '#4A8FE8',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
    fontWeight: '500' as const,
  },
  rememberRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingTop: 4,
  },
  rememberCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'transparent',
  },
  rememberCheckboxChecked: {
    backgroundColor: '#3A7BD5',
    borderColor: '#3A7BD5',
  },
  rememberText: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  termsRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    marginTop: 4,
  },
  termsText: {
    flex: 1,
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    lineHeight: 19,
  },
  termsLink: {
    color: '#4A8FE8',
    fontWeight: '600' as const,
  },
  // ── Magic link sent state ──
  magicSentCard: {
    backgroundColor: 'rgba(74,143,232,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(74,143,232,0.22)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center' as const,
    marginBottom: 18,
  },
  magicSentIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(74,143,232,0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 14,
  },
  magicSentTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  magicSentSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center' as const,
  },
  magicSentEmail: {
    color: '#7FB0F2',
    fontWeight: '700' as const,
  },
  magicSentResendBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  magicSentResendText: {
    color: '#4A8FE8',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  submitBtn: {
    borderRadius: 18,
    overflow: 'hidden' as const,
    marginBottom: 10,
    shadowColor: '#3A7BD5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
    elevation: 10,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 17,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  fallbackToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    paddingVertical: 10,
    marginBottom: 10,
  },
  fallbackToggleText: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 12.5,
    fontWeight: '500' as const,
  },
  dividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  switchModeBtn: {
    alignItems: 'center' as const,
    paddingVertical: 8,
    marginBottom: 10,
  },
  switchModeText: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 14,
    textAlign: 'center' as const,
  },
  switchModeLink: {
    color: '#4A8FE8',
    fontWeight: '700' as const,
  },
  guestBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(74,143,232,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(74,143,232,0.15)',
  },
  guestText: {
    color: 'rgba(127,176,242,0.85)',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  supportBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
  },
  supportText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 13,
  },
  devBtn: {
    alignSelf: 'center' as const,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    opacity: 0.3,
  },
  devText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '600' as const,
  },
  // ── Bottom sheet body ──
  sheetBody: {
    paddingBottom: 12,
  },
  sheetP: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 10,
  },
  sheetBulletRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 7,
  },
  sheetBulletIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(74,143,232,0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sheetBulletText: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500' as const,
  },
  sheetLinkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    marginTop: 6,
  },
  sheetLinkText: {
    color: '#4A8FE8',
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
