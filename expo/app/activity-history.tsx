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
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  UserCheck,
  Package,
  AlertTriangle,
  Megaphone,
  Building2,
  Hash,
  Shield,
  Settings,
  History,
  ChevronDown,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  type AuditLogEntry,
  type AuditEntityType,
  type AuditIconName,
  type AuditSummaryRow,
  type AuditFilterTab,
  auditRowToEntry,
  auditDisplay,
  auditEntityColor,
  AUDIT_FILTER_TABS,
  AUDIT_ENTITY_ICON,
} from '@/types/audit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

const PAGE_SIZE = 40;

// ─── Icon picker ──────────────────────────────────────────────────────────────

function AuditIcon({ name, color, size = 14 }: { name: AuditIconName; color: string; size?: number }) {
  const props = { size, color, strokeWidth: 2 };
  switch (name) {
    case 'UserCheck':    return <UserCheck {...props} />;
    case 'Package':      return <Package {...props} />;
    case 'AlertTriangle':return <AlertTriangle {...props} />;
    case 'Megaphone':    return <Megaphone {...props} />;
    case 'Building2':    return <Building2 {...props} />;
    case 'Hash':         return <Hash {...props} />;
    case 'Shield':       return <Shield {...props} />;
    case 'Settings':     return <Settings {...props} />;
    default:             return <History {...props} />;
  }
}

// ─── Actor initials bubble ────────────────────────────────────────────────────

