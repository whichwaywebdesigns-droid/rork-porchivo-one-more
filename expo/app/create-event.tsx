import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Repeat,
  Bell,
  Lock,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import {
  type CalendarEventCategory,
  CALENDAR_CATEGORY_META,
} from '@/types/organization';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES: CalendarEventCategory[] = [
  'meeting', 'maintenance', 'amenity', 'social', 'deadline', 'inspection', 'emergency', 'other',
];

const RECURRENCE_OPTIONS = [
  { value: null, label: 'Does not repeat' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

// Returns today at a given hour, ISO string
function todayAt(hour: number, min = 0): string {
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

// Format a date-time for display in the picker
function displayDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Increment hour by 1
function plusOneHour(iso: string): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  const Colors = useColors();
  return (
    <View style={styles.stepWrap}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            {
              backgroundColor: i < step ? Colors.primary : i === step ? Colors.primary : Colors.border,
              opacity: i === step ? 1 : i < step ? 0.5 : 0.3,
              width: i === step ? 20 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Category grid ────────────────────────────────────────────────────────────

function CategoryGrid({
  selected,
  onSelect,
}: {
  selected: CalendarEventCategory;
  onSelect: (c: CalendarEventCategory) => void;
}) {
  const Colors = useColors();
  return (
    <View style={styles.catGrid}>
      {CATEGORIES.map((cat) => {
        const meta = CALENDAR_CATEGORY_META[cat];
        const isSelected = selected === cat;
        return (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catCard,
              {
                backgroundColor: isSelected ? meta.color + '18' : Colors.surface,
                borderColor: isSelected ? meta.color : Colors.border,
              },
            ]}
            onPress={() => onSelect(cat)}
            activeOpacity={0.75}
          >
            <View style={[styles.catIcon, { backgroundColor: meta.color + '20' }]}>
              {isSelected && <Check size={16} color={meta.color} strokeWidth={2.5} />}
              {!isSelected && (
                <View style={[styles.catDot, { backgroundColor: meta.color }]} />
              )}
            </View>
            <Text style={[styles.catLabel, { color: isSelected ? meta.color : Colors.slate }]}>
              {meta.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Time adjuster ────────────────────────────────────────────────────────────

function TimeAdjuster({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  icon: React.ReactNode;
}) {
  const Colors = useColors();
  const d = new Date(value);

  const adjustHour = (delta: number) => {
    d.setHours(d.getHours() + delta);
    onChange(d.toISOString());
  };
  const adjustDay = (delta: number) => {
    d.setDate(d.getDate() + delta);
    onChange(d.toISOString());
  };

  return (
    <View style={[styles.timeAdjuster, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <View style={styles.timeAdjusterLabelRow}>
        {icon}
        <Text style={[styles.timeAdjusterLabel, { color: Colors.slateLight }]}>{label}</Text>
      </View>
      <Text style={[styles.timeAdjusterValue, { color: Colors.slate }]}>
        {displayDateTime(value)}
      </Text>
      <View style={styles.timeAdjusterBtns}>
        <TouchableOpacity
          style={[styles.timeBtn, { borderColor: Colors.border }]}
          onPress={() => adjustDay(-1)}
        >
          <Text style={[styles.timeBtnText, { color: Colors.slateLight }]}>- Day</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.timeBtn, { borderColor: Colors.border }]}
          onPress={() => adjustHour(-1)}
        >
          <Text style={[styles.timeBtnText, { color: Colors.slateLight }]}>- 1h</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.timeBtn, { borderColor: Colors.border }]}
          onPress={() => adjustHour(1)}
        >
          <Text style={[styles.timeBtnText, { color: Colors.slateLight }]}>+ 1h</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.timeBtn, { borderColor: Colors.border }]}
          onPress={() => adjustDay(1)}
        >
          <Text style={[styles.timeBtnText, { color: Colors.slateLight }]}>+ Day</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeOrg, activeMembership, isOrgStaff, createCalendarEvent, isCreatingCalendarEvent } =
    useOrganization();

  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CalendarEventCategory>('meeting');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState(todayAt(10));
  const [endsAt, setEndsAt] = useState(todayAt(11));
  const [allDay, setAllDay] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [notifyResidents, setNotifyResidents] = useState(false);
  const [maxAttendees, setMaxAttendees] = useState('');
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);

  const TOTAL_STEPS = 3;

  const goTo = useCallback(
    (next: number) => {
      Animated.timing(slideAnim, {
        toValue: next,
        duration: 280,
        useNativeDriver: false,
      }).start(() => setStep(next));
    },
    [slideAnim]
  );

  const handleNext = () => {
    if (step === 0 && !title.trim()) {
      Alert.alert('Required', 'Please enter an event title.');
      return;
    }
    goTo(step + 1);
  };

  const handleBack = () => {
    if (step === 0) { router.back(); return; }
    goTo(step - 1);
  };

  const handleSubmit = useCallback(async () => {
    if (!activeOrg?.id) return;
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an event title.');
      return;
    }
    try {
      await createCalendarEvent({
        title: title.trim(),
        description: description.trim() || null,
        category,
        location: location.trim() || null,
        startsAt,
        endsAt: allDay ? null : endsAt,
        allDay,
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule : null,
        isPublic,
        notifyResidents,
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
      });
      router.replace('/community-calendar');
    } catch {
      Alert.alert('Error', 'Could not create event. Please try again.');
    }
  }, [
    activeOrg?.id,
    title, description, category, location,
    startsAt, endsAt, allDay, isRecurring, recurrenceRule,
    isPublic, notifyResidents, maxAttendees,
    createCalendarEvent,
  ]);

  if (
    !activeOrg ||
    !activeMembership ||
    (!isOrgStaff && activeMembership.role !== 'board_member')
  ) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <Text style={[styles.noAccessText, { color: Colors.slateLight }]}>
          You do not have permission to create events.
        </Text>
      </View>
    );
  }

  const catMeta = CALENDAR_CATEGORY_META[category];

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
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
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>New Calendar Event</Text>
          <StepIndicator step={step} total={TOTAL_STEPS} />
        </View>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 60 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 0: What & Category ──────────────────────────────────── */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepHeading, { color: Colors.slate }]}>What is this event?</Text>
            <Text style={[styles.stepSub, { color: Colors.slateLighter }]}>
              Give it a clear title and pick a category so residents know what to expect.
            </Text>

            {/* Title */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>Event Title *</Text>
              <TextInput
                style={[styles.input, { color: Colors.slate, backgroundColor: Colors.surface, borderColor: Colors.border }]}
                placeholder="e.g. Board Meeting – July"
                placeholderTextColor={Colors.slateLighter}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                returnKeyType="done"
              />
            </View>

            {/* Description */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { color: Colors.slate, backgroundColor: Colors.surface, borderColor: Colors.border }]}
                placeholder="What should residents know about this event?"
                placeholderTextColor={Colors.slateLighter}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={600}
              />
            </View>

            {/* Category */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>Category *</Text>
              <CategoryGrid selected={category} onSelect={setCategory} />
            </View>
          </View>
        )}

        {/* ── Step 1: When & Where ─────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepHeading, { color: Colors.slate }]}>When & where?</Text>
            <Text style={[styles.stepSub, { color: Colors.slateLighter }]}>
              Set timing and location so residents can plan ahead.
            </Text>

            {/* All day toggle */}
            <View style={[styles.toggleRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <View style={styles.toggleLeft}>
                <Calendar size={16} color={Colors.primary} strokeWidth={2} />
                <Text style={[styles.toggleLabel, { color: Colors.slate }]}>All-day event</Text>
              </View>
              <Switch
                value={allDay}
                onValueChange={setAllDay}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Start */}
            <TimeAdjuster
              label="Starts"
              value={startsAt}
              onChange={(v) => {
                setStartsAt(v);
                setEndsAt(plusOneHour(v));
              }}
              icon={<Clock size={14} color={Colors.primary} strokeWidth={2} />}
            />

            {/* End */}
            {!allDay && (
              <TimeAdjuster
                label="Ends"
                value={endsAt}
                onChange={setEndsAt}
                icon={<Clock size={14} color={Colors.slateLight} strokeWidth={2} />}
              />
            )}

            {/* Location */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>Location</Text>
              <View style={[styles.iconInput, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <MapPin size={15} color={Colors.slateLighter} strokeWidth={2} />
                <TextInput
                  style={[styles.iconInputText, { color: Colors.slate }]}
                  placeholder="Clubhouse, Room 101, Pool area…"
                  placeholderTextColor={Colors.slateLighter}
                  value={location}
                  onChangeText={setLocation}
                  maxLength={120}
                />
              </View>
            </View>

            {/* Recurring */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>Recurrence</Text>
              <TouchableOpacity
                style={[styles.iconInput, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={() => setRecurrenceOpen((o) => !o)}
              >
                <Repeat size={15} color={Colors.slateLighter} strokeWidth={2} />
                <Text style={[styles.iconInputText, { color: Colors.slate }]}>
                  {RECURRENCE_OPTIONS.find((o) => o.value === recurrenceRule)?.label ?? 'Does not repeat'}
                </Text>
                <ChevronDown size={14} color={Colors.slateLighter} />
              </TouchableOpacity>
              {recurrenceOpen && (
                <View style={[styles.dropdown, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[
                        styles.dropdownItem,
                        {
                          backgroundColor:
                            recurrenceRule === opt.value ? Colors.primary + '10' : 'transparent',
                          borderBottomColor: Colors.border,
                        },
                      ]}
                      onPress={() => {
                        setRecurrenceRule(opt.value);
                        setIsRecurring(opt.value !== null);
                        setRecurrenceOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          {
                            color:
                              recurrenceRule === opt.value ? Colors.primary : Colors.slate,
                            fontWeight: recurrenceRule === opt.value ? '600' : '400',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {recurrenceRule === opt.value && (
                        <Check size={14} color={Colors.primary} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Step 2: Settings ─────────────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepHeading, { color: Colors.slate }]}>Visibility & settings</Text>
            <Text style={[styles.stepSub, { color: Colors.slateLighter }]}>
              Control who sees this event and how residents are notified.
            </Text>

            {/* Public toggle */}
            <View style={[styles.toggleRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <View style={styles.toggleLeft}>
                <Lock size={16} color={Colors.primary} strokeWidth={2} />
                <View>
                  <Text style={[styles.toggleLabel, { color: Colors.slate }]}>
                    {isPublic ? 'Visible to all residents' : 'Staff & board only'}
                  </Text>
                  <Text style={[styles.toggleSub, { color: Colors.slateLighter }]}>
                    {isPublic
                      ? 'All active members can see this event'
                      : 'Only staff and board members can see this'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Notify toggle */}
            <View style={[styles.toggleRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <View style={styles.toggleLeft}>
                <Bell size={16} color={Colors.gold} strokeWidth={2} />
                <View>
                  <Text style={[styles.toggleLabel, { color: Colors.slate }]}>Notify residents</Text>
                  <Text style={[styles.toggleSub, { color: Colors.slateLighter }]}>
                    Send a push notification when this event is published
                  </Text>
                </View>
              </View>
              <Switch
                value={notifyResidents}
                onValueChange={setNotifyResidents}
                trackColor={{ false: Colors.border, true: Colors.gold }}
                thumbColor="#fff"
              />
            </View>

            {/* Max attendees */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>Max Attendees (optional)</Text>
              <View style={[styles.iconInput, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <Users size={15} color={Colors.slateLighter} strokeWidth={2} />
                <TextInput
                  style={[styles.iconInputText, { color: Colors.slate }]}
                  placeholder="Leave blank for unlimited"
                  placeholderTextColor={Colors.slateLighter}
                  value={maxAttendees}
                  onChangeText={(v) => setMaxAttendees(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>

            {/* Preview card */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: Colors.slateLight }]}>Preview</Text>
              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: Colors.surface,
                    borderColor: Colors.border,
                    borderLeftColor: catMeta.color,
                  },
                ]}
              >
                <View style={styles.previewHeader}>
                  <View style={[styles.previewDot, { backgroundColor: catMeta.color }]} />
                  <Text style={[styles.previewTitle, { color: Colors.slate }]} numberOfLines={1}>
                    {title || 'Event Title'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.previewCatPill,
                    { backgroundColor: catMeta.color + '18', borderColor: catMeta.color + '40' },
                  ]}
                >
                  <Text style={[styles.previewCatText, { color: catMeta.color }]}>
                    {catMeta.label}
                  </Text>
                </View>
                <Text style={[styles.previewTime, { color: Colors.slateLighter }]}>
                  {allDay ? 'All day' : displayDateTime(startsAt)}
                </Text>
                {location ? (
                  <Text style={[styles.previewLocation, { color: Colors.slateLighter }]}>
                    {location}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
          },
        ]}
      >
        {step < TOTAL_STEPS - 1 ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
            onPress={handleNext}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: catMeta.color }]}
            onPress={handleSubmit}
            disabled={isCreatingCalendarEvent}
          >
            {isCreatingCalendarEvent ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Event</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  noAccessText: { textAlign: 'center', marginTop: 80, fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  stepWrap: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  stepDot: { height: 6, borderRadius: 3 },
  scroll: { paddingTop: 4 },
  stepContent: { padding: 20, gap: 20 },
  stepHeading: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  stepSub: { fontSize: 14, lineHeight: 20, marginTop: -12 },
  fieldWrap: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
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
    fontSize: 14,
    minHeight: 96,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catIcon: {
    width: 28, height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catLabel: { fontSize: 13, fontWeight: '500' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  toggleLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontSize: 14, fontWeight: '500' },
  toggleSub: { fontSize: 11, marginTop: 2 },
  iconInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconInputText: { flex: 1, fontSize: 14 },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dropdownText: { fontSize: 14 },
  timeAdjuster: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  timeAdjusterLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeAdjusterLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeAdjusterValue: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  timeAdjusterBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  timeBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  timeBtnText: { fontSize: 12, fontWeight: '500' },
  previewCard: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  previewTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  previewCatPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  previewCatText: { fontSize: 10, fontWeight: '600' },
  previewTime: { fontSize: 12 },
  previewLocation: { fontSize: 12 },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
