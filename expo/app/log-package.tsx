import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ArrowRight,
  Check,
  Package,
  MapPin,
  Hash,
  FileText,
  ChevronDown,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { StaffIntakeLockoutNotice } from '@/components/BillingGraceBanner';
import { CARRIER_META, PackageSizeHint } from '@/types/organization';

/**
 * ORG PACKAGE INTAKE — the "full lane" of package intake.
 *
 * Someone who has PHYSICALLY RECEIVED a package on a resident's behalf
 * (front desk, community staff, or Porch Partner) logs it here so the ops
 * board can route it and notify the right resident. Requires an org
 * context (`useOrganization`) and captures what matters when shelving an
 * item in hand: size hint, details, confirmation.
 *
 * This is intentionally separate from `app/add-package.tsx` (resident
 * self-tracking of packages still in transit). Do NOT merge the two flows:
 * different actor (holder vs. recipient), different lifecycle (received vs.
 * expected), different gating (org member vs. any homeowner).
 */

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = ['Carrier', 'Details', 'Confirm'] as const;
type StepName = typeof STEPS[number];

// ─── Carrier list ─────────────────────────────────────────────────────────────

const CARRIERS = Object.entries(CARRIER_META).map(([key, meta]) => ({ key, ...meta }));

// ─── Size options ─────────────────────────────────────────────────────────────

