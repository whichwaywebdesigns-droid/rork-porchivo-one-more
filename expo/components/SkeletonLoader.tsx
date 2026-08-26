import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';
import { useColors, AppColors } from '@/constants/colors';

function SkeletonPulse({ style }: { style?: object }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.bone,
        { opacity, backgroundColor: colors.border },
        style,
      ]}
    />
  );
}

export function ShipmentCardSkeleton() {
  const colors = useColors();
  const cardStyle = useMemo(() => ({ backgroundColor: colors.surface }), [colors]);

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.cardHeader}>
        <View style={styles.row}>
          <SkeletonPulse style={styles.iconCircle} />
          <View style={styles.textGroup}>
            <SkeletonPulse style={styles.titleBar} />
            <SkeletonPulse style={styles.subtitleBar} />
          </View>
        </View>
        <SkeletonPulse style={styles.badge} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <SkeletonPulse style={styles.pill} />
        <SkeletonPulse style={styles.trackingBar} />
      </View>
      <View style={[styles.row, { marginTop: 10 }]}>
        <SkeletonPulse style={styles.smallCircle} />
        <SkeletonPulse style={styles.nameBar} />
      </View>
    </View>
  );
}

export function PackageCardSkeleton() {
  const colors = useColors();
  const cardStyle = useMemo(() => ({ backgroundColor: colors.surface }), [colors]);

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.row}>
        <SkeletonPulse style={styles.iconSquare} />
        <View style={styles.textGroup}>
          <SkeletonPulse style={styles.titleBar} />
          <SkeletonPulse style={[styles.subtitleBar, { width: 140 }]} />
        </View>
        <SkeletonPulse style={styles.pill} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <View style={styles.textGroup}>
          <SkeletonPulse style={[styles.subtitleBar, { width: 60 }]} />
          <SkeletonPulse style={[styles.titleBar, { width: 80 }]} />
        </View>
        <SkeletonPulse style={[styles.pill, { width: 60 }]} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 3, type = 'shipment' }: { count?: number; type?: 'shipment' | 'package' }) {
  const Card = type === 'package' ? PackageCardSkeleton : ShipmentCardSkeleton;
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} />
      ))}
    </View>
  );
}

/**
 * Full home dashboard skeleton — mirrors the layout of the home screen:
 * greeting row, quick-links carousel, risk card, and shipment cards.
 * Shown while org context + shipments are still loading.
 */
