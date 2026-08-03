import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Package,
  DollarSign,
  Calendar,
  Clock,
  ChevronRight,
  Info,
  CheckCircle,
  X,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { palette, tabularNums } from '@/constants/theme';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import {
  createAssignment,
  fetchPartnerVerification,
  formatCents,
} from '@/lib/partnerVerification';
import { CompensationType } from '@/types';
import {
  PackageSize,
  PACKAGE_SIZE_LABELS,
  PACKAGE_SIZE_DESCRIPTIONS,
  RATE_OPTIONS_BY_SIZE,
  PLATFORM_FEE_PCT,
  PARTNER_SHARE_PCT,
} from '@/lib/partnerRates';

// ─── Package sizes for rate selection ────────────────────────────────────────────

const PACKAGE_SIZES: PackageSize[] = ['small', 'medium', 'large'];

// ─── Date / time quick-pick lists ─────────────────────────────────────────────

function getNextNDays(n: number): { label: string; value: string }[] {
  const days: { label: string; value: string }[] = [];
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label = i === 0
      ? `Today, ${monthNames[d.getMonth()]} ${d.getDate()}`
      : i === 1
        ? `Tomorrow, ${monthNames[d.getMonth()]} ${d.getDate()}`
        : `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
    days.push({ label, value: d.toISOString().split('T')[0] });
  }
  return days;
}

const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM',  '2:00 PM', '3:00 PM',  '4:00 PM',  '5:00 PM',
  '6:00 PM',  '7:00 PM', '8:00 PM',
];

// ─── Picker modal ─────────────────────────────────────────────────────────────

function PickerModal<T extends { label: string; value: string }>({
  visible,
  title,
  items,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: T[];
  onSelect: (item: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={modal.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={modal.sheet}>
        <View style={modal.header}>
          <Text style={modal.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn} activeOpacity={0.7}>
            <X size={20} color={Colors.slateLight} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={modal.item}
              onPress={() => { onSelect(item); onClose(); }}
              activeOpacity={0.8}
            >
              <Text style={modal.itemText}>{item.label}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

const modal = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '55%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: { fontSize: 17, fontWeight: '700' as const, color: palette.ink },
  closeBtn: { padding: 4 },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemText: { fontSize: 16, color: palette.ink, fontWeight: '500' as const },
});

// ─── Fee breakdown ────────────────────────────────────────────────────────────

function FeeBreakdown({ rateCents }: { rateCents: number }) {
  if (rateCents === 0) {
    return (
      <View style={fee.box}>
        <Text style={fee.zeroLabel}>Free hold — no payment required</Text>
      </View>
    );
  }
  const platform = Math.round(rateCents * (PLATFORM_FEE_PCT / 100));
  const partner = rateCents - platform;
  return (
    <View style={fee.box}>
      {[
        { label: 'Total you pay', value: formatCents(rateCents), bold: true },
        { label: `Partner earns (${PARTNER_SHARE_PCT}%)`, value: formatCents(partner), color: Colors.success },
        { label: `Porchivo fee (${PLATFORM_FEE_PCT}%)`,  value: formatCents(platform), color: Colors.slateLighter },
      ].map((row) => (
        <View key={row.label} style={fee.row}>
          <Text style={fee.label}>{row.label}</Text>
          <Text style={[fee.value, row.bold ? fee.bold : {}, row.color ? { color: row.color } : {}]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const fee = StyleSheet.create({
  box: {
    backgroundColor: palette.canvas,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: Colors.slateLight },
  value: { fontSize: 13, color: palette.slate700, fontWeight: '600' as const, ...tabularNums },
  bold: { color: palette.ink, fontWeight: '800' as const, fontSize: 14 },
  zeroLabel: { fontSize: 13, color: Colors.success, fontWeight: '600' as const },
});

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      {children}
    </View>
  );
}

const sec = StyleSheet.create({
  wrap: { marginBottom: 24 },
  title: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.slateLighter,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreateAssignmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    connectionId?: string;
    partnerId?: string;
    partnerName?: string;
  }>();
  const queryClient = useQueryClient();
  const { user } = useApp();

  const connectionId = params.connectionId ?? '';
  const partnerId = params.partnerId ?? '';
  const partnerName = params.partnerName ?? 'Partner';

  // Form state
  const [packageSize, setPackageSize] = useState<PackageSize>('medium');
  const [selectedRateCents, setSelectedRateCents] = useState<number>(800); // default medium base
  const [customCentsStr, setCustomCentsStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Date / time pickers
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [windowStart, setWindowStart] = useState<string>('');
  const [windowEnd, setWindowEnd] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const dayOptions = useMemo(() => getNextNDays(14), []);
  const timeOptions = useMemo(
    () => TIME_SLOTS.map((t) => ({ label: t, value: t })),
    [],
  );

  // Reset rate when package size changes
  const handleSizeChange = useCallback((size: PackageSize) => {
    setPackageSize(size);
    // Pre-select the first non-free option for the new size
    const opts = RATE_OPTIONS_BY_SIZE[size];
    const firstPaid = opts.find((o) => o.cents > 0 && o.cents !== -1);
    setSelectedRateCents(firstPaid?.cents ?? 0);
    setCustomCentsStr('');
  }, []);

  // Effective rate
  const rateCents = useMemo(() => {
    if (selectedRateCents === -1) {
      const parsed = parseInt(customCentsStr.replace(/[^0-9]/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed * 100;
    }
    return selectedRateCents;
  }, [selectedRateCents, customCentsStr]);

  // Fetch partner public verification info
  const { data: partnerVerif } = useQuery({
    queryKey: ['partner-verif-public', partnerId],
    queryFn: () => fetchPartnerVerification(partnerId),
    enabled: !!partnerId,
    staleTime: 1000 * 60 * 5,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createAssignment({
        connectionId,
        partnerId,
        agreedRateCents: rateCents,
        expectedDeliveryDate: deliveryDate || undefined,
        pickupWindowStart: windowStart
          ? (() => {
              // Convert "3:00 PM" on selected date to ISO string
              const base = deliveryDate ? new Date(deliveryDate + 'T12:00:00') : new Date();
              const [time, ampm] = windowStart.split(' ');
              const [h, m] = time.split(':').map(Number);
              const hour24 = ampm === 'PM' && h !== 12 ? h + 12 : ampm === 'AM' && h === 12 ? 0 : h;
              base.setHours(hour24, m, 0, 0);
              return base.toISOString();
            })()
          : undefined,
        pickupWindowEnd: windowEnd
          ? (() => {
              const base = deliveryDate ? new Date(deliveryDate + 'T12:00:00') : new Date();
              const [time, ampm] = windowEnd.split(' ');
              const [h, m] = time.split(':').map(Number);
              const hour24 = ampm === 'PM' && h !== 12 ? h + 12 : ampm === 'AM' && h === 12 ? 0 : h;
              base.setHours(hour24, m, 0, 0);
              return base.toISOString();
            })()
          : undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (data) => {
      if (!data) {
        Alert.alert('Error', 'Failed to create hold request. Please try again.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['homeowner-assignments'] });
      Alert.alert(
        'Hold Request Sent!',
        `Your request has been sent to ${partnerName}. They'll receive a notification to accept.`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    },
    onError: () => {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    },
  });

  const handleSubmit = useCallback(() => {
    if (!connectionId || !partnerId) {
      Alert.alert('Error', 'Missing connection info. Please go back and try again.');
      return;
    }
    if (rateCents > 0 && rateCents < 50) {
      Alert.alert('Rate too low', 'The minimum paid rate is $0.50.');
      return;
    }
    Alert.alert(
      'Confirm Hold Request',
      rateCents > 0
        ? `Send a paid hold request to ${partnerName} for ${formatCents(rateCents)}?`
        : `Send a free hold request to ${partnerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Request', onPress: () => mutation.mutate() },
      ],
    );
  }, [connectionId, partnerId, rateCents, partnerName, mutation]);

  if (!user) return null;

  const canSubmit = !!connectionId && !!partnerId && !mutation.isPending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Request Hold',
          headerStyle: { backgroundColor: palette.canvas },
          headerShadowVisible: false,
          headerTintColor: Colors.primary,
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Partner summary */}
        <View style={styles.partnerCard}>
          <View style={styles.partnerAvatar}>
            <Text style={styles.partnerAvatarText}>
              {partnerName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerName}>{partnerName}</Text>
            {partnerVerif && (
              <Text style={styles.partnerMeta}>
                {partnerVerif.tier.charAt(0).toUpperCase() + partnerVerif.tier.slice(1)} partner
                {partnerVerif.completedAssignments > 0 ? ` · ${partnerVerif.completedAssignments} holds` : ''}
                {partnerVerif.averageRating != null ? ` · ★ ${partnerVerif.averageRating.toFixed(1)}` : ''}
              </Text>
            )}
          </View>
          <Package size={20} color={Colors.primary} />
        </View>

        {/* Package size + Rate */}
        <Section title="Package Size">
          <View style={styles.sizeGrid}>
            {PACKAGE_SIZES.map((size) => {
              const isSelected = packageSize === size;
              return (
                <TouchableOpacity
                  key={size}
                  style={[styles.sizeChip, isSelected && styles.sizeChipActive]}
                  onPress={() => handleSizeChange(size)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sizeChipLabel, isSelected && styles.sizeChipLabelActive]}>
                    {PACKAGE_SIZE_LABELS[size]}
                  </Text>
                  <Text style={[styles.sizeChipDesc, isSelected && styles.sizeChipDescActive]}>
                    {PACKAGE_SIZE_DESCRIPTIONS[size]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title="Compensation">
          <View style={styles.rateGrid}>
            {RATE_OPTIONS_BY_SIZE[packageSize].map((opt) => {
              const isSelected =
                opt.cents === -1 ? selectedRateCents === -1 : opt.cents === selectedRateCents;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.rateChip, isSelected && styles.rateChipActive]}
                  onPress={() => setSelectedRateCents(opt.cents)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rateChipText, isSelected && styles.rateChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedRateCents === -1 && (
            <View style={styles.customInput}>
              <DollarSign size={16} color={Colors.primary} />
              <TextInput
                style={styles.customTextField}
                placeholder="Enter amount (e.g. 12)"
                placeholderTextColor={Colors.slateLighter}
                keyboardType="numeric"
                value={customCentsStr}
                onChangeText={setCustomCentsStr}
                maxLength={6}
              />
            </View>
          )}

          <FeeBreakdown rateCents={rateCents} />
        </Section>

        {/* Delivery date */}
        <Section title="Expected Delivery Date">
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Calendar size={18} color={Colors.primary} />
            <Text style={[styles.pickerText, !deliveryDate && styles.pickerPlaceholder]}>
              {deliveryDate
                ? dayOptions.find((d) => d.value === deliveryDate)?.label ?? deliveryDate
                : 'Select delivery date (optional)'}
            </Text>
            <ChevronRight size={16} color={Colors.slateLight} />
          </TouchableOpacity>
        </Section>

        {/* Pickup window */}
        <Section title="Pickup Window (when I'll be home)">
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setShowStartPicker(true)}
            activeOpacity={0.8}
          >
            <Clock size={18} color={Colors.primary} />
            <Text style={[styles.pickerText, !windowStart && styles.pickerPlaceholder]}>
              {windowStart ? `From: ${windowStart}` : 'Set window start (optional)'}
            </Text>
            <ChevronRight size={16} color={Colors.slateLight} />
          </TouchableOpacity>

          {windowStart !== '' && (
            <TouchableOpacity
              style={[styles.pickerRow, { marginTop: 8 }]}
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.8}
            >
              <Clock size={18} color={Colors.slateLight} />
              <Text style={[styles.pickerText, !windowEnd && styles.pickerPlaceholder]}>
                {windowEnd ? `Until: ${windowEnd}` : 'Set window end (optional)'}
              </Text>
              <ChevronRight size={16} color={Colors.slateLight} />
            </TouchableOpacity>
          )}
        </Section>

        {/* Notes */}
        <Section title="Notes for Partner">
          <View style={styles.textAreaWrap}>
            <TextInput
              style={styles.textArea}
              placeholder={'E.g. "Please leave inside the gate. Ring bell." (optional)'}
              placeholderTextColor={Colors.slateLighter}
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{notes.length}/500</Text>
          </View>
        </Section>

        {/* Info callout */}
        <View style={styles.infoBox}>
          <Info size={15} color={Colors.primary} />
          <Text style={styles.infoText}>
            The partner will receive a notification to accept or decline. Payment is only authorized now — it's captured when you confirm the hold is complete.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <CheckCircle size={20} color={Colors.white} />
          )}
          <Text style={styles.submitBtnText}>
            {mutation.isPending ? 'Sending Request…' : 'Send Hold Request'}
          </Text>
          {!mutation.isPending && <ChevronRight size={18} color={Colors.white} />}
        </TouchableOpacity>

        <Text style={styles.secureNote}>
          🔒 Payments handled by Stripe. Porchivo never stores card details.
        </Text>
      </ScrollView>

      {/* Pickers */}
      <PickerModal
        visible={showDatePicker}
        title="Expected Delivery Date"
        items={dayOptions}
        onSelect={(item) => setDeliveryDate(item.value)}
        onClose={() => setShowDatePicker(false)}
      />
      <PickerModal
        visible={showStartPicker}
        title="Pickup Window Start"
        items={timeOptions}
        onSelect={(item) => setWindowStart(item.value)}
        onClose={() => setShowStartPicker(false)}
      />
      <PickerModal
        visible={showEndPicker}
        title="Pickup Window End"
        items={timeOptions}
        onSelect={(item) => setWindowEnd(item.value)}
        onClose={() => setShowEndPicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: palette.canvas },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },

  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerAvatarText: { fontSize: 22, fontWeight: '700' as const, color: Colors.primary },
  partnerName: { fontSize: 17, fontWeight: '700' as const, color: palette.ink },
  partnerMeta: { fontSize: 12, color: Colors.slateLight, marginTop: 2 },

  sizeGrid: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  sizeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sizeChipActive: {
    backgroundColor: `${Colors.primary}15`,
    borderColor: Colors.primary,
  },
  sizeChipLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.slateLight,
  },
  sizeChipLabelActive: { color: Colors.primary },
  sizeChipDesc: {
    fontSize: 10,
    color: Colors.slateLighter,
    textAlign: 'center' as const,
    marginTop: 2,
    lineHeight: 13,
  },
  sizeChipDescActive: { color: Colors.primary, opacity: 0.7 },

  rateGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  rateChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 11, backgroundColor: Colors.borderLight },
  rateChipActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  rateChipText: { fontSize: 14, fontWeight: '600' as const, color: Colors.slateLight },
  rateChipTextActive: { color: Colors.white, fontWeight: '700' as const },

  customInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  customTextField: { flex: 1, fontSize: 16, fontWeight: '600' as const, color: palette.ink },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pickerText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: palette.ink },
  pickerPlaceholder: { color: Colors.slateLighter, fontWeight: '400' as const },

  textAreaWrap: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: { fontSize: 14, color: palette.ink, lineHeight: 21, minHeight: 90 },
  charCount: { fontSize: 11, color: Colors.slateLighter, textAlign: 'right' as const, marginTop: 6 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.skyBlue,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.primary, lineHeight: 17 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 7,
  },
  submitDisabled: { opacity: 0.55 },
  submitBtnText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.white,
    textAlign: 'center' as const,
  },
  secureNote: {
    fontSize: 12,
    color: Colors.slateLighter,
    textAlign: 'center' as const,
    lineHeight: 17,
  },
});
