import React, { useCallback, useRef, useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Package,
  Users,
  Megaphone,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  ShieldCheck,
  ChevronRight,
  LayoutGrid,
  X,
  Check,
  TrendingUp,
  Building2,
  BarChart2,
  CalendarDays,
  Wrench,
  LifeBuoy,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { BillingGraceBanner } from '@/components/BillingGraceBanner';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import {
  AdminDashboardStats,
  PendingMember,
  ORG_TYPE_LABELS,
  avatarColorForId,
  initialsForName,
} from '@/types/organization';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  accent,
  sublabel,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
  sublabel?: string;
  pulse?: boolean;
}) {
  const Colors = useColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!pulse || value === 0 || value === '0') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, value, pulseAnim]);

  return (
    <View style={[styles.statTile, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <Animated.View
        style={[
          styles.statIconWrap,
          { backgroundColor: accent + '1A' },
          pulse && value !== 0 ? { transform: [{ scale: pulseAnim }] } : undefined,
        ]}
      >
        {icon}
      </Animated.View>
      <Text style={[styles.statValue, { color: Colors.slate }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: Colors.slateLighter }]}>{label}</Text>
      {sublabel ? (
        <Text style={[styles.statSublabel, { color: accent }]}>{sublabel}</Text>
      ) : null}
    </View>
  );
}

// ─── Avatar bubble ─────────────────────────────────────────────────────────────

function AvatarBubble({ initials, color, avatarUrl, size = 40 }: { initials: string; color: string; avatarUrl?: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color + '55',
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '28',
        borderWidth: 1.5,
        borderColor: color + '55',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.35, fontWeight: '700' as const, color }}>{initials}</Text>
    </View>
  );
}

// ─── Pending Member Row ────────────────────────────────────────────────────────

