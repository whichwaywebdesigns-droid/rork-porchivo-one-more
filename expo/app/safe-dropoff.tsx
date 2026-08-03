import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { palette } from '@/constants/theme';
import { useOnboarding } from '@/store/OnboardingContext';
import { useAnalytics } from '@/store/AnalyticsContext';

interface DropoffOption {
  key: string;
  label: string;
  description: string;
}

const OPTIONS: DropoffOption[] = [
  { key: 'front_door', label: 'Front door only', description: 'Standard drop — visible but easy to retrieve.' },
  { key: 'side_entrance', label: 'Side entrance', description: 'Less visible from the street, good for most deliveries.' },
  { key: 'trusted_person', label: 'With a trusted person', description: 'Only complete the handoff to someone I know.' },
  { key: 'hidden', label: 'Hidden from street view', description: 'Behind a planter, gate, or out of sight.' },
  { key: 'signature', label: 'Signature / handoff preferred', description: 'I want to be there in person when possible.' },
  { key: 'other', label: 'Other (custom note)', description: "I'll describe my preference below." },
];

export default function SafeDropoffScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateChecklist } = useOnboarding();
  const { track } = useAnalytics();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customNote, setCustomNote] = useState<string>('');
  const [saved, setSaved] = useState<boolean>(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleOption = useCallback((key: string) => {
    void Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (selected.size === 0) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(buttonAnim, { toValue: 0.96, duration: 65, useNativeDriver: true }),
      Animated.timing(buttonAnim, { toValue: 1, duration: 65, useNativeDriver: true }),
    ]).start();

    await updateChecklist({ safeDropoffSet: true });
    track('safe_dropoff_preference_saved', {
      options: Array.from(selected).join(','),
      hasCustomNote: customNote.trim().length > 0,
    });
    setSaved(true);

    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(successAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      router.back();
    });
  }, [selected, customNote, updateChecklist, track, buttonAnim, successAnim, router]);

  const handleSkip = useCallback(() => {
    void Haptics.selectionAsync();
    router.back();
  }, [router]);

  const canSave = selected.size > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={palette.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Delivery preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <Text style={styles.title}>What counts as a{'\n'}safer delivery for you?</Text>
          <Text style={styles.subtitle}>
            Select all that apply. This helps Porchivo surface relevant options for your setup.
          </Text>

          {/* Options */}
          <View style={styles.optionsList}>
            {OPTIONS.map((opt) => {
              const isSelected = selected.has(opt.key);
              const showCustom = opt.key === 'other' && isSelected;
              return (
                <View key={opt.key}>
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => toggleOption(opt.key)}
                    activeOpacity={0.85}
                    testID={`dropoff-${opt.key}`}
                  >
                    <View style={styles.optionLeft}>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.optionDescription}>{opt.description}</Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Check size={13} color={palette.onAccent} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>

                  {showCustom && (
                    <View style={styles.customNoteCard}>
                      <TextInput
                        style={styles.customNoteInput}
                        value={customNote}
                        onChangeText={setCustomNote}
                        placeholder="e.g. Leave behind the gate on the left side"
                        placeholderTextColor={palette.textMuted}
                        multiline
                        numberOfLines={3}
                        testID="dropoff-custom-note"
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Success overlay */}
      <Animated.View
        style={[styles.successOverlay, { opacity: successAnim }]}
        pointerEvents="none"
      >
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Check size={28} color={palette.successGreen} strokeWidth={3} />
          </View>
          <Text style={styles.successTitle}>Saved.</Text>
          <Text style={styles.successBody}>
            Porchivo now knows your preferred delivery setup.
          </Text>
        </View>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.saveBtnWrap, { transform: [{ scale: buttonAnim }] }]}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saved}
            activeOpacity={0.87}
            testID="dropoff-save"
          >
            <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
              Save preference
            </Text>
            <ArrowRight size={17} color={canSave ? palette.onAccent : palette.textMuted} strokeWidth={2.5} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.bgSurface,
    borderWidth: 1,
    borderColor: palette.borderDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  topBarTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 27,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    lineHeight: 33,
    marginBottom: 8,
    marginTop: 8,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 22,
  },
  optionsList: {
    gap: 9,
  },
  option: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    padding: 15,
    borderRadius: 14,
    backgroundColor: palette.bgSurface,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
  },
  optionSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.sky,
  },
  optionLeft: {
    flex: 1,
  },
  optionLabel: {
    color: palette.textPrimary,
    fontSize: 14.5,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: palette.accent,
  },
  optionDescription: {
    color: palette.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  customNoteCard: {
    marginTop: 6,
    backgroundColor: palette.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderDark,
    padding: 12,
  },
  customNoteInput: {
    fontSize: 14.5,
    color: palette.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top' as const,
  },
  successOverlay: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: palette.bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  successContent: {
    alignItems: 'center' as const,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.sageSoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  successTitle: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: 8,
  },
  successBody: {
    color: palette.textSecondary,
    fontSize: 15,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 22,
    paddingTop: 10,
    gap: 10,
  },
  skipBtn: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  skipText: {
    color: palette.textSecondary,
    fontSize: 14.5,
    fontWeight: '600' as const,
  },
  saveBtnWrap: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 5,
  },
  saveBtnDisabled: {
    backgroundColor: palette.bgElevated,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: palette.onAccent,
    fontSize: 15.5,
    fontWeight: '700' as const,
  },
  saveBtnTextDisabled: {
    color: palette.textMuted,
  },
});
