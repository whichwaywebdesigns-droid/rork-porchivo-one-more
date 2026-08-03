import React, { useRef, useEffect, useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Package,
  AlertTriangle,
  Users,
  Megaphone,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle,
  BarChart2,
  ShieldCheck,
  Building2,
  Zap,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  PackageAnalytics,
  IncidentAnalytics,
  CommunityAnalyticsData,
  CommunityHealthScore,
  CarrierCount,
  DailyVolume,
  TypeCount,
} from '@/types/organization';
import { CARRIER_META } from '@/types/organization';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40;

// ─── Period selector ─────────────────────────────────────────────────────────

type Period = 7 | 30 | 90;
const PERIODS: Period[] = [7, 30, 90];
const PERIOD_LABELS: Record<Period, string> = { 7: '7d', 30: '30d', 90: '90d' };

// ─── Animated number ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, style }: { value: number; style: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState<number>(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 900,
      useNativeDriver: false,
    }).start();
    anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeAllListeners();
  }, [value, anim]);

  return <Text style={style}>{display}</Text>;
}

// ─── Health ring ─────────────────────────────────────────────────────────────

function HealthRing({ score, grade, status }: { score: number; grade: string; status: string }) {
  const Colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score / 100,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [score, anim]);

  const ringColor =
    score >= 85 ? Colors.success :
    score >= 65 ? Colors.gold :
    score >= 45 ? Colors.secondary :
    Colors.danger;

  const gradeColor = ringColor;

  // Ring built from border arcs using layered views
  const SIZE = 128;
  const STROKE = 10;

  return (
    <View style={styles.healthRingWrap}>
      {/* Background ring */}
      <View
        style={[
          styles.ringOuter,
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            borderColor: ringColor + '22',
            borderWidth: STROKE,
          },
        ]}
      />
      {/* Score labels */}
      <View style={styles.ringInner}>
        <Text style={[styles.ringScore, { color: Colors.slate }]}>{score}</Text>
        <View style={[styles.gradeChip, { backgroundColor: ringColor + '1A', borderColor: ringColor + '40' }]}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{grade}</Text>
        </View>
      </View>
      {/* Status label below ring */}
      <Text style={[styles.healthStatus, { color: ringColor }]}>{status}</Text>
    </View>
  );
}

// ─── Score bar ───────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const Colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;
  const pct = Math.min(1, value / max);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [pct, anim]);

  const barWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.scoreBarRow}>
      <Text style={[styles.scoreBarLabel, { color: Colors.slateLight }]}>{label}</Text>
      <View style={styles.scoreBarRight}>
        <View style={[styles.scoreBarTrack, { backgroundColor: Colors.border }]}>
          <Animated.View
            style={[
              styles.scoreBarFill,
              { backgroundColor: color, width: barWidth },
            ]}
          />
        </View>
        <Text style={[styles.scoreBarValue, { color: Colors.slate }]}>
          {value}/{max}
        </Text>
      </View>
    </View>
  );
}

// ─── Sparkline bar chart ──────────────────────────────────────────────────────

