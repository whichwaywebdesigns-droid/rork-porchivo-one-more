import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, DoorOpen, Bell, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useAnalytics } from '@/store/AnalyticsContext';
import {
  useOnboardingFlow,
  porchivoRoleToUserRole,
} from '@/store/OnboardingFlowContext';
import {
  OnboardingScreen,
  OnboardingProgress,
  PrimaryCTA,
  SecondaryAction,
  FadeSlideIn,
} from '@/components/onboarding';

export default function OnboardingSetupScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { track } = useAnalytics();
  const { completeOnboarding } = useApp();
  const { role, setup, updateSetup, markCompleted } = useOnboardingFlow();

  const [building, setBuilding] = useState<string>(setup.buildingName);
  const [unit, setUnit] = useState<string>(setup.unit);
  const [notify, setNotify] = useState<boolean>(setup.notificationsEnabled ?? true);
  const [focused, setFocused] = useState<'building' | 'unit' | null>(null);
  const [finishing, setFinishing] = useState<boolean>(false);

  // P-9: persist building/unit to the OnboardingFlowContext on each change so
  // a mid-typing background/kill resumes where the user left off instead of
  // resetting to empty on relaunch. Role + painPoint are already persisted.
  useEffect(() => {
    updateSetup({ buildingName: building, unit });
  }, [building, unit, updateSetup]);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);

    updateSetup({ buildingName: building.trim(), unit: unit.trim(), notificationsEnabled: notify });

    // Notification preference — request permission only if the user opted in.
    // Skip the system prompt if permission was already granted earlier in
    // the flow (e.g. the Android delivery-alerts lead screen).
    if (notify && Platform.OS !== 'web') {
      try {
        const Notifications = await import('expo-notifications');
        const existing = await Notifications.getPermissionsAsync();
        if (existing.status !== 'granted') {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Delivery Updates',
              importance: Notifications.AndroidImportance.HIGH,
            });
          }
          await Notifications.requestPermissionsAsync();
        }
      } catch {
        // Non-fatal — preference is stored regardless of OS prompt outcome.
      }
    }

    const address = [building.trim(), unit.trim()].filter(Boolean).join(', ');
    try {
      await completeOnboarding({
        role: porchivoRoleToUserRole(role),
        ...(address ? { address } : {}),
      });
    } catch {
      // Profile write can fail offline — proceed to the value moment anyway.
    }

    markCompleted();
    track('onboarding_completed', { role, skipped: !building.trim() && !unit.trim() });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Skip paywall — HOA-provisioned model, no IAP.
    router.replace('/(tabs)/(home)' as any);
  };

  const fieldStyle = (key: 'building' | 'unit') => [
    styles.field,
    {
      backgroundColor: Colors.surface,
      borderColor: focused === key ? Colors.primary : Colors.border,
      borderWidth: focused === key ? 2 : 1,
    },
  ];

  return (
    <OnboardingScreen
      footer={
        <>
          <PrimaryCTA
            label="Finish setup"
            onPress={finish}
            loading={finishing}
            testID="setup-finish"
          />
          <SecondaryAction
            label="Continue with limited access"
            onPress={finish}
            testID="setup-skip"
          />
        </>
      }
    >
      <View style={styles.top}>
        <OnboardingProgress step={5} total={5} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <FadeSlideIn>
            <Text style={[styles.title, { color: Colors.slate }]}>A few details to get set up</Text>
            <Text style={[styles.subtitle, { color: Colors.slateLight }]}>
              All optional — you can add or change these anytime. Skip to continue with a free,
              limited experience.
            </Text>
          </FadeSlideIn>

          <FadeSlideIn delay={100}>
            <Text style={[styles.label, { color: Colors.slateLighter }]}>BUILDING NAME</Text>
            <View style={fieldStyle('building')}>
              <Building2 size={18} color={Colors.primary} />
              <TextInput
                style={[styles.input, { color: Colors.slate }]}
                value={building}
                onChangeText={setBuilding}
                onFocus={() => setFocused('building')}
                onBlur={() => setFocused(null)}
                placeholder="e.g. Maple Court"
                placeholderTextColor={Colors.slateLighter}
                autoCapitalize="words"
                testID="setup-building"
              />
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={160}>
            <Text style={[styles.label, { color: Colors.slateLighter }]}>UNIT OR PROPERTY</Text>
            <View style={fieldStyle('unit')}>
              <DoorOpen size={18} color={Colors.primary} />
              <TextInput
                style={[styles.input, { color: Colors.slate }]}
                value={unit}
                onChangeText={setUnit}
                onFocus={() => setFocused('unit')}
                onBlur={() => setFocused(null)}
                placeholder="e.g. Unit 4B"
                placeholderTextColor={Colors.slateLighter}
                autoCapitalize="characters"
                testID="setup-unit"
              />
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={220}>
            <Text style={[styles.label, { color: Colors.slateLighter }]}>NOTIFICATIONS</Text>
            <View
              style={[
                styles.notifCard,
                { backgroundColor: Colors.surface, borderColor: notify ? Colors.primary : Colors.border },
              ]}
              onTouchEnd={() => {
                void Haptics.selectionAsync();
                setNotify((v) => !v);
              }}
            >
              <View style={[styles.notifIcon, { backgroundColor: Colors.skyBlue }]}>
                <Bell size={18} color={Colors.primary} />
              </View>
              <View style={styles.notifCopy}>
                <Text style={[styles.notifTitle, { color: Colors.slate }]}>
                  Delivery & handoff updates
                </Text>
                <Text style={[styles.notifSub, { color: Colors.slateLight }]}>
                  Quiet, relevant alerts. No spam.
                </Text>
              </View>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: notify ? Colors.primary : Colors.border,
                    backgroundColor: notify ? Colors.primary : 'transparent',
                  },
                ]}
              >
                {notify ? <Check size={13} color={Colors.onPrimary} strokeWidth={3} /> : null}
              </View>
            </View>
          </FadeSlideIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  scroll: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 26,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 15,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  notifIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCopy: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  notifSub: {
    fontSize: 13,
    marginTop: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