function PendingMemberRow({
  member,
  onApprove,
  onDeny,
  isLoading,
}: {
  member: PendingMember;
  onApprove: () => void;
  onDeny: () => void;
  isLoading: boolean;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = (cb: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    cb();
  };

  return (
    <Animated.View
      style={[
        styles.pendingRow,
        { backgroundColor: Colors.surface, borderColor: Colors.border },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <AvatarBubble
        initials={member.initials}
        color={member.avatarColor}
        avatarUrl={member.avatar_url}
      />
      <View style={styles.pendingInfo}>
        <Text style={[styles.pendingName, { color: Colors.slate }]} numberOfLines={1}>
          {member.display_name}
        </Text>
        <Text style={[styles.pendingMeta, { color: Colors.slateLighter }]}>
          {member.unit_number ? `Unit ${member.unit_number} · ` : ''}{timeAgo(member.created_at)}
        </Text>
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <View style={styles.pendingActions}>
          <TouchableOpacity
            style={[styles.actionIconBtn, { backgroundColor: Colors.danger + '14', borderColor: Colors.danger + '40' }]}
            onPress={() => handlePress(onDeny)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={15} color={Colors.danger} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionIconBtn, { backgroundColor: Colors.success + '14', borderColor: Colors.success + '40' }]}
            onPress={() => handlePress(onApprove)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Check size={15} color={Colors.success} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const Colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: Colors.slate }]}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[styles.sectionAction, { color: Colors.primary }]}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Quick action pill ─────────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  accent,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  onPress?: () => void;
}) {
  const Colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(() => onPress?.());
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress}>
      <Animated.View
        style={[
          styles.quickAction,
          { backgroundColor: Colors.surface, borderColor: Colors.border },
          { transform: [{ scale }] },
        ]}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: accent + '1A' }]}>{icon}</View>
        <Text style={[styles.quickActionLabel, { color: Colors.slateLight }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminDashboardScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    activeOrg,
    activeMembership,
    orgRole,
    packageLog,
    announcements,
    approveMembership,
    isApprovingMembership,
    denyMembership,
    isDenyingMembership,
  } = useOrganization();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ── Dashboard stats ────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<AdminDashboardStats | null>({
    queryKey: ['org-admin-stats', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return null;
      const { data, error } = await supabase.rpc('get_admin_dashboard_stats', {
        p_org_id: activeOrg.id,
      });
      if (error) return null;
      return data as AdminDashboardStats;
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 2,
  });

  // ── Pending members ────────────────────────────────────────────────────────
  const { data: pendingMembers = [], isLoading: pendingLoading } = useQuery<PendingMember[]>({
    queryKey: ['org-pending-members', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const { data, error } = await supabase.rpc('get_pending_members', {
        p_org_id: activeOrg.id,
      });
      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map((row) => ({
        membership_id: row.membership_id as string,
        user_id: row.user_id as string,
        display_name: (row.display_name as string) ?? 'Unknown',
        avatar_url: (row.avatar_url as string | null) ?? null,
        unit_number: (row.unit_number as string | null) ?? null,
        created_at: row.created_at as string,
        notes: (row.notes as string | null) ?? null,
        initials: initialsForName((row.display_name as string) ?? 'Unknown'),
        avatarColor: avatarColorForId(row.user_id as string),
      }));
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 1,
  });

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['org-admin-stats', activeOrg?.id] }),
      queryClient.invalidateQueries({ queryKey: ['org-pending-members', activeOrg?.id] }),
    ]);
    setRefreshing(false);
  }, [queryClient, activeOrg?.id]);

  // ── Approve / deny ────────────────────────────────────────────────────────
  const handleApprove = useCallback(
    (membershipId: string) => {
      Alert.alert('Approve Member', 'Grant this person active membership?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setProcessingId(membershipId);
            try {
              await approveMembership({ membershipId });
            } catch {
              Alert.alert('Error', 'Could not approve membership. Please try again.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]);
    },
    [approveMembership]
  );

  const handleDeny = useCallback(
    (membershipId: string) => {
      Alert.alert('Decline Request', 'Remove this membership request?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(membershipId);
            try {
              await denyMembership({ membershipId });
            } catch {
              Alert.alert('Error', 'Could not decline request. Please try again.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]);
    },
    [denyMembership]
  );

  // ── Guard: only admins/staff ───────────────────────────────────────────────
  if (!activeOrg || !activeMembership) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  const typeLabel = ORG_TYPE_LABELS[activeOrg.type];
  const pendingCount = stats?.pending_members ?? pendingMembers.length;
  const packagesNeedingAction =
    (stats?.packages_received ?? 0) + (stats?.packages_ready ?? 0) + (stats?.packages_exception ?? 0);

  // Package rows — most recent 4
  const recentPackages = packageLog.slice(0, 4);

  // Status dot color
  const pkgStatusColor = (status: string): string => {
    switch (status) {
      case 'received': return Colors.secondary;
      case 'ready_for_pickup': return Colors.primary;
      case 'picked_up': return Colors.success;
      case 'exception': return Colors.danger;
      default: return Colors.slateLighter;
    }
  };

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
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Admin Dashboard</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg.name} · {typeLabel}
          </Text>
        </View>

        {/* Role chip */}
        <View style={[styles.roleChip, { backgroundColor: Colors.primary + '14', borderColor: Colors.primary + '40' }]}>
          <Shield size={11} color={Colors.primary} />
          <Text style={[styles.roleChipText, { color: Colors.primary }]}>
            {orgRole === 'super_admin' ? 'Super' : orgRole === 'hoa_admin' ? 'Admin' : 'Staff'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Billing grace banner (manager-only, persistent, non-blocking) ── */}
        <BillingGraceBanner />

        {/* ── Stats grid ─────────────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          {statsLoading ? (
            <View style={styles.statsLoader}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <>
              <StatTile
                icon={<Users size={18} color={Colors.primary} />}
                label="Members"
                value={stats?.total_members ?? 0}
                accent={Colors.primary}
                sublabel={stats?.pending_members ? `+${stats.pending_members} pending` : undefined}
              />
              <StatTile
                icon={<Package size={18} color={Colors.secondary} />}
                label="Packages"
                value={packagesNeedingAction}
                accent={Colors.secondary}
                sublabel={stats?.packages_today ? `${stats.packages_today} today` : undefined}
                pulse={packagesNeedingAction > 0}
              />
              <StatTile
                icon={<Megaphone size={18} color={Colors.gold} />}
                label="Active Posts"
                value={stats?.active_announcements ?? announcements.length}
                accent={Colors.gold}
              />
              <StatTile
                icon={<AlertTriangle size={18} color={Colors.danger} />}
                label="Exceptions"
                value={stats?.packages_exception ?? 0}
                accent={Colors.danger}
                pulse={(stats?.packages_exception ?? 0) > 0}
              />
            </>
          )}
        </View>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            <QuickAction
              icon={<Users size={18} color={Colors.primary} />}
              label="Directory"
              accent={Colors.primary}
              onPress={() => router.push('/resident-directory')}
            />
            <QuickAction
              icon={<Megaphone size={18} color={Colors.secondary} />}
              label="Post"
              accent={Colors.secondary}
              onPress={() => router.push('/post-announcement')}
            />
            <QuickAction
              icon={<Package size={18} color={Colors.gold} />}
              label="Packages"
              accent={Colors.gold}
              onPress={() => router.push('/package-ops-board')}
            />
            <QuickAction
              icon={<LayoutGrid size={18} color={Colors.success} />}
              label="Announcements"
              accent={Colors.success}
              onPress={() => router.push('/announcements')}
            />
            <QuickAction
              icon={<AlertTriangle size={18} color={Colors.danger} />}
              label="Incidents"
              accent={Colors.danger}
              onPress={() => router.push('/incident-queue')}
            />
            <QuickAction
              icon={<Building2 size={18} color={Colors.success} />}
              label="Properties"
              accent={Colors.success}
              onPress={() => router.push('/property-management')}
            />
            <QuickAction
              icon={<Users size={18} color={Colors.gold} />}
              label="Roles"
              accent={Colors.gold}
              onPress={() => router.push('/role-management')}
            />
            <QuickAction
              icon={<TrendingUp size={18} color={Colors.primary} />}
              label="Activity"
              accent={Colors.primary}
              onPress={() => router.push('/activity-history')}
            />
            <QuickAction
              icon={<BarChart2 size={18} color={Colors.success} />}
              label="Analytics"
              accent={Colors.success}
              onPress={() => router.push('/analytics-dashboard')}
            />
            <QuickAction
              icon={<CalendarDays size={18} color={Colors.primary} />}
              label="Calendar"
              accent={Colors.primary}
              onPress={() => router.push('/community-calendar')}
            />
            <QuickAction
              icon={<Wrench size={18} color={'#E07B00'} />}
              label="Maintenance"
              accent={'#E07B00'}
              onPress={() => router.push('/maintenance-queue')}
            />
            <QuickAction
              icon={<ShieldCheck size={18} color={Colors.primary} />}
              label="Trust Engine"
              accent={Colors.primary}
              onPress={() => router.push('/trust-engine' as never)}
            />
            <QuickAction
              icon={<LifeBuoy size={18} color={Colors.secondary} />}
              label="Support Queue"
              accent={Colors.secondary}
              onPress={() => router.push('/staff-support-queue')}
            />
          </ScrollView>
        </View>

        {/* ── Pending approvals ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title={
              pendingCount > 0
                ? `Pending Approvals  ·  ${pendingCount}`
                : 'Pending Approvals'
            }
          />

          {pendingLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : pendingMembers.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <CheckCircle size={22} color={Colors.success} />
              <Text style={[styles.emptyText, { color: Colors.slateLight }]}>All caught up</Text>
            </View>
          ) : (
            <>
              {pendingMembers.map((m) => (
                <PendingMemberRow
                  key={m.membership_id}
                  member={m}
                  onApprove={() => handleApprove(m.membership_id)}
                  onDeny={() => handleDeny(m.membership_id)}
                  isLoading={
                    processingId === m.membership_id &&
                    (isApprovingMembership || isDenyingMembership)
                  }
                />
              ))}
            </>
          )}
        </View>

        {/* ── Package log ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
          title="Recent Packages"
          action="Full Board"
          onAction={() => router.push('/package-ops-board')}
        />

          {recentPackages.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Package size={22} color={Colors.slateLighter} />
              <Text style={[styles.emptyText, { color: Colors.slateLight }]}>No packages logged yet</Text>
            </View>
          ) : (
            recentPackages.map((pkg: Record<string, unknown>) => {
              const status = String(pkg.status ?? 'received');
              const dotColor = pkgStatusColor(status);
              return (
                <View
                  key={String(pkg.id)}
                  style={[styles.pkgRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                >
                  <View style={[styles.pkgDot, { backgroundColor: dotColor }]} />
                  <View style={styles.pkgInfo}>
                    <Text style={[styles.pkgUnit, { color: Colors.slate }]}>
                      {pkg.unit_number ? `Unit ${String(pkg.unit_number)}` : 'Unassigned'}
                    </Text>
                    <Text style={[styles.pkgMeta, { color: Colors.slateLighter }]}>
                      {String(pkg.carrier ?? 'Unknown carrier')} · {status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <Text style={[styles.pkgTime, { color: Colors.slateLighter }]}>
                    {timeAgo(String(pkg.received_at ?? pkg.created_at))}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── Recent announcements ───────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title="Announcements"
            action="Post new"
            onAction={() => router.push('/post-announcement')}
          />

          {announcements.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Megaphone size={22} color={Colors.slateLighter} />
              <Text style={[styles.emptyText, { color: Colors.slateLight }]}>No announcements yet</Text>
            </View>
          ) : (
            announcements.slice(0, 3).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.announcementRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={() => router.push('/announcements')}
                activeOpacity={0.75}
              >
                <View style={styles.announcementRowLeft}>
                  <View
                    style={[
                      styles.priorityDot,
                      {
                        backgroundColor:
                          a.priority === 'urgent'
                            ? Colors.danger
                            : a.priority === 'high'
                            ? Colors.secondary
                            : a.priority === 'normal'
                            ? Colors.primary
                            : Colors.slateLighter,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.announcementTitle, { color: Colors.slate }]} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text style={[styles.announcementMeta, { color: Colors.slateLighter }]}>
                      {timeAgo(a.createdAt)}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={15} color={Colors.slateLighter} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Org info strip ─────────────────────────────────────────────── */}
        <View style={[styles.orgStrip, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <View style={styles.orgStripRow}>
            <Text style={[styles.orgStripLabel, { color: Colors.slateLighter }]}>Invite Code</Text>
            <Text style={[styles.orgStripValue, { color: Colors.primary }]}>
              {activeOrg.inviteCode ?? '—'}
            </Text>
          </View>
          {activeOrg.totalUnits ? (
            <View style={[styles.orgStripRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }]}>
              <Text style={[styles.orgStripLabel, { color: Colors.slateLighter }]}>Total Units</Text>
              <Text style={[styles.orgStripValue, { color: Colors.slate }]}>{activeOrg.totalUnits}</Text>
            </View>
          ) : null}
          {activeOrg.contactEmail ? (
            <View style={[styles.orgStripRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }]}>
              <Text style={[styles.orgStripLabel, { color: Colors.slateLighter }]}>Contact</Text>
              <Text style={[styles.orgStripValue, { color: Colors.slateLight }]} numberOfLines={1}>
                {activeOrg.contactEmail}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleChipText: { fontSize: 11, fontWeight: '700' as const },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 20,
    paddingBottom: 0,
  },
  statsLoader: { flex: 1, alignItems: 'center', paddingVertical: 24 },
  statTile: {
    width: '47.5%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '600' as const },
  statSublabel: { fontSize: 11, fontWeight: '600' as const },

  // Quick actions
  quickRow: { gap: 10, paddingRight: 20 },
  quickAction: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 72,
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 11, fontWeight: '600' as const, textAlign: 'center' },

  // Section
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  sectionAction: { fontSize: 13, fontWeight: '600' as const },

  // Empty
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyText: { fontSize: 14 },

  // Pending
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  pendingInfo: { flex: 1 },
  pendingName: { fontSize: 14, fontWeight: '600' as const },
  pendingMeta: { fontSize: 12, marginTop: 2 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Package log
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  pkgDot: { width: 8, height: 8, borderRadius: 4 },
  pkgInfo: { flex: 1 },
  pkgUnit: { fontSize: 14, fontWeight: '600' as const },
  pkgMeta: { fontSize: 12, marginTop: 2 },
  pkgTime: { fontSize: 11 },

  // Announcements
  announcementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  announcementRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  priorityDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 1 },
  announcementTitle: { fontSize: 14, fontWeight: '600' as const },
  announcementMeta: { fontSize: 11, marginTop: 2 },

  // Org strip
  orgStrip: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  orgStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  orgStripLabel: { fontSize: 13 },
  orgStripValue: { fontSize: 13, fontWeight: '700' as const },
});
