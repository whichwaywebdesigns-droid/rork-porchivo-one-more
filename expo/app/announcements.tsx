import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
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
  Dimensions,
  FlatList,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Megaphone,
  Plus,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import {
  OrgAnnouncement,
  AnnouncementPriority,
  AnnouncementCategory,
  resolveDisplayBody,
} from '@/types/organization';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  AnnouncementPriority,
  { color: string; label: string }
> = {
  low:    { color: '#6B7F99', label: 'Low' },
  normal: { color: '#3A7BD5', label: 'Normal' },
  high:   { color: '#E07B00', label: 'High' },
  urgent: { color: '#D94040', label: 'Urgent' },
};

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<AnnouncementCategory, { icon: string; label: string }> = {
  general:     { icon: '📣', label: 'General' },
  package:     { icon: '📦', label: 'Package' },
  maintenance: { icon: '🔧', label: 'Maintenance' },
  safety:      { icon: '🛡️', label: 'Safety' },
  meeting:     { icon: '📅', label: 'Meeting' },
  parking:     { icon: '🚗', label: 'Parking' },
  amenity:     { icon: '🏊', label: 'Amenity' },
  emergency:   { icon: '🚨', label: 'Emergency' },
};

// ─── Filter ───────────────────────────────────────────────────────────────────

type Filter = 'all' | 'pinned' | 'urgent' | 'scheduled';

const FILTER_LABELS: Record<Filter, string> = {
  all:       'All',
  pinned:    'Pinned',
  urgent:    'Urgent',
  scheduled: 'Scheduled',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    hour:  'numeric',
    minute: '2-digit',
  });
}

function isFutureScheduled(a: OrgAnnouncement): boolean {
  return !!a.scheduledAt && new Date(a.scheduledAt) > new Date();
}

// ─── Urgent Ticker ────────────────────────────────────────────────────────────

function UrgentTicker({ items }: { items: OrgAnnouncement[] }) {
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const textContent = items.map((a) => `⚠ ${a.title}`).join('  ·  ');

  useEffect(() => {
    if (!textContent) return;
    const approxTextPx = textContent.length * 8;
    const totalDist = SCREEN_WIDTH + approxTextPx;
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -approxTextPx,
        duration: totalDist * 22,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [textContent, translateX]);

  if (items.length === 0) return null;

  return (
    <View style={tickerS.root}>
      <View style={tickerS.badge}>
        <Text style={tickerS.badgeText}>URGENT</Text>
      </View>
      <View style={tickerS.marquee}>
        <Animated.Text
          style={[tickerS.text, { transform: [{ translateX }] }]}
          numberOfLines={1}
        >
          {textContent}{'  ·  '}{textContent}
        </Animated.Text>
      </View>
    </View>
  );
}

const tickerS = StyleSheet.create({
  root: {
    backgroundColor: '#D94040',
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    overflow: 'hidden',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.6,
  },
  marquee: { flex: 1, overflow: 'hidden' },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
    paddingLeft: 14,
  },
});

// ─── Announcement Card ────────────────────────────────────────────────────────

interface CardProps {
  item: OrgAnnouncement;
  index: number;
}