const SIZE_OPTIONS: { value: PackageSizeHint; label: string; desc: string; emoji: string }[] = [
  { value: 'small',     label: 'Small',     desc: 'Envelope / box under 12"', emoji: '📦' },
  { value: 'medium',    label: 'Medium',    desc: 'Standard shipping box',    emoji: '📦' },
  { value: 'large',     label: 'Large',     desc: 'Large box or bag',         emoji: '🗃️' },
  { value: 'oversized', label: 'Oversized', desc: 'Furniture, appliances',    emoji: '🚚' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDots({ currentStep }: { currentStep: number }) {
  const Colors = useColors();
  return (
    <View style={styles.stepDots}>
      {STEPS.map((_, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <View
            key={i}
            style={[
              styles.stepDot,
              {
                backgroundColor: done || active ? Colors.primary : Colors.border,
                width: active ? 20 : 8,
                opacity: done ? 0.6 : 1,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  const Colors = useColors();
  return <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>{label}</Text>;
}

function InputField({
  value,
  onChangeText,
  placeholder,
  icon,
  autoCapitalize,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'numeric' | 'email-address';
}) {
  const Colors = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.inputRow,
        {
          backgroundColor: Colors.surface,
          borderColor: focused ? Colors.primary : Colors.border,
        },
      ]}
    >
      <View style={styles.inputIcon}>{icon}</View>
      <TextInput
        style={[styles.input, { color: Colors.slate }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.slateLighter}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardType={keyboardType ?? 'default'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// ─── Step 1: Carrier ─────────────────────────────────────────────────────────

function CarrierStep({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const Colors = useColors();

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepHeadline, { color: Colors.slate }]}>Who delivered it?</Text>
      <Text style={[styles.stepSub, { color: Colors.slateLighter }]}>
        Select the carrier that dropped off the package.
      </Text>

      <View style={styles.carrierGrid}>
        {CARRIERS.map((carrier) => {
          const isSelected = selected === carrier.key;
          return (
            <TouchableOpacity
              key={carrier.key}
              style={[
                styles.carrierTile,
                {
                  backgroundColor: isSelected ? carrier.color + '18' : Colors.surface,
                  borderColor: isSelected ? carrier.color : Colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
              onPress={() => onSelect(carrier.key)}
              activeOpacity={0.8}
            >
              {/* Color blob */}
              <View style={[styles.carrierColorBlob, { backgroundColor: carrier.color + '22' }]}>
                <Text style={[styles.carrierAbbrev, { color: carrier.color }]}>{carrier.abbrev}</Text>
              </View>
              <Text style={[styles.carrierLabel, { color: isSelected ? Colors.slate : Colors.slateLight }]}>
                {carrier.label}
              </Text>
              {isSelected ? (
                <View style={[styles.carrierCheck, { backgroundColor: carrier.color }]}>
                  <Check size={10} color="#fff" strokeWidth={2.5} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 2: Details ─────────────────────────────────────────────────────────

function DetailsStep({
  unitNumber,
  setUnitNumber,
  tracking,
  setTracking,
  description,
  setDescription,
  location,
  setLocation,
  sizeHint,
  setSizeHint,
}: {
  unitNumber: string;
  setUnitNumber: (v: string) => void;
  tracking: string;
  setTracking: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  sizeHint: PackageSizeHint | null;
  setSizeHint: (v: PackageSizeHint | null) => void;
}) {
  const Colors = useColors();

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepHeadline, { color: Colors.slate }]}>Package details</Text>
      <Text style={[styles.stepSub, { color: Colors.slateLighter }]}>
        Fill in what you know — only carrier is required.
      </Text>

      <FieldLabel label="Unit Number" />
      <InputField
        value={unitNumber}
        onChangeText={setUnitNumber}
        placeholder="e.g. 4B, 202"
        icon={<MapPin size={16} color={Colors.slateLighter} />}
        autoCapitalize="characters"
      />

      <FieldLabel label="Tracking Number (optional)" />
      <InputField
        value={tracking}
        onChangeText={setTracking}
        placeholder="1Z999AA10123456784"
        icon={<Hash size={16} color={Colors.slateLighter} />}
        autoCapitalize="characters"
      />

      <FieldLabel label="Description (optional)" />
      <InputField
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. White mailer bag"
        icon={<FileText size={16} color={Colors.slateLighter} />}
      />

      <FieldLabel label="Office Location (optional)" />
      <InputField
        value={location}
        onChangeText={setLocation}
        placeholder="e.g. Mailroom shelf B"
        icon={<MapPin size={16} color={Colors.slateLighter} />}
      />

      <FieldLabel label="Size" />
      <View style={styles.sizeGrid}>
        {SIZE_OPTIONS.map((opt) => {
          const isSelected = sizeHint === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.sizeTile,
                {
                  backgroundColor: isSelected ? Colors.primary + '14' : Colors.surface,
                  borderColor: isSelected ? Colors.primary + '55' : Colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
              onPress={() => setSizeHint(isSelected ? null : opt.value)}
              activeOpacity={0.8}
            >
              <Text style={styles.sizeEmoji}>{opt.emoji}</Text>
              <Text style={[styles.sizeLabel, { color: isSelected ? Colors.primary : Colors.slate }]}>
                {opt.label}
              </Text>
              <Text style={[styles.sizeDesc, { color: Colors.slateLighter }]}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────

function ConfirmStep({
  carrier,
  unitNumber,
  tracking,
  description,
  location,
  sizeHint,
}: {
  carrier: string;
  unitNumber: string;
  tracking: string;
  description: string;
  location: string;
  sizeHint: PackageSizeHint | null;
}) {
  const Colors = useColors();
  const meta = CARRIER_META[carrier] ?? { label: carrier, color: '#6B7F99', abbrev: '?' };

  const rows: { label: string; value: string }[] = [
    { label: 'Carrier', value: meta.label },
    ...(unitNumber ? [{ label: 'Unit', value: unitNumber }] : []),
    ...(tracking ? [{ label: 'Tracking', value: tracking }] : []),
    ...(description ? [{ label: 'Description', value: description }] : []),
    ...(location ? [{ label: 'Location', value: location }] : []),
    ...(sizeHint ? [{ label: 'Size', value: sizeHint.charAt(0).toUpperCase() + sizeHint.slice(1) }] : []),
  ];

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepHeadline, { color: Colors.slate }]}>Looks good?</Text>
      <Text style={[styles.stepSub, { color: Colors.slateLighter }]}>
        Review the package details before logging.
      </Text>

      {/* Carrier hero */}
      <View style={[styles.confirmCarrierCard, { backgroundColor: meta.color + '12', borderColor: meta.color + '35' }]}>
        <View style={[styles.confirmCarrierBlob, { backgroundColor: meta.color + '22' }]}>
          <Text style={[styles.confirmAbbrev, { color: meta.color }]}>{meta.abbrev}</Text>
        </View>
        <View>
          <Text style={[styles.confirmCarrierName, { color: Colors.slate }]}>{meta.label}</Text>
          <Text style={[styles.confirmCarrierSub, { color: Colors.slateLighter }]}>Carrier</Text>
        </View>
      </View>

      {/* Detail rows */}
      <View style={[styles.confirmTable, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        {rows.slice(1).map((row, i) => (
          <View
            key={row.label}
            style={[
              styles.confirmRow,
              i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border } : undefined,
            ]}
          >
            <Text style={[styles.confirmLabel, { color: Colors.slateLighter }]}>{row.label}</Text>
            <Text style={[styles.confirmValue, { color: Colors.slate }]} numberOfLines={1}>
              {row.value}
            </Text>
          </View>
        ))}
        {rows.length === 1 ? (
          <View style={styles.confirmRow}>
            <Text style={[styles.confirmLabel, { color: Colors.slateLighter }]}>
              No additional details provided
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.confirmHint, { color: Colors.slateLighter }]}>
        The package will be logged as Received. You can update its status from the board.
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LogPackageScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeOrg, logPackage, isLoggingPackage } = useOrganization();
  // Billing grace period — staff intake locks ONLY at stage 3 (day 30+).
  // Intentionally NOT gated during stages 1-2 (see useSubscriptionGate.ts):
  // package intake is core value and residents' actual mail, so it stays live
  // through the entire 30-day window regardless of billing state.
  const { isStaffIntakeLocked } = useSubscriptionGate();

  const [step, setStep] = useState<number>(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [carrier, setCarrier] = useState<string | null>(null);
  const [unitNumber, setUnitNumber] = useState<string>('');
  const [tracking, setTracking] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [sizeHint, setSizeHint] = useState<PackageSizeHint | null>(null);

  const goToStep = (next: number) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -12, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const canProceed = useCallback((): boolean => {
    if (step === 0) return !!carrier;
    if (step === 1) return true; // details are all optional
    return true;
  }, [step, carrier]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      goToStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      goToStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!carrier || !activeOrg?.id) return;
    // Billing grace stage 3 (day 30+): the ONLY point where staff intake stops
    if (isStaffIntakeLocked) return;
    try {
      await logPackage({
        carrier,
        tracking: tracking.trim() || null,
        unitNumber: unitNumber.trim() || null,
        notes: null,
        description: description.trim() || null,
        sizeHint,
        location: location.trim() || null,
      });
      // Success feedback then pop back to board
      Alert.alert('Package Logged', 'The package has been added to the board.', [
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert('Error', 'Could not log the package. Please try again.');
    }
  }, [carrier, activeOrg?.id, logPackage, tracking, unitNumber, description, sizeHint, location, isStaffIntakeLocked]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Log Package</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </Text>
        </View>

        <StepDots currentStep={step} />
      </View>

      {/* ── Step content ────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.stepWrapper,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* ── Billing grace — staff lockout notice (stage 3 ONLY) ─────────── */}
        <StaffIntakeLockoutNotice />

        {step === 0 && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          >
            <CarrierStep selected={carrier} onSelect={setCarrier} />
          </ScrollView>
        )}

        {step === 1 && (
          <DetailsStep
            unitNumber={unitNumber}
            setUnitNumber={setUnitNumber}
            tracking={tracking}
            setTracking={setTracking}
            description={description}
            setDescription={setDescription}
            location={location}
            setLocation={setLocation}
            sizeHint={sizeHint}
            setSizeHint={setSizeHint}
          />
        )}

        {step === 2 && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          >
            <ConfirmStep
              carrier={carrier ?? 'Other'}
              unitNumber={unitNumber}
              tracking={tracking}
              description={description}
              location={location}
              sizeHint={sizeHint}
            />
          </ScrollView>
        )}
      </Animated.View>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.bottomNav,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
          },
        ]}
      >
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            style={[
              styles.nextBtn,
              {
                backgroundColor: canProceed() ? Colors.primary : Colors.border,
                opacity: canProceed() ? 1 : 0.5,
              },
            ]}
            onPress={handleNext}
            disabled={!canProceed()}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Continue</Text>
            <ArrowRight size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: Colors.success }]}
            onPress={handleSubmit}
            disabled={isLoggingPackage || isStaffIntakeLocked}
            activeOpacity={0.85}
          >
            {isLoggingPackage ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Package size={18} color="#fff" />
                <Text style={styles.nextBtnText}>Log Package</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

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

  stepDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  stepDot: { height: 8, borderRadius: 4 },

  stepWrapper: { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 24 },

  stepHeadline: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4, marginBottom: 6 },
  stepSub: { fontSize: 14, lineHeight: 20, marginBottom: 24 },

  // Carrier grid
  carrierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  carrierTile: {
    width: '47%',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  carrierColorBlob: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierAbbrev: { fontSize: 13, fontWeight: '800' as const, letterSpacing: 0.5 },
  carrierLabel: { fontSize: 13, fontWeight: '600' as const },
  carrierCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input fields
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  inputIcon: { opacity: 0.7 },
  input: { flex: 1, fontSize: 15 },

  // Size grid
  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  sizeTile: {
    width: '47%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    gap: 4,
  },
  sizeEmoji: { fontSize: 22 },
  sizeLabel: { fontSize: 14, fontWeight: '700' as const },
  sizeDesc: { fontSize: 11, lineHeight: 16 },

  // Confirm step
  confirmCarrierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  confirmCarrierBlob: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmAbbrev: { fontSize: 15, fontWeight: '800' as const },
  confirmCarrierName: { fontSize: 17, fontWeight: '700' as const },
  confirmCarrierSub: { fontSize: 12, marginTop: 2 },
  confirmTable: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  confirmLabel: { fontSize: 13 },
  confirmValue: { fontSize: 13, fontWeight: '600' as const, flex: 1, textAlign: 'right' },
  confirmHint: { fontSize: 12, lineHeight: 18, marginTop: 14, textAlign: 'center' },

  // Bottom nav
  bottomNav: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  nextBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 16 },
});
