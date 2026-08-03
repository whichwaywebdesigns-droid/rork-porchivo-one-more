import React, { useCallback, useRef, useState, useMemo } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle,
  ChevronRight,
  User,
  MessageSquare,
  TrendingUp,
  Search,
  X,
  Zap,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  type IncidentReport,
  type IncidentCounts,
  type IncidentStatus,
  type IncidentSeverity,
  incidentRowToReport,
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPE_EMOJI,
  INCIDENT_STATUS_LABELS,
  INCIDENT_SEVERITY_LABELS,
  SEVERITY_HEX,
  nextIncidentStatuses,
  isActiveStatus,
  RESOLUTION_OPTIONS,
} from '@/types/incidents';

// ─── Filter config ─────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'open' | 'escalated' | 'resolved' | 'closed';

interface FilterTab {
  key: FilterKey;
  label: string;
  rpcValue: string | null;
}

const FILTERS: FilterTab[] = [
  { key: 'all',       label: 'All',        rpcValue: null },
  { key: 'open',      label: 'Open',       rpcValue: 'open' },
  { key: 'escalated', label: 'Escalated',  rpcValue: 'escalated' },
  { key: 'resolved',  label: 'Resolved',   rpcValue: 'resolved' },
  { key: 'closed',    label: 'Closed',     rpcValue: 'closed' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function agingColor(
  createdAt: string,
  status: IncidentStatus,
  Colors: ReturnType<typeof useColors>
): string {
  if (!isActiveStatus(status)) return Colors.slateLighter;
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  if (days >= 7) return Colors.danger;
  if (days >= 3) return Colors.secondary;
  if (days >= 1) return Colors.gold;
  return Colors.success;
}

function severityBorder(severity: IncidentSeverity): string {
  return SEVERITY_HEX[severity];
}

function statusBadge(
  status: IncidentStatus,
  Colors: ReturnType<typeof useColors>
): { bg: string; text: string } {
  switch (status) {
    case 'flagged':      return { bg: Colors.danger + '20',    text: Colors.danger };
    case 'intake':       return { bg: Colors.primary + '20',   text: Colors.primary };
    case 'investigating': return { bg: Colors.gold + '20',     text: Colors.gold };
    case 'escalated':    return { bg: Colors.secondary + '20', text: Colors.secondary };
    case 'resolved':     return { bg: Colors.success + '20',   text: Colors.success };
    case 'closed':       return { bg: Colors.border,           text: Colors.slateLighter };
    default:             return { bg: Colors.border,           text: Colors.slateLight };
  }
}

function countBadgeColor(key: string, Colors: ReturnType<typeof useColors>): string {
  switch (key) {
    case 'open':       return Colors.primary;
    case 'escalated':  return Colors.secondary;
    case 'overdue':    return Colors.danger;
    case 'unassigned': return Colors.gold;
    default:           return Colors.slateLighter;
  }
}

// ─── Summary metric card ──────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  accent,
  pulse,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  pulse?: boolean;
  icon: React.ReactNode;
}) {
  const Colors = useColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!pulse || value === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 850, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, value, pulseAnim]);

  return (
    <View style={[styles.metricCard, { backgroundColor: Colors.surface, borderColor: accent + '35' }]}>
      <Animated.View
        style={[
          styles.metricIcon,
          { backgroundColor: accent + '18' },
          pulse && value > 0 ? { transform: [{ scale: pulseAnim }] } : undefined,
        ]}
      >
        {icon}
      </Animated.View>
      <Text style={[styles.metricValue, { color: Colors.slate }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: Colors.slateLighter }]}>{label}</Text>
    </View>
  );
}

// ─── Severity dots indicator ──────────────────────────────────────────────────

