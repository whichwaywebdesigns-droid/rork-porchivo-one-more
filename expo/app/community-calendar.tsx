import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Plus,
  ChevronRight,
  MapPin,
  Clock,
  Users,
  Repeat,
  CalendarDays,
  Lock,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  type CalendarEvent,
  type CalendarEventCategory,
  CALENDAR_CATEGORY_META,
  calendarEventFromRpc,
} from '@/types/organization';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['S','M','T','W','T','F','S'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return 'All day';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ─── Category pill ────────────────────────────────────────────────────────────

function CategoryPill({ category, small }: { category: CalendarEventCategory; small?: boolean }) {
  const Colors = useColors();
  const meta = CALENDAR_CATEGORY_META[category];
  return (
    <View
      style={[
        styles.categoryPill,
        small && styles.categoryPillSmall,
        { backgroundColor: meta.color + '18', borderColor: meta.color + '40' },
      ]}
    >
      <Text style={[styles.categoryPillText, small && styles.categoryPillTextSmall, { color: meta.color }]}>
        {meta.label}
      </Text>
    </View>
  );
}

// ─── RSVP button ──────────────────────────────────────────────────────────────

function RsvpButton({
  event,
  onRsvp,
  loading,
}: {
  event: CalendarEvent;
  onRsvp: (status: 'going' | 'maybe' | 'not_going') => void;
  loading: boolean;
}) {
  const Colors = useColors();
  const options: Array<{ label: string; value: 'going' | 'maybe' | 'not_going' }> = [
    { label: 'Going', value: 'going' },
    { label: 'Maybe', value: 'maybe' },
    { label: 'Skip', value: 'not_going' },
  ];
  return (
    <View style={styles.rsvpRow}>
      {options.map((opt) => {
        const active = event.myRsvp === opt.value;
        const accent = opt.value === 'going'
          ? Colors.success
          : opt.value === 'maybe'
          ? Colors.gold
          : Colors.slateLighter;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.rsvpBtn,
              {
                backgroundColor: active ? accent + '18' : Colors.surface,
                borderColor: active ? accent : Colors.border,
              },
            ]}
            onPress={() => onRsvp(opt.value)}
            disabled={loading}
          >
            <Text style={[styles.rsvpBtnText, { color: active ? accent : Colors.slateLight }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onRsvp,
  rsvpLoading,
  isStaff,
  onCancel,
}: {
  event: CalendarEvent;
  onRsvp: (id: string, status: 'going' | 'maybe' | 'not_going') => void;
  rsvpLoading: boolean;
  isStaff: boolean;
  onCancel: (id: string) => void;
}) {
  const Colors = useColors();
  const meta = CALENDAR_CATEGORY_META[event.category];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  const totalAttendees = event.rsvpGoing + event.rsvpMaybe;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.eventCard,
          {
            backgroundColor: Colors.surface,
            borderColor: Colors.border,
            borderLeftColor: meta.color,
          },
        ]}
      >
        {/* Header row */}
        <View style={styles.eventCardHeader}>
          <View style={styles.eventCardTitleRow}>
            <View style={[styles.eventDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.eventCardTitle, { color: Colors.slate }]} numberOfLines={2}>
              {event.title}
            </Text>
          </View>
          <View style={styles.eventCardBadges}>
            {!event.isPublic && (
              <View style={[styles.staffBadge, { backgroundColor: Colors.primary + '14' }]}>
                <Lock size={10} color={Colors.primary} />
                <Text style={[styles.staffBadgeText, { color: Colors.primary }]}>Staff</Text>
              </View>
            )}
            {event.isRecurring && (
              <Repeat size={13} color={Colors.slateLighter} strokeWidth={2} />
            )}
          </View>
        </View>

        <CategoryPill category={event.category} small />

        {/* Meta row */}
        <View style={styles.eventMetaRow}>
          <View style={styles.eventMetaItem}>
            <Clock size={12} color={Colors.slateLighter} strokeWidth={2} />
            <Text style={[styles.eventMetaText, { color: Colors.slateLighter }]}>
              {formatTime(event.startsAt, event.allDay)}
              {event.endsAt && !event.allDay
                ? ` – ${formatTime(event.endsAt, false)}`
                : ''}
            </Text>
          </View>
          {event.location ? (
            <View style={styles.eventMetaItem}>
              <MapPin size={12} color={Colors.slateLighter} strokeWidth={2} />
              <Text style={[styles.eventMetaText, { color: Colors.slateLighter }]} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          ) : null}
          {totalAttendees > 0 && (
            <View style={styles.eventMetaItem}>
              <Users size={12} color={Colors.slateLighter} strokeWidth={2} />
              <Text style={[styles.eventMetaText, { color: Colors.slateLighter }]}>
                {event.rsvpGoing} going
                {event.rsvpMaybe > 0 ? ` · ${event.rsvpMaybe} maybe` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        {event.description ? (
          <Text style={[styles.eventDesc, { color: Colors.slateLight }]} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}

        {/* RSVP */}
        <RsvpButton
          event={event}
          onRsvp={(s) => onRsvp(event.id, s)}
          loading={rsvpLoading}
        />

        {/* Staff cancel */}
        {isStaff && (
          <TouchableOpacity
            onPress={() => onCancel(event.id)}
            style={styles.cancelEventBtn}
          >
            <Text style={[styles.cancelEventBtnText, { color: Colors.danger }]}>Cancel event</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  year,
  month,
  events,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
}) {
  const Colors = useColors();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const today = new Date();

  // Build dot map: day -> primary category color
  const dotMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    events.forEach((e) => {
      const d = new Date(e.startsAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const color = CALENDAR_CATEGORY_META[e.category].color;
        if (!map[day]) map[day] = [];
        if (!map[day].includes(color)) map[day].push(color);
      }
    });
    return map;
  }, [events, year, month]);

  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, key: `empty-${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `day-${d}` });

  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={[styles.gridWrap, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      {/* Day labels */}
      <View style={styles.dayLabelRow}>
        {DAY_LABELS.map((l, i) => (
          <Text key={i} style={[styles.dayLabel, { color: Colors.slateLighter }]}>{l}</Text>
        ))}
      </View>
      {/* Day rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.weekRow}>
          {row.map((cell) => {
            if (!cell.day) {
              return <View key={cell.key} style={styles.dayCell} />;
            }
            const cellDate = new Date(year, month, cell.day);
            const isToday = sameDay(cellDate, today);
            const isSelected = selectedDate ? sameDay(cellDate, selectedDate) : false;
            const dots = dotMap[cell.day] ?? [];
            return (
              <TouchableOpacity
                key={cell.key}
                style={[
                  styles.dayCell,
                  isSelected && [styles.dayCellSelected, { backgroundColor: Colors.primary }],
                  !isSelected && isToday && [styles.dayCellToday, { borderColor: Colors.primary }],
                ]}
                onPress={() => onSelectDate(cellDate)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayCellText,
                    { color: isSelected ? '#fff' : isToday ? Colors.primary : Colors.slate },
                  ]}
                >
                  {cell.day}
                </Text>
                {dots.length > 0 && (
                  <View style={styles.dotRow}>
                    {dots.slice(0, 3).map((c, di) => (
                      <View
                        key={di}
                        style={[
                          styles.eventDotSmall,
                          { backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : c },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {/* Pad short rows */}
          {row.length < 7 &&
            Array.from({ length: 7 - row.length }).map((_, pi) => (
              <View key={`pad-${pi}`} style={styles.dayCell} />
            ))}
        </View>
      ))}
    </View>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const FILTER_CATS: Array<{ key: CalendarEventCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'meeting', label: 'Meetings' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'amenity', label: 'Amenity' },
  { key: 'social', label: 'Social' },
  { key: 'deadline', label: 'Deadlines' },
  { key: 'inspection', label: 'Inspections' },
  { key: 'emergency', label: 'Emergency' },
];

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CommunityCalendarScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, activeMembership, isOrgStaff, upsertEventRsvp, cancelCalendarEvent, isUpsertingRsvp } =
    useOrganization();

  const today = new Date();
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [activeFilter, setActiveFilter] = useState<CalendarEventCategory | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpLoadingId, setRsvpLoadingId] = useState<string | null>(null);

  const rangeFrom = useMemo(
    () => new Date(displayYear, displayMonth, 1).toISOString(),
    [displayYear, displayMonth]
  );
  const rangeTo = useMemo(
    () => new Date(displayYear, displayMonth + 1, 0, 23, 59, 59).toISOString(),
    [displayYear, displayMonth]
  );

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['org-calendar', activeOrg?.id, displayYear, displayMonth],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_org_calendar_events', {
        p_org_id: activeOrg.id,
        p_from: rangeFrom,
        p_to: rangeTo,
        p_category: null,
      });
      if (error) throw error;
      return ((data as Record<string, unknown>[]) ?? []).map(calendarEventFromRpc);
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Events for the selected date
  const dayEvents = useMemo(() => {
    if (!selectedDate) return events;
    return events.filter((e) => sameDay(new Date(e.startsAt), selectedDate));
  }, [events, selectedDate]);

  // Apply category filter
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return dayEvents;
    return dayEvents.filter((e) => e.category === activeFilter);
  }, [dayEvents, activeFilter]);

  const handlePrevMonth = useCallback(() => {
    setDisplayMonth((m) => {
      if (m === 0) { setDisplayYear((y) => y - 1); return 11; }
      return m - 1;
    });
    setSelectedDate(null);
  }, []);

  const handleNextMonth = useCallback(() => {
    setDisplayMonth((m) => {
      if (m === 11) { setDisplayYear((y) => y + 1); return 0; }
      return m + 1;
    });
    setSelectedDate(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['org-calendar', activeOrg?.id] });
    setRefreshing(false);
  }, [queryClient, activeOrg?.id]);

  const handleRsvp = useCallback(
    async (eventId: string, status: 'going' | 'maybe' | 'not_going') => {
      setRsvpLoadingId(eventId);
      try {
        await upsertEventRsvp({ eventId, status });
        void queryClient.invalidateQueries({ queryKey: ['org-calendar', activeOrg?.id] });
      } catch {
        Alert.alert('Error', 'Could not save your RSVP. Please try again.');
      } finally {
        setRsvpLoadingId(null);
      }
    },
    [upsertEventRsvp, queryClient, activeOrg?.id]
  );

  const handleCancel = useCallback(
    (eventId: string) => {
      Alert.alert('Cancel Event', 'Mark this event as cancelled?', [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Event',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelCalendarEvent({ eventId });
            } catch {
              Alert.alert('Error', 'Could not cancel event.');
            }
          },
        },
      ]);
    },
    [cancelCalendarEvent]
  );

  if (!activeOrg || !activeMembership) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  const isStaff =
    isOrgStaff ||
    activeMembership.role === 'board_member';

  const selectedLabel = selectedDate
    ? sameDay(selectedDate, today)
      ? 'Today'
      : formatDateHeader(selectedDate.toISOString())
    : `${MONTH_NAMES[displayMonth]} ${displayYear}`;

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
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Community Calendar</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>{activeOrg.name}</Text>
        </View>

        {isStaff && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: Colors.primary }]}
            onPress={() => router.push('/create-event')}
          >
            <Plus size={16} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {!isStaff && <View style={{ width: 36 }} />}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Month navigator ──────────────────────────────────────────── */}
        <View style={[styles.monthNav, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.monthNavTitle, { color: Colors.slate }]}>
            {MONTH_NAMES[displayMonth]} {displayYear}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ChevronRight size={20} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Calendar grid ─────────────────────────────────────────────── */}
        <View style={styles.gridPad}>
          {isLoading ? (
            <View style={[styles.gridWrap, { backgroundColor: Colors.surface, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', height: 220 }]}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <CalendarGrid
              year={displayYear}
              month={displayMonth}
              events={events}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}
        </View>

        {/* ── Filter bar ────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {FILTER_CATS.map((cat) => {
            const active = activeFilter === cat.key;
            const accent =
              cat.key === 'all'
                ? Colors.primary
                : CALENDAR_CATEGORY_META[cat.key as CalendarEventCategory].color;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? accent : Colors.surface,
                    borderColor: active ? accent : Colors.border,
                  },
                ]}
                onPress={() => setActiveFilter(cat.key as CalendarEventCategory | 'all')}
              >
                <Text style={[styles.filterChipText, { color: active ? '#fff' : Colors.slateLight }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Event list ────────────────────────────────────────────────── */}
        <View style={styles.eventSection}>
          <View style={styles.daySectionHeader}>
            <CalendarDays size={14} color={Colors.primary} strokeWidth={2} />
            <Text style={[styles.daySectionLabel, { color: Colors.slate }]}>
              {selectedLabel}
              {filteredEvents.length > 0
                ? `  ·  ${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : filteredEvents.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <CalendarDays size={26} color={Colors.slateLighter} strokeWidth={1.5} />
              <Text style={[styles.emptyTitle, { color: Colors.slateLight }]}>
                {selectedDate ? 'No events this day' : 'No events this month'}
              </Text>
              {isStaff && (
                <TouchableOpacity
                  onPress={() => router.push('/create-event')}
                  style={[styles.emptyAddBtn, { borderColor: Colors.primary }]}
                >
                  <Text style={[styles.emptyAddBtnText, { color: Colors.primary }]}>
                    + Create event
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onRsvp={handleRsvp}
                rsvpLoading={rsvpLoadingId === event.id}
                isStaff={isStaff}
                onCancel={handleCancel}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, marginTop: 1 },
  addBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0,
  },
  monthNavBtn: { padding: 4 },
  monthNavTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  gridPad: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  gridWrap: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dayLabelRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  weekRow: { flexDirection: 'row', paddingHorizontal: 4 },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    minHeight: 42,
    borderRadius: 8,
    margin: 1,
  },
  dayCellSelected: { borderRadius: 8 },
  dayCellToday: { borderWidth: 1, borderRadius: 8 },
  dayCellText: { fontSize: 13, fontWeight: '500' },
  dotRow: { flexDirection: 'row', marginTop: 2, gap: 2 },
  eventDotSmall: { width: 4, height: 4, borderRadius: 2 },
  filterBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  eventSection: { paddingHorizontal: 12 },
  daySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 4,
  },
  daySectionLabel: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '500' },
  emptyAddBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, marginTop: 8 },
  emptyAddBtnText: { fontSize: 13, fontWeight: '600' },
  eventCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  eventCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  eventCardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  eventCardTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, flex: 1 },
  eventCardBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  staffBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  staffBadgeText: { fontSize: 10, fontWeight: '600' },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryPillSmall: {},
  categoryPillText: { fontSize: 11, fontWeight: '600' },
  categoryPillTextSmall: { fontSize: 10 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventMetaText: { fontSize: 12 },
  eventDesc: { fontSize: 13, lineHeight: 18 },
  rsvpRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rsvpBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rsvpBtnText: { fontSize: 12, fontWeight: '600' },
  cancelEventBtn: { alignSelf: 'flex-end', marginTop: 2 },
  cancelEventBtnText: { fontSize: 11, fontWeight: '500' },
});
