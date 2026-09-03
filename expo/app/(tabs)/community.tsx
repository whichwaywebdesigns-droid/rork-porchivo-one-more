import React, { useCallback, useRef } from 'react';
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
import {
  Building2,
  Shield,
  Package,
  Megaphone,
  ChevronRight,
  CheckCircle,
  Clock,
  Users,
  Star,
  Bell,
  AlertTriangle,
  Lock,
  BarChart2,
  CalendarDays,
  Wrench,
  Truck,
  Palette,
  FolderOpen,
  CalendarClock,
  Receipt,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  OrgType,
  OrgRole,
  ORG_TYPE_LABELS,
  ORG_ROLE_LABELS,
  STAFF_ROLES,
  AnnouncementPriority,
} from '@/types/organization';
import { isEnabled } from '@/lib/featureFlags';
import { LayoutDashboard } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { RestrictedCommunityOverlay } from '@/components/BillingGraceBanner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_TYPE_ICON: Record<OrgType, string> = {
  hoa: '🏡',
  condo: '🏢',
  multifamily: '🏬',
  property_management: '🏗️',
};

const PRIORITY_COLOR: Record<AnnouncementPriority, string> = {
  low: '#6B7F99',
  normal: '#3A7BD5',
  high: '#E07B00',
  urgent: '#D94040',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  const Colors = useColors();
  return (
    <View style={[styles.statPill, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: accent + '20' }]}>{icon}</View>
      <Text style={[styles.statValue, { color: Colors.slate }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: Colors.slateLighter }]}>{label}</Text>
    </View>
  );
}

function RoleBadge({ role }: { role: OrgRole }) {
  const Colors = useColors();
  const isStaff = STAFF_ROLES.includes(role);
  return (
    <View
      style={[
        styles.roleBadge,
        {
          backgroundColor: isStaff ? Colors.primary + '22' : Colors.secondary + '22',
          borderColor: isStaff ? Colors.primary + '55' : Colors.secondary + '55',
        },
      ]}
    >
      <Star size={10} color={isStaff ? Colors.primary : Colors.secondary} />
      <Text style={[styles.roleBadgeText, { color: isStaff ? Colors.primary : Colors.secondary }]}>
        {ORG_ROLE_LABELS[role]}
      </Text>
    </View>
  );
}

// ─── Join CTA (non-member state) ──────────────────────────────────────────────

function JoinCTA() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <ScrollView
      contentContainerStyle={[styles.ctaContainer, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Icon */}
      <Animated.View style={[styles.ctaIconWrap, { transform: [{ scale: pulseAnim }] }]}>
        <View style={[styles.ctaIconCircle, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '40' }]}>
          <Building2 size={52} color={Colors.primary} strokeWidth={1.5} />
        </View>
      </Animated.View>

      <Text style={[styles.ctaHeadline, { color: Colors.slate }]}>
        Your building,{'\n'}better protected.
      </Text>
      <Text style={[styles.ctaSubheadline, { color: Colors.slateLight }]}>
        Join your HOA, condo, or apartment community on Porchivo to unlock building-wide package coordination and community alerts.
      </Text>

      {/* Value props */}
      {[
        { icon: <Package size={20} color={Colors.primary} />, title: 'Building Package Board', desc: 'See community delivery activity and package exceptions in real time.' },
        { icon: <Megaphone size={20} color={Colors.secondary} />, title: 'Community Announcements', desc: 'Receive board and staff updates directly in the app.' },
        { icon: <Shield size={20} color={Colors.success} />, title: 'Community Safety Alerts', desc: 'Shared block alerts and porch security events for your entire property.' },
      ].map((prop) => (
        <View key={prop.title} style={[styles.valueProp, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <View style={[styles.valuePropIcon, { backgroundColor: Colors.elevated }]}>{prop.icon}</View>
          <View style={styles.valuePropText}>
            <Text style={[styles.valuePropTitle, { color: Colors.slate }]}>{prop.title}</Text>
            <Text style={[styles.valuePropDesc, { color: Colors.slateLighter }]}>{prop.desc}</Text>
          </View>
        </View>
      ))}

      {/* CTA buttons */}
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
        onPress={() => router.push('/join-community')}
        activeOpacity={0.85}
      >
        <Users size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Join Your Community</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryBtn, { borderColor: Colors.border }]}
        onPress={() => router.push({ pathname: '/join-community', params: { mode: 'claim' } })}
        activeOpacity={0.7}
      >
        <Text style={[styles.secondaryBtnText, { color: Colors.slateLight }]}>
          I manage a property — Claim my community
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Pending state ────────────────────────────────────────────────────────────