export function HomeDashboardSkeleton() {
  const colors = useColors();
  const cardStyle = useMemo(
    () => ({ backgroundColor: colors.surface, borderColor: colors.border }),
    [colors.surface, colors.border],
  );

  return (
    <View style={styles.homeWrap}>
      {/* Greeting row */}
      <View style={styles.homeGreetingRow}>
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonPulse style={styles.homeGreetingBar} />
          <SkeletonPulse style={styles.homeSubGreetingBar} />
        </View>
        <SkeletonPulse style={styles.homeGreetingBadge} />
      </View>

      {/* Quick-links carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.homeQuickLinksRow}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.homeQuickLinkCard, cardStyle]}>
            <SkeletonPulse style={styles.homeQuickLinkIcon} />
            <SkeletonPulse style={styles.homeQuickLinkLabel} />
          </View>
        ))}
      </ScrollView>

      {/* Risk card placeholder */}
      <View style={[styles.homeRiskCard, cardStyle]}>
        <View style={styles.homeRiskHeader}>
          <SkeletonPulse style={styles.homeRiskTitle} />
          <SkeletonPulse style={styles.homeRiskBadge} />
        </View>
        <SkeletonPulse style={styles.homeRiskBar} />
        <View style={styles.homeRiskRow}>
          <SkeletonPulse style={styles.homeRiskPill} />
          <SkeletonPulse style={styles.homeRiskPillShort} />
        </View>
      </View>

      {/* Section label */}
      <SkeletonPulse style={styles.homeSectionLabel} />

      {/* Shipment card skeletons */}
      <View style={styles.homeShipmentsWrap}>
        {Array.from({ length: 3 }).map((_, i) => (
          <ShipmentCardSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

/**
 * Full-screen tab shell skeleton — shown while org membership (and thus the
 * tab tier) is still resolving. Mirrors a generic dashboard: header row, hero
 * card, quick-link tiles, list cards, and a fake tab bar at the bottom.
 */
export function TabShellSkeleton() {
  const colors = useColors();
  const cardStyle = useMemo(
    () => ({ backgroundColor: colors.surface, borderColor: colors.border }),
    [colors.surface, colors.border],
  );

  return (
    <View style={[styles.tabShell, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tabShellContent}
      >
        {/* Header row */}
        <View style={styles.tabShellHeaderRow}>
          <SkeletonPulse style={styles.tabShellTitle} />
          <SkeletonPulse style={styles.tabShellAvatar} />
        </View>

        {/* Hero card */}
        <View style={[styles.tabShellHero, cardStyle]}>
          <SkeletonPulse style={styles.tabShellHeroIcon} />
          <View style={styles.textGroup}>
            <SkeletonPulse style={styles.tabShellHeroBar} />
            <SkeletonPulse style={styles.tabShellHeroBarShort} />
          </View>
        </View>

        {/* Quick-link tiles */}
        <View style={styles.tabShellQuickRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[styles.tabShellQuickCard, cardStyle]}>
              <SkeletonPulse style={styles.tabShellQuickIcon} />
              <SkeletonPulse style={styles.tabShellQuickLabel} />
            </View>
          ))}
        </View>

        {/* List cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={[styles.tabShellCard, cardStyle]}>
            <View style={styles.row}>
              <SkeletonPulse style={styles.iconSquare} />
              <View style={styles.textGroup}>
                <SkeletonPulse style={styles.titleBar} />
                <SkeletonPulse style={styles.subtitleBar} />
              </View>
              <SkeletonPulse style={styles.pill} />
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Fake tab bar so the shell doesn't resize when tabs mount */}
      <View
        style={[
          styles.tabShellBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={styles.tabShellTabItem}>
            <SkeletonPulse style={styles.tabShellTabIcon} />
            <SkeletonPulse style={styles.tabShellTabLabel} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Porch Partner tab skeleton — hero card, active-holds rows, quick actions.
 */
export function PorchPartnerSkeleton() {
  const colors = useColors();
  const cardStyle = useMemo(
    () => ({ backgroundColor: colors.surface, borderColor: colors.border }),
    [colors.surface, colors.border],
  );

  return (
    <View style={styles.porchPartnerWrap}>
      <View style={[styles.ppHero, cardStyle]}>
        <SkeletonPulse style={styles.ppHeroIcon} />
        <SkeletonPulse style={styles.ppHeroTitle} />
        <SkeletonPulse style={styles.ppHeroBarWide} />
        <SkeletonPulse style={styles.ppHeroBar} />
      </View>

      <SkeletonPulse style={styles.ppSectionTitle} />
      {Array.from({ length: 2 }).map((_, i) => (
        <View key={i} style={[styles.ppRow, cardStyle]}>
          <SkeletonPulse style={styles.ppRowIcon} />
          <View style={styles.textGroup}>
            <SkeletonPulse style={styles.titleBar} />
            <SkeletonPulse style={styles.subtitleBar} />
          </View>
        </View>
      ))}

      <SkeletonPulse style={[styles.ppSectionTitle, { marginTop: 6 }]} />
      <View style={[styles.ppRow, cardStyle]}>
        <SkeletonPulse style={styles.ppRowIcon} />
        <SkeletonPulse style={styles.ppRowActionBar} />
      </View>
    </View>
  );
}

/**
 * Account tab skeleton — avatar header, role pill, and two settings cards.
 */
export function ProfileSkeleton() {
  const colors = useColors();

  return (
    <View style={[styles.profileWrap, { backgroundColor: colors.background }]}>
      <View style={[styles.profileHeader, { backgroundColor: colors.surface }]}>
        <SkeletonPulse style={styles.profileAvatar} />
        <SkeletonPulse style={styles.profileName} />
        <SkeletonPulse style={styles.profilePill} />
      </View>
      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={styles.row}>
            <SkeletonPulse style={styles.smallCircle} />
            <SkeletonPulse style={styles.profileRowBar} />
          </View>
        ))}
      </View>
      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={styles.row}>
            <SkeletonPulse style={styles.smallCircle} />
            <SkeletonPulse style={styles.profileRowBarShort} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    borderRadius: 6,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textGroup: {
    flex: 1,
    gap: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  iconSquare: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  smallCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  titleBar: {
    height: 14,
    width: 120,
    borderRadius: 4,
  },
  subtitleBar: {
    height: 10,
    width: 100,
    borderRadius: 4,
  },
  nameBar: {
    height: 12,
    width: 100,
    borderRadius: 4,
  },
  trackingBar: {
    height: 10,
    width: 70,
    borderRadius: 4,
  },
  badge: {
    height: 24,
    width: 64,
    borderRadius: 8,
  },
  pill: {
    height: 24,
    width: 80,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  listWrap: {
    paddingTop: 12,
  },

  // ── HomeDashboardSkeleton ───────────────────────────────────────────
  homeWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  homeGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  homeGreetingBar: {
    height: 22,
    width: 180,
    borderRadius: 5,
  },
  homeSubGreetingBar: {
    height: 13,
    width: 140,
    borderRadius: 4,
  },
  homeGreetingBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  homeQuickLinksRow: {
    gap: 8,
    paddingRight: 16,
    paddingVertical: 4,
    marginBottom: 12,
  },
  homeQuickLinkCard: {
    alignItems: 'center',
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    minWidth: 86,
    borderWidth: 1,
  },
  homeQuickLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  homeQuickLinkLabel: {
    height: 11,
    width: 50,
    borderRadius: 4,
  },
  homeRiskCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  homeRiskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  homeRiskTitle: {
    height: 16,
    width: 120,
    borderRadius: 4,
  },
  homeRiskBadge: {
    height: 28,
    width: 64,
    borderRadius: 14,
  },
  homeRiskBar: {
    height: 8,
    width: '100%',
    borderRadius: 4,
    marginBottom: 14,
  },
  homeRiskRow: {
    flexDirection: 'row',
    gap: 10,
  },
  homeRiskPill: {
    height: 24,
    width: 90,
    borderRadius: 8,
  },
  homeRiskPillShort: {
    height: 24,
    width: 60,
    borderRadius: 8,
  },
  homeSectionLabel: {
    height: 15,
    width: 110,
    borderRadius: 4,
    marginBottom: 12,
    marginLeft: 16,
  },
  homeShipmentsWrap: {
    paddingTop: 0,
  },

  // ── TabShellSkeleton ────────────────────────────────────────────────
  tabShell: {
    flex: 1,
  },
  tabShellContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  tabShellHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabShellTitle: {
    height: 24,
    width: 130,
    borderRadius: 6,
  },
  tabShellAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  tabShellHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  tabShellHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  tabShellHeroBar: {
    height: 14,
    width: 150,
    borderRadius: 4,
  },
  tabShellHeroBarShort: {
    height: 10,
    width: 100,
    borderRadius: 4,
  },
  tabShellQuickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabShellQuickCard: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  tabShellQuickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  tabShellQuickLabel: {
    height: 10,
    width: 44,
    borderRadius: 4,
  },
  tabShellCard: {
    borderRadius: 14,
    padding: 16,
  },
  tabShellBar: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabShellTabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabShellTabIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
  },
  tabShellTabLabel: {
    height: 9,
    width: 40,
    borderRadius: 4,
  },

  // ── PorchPartnerSkeleton ─────────────────────────────────────────────
  // No horizontal padding — the host screen's contentContainerStyle insets it.
  porchPartnerWrap: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  ppHero: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  ppHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginBottom: 2,
  },
  ppHeroTitle: {
    height: 18,
    width: 150,
    borderRadius: 5,
  },
  ppHeroBarWide: {
    height: 11,
    width: '85%',
    borderRadius: 4,
  },
  ppHeroBar: {
    height: 11,
    width: '60%',
    borderRadius: 4,
  },
  ppSectionTitle: {
    height: 13,
    width: 100,
    borderRadius: 4,
    marginBottom: 10,
  },
  ppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  ppRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  ppRowActionBar: {
    flex: 1,
    height: 14,
    borderRadius: 4,
  },

  // ── ProfileSkeleton ─────────────────────────────────────────────────
  profileWrap: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  profileAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  profileName: {
    height: 18,
    width: 140,
    borderRadius: 5,
  },
  profilePill: {
    height: 24,
    width: 110,
    borderRadius: 12,
  },
  profileCard: {
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 16,
  },
  profileRowBar: {
    flex: 1,
    height: 14,
    borderRadius: 4,
  },
  profileRowBarShort: {
    flex: 1,
    height: 11,
    borderRadius: 4,
  },
});
