import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Package,
  Search,
  Star,
  Truck,
} from 'lucide-react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

const UPS_BROWN = '#351C15';
const UPS_GOLD = '#FFB500';
const UPS_GOLD_SOFT = '#FFF8E1';
const UPS_GOLD_BORDER = '#FFD54F';
const BG = '#F2F3F4';
const WHITE = '#FFFFFF';
const NAVY = '#1B2A4A';
const SLATE = '#4B5563';
const SLATE_LIGHT = '#9CA3AF';
const GREEN = '#059669';
const GREEN_SOFT = '#ECFDF5';

interface AccessPoint {
  id: string;
  name: string;
  type: 'ups_store' | 'cvs' | 'michaels' | 'advanced_auto' | 'customer_center';
  address: string;
  distance: string;
  walkTime: string;
  hours: string;
  isOpen: boolean;
  capacity: 'low' | 'medium' | 'high';
  rating: number;
  lockerAvailable: boolean;
}

const MOCK_POINTS: AccessPoint[] = [
  {
    id: '1',
    name: 'The UPS Store #4821',
    type: 'ups_store',
    address: '1428 N Michigan Ave, Chicago IL',
    distance: '0.3 mi',
    walkTime: '6 min walk',
    hours: 'Open until 7:00 PM',
    isOpen: true,
    capacity: 'low',
    rating: 4.8,
    lockerAvailable: true,
  },
  {
    id: '2',
    name: 'CVS Pharmacy',
    type: 'cvs',
    address: '612 W Diversey Pkwy, Chicago IL',
    distance: '0.6 mi',
    walkTime: '12 min walk',
    hours: 'Open 24 hours',
    isOpen: true,
    capacity: 'medium',
    rating: 4.3,
    lockerAvailable: false,
  },
  {
    id: '3',
    name: 'Michaels Craft Store',
    type: 'michaels',
    address: '840 W North Ave, Chicago IL',
    distance: '0.9 mi',
    walkTime: '18 min walk',
    hours: 'Open until 9:00 PM',
    isOpen: true,
    capacity: 'high',
    rating: 4.5,
    lockerAvailable: false,
  },
  {
    id: '4',
    name: 'UPS Customer Center',
    type: 'customer_center',
    address: '1400 S Jefferson St, Chicago IL',
    distance: '1.4 mi',
    walkTime: '5 min drive',
    hours: 'Open until 6:30 PM',
    isOpen: true,
    capacity: 'low',
    rating: 4.6,
    lockerAvailable: true,
  },
  {
    id: '5',
    name: 'Advanced Auto Parts',
    type: 'advanced_auto',
    address: '2201 N Clybourn Ave, Chicago IL',
    distance: '1.8 mi',
    walkTime: '8 min drive',
    hours: 'Closed at 6:00 PM',
    isOpen: false,
    capacity: 'low',
    rating: 4.1,
    lockerAvailable: false,
  },
];

const TYPE_LABELS: Record<AccessPoint['type'], string> = {
  ups_store: 'The UPS Store',
  cvs: 'CVS Partner',
  michaels: 'Michaels Partner',
  advanced_auto: 'Adv. Auto Partner',
  customer_center: 'UPS Customer Center',
};

const CAPACITY_COLORS: Record<AccessPoint['capacity'], string> = {
  low: GREEN,
  medium: '#F59E0B',
  high: '#EF4444',
};

const CAPACITY_LABELS: Record<AccessPoint['capacity'], string> = {
  low: 'Low wait',
  medium: 'Moderate',
  high: 'Busy',
};

// ─── Capacity Bar ─────────────────────────────────────────────────────────────

function CapacityDots({ level }: { level: AccessPoint['capacity'] }) {
  const active = level === 'low' ? 1 : level === 'medium' ? 2 : 3;
  const color = CAPACITY_COLORS[level];
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i < active ? color : '#E5E7EB',
          }}
        />
      ))}
    </View>
  );
}

// ─── Access Point Card ────────────────────────────────────────────────────────

