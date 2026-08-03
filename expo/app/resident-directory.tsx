import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  Animated,
  Platform,
  RefreshControl,
  SectionListData,
  SectionListRenderItemInfo,
  DefaultSectionT,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Search,
  Phone,
  Mail,
  Users,
  X,
  ChevronRight,
  Building2,
  UserCheck,
  Star,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { warn } from '@/lib/logger';
import {
  OrgRole,
  ORG_ROLE_LABELS,
  STAFF_ROLES,
  DIRECTORY_STAFF_ROLES,
  ResidentDirectoryEntry,
  DirectoryRow,
  directoryRowToEntry,
  ADMIN_ROLES,
} from '@/types/organization';

// ─── Filter types ─────────────────────────────────────────────────────────────

type DirectoryFilter = 'all' | 'resident' | 'board' | 'staff';

const FILTER_LABELS: Record<DirectoryFilter, string> = {
  all: 'All',
  resident: 'Residents',
  board: 'Board',
  staff: 'Staff',
};

const BOARD_ROLES: OrgRole[] = ['board_member'];
const FILTER_ROLE_MAP: Record<DirectoryFilter, OrgRole[] | null> = {
  all: null,
  resident: ['resident'],
  board: ['board_member'],
  staff: STAFF_ROLES,
};

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchDirectory(orgId: string): Promise<ResidentDirectoryEntry[]> {
  const { data, error } = await supabase.rpc('get_org_directory', { p_org_id: orgId });
  if (error) {
    warn('[ResidentDirectory] RPC error:', error.code);
    return [];
  }
  return ((data ?? []) as DirectoryRow[]).map(directoryRowToEntry);
}

// ─── Section grouping ─────────────────────────────────────────────────────────

interface DirectorySection {
  title: string;
  data: ResidentDirectoryEntry[];
}

