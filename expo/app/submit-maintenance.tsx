import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Send,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  type MaintenanceCategory,
  type MaintenancePriority,
  CATEGORY_META,
  PRIORITY_META,
  SUBMISSION_CATEGORIES,
  PRIORITY_OPTIONS,
} from '@/types/maintenance';

// ─── Category grid cell ───────────────────────────────────────────────────────

function CategoryCell({
  cat,
  selected,
  onSelect,
}: {
  cat: MaintenanceCategory;
  selected: boolean;
  onSelect: (c: MaintenanceCategory) => void;
}) {
  const Colors = useColors();
  const meta = CATEGORY_META[cat];
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => onSelect(cat));
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress} style={styles.catCellOuter}>
      <Animated.View
        style={[
          styles.catCell,
          {
            backgroundColor: selected ? meta.color + '22' : Colors.surface,
            borderColor: selected ? meta.color : Colors.border,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={styles.catCellEmoji}>{catEmoji(cat)}</Text>
        <Text style={[styles.catCellLabel, { color: selected ? meta.color : Colors.slateLight }]}>
          {meta.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function catEmoji(cat: MaintenanceCategory): string {
  switch (cat) {
    case 'plumbing':     return '🚰';
    case 'electrical':   return '⚡';
    case 'hvac':         return '🌡️';
    case 'appliance':    return '🔌';
    case 'structural':   return '🧱';
    case 'common_area':  return '🏛️';
    case 'landscaping':  return '🌿';
    case 'pest_control': return '🐛';
    case 'security':     return '🔒';
    case 'parking':      return '🚗';
    case 'elevator':     return '🛗';
    case 'amenity':      return '🏊';
    case 'other':        return '🔧';
  }
}

// ─── Priority row ─────────────────────────────────────────────────────────────

function PriorityOption({
  priority,
  selected,
  onSelect,
}: {
  priority: MaintenancePriority;
  selected: boolean;
  onSelect: (p: MaintenancePriority) => void;
}) {
  const Colors = useColors();
  const meta = PRIORITY_META[priority];

  const descriptions: Record<MaintenancePriority, string> = {
    low:       'Not urgent, schedule when convenient',
    normal:    'Standard request, fix within a few days',
    high:      'Impacts daily living, needs prompt attention',
    emergency: 'Safety hazard or severe disruption — immediate response',
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onSelect(priority)}
      style={[
        styles.priorityRow,
        {
          backgroundColor: selected ? meta.bgColor : Colors.surface,
          borderColor: selected ? meta.color : Colors.border,
        },
      ]}
    >
      <View style={[styles.priorityDot, { backgroundColor: meta.color }]} />
      <View style={styles.priorityInfo}>
        <Text style={[styles.priorityLabel, { color: selected ? meta.color : Colors.slate }]}>
          {meta.label}
        </Text>
        <Text style={[styles.priorityDesc, { color: Colors.slateLighter }]}>
          {descriptions[priority]}
        </Text>
      </View>
      {selected ? (
        <View style={[styles.priorityCheck, { backgroundColor: meta.color }]}>
          <Text style={styles.priorityCheckMark}>✓</Text>
        </View>
      ) : (
        <View style={[styles.priorityCircle, { borderColor: Colors.border }]} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SubmitMaintenanceScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, activeMembership } = useOrganization();

  const [category, setCategory] = useState<MaintenanceCategory>('other');
  const [priority, setPriority] = useState<MaintenancePriority>('normal');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [locationDetail, setLocationDetail] = useState<string>('');
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [allowEntry, setAllowEntry] = useState<boolean>(false);
  const [showPriority, setShowPriority] = useState<boolean>(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrg?.id) throw new Error('No active org');
      if (!title.trim()) throw new Error('Title is required');

      const { data, error } = await supabase.rpc('submit_maintenance_request', {
        p_org_id:      activeOrg.id,
        p_category:    category,
        p_priority:    priority,
        p_title:       title.trim(),
        p_description: description.trim() || null,
        p_location:    locationDetail.trim() || null,
        p_preferred:   preferredTime.trim() || null,
        p_allow_entry: allowEntry,
        p_unit_id:     activeMembership?.unitId ?? null,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-queue', activeOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-counts', activeOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-maintenance', activeOrg?.id] });
      Alert.alert(
        'Request Submitted',
        "Your maintenance request has been submitted. You'll receive updates as it progresses.",
        [{ text: 'Done', onPress: () => router.back() }]
      );
    },
    onError: (err: Error) => {
      Alert.alert('Submission Failed', err.message || 'Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a brief title for the issue.');
      return;
    }
    if (priority === 'emergency') {
      Alert.alert(
        'Submit Emergency Request?',
        'This will be marked as highest priority and notify building staff immediately.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit Emergency', style: 'destructive', onPress: () => submitMutation.mutate() },
        ]
      );
    } else {
      submitMutation.mutate();
    }
  };

  const priMeta = PRIORITY_META[priority];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
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
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>New Request</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg?.name ?? 'Maintenance'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: submitMutation.isPending ? Colors.slateLighter : Colors.primary },
          ]}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
          activeOpacity={0.85}
        >
          <Send size={15} color="#fff" />
          <Text style={styles.submitBtnText}>
            {submitMutation.isPending ? 'Sending…' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Category grid ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Category</Text>
          <View style={styles.catGrid}>
            {SUBMISSION_CATEGORIES.map((cat) => (
              <CategoryCell
                key={cat}
                cat={cat}
                selected={category === cat}
                onSelect={setCategory}
              />
            ))}
          </View>
        </View>

        {/* ── Priority ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.priorityToggleRow}
            onPress={() => setShowPriority((v) => !v)}
            activeOpacity={0.8}
          >
            <View>
              <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Priority</Text>
              <View style={styles.priorityPreview}>
                <View style={[styles.priorityPreviewDot, { backgroundColor: priMeta.color }]} />
                <Text style={[styles.priorityPreviewText, { color: priMeta.color }]}>
                  {priMeta.label}
                </Text>
              </View>
            </View>
            {showPriority
              ? <ChevronUp size={18} color={Colors.slateLighter} />
              : <ChevronDown size={18} color={Colors.slateLighter} />
            }
          </TouchableOpacity>

          {showPriority ? (
            <View style={styles.priorityList}>
              {PRIORITY_OPTIONS.map((p) => (
                <PriorityOption
                  key={p}
                  priority={p}
                  selected={priority === p}
                  onSelect={(v) => { setPriority(v); setShowPriority(false); }}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slate }]}>
            Issue Title <Text style={{ color: Colors.danger }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
            placeholder="e.g. Leaking faucet in kitchen"
            placeholderTextColor={Colors.slateLighter}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            returnKeyType="next"
          />
        </View>

        {/* ── Description ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
            placeholder="Describe the issue in detail — what's happening, when it started, severity…"
            placeholderTextColor={Colors.slateLighter}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1200}
          />
          <Text style={[styles.charCount, { color: Colors.slateLighter }]}>
            {description.length}/1200
          </Text>
        </View>

        {/* ── Location ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Location Detail</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
            placeholder="e.g. Master bathroom, Hallway B2, Parking spot 14"
            placeholderTextColor={Colors.slateLighter}
            value={locationDetail}
            onChangeText={setLocationDetail}
            maxLength={200}
            returnKeyType="next"
          />
        </View>

        {/* ── Preferred time ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Preferred Access Time</Text>
          <TextInput
            style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
            placeholder="e.g. Weekday mornings, after 5pm, any time"
            placeholderTextColor={Colors.slateLighter}
            value={preferredTime}
            onChangeText={setPreferredTime}
            maxLength={120}
            returnKeyType="done"
          />
        </View>

        {/* ── Entry permission ─────────────────────────────────────────────── */}
        <View style={[styles.section]}>
          <View
            style={[
              styles.entryRow,
              { backgroundColor: Colors.surface, borderColor: allowEntry ? Colors.primary + '55' : Colors.border },
            ]}
          >
            <View style={styles.entryInfo}>
              <Text style={[styles.entryLabel, { color: Colors.slate }]}>Allow Entry Without Me Present</Text>
              <Text style={[styles.entryDesc, { color: Colors.slateLighter }]}>
                Staff may access your unit while you're away to complete the repair
              </Text>
            </View>
            <Switch
              value={allowEntry}
              onValueChange={setAllowEntry}
              trackColor={{ false: Colors.border, true: Colors.primary + '88' }}
              thumbColor={allowEntry ? Colors.primary : Colors.slateLighter}
            />
          </View>
        </View>

        {/* ── Info note ────────────────────────────────────────────────────── */}
        <View style={[styles.infoNote, { backgroundColor: Colors.primary + '0D', borderColor: Colors.primary + '30' }]}>
          <Info size={14} color={Colors.primary} />
          <Text style={[styles.infoNoteText, { color: Colors.slateLight }]}>
            You'll receive in-app updates as your request is reviewed, scheduled, and resolved. Staff notes visible to you will appear on the request.
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const },
  headerSub:   { fontSize: 12, marginTop: 1 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },

  // Form
  form: { padding: 16, gap: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600' as const, marginBottom: 10 },

  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catCellOuter: { width: '22%' },
  catCell: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  catCellEmoji: { fontSize: 20 },
  catCellLabel: { fontSize: 10, fontWeight: '500' as const, textAlign: 'center' as const },

  // Priority
  priorityToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priorityPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  priorityPreviewDot: { width: 8, height: 8, borderRadius: 4 },
  priorityPreviewText: { fontSize: 13, fontWeight: '500' as const },
  priorityList: { gap: 8 },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityInfo: { flex: 1 },
  priorityLabel: { fontSize: 14, fontWeight: '600' as const },
  priorityDesc:  { fontSize: 12, marginTop: 2 },
  priorityCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityCheckMark: { color: '#fff', fontSize: 12, fontWeight: '700' as const },
  priorityCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },

  // Inputs
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 110,
  },
  charCount: { fontSize: 11, textAlign: 'right' as const, marginTop: 4 },

  // Entry permission
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  entryInfo: { flex: 1 },
  entryLabel: { fontSize: 14, fontWeight: '600' as const },
  entryDesc:  { fontSize: 12, marginTop: 3, lineHeight: 17 },

  // Info note
  infoNote: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  infoNoteText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