function AccessPointCard({
  point,
  selected,
  onSelect,
  animValue,
}: {
  point: AccessPoint;
  selected: boolean;
  onSelect: (id: string) => void;
  animValue: Animated.Value;
}) {
  const isUPS = point.type === 'ups_store' || point.type === 'customer_center';

  return (
    <Animated.View style={{ opacity: animValue, transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
      <TouchableOpacity
        style={[
          styles.apCard,
          selected && styles.apCardSelected,
          !point.isOpen && styles.apCardClosed,
        ]}
        onPress={() => onSelect(point.id)}
        activeOpacity={0.85}
        accessibilityLabel={`Select ${point.name}`}
      >
        {/* Header Row */}
        <View style={styles.apHeader}>
          <View style={[styles.apTypeIcon, isUPS && styles.apTypeIconUPS]}>
            {isUPS
              ? <Truck size={17} color={isUPS ? UPS_GOLD : SLATE} strokeWidth={2} />
              : <Building2 size={17} color={SLATE} strokeWidth={2} />}
          </View>
          <View style={styles.apHeaderInfo}>
            <Text style={[styles.apName, !point.isOpen && { color: SLATE_LIGHT }]} numberOfLines={1}>
              {point.name}
            </Text>
            <Text style={styles.apType}>{TYPE_LABELS[point.type]}</Text>
          </View>
          {selected && (
            <CheckCircle2 size={22} color={UPS_GOLD} strokeWidth={2.5} />
          )}
        </View>

        <View style={styles.apDivider} />

        {/* Details Row */}
        <View style={styles.apDetails}>
          <View style={styles.apDetailItem}>
            <MapPin size={12} color={SLATE_LIGHT} strokeWidth={2} />
            <Text style={styles.apDetailText}>{point.distance}</Text>
          </View>
          <View style={styles.apDetailItem}>
            <Navigation size={12} color={SLATE_LIGHT} strokeWidth={2} />
            <Text style={styles.apDetailText}>{point.walkTime}</Text>
          </View>
          <View style={styles.apDetailItem}>
            <Clock size={12} color={point.isOpen ? GREEN : '#EF4444'} strokeWidth={2} />
            <Text style={[styles.apDetailText, { color: point.isOpen ? GREEN : '#EF4444' }]}>
              {point.hours}
            </Text>
          </View>
        </View>

        {/* Footer Row */}
        <View style={styles.apFooter}>
          <View style={styles.apRating}>
            <Star size={11} color={UPS_GOLD} strokeWidth={0} fill={UPS_GOLD} />
            <Text style={styles.apRatingText}>{point.rating}</Text>
          </View>
          <View style={styles.apCapacity}>
            <CapacityDots level={point.capacity} />
            <Text style={[styles.apCapacityText, { color: CAPACITY_COLORS[point.capacity] }]}>
              {CAPACITY_LABELS[point.capacity]}
            </Text>
          </View>
          {point.lockerAvailable && (
            <View style={styles.lockerBadge}>
              <Package size={10} color={UPS_BROWN} strokeWidth={2} />
              <Text style={styles.lockerText}>Locker</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AccessPointsScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  const cardAnims = useRef(MOCK_POINTS.map(() => new Animated.Value(0))).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const confirmScale = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    MOCK_POINTS.forEach((_, i) => {
      setTimeout(() => {
        Animated.timing(cardAnims[i], { toValue: 1, duration: 350, useNativeDriver: true }).start();
      }, 150 + i * 90);
    });
  }, [headerAnim, cardAnims]);

  const handleSelect = useCallback((id: string) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleHold = useCallback(async () => {
    if (!selectedId || submitting) return;
    Animated.sequence([
      Animated.spring(confirmScale, { toValue: 0.96, useNativeDriver: true, speed: 80 }),
      Animated.spring(confirmScale, { toValue: 1, useNativeDriver: true, speed: 80 }),
    ]).start();
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    setConfirmed(true);
    Animated.spring(successScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
  }, [selectedId, submitting, confirmScale, successScale]);

  const filtered = MOCK_POINTS.filter(
    (p) =>
      searchQuery.length === 0 ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedPoint = MOCK_POINTS.find((p) => p.id === selectedId);

  if (confirmed && selectedPoint) {
    return (
      <View style={styles.successRoot}>
        <Stack.Screen options={{ title: 'Access Points', headerStyle: { backgroundColor: BG }, headerShadowVisible: false, headerTintColor: NAVY }} />
        <Animated.View style={[styles.successCard, { transform: [{ scale: successScale }] }]}>
          <View style={styles.successIconWrap}>
            <CheckCircle2 size={40} color={GREEN} strokeWidth={2} />
          </View>
          <Text style={styles.successTitle}>Package Hold Requested</Text>
          <Text style={styles.successSub}>
            Your package will be held at{'\n'}
            <Text style={{ fontWeight: '700' as const, color: NAVY }}>{selectedPoint.name}</Text>
          </Text>
          <View style={styles.successDetail}>
            <MapPin size={13} color={SLATE_LIGHT} strokeWidth={2} />
            <Text style={styles.successDetailText}>{selectedPoint.address}</Text>
          </View>
          <View style={styles.successDetail}>
            <Clock size={13} color={SLATE_LIGHT} strokeWidth={2} />
            <Text style={styles.successDetailText}>Available to pick up in 2–4 hours</Text>
          </View>
          <View style={styles.successNote}>
            <Text style={styles.successNoteText}>Bring a valid photo ID to collect your package. Packages are held for up to 7 calendar days.</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'UPS Access Points',
          headerStyle: { backgroundColor: BG },
          headerShadowVisible: false,
          headerTintColor: NAVY,
        }}
      />

      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.upsMark}>
          <Text style={styles.upsMarkText}>UPS</Text>
        </View>
        <Text style={styles.bannerText}>5 Access Points near your location</Text>
        <ExternalLink size={14} color={UPS_GOLD} strokeWidth={2} />
      </View>

      {/* Search */}
      <Animated.View style={[styles.searchWrap, { opacity: headerAnim }]}>
        <Search size={16} color={SLATE_LIGHT} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or address…"
          placeholderTextColor={SLATE_LIGHT}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Tip ────────────────────────────────────────────────────── */}
        <View style={styles.tipRow}>
          <Package size={12} color={UPS_BROWN} strokeWidth={2} />
          <Text style={styles.tipText}>
            Hold your package at a secure location instead of risking porch theft.
          </Text>
        </View>

        {/* ── Point Cards ────────────────────────────────────────────── */}
        {filtered.map((point, i) => (
          <AccessPointCard
            key={point.id}
            point={point}
            selected={selectedId === point.id}
            onSelect={handleSelect}
            animValue={cardAnims[Math.min(i, cardAnims.length - 1)]}
          />
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Search size={32} color={SLATE_LIGHT} strokeWidth={1.5} />
            <Text style={styles.emptyText}>No locations match your search</Text>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Hold Button ───────────────────────────────────────────────── */}
      <View style={styles.footer}>
        {selectedPoint && (
          <Text style={styles.selectedLabel} numberOfLines={1}>
            Selected: <Text style={{ color: UPS_BROWN, fontWeight: '700' as const }}>{selectedPoint.name}</Text>
          </Text>
        )}
        <Animated.View style={{ transform: [{ scale: confirmScale }], width: '100%' }}>
          <TouchableOpacity
            style={[styles.holdBtn, !selectedId && styles.holdBtnDisabled]}
            onPress={handleHold}
            disabled={!selectedId || submitting}
            activeOpacity={0.88}
            accessibilityLabel="Hold package at selected location"
          >
            <Building2 size={17} color={selectedId ? UPS_BROWN : SLATE_LIGHT} strokeWidth={2.5} />
            <Text style={[styles.holdBtnText, !selectedId && styles.holdBtnTextDisabled]}>
              {submitting ? 'Requesting Hold…' : 'Hold My Package Here'}
            </Text>
            {selectedId && !submitting && <ChevronRight size={17} color={UPS_BROWN} strokeWidth={2.5} />}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  successRoot: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successCard: {
    backgroundColor: WHITE,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GREEN_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: { fontSize: 22, fontWeight: '800' as const, color: NAVY, marginBottom: 8, textAlign: 'center' },
  successSub: { fontSize: 14.5, color: SLATE, textAlign: 'center', lineHeight: 22, marginBottom: 18 },
  successDetail: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8, width: '100%' },
  successDetailText: { fontSize: 13, color: SLATE_LIGHT, flex: 1 },
  successNote: {
    backgroundColor: UPS_GOLD_SOFT,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: UPS_GOLD_BORDER,
  },
  successNoteText: { fontSize: 12.5, color: UPS_BROWN, lineHeight: 18, textAlign: 'center' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: UPS_BROWN,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  upsMark: {
    backgroundColor: UPS_GOLD,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  upsMarkText: { fontSize: 10, fontWeight: '900' as const, color: UPS_BROWN, letterSpacing: 0.5 },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: '700' as const, color: WHITE },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WHITE,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: NAVY },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 12, paddingBottom: 24 },

  tipRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: UPS_GOLD_SOFT,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: UPS_GOLD_BORDER,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  tipText: { flex: 1, fontSize: 13, color: UPS_BROWN, lineHeight: 18 },

  apCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  apCardSelected: {
    borderColor: UPS_GOLD,
    backgroundColor: UPS_GOLD_SOFT,
  },
  apCardClosed: {
    opacity: 0.65,
  },
  apHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apTypeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  apTypeIconUPS: { backgroundColor: UPS_BROWN },
  apHeaderInfo: { flex: 1 },
  apName: { fontSize: 15, fontWeight: '700' as const, color: NAVY },
  apType: { fontSize: 11.5, color: SLATE_LIGHT, marginTop: 2 },
  apDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  apDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  apDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  apDetailText: { fontSize: 12, color: SLATE_LIGHT },
  apFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  apRatingText: { fontSize: 12, fontWeight: '700' as const, color: NAVY },
  apCapacity: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  apCapacityText: { fontSize: 11.5, fontWeight: '600' as const },
  lockerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: UPS_GOLD_SOFT,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: UPS_GOLD_BORDER,
  },
  lockerText: { fontSize: 10.5, fontWeight: '700' as const, color: UPS_BROWN },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, color: SLATE_LIGHT },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E9EAEC',
    gap: 8,
  },
  selectedLabel: { fontSize: 13, color: SLATE_LIGHT, textAlign: 'center' },
  holdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: UPS_GOLD,
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: UPS_GOLD,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  holdBtnDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0, elevation: 0 },
  holdBtnText: { fontSize: 16, fontWeight: '800' as const, color: UPS_BROWN, letterSpacing: 0.2 },
  holdBtnTextDisabled: { color: SLATE_LIGHT },
});
