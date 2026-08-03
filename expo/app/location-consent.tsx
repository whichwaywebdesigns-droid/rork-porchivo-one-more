import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPin, Navigation, Eye, ChevronLeft, Crosshair, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { UserRole } from '@/types';
import { log } from "@/lib/logger";

export default function LocationConsentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, userName } = useLocalSearchParams<{ role: string; userName?: string }>();
  const { completeOnboarding } = useApp();
  const [enablePrecise, setEnablePrecise] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleEnableLocation = async () => {
    // P-8: double-submit guard — two fast taps fire two completeOnboarding()
    // calls and two router.replace() hops.
    if (isSubmitting) return;
    setIsSubmitting(true);
    let granted = false;
    let preciseGranted = false;
    if (Platform.OS !== 'web') {
      try {
        const Location = await import('expo-location');
        const result = await Location.requestForegroundPermissionsAsync();
        granted = result.status === 'granted';
        log('[LocationConsent] Foreground permission result:', result.status);

        if (granted && enablePrecise) {
          try {
            const testLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
            preciseGranted = true;
            log('[LocationConsent] Precise location obtained:', testLoc.coords.latitude, testLoc.coords.longitude);
          } catch (preciseErr) {
            log('[LocationConsent] Precise location error, falling back to approximate:', preciseErr);
            preciseGranted = false;
          }
        }
      } catch (e) {
        log('[LocationConsent] Error requesting location:', e);
      }
    } else {
      granted = true;
      preciseGranted = enablePrecise;
    }
    try {
      await completeOnboarding({
        role: (role || 'homeowner') as UserRole,
        hasLocationConsent: granted,
        hasPreciseLocationConsent: preciseGranted,
        ...(userName ? { name: userName } : {}),
      });
      // Post-onboarding upgrade push — user has just completed setup and seen
      // the full value proposition. Surface the paywall now while intent is high.
      // The upgrade screen has a back button so this is a soft push, not a hard block.
      router.replace({ pathname: '/upgrade' as any, params: { trigger: 'first_delivery' } });
    } catch (e) {
      log('[LocationConsent] completeOnboarding error:', e);
      // Still route forward so the user isn't stranded on a completed step.
      router.replace({ pathname: '/upgrade' as any, params: { trigger: 'first_delivery' } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    log('[LocationConsent] User skipped location');
    try {
      await completeOnboarding({
        role: (role || 'homeowner') as UserRole,
        hasLocationConsent: false,
        ...(userName ? { name: userName } : {}),
      });
      // Post-onboarding upgrade push (skip path)
      router.replace({ pathname: '/upgrade' as any, params: { trigger: 'first_delivery' } });
    } catch (e) {
      log('[LocationConsent] skip completeOnboarding error:', e);
      router.replace({ pathname: '/upgrade' as any, params: { trigger: 'first_delivery' } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const benefits = [
    { icon: <Navigation size={20} color={Colors.primary} />, text: 'Show nearby shipments from neighbors' },
    { icon: <MapPin size={20} color={Colors.secondary} />, text: 'Help partners navigate to your porch' },
    { icon: <Crosshair size={20} color="#7C3AED" />, text: 'Precise location for accurate drop-off pins' },
    { icon: <Eye size={20} color={Colors.success} />, text: 'Only used while the app is open' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="back-btn"
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.illustrationArea}>
            <View style={styles.mapCircle}>
              <MapPin size={44} color={Colors.white} />
            </View>
            <View style={styles.pinDot} />
            <View style={styles.pinRing} />
          </View>

          <Text style={styles.title}>Enable Location</Text>
          <Text style={styles.description}>
            We only use your location to show nearby shipments and help partners know when to pick up packages.
          </Text>

          <View style={styles.benefitsList}>
            {benefits.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>{b.icon}</View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.buttonArea}>
        <TouchableOpacity
          style={styles.preciseToggleRow}
          onPress={() => setEnablePrecise(!enablePrecise)}
          activeOpacity={0.7}
          testID="precise-toggle"
        >
          <View style={[styles.preciseToggle, enablePrecise && styles.preciseToggleActive]}>
            {enablePrecise && <Crosshair size={12} color={Colors.white} />}
          </View>
          <View style={styles.preciseToggleContent}>
            <Text style={styles.preciseToggleLabel}>Enable precise location</Text>
            <Text style={styles.preciseToggleHint}>Exact address for partner navigation</Text>
          </View>
          <Shield size={16} color={enablePrecise ? '#7C3AED' : Colors.slateLighter} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.enableButton, isSubmitting && { opacity: 0.6 }]}
          onPress={handleEnableLocation}
          activeOpacity={0.85}
          disabled={isSubmitting}
          testID="enable-location-btn"
        >
          <MapPin size={18} color={Colors.white} />
          <Text style={styles.enableButtonText}>{isSubmitting ? 'Saving…' : 'Enable Location'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.skipButton, isSubmitting && { opacity: 0.6 }]}
          onPress={handleSkip}
          activeOpacity={0.7}
          disabled={isSubmitting}
          testID="skip-location-btn"
        >
          <Text style={styles.skipButtonText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  illustrationArea: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  mapCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  pinDot: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.secondary,
  },
  pinRing: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: Colors.skyBlue,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  benefitsList: {
    alignSelf: 'stretch',
    gap: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 8,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 15,
    color: Colors.slate,
    fontWeight: '500' as const,
    flex: 1,
  },
  buttonArea: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  enableButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  enableButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: Colors.slateLight,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  preciseToggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 12,
  },
  preciseToggle: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  preciseToggleActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  preciseToggleContent: {
    flex: 1,
  },
  preciseToggleLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  preciseToggleHint: {
    fontSize: 12,
    color: Colors.slateLight,
    marginTop: 1,
  },
});
