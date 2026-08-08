import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Package,
  AlertTriangle,
  TrendingUp,
  Eye,
  HandHeart,
  ChevronRight,
  Star,
  Clock,
  CheckCircle,
  MapPin,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { useAlerts } from '@/store/AlertsContext';
import { usePackages } from '@/store/PackagesContext';
import { useNeighborhood } from '@/store/NeighborhoodContext';
import { isEnabled } from '@/lib/featureFlags';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const showPorchPartners = isEnabled('PORCH_PARTNERS');

function calculateSafetyScore(params: {
  partnerCount: number;
  completedHolds: number;
  activeAlerts: number;
  resolvedAlerts: number;
  deliveredPackages: number;
  activeShipments: number;
  weekEvents: number;
}): number {
  let score = 50;

  score += Math.min(params.partnerCount * 8, 20);
  score += Math.min(params.completedHolds * 2, 15);
  score -= Math.min(params.activeAlerts * 5, 15);
  score += Math.min(params.resolvedAlerts * 3, 10);
  score += Math.min(params.deliveredPackages * 1, 10);
  score += params.activeShipments > 0 ? 5 : 0;
  score += Math.min(params.weekEvents * 2, 10);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getScoreGrade(score: number): { label: string; color: string; bg: string; icon: React.ReactNode } {
  if (score >= 85) return { label: 'Excellent', color: '#059669', bg: '#ECFDF5', icon: <ShieldCheck size={20} color="#059669" /> };
  if (score >= 70) return { label: 'Good', color: Colors.primary, bg: Colors.skyBlue, icon: <Shield size={20} color={Colors.primary} /> };
  if (score >= 50) return { label: 'Fair', color: '#D97706', bg: '#FFFBEB', icon: <Shield size={20} color="#D97706" /> };
  return { label: 'Needs Attention', color: '#DC2626', bg: '#FEF2F2', icon: <ShieldAlert size={20} color="#DC2626" /> };
}

function AnimatedCircleProgress({ score, size = 160 }: { score: number; size?: number }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: score / 100,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const grade = getScoreGrade(score);

  return (
    <View style={[circleStyles.container, { width: size, height: size }]}>
      <View style={[circleStyles.trackCircle, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: Colors.borderLight }]} />
      <Animated.View
        style={[
          circleStyles.progressArc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: grade.color,
            borderRightColor: 'transparent',
            borderBottomColor: score > 50 ? grade.color : 'transparent',
            borderLeftColor: score > 75 ? grade.color : 'transparent',
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />
      <View style={circleStyles.innerContent}>
        <Text style={[circleStyles.scoreText, { color: grade.color }]}>{score}</Text>
        <Text style={circleStyles.scoreLabel}>/ 100</Text>
      </View>
    </View>
  );
}

const circleStyles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackCircle: {
    position: 'absolute',
  },
  progressArc: {
    position: 'absolute',
  },
  innerContent: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 42,
    fontWeight: '800' as const,
  },
  scoreLabel: {
    fontSize: 14,
    color: Colors.slateLighter,
    fontWeight: '500' as const,
    marginTop: -4,
  },
});

function StatCard({ icon, value, label, color, bg }: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[statStyles.card, { borderLeftColor: color }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: bg }]}>
        {icon}
      </View>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.slate,
  },
  label: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.slateLighter,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
});