function SeverityDots({ severity }: { severity: IncidentSeverity }) {
  const filled = severity === 'low' ? 1 : severity === 'medium' ? 2 : severity === 'high' ? 3 : 3;
  const color = SEVERITY_HEX[severity];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (severity !== 'critical') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [severity, pulseAnim]);

  return (
    <View style={styles.severityDots}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.severityDot,
            {
              backgroundColor: i < filled ? color : color + '30',
              transform: severity === 'critical' && i === 2 ? [{ scale: pulseAnim }] : undefined,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Incident card ────────────────────────────────────────────────────────────

function IncidentCard({
  item,
  index,
  isStaff,
  onUpdateStatus,
  isUpdating,
}: {
  item: IncidentReport;
  index: number;
  isStaff: boolean;
  onUpdateStatus: (id: string, status: IncidentStatus) => void;
  isUpdating: boolean;
}) {
  const Colors = useColors();
  const [expanded, setExpanded] = useState<boolean>(false);

  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const expandAnim   = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1,
      delay: index * 50,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [entranceAnim, index]);

  const toggleExpand = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 55, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    const toValue = expanded ? 0 : 1;
    Animated.spring(expandAnim, { toValue, useNativeDriver: false, tension: 80, friction: 12 }).start();
    setExpanded((p) => !p);
  }, [expanded, scaleAnim, expandAnim]);

  const border     = severityBorder(item.severity);
  const badge      = statusBadge(item.status, Colors);
  const ageColor   = agingColor(item.createdAt, item.status, Colors);
  const nextSts    = nextIncidentStatuses(item.status);
  const typeEmoji  = INCIDENT_TYPE_EMOJI[item.type] ?? '❓';
  const typeLabel  = INCIDENT_TYPE_LABELS[item.type];

  // Overdue flag
  const isOverdue = isActiveStatus(item.status)
    && item.dueDate != null
    && new Date(item.dueDate).getTime() < Date.now();

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: Colors.surface,
          borderColor: Colors.border,
          borderLeftColor: border,
          transform: [
            { scale: scaleAnim },
            {
              translateY: entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
          opacity: entranceAnim,
        },
      ]}
    >
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.9}>
        <View style={styles.cardTop}>
          {/* Type emoji badge */}
          <View style={[styles.typeEmoji, { backgroundColor: border + '15', borderColor: border + '35' }]}>
            <Text style={styles.typeEmojiText}>{typeEmoji}</Text>
          </View>

          <View style={styles.cardMain}>
            {/* Title + status */}
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: Colors.slate }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                  {INCIDENT_STATUS_LABELS[item.status]}
                </Text>
              </View>
            </View>

            {/* Type + meta row */}
            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardType, { color: Colors.slateLighter }]} numberOfLines={1}>
                {typeLabel}
              </Text>
              {item.unitNumber ? (
                <>
                  <Text style={[styles.cardDot, { color: Colors.slateLighter }]}>·</Text>
                  <Text style={[styles.cardUnit, { color: Colors.slateLight }]}>
                    Unit {item.unitNumber}
                  </Text>
                </>
              ) : null}
              <Text style={[styles.cardDot, { color: Colors.slateLighter }]}>·</Text>
              <Text style={[styles.cardAge, { color: ageColor }]}>
                {timeAgo(item.createdAt)}
              </Text>
              {isOverdue ? (
                <View style={[styles.overdueChip, { backgroundColor: Colors.danger + '18', borderColor: Colors.danger + '40' }]}>
                  <Clock size={9} color={Colors.danger} />
                  <Text style={[styles.overdueText, { color: Colors.danger }]}>overdue</Text>
                </View>
              ) : null}
            </View>

            {/* Severity dots + assignee */}
            <View style={styles.cardFooter}>
              <SeverityDots severity={item.severity} />
              <Text style={[styles.severityLabel, { color: SEVERITY_HEX[item.severity] }]}>
                {INCIDENT_SEVERITY_LABELS[item.severity]}
              </Text>
              {item.assigneeName ? (
                <View style={styles.assigneeRow}>
                  <User size={11} color={Colors.slateLighter} />
                  <Text style={[styles.assigneeText, { color: Colors.slateLighter }]} numberOfLines={1}>
                    {item.assigneeName}
                  </Text>
                </View>
              ) : isStaff ? (
                <View style={[styles.unassignedChip, { backgroundColor: Colors.gold + '18', borderColor: Colors.gold + '35' }]}>
                  <Text style={[styles.unassignedText, { color: Colors.gold }]}>unassigned</Text>
                </View>
              ) : null}
              {item.commentCount > 0 ? (
                <View style={styles.commentCount}>
                  <MessageSquare size={11} color={Colors.slateLighter} />
                  <Text style={[styles.commentCountText, { color: Colors.slateLighter }]}>
                    {item.commentCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <ChevronRight
            size={15}
            color={Colors.slateLighter}
            style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded section */}
      {expanded ? (
        <View style={[styles.expandedSection, { borderTopColor: Colors.border }]}>
          {/* Description */}
          {item.description ? (
            <Text style={[styles.expandedDesc, { color: Colors.slateLight }]}>
              {item.description}
            </Text>
          ) : null}

          {/* Reporter */}
          <View style={styles.expandedMeta}>
            <Text style={[styles.expandedMetaLabel, { color: Colors.slateLighter }]}>Filed by</Text>
            <Text style={[styles.expandedMetaValue, { color: Colors.slateLight }]}>{item.reporterName}</Text>
          </View>

          {/* Escalation target */}
          {item.escalationTarget ? (
            <View style={[styles.escalationBanner, { backgroundColor: Colors.secondary + '12', borderColor: Colors.secondary + '35' }]}>
              <Zap size={13} color={Colors.secondary} />
              <Text style={[styles.escalationText, { color: Colors.secondary }]}>
                Escalated to {item.escalationTarget}
              </Text>
            </View>
          ) : null}

          {/* Resident update (visible note) */}
          {item.residentVisibleUpdate ? (
            <View style={[styles.residentUpdateBanner, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30' }]}>
              <Text style={[styles.residentUpdateText, { color: Colors.primary }]}>
                {item.residentVisibleUpdate}
              </Text>
            </View>
          ) : null}

          {/* Trend tags */}
          {item.trendTags.length > 0 ? (
            <View style={styles.trendTagRow}>
              <TrendingUp size={11} color={Colors.slateLighter} />
              {item.trendTags.map((tag) => (
                <View key={tag} style={[styles.trendTag, { backgroundColor: Colors.border }]}>
                  <Text style={[styles.trendTagText, { color: Colors.slateLight }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Staff action buttons */}
          {isStaff && nextSts.length > 0 && !isUpdating ? (
            <View style={styles.actionRow}>
              {nextSts.map((ns) => {
                const isTerminal = ns === 'resolved' || ns === 'closed';
                const isEscalate = ns === 'escalated';
                const accentColor = isTerminal
                  ? Colors.success
                  : isEscalate
                  ? Colors.secondary
                  : Colors.primary;
                const label =
                  ns === 'intake'        ? 'Start Review'
                  : ns === 'investigating' ? 'Investigate'
                  : ns === 'escalated'    ? 'Escalate'
                  : ns === 'resolved'     ? 'Resolve'
                  : ns === 'closed'       ? 'Close'
                  : INCIDENT_STATUS_LABELS[ns];
                return (
                  <TouchableOpacity
                    key={ns}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: accentColor + '14',
                        borderColor: accentColor + '45',
                        flex: nextSts.length > 2 ? 1 : undefined,
                      },
                    ]}
                    onPress={() => onUpdateStatus(item.id, ns)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.actionBtnText, { color: accentColor }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : isUpdating ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Filter tab item ──────────────────────────────────────────────────────────

function FilterTabItem({
  tab,
  isActive,
  count,
  onPress,
}: {
  tab: FilterTab;
  isActive: boolean;
  count?: number;
  onPress: () => void;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 55, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 90, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const accent = tab.key === 'escalated'
    ? Colors.secondary
    : tab.key === 'resolved'
    ? Colors.success
    : tab.key === 'closed'
    ? Colors.slateLighter
    : Colors.primary;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.View
        style={[
          styles.filterTab,
          {
            backgroundColor: isActive ? accent + '18' : Colors.surface,
            borderColor: isActive ? accent + '55' : Colors.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={[styles.filterTabText, { color: isActive ? accent : Colors.slateLight }]}>
          {tab.label}
        </Text>
        {count !== undefined && count > 0 ? (
          <View style={[styles.filterCount, { backgroundColor: accent }]}>
            <Text style={styles.filterCountText}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterKey }) {
  const Colors = useColors();
  const bounceAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -6, duration: 1300, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0,  duration: 1300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim]);

  const isEmpty = filter === 'all' || filter === 'open';
  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        {filter === 'resolved' || filter === 'closed' ? (
          <CheckCircle size={48} color={Colors.success} strokeWidth={1.5} />
        ) : (
          <AlertTriangle size={48} color={Colors.slateLighter} strokeWidth={1.5} />
        )}
      </Animated.View>
      <Text style={[styles.emptyText, { color: Colors.slateLight }]}>
        {filter === 'resolved' ? 'No resolved incidents yet'
          : filter === 'closed' ? 'No closed incidents'
          : filter === 'escalated' ? 'Nothing escalated — all good'
          : 'No incidents found'}
      </Text>
      {isEmpty ? (
        <Text style={[styles.emptyHint, { color: Colors.slateLighter }]}>
          Tap the + button to file an incident
        </Text>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function IncidentQueueScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, isOrgStaff, orgRole, updateIncidentStatus, isUpdatingIncidentStatus } =
    useOrganization();

  const [activeFilter, setActiveFilter] = useState<FilterKey>('open');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState<boolean>(false);

  const isManager = isOrgStaff;

  // ── Incidents query ────────────────────────────────────────────────────────
  const { data: incidents = [], isLoading } = useQuery<IncidentReport[]>({
    queryKey: ['org-incidents', activeOrg?.id, activeFilter],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_org_incidents', {
        p_org_id: activeOrg.id,
        p_status: activeFilter === 'all' ? null : activeFilter,
        p_severity: null,
        p_limit: 60,
        p_offset: 0,
      });
      if (error) return [];
      return ((data ?? []) as Record<string, unknown>[]).map(incidentRowToReport);
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 30,
  });

  // ── Incident counts (staff only) ──────────────────────────────────────────
  const { data: counts } = useQuery<IncidentCounts | null>({
    queryKey: ['org-incident-counts', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return null;
      const { data, error } = await supabase.rpc('get_incident_counts', {
        p_org_id: activeOrg.id,
      });
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return row as IncidentCounts;
    },
    enabled: !!activeOrg?.id && isManager,
    staleTime: 1000 * 60,
  });

  // ── Filter tab counts ─────────────────────────────────────────────────────
  const tabCounts = useMemo<Partial<Record<FilterKey, number>>>(() => {
    if (!counts) return {};
    return {
      open: counts.open_count,
      escalated: counts.escalated_count,
    };
  }, [counts]);

  // ── Client-side search filter ─────────────────────────────────────────────
  const filteredIncidents = useMemo(() => {
    if (!searchText.trim()) return incidents;
    const q = searchText.toLowerCase();
    return incidents.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.reporterName.toLowerCase().includes(q) ||
        (i.unitNumber && i.unitNumber.toLowerCase().includes(q)) ||
        INCIDENT_TYPE_LABELS[i.type].toLowerCase().includes(q)
    );
  }, [incidents, searchText]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['org-incidents', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-incident-counts', activeOrg?.id] }),
    ]);
    setRefreshing(false);
  }, [queryClient, activeOrg?.id]);

  // ── Status update ─────────────────────────────────────────────────────────
  const handleUpdateStatus = useCallback(
    (incidentId: string, newStatus: IncidentStatus) => {
      const needsResolution = newStatus === 'resolved' || newStatus === 'closed';
      const label =
        newStatus === 'intake'        ? 'Start Review'
        : newStatus === 'investigating' ? 'Move to Investigation'
        : newStatus === 'escalated'    ? 'Escalate'
        : newStatus === 'resolved'     ? 'Mark Resolved'
        : 'Close Incident';

      if (needsResolution) {
        Alert.alert(
          label,
          'Add a brief resolution note (optional):',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: label,
              onPress: async () => {
                setUpdatingId(incidentId);
                try {
                  await updateIncidentStatus({ incidentId, newStatus });
                } catch {
                  Alert.alert('Error', 'Could not update incident. Please try again.');
                } finally {
                  setUpdatingId(null);
                }
              },
            },
          ]
        );
        return;
      }

      Alert.alert(label, 'Update this incident status?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdatingId(incidentId);
            try {
              await updateIncidentStatus({ incidentId, newStatus });
            } catch {
              Alert.alert('Error', 'Could not update incident. Please try again.');
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]);
    },
    [updateIncidentStatus]
  );

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!activeOrg) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  const overdueCount   = counts?.overdue_count ?? 0;
  const escalatedCount = counts?.escalated_count ?? 0;
  const openCount      = counts?.open_count ?? 0;
  const unassigned     = counts?.unassigned_count ?? 0;

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
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Incident Queue</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg.name}
          </Text>
        </View>

        {/* Overdue warning pill */}
        {overdueCount > 0 ? (
          <View style={[styles.overduePill, { backgroundColor: Colors.danger + '18', borderColor: Colors.danger + '45' }]}>
            <Clock size={12} color={Colors.danger} />
            <Text style={[styles.overduePillText, { color: Colors.danger }]}>{overdueCount}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Summary metrics (staff only) ─────────────────────────────────── */}
      {isManager ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricsRow}
          style={[styles.metricsWrap, { backgroundColor: Colors.background }]}
        >
          <MetricCard
            label="Open"
            value={openCount}
            accent={Colors.primary}
            icon={<AlertTriangle size={16} color={Colors.primary} />}
            pulse={openCount > 0}
          />
          <MetricCard
            label="Escalated"
            value={escalatedCount}
            accent={Colors.secondary}
            icon={<Zap size={16} color={Colors.secondary} />}
            pulse={escalatedCount > 0}
          />
          <MetricCard
            label="Overdue"
            value={overdueCount}
            accent={Colors.danger}
            icon={<Clock size={16} color={Colors.danger} />}
            pulse={overdueCount > 0}
          />
          <MetricCard
            label="Unassigned"
            value={unassigned}
            accent={Colors.gold}
            icon={<User size={16} color={Colors.gold} />}
          />
        </ScrollView>
      ) : null}

      {/* ── Search bar ───────────────────────────────────────────────────────── */}
      <View style={[styles.searchWrap, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: Colors.background, borderColor: searchFocused ? Colors.primary + '60' : Colors.border }]}>
          <Search size={15} color={Colors.slateLighter} />
          <TextInput
            style={[styles.searchInput, { color: Colors.slate }]}
            placeholder="Search incidents…"
            placeholderTextColor={Colors.slateLighter}
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searchText.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={Colors.slateLighter} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Filter tabs ──────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={[styles.filtersWrap, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}
      >
        {FILTERS.map((tab) => (
          <FilterTabItem
            key={tab.key}
            tab={tab}
            isActive={activeFilter === tab.key}
            count={tabCounts[tab.key]}
            onPress={() => setActiveFilter(tab.key)}
          />
        ))}
      </ScrollView>

      {/* ── Incident list ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: Colors.slateLighter }]}>Loading incidents…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          {filteredIncidents.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            filteredIncidents.map((incident, i) => (
              <IncidentCard
                key={incident.id}
                item={incident}
                index={i}
                isStaff={isManager}
                onUpdateStatus={handleUpdateStatus}
                isUpdating={updatingId === incident.id && isUpdatingIncidentStatus}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── FAB ───────────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.fab,
          {
            bottom: insets.bottom + 24,
            backgroundColor: Colors.danger,
            shadowColor: Colors.danger,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.push('/file-incident')}
          style={styles.fabInner}
          activeOpacity={0.85}
        >
          <Plus size={20} color="#fff" strokeWidth={2.5} />
          <Text style={styles.fabLabel}>File Incident</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },

  overduePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  overduePillText: { fontSize: 12, fontWeight: '700' as const },

  // Metrics
  metricsWrap: { maxHeight: 110 },
  metricsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  metricCard: {
    width: 88,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  metricValue: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.5 },
  metricLabel: { fontSize: 10, fontWeight: '600' as const, textAlign: 'center' },

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  // Filters
  filtersWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  filtersRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabText: { fontSize: 13, fontWeight: '600' as const },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: { fontSize: 10, fontWeight: '800' as const, color: '#fff' },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  list: { paddingHorizontal: 16, paddingTop: 14 },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  typeEmoji: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeEmojiText: { fontSize: 20 },
  cardMain: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: '700' as const, flex: 1, lineHeight: 19 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' as const },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  cardType: { fontSize: 12 },
  cardDot: { fontSize: 12 },
  cardUnit: { fontSize: 12, fontWeight: '600' as const },
  cardAge: { fontSize: 12, fontWeight: '700' as const },
  overdueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  overdueText: { fontSize: 9, fontWeight: '700' as const },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityLabel: { fontSize: 11, fontWeight: '700' as const },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  assigneeText: { fontSize: 11, maxWidth: 90 },
  unassignedChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    marginLeft: 4,
  },
  unassignedText: { fontSize: 10, fontWeight: '600' as const },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4 },
  commentCountText: { fontSize: 11 },

  // Expanded
  expandedSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expandedDesc: { fontSize: 13, lineHeight: 19, marginBottom: 10, fontStyle: 'italic' },
  expandedMeta: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  expandedMetaLabel: { fontSize: 12 },
  expandedMetaValue: { fontSize: 12, fontWeight: '600' as const },
  escalationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  escalationText: { fontSize: 12, fontWeight: '600' as const, flex: 1 },
  residentUpdateBanner: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  residentUpdateText: { fontSize: 12, lineHeight: 17 },
  trendTagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  trendTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  trendTagText: { fontSize: 11 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' as const },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 14,
  },
  emptyText: { fontSize: 16, fontWeight: '600' as const },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
  },
  fabLabel: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },
});
