import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Package,
  HandHeart,
  RotateCcw,
  UserPlus,
  Truck,
  Shield,
  Eye,
  X,
  MapPin,
  Clock,
  ChevronRight,
  AlertTriangle,
  Bell,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useNeighborhood } from '@/store/NeighborhoodContext';
import { useAlerts } from '@/store/AlertsContext';
import { NeighborhoodEvent, NeighborhoodEventType } from '@/types';
import ReportAlertSheet from '@/components/ReportAlertSheet';

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getEventIcon(type: NeighborhoodEventType, size: number, color: string) {
  switch (type) {
    case 'package_delivered':
      return <Package size={size} color={color} />;
    case 'partner_pickup':
      return <HandHeart size={size} color={color} />;
    case 'package_returned':
      return <RotateCcw size={size} color={color} />;
    case 'new_partner_joined':
      return <UserPlus size={size} color={color} />;
    case 'delivery_in_progress':
      return <Truck size={size} color={color} />;
    default:
      return <Package size={size} color={color} />;
  }
}

function getEventColor(type: NeighborhoodEventType): { bg: string; fg: string } {
  switch (type) {
    case 'package_delivered':
      return { bg: '#E8F5E9', fg: '#2E7D32' };
    case 'partner_pickup':
      return { bg: '#E3F2FD', fg: '#1565C0' };
    case 'package_returned':
      return { bg: '#FFF3E0', fg: '#E65100' };
    case 'new_partner_joined':
      return { bg: '#F3E5F5', fg: '#7B1FA2' };
    case 'delivery_in_progress':
      return { bg: '#FFF8E1', fg: '#F57F17' };
    default:
      return { bg: Colors.background, fg: Colors.slate };
  }
}

function getEventDetailMessage(type: NeighborhoodEventType): string {
  switch (type) {
    case 'package_delivered':
      return 'A delivery was completed on your block. When neighbors stay aware of deliveries, porch pirates think twice about targeting the area.';
    case 'partner_pickup':
      return 'A Porch Partner secured a package before it could be left unattended. This kind of neighborhood teamwork is what keeps porches safe.';
    case 'package_returned':
      return 'A package was successfully returned to its owner by a Porch Partner. No personal information is shared — just neighbors helping neighbors.';
    case 'new_partner_joined':
      return 'Someone nearby signed up as a Porch Partner. The more partners on your block, the safer everyone\'s deliveries become.';
    case 'delivery_in_progress':
      return 'A carrier is actively delivering in your area. Stay alert and keep an eye out for packages on porches nearby.';
    default:
      return 'Activity detected in your neighborhood.';
  }
}