function InsightCard({ icon, title, description, actionLabel, onPress, color, bg }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onPress?: () => void;
  color: string;
  bg: string;
}) {
  return (
    <TouchableOpacity
      style={insightStyles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[insightStyles.iconWrap, { backgroundColor: bg }]}>
        {icon}
      </View>
      <View style={insightStyles.content}>
        <Text style={insightStyles.title}>{title}</Text>
        <Text style={insightStyles.description}>{description}</Text>
      </View>
      {actionLabel && (
        <View style={insightStyles.actionWrap}>
          <Text style={[insightStyles.actionText, { color }]}>{actionLabel}</Text>
          <ChevronRight size={14} color={color} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const insightStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  description: {
    fontSize: 12,
    color: Colors.slateLight,
    lineHeight: 17,
  },
  actionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
});

export default function SafetyScoreScreen() {
  const router = useRouter();
  const { user } = useApp();
  const { activeShipments, completedShipments, refreshAllShipmentTracking } = useShipments();
  const { activePartners, holds } = usePorchPartners();
  const { alerts, activeCount } = useAlerts();
  const { packages, refreshAllPackages } = usePackages();
  const { weekCount } = useNeighborhood();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  // P-12: score breakdown collapsed by default — reference material behind a tap.
  const [breakdownExpanded, setBreakdownExpanded] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshAllPackages(), refreshAllShipmentTracking()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAllPackages, refreshAllShipmentTracking]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const completedHolds = useMemo(() =>
    holds.filter(h => h.status === 'returned').length,
    [holds]
  );

  const resolvedAlerts = useMemo(() =>
    alerts.filter(a => a.status === 'resolved').length,
    [alerts]
  );

  const deliveredPackages = useMemo(() =>
    packages.filter(p => p.currentStatus === 'delivered' || p.currentStatus === 'picked_up' || p.currentStatus === 'returned').length,
    [packages]
  );

  const score = useMemo(() => calculateSafetyScore({
    partnerCount: activePartners.length,
    completedHolds,
    activeAlerts: activeCount,
    resolvedAlerts,
    deliveredPackages,
    activeShipments: activeShipments.length,
    weekEvents: weekCount,
  }), [activePartners.length, completedHolds, activeCount, resolvedAlerts, deliveredPackages, activeShipments.length, weekCount]);

  const grade = getScoreGrade(score);

  const insights = useMemo(() => {
    const result: {
      icon: React.ReactNode;
      title: string;
      description: string;
      actionLabel?: string;
      route?: string;
      color: string;
      bg: string;
    }[] = [];

    if (showPorchPartners && activePartners.length < 3) {
      result.push({
        icon: <Users size={18} color={Colors.primary} />,
        title: 'Grow your partner network',
        description: `You have ${activePartners.length} partner${activePartners.length !== 1 ? 's' : ''}. Having 3+ partners significantly improves your block's safety.`,
        actionLabel: 'Invite',
        route: '/invite-partner',
        color: Colors.primary,
        bg: Colors.skyBlue,
      });
    }

    if (activeCount > 0) {
      result.push({
        icon: <AlertTriangle size={18} color="#D97706" />,
        title: `${activeCount} active alert${activeCount !== 1 ? 's' : ''} nearby`,
        description: 'Stay vigilant and report any suspicious activity you notice.',
        actionLabel: 'View',
        route: '/alerts',
        color: '#D97706',
        bg: '#FFFBEB',
      });
    }

    if (completedHolds > 0) {
      result.push({
        icon: <HandHeart size={18} color="#059669" />,
        title: `${completedHolds} packages safely returned`,
        description: 'Great teamwork! Your block is protecting each other\'s deliveries.',
        color: '#059669',
        bg: '#ECFDF5',
      });
    }

    if (showPorchPartners && activePartners.length >= 3) {
      result.push({
        icon: <ShieldCheck size={18} color="#059669" />,
        title: 'Strong partner network',
        description: `${activePartners.length} trusted neighbors are helping protect your block.`,
        actionLabel: 'View',
        route: '/partners',
        color: '#059669',
        bg: '#ECFDF5',
      });
    }

    if (deliveredPackages > 5) {
      result.push({
        icon: <TrendingUp size={18} color={Colors.primary} />,
        title: 'Active tracking',
        description: `${deliveredPackages} packages tracked and accounted for. Keep it up!`,
        color: Colors.primary,
        bg: Colors.skyBlue,
      });
    }

    if (result.length === 0) {
      result.push({
        icon: <Star size={18} color={Colors.secondary} />,
        title: 'Get started',
        description: 'Add packages and track deliveries to start building your safety score.',
        actionLabel: 'Start',
        route: '/add-package',
        color: Colors.secondary,
        bg: Colors.peach,
      });
    }

    return result;
  }, [activePartners.length, activeCount, completedHolds, deliveredPackages]);

  const handleInsightPress = useCallback((route?: string) => {
    if (route) router.push(route as any);
  }, [router]);

  const avgPartnerRating = useMemo(() => {
    if (activePartners.length === 0) return 0;
    const total = activePartners.reduce((sum, p) => sum + p.rating, 0);
    return (total / activePartners.length).toFixed(1);
  }, [activePartners]);

  const totalCompletedHolds = useMemo(() =>
    activePartners.reduce((sum, p) => sum + p.completedHolds, 0),
    [activePartners]
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{
        title: 'Block Safety Score',
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.primary,
        headerShadowVisible: false,
      }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.scoreSection}>
          <View style={[styles.gradeBanner, { backgroundColor: grade.bg }]}>
            {grade.icon}
            <Text style={[styles.gradeLabel, { color: grade.color }]}>{grade.label}</Text>
          </View>

          <AnimatedCircleProgress score={score} />

          <Text style={styles.blockName}>
            <MapPin size={13} color={Colors.slateLight} /> {user?.address ? user.address.split(',')[0] : 'Your Block'}
          </Text>
          <Text style={styles.scoreDescription}>
            {showPorchPartners
              ? 'Based on partner activity, alerts, and package tracking on your block.'
              : 'Based on alerts and package tracking on your block.'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Block Statistics</Text>
          {showPorchPartners && (
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Users size={16} color={Colors.primary} />}
              value={activePartners.length}
              label="Active Partners"
              color={Colors.primary}
              bg={Colors.skyBlue}
            />
            <StatCard
              icon={<HandHeart size={16} color="#059669" />}
              value={totalCompletedHolds}
              label="Total Holds"
              color="#059669"
              bg="#ECFDF5"
            />
          </View>
          )}
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Package size={16} color={Colors.secondary} />}
              value={deliveredPackages}
              label="Tracked Pkgs"
              color={Colors.secondary}
              bg={Colors.peach}
            />
            <StatCard
              icon={<AlertTriangle size={16} color="#D97706" />}
              value={activeCount}
              label="Active Alerts"
              color="#D97706"
              bg="#FFFBEB"
            />
          </View>
          <View style={styles.statsGrid}>
            {showPorchPartners && (
            <StatCard
              icon={<Star size={16} color="#F59E0B" />}
              value={avgPartnerRating}
              label="Avg Rating"
              color="#F59E0B"
              bg="#FFFBEB"
            />
            )}
            <StatCard
              icon={<Eye size={16} color="#7C3AED" />}
              value={weekCount}
              label="Week Events"
              color="#7C3AED"
              bg="#F5F3FF"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights & Tips</Text>
          {insights.map((insight, idx) => (
            <InsightCard
              key={idx}
              icon={insight.icon}
              title={insight.title}
              description={insight.description}
              actionLabel={insight.actionLabel}
              onPress={insight.route ? () => handleInsightPress(insight.route) : undefined}
              color={insight.color}
              bg={insight.bg}
            />
          ))}
        </View>

        {/* P-13: redundant Quick Actions section removed — the same actions
            (Invite Partner, View Alerts, Network Map) are already on the home
            screen's quick links. Keeping them here stacked decision paralysis
            on an already data-dense screen. */}

        <View style={styles.scoreBreakdown}>
          <TouchableOpacity
            style={styles.breakdownHeader}
            onPress={() => setBreakdownExpanded((v) => !v)}
            activeOpacity={0.7}
            testID="score-breakdown-toggle"
          >
            <Text style={styles.sectionTitle}>How Your Score is Calculated</Text>
            <ChevronRight
              size={18}
              color={Colors.slateLight}
              style={{ transform: [{ rotate: breakdownExpanded ? '90deg' : '0deg' }] }}
            />
          </TouchableOpacity>
          {breakdownExpanded && (
          <View style={styles.breakdownCard}>
            {[
              ...(showPorchPartners ? [
                { label: 'Partner network size', points: `+${Math.min(activePartners.length * 8, 20)}`, max: 20 },
                { label: 'Completed holds', points: `+${Math.min(completedHolds * 2, 15)}`, max: 15 },
              ] : []),
              { label: 'Active alerts (penalty)', points: `-${Math.min(activeCount * 5, 15)}`, max: 15 },
              { label: 'Resolved alerts', points: `+${Math.min(resolvedAlerts * 3, 10)}`, max: 10 },
              { label: 'Tracked deliveries', points: `+${Math.min(deliveredPackages * 1, 10)}`, max: 10 },
              { label: 'Active shipments', points: `+${activeShipments.length > 0 ? 5 : 0}`, max: 5 },
              { label: 'Weekly block activity', points: `+${Math.min(weekCount * 2, 10)}`, max: 10 },
            ].map((item, idx) => (
              <View key={idx} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <View style={styles.breakdownRight}>
                  <Text style={[
                    styles.breakdownPoints,
                    { color: item.points.startsWith('-') ? '#DC2626' : '#059669' }
                  ]}>
                    {item.points}
                  </Text>
                  <Text style={styles.breakdownMax}>/ {item.max}</Text>
                </View>
              </View>
            ))}
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownTotalLabel}>Base score</Text>
              <Text style={styles.breakdownTotalValue}>50</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownTotalLabel, { fontWeight: '700' as const }]}>Final Score</Text>
              <Text style={[styles.breakdownTotalValue, { fontWeight: '800' as const, color: grade.color }]}>{score}</Text>
            </View>
          </View>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  scoreSection: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  gradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  blockName: {
    fontSize: 14,
    color: Colors.slateLight,
    fontWeight: '500' as const,
    marginTop: 16,
    marginBottom: 6,
  },
  scoreDescription: {
    fontSize: 13,
    color: Colors.slateLighter,
    textAlign: 'center' as const,
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  scoreBreakdown: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  breakdownCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: Colors.slateLight,
    flex: 1,
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breakdownPoints: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  breakdownMax: {
    fontSize: 11,
    color: Colors.slateLighter,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 6,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  breakdownTotalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.slate,
  },
});
