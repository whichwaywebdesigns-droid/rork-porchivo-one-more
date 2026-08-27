import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { Shield, MapPin, ShieldAlert, Bell, BarChart3, Plus, Zap, BadgeDollarSign, ArrowRight, Users } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, radius, space } from '@/constants/theme';
import { useColors, AppColors } from '@/constants/colors';
import EmptyState from '@/components/ui/EmptyState';
import { useApp } from '@/store/AppContext';
import { useOrganization } from '@/store/OrganizationContext';
import { useShipments } from '@/store/ShipmentsContext';
import { useNotifications } from '@/store/NotificationsContext';
import ShipmentCard from '@/components/ShipmentCard';
import { HomeDashboardSkeleton } from '@/components/SkeletonLoader';
import DailyPackageTheftFact from '@/components/DailyPackageTheftFact';
import OnboardingWalkthrough from '@/components/OnboardingTooltip';
import ActivationChecklist from '@/components/ActivationChecklist';
import OFDLiveHero from '@/components/OFDLiveHero';
import TodayRiskCard from '@/components/TodayRiskCard';
import DailyStreakCard from '@/components/DailyStreakCard';
import ReferralCard from '@/components/ReferralCard';
import InviteNeighborsCard from '@/components/InviteNeighborsCard';
import { isEnabled } from '@/lib/featureFlags';
import { log } from '@/lib/logger';
import { Shipment } from '@/types';

// P-3: app-maturity storage key — increments on each cold home mount.
const APP_OPENS_KEY = 'porchivo_app_opens';
const PARTNER_UPSELL_MIN_OPENS = 3;
const THEFT_FACT_MIN_OPENS = 3;