function ActorBubble({ name, color }: { name: string; color: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  return (
    <View style={[s.actorBubble, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[s.actorBubbleText, { color }]}>{initials}</Text>
    </View>
  );
}

// ─── Single timeline entry ────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  isFirst,
  isLast,
  anim,
}: {
  entry: AuditLogEntry;
  isFirst: boolean;
  isLast: boolean;
  anim: Animated.Value;
}) {
  const Colors = useColors();
  const display = auditDisplay(entry);
  const iconName = AUDIT_ENTITY_ICON[entry.entityType] ?? 'History';

  return (
    <Animated.View
      style={[
        s.entryRow,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      {/* Timeline gutter */}
      <View style={s.gutter}>
        {!isFirst && <View style={[s.lineTop, { backgroundColor: Colors.border }]} />}
        <View style={[s.nodeBg, { backgroundColor: display.color + '18', borderColor: display.color + '40' }]}>
          <AuditIcon name={iconName as AuditIconName} color={display.color} size={13} />
        </View>
        {!isLast && <View style={[s.lineBottom, { backgroundColor: Colors.border }]} />}
      </View>

      {/* Content */}
      <View style={s.entryContent}>
        <View style={s.entryTopRow}>
          <ActorBubble name={entry.actorName} color={display.color} />
          <View style={s.entryTextBlock}>
            <View style={s.entryLine}>
              <Text style={[s.actorName, { color: Colors.slate }]} numberOfLines={1}>
                {entry.actorName}
              </Text>
              <Text style={[s.verbText, { color: Colors.slateLight }]}>{' '}{display.verb}</Text>
            </View>
            {display.entityChip ? (
              <View style={[s.entityChip, { backgroundColor: display.color + '14', borderColor: display.color + '30' }]}>
                <Text style={[s.entityChipText, { color: display.color }]} numberOfLines={1}>
                  {display.entityChip}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[s.timeText, { color: Colors.slateLighter }]}>{timeAgo(entry.createdAt)}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Day separator ────────────────────────────────────────────────────────────

function DaySeparator({ label }: { label: string }) {
  const Colors = useColors();
  return (
    <View style={s.daySepRow}>
      <View style={[s.daySepLine, { backgroundColor: Colors.border }]} />
      <View style={[s.daySepPill, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <Text style={[s.daySepText, { color: Colors.slateLighter }]}>{label}</Text>
      </View>
      <View style={[s.daySepLine, { backgroundColor: Colors.border }]} />
    </View>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  tab,
  active,
  count,
  onPress,
}: {
  tab: AuditFilterTab;
  active: boolean;
  count?: number;
  onPress: () => void;
}) {
  const Colors = useColors();
  const color = tab.entityType ? auditEntityColor(tab.entityType) : Colors.primary;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 60, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => onPress());
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress}>
      <Animated.View
        style={[
          s.filterChip,
          active
            ? { backgroundColor: color, borderColor: color }
            : { backgroundColor: Colors.surface, borderColor: Colors.border },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={[s.filterChipText, { color: active ? '#fff' : Colors.slateLight }]}>
          {tab.label}
        </Text>
        {count !== undefined && count > 0 ? (
          <View
            style={[
              s.filterBadge,
              { backgroundColor: active ? 'rgba(255,255,255,0.28)' : color + '20' },
            ]}
          >
            <Text style={[s.filterBadgeText, { color: active ? '#fff' : color }]}>{count}</Text>
          </View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ rows }: { rows: AuditSummaryRow[] }) {
  const Colors = useColors();
  if (rows.length === 0) return null;

  return (
    <View style={[s.summaryStrip, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <Text style={[s.summaryLabel, { color: Colors.slateLighter }]}>30-day activity</Text>
      <View style={s.summaryItems}>
        {rows.slice(0, 5).map((row) => {
          const color = auditEntityColor(row.entityType);
          return (
            <View key={row.entityType} style={s.summaryItem}>
              <View style={[s.summaryDot, { backgroundColor: color }]} />
              <Text style={[s.summaryCount, { color: Colors.slate }]}>{row.actionCount}</Text>
              <Text style={[s.summaryType, { color: Colors.slateLighter }]}>{row.entityType}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: string }) {
  const Colors = useColors();
  return (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIconCircle, { backgroundColor: Colors.primary + '12' }]}>
        <History size={28} color={Colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={[s.emptyTitle, { color: Colors.slate }]}>No activity yet</Text>
      <Text style={[s.emptyDesc, { color: Colors.slateLighter }]}>
        {filter === 'all'
          ? 'Community actions will appear here as members, packages, and incidents are managed.'
          : `No ${filter} events logged yet.`}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ActivityHistoryScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg } = useOrganization();

  const [activeFilter, setActiveFilter] = useState<AuditFilterTab>(AUDIT_FILTER_TABS[0]);
  const [page, setPage] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const entityType = activeFilter.entityType ?? undefined;

  // ── Audit log entries ──────────────────────────────────────────────────────
  const { data: rawEntries = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ['org-audit-log', activeOrg?.id, entityType, page],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_org_audit_log', {
        p_org_id: activeOrg.id,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_entity_type: entityType ?? null,
      });
      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map((r) =>
        auditRowToEntry(r, activeOrg.id)
      );
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 1,
  });

  // ── All pages merged ───────────────────────────────────────────────────────
  const [allEntries, setAllEntries] = useState<AuditLogEntry[]>([]);

  React.useEffect(() => {
    if (page === 0) {
      setAllEntries(rawEntries);
    } else {
      setAllEntries((prev) => {
        const ids = new Set(prev.map((e) => e.id));
        const fresh = rawEntries.filter((e) => !ids.has(e.id));
        return [...prev, ...fresh];
      });
    }
  }, [rawEntries, page]);

  React.useEffect(() => {
    // Reset to first page when filter changes
    setPage(0);
    setAllEntries([]);
  }, [activeFilter.id]);

  // ── 30-day summary ─────────────────────────────────────────────────────────
  const { data: summaryRaw = [] } = useQuery<AuditSummaryRow[]>({
    queryKey: ['org-audit-summary', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_org_audit_summary', {
        p_org_id: activeOrg.id,
      });
      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map((r) => ({
        entityType: r.entity_type as AuditEntityType,
        actionCount: (r.action_count as number) ?? 0,
        lastAction: r.last_action as string,
      }));
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 5,
  });

  // ── Count map for filter badges ────────────────────────────────────────────
  const countMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    summaryRaw.forEach((r) => { map[r.entityType] = r.actionCount; });
    return map;
  }, [summaryRaw]);

  // ── Stagger animations ─────────────────────────────────────────────────────
  const animValues = useRef<Animated.Value[]>([]);
  React.useEffect(() => {
    if (allEntries.length === 0) return;
    const needed = allEntries.length - animValues.current.length;
    if (needed <= 0) return;
    const newAnims = Array.from({ length: needed }, () => new Animated.Value(0));
    animValues.current = [...animValues.current, ...newAnims];
    Animated.stagger(
      35,
      newAnims.map((a) =>
        Animated.timing(a, { toValue: 1, duration: 320, useNativeDriver: true })
      )
    ).start();
  }, [allEntries.length]);

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    animValues.current = [];
    await queryClient.invalidateQueries({ queryKey: ['org-audit-log', activeOrg?.id] });
    await queryClient.invalidateQueries({ queryKey: ['org-audit-summary', activeOrg?.id] });
    setRefreshing(false);
  }, [queryClient, activeOrg?.id]);

  // ── Day-group the entries ──────────────────────────────────────────────────
  const grouped = useMemo<{ dayLabel: string; entries: { entry: AuditLogEntry; idx: number }[] }[]>(() => {
    const sections: { dayLabel: string; entries: { entry: AuditLogEntry; idx: number }[] }[] = [];
    allEntries.forEach((entry, idx) => {
      const label = dayLabel(entry.createdAt);
      const last = sections[sections.length - 1];
      if (!last || last.dayLabel !== label) {
        sections.push({ dayLabel: label, entries: [{ entry, idx }] });
      } else {
        last.entries.push({ entry, idx });
      }
    });
    return sections;
  }, [allEntries]);

  const hasMore = rawEntries.length === PAGE_SIZE;

  if (!activeOrg) {
    return (
      <View style={[s.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: Colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        style={[
          s.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: Colors.slate }]}>Activity</Text>
          <Text style={[s.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg.name} · Audit Log
          </Text>
        </View>
        <View style={[s.historyBadge, { backgroundColor: Colors.primary + '14', borderColor: Colors.primary + '30' }]}>
          <History size={13} color={Colors.primary} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Summary strip ──────────────────────────────────────────── */}
        {summaryRaw.length > 0 && <SummaryStrip rows={summaryRaw} />}

        {/* ── Filter chips ───────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
          style={s.filtersScroll}
        >
          {AUDIT_FILTER_TABS.map((tab) => (
            <FilterChip
              key={tab.id}
              tab={tab}
              active={activeFilter.id === tab.id}
              count={tab.entityType ? countMap[tab.entityType] : undefined}
              onPress={() => setActiveFilter(tab)}
            />
          ))}
        </ScrollView>

        {/* ── Loading state ──────────────────────────────────────────── */}
        {isLoading && allEntries.length === 0 ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={[s.loadingText, { color: Colors.slateLighter }]}>Loading activity…</Text>
          </View>
        ) : allEntries.length === 0 ? (
          <EmptyState filter={activeFilter.label.toLowerCase()} />
        ) : (
          <View style={s.timeline}>
            {grouped.map((section) => (
              <View key={section.dayLabel}>
                <DaySeparator label={section.dayLabel} />
                {section.entries.map(({ entry, idx }, sIdx) => {
                  const anim = animValues.current[idx] ?? new Animated.Value(1);
                  const isFirstInAll = idx === 0;
                  const isLastInAll = idx === allEntries.length - 1;
                  const isFirstInSection = sIdx === 0;
                  const isLastInSection = sIdx === section.entries.length - 1;
                  return (
                    <TimelineEntry
                      key={entry.id}
                      entry={entry}
                      isFirst={isFirstInAll || isFirstInSection}
                      isLast={isLastInAll || isLastInSection}
                      anim={anim}
                    />
                  );
                })}
              </View>
            ))}

            {/* ── Load more ───────────────────────────────────────────── */}
            {hasMore && (
              <TouchableOpacity
                style={[s.loadMoreBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}
                onPress={() => setPage((p) => p + 1)}
                activeOpacity={0.75}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <ChevronDown size={15} color={Colors.slateLight} strokeWidth={2} />
                    <Text style={[s.loadMoreText, { color: Colors.slateLight }]}>Load more</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GUTTER_W = 48;
const NODE_SIZE = 30;

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
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
  historyBadge: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // Summary strip
  summaryStrip: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryLabel: { fontSize: 11, fontWeight: '600' as const, marginBottom: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  summaryItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryDot: { width: 7, height: 7, borderRadius: 3.5 },
  summaryCount: { fontSize: 14, fontWeight: '700' as const },
  summaryType: { fontSize: 12 },

  // Filters
  filtersScroll: { marginTop: 14 },
  filtersRow: { paddingHorizontal: 20, gap: 8, paddingRight: 20 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontWeight: '600' as const },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700' as const },

  // Timeline
  timeline: { paddingHorizontal: 20, marginTop: 8 },

  // Day separator
  daySepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    marginLeft: GUTTER_W,
    gap: 8,
  },
  daySepLine: { flex: 1, height: StyleSheet.hairlineWidth },
  daySepPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  daySepText: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.2 },

  // Entry row
  entryRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },

  // Timeline gutter
  gutter: {
    width: GUTTER_W,
    alignItems: 'center',
    position: 'relative',
  },
  lineTop: {
    position: 'absolute',
    top: 0,
    bottom: '50%',
    width: 1,
    left: '50%',
    marginLeft: -0.5,
  },
  lineBottom: {
    position: 'absolute',
    top: '50%',
    bottom: -2,
    width: 1,
    left: '50%',
    marginLeft: -0.5,
  },
  nodeBg: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginVertical: 6,
  },

  // Entry content
  entryContent: {
    flex: 1,
    paddingBottom: 12,
    paddingTop: 5,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  actorBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  actorBubbleText: { fontSize: 9, fontWeight: '800' as const, letterSpacing: 0.2 },

  entryTextBlock: { flex: 1 },
  entryLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  actorName: { fontSize: 13, fontWeight: '700' as const },
  verbText: { fontSize: 13 },

  entityChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    maxWidth: 200,
  },
  entityChipText: { fontSize: 11, fontWeight: '600' as const },

  timeText: { fontSize: 11, marginTop: 3, flexShrink: 0 },

  // Load more
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginLeft: GUTTER_W,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  loadMoreText: { fontSize: 13, fontWeight: '600' as const },

  // Loading / empty
  loadingWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 14 },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3, textAlign: 'center' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
