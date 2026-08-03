import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Calendar,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  CalendarDays,
  Package,
  CircleDot,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDeliveryWindows } from '@/store/DeliveryWindowsContext';
import { useApp } from '@/store/AppContext';
import { DeliveryWindow, WindowStatus, WindowType } from '@/types';
import Colors from '@/constants/colors';
import { log } from "@/lib/logger";

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00',
];

const DURATION_OPTIONS = [
  { label: '1 hr', hours: 1 },
  { label: '2 hrs', hours: 2 },
  { label: '3 hrs', hours: 3 },
  { label: '4 hrs', hours: 4 },
];

type TabType = 'schedule' | 'booked' | 'history';

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(baseDate);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const newH = h + hours;
  return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_CONFIG: Record<WindowStatus, { bg: string; text: string; label: string }> = {
  open: { bg: '#E8F5E9', text: '#2E7D32', label: 'Available' },
  booked: { bg: Colors.skyBlue, text: Colors.primary, label: 'Booked' },
  completed: { bg: Colors.successLight, text: '#166534', label: 'Completed' },
  cancelled: { bg: Colors.dangerLight, text: Colors.danger, label: 'Cancelled' },
};

interface WindowCardProps {
  window: DeliveryWindow;
  onBook?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
  onDelete?: () => void;
  isPartner: boolean;
}