export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useColors();
  const { user, isHomeowner, isPartner, session } = useApp();
  const { isOrgMember, isLoading: isOrgLoading } = useOrganization();
  const { myShipments, nearbyShipments, acceptShipment, isLoading: isShipmentsLoading } = useShipments();
  const { unreadNotificationCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  // Tier guard: (home) is the community-tier tab and is hidden from the bar
  // for free-tier users. Several screens (login, location-consent,
  // notifications-permission, +not-found) navigate here unconditionally, so a
  // free-tier user would otherwise strand on a tab with no bar item. Defer
  // with setTimeout — synchronous router.replace() during React's reconnect
  // phase can crash (see note at the bottom of this file).
  useEffect(() => {
    if (isOrgLoading || isOrgMember) return;
    const t = setTimeout(() => {
      router.replace('/(tabs)/packages' as any);
    }, 0);
    return () => clearTimeout(t);
  }, [isOrgLoading, isOrgMember, router]);


  // P-3: app-maturity gating. Counted on each home mount so first-time users
  // see a calm screen instead of 6 stacked marketing sections.
  const [appOpens, setAppOpens] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APP_OPENS_KEY);
        const next = (raw ? parseInt(raw, 10) : 0) + 1;
        await AsyncStorage.setItem(APP_OPENS_KEY, String(next));
        if (!cancelled) setAppOpens(next);
      } catch {
        if (!cancelled) setAppOpens(1);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // HOA-provisioned model: all users have full access. No paywall, no winback.

  // P-3: maturity-gated section visibility. First-time users (appOpens <= 2 or
  // no delivered shipments yet) get a minimal home; upsells/facts/streaks
  // surface once they've had a chance to settle in.
  const hasDeliveredShipment = useMemo(
    () => myShipments.some((s) => s.status === 'completed'),
    [myShipments],
  );
  const isMatureUser = appOpens >= PARTNER_UPSELL_MIN_OPENS || hasDeliveredShipment;
  const showTheftFact = appOpens >= THEFT_FACT_MIN_OPENS;
  const showPartnerUpsell =
    isEnabled('PORCH_PARTNERS') && isHomeowner && !isPartner && isMatureUser;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shipments'] }),
        queryClient.invalidateQueries({ queryKey: ['profile', session?.user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    } catch (err) {
      log('[Home] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, session?.user?.id]);

  const handleShipmentPress = useCallback((shipment: Shipment) => {
    router.push({ pathname: '/shipment-detail' as any, params: { id: shipment.id } });
  }, [router]);

  const handleAccept = useCallback((shipmentId: string) => {
    acceptShipment(shipmentId);
  }, [acceptShipment]);

  const data = isPartner && !isHomeowner ? nearbyShipments : myShipments;
  const isPartnerView = isPartner && !isHomeowner;

  // P-3: partner-view-dependent gates, declared after isPartnerView.
  const showDailyStreak = !isPartnerView && isMatureUser;
  const showReferral = !isPartnerView && user && isMatureUser;

  const renderItem = useCallback(({ item }: { item: Shipment }) => (
    <ShipmentCard
      shipment={item}
      onPress={() => handleShipmentPress(item)}
      onAccept={isPartnerView ? () => handleAccept(item.id) : undefined}
      showDistance={isPartnerView && user?.hasLocationConsent}
      variant={isPartnerView ? 'partner' : 'homeowner'}
    />
  ), [handleShipmentPress, handleAccept, isPartnerView, user?.hasLocationConsent]);

  const quickLinks = useMemo(() => [
    { label: 'Alerts', icon: Bell, color: colors.danger, bg: colors.dangerLight, route: '/notifications', badge: unreadNotificationCount },
    { label: 'Safety', icon: BarChart3, color: colors.primary, bg: colors.primaryLight, route: '/safety-score', badge: 0 },
    { label: 'Add Package', icon: Plus, color: colors.success, bg: colors.successLight, route: '/add-package', badge: 0 },
    { label: 'Invite', icon: Users, color: palette.warmOrange, bg: palette.warmOrangeGlow, route: '/invite-partner', badge: 0 },
    { label: 'Porch Risk', icon: ShieldAlert, color: palette.warmOrange, bg: palette.warmOrangeGlow, route: '/porch-risk', badge: 0 },
  ], [unreadNotificationCount, colors]);

  const ListHeader = useCallback(() => (
    <View style={styles.headerArea}>
      <ActivationChecklist />
      {showTheftFact && <DailyPackageTheftFact />}

      {/* Partner upsell banner — shown to homeowners who haven't become a partner */}
      {showPartnerUpsell && (
        <TouchableOpacity
          style={styles.partnerUpsellBanner}
          onPress={() => router.push('/partner-onboarding' as any)}
          activeOpacity={0.88}
          testID="partner-upsell-banner"
        >
          <View style={styles.partnerUpsellIcon}>
            <BadgeDollarSign size={15} color="#16A34A" />
          </View>
          <View style={styles.partnerUpsellText}>
            <Text style={styles.partnerUpsellTitle}>Earn $80–$250/mo on your schedule</Text>
            <Text style={styles.partnerUpsellSub}>Hold packages for neighbors · Keep 85% · 2-day payout</Text>
          </View>
          <ArrowRight size={16} color="#16A34A" />
        </TouchableOpacity>
      )}

{!isPartnerView && <TodayRiskCard />}

      {!isPartnerView && (
        <OFDLiveHero
          shipments={myShipments}
          onPress={(id) => router.push({ pathname: '/shipment-detail' as any, params: { id } })}
        />
      )}

      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.slate }]}>
            Hello, {user?.name?.split(' ')[0] ?? 'Neighbor'}
          </Text>
          <Text style={[styles.subGreeting, { color: colors.slateLight }]}>
            {isPartnerView ? 'Nearby shipments to protect' : 'Your delivery dashboard'}
          </Text>
        </View>
        <View style={styles.greetingBadge}>
          <Zap size={12} color={palette.onAccent} fill={palette.onAccent} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickLinksRow}
      >
        {quickLinks.map((link) => (
          <TouchableOpacity
            key={link.label}
            style={styles.quickLinkCard}
            onPress={() => router.push(link.route as any)}
            activeOpacity={0.75}
            testID={`quick-link-${link.label.toLowerCase()}`}
            accessibilityRole="button"
            accessibilityLabel={`Open ${link.label}`}
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: link.bg }]}>
              <link.icon size={18} color={link.color} strokeWidth={2.2} />
              {link.badge > 0 && (
                <View style={styles.quickLinkBadge}>
                  <Text style={styles.quickLinkBadgeText}>{link.badge > 9 ? '9+' : link.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.quickLinkLabel, { color: colors.slateLight }]}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isPartnerView && !user?.hasLocationConsent && (
        <TouchableOpacity
          style={styles.locationBanner}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/profile' as any)}
        >
          <MapPin size={16} color={colors.secondary} />
          <Text style={styles.locationBannerText}>Turn on location to see nearby shipments faster</Text>
        </TouchableOpacity>
      )}

      {!isPartnerView && showDailyStreak && (
        <DailyStreakCard
          onCheckIn={(streak) => {
            log('[Home] Streak check-in:', streak);
          }}
        />
      )}

      {showReferral && (
        <ReferralCard
          userId={user?.id ?? ''}
          userName={user?.name ?? ''}
          onShared={() => {
            log('[Home] Referral shared');
          }}
        />
      )}

      {/* Invite Neighbors — always visible to authenticated users with an id */}
      {user?.id && (
        <InviteNeighborsCard
          userId={user.id}
          userName={user?.name ?? ''}
        />
      )}
    </View>
  ), [user, isPartnerView, router, quickLinks, myShipments, showTheftFact, showPartnerUpsell, showDailyStreak, showReferral]);

  const ListEmpty = useCallback(() => (
    <View>
      <EmptyState
        icon={<Shield size={36} color={palette.accent} strokeWidth={1.6} />}
        title={isPartnerView ? 'No shipments nearby' : 'No packages yet'}
        body={
          isPartnerView
            ? 'Check back soon — homeowners in your area may need a hand.'
            : 'Add your first package to start tracking deliveries and scoring porch risk.'
        }
        ctaLabel={isPartnerView ? undefined : 'Add your first package'}
        onCta={isPartnerView ? undefined : () => router.push('/add-package' as any)}
        tone="sky"
      />
      <View style={styles.linkRow}>
        <TouchableOpacity
          style={styles.howItWorksLink}
          onPress={() => router.push('/how-it-works' as any)}
          accessibilityRole="button"
          accessibilityLabel="See how it works"
        >
          <Text style={[styles.howItWorksText, { color: palette.accent }]}>See how it works</Text>
          <ArrowRight size={15} color={palette.accent} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.howItWorksLink}
          onPress={() => router.push('/field-guide' as any)}
          accessibilityRole="button"
          accessibilityLabel="Walk with Me"
        >
          <Text style={[styles.howItWorksText, { color: palette.accent }]}>Walk with Me</Text>
          <ArrowRight size={15} color={palette.accent} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  ), [isPartnerView, router]);

  const [_walkthroughDone, setWalkthroughDone] = useState(false);

  // Free-tier users don't have a Home tab. We render nothing instead of
  // calling router.replace() — that crashes during React's
  // reconnectPassiveEffects phase (HMR in dev) when the navigator isn't
  // ready. The root layout redirect handles navigation to Deliveries.
  if (!isOrgLoading && !isOrgMember) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  // Skeleton: shown while org context resolves or the first shipment query
  // loads with no cached data. Subsequent refetches use RefreshControl instead
  // so the skeleton doesn't flash on pull-to-refresh.
  const showSkeleton = isOrgLoading || (isShipmentsLoading && data.length === 0);
  if (showSkeleton) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Porchivo',
            headerLargeTitle: true,
            headerLargeTitleStyle: { fontSize: 26, fontWeight: '900' as const, color: colors.slate },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.slate,
            headerShadowVisible: false,
          }}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          <HomeDashboardSkeleton />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OnboardingWalkthrough onComplete={() => setWalkthroughDone(true)} />
      <Stack.Screen
        options={{
          title: 'Porchivo',
          headerLargeTitle: true,
          headerLargeTitleStyle: { fontSize: 26, fontWeight: '900' as const, color: colors.slate },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.slate,
          headerShadowVisible: false,
        }}
      />
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// Note: home screen uses palette for static spacing values;
// color-sensitive styles are applied via inline or the hook above.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg, // overridden at runtime via headerStyle
  },
  listContent: {
    paddingBottom: space.xxl,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: space.lg,
    marginTop: -space.md,
    marginBottom: space.lg,
  },
  howItWorksLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: space.sm,
  },
  howItWorksText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  headerArea: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.lg,
    marginTop: space.sm,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
    // color set via inline override using useColors()
  },
  subGreeting: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500' as const,
    // color set via inline override using useColors()
  },
  greetingBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinksRow: {
    gap: space.sm,
    paddingRight: space.lg,
    paddingVertical: space.xs,
    marginBottom: space.md,
  },
  quickLinkCard: {
    alignItems: 'center',
    gap: 7,
    backgroundColor: palette.bgSurface,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    minWidth: 86,
    borderWidth: 1,
    borderColor: palette.borderDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  quickLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  quickLinkBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -6,
    backgroundColor: palette.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: palette.bgSurface,
  },
  quickLinkBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: palette.onAccent,
  },
  quickLinkLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    // color set via inline override using useColors()
  },
  partnerUpsellBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  partnerUpsellIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerUpsellText: {
    flex: 1,
    gap: 2,
  },
  partnerUpsellTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#15803D',
  },
  partnerUpsellSub: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '500' as const,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.warmOrangeGlow,
    padding: space.md + 2,
    borderRadius: radius.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
  },
  locationBannerText: {
    fontSize: 13,
    color: palette.ember,
    fontWeight: '500' as const,
    flex: 1,
  },
});
