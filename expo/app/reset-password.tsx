import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Lock, Eye, EyeOff, Check, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { log } from '@/lib/logger';

/**
 * ResetPasswordScreen — reached via the `porchivo://reset-password` deep link
 * sent in Supabase password-reset emails. Supabase embeds the recovery token
 * in the URL fragment; on cold launch it is forwarded to the JS bundle via
 * `useLocalSearchParams()`. We exchange it for a session (if not already
 * present) then call `updateUser({ password })`.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ access_token?: string; expires_at?: string; refresh_token?: string; token_type?: string; type?: string }>();

  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // If Supabase forwarded recovery params, exchange them for a session so
  // updateUser() works. This runs once on mount.
  useEffect(() => {
    async function establishSession() {
      if (!params.access_token || !params.refresh_token) return;
      try {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (sessionErr) {
          log('[ResetPassword] setSession error:', sessionErr.message);
        }
      } catch (e) {
        log('[ResetPassword] setSession exception:', e);
      }
    }
    void establishSession();
  }, [params.access_token, params.refresh_token]);

  const validate = useCallback((): boolean => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return false;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return false;
    }
    setError(null);
    return true;
  }, [password, confirm]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || done) return;
    if (!validate()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (!isSupabaseConfigured) {
        Alert.alert('Setup Required', 'The app backend is not configured yet.');
        setIsSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        const msg = updateError.message.toLowerCase();
        const friendly = msg.includes('rate limit')
          ? 'Too many attempts. Please wait a moment and try again.'
          : msg.includes('token') || msg.includes('session')
            ? 'This reset link has expired. Please request a new one.'
            : 'Could not update your password. Please try again.';
        setError(friendly);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsSubmitting(false);
        return;
      }

      setDone(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Give the user a beat to see the success state, then route to login.
      setTimeout(() => {
        router.replace('/login?mode=signin');
      }, 1400);
    } catch (e: any) {
      log('[ResetPassword] submit exception:', e?.message);
      setError('Something went wrong. Please try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, done, validate, password, router]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#050C1E', '#080F25', '#0D1833']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.brandBlock}>
              <View style={styles.shieldRing}>
                <LinearGradient
                  colors={['#1A4BAA', '#3A7BD5']}
                  style={styles.shieldGradient}
                >
                  <Shield size={26} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.brandName}>PORCHIVO</Text>
              <Text style={styles.brandTagline}>Reset your password</Text>
            </View>

            {done ? (
              <View style={styles.successCard}>
                <View style={styles.successIcon}>
                  <Check size={28} color="#fff" strokeWidth={3} />
                </View>
                <Text style={styles.successTitle}>Password updated</Text>
                <Text style={styles.successSub}>
                  Your new password is set. Redirecting you to sign in…
                </Text>
              </View>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.heading}>Choose a new password</Text>
                <Text style={styles.subheading}>
                  Use at least 8 characters. Your old password will no longer work.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>NEW PASSWORD</Text>
                  <View style={styles.inputRow}>
                    <Lock size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      testID="reset-password-input"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showPassword ? (
                        <EyeOff size={16} color="rgba(255,255,255,0.4)" />
                      ) : (
                        <Eye size={16} color="rgba(255,255,255,0.4)" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CONFIRM PASSWORD</Text>
                  <View style={styles.inputRow}>
                    <Lock size={16} color="rgba(255,255,255,0.35)" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      value={confirm}
                      onChangeText={setConfirm}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      testID="reset-confirm-input"
                    />
                  </View>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.9}
                  testID="reset-submit"
                >
                  <LinearGradient
                    colors={['#1A4BAA', '#3A7BD5', '#4A8FE8']}
                    style={styles.submitGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.submitText}>
                      {isSubmitting ? 'Updating…' : 'Update password'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  shieldRing: {
    width: 56,
    height: 56,
    borderRadius: 18,
    padding: 2,
    backgroundColor: 'rgba(58,123,213,0.25)',
    marginBottom: 14,
  },
  shieldGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '900' as const,
    letterSpacing: 3,
    color: '#fff',
  },
  brandTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    fontWeight: '500' as const,
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 22,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
    gap: 10,
  },
  inputIcon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    height: '100%',
  },
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    marginBottom: 14,
    fontWeight: '500' as const,
  },
  submitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  successCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28,
    alignItems: 'center',
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
