import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, AlertTriangle, CheckCircle, Truck } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import {
  type IncidentType,
  type IncidentSeverity,
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPE_EMOJI,
  INCIDENT_SEVERITY_LABELS,
  SEVERITY_HEX,
} from '@/types/incidents';

// ─── Ordered type list for the grid ──────────────────────────────────────────

const INCIDENT_TYPES: IncidentType[] = [
  'missing_package',
  'delivered_not_found',
  'misdelivered',
  'damaged',
  'tampered',
  'suspicious_activity',
  'held_too_long',
  'wrong_pickup',
  'rule_violation',
  'carrier_failure',
  'duplicate_complaint',
  'other',
];

const SEVERITIES: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];

// Incident types where the resident should be reminded to contact the carrier directly.
const CARRIER_ACTION_TYPES: IncidentType[] = [
  'missing_package',
  'delivered_not_found',
  'misdelivered',
  'damaged',
  'tampered',
  'carrier_failure',
];

// Default title templates by type
const TYPE_TITLE_TEMPLATES: Record<IncidentType, string> = {
  missing_package:     'Package missing from expected location',
  delivered_not_found: 'Carrier marked delivered but package not found',
  misdelivered:        'Package delivered to wrong unit',
  damaged:             'Package arrived damaged',
  tampered:            'Package appears opened or tampered with',
  suspicious_activity: 'Suspicious activity near delivery area',
  held_too_long:       'Package held in common area too long',
  wrong_pickup:        'Package picked up by wrong person',
  rule_violation:      'Delivery made outside community rules',
  carrier_failure:     'Carrier failed to follow delivery instructions',
  duplicate_complaint: 'Duplicate complaint about same package',
  other:               'Package delivery issue',
};

// ─── Type tile ────────────────────────────────────────────────────────────────