const WindowCard = React.memo(function WindowCard({ window: w, onBook, onCancel, onComplete, onDelete, isPartner }: WindowCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const config = STATUS_CONFIG[w.status];

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  }, [scaleAnim]);

  const dateObj = new Date(w.date + 'T00:00:00');
  const dayName = DAY_NAMES[dateObj.getDay()];
  const dateNum = dateObj.getDate();
  const monthName = MONTH_NAMES[dateObj.getMonth()].slice(0, 3);

  return (
    <Animated.View style={[styles.windowCard, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID={`window-card-${w.id}`}
      >
        <View style={styles.windowCardInner}>
          <View style={styles.windowDateBlock}>
            <Text style={styles.windowDateDay}>{dayName}</Text>
            <Text style={styles.windowDateNum}>{dateNum}</Text>
            <Text style={styles.windowDateMonth}>{monthName}</Text>
          </View>
          <View style={styles.windowCardContent}>
            <View style={styles.windowTimeRow}>
              <Clock size={14} color={Colors.slate} />
              <Text style={styles.windowTimeText}>
                {formatTimeDisplay(w.startTime)} – {formatTimeDisplay(w.endTime)}
              </Text>
            </View>
            <View style={styles.windowTypeRow}>
              {w.type === 'availability' ? (
                <CircleDot size={13} color="#2E7D32" />
              ) : (
                <Package size={13} color={Colors.primary} />
              )}
              <Text style={styles.windowTypeText}>
                {w.type === 'availability' ? 'Availability Slot' : 'Delivery Window'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.statusBadgeText, { color: config.text }]}>{config.label}</Text>
            </View>
          </View>
          <View style={styles.windowActions}>
            {w.status === 'open' && !isPartner && onBook && (
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onBook();
                }}
                testID={`book-btn-${w.id}`}
              >
                <Check size={16} color={Colors.white} />
                <Text style={styles.bookBtnText}>Book</Text>
              </TouchableOpacity>
            )}
            {w.status === 'booked' && onCancel && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onCancel();
                }}
                testID={`cancel-btn-${w.id}`}
              >
                <X size={14} color={Colors.danger} />
              </TouchableOpacity>
            )}
            {w.status === 'booked' && isPartner && onComplete && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onComplete();
                }}
                testID={`complete-btn-${w.id}`}
              >
                <Check size={14} color={Colors.white} />
              </TouchableOpacity>
            )}
            {(w.status === 'open' || w.status === 'cancelled') && isPartner && onDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onDelete();
                }}
                testID={`delete-btn-${w.id}`}
              >
                <Trash2 size={14} color={Colors.slateLighter} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function DeliveryWindowsScreen() {
  const { user, isPartner, isHomeowner } = useApp();
  const {
    windows,
    bookedWindows,
    completedWindows,
    addWindow,
    bookWindow,
    cancelWindow,
    updateWindowStatus,
    deleteWindow,
    getWindowsByDate,
  } = useDeliveryWindows();

  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(new Date()));
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newStartTime, setNewStartTime] = useState<string>('09:00');
  const [newDuration, setNewDuration] = useState<number>(2);
  const [newType, setNewType] = useState<WindowType>('availability');
  const tabIndicator = useRef(new Animated.Value(0)).current;

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const weekLabel = useMemo(() => {
    const first = weekDates[0];
    const last = weekDates[6];
    if (first.getMonth() === last.getMonth()) {
      return `${MONTH_NAMES[first.getMonth()]} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`;
    }
    return `${MONTH_NAMES[first.getMonth()].slice(0, 3)} ${first.getDate()} – ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getDate()}`;
  }, [weekDates]);

  const todayKey = formatDateKey(new Date());

  const selectedDateWindows = useMemo(() => {
    return getWindowsByDate(selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [getWindowsByDate, selectedDate]);

  const windowCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    windows.forEach(w => {
      if (w.status !== 'cancelled') {
        counts[w.date] = (counts[w.date] || 0) + 1;
      }
    });
    return counts;
  }, [windows]);

  const handleTabChange = useCallback((tab: TabType) => {
    const tabIndex = tab === 'schedule' ? 0 : tab === 'booked' ? 1 : 2;
    Animated.spring(tabIndicator, {
      toValue: tabIndex,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
    setActiveTab(tab);
    void Haptics.selectionAsync();
  }, [tabIndicator]);

  const handleAddWindow = useCallback(() => {
    if (!user) return;
    const endTime = addHours(newStartTime, newDuration);
    addWindow({
      date: selectedDate,
      startTime: newStartTime,
      endTime,
      type: newType,
      status: 'open',
      homeownerId: newType === 'delivery_window' ? user.id : '',
      porchPartnerId: isPartner ? user.id : '',
    });
    setShowAddModal(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    log('[DeliveryWindows] Window added:', selectedDate, newStartTime, endTime);
  }, [user, selectedDate, newStartTime, newDuration, newType, addWindow, isPartner]);

  const handleBook = useCallback((windowId: string) => {
    if (!user) return;
    Alert.alert(
      'Book This Window',
      'Would you like to book this delivery window?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book',
          onPress: () => {
            bookWindow(windowId, user.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [user, bookWindow]);

  const handleCancel = useCallback((windowId: string) => {
    Alert.alert(
      'Cancel Window',
      'Are you sure you want to cancel this window?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            cancelWindow(windowId);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }, [cancelWindow]);

  const handleComplete = useCallback((windowId: string) => {
    updateWindowStatus(windowId, 'completed');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [updateWindowStatus]);

  const handleDelete = useCallback((windowId: string) => {
    Alert.alert(
      'Delete Window',
      'This will permanently remove this window.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWindow(windowId);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }, [deleteWindow]);

  const renderWindowList = useCallback((list: DeliveryWindow[], emptyText: string) => {
    if (list.length === 0) {
      return (
        <View style={styles.emptyState}>
          <CalendarDays size={48} color={Colors.slateLighter} />
          <Text style={styles.emptyStateTitle}>No Windows</Text>
          <Text style={styles.emptyStateSubtitle}>{emptyText}</Text>
        </View>
      );
    }
    return (
      <View style={styles.windowList}>
        {list.map(w => (
          <WindowCard
            key={w.id}
            window={w}
            isPartner={isPartner}
            onBook={() => handleBook(w.id)}
            onCancel={() => handleCancel(w.id)}
            onComplete={() => handleComplete(w.id)}
            onDelete={() => handleDelete(w.id)}
          />
        ))}
      </View>
    );
  }, [isPartner, handleBook, handleCancel, handleComplete, handleDelete]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Delivery Windows',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: '600' as const },
        }}
      />

      <View style={styles.tabBar}>
        {(['schedule', 'booked', 'history'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.tabItem}
            onPress={() => handleTabChange(tab)}
            testID={`tab-${tab}`}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'schedule' ? 'Schedule' : tab === 'booked' ? `Booked (${bookedWindows.length})` : 'History'}
            </Text>
            {activeTab === tab && <View style={styles.tabActiveIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'schedule' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.weekNav}>
            <TouchableOpacity
              onPress={() => { setWeekOffset(w => w - 1); void Haptics.selectionAsync(); }}
              style={styles.weekNavBtn}
              testID="prev-week"
            >
              <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
            <TouchableOpacity
              onPress={() => { setWeekOffset(w => w + 1); void Haptics.selectionAsync(); }}
              style={styles.weekNavBtn}
              testID="next-week"
            >
              <ChevronRight size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekStrip}
          >
            {weekDates.map((date) => {
              const key = formatDateKey(date);
              const isSelected = key === selectedDate;
              const isToday = key === todayKey;
              const count = windowCountByDate[key] || 0;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => { setSelectedDate(key); void Haptics.selectionAsync(); }}
                  testID={`day-${key}`}
                >
                  <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                    {DAY_NAMES[date.getDay()]}
                  </Text>
                  <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                    {date.getDate()}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.dayDot, isSelected && styles.dayDotSelected]}>
                      <Text style={[styles.dayDotText, isSelected && styles.dayDotTextSelected]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedDate === todayKey ? 'Today' : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            {(isPartner || isHomeowner) && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { setShowAddModal(true); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                testID="add-window-btn"
              >
                <Plus size={18} color={Colors.white} />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {selectedDateWindows.length === 0 ? (
            <View style={styles.emptyDay}>
              <Calendar size={36} color={Colors.slateLighter} />
              <Text style={styles.emptyDayText}>No windows for this day</Text>
              <Text style={styles.emptyDaySubtext}>Tap + to add availability or a delivery window</Text>
            </View>
          ) : (
            <View style={styles.windowList}>
              {selectedDateWindows.map(w => (
                <WindowCard
                  key={w.id}
                  window={w}
                  isPartner={isPartner}
                  onBook={() => handleBook(w.id)}
                  onCancel={() => handleCancel(w.id)}
                  onComplete={() => handleComplete(w.id)}
                  onDelete={() => handleDelete(w.id)}
                />
              ))}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {activeTab === 'booked' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.bookedHeader}>
            <Text style={styles.bookedHeaderText}>Your upcoming booked delivery windows</Text>
          </View>
          {renderWindowList(bookedWindows, 'No booked windows yet. Browse the schedule to find open slots.')}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {activeTab === 'history' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.bookedHeader}>
            <Text style={styles.bookedHeaderText}>Past completed and cancelled windows</Text>
          </View>
          {renderWindowList(
            [...completedWindows, ...windows.filter(w => w.status === 'cancelled')].sort(
              (a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)
            ),
            'No history yet.'
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Window</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} testID="close-modal">
                <X size={22} color={Colors.slate} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Type</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeBtn, newType === 'availability' && styles.typeBtnActive]}
                onPress={() => setNewType('availability')}
                testID="type-availability"
              >
                <CircleDot size={16} color={newType === 'availability' ? Colors.white : Colors.slate} />
                <Text style={[styles.typeBtnText, newType === 'availability' && styles.typeBtnTextActive]}>Availability</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, newType === 'delivery_window' && styles.typeBtnActive]}
                onPress={() => setNewType('delivery_window')}
                testID="type-delivery"
              >
                <Package size={16} color={newType === 'delivery_window' ? Colors.white : Colors.slate} />
                <Text style={[styles.typeBtnText, newType === 'delivery_window' && styles.typeBtnTextActive]}>Delivery</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Start Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
              {TIME_SLOTS.map(slot => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.timeChip, newStartTime === slot && styles.timeChipActive]}
                  onPress={() => { setNewStartTime(slot); void Haptics.selectionAsync(); }}
                  testID={`time-${slot}`}
                >
                  <Text style={[styles.timeChipText, newStartTime === slot && styles.timeChipTextActive]}>
                    {formatTimeDisplay(slot)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.hours}
                  style={[styles.durationChip, newDuration === opt.hours && styles.durationChipActive]}
                  onPress={() => { setNewDuration(opt.hours); void Haptics.selectionAsync(); }}
                  testID={`duration-${opt.hours}`}
                >
                  <Text style={[styles.durationChipText, newDuration === opt.hours && styles.durationChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalPreview}>
              <Clock size={16} color={Colors.primary} />
              <Text style={styles.modalPreviewText}>
                {formatTimeDisplay(newStartTime)} – {formatTimeDisplay(addHours(newStartTime, newDuration))}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleAddWindow}
              testID="save-window-btn"
            >
              <Text style={styles.modalSaveBtnText}>Create Window</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.slateLighter,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  tabActiveIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  content: {
    flex: 1,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  weekStrip: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 6,
  },
  dayCell: {
    width: 52,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayCellToday: {
    borderColor: Colors.secondary,
    borderWidth: 2,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.slateLighter,
    marginBottom: 4,
  },
  dayNameSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.slate,
  },
  dayNumSelected: {
    color: Colors.white,
  },
  dayDot: {
    marginTop: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dayDotSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dayDotText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  dayDotTextSelected: {
    color: Colors.white,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1a1a2e',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyDayText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginTop: 12,
  },
  emptyDaySubtext: {
    fontSize: 13,
    color: Colors.slateLighter,
    marginTop: 4,
    textAlign: 'center',
  },
  windowList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  windowCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  windowCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  windowDateBlock: {
    width: 48,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 6,
  },
  windowDateDay: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.slateLighter,
    textTransform: 'uppercase',
  },
  windowDateNum: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#1a1a2e',
  },
  windowDateMonth: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.slateLighter,
    textTransform: 'uppercase',
  },
  windowCardContent: {
    flex: 1,
    gap: 4,
  },
  windowTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  windowTimeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  windowTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  windowTypeText: {
    fontSize: 12,
    color: Colors.slateLight,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  windowActions: {
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.slateLighter,
    marginTop: 6,
    textAlign: 'center',
  },
  bookedHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  bookedHeaderText: {
    fontSize: 14,
    color: Colors.slateLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1a1a2e',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  typeBtnTextActive: {
    color: Colors.white,
  },
  timeScroll: {
    maxHeight: 44,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  timeChipActive: {
    backgroundColor: Colors.skyBlue,
    borderColor: Colors.primary,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.slate,
  },
  timeChipTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  durationChipActive: {
    backgroundColor: Colors.skyBlue,
    borderColor: Colors.primary,
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.slate,
  },
  durationChipTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  modalPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.skyBlue,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  modalPreviewText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  modalSaveBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
