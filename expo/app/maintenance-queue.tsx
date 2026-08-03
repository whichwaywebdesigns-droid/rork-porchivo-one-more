import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Wrench,
  ChevronRight,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  User,
  MapPin,
  Calendar,
  Zap,
  RotateCcw,
  PlayCircle,
  PauseCircle,
  XCircle,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  type MaintenanceRequest,
  type MaintenanceStatus,
  type MaintenancePriority,
  type MaintenanceCounts,
  CATEGORY_META,
  PRIORITY_META,
  STATUS_META,
  maintRequestFromRpc,
  nextMaintenanceStatuses,
  isActiveRequest,
} from '@/types/maintenance';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// ─── Filter tab ───────────────────────────────────────────────────────────────

type QueueTab = 'open' | 'emergency' | 'mine' | 'scheduled' | 'closed';

const TABS: { key: QueueTab; label: string }[] = [
  { key: 'open',      label: 'Open' },
  { key: 'emergency', label: '🚨 Emergency' },
  { key: 'mine',      label: 'Mine' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'closed',    label: 'Closed' },
];

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({
  req,
  onStatusChange,
  isUpdating,
}: {
  req: MaintenanceRequest;
  onStatusChange: (id: string, status: MaintenanceStatus) => void;
  isUpdating: boolean;
}) {
  const Colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const catMeta = CATEGORY_META[req.category];
  const priMeta = PRIORITY_META[req.priority];
  const statusMeta = STATUS_META[req.status];
  const nextStatuses = nextMaintenanceStatuses(req.status);
  const active = isActiveRequest(req.status);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 60, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const quickStatusIcon = (s: MaintenanceStatus) => {
    switch (s) {
      case 'acknowledged': return <RotateCcw size={14} color={Colors.primary} />;
      case 'in_progress':  return <PlayCircle size={14} color={'#E07B00'} />;
      case 'on_hold':      return <PauseCircle size={14} color={Colors.gold} />;
      case 'scheduled':    return <Calendar size={14} color={Colors.secondary} />;
      case 'completed':    return <CheckCircle size={14} color={Colors.success} />;
      case 'cancelled':    return <XCircle size={14} color={Colors.danger} />;
      default:             return null;
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
      >
        {/* Priority stripe */}
        <View style={[styles.priorityStripe, { backgroundColor: priMeta.color }]} />

        <View style={styles.cardBody}>
          {/* Top row */}
          <View style={styles.cardTop}>
            {/* Category badge */}
            <View style={[styles.catBadge, { backgroundColor: catMeta.color + '18' }]}>
              <Text style={[styles.catLabel, { color: catMeta.color }]}>{catMeta.label}</Text>
            </View>

            {/* Status chip */}
            <View style={[styles.statusChip, { backgroundColor: statusMeta.color + '18', borderColor: statusMeta.color + '44' }]}>
              <Text style={[styles.statusChipText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.cardTitle, { color: Colors.slate }]} numberOfLines={2}>
            {req.isUrgent ? '⚡ ' : ''}{req.title}
          </Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            {req.unitNumber ? (
              <View style={styles.metaItem}>
                <MapPin size={11} color={Colors.slateLighter} />
                <Text style={[styles.metaText, { color: Colors.slateLighter }]}>Unit {req.unitNumber}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <User size={11} color={Colors.slateLighter} />
              <Text style={[styles.metaText, { color: Colors.slateLighter }]}>{req.reporterName}</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={11} color={Colors.slateLighter} />
              <Text style={[styles.metaText, { color: Colors.slateLighter }]}>{timeAgo(req.createdAt)}</Text>
            </View>
          </View>

          {/* Location detail */}
          {req.locationDetail ? (
            <Text style={[styles.locationText, { color: Colors.slateLighter }]} numberOfLines={1}>
              📍 {req.locationDetail}
            </Text>
          ) : null}

          {/* Assignee */}
          {req.assigneeName ? (
            <Text style={[styles.assigneeText, { color: Colors.slateLight }]}>
              Assigned to {req.assigneeName}
            </Text>
          ) : active ? (
            <Text style={[styles.assigneeText, { color: Colors.danger }]}>
              ⚠ Unassigned
            </Text>
          ) : null}

          {/* Resident-visible note */}
          {req.residentVisibleNote ? (
            <Text style={[styles.noteText, { color: Colors.slateLight, borderLeftColor: Colors.primary + '55' }]} numberOfLines={2}>
              {req.residentVisibleNote}
            </Text>
          ) : null}

          {/* Quick status actions */}
          {nextStatuses.length > 0 ? (
            <View style={styles.quickActions}>
              {nextStatuses.slice(0, 3).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.quickBtn, { borderColor: Colors.border, backgroundColor: Colors.elevated }]}
                  activeOpacity={0.75}
                  onPress={() => onStatusChange(req.id, s)}
                  disabled={isUpdating}
                >
                  {quickStatusIcon(s)}
                  <Text style={[styles.quickBtnText, { color: Colors.slateLight }]}>
                    {STATUS_META[s].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Summary badges ───────────────────────────────────────────────────────────

function SummaryBadge({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  const Colors = useColors();
  return (
    <View style={[styles.summaryBadge, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <View style={[styles.summaryIcon, { backgroundColor: color + '1A' }]}>{icon}</View>
      <Text style={[styles.summaryValue, { color: Colors.slate }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: Colors.slateLighter }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MaintenanceQueueScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, activeMembership } = useOrganization();

  const [activeTab, setActiveTab] = useState<QueueTab>('open');
  const [search, setSearch] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const orgId = activeOrg?.id ?? '';

  // ── Queue data ────────────────────────────────────────────────────────────
  const { data: allRequests = [], isLoading } = useQuery<MaintenanceRequest[]>({
    queryKey: ['maintenance-queue', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc('get_maintenance_queue', {
        p_org_id: orgId,
        p_limit: 80,
        p_offset: 0,
      });
      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map(maintRequestFromRpc);
    },
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });

  // ── Counts ────────────────────────────────────────────────────────────────
  const { data: counts } = useQuery<MaintenanceCounts | null>({
    queryKey: ['maintenance-counts', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc('get_maintenance_counts', { p_org_id: orgId });
      if (error || !data) return null;
      const row = (data as Record<string, unknown>[])[0] ?? {};
      return {
        open_count:        Number(row.open_count ?? 0),
        emergency_count:   Number(row.emergency_count ?? 0),
        in_progress_count: Number(row.in_progress_count ?? 0),
        scheduled_count:   Number(row.scheduled_count ?? 0),
        completed_today:   Number(row.completed_today ?? 0),
        unassigned_count:  Number(row.unassigned_count ?? 0),
      };
    },
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });

  // ── Status update ─────────────────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: MaintenanceStatus }) => {
      const { error } = await supabase.rpc('update_maintenance_status', {
        p_request_id: requestId,
        p_status: status,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-queue', orgId] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-counts', orgId] });
    },
    onError: () => {
      Alert.alert('Error', 'Could not update status. Please try again.');
    },
  });

  const handleStatusChange = useCallback(
    (requestId: string, status: MaintenanceStatus) => {
      const label = STATUS_META[status].label;
      Alert.alert(`Mark as ${label}?`, undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          onPress: () => updateStatusMutation.mutate({ requestId, status }),
        },
      ]);
    },
    [updateStatusMutation]
  );

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['maintenance-queue', orgId] }),
      queryClient.invalidateQueries({ queryKey: ['maintenance-counts', orgId] }),
    ]);
    setRefreshing(false);
  }, [queryClient, orgId]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const currentUserId = activeMembership?.userId ?? '';

  const filtered = React.useMemo(() => {
    let items = allRequests;

    // Tab filter
    switch (activeTab) {
      case 'open':
        items = items.filter((r) => isActiveRequest(r.status));
        break;
      case 'emergency':
        items = items.filter((r) => r.priority === 'emergency' && isActiveRequest(r.status));
        break;
      case 'mine':
        items = items.filter((r) => r.assigneeId === currentUserId && isActiveRequest(r.status));
        break;
      case 'scheduled':
        items = items.filter((r) => r.status === 'scheduled');
        break;
      case 'closed':
        items = items.filter((r) => !isActiveRequest(r.status));
        break;
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.reporterName?.toLowerCase().includes(q) ?? false) ||
          (r.unitNumber?.toLowerCase().includes(q) ?? false) ||
          (r.locationDetail?.toLowerCase().includes(q) ?? false)
      );
    }

    return items;
  }, [allRequests, activeTab, search, currentUserId]);

  if (!activeOrg) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
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
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Maintenance</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg.name}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '40' }]}
          onPress={() => router.push('/submit-maintenance')}
          activeOpacity={0.8}
        >
          <Plus size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.summaryStrip}
        style={{ backgroundColor: Colors.surface, borderBottomColor: Colors.border, borderBottomWidth: StyleSheet.hairlineWidth }}
      >
        <SummaryBadge label="Open"        value={counts?.open_count ?? 0}        color={Colors.primary}   icon={<Wrench size={14} color={Colors.primary} />} />
        <SummaryBadge label="Emergency"   value={counts?.emergency_count ?? 0}   color={Colors.danger}    icon={<Zap size={14} color={Colors.danger} />} />
        <SummaryBadge label="In Progress" value={counts?.in_progress_count ?? 0} color={'#E07B00'}        icon={<PlayCircle size={14} color={'#E07B00'} />} />
        <SummaryBadge label="Scheduled"   value={counts?.scheduled_count ?? 0}   color={Colors.secondary} icon={<Calendar size={14} color={Colors.secondary} />} />
        <SummaryBadge label="Done Today"  value={counts?.completed_today ?? 0}   color={Colors.success}   icon={<CheckCircle size={14} color={Colors.success} />} />
        <SummaryBadge label="Unassigned"  value={counts?.unassigned_count ?? 0}  color={Colors.gold}      icon={<AlertTriangle size={14} color={Colors.gold} />} />
      </ScrollView>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <View style={[styles.searchRow, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}>
          <Search size={15} color={Colors.slateLighter} />
          <TextInput
            style={[styles.searchInput, { color: Colors.slate }]}
            placeholder="Search title, resident, unit…"
            placeholderTextColor={Colors.slateLighter}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabStrip}
        style={{ backgroundColor: Colors.surface, borderBottomColor: Colors.border, borderBottomWidth: StyleSheet.hairlineWidth }}
      >
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tabPill,
                active
                  ? { backgroundColor: Colors.primary, borderColor: Colors.primary }
                  : { backgroundColor: Colors.elevated, borderColor: Colors.border },
              ]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? '#fff' : Colors.slateLight },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Wrench size={28} color={Colors.slateLighter} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: Colors.slateLight }]}>
              {search ? 'No matching requests' : 'No requests here'}
            </Text>
            <Text style={[styles.emptyDesc, { color: Colors.slateLighter }]}>
              {activeTab === 'open' ? 'All clear — no open maintenance requests.' : ''}
            </Text>
          </View>
        ) : (
          filtered.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onStatusChange={handleStatusChange}
              isUpdating={updateStatusMutation.isPending}
            />
          ))
        )}
      </ScrollView>

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: Colors.primary }]}
        onPress={() => router.push('/submit-maintenance')}
        activeOpacity={0.85}
      >
        <Plus size={22} color="#fff" />
      </TouchableOpacity>
    </View>
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
  newBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary strip
  summaryStrip: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  summaryBadge: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    minWidth: 72,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: { fontSize: 16, fontWeight: '700' as const },
  summaryLabel: { fontSize: 10 },

  // Search
  searchRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  // Tabs
  tabStrip: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: '500' as const },

  // List
  list: { padding: 14, gap: 10 },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  priorityStripe: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catLabel: { fontSize: 11, fontWeight: '600' as const },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 11, fontWeight: '600' as const },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  locationText: { fontSize: 12, fontStyle: 'italic' as const },
  assigneeText: { fontSize: 12 },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    borderLeftWidth: 2,
    paddingLeft: 8,
    fontStyle: 'italic' as const,
  },
  quickActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickBtnText: { fontSize: 12, fontWeight: '500' as const },

  // Empty
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    padding: 40,
    gap: 10,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600' as const },
  emptyDesc:  { fontSize: 13, textAlign: 'center' as const },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
});
