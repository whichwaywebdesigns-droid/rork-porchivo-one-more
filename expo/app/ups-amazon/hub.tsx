import React, {
  useEffect,
  useRef,
} from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/store/AppContext';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronRight,
  Lock,
  MapPin,
  Package,
  RefreshCw,
  Shield,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

const AMAZON_ORANGE = '#FF9900';
const UPS_BROWN = '#351C15';
const UPS_GOLD = '#FFB500';
const BG = '#F2F3F4';
const WHITE = '#FFFFFF';
const NAVY = '#1B2A4A';
const SLATE = '#4B5563';
const SLATE_LIGHT = '#9CA3AF';

// ─── Service Data ─────────────────────────────────────────────────────────────

interface Service {
  id: string;
  route: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  badge?: string;
  accentColor: string;
  bgColor: string;
  isAmazon: boolean;
}

const SERVICES: Service[] = [
  {
    id: 'code-ready',
    route: '/ups-amazon/code-ready',
    title: 'Code Ready',
    subtitle: 'OTP delivery verification — share the code safely with your driver',
    icon: Lock,
    badge: 'Amazon',
    accentColor: AMAZON_ORANGE,
    bgColor: '#FFF8EC',
    isAmazon: true,
  },
  {
    id: 'not-delivered',
    route: '/ups-amazon/not-delivered',
    title: 'Missing Package',
    subtitle: 'File an A-to-Z claim for packages marked delivered but missing',
    icon: AlertTriangle,
    badge: 'Amazon',
    accentColor: '#DC2626',
    bgColor: '#FEF2F2',
    isAmazon: true,
  },
  {
    id: 'intercept',
    route: '/ups-amazon/intercept',
    title: 'Package Intercept',
    subtitle: 'Reroute, hold, or reschedule an in-transit UPS shipment',
    icon: RefreshCw,
    badge: 'UPS',
    accentColor: UPS_GOLD,
    bgColor: '#FFF8E1',
    isAmazon: false,
  },
  {
    id: 'live-tracking',
    route: '/ups-amazon/live-tracking',
    title: 'Live Driver Track',
    subtitle: 'Real-time driver location, stop count, and ETA countdown',
    icon: Truck,
    badge: 'Amazon',
    accentColor: '#131A22',
    bgColor: '#F1F3F5',
    isAmazon: true,
  },
  {
    id: 'access-points',
    route: '/ups-amazon/access-points',
    title: 'Access Points',
    subtitle: 'Find nearby UPS lockers and partner stores to hold your package',
    icon: Building2,
    badge: 'UPS',
    accentColor: UPS_BROWN,
    bgColor: '#FFF8E1',
    isAmazon: false,
  },
];

