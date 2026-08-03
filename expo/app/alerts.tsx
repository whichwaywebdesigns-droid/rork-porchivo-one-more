import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Package,
  Car,
  User,
  HelpCircle,
  MapPin,
  Clock,
  ChevronRight,
  Shield,
  Filter,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useAlerts, AlertFeedFilter, getCategoryLabel, getCategoryColor } from '@/store/AlertsContext';
import { SuspiciousAlert, SuspiciousActivityCategory } from '@/types';
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

function getCategoryIcon(category: SuspiciousActivityCategory, size: number, color: string) {
  switch (category) {
    case 'suspicious_person': return <User size={size} color={color} />;
    case 'package_taken': return <Package size={size} color={color} />;
    case 'unknown_vehicle': return <Car size={size} color={color} />;
    case 'other': return <HelpCircle size={size} color={color} />;
  }
}

const AlertCard = React.memo(({ alert, onPress, index }: { alert: SuspiciousAlert; onPress: (a: SuspiciousAlert) => void; index: number }) => {
  const themeColors = useColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const categoryColors = getCategoryColor(alert.category);
  const isResolved = alert.status === 'resolved';

  useEffect(() => {
    const delay = Math.min(index * 50, 300);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.alertCard, isResolved && styles.alertCardResolved]}
        onPress={() => onPress(alert)}
        activeOpacity={0.7}
        testID={`alert-card-${alert.id}`}
      >
        <View style={[styles.cardIconWrap, { backgroundColor: categoryColors.bg }]}>
          {getCategoryIcon(alert.category, 18, categoryColors.fg)}
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.cardCategory, isResolved && styles.cardTextFaded]} numberOfLines={1}>
              {getCategoryLabel(alert.category)}
            </Text>
            {isResolved && (
              <View style={styles.resolvedBadge}>
                <Text style={styles.resolvedBadgeText}>Resolved</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardDesc, isResolved && styles.cardTextFaded]} numberOfLines={2}>
            {alert.description}
          </Text>
          <View style={styles.cardMeta}>
            <MapPin size={11} color={themeColors.slateLighter} />
            <Text style={styles.cardMetaText}>{alert.approximateLocation}</Text>
            <View style={styles.dot} />
            <Clock size={11} color={themeColors.slateLighter} />
            <Text style={styles.cardMetaText}>{formatRelativeTime(alert.createdAt)}</Text>
          </View>
        </View>
        <ChevronRight size={16} color={themeColors.slateLighter} />
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function AlertsScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { alerts, filter, changeFilter, activeCount } = useAlerts();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [reportVisible, setReportVisible] = useState<boolean>(false);

  const handleAlertPress = useCallback((alert: SuspiciousAlert) => {
    router.push({ pathname: '/alert-detail' as any, params: { id: alert.id } });
  }, [router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const renderItem = useCallback(({ item, index }: { item: SuspiciousAlert; index: number }) => (
    <AlertCard alert={item} onPress={handleAlertPress} index={index} />
  ), [handleAlertPress]);

  const keyExtractor = useCallback((item: SuspiciousAlert) => item.id, []);

  const FILTERS: { value: AlertFeedFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'resolved', label: 'Resolved' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Alerts',
          // P-14: redundant header report button removed — the FAB below
          // opens the same ReportAlertSheet and is more discoverable.
        }}
      />

      <View style={styles.headerArea}>
        <View style={styles.headerTopRow}>
          <View style={styles.alertBannerIcon}>
            <Shield size={20} color="#D84315" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Neighborhood Alerts</Text>
            <Text style={styles.headerSubtitle}>
              {activeCount} active {activeCount === 1 ? 'alert' : 'alerts'} on your block
            </Text>
          </View>
        </View>

        <View style={styles.disclaimerBanner}>
          <AlertTriangle size={13} color="#BF360C" />
          <Text style={styles.disclaimerText}>
            These are neighbor-to-neighbor tips, not police reports. Please use responsibly.
          </Text>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterPill, filter === f.value && styles.filterPillActive]}
              onPress={() => changeFilter(f.value)}
              activeOpacity={0.7}
              testID={`filter-${f.value}`}
            >
              <Text style={[styles.filterPillText, filter === f.value && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={alerts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Shield size={36} color={colors.slateLighter} />
            </View>
            <Text style={styles.emptyTitle}>No alerts</Text>
            <Text style={styles.emptySubtitle}>
              No suspicious activity has been reported on your block. That's a good thing!
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setReportVisible(true)}
        activeOpacity={0.85}
        testID="report-fab"
      >
        <AlertTriangle size={22} color={colors.white} />
      </TouchableOpacity>

      <ReportAlertSheet visible={reportVisible} onClose={() => setReportVisible(false)} />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerArea: {
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    alertBannerIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: '#FBE9E7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.slate,
      marginBottom: 2,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.slateLight,
    },
    disclaimerBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: '#FFF3E0',
      padding: 10,
      borderRadius: 10,
      marginBottom: 14,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 11,
      color: '#BF360C',
      lineHeight: 16,
      fontWeight: '500' as const,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
    },
    filterPill: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.elevated,
    },
    filterPillActive: {
      backgroundColor: '#D84315',
    },
    filterPillText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.slateLight,
    },
    filterPillTextActive: {
      color: colors.white,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 100,
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
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
    alertCardResolved: {
      opacity: 0.6,
    },
    cardIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardContent: {
      flex: 1,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    cardCategory: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.slate,
      flex: 1,
    },
    cardTextFaded: {
      color: colors.slateLighter,
    },
    resolvedBadge: {
      backgroundColor: '#E8F5E9',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    resolvedBadgeText: {
      fontSize: 10,
      fontWeight: '600' as const,
      color: '#2E7D32',
    },
    cardDesc: {
      fontSize: 13,
      color: colors.slateLight,
      lineHeight: 18,
      marginBottom: 6,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cardMetaText: {
      fontSize: 11,
      color: colors.slateLighter,
      fontWeight: '500' as const,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.slateLighter,
      marginHorizontal: 2,
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
      backgroundColor: colors.surface,
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
      color: colors.slate,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.slateLight,
      textAlign: 'center',
      lineHeight: 20,
    },
    fab: {
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
}