function AnnouncementCard({ item, index }: CardProps) {
  const Colors = useColors();
  const [expanded, setExpanded] = useState<boolean>(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  const pCfg   = PRIORITY_CONFIG[item.priority];
  const cCfg   = CATEGORY_CONFIG[item.category];
  const future = isFutureScheduled(item);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue:  1,
        duration: 320,
        delay:    index * 55,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue:  0,
        duration: 320,
        delay:    index * 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const onPressIn = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 0.972, useNativeDriver: true }).start();
  }, [pressAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [pressAnim]);

  const borderAccent = future ? '#A0AEC0' : pCfg.color;

  return (
    <Animated.View
      style={{
        opacity:   fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: pressAnim }],
        marginBottom: 10,
      }}
    >
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => setExpanded((v) => !v)}
      >
        <View
          style={[
            cardS.card,
            {
              backgroundColor:  Colors.surface,
              borderColor:      Colors.border,
              borderLeftColor:  borderAccent,
            },
          ]}
        >
          {/* Top meta row */}
          <View style={cardS.topRow}>
            <View style={cardS.metaLeft}>
              <Text style={cardS.catEmoji}>{cCfg.icon}</Text>
              <Text style={[cardS.catLabel, { color: Colors.slateLighter }]}>
                {cCfg.label.toUpperCase()}
              </Text>
              {item.isPinned ? (
                <View style={[cardS.pinPill, { backgroundColor: Colors.gold + '22' }]}>
                  <Text style={[cardS.pinText, { color: Colors.gold }]}>📌 Pinned</Text>
                </View>
              ) : null}
            </View>
            <View
              style={[
                cardS.priorityPill,
                { backgroundColor: borderAccent + '1A' },
              ]}
            >
              <View
                style={[cardS.priorityDot, { backgroundColor: borderAccent }]}
              />
              <Text style={[cardS.priorityText, { color: borderAccent }]}>
                {future ? 'Scheduled' : pCfg.label}
              </Text>
            </View>
          </View>

          {/* Scheduled banner */}
          {future ? (
            <View
              style={[cardS.scheduledBanner, { backgroundColor: Colors.elevated }]}
            >
              <Clock size={11} color={Colors.slateLighter} />
              <Text style={[cardS.scheduledText, { color: Colors.slateLighter }]}>
                Publishes {formatScheduledDate(item.scheduledAt!)}
              </Text>
            </View>
          ) : null}

          {/* Title */}
          <Text
            style={[
              cardS.title,
              { color: Colors.slate, opacity: future ? 0.55 : 1 },
            ]}
          >
            {item.title}
          </Text>

          {/* Body — uses variation resolver when phrase rotation is active */}
          <Text
            style={[cardS.body, { color: Colors.slateLight }]}
            numberOfLines={expanded ? undefined : 2}
          >
            {resolveDisplayBody(item)}
          </Text>

          {/* Footer */}
          <View style={cardS.footer}>
            <Text style={[cardS.footerMeta, { color: Colors.slateLighter }]}>
              {item.authorDisplayName ? `${item.authorDisplayName}  ·  ` : ''}
              {formatTime(item.createdAt)}
            </Text>
            <View style={cardS.footerRight}>
              {item.bodyVariations && item.bodyVariations.length > 0 ? (
                <View style={[cardS.rotatingBadge, { backgroundColor: Colors.primary + '14' }]}>
                  <Text style={[cardS.rotatingText, { color: Colors.primary }]}>↻</Text>
                </View>
              ) : null}
              {item.viewCount > 0 ? (
                <Text style={[cardS.views, { color: Colors.slateLighter }]}>
                  {item.viewCount} views
                </Text>
              ) : null}
              {expanded ? (
                <ChevronUp size={14} color={Colors.slateLighter} />
              ) : (
                <ChevronDown size={14} color={Colors.slateLighter} />
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const cardS = StyleSheet.create({
  card: {
    borderRadius:     14,
    borderWidth:      1,
    borderLeftWidth:  4,
    padding:          16,
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flex:          1,
  },
  catEmoji:  { fontSize: 14 },
  catLabel:  {
    fontSize:      10,
    fontWeight:    '700' as const,
    letterSpacing: 0.9,
  },
  pinPill: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      6,
    marginLeft:        4,
  },
  pinText:  { fontSize: 10, fontWeight: '700' as const },
  priorityPill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:    8,
  },
  priorityDot:  { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 11, fontWeight: '700' as const },
  scheduledBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:    6,
    marginBottom:    8,
    alignSelf:       'flex-start',
  },
  scheduledText: { fontSize: 11, fontWeight: '600' as const },
  title: {
    fontSize:     16,
    fontWeight:   '700' as const,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  footerMeta:  { fontSize: 11 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  views:       { fontSize: 11 },
  rotatingBadge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  rotatingText: { fontSize: 11, fontWeight: '700' as const },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnnouncementsScreen() {
  const Colors  = useColors();
  const insets  = useSafeAreaInsets();
  const {
    announcements,
    isAnnouncementsLoading,
    refreshOrgContext,
    canPostAnnouncements,
  } = useOrganization();

  const [filter, setFilter]     = useState<Filter>('all');
  const [refreshing, setRefresh] = useState<boolean>(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  const filters: Filter[] = [
    'all',
    'pinned',
    'urgent',
    ...(canPostAnnouncements ? (['scheduled'] as Filter[]) : []),
  ];

  const filtered = useMemo<OrgAnnouncement[]>(() => {
    switch (filter) {
      case 'pinned':    return announcements.filter((a) => a.isPinned);
      case 'urgent':    return announcements.filter((a) => a.priority === 'urgent' || a.priority === 'high');
      case 'scheduled': return announcements.filter((a) => isFutureScheduled(a));
      default:          return announcements;
    }
  }, [announcements, filter]);

  const urgentItems = useMemo(
    () => announcements.filter((a) => a.priority === 'urgent' && !isFutureScheduled(a)),
    [announcements]
  );

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: 1,
      delay:   450,
      useNativeDriver: true,
    }).start();
  }, [fabAnim]);

  const handleRefresh = useCallback(async () => {
    setRefresh(true);
    await refreshOrgContext();
    setRefresh(false);
  }, [refreshOrgContext]);

  return (
    <View style={[S.root, { backgroundColor: Colors.background }]}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        style={[
          S.header,
          {
            paddingTop:       insets.top + (Platform.OS === 'android' ? 8 : 0),
            backgroundColor:  Colors.surface,
            borderBottomColor: Colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={S.headerSide}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>

        <View style={S.headerCenter}>
          <Megaphone size={18} color={Colors.secondary} />
          <Text style={[S.headerTitle, { color: Colors.slate }]}>
            Announcements
          </Text>
        </View>

        {canPostAnnouncements ? (
          <TouchableOpacity
            onPress={() => router.push('/post-announcement')}
            style={[S.postBtn, { backgroundColor: Colors.primary }]}
            activeOpacity={0.85}
          >
            <Plus size={15} color="#fff" />
            <Text style={S.postBtnText}>Post</Text>
          </TouchableOpacity>
        ) : (
          <View style={S.headerSide} />
        )}
      </View>

      {/* ── Urgent ticker ──────────────────────────────────────────────── */}
      <UrgentTicker items={urgentItems} />

      {/* ── Filter chips ───────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.filterRow}
        style={[S.filterBar, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}
      >
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
            style={[
              S.chip,
              {
                backgroundColor: filter === f ? Colors.primary : Colors.elevated,
                borderColor:     filter === f ? Colors.primary : Colors.border,
              },
            ]}
          >
            <Text style={[S.chipText, { color: filter === f ? '#fff' : Colors.slateLight }]}>
              {FILTER_LABELS[f]}
            </Text>
            {f === 'urgent' && urgentItems.length > 0 ? (
              <View style={[S.chipBadge, { backgroundColor: '#D94040' }]}>
                <Text style={S.chipBadgeText}>{urgentItems.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {isAnnouncementsLoading ? (
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList<OrgAnnouncement>
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[S.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={S.emptyWrap}>
              <Text style={S.emptyEmoji}>
                {filter === 'pinned'    ? '📌'
                : filter === 'urgent'   ? '✅'
                : filter === 'scheduled'? '🗓️'
                :                        '📣'}
              </Text>
              <Text style={[S.emptyTitle, { color: Colors.slate }]}>
                {filter === 'all'
                  ? 'No announcements yet'
                  : `No ${FILTER_LABELS[filter].toLowerCase()} announcements`}
              </Text>
              <Text style={[S.emptyDesc, { color: Colors.slateLighter }]}>
                {filter === 'all' && canPostAnnouncements
                  ? 'Be the first to post a community update.'
                  : filter === 'all'
                  ? 'Your board or property staff will post updates here.'
                  : 'Switch to All to see every announcement.'}
              </Text>
              {filter === 'all' && canPostAnnouncements ? (
                <TouchableOpacity
                  onPress={() => router.push('/post-announcement')}
                  style={[S.emptyAction, { backgroundColor: Colors.primary }]}
                  activeOpacity={0.85}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={S.emptyActionText}>Post First Announcement</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => (
            <AnnouncementCard item={item} index={index} />
          )}
        />
      )}

      {/* ── Floating action button ─────────────────────────────────────── */}
      {canPostAnnouncements && filtered.length > 0 ? (
        <Animated.View
          style={[
            S.fab,
            {
              bottom:          insets.bottom + 24,
              backgroundColor: Colors.primary,
              transform:       [{ scale: fabAnim }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.push('/post-announcement')}
            style={S.fabInner}
            activeOpacity={0.85}
          >
            <Plus size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingBottom:     14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               8,
  },
  headerSide:   { width: 40 },
  headerCenter: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
  postBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      10,
  },
  postBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' as const },

  filterBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               8,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      20,
    borderWidth:       1,
  },
  chipText:      { fontSize: 13, fontWeight: '600' as const },
  chipBadge: {
    width:          16,
    height:         16,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  chipBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' as const },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:        { paddingHorizontal: 16, paddingTop: 16 },

  emptyWrap: {
    alignItems:        'center',
    paddingTop:        72,
    paddingHorizontal: 32,
  },
  emptyEmoji:      { fontSize: 52, marginBottom: 16 },
  emptyTitle:      { fontSize: 20, fontWeight: '700' as const, marginBottom: 8, textAlign: 'center' },
  emptyDesc:       { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyAction: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderRadius:      12,
  },
  emptyActionText: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },

  fab: {
    position:     'absolute' as const,
    right:        20,
    width:        56,
    height:       56,
    borderRadius: 28,
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation:    8,
  },
  fabInner: {
    width:          56,
    height:         56,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