function TypeTile({
  type,
  selected,
  onSelect,
  index,
}: {
  type: IncidentType;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 30,
      useNativeDriver: true,
      tension: 70,
      friction: 10,
    }).start();
  }, [scaleAnim, index]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(pressAnim, { toValue: 0.93, duration: 60, useNativeDriver: true }),
      Animated.timing(pressAnim, { toValue: 1,    duration: 90, useNativeDriver: true }),
    ]).start();
    onSelect();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.typeTileWrap}>
      <Animated.View
        style={[
          styles.typeTile,
          {
            backgroundColor: selected ? Colors.primary + '14' : Colors.surface,
            borderColor: selected ? Colors.primary + '55' : Colors.border,
            transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }],
          },
        ]}
      >
        <Text style={styles.typeTileEmoji}>{INCIDENT_TYPE_EMOJI[type]}</Text>
        <Text
          style={[styles.typeTileLabel, { color: selected ? Colors.primary : Colors.slateLight }]}
          numberOfLines={2}
        >
          {INCIDENT_TYPE_LABELS[type]}
        </Text>
        {selected ? (
          <View style={[styles.typeTileCheck, { backgroundColor: Colors.primary }]}>
            <CheckCircle size={10} color="#fff" strokeWidth={3} />
          </View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Severity pill ────────────────────────────────────────────────────────────

function SeverityPill({
  severity,
  selected,
  onSelect,
}: {
  severity: IncidentSeverity;
  selected: boolean;
  onSelect: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const accent = SEVERITY_HEX[severity];

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 60, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 90, useNativeDriver: true }),
    ]).start();
    onSelect();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.severityPill,
          {
            backgroundColor: selected ? accent + '20' : '#00000008',
            borderColor: selected ? accent + '70' : '#00000012',
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.severityPillDots}>
          {[0, 1, 2].map((i) => {
            const filled =
              severity === 'low' ? 1 : severity === 'medium' ? 2 : 3;
            return (
              <View
                key={i}
                style={[
                  styles.severityPillDot,
                  { backgroundColor: i < filled ? accent : accent + '28' },
                ]}
              />
            );
          })}
        </View>
        <Text style={[styles.severityPillLabel, { color: selected ? accent : '#66798F' }]}>
          {INCIDENT_SEVERITY_LABELS[severity]}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ text, required }: { text: string; required?: boolean }) {
  const Colors = useColors();
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={[styles.sectionLabelText, { color: Colors.slate }]}>{text}</Text>
      {required ? (
        <Text style={[styles.sectionRequired, { color: Colors.danger }]}>required</Text>
      ) : null}
    </View>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessView({ onDone }: { onDone: () => void }) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [scaleAnim]);

  return (
    <View style={[styles.successRoot, { backgroundColor: Colors.background }]}>
      <Animated.View style={[styles.successContent, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.successIcon, { backgroundColor: Colors.success + '18' }]}>
          <CheckCircle size={52} color={Colors.success} strokeWidth={1.5} />
        </View>
        <Text style={[styles.successTitle, { color: Colors.slate }]}>Incident Filed</Text>
        <Text style={[styles.successSub, { color: Colors.slateLight }]}>
          Your report is in the queue. Community staff will review it shortly.
        </Text>
        <TouchableOpacity
          style={[styles.successBtn, { backgroundColor: Colors.primary }]}
          onPress={onDone}
          activeOpacity={0.85}
        >
          <Text style={styles.successBtnText}>Back to Queue</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FileIncidentScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeOrg, fileIncident, isFilingIncident } = useOrganization();

  const [selectedType,     setSelectedType]     = useState<IncidentType | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<IncidentSeverity>('medium');
  const [title,            setTitle]            = useState<string>('');
  const [description,      setDescription]      = useState<string>('');
  const [unitNumber,       setUnitNumber]       = useState<string>('');
  const [submitted,        setSubmitted]        = useState<boolean>(false);

  const headerAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  // Auto-populate title when type changes
  const handleTypeSelect = useCallback((type: IncidentType) => {
    setSelectedType(type);
    if (!title.trim()) {
      setTitle(TYPE_TITLE_TEMPLATES[type]);
    }
  }, [title]);

  const canSubmit = selectedType !== null && title.trim().length > 0;
  const showCarrierReminder = selectedType !== null && CARRIER_ACTION_TYPES.includes(selectedType);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !activeOrg) return;
    try {
      await fileIncident({
        type: selectedType!,
        severity: selectedSeverity,
        title: title.trim(),
        description: description.trim() || null,
        unitNumber: unitNumber.trim() || null,
      });
      setSubmitted(true);
    } catch {
      Alert.alert('Error', 'Could not file incident. Please check your connection and try again.');
    }
  }, [canSubmit, activeOrg, fileIncident, selectedType, selectedSeverity, title, description, unitNumber]);

  if (submitted) {
    return <SuccessView onDone={() => router.replace('/incident-queue')} />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>File Incident</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg?.name ?? 'Community'}
          </Text>
        </View>
        {/* Danger accent */}
        <View style={[styles.headerBadge, { backgroundColor: Colors.danger + '14', borderColor: Colors.danger + '40' }]}>
          <AlertTriangle size={12} color={Colors.danger} />
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Incident type grid ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel text="What happened?" required />
          <View style={styles.typeGrid}>
            {INCIDENT_TYPES.map((type, i) => (
              <TypeTile
                key={type}
                type={type}
                selected={selectedType === type}
                onSelect={() => handleTypeSelect(type)}
                index={i}
              />
            ))}
          </View>
        </View>

        {/* ── Carrier responsibility reminder ──────────────────────────────── */}
        {showCarrierReminder ? (
          <View style={[styles.carrierNote, { backgroundColor: Colors.secondary + '0F', borderColor: Colors.secondary + '40' }]}>
            <View style={[styles.carrierNoteIcon, { backgroundColor: Colors.secondary + '1A' }]}>
              <Truck size={16} color={Colors.secondary} strokeWidth={2} />
            </View>
            <View style={styles.carrierNoteBody}>
              <Text style={[styles.carrierNoteTitle, { color: Colors.slate }]}>Contact the carrier first</Text>
              <Text style={[styles.carrierNoteText, { color: Colors.slateLight }]}>
                For a missing, lost, or damaged package, contact the carrier handling your shipment (Amazon, UPS, USPS, FedEx, etc.) — they hold your package and are responsible for resolving delivery issues, refunds, and claims. Porchivo provides tracking only; we have no relationship with any carrier and aren&apos;t responsible for your package.
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── Severity ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel text="How serious is this?" />
          <View style={styles.severityRow}>
            {SEVERITIES.map((sev) => (
              <SeverityPill
                key={sev}
                severity={sev}
                selected={selectedSeverity === sev}
                onSelect={() => setSelectedSeverity(sev)}
              />
            ))}
          </View>
        </View>

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel text="Incident title" required />
          <TextInput
            style={[
              styles.textField,
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.border,
                color: Colors.slate,
              },
            ]}
            placeholder="Describe the incident in one line…"
            placeholderTextColor={Colors.slateLighter}
            value={title}
            onChangeText={setTitle}
            maxLength={140}
            returnKeyType="next"
          />
        </View>

        {/* ── Description ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel text="More details" />
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.border,
                color: Colors.slate,
              },
            ]}
            placeholder="What did you observe? When? Where? Who was involved? Any delivery proof or tracking info?"
            placeholderTextColor={Colors.slateLighter}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={1000}
          />
          {description.length > 800 ? (
            <Text style={[styles.charCount, { color: description.length >= 1000 ? Colors.danger : Colors.slateLighter }]}>
              {description.length}/1000
            </Text>
          ) : null}
        </View>

        {/* ── Unit number ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel text="Your unit / address" />
          <TextInput
            style={[
              styles.textField,
              {
                backgroundColor: Colors.surface,
                borderColor: Colors.border,
                color: Colors.slate,
              },
            ]}
            placeholder="e.g. 204, 4B, or leave blank"
            placeholderTextColor={Colors.slateLighter}
            value={unitNumber}
            onChangeText={setUnitNumber}
            maxLength={20}
            autoCapitalize="characters"
            returnKeyType="done"
          />
        </View>

        {/* ── Privacy note ─────────────────────────────────────────────────── */}
        <View style={[styles.privacyNote, { backgroundColor: Colors.primary + '0A', borderColor: Colors.primary + '25' }]}>
          <Text style={[styles.privacyText, { color: Colors.slateLight }]}>
            Your report is visible to community staff and HOA management. Residents only see updates addressed to them.
          </Text>
        </View>
      </ScrollView>

      {/* ── Submit bar ──────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.submitBar,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor: canSubmit ? Colors.danger : Colors.slateLighter + '40',
            },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || isFilingIncident}
          activeOpacity={0.85}
        >
          {isFilingIncident ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.submitBtnText, { opacity: canSubmit ? 1 : 0.5 }]}>
              Submit Incident
            </Text>
          )}
        </TouchableOpacity>
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
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { paddingTop: 4 },

  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabelText: { fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },
  sectionRequired: { fontSize: 11, fontWeight: '600' as const },

  // Type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  typeTileWrap: {
    width: '33.33%',
    padding: 4,
  },
  typeTile: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    minHeight: 88,
    justifyContent: 'center',
    position: 'relative',
  },
  typeTileEmoji: { fontSize: 24 },
  typeTileLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center',
    lineHeight: 14,
  },
  typeTileCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Severity
  severityRow: { flexDirection: 'row', gap: 8 },
  severityPill: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  severityPillDots: { flexDirection: 'row', gap: 4 },
  severityPillDot: { width: 7, height: 7, borderRadius: 3.5 },
  severityPillLabel: { fontSize: 11, fontWeight: '700' as const },

  // Fields
  textField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 110,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },

  // Carrier reminder
  carrierNote: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 22,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  carrierNoteIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierNoteBody: { flex: 1, gap: 3 },
  carrierNoteTitle: { fontSize: 13, fontWeight: '700' as const, letterSpacing: -0.2 },
  carrierNoteText: { fontSize: 12, lineHeight: 17 },

  // Privacy note
  privacyNote: {
    marginHorizontal: 20,
    marginTop: 22,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyText: { fontSize: 12, lineHeight: 17 },

  // Submit bar
  submitBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },

  // Success
  successRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successContent: { alignItems: 'center', gap: 16 },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.4 },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  successBtn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  successBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },
});