const PRO_TIPS = [
  {
    icon: Shield,
    color: AMAZON_ORANGE,
    tip: 'Never hand the OTP to a driver before inspecting your package — Amazon cannot investigate after code is given.',
  },
  {
    icon: Zap,
    color: UPS_BROWN,
    tip: 'UPS intercepts must be submitted before the package reaches the local facility. Act fast.',
  },
  {
    icon: MapPin,
    color: '#059669',
    tip: 'Access Points are safer than home delivery if you live in a high-theft area.',
  },
];

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  onPress,
  delay,
}: {
  service: Service;
  onPress: () => void;
  delay: number;
}) {
  const Icon = service.icon;
  const anim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.spring(anim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }).start();
    }, delay);
  }, [anim, delay]);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 80 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 80 }),
    ]).start();
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onPress();
  };

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: scaleAnim },
        ],
      }}
    >
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={handlePress}
        activeOpacity={0.88}
        accessibilityLabel={service.title}
      >
        {/* Icon */}
        <View style={[styles.serviceIcon, { backgroundColor: service.bgColor }]}>
          <Icon size={22} color={service.accentColor} strokeWidth={2} />
        </View>

        {/* Content */}
        <View style={styles.serviceContent}>
          <View style={styles.serviceTitleRow}>
            <Text style={styles.serviceTitle}>{service.title}</Text>
            {service.badge && (
              <View
                style={[
                  styles.serviceBadge,
                  { backgroundColor: service.isAmazon ? '#FFF8EC' : '#FFF8E1' },
                ]}
              >
                <Text
                  style={[
                    styles.serviceBadgeText,
                    { color: service.isAmazon ? AMAZON_ORANGE : UPS_BROWN },
                  ]}
                >
                  {service.badge}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.serviceSubtitle} numberOfLines={2}>
            {service.subtitle}
          </Text>
        </View>

        {/* Arrow */}
        <ChevronRight size={18} color={SLATE_LIGHT} strokeWidth={2} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HubScreen() {
  const router = useRouter();
  const { isEntitled, isEntitlementLoading, isLoading } = useApp();

  // Hard paywall — UPS/Amazon hidden services are premium-only.
  // Wait for BOTH auth loading and backend entitlement to resolve before
  // redirecting, so entitled users aren't false-evicted during launch sync.
  useEffect(() => {
    if (!isLoading && !isEntitlementLoading && !isEntitled) {
      router.replace({
        pathname: '/upgrade' as any,
        params: { trigger: 'ups_amazon' },
      });
    }
  }, [isEntitled, isEntitlementLoading, isLoading, router]);

  // Header animation
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(30)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroAnim, { toValue: 1, duration: 550, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(statsAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
        Animated.timing(statsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 200);

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [heroAnim, statsAnim, statsOpacity, shimmer]);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-200, 300] });

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Delivery Insights',
          headerStyle: { backgroundColor: BG },
          headerShadowVisible: false,
          headerTintColor: NAVY,
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Card ──────────────────────────────────────────────── */}
        <Animated.View style={[styles.heroCard, { opacity: heroAnim }]}>
          {/* Shimmer overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmerBar,
              { transform: [{ translateX: shimmerX }] },
            ]}
          />

          <View style={styles.heroIconRow}>
            <View style={styles.heroIconA}>
              <Package size={18} color={AMAZON_ORANGE} strokeWidth={2.5} />
            </View>
            <View style={styles.heroIconSep}>
              <ArrowRight size={12} color='rgba(255,255,255,0.4)' strokeWidth={2} />
            </View>
            <View style={styles.heroIconU}>
              <Truck size={18} color={UPS_GOLD} strokeWidth={2.5} />
            </View>
          </View>

          <Text style={styles.heroTitle}>Porchivo Delivery Insights{'\n'}UPS & Amazon Hidden Services</Text>
          <Text style={styles.heroSub}>
            Unlock carrier features most customers never know exist. Protect your deliveries, intercept packages, and resolve issues faster.
          </Text>

          <View style={styles.heroBadges}>
            <View style={styles.heroBadge}>
              <Sparkles size={11} color={AMAZON_ORANGE} strokeWidth={2} />
              <Text style={styles.heroBadgeText}>5 Hidden Features</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,181,0,0.15)' }]}>
              <Shield size={11} color={UPS_GOLD} strokeWidth={2} />
              <Text style={[styles.heroBadgeText, { color: UPS_GOLD }]}>Package Protection</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Stats Row ──────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.statsRow,
            { opacity: statsOpacity, transform: [{ translateY: statsAnim }] },
          ]}
        >
          {[
            { label: 'Packages protected', value: '12' },
            { label: 'Claims filed', value: '2' },
            { label: 'Intercepts done', value: '1' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCell}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Amazon Services ────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>Amazon Features</Text>
        </View>

        {SERVICES.filter((s) => s.isAmazon).map((service, i) => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={() => router.push(service.route as Parameters<typeof router.push>[0])}
            delay={300 + i * 80}
          />
        ))}

        {/* ── UPS Services ───────────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <View style={[styles.sectionDot, { backgroundColor: UPS_GOLD }]} />
          <Text style={styles.sectionTitle}>UPS Features</Text>
        </View>

        {SERVICES.filter((s) => !s.isAmazon).map((service, i) => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={() => router.push(service.route as Parameters<typeof router.push>[0])}
            delay={550 + i * 80}
          />
        ))}

        {/* ── Pro Tips ───────────────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <View style={[styles.sectionDot, { backgroundColor: '#059669' }]} />
          <Text style={styles.sectionTitle}>Pro Tips</Text>
        </View>

        {PRO_TIPS.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <View key={i} style={styles.tipCard}>
              <View style={[styles.tipIcon, { backgroundColor: `${tip.color}18` }]}>
                <Icon size={15} color={tip.color} strokeWidth={2.5} />
              </View>
              <Text style={styles.tipText}>{tip.tip}</Text>
            </View>
          );
        })}

        {/* ── Footer note ────────────────────────────────────────────── */}
        <View style={styles.footerNote}>
          <Lock size={12} color={SLATE_LIGHT} strokeWidth={2} />
          <Text style={styles.footerNoteText}>
            Features use your carrier credentials securely. Porchivo never stores your passwords.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 12, paddingBottom: 40 },

  // Hero
  heroCard: {
    backgroundColor: NAVY,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    transform: [{ skewX: '-20deg' }],
    zIndex: 0,
  },
  heroIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  heroIconA: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,153,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconSep: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconU: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,181,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: WHITE,
    lineHeight: 32,
    marginBottom: 10,
  },
  heroSub: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
    marginBottom: 18,
  },
  heroBadges: { flexDirection: 'row', gap: 10 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,153,0,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: { fontSize: 11.5, fontWeight: '700' as const, color: AMAZON_ORANGE },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 26, fontWeight: '900' as const, color: NAVY },
  statLabel: { fontSize: 11, color: SLATE_LIGHT, textAlign: 'center', lineHeight: 14 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    marginBottom: -2,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AMAZON_ORANGE },
  sectionTitle: { fontSize: 13.5, fontWeight: '700' as const, color: SLATE, letterSpacing: 0.3, textTransform: 'uppercase' },

  // Service card
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  serviceContent: { flex: 1 },
  serviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  serviceTitle: { fontSize: 15.5, fontWeight: '800' as const, color: NAVY },
  serviceBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  serviceBadgeText: { fontSize: 9.5, fontWeight: '800' as const, letterSpacing: 0.8 },
  serviceSubtitle: { fontSize: 12.5, color: SLATE_LIGHT, lineHeight: 17 },

  // Tips
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipText: { flex: 1, fontSize: 13, color: SLATE, lineHeight: 19 },

  // Footer note
  footerNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 4,
  },
  footerNoteText: { flex: 1, fontSize: 12, color: SLATE_LIGHT, lineHeight: 17 },
});