function PendingCard() {
  const Colors = useColors();
  const { activeMembership, activeOrg } = useOrganization();

  return (
    <View style={[styles.pendingContainer]}>
      <View style={[styles.pendingCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <View style={[styles.pendingIconWrap, { backgroundColor: Colors.gold + '20' }]}>
          <Clock size={32} color={Colors.gold} />
        </View>
        <Text style={[styles.pendingTitle, { color: Colors.slate }]}>Membership Pending</Text>
        <Text style={[styles.pendingOrg, { color: Colors.primary }]}>
          {activeOrg?.name ?? 'Your Community'}
        </Text>
        <Text style={[styles.pendingDesc, { color: Colors.slateLighter }]}>
          Your request to join has been submitted. A community admin will approve your membership shortly.
        </Text>

        <View style={[styles.pendingMeta, { borderTopColor: Colors.border }]}>
          <Text style={[styles.pendingMetaLabel, { color: Colors.slateLighter }]}>
            {ORG_TYPE_LABELS[(activeOrg?.type as OrgType) ?? 'hoa']}
          </Text>
          {activeMembership?.unitNumber ? (
            <Text style={[styles.pendingMetaLabel, { color: Colors.slateLighter }]}>
              Unit {activeMembership.unitNumber}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={[styles.pendingHint, { color: Colors.slateLighter }]}>
        You'll receive a notification once approved.
      </Text>
    </View>
  );
}

// ─── Community Dashboard (active member) ─────────────────────────────────────

// ─── Portfolio switcher (multi-community plans) ──────────────────────────────

function PortfolioSection() {
  const Colors = useColors();
  const { allMemberships, activeOrg, switchOrg } = useOrganization();

  const activeMemberships = allMemberships.filter((m) => m.status === 'active');
  if (activeMemberships.length < 2) return null;

  return (
    <View style={styles.portfolioSection}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Portfolio</Text>
        <Text style={[styles.portfolioCount, { color: Colors.slateLighter }]}>
          {activeMemberships.length} communities
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.portfolioRow}
      >
        {activeMemberships.map((m) => {
          const isActive = m.orgId === activeOrg?.id;
          return (
            <TouchableOpacity
              key={m.orgId}
              style={[
                styles.portfolioCard,
                {
                  backgroundColor: Colors.surface,
                  borderColor: isActive ? Colors.primary : Colors.border,
                  borderWidth: isActive ? 1.5 : 1,
                },
              ]}
              onPress={() => void switchOrg(m.orgId)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.portfolioCardIcon,
                  { backgroundColor: isActive ? Colors.primary + '20' : Colors.elevated },
                ]}
              >
                <Text style={styles.orgLogoEmoji}>{ORG_TYPE_ICON[m.org?.type ?? 'hoa'] ?? '🏡'}</Text>
              </View>
              <Text style={[styles.portfolioCardName, { color: Colors.slate }]} numberOfLines={1}>
                {m.org?.name ?? 'Community'}
              </Text>
              <Text
                style={[
                  styles.portfolioCardRole,
                  { color: isActive ? Colors.primary : Colors.slateLighter },
                ]}
                numberOfLines={1}
              >
                {ORG_ROLE_LABELS[m.role] ?? m.role}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CommunityDashboard({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    activeOrg,
    activeMembership,
    orgRole,
    isOrgAdmin,
    isOrgStaff,
    announcements,
    isAnnouncementsLoading,
    packageLog,
    isPackageLogLoading,
  } = useOrganization();

  const showDirectory = isEnabled('ORG_RESIDENT_DIRECTORY');
  const showAdminDashboard = isEnabled('ORG_ADMIN_DASHBOARD');
  const showIncidentQueue = isEnabled('ORG_INCIDENT_QUEUE');
  const showRoleManagement = isEnabled('ORG_ROLE_MANAGEMENT');
  const showCalendar = isEnabled('ORG_CALENDAR');

  // Lightweight member count for the stat pill
  const { data: memberCount = 0 } = useQuery<number>({
    queryKey: ['org-member-count', activeOrg?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_org_member_count', {
        p_org_id: activeOrg!.id,
      });
      return (data as number) ?? 0;
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Plan tier + branding — small singleton fetch, gates multi-community tools
  const { data: orgMeta } = useQuery<{ planTier: string | null; brandColor: string | null }>({
    queryKey: ['org-meta', activeOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organizations')
        .select('plan_tier, brand_color')
        .eq('id', activeOrg!.id)
        .maybeSingle();
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        planTier: (row.plan_tier as string | null) ?? null,
        brandColor: (row.brand_color as string | null) ?? null,
      };
    },
    enabled: !!activeOrg?.id,
    staleTime: 1000 * 60 * 5,
  });
  const isMultiCommunityPlan = orgMeta?.planTier === 'professional' || orgMeta?.planTier === 'enterprise';
  // Starter < Community ≤ Professional ≤ Property Manager — amenities and the
  // payments ledger begin on the Community plan (see Pricing comparison rows).
  const isCommunityPlanOrHigher =
    orgMeta?.planTier === 'community' || orgMeta?.planTier === 'professional' || orgMeta?.planTier === 'enterprise';
  const brandColor = orgMeta?.brandColor ?? null;

  if (!activeOrg || !activeMembership) return null;

  const typeLabel = ORG_TYPE_LABELS[activeOrg.type];
  const typeEmoji = ORG_TYPE_ICON[activeOrg.type];
  const pendingPackages = packageLog.filter((p) => (p as any).status === 'received' || (p as any).status === 'ready_for_pickup');
  const recentAnnouncements = announcements.slice(0, 3);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      {/* Org header */}
      <View style={[styles.orgHeader, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
        <View style={styles.orgHeaderRow}>
          <View style={[styles.orgLogoCircle, { backgroundColor: brandColor ? brandColor + '22' : Colors.primary + '20' }]}>
            <Text style={styles.orgLogoEmoji}>{typeEmoji}</Text>
          </View>
          <View style={styles.orgHeaderText}>
            <View style={styles.orgNameRow}>
              <Text style={[styles.orgName, { color: Colors.slate }]} numberOfLines={1}>
                {activeOrg.name}
              </Text>
              {activeOrg.isVerified ? (
                <CheckCircle size={14} color={Colors.success} style={{ marginLeft: 4 }} />
              ) : null}
            </View>
            <Text style={[styles.orgTypeLine, { color: Colors.slateLighter }]}>
              {typeLabel}
              {activeMembership.unitNumber ? ` · Unit ${activeMembership.unitNumber}` : ''}
            </Text>
          </View>
          {orgRole ? <RoleBadge role={orgRole} /> : null}
        </View>
      </View>

      {/* Portfolio switcher — multi-community plans */}
      {isEnabled('ORG_PORTFOLIO') ? <PortfolioSection /> : null}

      {/* Stats row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
      >
        <StatPill
          icon={<Package size={16} color={Colors.primary} />}
          label="Packages"
          value={packageLog.length}
          accent={Colors.primary}
        />
        <StatPill
          icon={<Megaphone size={16} color={Colors.secondary} />}
          label="Announcements"
          value={announcements.length}
          accent={Colors.secondary}
        />
        <StatPill
          icon={<Bell size={16} color={Colors.success} />}
          label="Alerts"
          value="—"
          accent={Colors.success}
        />
        {showDirectory ? (
          <StatPill
            icon={<Users size={16} color={Colors.gold} />}
            label="Members"
            value={memberCount > 0 ? memberCount : '—'}
            accent={Colors.gold}
          />
        ) : null}
      </ScrollView>

      {/* Staff: Package Operations */}
      {isOrgStaff ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Package Operations</Text>
            {!isPackageLogLoading && (
              <TouchableOpacity onPress={() => router.push('/package-ops-board')} activeOpacity={0.7}>
                <Text style={[styles.seeAll, { color: Colors.primary }]}>Board</Text>
              </TouchableOpacity>
            )}
          </View>

          {isPackageLogLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : pendingPackages.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <CheckCircle size={24} color={Colors.success} />
              <Text style={[styles.emptyText, { color: Colors.slateLight }]}>No pending packages</Text>
            </View>
          ) : (
            pendingPackages.slice(0, 3).map((pkg: any) => (
              <TouchableOpacity
                key={pkg.id}
                style={[styles.logRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                activeOpacity={0.75}
              >
                <View style={[styles.logDot, { backgroundColor: Colors.secondary }]} />
                <View style={styles.logInfo}>
                  <Text style={[styles.logUnit, { color: Colors.slate }]}>
                    {pkg.unit_number ? `Unit ${pkg.unit_number}` : 'Unassigned'}
                  </Text>
                  <Text style={[styles.logCarrier, { color: Colors.slateLighter }]}>
                    {pkg.carrier ?? 'Unknown carrier'} · {pkg.status.replace(/_/g, ' ')}
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.slateLighter} />
              </TouchableOpacity>
            ))
          )}

          {/* Package board + log buttons (staff only) */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.primary + '14', borderColor: Colors.primary + '40', flex: 1 }]}
              onPress={() => router.push('/package-ops-board')}
              activeOpacity={0.8}
            >
              <Package size={16} color={Colors.primary} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Board</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.secondary + '14', borderColor: Colors.secondary + '40', flex: 1 }]}
              onPress={() => router.push('/log-package')}
              activeOpacity={0.8}
            >
              <Package size={16} color={Colors.secondary} />
              <Text style={[styles.actionBtnText, { color: Colors.secondary }]}>Log Package</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Community Calendar — all active members */}
      {showCalendar ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Community Calendar</Text>
            <TouchableOpacity onPress={() => router.push('/community-calendar')} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: Colors.primary }]}>View</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.directoryCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => router.push('/community-calendar')}
            activeOpacity={0.8}
          >
            <View style={[styles.directoryIconWrap, { backgroundColor: Colors.primary + '18' }]}>
              <CalendarDays size={22} color={Colors.primary} />
            </View>
            <View style={styles.directoryText}>
              <Text style={[styles.directoryTitle, { color: Colors.slate }]}>Events &amp; Meetings</Text>
              <Text style={[styles.directoryDesc, { color: Colors.slateLighter }]}>
                HOA meetings, maintenance windows, amenity scheduling
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Maintenance Requests — all active members */}
      {isEnabled('ORG_MAINTENANCE') ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Maintenance</Text>
            <TouchableOpacity
              onPress={() => router.push(isOrgStaff ? '/maintenance-queue' : '/submit-maintenance')}
              activeOpacity={0.7}
            >
              <Text style={[styles.seeAll, { color: Colors.primary }]}>
                {isOrgStaff ? 'Queue' : 'New Request'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.directoryCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => router.push(isOrgStaff ? '/maintenance-queue' : '/submit-maintenance')}
            activeOpacity={0.8}
          >
            <View style={[styles.directoryIconWrap, { backgroundColor: '#E07B0018' }]}>
              <Wrench size={22} color={'#E07B00'} />
            </View>
            <View style={styles.directoryText}>
              <Text style={[styles.directoryTitle, { color: Colors.slate }]}>
                {isOrgStaff ? 'Maintenance Queue' : 'Submit a Request'}
              </Text>
              <Text style={[styles.directoryDesc, { color: Colors.slateLighter }]}>
                {isOrgStaff
                  ? 'Review, assign, and resolve maintenance work orders'
                  : 'Report plumbing, electrical, HVAC, and other issues'}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Announcements */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Announcements</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/announcements')}
          >
            <Text style={[styles.seeAll, { color: Colors.primary }]}>
              {announcements.length > 0 ? 'See all' : 'View'}
            </Text>
          </TouchableOpacity>
        </View>

        {isAnnouncementsLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
        ) : recentAnnouncements.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Megaphone size={22} color={Colors.slateLighter} />
            <Text style={[styles.emptyText, { color: Colors.slateLight }]}>No announcements yet</Text>
          </View>
        ) : (
          recentAnnouncements.map((a) => (
            <View
              key={a.id}
              style={[styles.announcementCard, { backgroundColor: Colors.surface, borderColor: Colors.border, borderLeftColor: PRIORITY_COLOR[a.priority] }]}
            >
              {a.isPinned ? (
                <View style={styles.pinRow}>
                  <Lock size={10} color={Colors.slateLighter} />
                  <Text style={[styles.pinText, { color: Colors.slateLighter }]}>Pinned</Text>
                </View>
              ) : null}
              <Text style={[styles.announcementTitle, { color: Colors.slate }]}>{a.title}</Text>
              <Text style={[styles.announcementBody, { color: Colors.slateLight }]} numberOfLines={2}>
                {a.body}
              </Text>
              <Text style={[styles.announcementMeta, { color: Colors.slateLighter }]}>
                {timeAgo(a.createdAt)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Document Library — all active members (Starter and up) */}
      {isEnabled('ORG_DOCUMENT_LIBRARY') && activeOrg ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Documents</Text>
            <TouchableOpacity onPress={() => router.push('/org-documents')} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: Colors.primary }]}>Browse</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.directoryCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => router.push('/org-documents')}
            activeOpacity={0.8}
          >
            <View style={[styles.directoryIconWrap, { backgroundColor: Colors.success + '18' }]}>
              <FolderOpen size={22} color={Colors.success} />
            </View>
            <View style={styles.directoryText}>
              <Text style={[styles.directoryTitle, { color: Colors.slate }]}>Document Library</Text>
              <Text style={[styles.directoryDesc, { color: Colors.slateLighter }]}>
                Bylaws, budgets, notices, and community files
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Amenity Reservations — all active members (Community and up) */}
      {isEnabled('ORG_AMENITY_RESERVATIONS') && isCommunityPlanOrHigher ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Amenities</Text>
            <TouchableOpacity onPress={() => router.push('/amenity-reservations')} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: Colors.primary }]}>Book</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.directoryCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => router.push('/amenity-reservations')}
            activeOpacity={0.8}
          >
            <View style={[styles.directoryIconWrap, { backgroundColor: Colors.secondary + '18' }]}>
              <CalendarClock size={22} color={Colors.secondary} />
            </View>
            <View style={styles.directoryText}>
              <Text style={[styles.directoryTitle, { color: Colors.slate }]}>Amenity Reservations</Text>
              <Text style={[styles.directoryDesc, { color: Colors.slateLighter }]}>
                Book the pool, clubhouse, tennis court, and more
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Directory entry — all active members */}
      {showDirectory ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.slate }]}>Resident Directory</Text>
            <TouchableOpacity
              onPress={() => router.push('/resident-directory')}
              activeOpacity={0.7}
            >
              <Text style={[styles.seeAll, { color: Colors.primary }]}>View all</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.directoryCard,
              { backgroundColor: Colors.surface, borderColor: Colors.border },
            ]}
            onPress={() => router.push('/resident-directory')}
            activeOpacity={0.8}
          >
            <View style={[styles.directoryIconWrap, { backgroundColor: Colors.gold + '18' }]}>
              <Users size={22} color={Colors.gold} />
            </View>
            <View style={styles.directoryText}>
              <Text style={[styles.directoryTitle, { color: Colors.slate }]}>
                {memberCount > 0 ? `${memberCount} Members` : 'Community Members'}
              </Text>
              <Text style={[styles.directoryDesc, { color: Colors.slateLighter }]}>
                {isOrgStaff
                  ? 'View residents, unit numbers, and contact details'
                  : 'Browse your community members and board'}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Admin quick actions */}
      {isOrgAdmin ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slate, marginBottom: 12 }]}>Admin</Text>

          {/* Admin Dashboard entry — prominent tap target */}
          {showAdminDashboard ? (
            <TouchableOpacity
              style={[styles.adminDashboardEntry, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '35' }]}
              onPress={() => router.push('/admin-dashboard')}
              activeOpacity={0.8}
            >
              <View style={[styles.adminDashboardIcon, { backgroundColor: Colors.primary + '18' }]}>
                <LayoutDashboard size={22} color={Colors.primary} />
              </View>
              <View style={styles.adminDashboardText}>
                <Text style={[styles.adminDashboardTitle, { color: Colors.slate }]}>Admin Dashboard</Text>
                <Text style={[styles.adminDashboardDesc, { color: Colors.slateLighter }]}>Stats, approvals, packages, announcements</Text>
              </View>
              <ChevronRight size={18} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.adminGrid}>
            {[
              {
                label: 'Members',
                icon: <Users size={20} color={Colors.primary} />,
                accent: Colors.primary,
                onPress: showRoleManagement ? () => router.push('/role-management') : () => router.push('/resident-directory'),
              },
              {
                label: 'Post',
                icon: <Megaphone size={20} color={Colors.secondary} />,
                accent: Colors.secondary,
                onPress: () => router.push('/post-announcement'),
              },
              ...(showIncidentQueue ? [{
                label: 'Incidents',
                icon: <AlertTriangle size={20} color={Colors.danger} />,
                accent: Colors.danger,
                onPress: () => router.push('/incident-queue'),
              }] : []),
              {
                label: 'Analytics',
                icon: <BarChart2 size={20} color={Colors.success} />,
                accent: Colors.success,
                onPress: () => router.push('/analytics-dashboard'),
              },
              ...(showCalendar ? [{
                label: 'Calendar',
                icon: <CalendarDays size={20} color={Colors.primary} />,
                accent: Colors.primary,
                onPress: () => router.push('/community-calendar'),
              }] : []),
              ...(isEnabled('ORG_VENDOR_DIRECTORY') && isMultiCommunityPlan ? [{
                label: 'Vendors',
                icon: <Truck size={20} color={Colors.secondary} />,
                accent: Colors.secondary,
                onPress: () => router.push('/org-vendors'),
              }] : []),
              ...(isEnabled('ORG_BRANDING') && isMultiCommunityPlan && isOrgAdmin ? [{
                label: 'Branding',
                icon: <Palette size={20} color={Colors.gold} />,
                accent: Colors.gold,
                onPress: () => router.push('/org-branding'),
              }] : []),
              ...(isEnabled('ORG_LEDGER_EXPORT') && isCommunityPlanOrHigher ? [{
                label: 'Ledger',
                icon: <Receipt size={20} color={Colors.success} />,
                accent: Colors.success,
                onPress: () => router.push('/org-ledger'),
              }] : []),
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.adminCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={item.onPress}
                activeOpacity={0.75}
              >
                <View style={[styles.adminCardIcon, { backgroundColor: item.accent + '18' }]}>
                  {item.icon}
                </View>
                <Text style={[styles.adminCardLabel, { color: Colors.slateLight }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoading, isOrgMember, isOrgPending, refreshOrgContext } = useOrganization();
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  // Billing grace period — stage 3 (day 30+): full restriction (BILL-07).
  // The community dashboard is replaced by a billing notice; managers get a
  // billing CTA, residents are pointed at their property manager. Package
  // history remains reachable from the Packages tab.
  const { isRestricted } = useSubscriptionGate();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshOrgContext();
    setRefreshing(false);
  }, [refreshOrgContext]);

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 0),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
          },
        ]}
      >
        <Building2 size={20} color={Colors.primary} />
        <Text style={[styles.headerTitle, { color: Colors.slate }]}>Community</Text>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : isOrgMember ? (
        isRestricted ? (
          <RestrictedCommunityOverlay />
        ) : (
          <CommunityDashboard onRefresh={handleRefresh} refreshing={refreshing} />
        )
      ) : isOrgPending ? (
        <PendingCard />
      ) : (
        <JoinCTA />
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
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Join CTA ──────────────────────────────────────────────────────────────
  ctaContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  ctaIconWrap: { marginBottom: 24 },
  ctaIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaHeadline: {
    fontSize: 28,
    fontWeight: '800' as const,
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 34,
    marginBottom: 12,
  },
  ctaSubheadline: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    width: '100%',
  },
  valuePropIcon: { padding: 8, borderRadius: 10 },
  valuePropText: { flex: 1 },
  valuePropTitle: { fontSize: 14, fontWeight: '700' as const, marginBottom: 2 },
  valuePropDesc: { fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '500' as const },

  // ── Pending ───────────────────────────────────────────────────────────────
  pendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  pendingCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
  },
  pendingIconWrap: { padding: 16, borderRadius: 40, marginBottom: 16 },
  pendingTitle: { fontSize: 22, fontWeight: '800' as const, marginBottom: 6 },
  pendingOrg: { fontSize: 16, fontWeight: '700' as const, marginBottom: 10 },
  pendingDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  pendingMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    justifyContent: 'center',
  },
  pendingMetaLabel: { fontSize: 13 },
  pendingHint: { fontSize: 13, marginTop: 16, textAlign: 'center' },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  portfolioSection: { paddingHorizontal: 20, marginBottom: 4 },
  portfolioCount: { fontSize: 13, fontWeight: '600' as const },
  portfolioRow: { gap: 10, paddingBottom: 4 },
  portfolioCard: {
    width: 128,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  portfolioCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioCardName: { fontSize: 13, fontWeight: '700' as const },
  portfolioCardRole: { fontSize: 11, fontWeight: '600' as const },

  orgHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orgHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orgLogoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLogoEmoji: { fontSize: 22 },
  orgHeaderText: { flex: 1 },
  orgNameRow: { flexDirection: 'row', alignItems: 'center' },
  orgName: { fontSize: 16, fontWeight: '700' as const, flexShrink: 1 },
  orgTypeLine: { fontSize: 13, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' as const },

  statsRow: { paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  statPill: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 88,
    gap: 6,
  },
  statIcon: { padding: 6, borderRadius: 8 },
  statValue: { fontSize: 20, fontWeight: '800' as const },
  statLabel: { fontSize: 11, fontWeight: '600' as const },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' as const },
  seeAll: { fontSize: 14, fontWeight: '600' as const },

  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyText: { fontSize: 14 },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logInfo: { flex: 1 },
  logUnit: { fontSize: 14, fontWeight: '600' as const },
  logCarrier: { fontSize: 12, marginTop: 2 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 4,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' as const },

  announcementCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 10,
  },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  pinText: { fontSize: 10, fontWeight: '600' as const },
  announcementTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 4 },
  announcementBody: { fontSize: 13, lineHeight: 18 },
  announcementMeta: { fontSize: 11, marginTop: 6 },

  adminGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  adminCard: {
    width: '47%',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  adminCardIcon: { padding: 10, borderRadius: 12 },
  adminCardLabel: { fontSize: 12, fontWeight: '600' as const, textAlign: 'center' },

  // ── Admin dashboard entry ──────────────────────────────────────────────────
  adminDashboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  adminDashboardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminDashboardText: { flex: 1 },
  adminDashboardTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 2 },
  adminDashboardDesc: { fontSize: 12, lineHeight: 17 },

  // ── Directory entry card ──────────────────────────────────────────────────
  directoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  directoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directoryText: { flex: 1 },
  directoryTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 3 },
  directoryDesc: { fontSize: 13, lineHeight: 18 },
});