const FeedItem = React.memo(({ event, onPress, index }: { event: NeighborhoodEvent; onPress: (e: NeighborhoodEvent) => void; index: number }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const colors = getEventColor(event.type);

  useEffect(() => {
    const delay = Math.min(index * 60, 400);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]).start();
  }, [index, fadeAnim, slideAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={styles.feedCard}
        onPress={() => onPress(event)}
        activeOpacity={0.7}
        testID={`feed-item-${event.id}`}
      >
        <View style={[styles.feedIconWrap, { backgroundColor: colors.bg }]}>
          {getEventIcon(event.type, 18, colors.fg)}
        </View>
        <View style={styles.feedContent}>
          <Text style={styles.feedTitle} numberOfLines={1}>{event.title}</Text>
          <View style={styles.feedMeta}>
            <MapPin size={11} color={Colors.slateLighter} />
            <Text style={styles.feedLocation}>{event.relativeLocation}</Text>
            <View style={styles.feedDot} />
            <Clock size={11} color={Colors.slateLighter} />
            <Text style={styles.feedTime}>{formatRelativeTime(event.timestamp)}</Text>
          </View>
        </View>
        <ChevronRight size={16} color={Colors.slateLighter} />
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function NeighborhoodScreen() {
  const router = useRouter();
  const {
    events,
    filter,
    changeFilter,
    selectedEvent,
    selectEvent,
    hasLocationConsent,
    todayCount,
    weekCount,
  } = useNeighborhood();
  const { activeCount } = useAlerts();

  const [detailVisible, setDetailVisible] = useState<boolean>(false);
  const [reportVisible, setReportVisible] = useState<boolean>(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const handleEventPress = useCallback((event: NeighborhoodEvent) => {
    selectEvent(event);
    setDetailVisible(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }, [selectEvent, sheetAnim]);

  const handleCloseDetail = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setDetailVisible(false);
      selectEvent(null);
    });
  }, [selectEvent, sheetAnim]);

  const handleEnableLocation = useCallback(() => {
    router.push('/location-consent' as any);
  }, [router]);

  const renderItem = useCallback(({ item, index }: { item: NeighborhoodEvent; index: number }) => (
    <FeedItem event={item} onPress={handleEventPress} index={index} />
  ), [handleEventPress]);

  const keyExtractor = useCallback((item: NeighborhoodEvent) => item.id, []);

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const backdropOpacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  if (!hasLocationConsent) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{
          title: 'Neighborhood',
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.primary,
          headerShadowVisible: false,
        }} />
        <View style={styles.consentContainer}>
          <View style={styles.consentIconWrap}>
            <Shield size={48} color={Colors.primary} />
          </View>
          <Text style={styles.consentTitle}>Enable Neighborhood Watch</Text>
          <Text style={styles.consentDesc}>
            Grant location access to see delivery activity on your block. We never share your exact address — only anonymized updates to keep your neighborhood safe.
          </Text>
          <TouchableOpacity
            style={styles.consentButton}
            onPress={handleEnableLocation}
            activeOpacity={0.85}
            testID="enable-location-neighborhood"
          >
            <MapPin size={18} color={Colors.white} />
            <Text style={styles.consentButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Neighborhood',
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.primary,
        headerShadowVisible: false,
      }} />

      <View style={styles.headerArea}>
        <View style={styles.headerTop}>
          <View style={styles.headerIconRow}>
            <View style={styles.headerShieldWrap}>
              <Eye size={20} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Your Block</Text>
              <Text style={styles.headerSubtitle}>When neighbors are aware, porch pirates think twice.</Text>
            </View>
            <TouchableOpacity
              style={styles.alertHeaderBtn}
              onPress={() => router.push('/alerts' as any)}
              activeOpacity={0.7}
              testID="neighborhood-alerts-btn"
            >
              <Bell size={18} color="#D84315" />
              {activeCount > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{activeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{todayCount}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{weekCount}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, filter === 'today' && styles.filterPillActive]}
            onPress={() => changeFilter('today')}
            activeOpacity={0.7}
            testID="filter-today"
          >
            <Text style={[styles.filterPillText, filter === 'today' && styles.filterPillTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, filter === 'this_week' && styles.filterPillActive]}
            onPress={() => changeFilter('this_week')}
            activeOpacity={0.7}
            testID="filter-this-week"
          >
            <Text style={[styles.filterPillText, filter === 'this_week' && styles.filterPillTextActive]}>This Week</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={events}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Shield size={36} color={Colors.slateLighter} />
            </View>
            <Text style={styles.emptyTitle}>No activity {filter === 'today' ? 'today' : 'this week'}</Text>
            <Text style={styles.emptySubtitle}>
              Your block is quiet. Check back soon — activity updates appear here in near real-time.
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.reportFab}
        onPress={() => setReportVisible(true)}
        activeOpacity={0.85}
        testID="neighborhood-report-fab"
      >
        <AlertTriangle size={22} color={Colors.white} />
      </TouchableOpacity>

      <ReportAlertSheet visible={reportVisible} onClose={() => setReportVisible(false)} />

      {detailVisible && selectedEvent && (
        <Modal
          transparent
          visible={detailVisible}
          animationType="none"
          onRequestClose={handleCloseDetail}
        >
          <Pressable style={styles.backdrop} onPress={handleCloseDetail}>
            <Animated.View style={[styles.backdropOverlay, { opacity: backdropOpacity }]} />
          </Pressable>
          <Animated.View style={[styles.detailSheet, { transform: [{ translateY: sheetTranslate }] }]}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity
              style={styles.sheetClose}
              onPress={handleCloseDetail}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="close-detail"
            >
              <X size={20} color={Colors.slateLight} />
            </TouchableOpacity>

            <View style={[styles.detailIconWrap, { backgroundColor: getEventColor(selectedEvent.type).bg }]}>
              {getEventIcon(selectedEvent.type, 28, getEventColor(selectedEvent.type).fg)}
            </View>

            <Text style={styles.detailTitle}>{selectedEvent.title}</Text>

            <View style={styles.detailMetaRow}>
              <MapPin size={13} color={Colors.slateLight} />
              <Text style={styles.detailMeta}>{selectedEvent.relativeLocation}</Text>
              <View style={styles.feedDot} />
              <Clock size={13} color={Colors.slateLight} />
              <Text style={styles.detailMeta}>{formatRelativeTime(selectedEvent.timestamp)}</Text>
            </View>

            <Text style={styles.detailDesc}>
              {getEventDetailMessage(selectedEvent.type)}
            </Text>

            <View style={styles.privacyNote}>
              <Shield size={14} color={Colors.primary} />
              <Text style={styles.privacyText}>
                No names or exact addresses are shared. Porchivo protects your privacy while keeping your block safe.
              </Text>
            </View>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerArea: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTop: {
    marginBottom: 16,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerShieldWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.slateLight,
    fontWeight: '400' as const,
    maxWidth: 240,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.slateLight,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slateLight,
  },
  filterPillTextActive: {
    color: Colors.white,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  feedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedContent: {
    flex: 1,
  },
  feedTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 4,
  },
  feedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedLocation: {
    fontSize: 11,
    color: Colors.slateLighter,
    fontWeight: '500' as const,
  },
  feedDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.slateLighter,
    marginHorizontal: 2,
  },
  feedTime: {
    fontSize: 11,
    color: Colors.slateLighter,
    fontWeight: '500' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  consentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  consentIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  consentTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 12,
    textAlign: 'center',
  },
  consentDesc: {
    fontSize: 15,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  consentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  consentButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 32 : 40,
    minHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetClose: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.slate,
    textAlign: 'center',
    marginBottom: 10,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 20,
  },
  detailMeta: {
    fontSize: 13,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  detailDesc: {
    fontSize: 15,
    color: Colors.slate,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 24,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.skyBlue,
    padding: 14,
    borderRadius: 12,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: Colors.primary,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  alertHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FBE9E7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  alertBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D84315',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  reportFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D84315',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
