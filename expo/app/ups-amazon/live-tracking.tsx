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
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  BellOff,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
  Truck,
  Zap,
} from 'lucide-react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

const AMAZON_ORANGE = '#FF9900';
const AMAZON_DARK = '#131A22';
const BG = '#F2F3F4';
const WHITE = '#FFFFFF';
const NAVY = '#1B2A4A';
const SLATE = '#4B5563';
const SLATE_LIGHT = '#9CA3AF';
const GREEN = '#059669';
const GREEN_SOFT = '#ECFDF5';
const ORANGE_SOFT = '#FFF8EC';
const ORANGE_BORDER = '#FFD580';

interface DeliveryStop {
  id: number;
  label: string;
  sublabel: string;
  isComplete: boolean;
  isCurrent: boolean;
  isYours: boolean;
  time?: string;
}

const INITIAL_STOPS: DeliveryStop[] = [
  { id: 1, label: 'Amazon Warehouse', sublabel: 'Picked up by driver', isComplete: true, isCurrent: false, isYours: false, time: '7:12 AM' },
  { id: 2, label: '842 Oakmont Ave', sublabel: 'Package delivered', isComplete: true, isCurrent: false, isYours: false, time: '9:04 AM' },
  { id: 3, label: '1190 Birchwood Dr', sublabel: 'Package delivered', isComplete: true, isCurrent: false, isYours: false, time: '9:38 AM' },
  { id: 4, label: '304 Sycamore Ln', sublabel: 'Delivery in progress…', isComplete: false, isCurrent: true, isYours: false },
  { id: 5, label: 'Your address', sublabel: 'Up next — estimated 3:20 PM', isComplete: false, isCurrent: false, isYours: true },
  { id: 6, label: '2 more stops after you', sublabel: '612 Maple St, 78 River Rd', isComplete: false, isCurrent: false, isYours: false },
];

// ─── Fake Map View ────────────────────────────────────────────────────────────

function FakeMapView({ driverPos }: { driverPos: Animated.Value }) {
  // Animated dots for atmosphere
  const dots = [
    { top: '25%', left: '18%', size: 6, color: '#D1D5DB' },
    { top: '45%', left: '65%', size: 5, color: '#D1D5DB' },
    { top: '60%', left: '30%', size: 7, color: '#D1D5DB' },
    { top: '35%', left: '80%', size: 5, color: '#D1D5DB' },
    { top: '70%', left: '72%', size: 6, color: '#D1D5DB' },
  ];

  const driverLeft = driverPos.interpolate({ inputRange: [0, 1], outputRange: ['22%', '54%'] });
  const driverTop = driverPos.interpolate({ inputRange: [0, 1], outputRange: ['55%', '48%'] });

  return (
    <View style={map.container}>
      {/* Grid lines */}
      {[20, 40, 60, 80].map((p) => (
        <View key={`h${p}`} style={[map.hLine, { top: `${p}%` }]} />
      ))}
      {[15, 30, 45, 60, 75, 90].map((p) => (
        <View key={`v${p}`} style={[map.vLine, { left: `${p}%` }]} />
      ))}

      {/* Location dots */}
      {dots.map((d, i) => (
        <View
          key={i}
          style={[map.locationDot, { top: d.top as `${number}%`, left: d.left as `${number}%`, width: d.size, height: d.size, borderRadius: d.size / 2, backgroundColor: d.color }]}
        />
      ))}

      {/* Destination pin */}
      <View style={[map.pin, { top: '43%', left: '55%' }]}>
        <View style={map.pinInner}>
          <MapPin size={14} color={WHITE} strokeWidth={2.5} />
        </View>
        <View style={map.pinTail} />
      </View>

      {/* Animated driver truck */}
      <Animated.View style={[map.truck, { top: driverTop, left: driverLeft }]}>
        <Truck size={16} color={WHITE} strokeWidth={2.5} />
      </Animated.View>

      {/* Route dashed line */}
      <View style={map.routeLine} />

      {/* Map label */}
      <View style={map.label}>
        <Zap size={10} color={AMAZON_ORANGE} strokeWidth={2.5} />
        <Text style={map.labelText}>Live Tracking</Text>
      </View>
    </View>
  );
}

