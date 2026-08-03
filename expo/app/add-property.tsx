import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ArrowRight,
  Building2,
  MapPin,
  Home,
  Check,
  Hash,
  Layers,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';

// ─── Step definitions ──────────────────────────────────────────────────────────

const TOTAL_STEPS = 3;

// ─── Field component ───────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  keyboardType = 'default',
  autoCapitalize = 'words',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  required?: boolean;
}) {
  const Colors = useColors();
  const [focused, setFocused] = useState<boolean>(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>
        {label}{required && <Text style={{ color: Colors.danger }}> *</Text>}
      </Text>
      <View
        style={[
          styles.fieldRow,
          {
            backgroundColor: Colors.surface,
            borderColor: focused ? Colors.primary : Colors.border,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          style={[styles.fieldInput, { color: Colors.slate }]}
          placeholder={placeholder}
          placeholderTextColor={Colors.slateLighter}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

// ─── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  const Colors = useColors();
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            {
              backgroundColor: i <= current ? Colors.primary : Colors.border,
              width: i === current ? 20 : 7,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Bulk unit generator ───────────────────────────────────────────────────────

function BulkUnitPreview({ pattern, count }: { pattern: string; count: number }) {
  const Colors = useColors();

  const generatePreview = (): string[] => {
    const results: string[] = [];
    const base = pattern.trim();
    if (!base || count <= 0) return results;

    // If pattern contains a number, increment from it
    const match = base.match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
    if (match) {
      const [, prefix, numStr, suffix] = match;
      const start = parseInt(numStr, 10);
      for (let i = 0; i < Math.min(count, 6); i++) {
        results.push(`${prefix}${start + i}${suffix}`);
      }
      if (count > 6) results.push(`... +${count - 6} more`);
    } else {
      // Just use the pattern as-is for the first, then append numbers
      for (let i = 0; i < Math.min(count, 6); i++) {
        results.push(`${base}${i + 1}`);
      }
      if (count > 6) results.push(`... +${count - 6} more`);
    }
    return results;
  };

  const preview = generatePreview();
  if (preview.length === 0) return null;

  return (
    <View style={[styles.previewWrap, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <Text style={[styles.previewLabel, { color: Colors.slateLighter }]}>Preview</Text>
      <View style={styles.previewChips}>
        {preview.map((unit, i) => (
          <View key={i} style={[styles.previewChip, { backgroundColor: Colors.primary + '12', borderColor: Colors.primary + '28' }]}>
            <Text style={[styles.previewChipText, { color: Colors.primary }]}>{unit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddPropertyScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { createProperty, isCreatingProperty, bulkCreateUnits, isBulkCreatingUnits } = useOrganization();

  const [step, setStep] = useState<number>(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Step 1 — property details
  const [name, setName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [zip, setZip] = useState<string>('');

  // Step 2 — unit configuration
  const [setupUnits, setSetupUnits] = useState<boolean>(true);
  const [unitPattern, setUnitPattern] = useState<string>('101');
  const [unitCount, setUnitCount] = useState<string>('10');

  // Step 3 — confirmation / done
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const animateToStep = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
  };

  const canProceedStep0 = name.trim().length > 0 && address.trim().length > 0 && city.trim().length > 0;
  const canProceedStep1 = !setupUnits || (unitPattern.trim().length > 0 && parseInt(unitCount, 10) > 0);

  const handleNext = () => {
    if (step === 0 && !canProceedStep0) {
      Alert.alert('Required fields', 'Please fill in property name, address, and city.');
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      animateToStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) animateToStep(step - 1);
    else router.back();
  };

  const generateUnitNumbers = (): string[] => {
    const base = unitPattern.trim();
    const count = parseInt(unitCount, 10);
    if (!base || count <= 0) return [];

    const results: string[] = [];
    const match = base.match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
    if (match) {
      const [, prefix, numStr, suffix] = match;
      const start = parseInt(numStr, 10);
      for (let i = 0; i < count; i++) results.push(`${prefix}${start + i}${suffix}`);
    } else {
      for (let i = 0; i < count; i++) results.push(`${base}${i + 1}`);
    }
    return results;
  };

  const handleCreate = async () => {
    if (!canProceedStep0) return;
    setIsSubmitting(true);
    try {
      const propertyId = await createProperty({
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        totalUnits: setupUnits ? parseInt(unitCount, 10) : null,
      });
      setCreatedPropertyId(propertyId);

      if (setupUnits && propertyId) {
        const unitNumbers = generateUnitNumbers();
        if (unitNumbers.length > 0) {
          await bulkCreateUnits({ propertyId, unitNumbers });
        }
      }

      animateToStep(2);
    } catch {
      Alert.alert('Error', 'Could not create property. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || isCreatingProperty || isBulkCreatingUnits;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>
            {step === 2 ? 'Property Created' : 'Add Property'}
          </Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {step === 0 ? 'Building details' : step === 1 ? 'Unit setup' : 'All set'}
          </Text>
        </View>
        <StepDots current={step} total={TOTAL_STEPS} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>

          {/* ── Step 0: Property details ─────────────────────────────────── */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <View style={[styles.stepIcon, { backgroundColor: Colors.primary + '14' }]}>
                <Building2 size={28} color={Colors.primary} />
              </View>
              <Text style={[styles.stepTitle, { color: Colors.slate }]}>Property Details</Text>
              <Text style={[styles.stepDesc, { color: Colors.slateLighter }]}>
                Enter the building or property information. This will appear in your community directory.
              </Text>

              <Field
                label="Property Name"
                value={name}
                onChange={setName}
                placeholder="e.g. Building A, North Tower, 42 Elm"
                icon={<Building2 size={16} color={Colors.slateLighter} />}
                required
              />
              <Field
                label="Street Address"
                value={address}
                onChange={setAddress}
                placeholder="123 Main Street"
                icon={<MapPin size={16} color={Colors.slateLighter} />}
                required
              />
              <View style={styles.twoCol}>
                <View style={{ flex: 2 }}>
                  <Field
                    label="City"
                    value={city}
                    onChange={setCity}
                    placeholder="City"
                    icon={<MapPin size={16} color={Colors.slateLighter} />}
                    required
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="State"
                    value={state}
                    onChange={setState}
                    placeholder="CA"
                    icon={<MapPin size={16} color={Colors.slateLighter} />}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Field
                label="ZIP Code"
                value={zip}
                onChange={setZip}
                placeholder="90210"
                icon={<Hash size={16} color={Colors.slateLighter} />}
                keyboardType="numeric"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* ── Step 1: Unit configuration ───────────────────────────────── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <View style={[styles.stepIcon, { backgroundColor: Colors.secondary + '14' }]}>
                <Home size={28} color={Colors.secondary} />
              </View>
              <Text style={[styles.stepTitle, { color: Colors.slate }]}>Unit Setup</Text>
              <Text style={[styles.stepDesc, { color: Colors.slateLighter }]}>
                Optionally generate unit numbers automatically. You can always add or remove units later.
              </Text>

              {/* Toggle */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    setupUnits && { backgroundColor: Colors.primary + '12', borderColor: Colors.primary + '40' },
                    !setupUnits && { backgroundColor: Colors.surface, borderColor: Colors.border },
                  ]}
                  onPress={() => setSetupUnits(true)}
                >
                  <Layers size={18} color={setupUnits ? Colors.primary : Colors.slateLighter} />
                  <Text style={[styles.toggleText, { color: setupUnits ? Colors.primary : Colors.slateLight }]}>
                    Auto-generate
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    !setupUnits && { backgroundColor: Colors.surface, borderColor: Colors.primary + '40' },
                    setupUnits && { backgroundColor: Colors.surface, borderColor: Colors.border },
                  ]}
                  onPress={() => setSetupUnits(false)}
                >
                  <Home size={18} color={!setupUnits ? Colors.primary : Colors.slateLighter} />
                  <Text style={[styles.toggleText, { color: !setupUnits ? Colors.primary : Colors.slateLight }]}>
                    Add manually
                  </Text>
                </TouchableOpacity>
              </View>

              {setupUnits && (
                <>
                  <Field
                    label="Starting Unit"
                    value={unitPattern}
                    onChange={setUnitPattern}
                    placeholder="e.g. 101, A1, 201"
                    icon={<Home size={16} color={Colors.slateLighter} />}
                  />
                  <Field
                    label="Number of Units"
                    value={unitCount}
                    onChange={setUnitCount}
                    placeholder="e.g. 12"
                    icon={<Hash size={16} color={Colors.slateLighter} />}
                    keyboardType="numeric"
                    autoCapitalize="none"
                  />
                  <BulkUnitPreview
                    pattern={unitPattern}
                    count={parseInt(unitCount, 10) || 0}
                  />
                </>
              )}

              {!setupUnits && (
                <View style={[styles.skipHint, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                  <Check size={16} color={Colors.success} />
                  <Text style={[styles.skipHintText, { color: Colors.slateLight }]}>
                    You can add units individually after the property is created.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Step 2: Done ──────────────────────────────────────────────── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <View style={[styles.doneCircle, { backgroundColor: Colors.success + '14', borderColor: Colors.success + '30' }]}>
                <Check size={36} color={Colors.success} strokeWidth={2.5} />
              </View>
              <Text style={[styles.stepTitle, { color: Colors.slate }]}>{name}</Text>
              <Text style={[styles.stepDesc, { color: Colors.slateLighter }]}>
                Property created successfully.
                {setupUnits && ` ${parseInt(unitCount, 10)} units have been generated and are ready for resident assignment.`}
              </Text>

              <View style={[styles.summaryCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                {[
                  { label: 'Address', value: `${address}, ${city}${state ? `, ${state}` : ''}${zip ? ` ${zip}` : ''}` },
                  { label: 'Units created', value: setupUnits ? unitCount : '0 (add manually)' },
                ].map(({ label, value }) => (
                  <View key={label} style={[styles.summaryRow, { borderColor: Colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: Colors.slateLighter }]}>{label}</Text>
                    <Text style={[styles.summaryValue, { color: Colors.slate }]}>{value}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
                onPress={() => router.replace('/property-management')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>View All Properties</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: Colors.border }]}
                onPress={() => {
                  setStep(0);
                  setName(''); setAddress(''); setCity(''); setState(''); setZip('');
                  setUnitPattern('101'); setUnitCount('10');
                  setCreatedPropertyId(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryBtnText, { color: Colors.slateLight }]}>Add Another</Text>
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* Footer CTA */}
      {step < 2 && (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
            },
          ]}
        >
          {step === 1 ? (
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: Colors.primary }, (!canProceedStep1 || isLoading) && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!canProceedStep1 || isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.ctaBtnText}>Create Property</Text>
                  <Check size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: Colors.primary }, !canProceedStep0 && { opacity: 0.5 }]}
              onPress={handleNext}
              disabled={!canProceedStep0}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>Next</Text>
              <ArrowRight size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },

  // Step dots
  stepDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  stepDot: { height: 7, borderRadius: 4 },

  // Scroll
  scroll: { padding: 24 },

  // Step content
  stepContent: { gap: 16 },
  stepIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  stepTitle: { fontSize: 22, fontWeight: '800' as const, textAlign: 'center', letterSpacing: -0.4 },
  stepDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Field
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' as const },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  fieldIcon: { opacity: 0.7 },
  fieldInput: { flex: 1, fontSize: 15 },

  // Two-col layout
  twoCol: { flexDirection: 'row', gap: 10 },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  toggleText: { fontSize: 13, fontWeight: '600' as const },

  // Bulk preview
  previewWrap: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  previewLabel: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  previewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  previewChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewChipText: { fontSize: 12, fontWeight: '700' as const },

  // Skip hint
  skipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  skipHintText: { fontSize: 13, flex: 1 },

  // Done
  doneCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },

  // Summary card
  summaryCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '600' as const, flex: 1, textAlign: 'right' },

  // Buttons
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' as const },

  // Footer
  footer: {
    padding: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
});