function SparklineChart({
  data,
  color,
  height = 56,
}: {
  data: DailyVolume[];
  color: string;
  height?: number;
}) {
  const Colors = useColors();
  const anims = useRef(data.map(() => new Animated.Value(0))).current;
  const maxVal = Math.max(1, ...data.map((d) => d.count));

  useEffect(() => {
    const animations = anims.map((a, i) =>
      Animated.timing(a, {
        toValue: data[i]?.count ?? 0,
        duration: 600 + i * 40,
        useNativeDriver: false,
      })
    );
    Animated.stagger(25, animations).start();
  }, [data, anims]);

  const BAR_GAP = 2;
  const barWidth = Math.max(4, CHART_WIDTH / data.length - BAR_GAP);

  return (
    <View style={[styles.sparklineWrap, { height }]}>
      {data.map((d, i) => {
        const barH = anims[i].interpolate({
          inputRange: [0, maxVal],
          outputRange: [3, height],
        });
        return (
          <View key={d.day} style={styles.sparklineBarCol}>
            <Animated.View
              style={[
                styles.sparklineBar,
                {
                  width: barWidth,
                  height: barH,
                  backgroundColor: color,
                  opacity: d.count === 0 ? 0.2 : 0.85,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HorizontalBar({
  label,
  value,
  total,
  color,
  emoji,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  emoji?: string;
}) {
  const Colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;
  const pct = total === 0 ? 0 : Math.min(1, value / total);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [pct, anim]);

  const barWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.hBarRow}>
      <Text style={[styles.hBarLabel, { color: Colors.slateLight }]} numberOfLines={1}>
        {emoji ? `${emoji} ` : ''}{label}
      </Text>
      <View style={[styles.hBarTrack, { backgroundColor: Colors.border }]}>
        <Animated.View
          style={[styles.hBarFill, { backgroundColor: color + 'CC', width: barWidth }]}
        />
      </View>
      <Text style={[styles.hBarValue, { color: Colors.slate }]}>{value}</Text>
    </View>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  subValue,
  subLabel,
  accent,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue?: number | string;
  subLabel?: string;
  accent: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const TrendIcon =
    trend === 'up' ? TrendingUp :
    trend === 'down' ? TrendingDown :
    Minus;

  const trendColor =
    trend === 'up' ? Colors.success :
    trend === 'down' ? Colors.danger :
    Colors.slateLighter;

  return (
    <Animated.View
      style={[
        styles.kpiCard,
        {
          backgroundColor: Colors.surface,
          borderColor: Colors.border,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.kpiIconWrap, { backgroundColor: accent + '18' }]}>{icon}</View>
      <Text style={[styles.kpiValue, { color: Colors.slate }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: Colors.slateLighter }]}>{label}</Text>
      {subValue !== undefined && (
        <View style={styles.kpiSub}>
          <TrendIcon size={10} color={trendColor} strokeWidth={2.5} />
          <Text style={[styles.kpiSubText, { color: trendColor }]}>
            {subValue} {subLabel}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  const Colors = useColors();
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadLeft}>
        {icon}
        <View>
          <Text style={[styles.sectionTitle, { color: Colors.slate }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.sectionSub, { color: Colors.slateLighter }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider() {
  const Colors = useColors();
  return <View style={[styles.divider, { backgroundColor: Colors.border }]} />;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AnalyticsDashboardScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, activeMembership, orgRole } = useOrganization();

  const [period, setPeriod] = useState<Period>(30);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const orgId = activeOrg?.id;

  // ── Package analytics ───────────────────────────────────────────────────
  const {
    data: pkgData,
    isLoading: pkgLoading,
  } = useQuery<PackageAnalytics | null>({
    queryKey: ['analytics-packages', orgId, period],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc('get_package_analytics', {
        p_org_id: orgId,
        p_days: period,
      });
      if (error || !data) return null;
      return data as PackageAnalytics;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  // ── Incident analytics ──────────────────────────────────────────────────
  const {
    data: incData,
    isLoading: incLoading,
  } = useQuery<IncidentAnalytics | null>({
    queryKey: ['analytics-incidents', orgId, period],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc('get_incident_analytics', {
        p_org_id: orgId,
        p_days: period,
      });
      if (error || !data) return null;
      return data as IncidentAnalytics;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  // ── Community analytics ─────────────────────────────────────────────────
  const {
    data: communityData,
    isLoading: communityLoading,
  } = useQuery<CommunityAnalyticsData | null>({
    queryKey: ['analytics-community', orgId, period],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc('get_community_analytics', {
        p_org_id: orgId,
        p_days: period,
      });
      if (error || !data) return null;
      return data as CommunityAnalyticsData;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  // ── Health score ────────────────────────────────────────────────────────
  const {
    data: healthData,
    isLoading: healthLoading,
  } = useQuery<CommunityHealthScore | null>({
    queryKey: ['analytics-health', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc('get_community_health_score', {
        p_org_id: orgId,
      });
      if (error || !data) return null;
      return data as CommunityHealthScore;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['analytics-packages', orgId, period] }),
      queryClient.invalidateQueries({ queryKey: ['analytics-incidents', orgId, period] }),
      queryClient.invalidateQueries({ queryKey: ['analytics-community', orgId, period] }),
      queryClient.invalidateQueries({ queryKey: ['analytics-health', orgId] }),
    ]);
    setRefreshing(false);
  };

  if (!activeOrg || !activeMembership) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  const isLoading = pkgLoading || incLoading || communityLoading || healthLoading;

  // Derived values
  const pkgTotal = pkgData?.total ?? 0;
  const pkgStatusData = pkgData
    ? [
        { label: 'Received', value: pkgData.received, color: Colors.secondary },
        { label: 'Ready', value: pkgData.ready, color: Colors.primary },
        { label: 'Picked Up', value: pkgData.picked_up, color: Colors.success },
        { label: 'Exception', value: pkgData.exception, color: Colors.danger },
      ]
    : [];

  const incResolutionRate =
    incData && incData.total > 0
      ? Math.round(((incData.resolved + incData.closed) / incData.total) * 100)
      : 0;

  const occupancyRate =
    communityData && communityData.total_units > 0
      ? Math.round((communityData.occupied_units / communityData.total_units) * 100)
      : 0;

  const healthScore = healthData?.score ?? 0;
  const healthGrade = healthData?.grade ?? 'A';
  const healthStatus = healthData?.status ?? 'Healthy';

  const scoreColor =
    healthScore >= 85 ? Colors.success :
    healthScore >= 65 ? Colors.gold :
    healthScore >= 45 ? Colors.secondary :
    Colors.danger;

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
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Analytics</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {activeOrg.name}
          </Text>
        </View>
        {/* Period selector */}
        <View style={[styles.periodPills, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodPill,
                period === p && { backgroundColor: Colors.primary },
              ]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.periodPillText,
                  { color: period === p ? '#fff' : Colors.slateLight },
                ]}
              >
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: Colors.slateLighter }]}>
            Crunching the numbers…
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          {/* ── Health score banner ────────────────────────────────────────── */}
          <View
            style={[
              styles.healthCard,
              {
                backgroundColor: scoreColor + '0D',
                borderColor: scoreColor + '30',
                marginHorizontal: 20,
                marginTop: 20,
              },
            ]}
          >
            <View style={styles.healthLeft}>
              <Text style={[styles.healthTitle, { color: Colors.slate }]}>
                Community Health
              </Text>
              <Text style={[styles.healthDesc, { color: Colors.slateLight }]}>
                Composite score based on packages, incidents, and member queue
              </Text>

              <View style={{ marginTop: 12, gap: 6 }}>
                <ScoreBar
                  label="Packages"
                  value={healthData?.pkg_score ?? 0}
                  max={40}
                  color={Colors.secondary}
                />
                <ScoreBar
                  label="Incidents"
                  value={healthData?.inc_score ?? 0}
                  max={40}
                  color={Colors.danger}
                />
                <ScoreBar
                  label="Members"
                  value={healthData?.member_score ?? 0}
                  max={20}
                  color={Colors.primary}
                />
              </View>
            </View>

            {healthData ? (
              <HealthRing
                score={healthScore}
                grade={healthGrade}
                status={healthStatus}
              />
            ) : (
              <ActivityIndicator color={Colors.primary} />
            )}
          </View>

          {/* ── KPI strip ──────────────────────────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiRow}
          >
            <KpiCard
              icon={<Package size={18} color={Colors.secondary} />}
              label="Packages"
              value={pkgData?.total ?? 0}
              subValue={pkgData?.today ?? 0}
              subLabel="today"
              accent={Colors.secondary}
              trend="neutral"
            />
            <KpiCard
              icon={<AlertTriangle size={18} color={Colors.danger} />}
              label="Incidents"
              value={incData?.total ?? 0}
              subValue={incData?.open ?? 0}
              subLabel="open"
              accent={Colors.danger}
              trend={(incData?.open ?? 0) > 0 ? 'down' : 'neutral'}
            />
            <KpiCard
              icon={<Users size={18} color={Colors.primary} />}
              label="Members"
              value={communityData?.total_members ?? 0}
              subValue={communityData?.new_this_month ?? 0}
              subLabel="new"
              accent={Colors.primary}
              trend={(communityData?.new_this_month ?? 0) > 0 ? 'up' : 'neutral'}
            />
            <KpiCard
              icon={<Megaphone size={18} color={Colors.gold} />}
              label="Posts"
              value={communityData?.total_announcements ?? 0}
              subValue={communityData?.total_announcement_views ?? 0}
              subLabel="views"
              accent={Colors.gold}
              trend="neutral"
            />
            <KpiCard
              icon={<ShieldCheck size={18} color={Colors.success} />}
              label="SLA Rate"
              value={`${incData?.sla_compliance_pct ?? 100}%`}
              accent={Colors.success}
              trend={(incData?.sla_compliance_pct ?? 100) >= 80 ? 'up' : 'down'}
            />
            <KpiCard
              icon={<Clock size={18} color={Colors.primary} />}
              label="Avg Pickup"
              value={pkgData?.avg_pickup_hours != null ? `${pkgData.avg_pickup_hours}h` : '—'}
              accent={Colors.primary}
              trend="neutral"
            />
          </ScrollView>

          <Divider />

          {/* ── Package section ────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionHeader
              title="Package Volume"
              subtitle={`Last ${period} days — ${pkgData?.total ?? 0} total`}
              icon={<Package size={16} color={Colors.secondary} style={{ marginRight: 8, marginTop: 1 }} />}
            />

            {/* 14-day sparkline */}
            {pkgData?.daily_volumes && pkgData.daily_volumes.length > 0 ? (
              <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <Text style={[styles.chartLabel, { color: Colors.slateLighter }]}>
                  Daily arrivals (14 days)
                </Text>
                <SparklineChart
                  data={pkgData.daily_volumes}
                  color={Colors.secondary}
                  height={64}
                />
                <View style={styles.sparklineDates}>
                  <Text style={[styles.sparklineDate, { color: Colors.slateLighter }]}>
                    {pkgData.daily_volumes[0]?.day}
                  </Text>
                  <Text style={[styles.sparklineDate, { color: Colors.slateLighter }]}>
                    {pkgData.daily_volumes[pkgData.daily_volumes.length - 1]?.day}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Status breakdown */}
            <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Text style={[styles.chartLabel, { color: Colors.slateLighter }]}>
                Status breakdown
              </Text>
              {pkgStatusData.map((item) => (
                <HorizontalBar
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  total={Math.max(1, pkgTotal)}
                  color={item.color}
                />
              ))}
            </View>

            {/* Carrier breakdown */}
            {pkgData?.by_carrier && pkgData.by_carrier.length > 0 ? (
              <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <Text style={[styles.chartLabel, { color: Colors.slateLighter }]}>
                  Top carriers
                </Text>
                {pkgData.by_carrier.map((c: CarrierCount) => {
                  const meta = CARRIER_META[c.carrier] ?? { color: '#6B7F99', label: c.carrier };
                  return (
                    <HorizontalBar
                      key={c.carrier}
                      label={meta.label}
                      value={c.count}
                      total={Math.max(1, pkgTotal)}
                      color={meta.color}
                    />
                  );
                })}
              </View>
            ) : null}

            {/* Overdue call-out */}
            {(pkgData?.overdue_count ?? 0) > 0 ? (
              <View
                style={[
                  styles.alertBanner,
                  { backgroundColor: Colors.danger + '0F', borderColor: Colors.danger + '30' },
                ]}
              >
                <AlertTriangle size={15} color={Colors.danger} />
                <Text style={[styles.alertText, { color: Colors.danger }]}>
                  {pkgData!.overdue_count} package{pkgData!.overdue_count !== 1 ? 's' : ''} held over 3 days without pickup
                </Text>
              </View>
            ) : null}
          </View>

          <Divider />

          {/* ── Incident section ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionHeader
              title="Incident Review"
              subtitle={`Last ${period} days — ${incData?.total ?? 0} filed`}
              icon={<AlertTriangle size={16} color={Colors.danger} style={{ marginRight: 8, marginTop: 1 }} />}
            />

            {/* Resolution rate */}
            <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <View style={styles.incResolutionRow}>
                <View>
                  <Text style={[styles.incResolutionLabel, { color: Colors.slateLighter }]}>
                    Resolution rate
                  </Text>
                  <Text style={[styles.incResolutionValue, { color: Colors.slate }]}>
                    {incResolutionRate}%
                  </Text>
                </View>
                <View>
                  <Text style={[styles.incResolutionLabel, { color: Colors.slateLighter }]}>
                    SLA compliance
                  </Text>
                  <Text
                    style={[
                      styles.incResolutionValue,
                      {
                        color:
                          (incData?.sla_compliance_pct ?? 100) >= 80
                            ? Colors.success
                            : Colors.danger,
                      },
                    ]}
                  >
                    {incData?.sla_compliance_pct ?? 100}%
                  </Text>
                </View>
                <View>
                  <Text style={[styles.incResolutionLabel, { color: Colors.slateLighter }]}>
                    Avg resolve
                  </Text>
                  <Text style={[styles.incResolutionValue, { color: Colors.slate }]}>
                    {incData?.avg_resolution_hours != null
                      ? `${incData.avg_resolution_hours}h`
                      : '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Status breakdown */}
            <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Text style={[styles.chartLabel, { color: Colors.slateLighter }]}>
                Status breakdown
              </Text>
              <HorizontalBar label="Open" value={incData?.open ?? 0} total={Math.max(1, incData?.total ?? 1)} color={Colors.secondary} />
              <HorizontalBar label="Escalated" value={incData?.escalated ?? 0} total={Math.max(1, incData?.total ?? 1)} color={Colors.danger} />
              <HorizontalBar label="Resolved" value={incData?.resolved ?? 0} total={Math.max(1, incData?.total ?? 1)} color={Colors.success} />
              <HorizontalBar label="Closed" value={incData?.closed ?? 0} total={Math.max(1, incData?.total ?? 1)} color={Colors.slateLighter} />
            </View>

            {/* By type */}
            {incData?.by_type && incData.by_type.length > 0 ? (
              <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <Text style={[styles.chartLabel, { color: Colors.slateLighter }]}>
                  Incident types
                </Text>
                {incData.by_type.map((t: TypeCount) => (
                  <HorizontalBar
                    key={t.type}
                    label={t.type.replace(/_/g, ' ')}
                    value={t.count}
                    total={Math.max(1, incData.total)}
                    color={Colors.secondary}
                  />
                ))}
              </View>
            ) : null}

            {/* Trend tags */}
            {incData?.top_trend_tags && incData.top_trend_tags.length > 0 ? (
              <View style={styles.tagRow}>
                {incData.top_trend_tags.map((t) => (
                  <View
                    key={t.tag}
                    style={[
                      styles.trendTag,
                      { backgroundColor: Colors.secondary + '14', borderColor: Colors.secondary + '35' },
                    ]}
                  >
                    <Zap size={10} color={Colors.secondary} />
                    <Text style={[styles.trendTagText, { color: Colors.secondary }]}>
                      {t.tag.replace(/-/g, ' ')}
                    </Text>
                    <Text style={[styles.trendTagCount, { color: Colors.secondary + 'AA' }]}>
                      ×{t.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Overdue incidents */}
            {(incData?.overdue ?? 0) > 0 ? (
              <View
                style={[
                  styles.alertBanner,
                  { backgroundColor: Colors.danger + '0F', borderColor: Colors.danger + '30' },
                ]}
              >
                <AlertTriangle size={15} color={Colors.danger} />
                <Text style={[styles.alertText, { color: Colors.danger }]}>
                  {incData!.overdue} overdue incident{incData!.overdue !== 1 ? 's' : ''} past SLA deadline
                </Text>
              </View>
            ) : null}
          </View>

          <Divider />

          {/* ── Community section ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionHeader
              title="Community"
              subtitle="Members, properties, and engagement"
              icon={<Users size={16} color={Colors.primary} style={{ marginRight: 8, marginTop: 1 }} />}
            />

            {/* Member stats */}
            <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Text style={[styles.chartLabel, { color: Colors.slateLighter }]}>
                Membership
              </Text>
              <View style={styles.memberStatsRow}>
                <View style={styles.memberStat}>
                  <Text style={[styles.memberStatValue, { color: Colors.slate }]}>
                    {communityData?.total_members ?? 0}
                  </Text>
                  <Text style={[styles.memberStatLabel, { color: Colors.slateLighter }]}>
                    Active
                  </Text>
                </View>
                <View style={[styles.memberStatDivider, { backgroundColor: Colors.border }]} />
                <View style={styles.memberStat}>
                  <Text style={[styles.memberStatValue, { color: Colors.gold }]}>
                    {communityData?.pending_members ?? 0}
                  </Text>
                  <Text style={[styles.memberStatLabel, { color: Colors.slateLighter }]}>
                    Pending
                  </Text>
                </View>
                <View style={[styles.memberStatDivider, { backgroundColor: Colors.border }]} />
                <View style={styles.memberStat}>
                  <Text style={[styles.memberStatValue, { color: Colors.success }]}>
                    {communityData?.new_this_month ?? 0}
                  </Text>
                  <Text style={[styles.memberStatLabel, { color: Colors.slateLighter }]}>
                    This Month
                  </Text>
                </View>
              </View>
            </View>

            {/* Occupancy */}
            {(communityData?.total_units ?? 0) > 0 ? (
              <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                <View style={styles.occupancyRow}>
                  <View>
                    <Text style={[styles.chartLabel, { color: Colors.slateLighter }]}>
                      Unit occupancy
                    </Text>
                    <Text style={[styles.occupancyRate, { color: Colors.primary }]}>
                      {occupancyRate}%
                    </Text>
                  </View>
                  <View style={styles.occupancyStats}>
                    <Text style={[styles.occupancyStat, { color: Colors.slate }]}>
                      <Text style={{ fontWeight: '700' as const }}>{communityData?.occupied_units ?? 0}</Text>
                      {' '}occupied
                    </Text>
                    <Text style={[styles.occupancyStat, { color: Colors.slateLighter }]}>
                      <Text style={{ fontWeight: '700' as const }}>
                        {(communityData?.total_units ?? 0) - (communityData?.occupied_units ?? 0)}
                      </Text>
                      {' '}vacant
                    </Text>
                  </View>
                </View>
                <View style={[styles.occupancyTrack, { backgroundColor: Colors.border }]}>
                  <View
                    style={[
                      styles.occupancyFill,
                      {
                        backgroundColor: Colors.primary,
                        width: `${occupancyRate}%` as unknown as number,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {/* Announcements */}
            <View style={[styles.chartCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Text style={[styles.chartLabel, { color: Colors.slateLighter }]}>
                Announcements
              </Text>
              <View style={styles.memberStatsRow}>
                <View style={styles.memberStat}>
                  <Text style={[styles.memberStatValue, { color: Colors.slate }]}>
                    {communityData?.total_announcements ?? 0}
                  </Text>
                  <Text style={[styles.memberStatLabel, { color: Colors.slateLighter }]}>
                    Active
                  </Text>
                </View>
                <View style={[styles.memberStatDivider, { backgroundColor: Colors.border }]} />
                <View style={styles.memberStat}>
                  <Text style={[styles.memberStatValue, { color: Colors.gold }]}>
                    {communityData?.announcements_this_month ?? 0}
                  </Text>
                  <Text style={[styles.memberStatLabel, { color: Colors.slateLighter }]}>
                    This Month
                  </Text>
                </View>
                <View style={[styles.memberStatDivider, { backgroundColor: Colors.border }]} />
                <View style={styles.memberStat}>
                  <Text style={[styles.memberStatValue, { color: Colors.secondary }]}>
                    {communityData?.total_announcement_views ?? 0}
                  </Text>
                  <Text style={[styles.memberStatLabel, { color: Colors.slateLighter }]}>
                    Total Views
                  </Text>
                </View>
              </View>
            </View>

            {/* Audit activity */}
            <View
              style={[
                styles.auditBanner,
                { backgroundColor: Colors.surface, borderColor: Colors.border },
              ]}
            >
              <BarChart2 size={16} color={Colors.primary} />
              <Text style={[styles.auditText, { color: Colors.slateLight }]}>
                <Text style={{ fontWeight: '700' as const, color: Colors.slate }}>
                  {communityData?.admin_actions_this_month ?? 0}
                </Text>
                {' '}admin actions logged this month
              </Text>
            </View>

            {/* Properties */}
            {(communityData?.total_properties ?? 0) > 0 ? (
              <View
                style={[
                  styles.auditBanner,
                  { backgroundColor: Colors.surface, borderColor: Colors.border, marginTop: 8 },
                ]}
              >
                <Building2 size={16} color={Colors.secondary} />
                <Text style={[styles.auditText, { color: Colors.slateLight }]}>
                  <Text style={{ fontWeight: '700' as const, color: Colors.slate }}>
                    {communityData?.total_properties}
                  </Text>
                  {' '}active propert{(communityData?.total_properties ?? 1) !== 1 ? 'ies' : 'y'} ·{' '}
                  <Text style={{ fontWeight: '700' as const, color: Colors.slate }}>
                    {communityData?.total_units ?? 0}
                  </Text>
                  {' '}total units
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Bottom tip ────────────────────────────────────────────────── */}
          <View style={[styles.footerTip, { marginHorizontal: 20 }]}>
            <CheckCircle size={13} color={Colors.slateLighter} />
            <Text style={[styles.footerTipText, { color: Colors.slateLighter }]}>
              Data refreshes every 5 minutes. Pull to refresh for live numbers.
            </Text>
          </View>
        </ScrollView>
      )}
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

  // Period pills
  periodPills: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 2,
    gap: 1,
  },
  periodPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  periodPillText: { fontSize: 12, fontWeight: '700' as const },

  // Loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  // Health card
  healthCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  healthLeft: { flex: 1 },
  healthTitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  healthDesc: { fontSize: 12, marginTop: 3, lineHeight: 16 },

  // Score bar
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBarLabel: { fontSize: 11, width: 64 },
  scoreBarRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreBarTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },
  scoreBarValue: { fontSize: 11, fontWeight: '600' as const, width: 30, textAlign: 'right' },

  // Health ring
  healthRingWrap: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  ringOuter: { position: 'absolute' },
  ringInner: { alignItems: 'center', gap: 4 },
  ringScore: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -1 },
  gradeChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  gradeText: { fontSize: 12, fontWeight: '800' as const },
  healthStatus: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3 },

  // KPI row
  kpiRow: { paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  kpiCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minWidth: 90,
    alignItems: 'center',
    gap: 4,
  },
  kpiIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5, marginTop: 4 },
  kpiLabel: { fontSize: 11, fontWeight: '500' as const },
  kpiSub: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  kpiSubText: { fontSize: 10, fontWeight: '600' as const },

  // Divider
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginVertical: 4 },

  // Section
  section: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  sectionSub: { fontSize: 12, marginTop: 2 },

  // Chart card
  chartCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  chartLabel: { fontSize: 12, fontWeight: '600' as const, marginBottom: 2 },

  // Sparkline
  sparklineWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  sparklineBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  sparklineBar: { borderRadius: 2 },
  sparklineDates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sparklineDate: { fontSize: 10 },

  // Horizontal bar
  hBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hBarLabel: { fontSize: 12, width: 88, textTransform: 'capitalize' },
  hBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  hBarFill: { height: '100%', borderRadius: 3 },
  hBarValue: { fontSize: 12, fontWeight: '700' as const, width: 28, textAlign: 'right' },

  // Alert banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  alertText: { fontSize: 13, fontWeight: '600' as const, flex: 1 },

  // Incident metrics
  incResolutionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  incResolutionLabel: { fontSize: 11, marginBottom: 4 },
  incResolutionValue: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },

  // Trend tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  trendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  trendTagText: { fontSize: 11, fontWeight: '600' as const, textTransform: 'capitalize' },
  trendTagCount: { fontSize: 10, fontWeight: '700' as const },

  // Member stats
  memberStatsRow: { flexDirection: 'row', alignItems: 'center' },
  memberStat: { flex: 1, alignItems: 'center', gap: 2 },
  memberStatValue: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5 },
  memberStatLabel: { fontSize: 11 },
  memberStatDivider: { width: StyleSheet.hairlineWidth, height: 36 },

  // Occupancy
  occupancyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  occupancyRate: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -1 },
  occupancyStats: { alignItems: 'flex-end', gap: 2 },
  occupancyStat: { fontSize: 12 },
  occupancyTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  occupancyFill: { height: '100%', borderRadius: 4 },

  // Audit banner
  auditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  auditText: { fontSize: 13, flex: 1 },

  // Footer tip
  footerTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    padding: 12,
  },
  footerTipText: { fontSize: 11, flex: 1 },
});