function buildSections(entries: ResidentDirectoryEntry[]): DirectorySection[] {
  const grouped: Record<string, ResidentDirectoryEntry[]> = {};
  for (const entry of entries) {
    const letter = entry.sectionLetter;
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(entry);
  }
  return Object.keys(grouped)
    .sort()
    .map((letter) => ({ title: letter, data: grouped[letter] }));
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  initials,
  color,
  avatarUrl,
  size = 44,
}: {
  initials: string;
  color: string;
  avatarUrl: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    );
  }
  return (
    <View
      style={[
        avatarStyles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '28' },
      ]}
    >
      <Text style={[avatarStyles.text, { color, fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' as const, letterSpacing: 0.5 },
});

// ─── Role chip ────────────────────────────────────────────────────────────────

function RoleChip({ role, compact = false }: { role: OrgRole; compact?: boolean }) {
  const Colors = useColors();
  const isAdmin = ADMIN_ROLES.includes(role);
  const isStaff = STAFF_ROLES.includes(role) && !isAdmin;
  const isBoard = BOARD_ROLES.includes(role);

  const color = isAdmin
    ? Colors.primary
    : isStaff
    ? Colors.secondary
    : isBoard
    ? Colors.gold
    : Colors.slateLighter;

  return (
    <View
      style={[
        chipStyles.chip,
        {
          backgroundColor: color + '18',
          borderColor: color + '44',
          paddingHorizontal: compact ? 6 : 8,
          paddingVertical: compact ? 2 : 3,
        },
      ]}
    >
      {!compact && <Star size={9} color={color} />}
      <Text style={[chipStyles.label, { color, fontSize: compact ? 10 : 11 }]}>
        {ORG_ROLE_LABELS[role]}
      </Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: { fontWeight: '700' as const },
});

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({
  entry,
  canContact,
  animDelay,
}: {
  entry: ResidentDirectoryEntry;
  canContact: boolean;
  animDelay: number;
}) {
  const Colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        delay: animDelay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay: animDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, animDelay]);

  const handlePressIn = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [pressAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [pressAnim]);

  const handleCall = useCallback(() => {
    if (entry.phone) void Linking.openURL(`tel:${entry.phone}`).catch(() => Alert.alert('Error', 'Could not open the phone app.'));
  }, [entry.phone]);

  const handleEmail = useCallback(() => {
    if (entry.email) void Linking.openURL(`mailto:${entry.email}`).catch(() => Alert.alert('Error', 'Could not open the email app.'));
  }, [entry.email]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: pressAnim }],
      }}
    >
      <TouchableOpacity
        style={[
          cardStyles.card,
          { backgroundColor: Colors.surface, borderColor: Colors.border },
        ]}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Avatar
          initials={entry.initials}
          color={entry.avatarColor}
          avatarUrl={entry.avatarUrl}
          size={46}
        />

        <View style={cardStyles.info}>
          <Text style={[cardStyles.name, { color: Colors.slate }]} numberOfLines={1}>
            {entry.displayName}
          </Text>
          <View style={cardStyles.metaRow}>
            {entry.unitNumber ? (
              <Text style={[cardStyles.unit, { color: Colors.slateLighter }]}>
                Unit {entry.unitNumber}
              </Text>
            ) : null}
            <RoleChip role={entry.role} compact />
          </View>
        </View>

        {/* Contact actions — staff/admin only, and only when info exists */}
        {canContact ? (
          <View style={cardStyles.actions}>
            {entry.phone ? (
              <TouchableOpacity
                style={[cardStyles.actionBtn, { backgroundColor: Colors.primary + '14' }]}
                onPress={handleCall}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Phone size={15} color={Colors.primary} />
              </TouchableOpacity>
            ) : null}
            {entry.email ? (
              <TouchableOpacity
                style={[cardStyles.actionBtn, { backgroundColor: Colors.secondary + '14' }]}
                onPress={handleEmail}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Mail size={15} color={Colors.secondary} />
              </TouchableOpacity>
            ) : null}
            {!entry.phone && !entry.email ? (
              <ChevronRight size={16} color={Colors.slateLighter} />
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' as const, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unit: { fontSize: 12, fontWeight: '500' as const },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const Colors = useColors();
  return (
    <Text style={[sectionStyles.letter, { color: Colors.slateLighter, backgroundColor: Colors.background }]}>
      {title}
    </Text>
  );
}

const sectionStyles = StyleSheet.create({
  letter: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    paddingVertical: 6,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
});

// ─── Filter chips bar ─────────────────────────────────────────────────────────

function FilterBar({
  active,
  onSelect,
  counts,
}: {
  active: DirectoryFilter;
  onSelect: (f: DirectoryFilter) => void;
  counts: Record<DirectoryFilter, number>;
}) {
  const Colors = useColors();

  return (
    <View style={filterStyles.bar}>
      {(Object.keys(FILTER_LABELS) as DirectoryFilter[]).map((f) => {
        const isActive = active === f;
        return (
          <TouchableOpacity
            key={f}
            style={[
              filterStyles.chip,
              {
                backgroundColor: isActive ? Colors.primary : Colors.surface,
                borderColor: isActive ? Colors.primary : Colors.border,
              },
            ]}
            onPress={() => onSelect(f)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                filterStyles.label,
                { color: isActive ? '#fff' : Colors.slateLight },
              ]}
            >
              {FILTER_LABELS[f]}
            </Text>
            {counts[f] > 0 ? (
              <View
                style={[
                  filterStyles.badge,
                  { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : Colors.elevated },
                ]}
              >
                <Text
                  style={[
                    filterStyles.badgeText,
                    { color: isActive ? '#fff' : Colors.slateLighter },
                  ]}
                >
                  {counts[f]}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const filterStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: '600' as const },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700' as const },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ query, filter }: { query: string; filter: DirectoryFilter }) {
  const Colors = useColors();
  const isFiltered = filter !== 'all';
  const hasQuery = query.length > 0;

  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: Colors.elevated }]}>
        <Users size={32} color={Colors.slateLighter} strokeWidth={1.5} />
      </View>
      <Text style={[emptyStyles.title, { color: Colors.slateLight }]}>
        {hasQuery ? 'No results found' : isFiltered ? 'No members in this category' : 'No members yet'}
      </Text>
      <Text style={[emptyStyles.desc, { color: Colors.slateLighter }]}>
        {hasQuery
          ? `No members match "${query}"`
          : isFiltered
          ? 'Try a different filter to see more members.'
          : 'Members will appear here once they join the community.'}
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  iconWrap: { padding: 20, borderRadius: 40, marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700' as const, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ResidentDirectoryScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, orgRole, isOrgMember } = useOrganization();
  const orgId = activeOrg?.id ?? null;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<DirectoryFilter>('all');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const searchRef = useRef<TextInput>(null);

  // Role gates
  const canContact =
    !!orgRole && DIRECTORY_STAFF_ROLES.includes(orgRole as (typeof DIRECTORY_STAFF_ROLES)[number]);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: allEntries = [], isLoading } = useQuery<ResidentDirectoryEntry[]>({
    queryKey: ['org-directory', orgId],
    queryFn: () => fetchDirectory(orgId!),
    enabled: !!orgId && isOrgMember,
    staleTime: 1000 * 60 * 2,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['org-directory', orgId] });
    setRefreshing(false);
  }, [queryClient, orgId]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo<ResidentDirectoryEntry[]>(() => {
    let result = allEntries;

    // Apply role filter
    const roleFilter = FILTER_ROLE_MAP[activeFilter];
    if (roleFilter) {
      result = result.filter((e) => roleFilter.includes(e.role));
    }

    // Apply search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.displayName.toLowerCase().includes(q) ||
          (e.unitNumber?.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [allEntries, activeFilter, searchQuery]);

  const sections = useMemo<DirectorySection[]>(() => buildSections(filtered), [filtered]);

  // Filter counts (based on all entries, not search-filtered, so chips always show context)
  const filterCounts = useMemo<Record<DirectoryFilter, number>>(() => {
    return {
      all: allEntries.length,
      resident: allEntries.filter((e) => e.role === 'resident').length,
      board: allEntries.filter((e) => BOARD_ROLES.includes(e.role)).length,
      staff: allEntries.filter((e) => STAFF_ROLES.includes(e.role)).length,
    };
  }, [allEntries]);

  // ── Render item ────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({
      item,
      index,
    }: SectionListRenderItemInfo<ResidentDirectoryEntry, DefaultSectionT>) => (
      <MemberCard
        entry={item}
        canContact={canContact}
        animDelay={Math.min(index * 30, 300)}
      />
    ),
    [canContact]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<ResidentDirectoryEntry, DirectorySection> }) => (
      <SectionHeader title={section.title} />
    ),
    []
  );

  const keyExtractor = useCallback((item: ResidentDirectoryEntry) => item.membershipId, []);

  // ── Guard: not an org member ───────────────────────────────────────────────
  if (!isOrgMember || !activeOrg) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 4),
              backgroundColor: Colors.surface,
              borderBottomColor: Colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Directory</Text>
        </View>
        <View style={styles.guardContainer}>
          <Building2 size={40} color={Colors.slateLighter} strokeWidth={1.5} />
          <Text style={[styles.guardText, { color: Colors.slateLight }]}>
            Join a community to access the directory.
          </Text>
        </View>
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
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 4),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Resident Directory</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]} numberOfLines={1}>
            {activeOrg.name}
          </Text>
        </View>

        {/* Staff indicator */}
        {canContact ? (
          <View style={[styles.staffBadge, { backgroundColor: Colors.primary + '16', borderColor: Colors.primary + '40' }]}>
            <UserCheck size={13} color={Colors.primary} />
            <Text style={[styles.staffBadgeText, { color: Colors.primary }]}>Staff</Text>
          </View>
        ) : null}
      </View>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: Colors.surface, borderBottomColor: Colors.border },
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}>
          <Search size={16} color={Colors.slateLighter} />
          <TextInput
            ref={searchRef}
            style={[styles.searchInput, { color: Colors.slate }]}
            placeholder="Search by name or unit…"
            placeholderTextColor={Colors.slateLighter}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color={Colors.slateLighter} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Filter chips ───────────────────────────────────────────────────── */}
      <FilterBar active={activeFilter} onSelect={setActiveFilter} counts={filterCounts} />

      {/* ── Member count line ──────────────────────────────────────────────── */}
      {!isLoading && allEntries.length > 0 ? (
        <Text style={[styles.memberCount, { color: Colors.slateLighter }]}>
          {filtered.length === allEntries.length
            ? `${allEntries.length} member${allEntries.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${allEntries.length} member${allEntries.length !== 1 ? 's' : ''}`}
        </Text>
      ) : null}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <EmptyState query={searchQuery} filter={activeFilter} />
      ) : (
        <SectionList<ResidentDirectoryEntry, DirectorySection>
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          // Perf
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={10}
        />
      )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  staffBadgeText: { fontSize: 11, fontWeight: '700' as const },

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
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },

  memberCount: {
    fontSize: 12,
    fontWeight: '600' as const,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  guardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  guardText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