const map = StyleSheet.create({
  container: {
    height: 200,
    backgroundColor: '#EEF2F7',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#DDE3EC',
  },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#DDE3EC',
  },
  locationDot: {
    position: 'absolute',
  },
  pin: {
    position: 'absolute',
    alignItems: 'center',
  },
  pinInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AMAZON_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AMAZON_ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: AMAZON_ORANGE,
  },
  truck: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: AMAZON_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  routeLine: {
    position: 'absolute',
    top: '50%',
    left: '28%',
    width: '28%',
    height: 2,
    backgroundColor: AMAZON_ORANGE,
    opacity: 0.5,
  },
  label: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: NAVY,
    letterSpacing: 0.3,
  },
});

// ─── Stop Row ─────────────────────────────────────────────────────────────────

function StopRow({ stop, isLast }: { stop: DeliveryStop; isLast: boolean }) {
  return (
    <View style={srow.wrap}>
      <View style={srow.left}>
        <View style={[
          srow.dot,
          stop.isComplete && srow.dotDone,
          stop.isCurrent && srow.dotCurrent,
          stop.isYours && srow.dotYours,
        ]}>
          {stop.isComplete
            ? <CheckCircle2 size={12} color={WHITE} strokeWidth={2.5} />
            : stop.isCurrent
            ? <Truck size={11} color={WHITE} strokeWidth={2.5} />
            : stop.isYours
            ? <MapPin size={11} color={WHITE} strokeWidth={2.5} />
            : null}
        </View>
        {!isLast && <View style={[srow.connector, stop.isComplete && srow.connectorDone]} />}
      </View>
      <View style={[srow.content, stop.isYours && srow.contentYours]}>
        <Text style={[
          srow.label,
          stop.isCurrent && { color: AMAZON_DARK },
          stop.isYours && { color: AMAZON_ORANGE, fontWeight: '800' as const },
        ]}>
          {stop.label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {stop.isCurrent && <View style={srow.activeDot} />}
          <Text style={[srow.sublabel, stop.isCurrent && { color: AMAZON_ORANGE }]}>{stop.sublabel}</Text>
          {stop.time && <Text style={srow.time}>{stop.time}</Text>}
        </View>
      </View>
    </View>
  );
}

const srow = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 14 },
  left: { width: 28, alignItems: 'center' },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: GREEN },
  dotCurrent: { backgroundColor: AMAZON_ORANGE },
  dotYours: { backgroundColor: NAVY },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    marginVertical: 3,
    minHeight: 16,
  },
  connectorDone: { backgroundColor: GREEN },
  content: {
    flex: 1,
    paddingBottom: 18,
    gap: 2,
  },
  contentYours: {
    backgroundColor: ORANGE_SOFT,
    borderRadius: 12,
    padding: 10,
    marginLeft: -4,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    marginBottom: 14,
  },
  label: { fontSize: 14, fontWeight: '600' as const, color: NAVY },
  sublabel: { fontSize: 12, color: SLATE_LIGHT, flex: 1 },
  time: { fontSize: 11.5, color: SLATE_LIGHT, fontWeight: '500' as const },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AMAZON_ORANGE,
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function LiveTrackingScreen() {
  const [notifyAt2, setNotifyAt2] = useState<boolean>(true);
  const [notifyArrival, setNotifyArrival] = useState<boolean>(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Driver position (0 = far, 1 = near your stop)
  const driverPos = useRef(new Animated.Value(0.3)).current;

  // Card animations
  const mapAnim = useRef(new Animated.Value(0)).current;
  const stopsAnim = useRef(new Animated.Value(30)).current;
  const stopsOpacity = useRef(new Animated.Value(0)).current;
  const etaAnim = useRef(new Animated.Value(0)).current;
  const refreshRotate = useRef(new Animated.Value(0)).current;

  // ETA countdown
  const [etaMinutes, setEtaMinutes] = useState<number>(34);

  useEffect(() => {
    Animated.timing(mapAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(stopsAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
        Animated.timing(stopsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 250);
    setTimeout(() => {
      Animated.timing(etaAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 500);

    // Animate driver moving towards destination
    Animated.timing(driverPos, { toValue: 0.62, duration: 4000, useNativeDriver: false }).start();

    // Countdown
    const interval = setInterval(() => {
      setEtaMinutes((m) => (m > 1 ? m - 1 : m));
    }, 60000);
    return () => clearInterval(interval);
  }, [mapAnim, stopsAnim, stopsOpacity, etaAnim, driverPos]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setRefreshing(true);
    Animated.loop(
      Animated.timing(refreshRotate, { toValue: 1, duration: 600, useNativeDriver: true }),
      { iterations: 2 },
    ).start(() => {
      setRefreshing(false);
      setLastRefresh(new Date());
      refreshRotate.setValue(0);
    });
    // Bump driver closer
    Animated.timing(driverPos, { toValue: Math.min(0.62 + Math.random() * 0.1, 0.9), duration: 800, useNativeDriver: false }).start();
    setEtaMinutes((m) => Math.max(m - 3, 2));
  }, [refreshing, refreshRotate]);

  const toggleNotify2 = useCallback((v: boolean) => {
    setNotifyAt2(v);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  }, []);

  const toggleNotifyArrival = useCallback((v: boolean) => {
    setNotifyArrival(v);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  }, []);

  const spin = refreshRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const timeStr = lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Live Tracking',
          headerStyle: { backgroundColor: BG },
          headerShadowVisible: false,
          headerTintColor: NAVY,
        }}
      />

      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.liveDot} />
        <Text style={styles.bannerText}>Driver is 5 stops away · ETA 3:20 PM</Text>
        <TouchableOpacity onPress={handleRefresh} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <RefreshCw size={16} color={WHITE} strokeWidth={2.5} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ETA Hero ─────────────────────────────────────────────────── */}
        <Animated.View style={[styles.etaCard, { opacity: etaAnim }]}>
          <View style={styles.etaLeft}>
            <Text style={styles.etaMinutes}>{etaMinutes}</Text>
            <Text style={styles.etaLabel}>min away</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaRight}>
            <View style={styles.etaRow}>
              <Clock size={13} color={SLATE_LIGHT} strokeWidth={2} />
              <Text style={styles.etaDetail}>Est. arrival <Text style={styles.etaDetailBold}>3:20 PM</Text></Text>
            </View>
            <View style={styles.etaRow}>
              <Navigation size={13} color={SLATE_LIGHT} strokeWidth={2} />
              <Text style={styles.etaDetail}>5 stops ahead</Text>
            </View>
            <View style={styles.etaRow}>
              <Package size={13} color={SLATE_LIGHT} strokeWidth={2} />
              <Text style={styles.etaDetail}>Sony WH-1000XM5</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Fake Map ───────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: mapAnim }}>
          <FakeMapView driverPos={driverPos} />
          <View style={styles.refreshRow}>
            <Text style={styles.refreshText}>Updated {timeStr}</Text>
          </View>
        </Animated.View>

        {/* ── Delivery Route ─────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.card,
            { opacity: stopsOpacity, transform: [{ translateY: stopsAnim }] },
          ]}
        >
          <Text style={styles.sectionTitle}>Delivery Route</Text>
          <Text style={styles.sectionSub}>Driver's stop sequence for today</Text>
          <View style={styles.stopsList}>
            {INITIAL_STOPS.map((stop, i) => (
              <StopRow key={stop.id} stop={stop} isLast={i === INITIAL_STOPS.length - 1} />
            ))}
          </View>
        </Animated.View>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <Animated.View style={[styles.card, { opacity: stopsOpacity }]}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.sectionSub}>Get alerted at key moments</Text>

          <View style={styles.notifRow}>
            <View style={styles.notifLeft}>
              <View style={[styles.notifIcon, notifyAt2 && styles.notifIconActive]}>
                <Bell size={15} color={notifyAt2 ? AMAZON_ORANGE : SLATE_LIGHT} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.notifLabel}>2 stops away alert</Text>
                <Text style={styles.notifSub}>Get ready to receive your package</Text>
              </View>
            </View>
            <Switch
              value={notifyAt2}
              onValueChange={toggleNotify2}
              trackColor={{ false: '#E5E7EB', true: AMAZON_ORANGE }}
              thumbColor={WHITE}
              ios_backgroundColor="#E5E7EB"
            />
          </View>

          <View style={[styles.notifRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.notifLeft}>
              <View style={[styles.notifIcon, notifyArrival && styles.notifIconActive]}>
                {notifyArrival
                  ? <Box size={15} color={AMAZON_ORANGE} strokeWidth={2} />
                  : <BellOff size={15} color={SLATE_LIGHT} strokeWidth={2} />}
              </View>
              <View>
                <Text style={styles.notifLabel}>Delivered alert</Text>
                <Text style={styles.notifSub}>Instant notification when dropped off</Text>
              </View>
            </View>
            <Switch
              value={notifyArrival}
              onValueChange={toggleNotifyArrival}
              trackColor={{ false: '#E5E7EB', true: AMAZON_ORANGE }}
              thumbColor={WHITE}
              ios_backgroundColor="#E5E7EB"
            />
          </View>
        </Animated.View>

        {/* ── Pro tip ────────────────────────────────────────────────── */}
        <View style={styles.proTip}>
          <Zap size={13} color={AMAZON_ORANGE} strokeWidth={2.5} />
          <Text style={styles.proTipText}>
            <Text style={{ fontWeight: '700' as const, color: NAVY }}>Pro tip: </Text>
            Enable the 2-stop alert so you have time to unlock a gate or move your car before the driver arrives.
          </Text>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Share ETA ─────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.88} accessibilityLabel="Share ETA">
          <ChevronRight size={17} color={WHITE} strokeWidth={2.5} />
          <Text style={styles.shareBtnText}>Share ETA with Someone</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AMAZON_DARK,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: '700' as const, color: WHITE },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 14, paddingBottom: 24 },

  etaCard: {
    backgroundColor: AMAZON_DARK,
    borderRadius: 20,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    shadowColor: AMAZON_DARK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  etaLeft: { alignItems: 'center' },
  etaMinutes: {
    fontSize: 56,
    fontWeight: '900' as const,
    color: AMAZON_ORANGE,
    lineHeight: 60,
  },
  etaLabel: { fontSize: 13, color: SLATE_LIGHT, fontWeight: '500' as const },
  etaDivider: { width: 1, height: 60, backgroundColor: 'rgba(255,255,255,0.1)' },
  etaRight: { flex: 1, gap: 8 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  etaDetail: { fontSize: 13, color: '#CBD5E1' },
  etaDetailBold: { fontWeight: '700' as const, color: WHITE },

  refreshRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  refreshText: { fontSize: 11.5, color: SLATE_LIGHT },

  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 5,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' as const, color: NAVY, marginBottom: 3 },
  sectionSub: { fontSize: 13, color: SLATE_LIGHT, marginBottom: 18 },
  stopsList: { gap: 0 },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 0,
  },
  notifLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIconActive: { backgroundColor: ORANGE_SOFT },
  notifLabel: { fontSize: 14, fontWeight: '600' as const, color: NAVY },
  notifSub: { fontSize: 12, color: SLATE_LIGHT, marginTop: 2 },

  proTip: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: ORANGE_SOFT,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: ORANGE_BORDER,
    alignItems: 'flex-start',
  },
  proTipText: { flex: 1, fontSize: 13, color: SLATE, lineHeight: 19 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E9EAEC',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: AMAZON_ORANGE,
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: AMAZON_ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  shareBtnText: { fontSize: 16, fontWeight: '800' as const, color: WHITE },
});
