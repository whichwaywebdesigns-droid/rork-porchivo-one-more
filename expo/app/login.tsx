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
  ImageBackground,
  Image,
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
} from '@/components/onboarding';
import type { PorchLightStage } from '@/components/onboarding';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const LAST_NAME_KEY = 'porchivo_last_name';
const LAST_INITIAL_KEY = 'porchivo_last_initial';
const LAST_EMAIL_KEY = 'porchivo_saved_email';
const REMEMBER_ME_KEY = 'porchivo_remember_me';

type ScreenState = 'init' | 'returning' | 'auth';
type AuthMode = 'signin' | 'signup';
type CredentialPath = 'biometric' | 'magiclink' | 'password';

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning,';
  if (h >= 12 && h < 17) return 'Good afternoon,';
  if (h >= 17 && h < 21) return 'Good evening,';
  return 'Good night,';
}

/**
 * Static logo block — kept at module level so its reference is stable across
 * re-renders. Defining it inside LoginScreen would create a new component
 * type on every keystroke, causing React to unmount/remount the Image and
 * flicker the logo.
 */
function LogoBlock() {
  return (
    <View style={styles.logoBlock}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logoImage} />
      <Text style={styles.logoTitle}>Porchivo</Text>
      <Text style={styles.logoTagline}>When porch pirates lurk, neighbors go to work.</Text>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();

  const [screenState, setScreenState] = useState<ScreenState>('init');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [credentialPath, setCredentialPath] = useState<CredentialPath>('biometric');

  const [returningName, setReturningName] = useState<string>('');
  const [, setReturningInitial] = useState<string>('');

  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null);
  const [isBiometricLoading, setIsBiometricLoading] = useState<boolean>(false);
  const [biometricTriggered, setBiometricTriggered] = useState<boolean>(false);

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

  const [magicLinkSent, setMagicLinkSent] = useState<boolean>(false);
  const [showSecurityOverlay, setShowSecurityOverlay] = useState<boolean>(false);
  const pendingRouteRef = useRef<(() => void) | null>(null);
  const [sheet, setSheet] = useState<'encryption' | 'terms' | 'privacy' | null>(null);

  const porchStage: PorchLightStage = showSecurityOverlay
    ? 'verified'
    : isBiometricLoading
    ? 'authenticating'
    : 'idle';

  const [pendingAutoSubmit, setPendingAutoSubmit] = useState<boolean>(false);
  const [isDevAutoSigningIn, setIsDevAutoSigningIn] = useState<boolean>(false);

  const masterFade = useRef(new Animated.Value(0)).current;
  const returningFade = useRef(new Animated.Value(0)).current;
  const returningSlide = useRef(new Animated.Value(40)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;
  const modeSlide = useRef(new Animated.Value(0)).current;
  const submitButtonScale = useRef(new Animated.Value(1)).current;
  const bioButtonScale = useRef(new Animated.Value(1)).current;

  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(masterFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [masterFade]);

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

        let bioType: 'face' | 'fingerprint' | null = null;
        try {
          const hasHw = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHw && isEnrolled) {
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) bioType = 'face';
            else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) bioType = 'fingerprint';
          }
        } catch {}

        setBiometricType(bioType);

        if (isReturning) {
          setReturningName(savedName!.split(' ')[0]);
          setReturningInitial(savedInitial || savedName!.charAt(0).toUpperCase());
          setScreenState('returning');
          setCredentialPath(bioType ? 'biometric' : 'magiclink');
          Animated.parallel([
            Animated.spring(returningSlide, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
            Animated.timing(returningFade, { toValue: 1, duration: 500, useNativeDriver: true }),
          ]).start();
        } else {
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

  useEffect(() => {
    if (screenState === 'returning' && biometricType && credentialPath === 'biometric' && !biometricTriggered) {
      setBiometricTriggered(true);
      const timer = setTimeout(() => void handleBiometricAuth(), 700);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenState, biometricType, credentialPath]);

  function animateFormIn() {
    Animated.parallel([
      Animated.timing(formFade, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(formSlide, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }

  const switchToAuth = useCallback((mode: AuthMode = 'signin') => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAuthMode(mode);
    setErrors({});
    setCredentialPath(biometricType ? 'biometric' : 'magiclink');
    setScreenState('auth');
    formFade.setValue(0);
    formSlide.setValue(20);
    animateFormIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricType]);

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

  const handleBiometricAuth = useCallback(async () => {
    if (isBiometricLoading) return;
    setIsBiometricLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(bioButtonScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(bioButtonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Porchivo',
        fallbackLabel: 'Use email instead',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          triggerSuccessAndRoute(() => router.replace('/(tabs)/(home)' as any));
        } else {
          Alert.alert(
            'Session Expired',
            'Your session has expired. Sign in with your email to continue — no password needed.',
            [{ text: 'Continue', onPress: () => switchToAuth('signin') }]
          );
        }
      }
    } catch {}
    setIsBiometricLoading(false);
  }, [isBiometricLoading, bioButtonScale, router, switchToAuth, triggerSuccessAndRoute]);

  const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateMagicLink = useCallback((): boolean => {
    const errs: typeof errors = {};
    if (!identifier.trim()) errs.identifier = 'Email is required';
    else if (!validateEmail(identifier)) errs.identifier = 'Enter a valid email address';
    if (authMode === 'signup' && !name.trim()) errs.name = 'Full name is required';
    if (authMode === 'signup' && !acceptedTerms) errs.terms = 'You must accept the Terms of Service and Privacy Policy';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [identifier, name, authMode, acceptedTerms]);

  const validatePassword = useCallback((): boolean => {
    const errs: typeof errors = {};
    if (!identifier.trim()) errs.identifier = 'Email is required';
    else if (!validateEmail(identifier)) errs.identifier = 'Enter a valid email address';
    if (!password.trim()) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (authMode === 'signup' && !name.trim()) errs.name = 'Full name is required';
    if (authMode === 'signup' && !acceptedTerms) errs.terms = 'You must accept the Terms of Service and Privacy Policy';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [identifier, password, name, authMode, acceptedTerms]);

  const getSupabaseErrorMessage = (error: string): string => {
    if (error.includes('Invalid login credentials')) return 'Incorrect email or password. Please try again.';
    if (error.includes('Email not confirmed')) return 'Please confirm your email before signing in.';
    if (error.includes('User already registered')) return 'An account with this email already exists. Try signing in.';
    if (error.includes('Password should be at least')) return 'Password must be at least 8 characters.';
    if (error.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
    if (error.includes('Signups not allowed')) return 'Sign ups are currently disabled. Please contact support.';
    return 'Something went wrong. Please try again.';
  };

  const persistReturningUser = useCallback(async (displayName: string, email: string) => {
    const firstName = displayName.trim().split(' ')[0];
    await Promise.all([
      AsyncStorage.setItem(LAST_NAME_KEY, firstName),
      AsyncStorage.setItem(LAST_INITIAL_KEY, displayName.charAt(0).toUpperCase()),
      AsyncStorage.setItem(LAST_EMAIL_KEY, email.trim()),
      AsyncStorage.setItem(REMEMBER_ME_KEY, 'true'),
    ]);
  }, []);

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
        Alert.alert('Setup Required', 'The app backend is not configured yet.');
        setIsSubmitting(false);
        return;
      }

      const redirectTo = 'porchivo://reset-password';
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

      if (authMode === 'signup') {
        void recordConsent(identifier.trim()).catch(() => {});
        await persistReturningUser(name || identifier, identifier);
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMagicLinkSent(true);
    } catch {
      const probe = await pingSupabase();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Connection Error', !probe.ok ? 'Server unreachable. Check your internet connection.' : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, validateMagicLink, submitButtonScale, authMode, identifier, name, persistReturningUser]);

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
        Alert.alert('Setup Required', 'The app backend is not configured yet.');
        setIsSubmitting(false);
        return;
      }

      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: identifier.trim(),
          password,
          options: { data: { name: name.trim(), full_name: name.trim() } },
        });

        if (error) {
          Alert.alert('Sign Up Failed', getSupabaseErrorMessage(error.message));
          setIsSubmitting(false);
          return;
        }

        if (data.user && !data.session) {
          Alert.alert('Check Your Email', 'We sent a confirmation link to your email. Please confirm your account, then sign in.', [
            { text: 'OK', onPress: () => setAuthMode('signin') },
          ]);
          setIsSubmitting(false);
          return;
        }

        if (data.user?.id) void recordConsent(data.user.id);
        await persistReturningUser(name, identifier);
        triggerSuccessAndRoute(() => router.push('/role-selection' as any));
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: identifier.trim(),
          password,
        });

        if (error) {
          Alert.alert('Sign In Failed', getSupabaseErrorMessage(error.message));
          setIsSubmitting(false);
          return;
        }

        if (rememberMe) {
          const profile = data.user?.user_metadata;
          const displayName: string = (profile?.name as string | undefined) || (profile?.full_name as string | undefined) || '';
          if (displayName) await persistReturningUser(displayName, identifier);
          else await Promise.all([AsyncStorage.setItem(REMEMBER_ME_KEY, 'true'), AsyncStorage.setItem(LAST_EMAIL_KEY, identifier.trim())]);
        } else {
          await Promise.all([AsyncStorage.setItem(REMEMBER_ME_KEY, 'false'), AsyncStorage.removeItem(LAST_EMAIL_KEY)]);
        }

        let alreadyOnboarded = false;
        try {
          const { data: profileRow } = await supabase.from('profiles').select('is_onboarded').eq('id', data.user!.id).single();
          alreadyOnboarded = !!profileRow?.is_onboarded;
        } catch {}

        if (alreadyOnboarded) triggerSuccessAndRoute(() => router.replace('/(tabs)/(home)' as any));
        else triggerSuccessAndRoute(() => router.push('/role-selection' as any));
      }
    } catch (err: any) {
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        Alert.alert('Connection Error', 'Unable to reach the server. Check your internet connection.');
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, validatePassword, submitButtonScale, router, authMode, identifier, password, name, rememberMe, persistReturningUser, triggerSuccessAndRoute]);

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

  const handleForgotPassword = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (identifier.trim() && validateEmail(identifier.trim())) {
      Alert.alert('Reset Password', `We'll send a reset link to ${identifier.trim()}.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reset Link',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
                redirectTo: 'porchivo://reset-password',
              });
              if (error) Alert.alert('Error', getSupabaseErrorMessage(error.message));
              else Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
            } catch {
              Alert.alert('Error', 'Could not send reset email. Please try again.');
            }
          },
        },
      ]);
    } else {
      Alert.alert('Reset Password', 'Enter your email address above, then tap "Forgot?".');
    }
  }, [identifier]);

  const handleGoogleSignIn = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Google Sign In', 'Google authentication is coming soon.');
  }, []);

  const getQaCredentials = useCallback((): { email: string; password: string } => ({
    email: process.env.EXPO_PUBLIC_QA_EMAIL ?? 'qa@porchivo.dev',
    password: process.env.EXPO_PUBLIC_QA_PASSWORD ?? 'PorchivoQA2025!',
  }), []);

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

  const handleDevAutoSignIn = useCallback(async () => {
    if (isDevAutoSigningIn || isSubmitting) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { email, password: pw } = getQaCredentials();
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

      let result = await supabase.auth.signInWithPassword({ email, password: pw });

      if (result.error && /invalid login credentials/i.test(result.error.message)) {
        const signUpResult = await supabase.auth.signUp({
          email,
          password: pw,
          options: { data: { name: 'QA Tester', full_name: 'QA Tester' } },
        });

        if (signUpResult.error) {
          Alert.alert('Dev Sign In Failed', getSupabaseErrorMessage(signUpResult.error.message));
          return;
        }

        if (signUpResult.data.user && !signUpResult.data.session) {
          const { error: confirmError } = await supabase.functions.invoke('dev-confirm-user', {
            body: JSON.stringify({ email }),
          });

          if (confirmError) {
            Alert.alert(
              'Email Confirmation Required',
              'The QA account was created but Supabase requires email confirmation, and the auto-confirm edge function is not deployed.\n\nTo fix: deploy the function with\n  supabase functions deploy dev-confirm-user --no-verify-jwt\n\nOr manually confirm the user in Supabase Dashboard → Authentication → Users.'
            );
            return;
          }

          const retryResult = await supabase.auth.signInWithPassword({ email, password: pw });
          if (retryResult.error) {
            Alert.alert('Dev Sign In Failed', getSupabaseErrorMessage(retryResult.error.message));
            return;
          }
          result = { data: retryResult.data as any, error: null };
        } else {
          result = { data: signUpResult.data as any, error: null };
        }
      } else if (result.error) {
        Alert.alert('Dev Sign In Failed', getSupabaseErrorMessage(result.error.message));
        return;
      }

      if (result.data?.user) {
        void recordConsent(result.data.user.id).catch(() => {});
        await persistReturningUser('QA Tester', email);
        let alreadyOnboarded = false;
        try {
          const { data: profileRow } = await supabase.from('profiles').select('is_onboarded').eq('id', result.data.user!.id).single();
          alreadyOnboarded = !!profileRow?.is_onboarded;
        } catch {}

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (alreadyOnboarded) triggerSuccessAndRoute(() => router.replace('/(tabs)/(home)' as any));
        else triggerSuccessAndRoute(() => router.push('/role-selection' as any));
      }
    } catch (err: any) {
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        Alert.alert('Connection Error', 'Unable to reach Supabase. Check your internet connection.');
      } else {
        Alert.alert('Dev Sign In Error', 'Something went wrong. Check console for details.');
      }
    } finally {
      setIsDevAutoSigningIn(false);
    }
  }, [isDevAutoSigningIn, isSubmitting, getQaCredentials, screenState, switchToAuth, persistReturningUser, triggerSuccessAndRoute, router]);

  const handleDevTestLongPress = useCallback(() => {
    void handleDevAutoSignIn();
  }, [handleDevAutoSignIn]);

  useEffect(() => {
    if (!pendingAutoSubmit || !identifier || !password) return;
    setPendingAutoSubmit(false);
    void handleDevAutoSignIn();
  }, [pendingAutoSubmit, identifier, password, handleDevAutoSignIn]);

  const renderHeader = () => (
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
              Animated.timing(returningFade, { toValue: 1, duration: 350, useNativeDriver: true }),
              Animated.spring(returningSlide, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
            ]).start();
          }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color="#1B3A6B" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.authBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#1B3A6B" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderModeToggle = () => (
    <View style={styles.modeToggleWrap}>
      <View style={styles.modeToggle}>
        <Animated.View
          style={[
            styles.modeToggleIndicator,
            {
              transform: [
                {
                  translateX: modeSlide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, SCREEN_W * 0.5 - 36],
                  }),
                },
              ],
            },
          ]}
        />
        <TouchableOpacity
          style={styles.modeToggleBtn}
          onPress={() => {
            if (authMode !== 'signin') toggleAuthMode();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.modeToggleText, authMode === 'signin' && styles.modeToggleTextActive]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modeToggleBtn}
          onPress={() => {
            if (authMode !== 'signup') toggleAuthMode();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.modeToggleText, authMode === 'signup' && styles.modeToggleTextActive]}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInput = (
    icon: React.ReactNode,
    label: string,
    value: string,
    onChange: (t: string) => void,
    placeholder: string,
    props?: any,
    error?: string,
    suffix?: React.ReactNode
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <View style={styles.inputIcon}>{icon}</View>
        <TextInput
          style={[styles.textInput, suffix ? { paddingRight: 44 } : null]}
          placeholder={placeholder}
          placeholderTextColor="rgba(101, 66, 35, 0.45)"
          value={value}
          onChangeText={onChange}
          {...props}
        />
        {suffix}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  const renderAuthForm = () => (
    <Animated.View style={{ opacity: formFade, transform: [{ translateY: formSlide }] }}>
      {renderHeader()}
      <LogoBlock />

      {authMode === 'signup' && (
        <TouchableOpacity style={styles.securityPill} onPress={() => setSheet('encryption')} activeOpacity={0.7}>
          <Lock size={12} color="#1B3A6B" />
          <Text style={styles.securityPillText}>Your data is encrypted from sign-up</Text>
          <ChevronRight size={12} color="rgba(27,58,107,0.5)" />
        </TouchableOpacity>
      )}

      {renderModeToggle()}

      {magicLinkSent ? (
        <View style={styles.magicSentCard}>
          <View style={styles.magicSentIcon}>
            <Check size={30} color="#1B3A6B" strokeWidth={3} />
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
          {biometricType && authMode === 'signin' && (
            <TouchableOpacity style={styles.biometricQuickRow} onPress={handleBiometricAuth} disabled={isBiometricLoading} activeOpacity={0.85} testID="biometric-quick">
              <View style={styles.biometricQuickIconWrap}>
                {biometricType === 'face' ? <ScanFace size={20} color="#1B3A6B" /> : <Fingerprint size={20} color="#1B3A6B" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.biometricQuickTitle}>{biometricType === 'face' ? 'Use Face ID' : 'Use Touch ID'}</Text>
                <Text style={styles.biometricQuickSub}>Fastest way back in</Text>
              </View>
              <ChevronRight size={16} color="rgba(27,58,107,0.5)" />
            </TouchableOpacity>
          )}

          {authMode === 'signup' &&
            renderInput(
              <User size={18} color="#7A5533" />,
              'Full Name',
              name,
              (t) => {
                setName(t);
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              },
              'Your full name',
              { autoCapitalize: 'words', returnKeyType: 'next', onSubmitEditing: () => passwordRef.current?.focus(), testID: 'name-input' },
              errors.name
            )}

          {renderInput(
            <Mail size={18} color="#7A5533" />,
            'Email Address',
            identifier,
            (t) => {
              setIdentifier(t);
              if (errors.identifier) setErrors((p) => ({ ...p, identifier: undefined }));
            },
            'you@example.com',
            {
              keyboardType: 'email-address',
              autoCapitalize: 'none',
              autoCorrect: false,
              returnKeyType: credentialPath === 'password' ? 'next' : 'done',
              onSubmitEditing: () => {
                if (credentialPath === 'password') passwordRef.current?.focus();
                else if (authMode !== 'signup' || (name && acceptedTerms)) void handleMagicLink();
              },
              testID: 'identifier-input',
            },
            errors.identifier
          )}

          {credentialPath === 'password' && (
            <View style={styles.inputGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.inputLabel}>Password</Text>
                {authMode === 'signin' && (
                  <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7} testID="forgot-password">
                    <Text style={styles.forgotText}>Forgot?</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.inputRow, errors.password ? styles.inputRowError : null]}>
                <View style={styles.inputIcon}>
                  <Lock size={18} color="#7A5533" />
                </View>
                <TextInput
                  ref={passwordRef}
                  style={[styles.textInput, { paddingRight: 44 }]}
                  placeholder={authMode === 'signup' ? 'Create a strong password' : 'Enter your password'}
                  placeholderTextColor="rgba(101, 66, 35, 0.45)"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
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
                  {showPassword ? <EyeOff size={17} color="#7A5533" /> : <Eye size={17} color="#7A5533" />}
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>
          )}

          {authMode === 'signin' && (
            <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe((p) => !p)} activeOpacity={0.7} testID="remember-me-switch">
              <View style={[styles.rememberCheckbox, rememberMe && styles.rememberCheckboxChecked]}>
                {rememberMe && <Check size={11} color="#fff" strokeWidth={3} />}
              </View>
              <Text style={styles.rememberText}>Keep me signed in</Text>
            </TouchableOpacity>
          )}

          {authMode === 'signup' && (
            <>
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => {
                  setAcceptedTerms((p) => !p);
                  if (errors.terms) setErrors((p) => ({ ...p, terms: undefined }));
                }}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                testID="terms-checkbox"
              >
                <View style={[styles.rememberCheckbox, acceptedTerms && styles.rememberCheckboxChecked]}>
                  {acceptedTerms && <Check size={11} color="#fff" strokeWidth={3} />}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => setSheet('terms')}>
                    Terms of Service
                  </Text>{' '}
                  and{' '}
                  <Text style={styles.termsLink} onPress={() => setSheet('privacy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>
              {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}
            </>
          )}
        </View>
      )}

      {!magicLinkSent && (
        <Animated.View style={{ transform: [{ scale: submitButtonScale }] }}>
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={credentialPath === 'password' ? handlePasswordSubmit : handleMagicLink}
            disabled={isSubmitting}
            activeOpacity={0.88}
            testID="submit-btn"
          >
            <LinearGradient
              colors={isSubmitting ? ['#1B3A6B', '#1B3A6B'] : ['#1B3A6B', '#2C5299']}
              style={styles.submitBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {credentialPath !== 'password' && !isSubmitting && <Wand2 size={18} color="#fff" strokeWidth={2.4} />}
              <Text style={styles.submitBtnText}>
                {isSubmitting
                  ? 'Sending link…'
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
          <Lock size={12} color="rgba(27,58,107,0.55)" />
          <Text style={styles.fallbackToggleText}>Prefer a password? Use password instead</Text>
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
          <Wand2 size={12} color="rgba(27,58,107,0.55)" />
          <Text style={styles.fallbackToggleText}>Go back to passwordless sign-in</Text>
        </TouchableOpacity>
      )}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} activeOpacity={0.85}>
        <View style={styles.googleIcon}>
          <Text style={styles.googleIconText}>G</Text>
        </View>
        <Text style={styles.googleBtnText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.switchModeBtn} onPress={toggleAuthMode} activeOpacity={0.7} testID="switch-mode">
        <Text style={styles.switchModeText}>
          {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <Text style={styles.switchModeLink}>{authMode === 'signin' ? 'Sign up' : 'Sign in'}</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.guestBtn}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/guest-browse' as any);
        }}
        activeOpacity={0.7}
        testID="guest-mode"
      >
        <Sparkles size={12} color="rgba(27,58,107,0.7)" />
        <Text style={styles.guestText}>Just looking? Browse a demo neighborhood</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.supportBtn}
        onPress={() => {
          Alert.alert('Support', 'Contact us at support@porchivo.com', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@porchivo.com?subject=Porchivo%20Support') },
          ]);
        }}
        activeOpacity={0.7}
        testID="support-link"
      >
        <HelpCircle size={13} color="rgba(27,58,107,0.5)" />
        <Text style={styles.supportText}>Need help? Contact support</Text>
      </TouchableOpacity>

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
          <Text style={styles.devText}>{isDevAutoSigningIn ? 'Signing in…' : 'dev auto sign-in (long press)'}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  return (
    <ImageBackground
      source={require('@/assets/images/login-porch-bg.png')}
      style={styles.root}
      resizeMode="cover"
    >
      <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.95)']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <Animated.View style={[styles.flex, { opacity: masterFade }]}>
        {screenState === 'returning' && (
          <Animated.View
            style={[
              styles.flex,
              { opacity: returningFade, transform: [{ translateY: returningSlide }] },
            ]}
          >
            <View
              style={[
                styles.returningContainer,
                { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
              ]}
            >
              <View style={styles.returningMark}>
                <Text style={styles.returningEyebrow}>Neighborhood watch, reimagined</Text>
                <Text style={styles.wordmark}>Porchivo</Text>
              </View>

              <View style={{ flex: 1, justifyContent: 'center' }}>
                <View style={styles.porchHeroWrap}>
                  <PorchLightScene stage={porchStage} size={240} />
                  <View style={styles.porchStatusWrap}>
                    <PorchLightStatus stage={porchStage} />
                  </View>
                </View>

                <View style={styles.greetingBlock}>
                  <Text style={styles.greetingTime}>{getTimeGreeting()}</Text>
                  <Text style={styles.greetingName}>{returningName}</Text>
                </View>

                {biometricType ? (
                  <>
                    <Animated.View style={[styles.bioButtonOuter, { transform: [{ scale: bioButtonScale }] }]}>
                      <TouchableOpacity style={styles.bioButton} onPress={handleBiometricAuth} disabled={isBiometricLoading} activeOpacity={0.9}>
                        <LinearGradient colors={['#1B3A6B', '#2C5299']} style={styles.bioButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          {isBiometricLoading ? (
                            <Text style={styles.bioButtonText}>{porchStage === 'verified' ? 'Verified' : 'Checking Face ID…'}</Text>
                          ) : (
                            <>
                              {biometricType === 'face' ? <ScanFace size={22} color="#fff" /> : <Fingerprint size={22} color="#fff" />}
                              <Text style={styles.bioButtonText}>
                                {biometricType === 'face' ? 'Continue with Face ID' : 'Continue with Touch ID'}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.porchDividerRow}>
                      <View style={styles.porchDividerLine} />
                      <Text style={styles.porchDividerText}>OR</Text>
                      <View style={styles.porchDividerLine} />
                    </View>

                    <TouchableOpacity style={styles.porchEmailBtn} onPress={() => switchToAuth('signin')} activeOpacity={0.85}>
                      <Mail size={16} color="#1B3A6B" />
                      <Text style={styles.porchEmailBtnText}>Continue with email</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.bioButton} onPress={() => switchToAuth('signin')} activeOpacity={0.9}>
                    <LinearGradient colors={['#1B3A6B', '#2C5299']} style={styles.bioButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Mail size={20} color="#fff" />
                      <Text style={styles.bioButtonText}>Continue with email</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.trustLineText}>
                Encrypted end-to-end. Your address is only ever shared with your verified neighbors.
              </Text>

              <TouchableOpacity style={styles.notMeBtn} onPress={() => switchToAuth('signin')} activeOpacity={0.7}>
                <Text style={styles.notMeText}>Not {returningName}?</Text>
                <ChevronRight size={13} color="rgba(27,58,107,0.5)" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {screenState === 'auth' && (
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
            <ScrollView
              contentContainerStyle={[
                styles.authScrollContent,
                { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {renderAuthForm()}
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {screenState === 'init' && <View style={styles.flex} />}
      </Animated.View>

      <SecuritySuccessOverlay visible={showSecurityOverlay} onComplete={handleSecurityComplete} />

      <InfoSheet visible={sheet === 'encryption'} onClose={() => setSheet(null)} eyebrow="Security" title="Your data is encrypted">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetP}>
            Porchivo encrypts your personal data in transit and at rest. Your street address is never shown to a Porch Partner without your explicit, per-delivery consent — partners see only an approximate area until you grant access.
          </Text>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Shield size={15} color="#1B3A6B" />
            </View>
            <Text style={styles.sheetBulletText}>AES-256 encryption on stored profile and shipment data</Text>
          </View>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Lock size={15} color="#1B3A6B" />
            </View>
            <Text style={styles.sheetBulletText}>Biometric unlock (Face ID / Touch ID) secures your local session</Text>
          </View>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Eye size={15} color="#1B3A6B" />
            </View>
            <Text style={styles.sheetBulletText}>Approximate locations hide your exact home until you opt in per delivery</Text>
          </View>
        </View>
      </InfoSheet>

      <InfoSheet visible={sheet === 'terms'} onClose={() => setSheet(null)} eyebrow="Legal" title="Terms of Service">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetP}>
            By creating an account you agree to the Porchivo Terms of Service. The full document covers acceptable use, community guidelines, partner obligations, and limitation of liability.
          </Text>
          <Text style={styles.sheetP}>Highlights:</Text>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Check size={15} color="#1B3A6B" />
            </View>
            <Text style={styles.sheetBulletText}>Use Porchivo for lawful, neighborhood-safety purposes only</Text>
          </View>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Check size={15} color="#1B3A6B" />
            </View>
            <Text style={styles.sheetBulletText}>Respect neighbor privacy — no sharing addresses or photos beyond the app</Text>
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
            <ChevronRight size={14} color="#1B3A6B" />
          </TouchableOpacity>
        </View>
      </InfoSheet>

      <InfoSheet visible={sheet === 'privacy'} onClose={() => setSheet(null)} eyebrow="Legal" title="Privacy Policy">
        <View style={styles.sheetBody}>
          <Text style={styles.sheetP}>
            Porchivo collects the minimum data needed to coordinate package safety in your neighborhood: your name, email, approximate block location, and shipment metadata you choose to track.
          </Text>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Lock size={15} color="#1B3A6B" />
            </View>
            <Text style={styles.sheetBulletText}>We never sell your data. No third-party ad trackers.</Text>
          </View>
          <View style={styles.sheetBulletRow}>
            <View style={styles.sheetBulletIcon}>
              <Shield size={15} color="#1B3A6B" />
            </View>
            <Text style={styles.sheetBulletText}>You can export or delete your account at any time from Settings.</Text>
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
            <ChevronRight size={14} color="#1B3A6B" />
          </TouchableOpacity>
        </View>
      </InfoSheet>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // Returning user
  returningContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  returningMark: {
    alignItems: 'center',
    gap: 6,
  },
  returningEyebrow: {
    color: 'rgba(27, 58, 107, 0.65)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  wordmark: {
    color: '#1B3A6B',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  porchHeroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  porchStatusWrap: {
    marginTop: 8,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingTime: {
    color: 'rgba(27, 58, 107, 0.65)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  greetingName: {
    color: '#1B3A6B',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  bioButtonOuter: {
    width: '100%',
    marginBottom: 14,
  },
  bioButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#1B3A6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  bioButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  bioButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  porchDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    marginBottom: 4,
    width: '100%',
  },
  porchDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(27, 58, 107, 0.15)',
  },
  porchDividerText: {
    color: 'rgba(27, 58, 107, 0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  porchEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(27, 58, 107, 0.2)',
    backgroundColor: 'rgba(255,255,255,0.65)',
    marginBottom: 12,
  },
  porchEmailBtnText: {
    color: '#1B3A6B',
    fontSize: 15,
    fontWeight: '700',
  },
  trustLineText: {
    color: 'rgba(27, 58, 107, 0.55)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  notMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 'auto',
    paddingVertical: 12,
  },
  notMeText: {
    color: 'rgba(27, 58, 107, 0.65)',
    fontSize: 13,
    fontWeight: '600',
  },

  // Auth form
  authScrollContent: {
    paddingHorizontal: 24,
  },
  authHeader: {
    marginBottom: 10,
  },
  authBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(27, 58, 107, 0.1)',
    shadowColor: '#1B3A6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoImage: {
    width: 84,
    height: 84,
    borderRadius: 24,
    marginBottom: 10,
  },
  logoTitle: {
    color: '#1B3A6B',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  logoTagline: {
    color: 'rgba(27, 58, 107, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(27, 58, 107, 0.12)',
    marginBottom: 16,
  },
  securityPillText: {
    color: '#1B3A6B',
    fontSize: 12,
    fontWeight: '600',
  },
  modeToggleWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(27, 58, 107, 0.1)',
    position: 'relative',
    width: SCREEN_W - 80,
  },
  modeToggleIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: '#1B3A6B',
    borderRadius: 10,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  modeToggleText: {
    color: 'rgba(27, 58, 107, 0.55)',
    fontSize: 14,
    fontWeight: '700',
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(27, 58, 107, 0.08)',
    padding: 18,
    marginBottom: 16,
    gap: 4,
    shadowColor: '#1B3A6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  biometricQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(27, 58, 107, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(27, 58, 107, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  biometricQuickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(27, 58, 107, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricQuickTitle: {
    color: '#1B3A6B',
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  biometricQuickSub: {
    color: 'rgba(27, 58, 107, 0.55)',
    fontSize: 12,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#1B3A6B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8C9A0',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(122, 85, 51, 0.25)',
    minHeight: 56,
    shadowColor: '#5C3A1E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  inputRowError: {
    borderColor: 'rgba(200, 60, 60, 0.7)',
    backgroundColor: '#F0D0B0',
  },
  inputIcon: {
    marginLeft: 16,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#3D2814',
    paddingHorizontal: 10,
    paddingVertical: 16,
    minHeight: 56,
    fontWeight: '600',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    height: 56,
    justifyContent: 'center',
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  forgotText: {
    color: '#1B3A6B',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#C53A3A',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
    fontWeight: '600',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  rememberCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(27, 58, 107, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  rememberCheckboxChecked: {
    backgroundColor: '#1B3A6B',
    borderColor: '#1B3A6B',
  },
  rememberText: {
    color: 'rgba(27, 58, 107, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  termsText: {
    flex: 1,
    color: 'rgba(27, 58, 107, 0.7)',
    fontSize: 13,
    lineHeight: 19,
  },
  termsLink: {
    color: '#1B3A6B',
    fontWeight: '700',
  },
  magicSentCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(27, 58, 107, 0.1)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
  },
  magicSentIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(27, 58, 107, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  magicSentTitle: {
    color: '#1B3A6B',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  magicSentSub: {
    color: 'rgba(27, 58, 107, 0.65)',
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  magicSentEmail: {
    color: '#1B3A6B',
    fontWeight: '700',
  },
  magicSentResendBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  magicSentResendText: {
    color: '#1B3A6B',
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#1B3A6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 17,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fallbackToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    marginBottom: 10,
  },
  fallbackToggleText: {
    color: 'rgba(27, 58, 107, 0.65)',
    fontSize: 12.5,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(27, 58, 107, 0.15)',
  },
  dividerText: {
    color: 'rgba(27, 58, 107, 0.45)',
    fontSize: 12,
    fontWeight: '700',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(27, 58, 107, 0.12)',
    marginBottom: 16,
    shadowColor: '#1B3A6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '700',
  },
  googleBtnText: {
    color: '#3C4043',
    fontSize: 15,
    fontWeight: '700',
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  switchModeText: {
    color: 'rgba(27, 58, 107, 0.65)',
    fontSize: 14,
    textAlign: 'center',
  },
  switchModeLink: {
    color: '#1B3A6B',
    fontWeight: '800',
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(27, 58, 107, 0.1)',
  },
  guestText: {
    color: 'rgba(27, 58, 107, 0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  supportText: {
    color: 'rgba(27, 58, 107, 0.5)',
    fontSize: 13,
  },
  devBtn: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    opacity: 0.5,
  },
  devText: {
    color: 'rgba(27, 58, 107, 0.8)',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '600',
  },

  // Sheets
  sheetBody: {
    paddingBottom: 12,
  },
  sheetP: {
    color: 'rgba(27, 58, 107, 0.7)',
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 10,
  },
  sheetBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  sheetBulletIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(27, 58, 107, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBulletText: {
    flex: 1,
    color: 'rgba(27, 58, 107, 0.85)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  sheetLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 6,
  },
  sheetLinkText: {
    color: '#1B3A6B',
    fontSize: 14,
    fontWeight: '700',
  },
});
