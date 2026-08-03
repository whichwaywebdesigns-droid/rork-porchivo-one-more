import React, { useMemo, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Eye,
  GitMerge,
  Lock,
  Package,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';
import type { AppColors } from '@/constants/colors';
import { useAnalytics } from '@/store/AnalyticsContext';
import {
  OnboardingScreen,
  PrimaryCTA,
  SecondaryAction,
  InfoSheet,
  ParallaxLayer,
} from '@/components/onboarding';
import { mockSuspiciousAlerts } from '@/mocks/suspiciousAlerts';
import { mockNeighborhoodEvents } from '@/mocks/neighborhoodEvents';

// ─── Helpers ───────────────────────────────────────────────────────────────
function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  return dd === 1 ? 'yesterday' : `${dd}d ago`;
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ReactNode; tint: string }
> = {};

function getCategoryMeta(cat: string, Colors: AppColors) {
  switch (cat) {
    case 'suspicious_person':
      return {
        label: 'Suspicious person',
        icon: <Users size={15} color={Colors.gold} strokeWidth={2.4} />,
        tint: Colors.gold,
      };
    case 'package_taken':
      return {
        label: 'Package taken',
        icon: <Package size={15} color={Colors.danger} strokeWidth={2.4} />,
        tint: Colors.danger,
      };
    case 'unknown_vehicle':
      return {
        label: 'Unknown vehicle',
        icon: <AlertTriangle size={15} color={Colors.secondary} strokeWidth={2.4} />,
        tint: Colors.secondary,
      };
    default:
      return {
        label: 'Neighborhood report',
        icon: <Shield size={15} color={Colors.primary} strokeWidth={2.4} />,
        tint: Colors.primary,
      };
  }
}

function getEventIcon(type: string, Colors: AppColors) {
  switch (type) {
    case 'package_delivered':
      return <Package size={15} color={Colors.success} strokeWidth={2.4} />;
    case 'partner_pickup':
      return <GitMerge size={15} color={Colors.primary} strokeWidth={2.4} />;
    case 'package_returned':
      return <ShieldCheck size={15} color={Colors.success} strokeWidth={2.4} />;
    case 'new_partner_joined':
      return <Users size={15} color={Colors.secondary} strokeWidth={2.4} />;
    case 'delivery_in_progress':
      return <Eye size={15} color={Colors.primary} strokeWidth={2.4} />;
    default:
      return <Bell size={15} color={Colors.slateLight} strokeWidth={2.4} />;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function GuestBrowseScreen() {
  const router = useRouter();
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { track } = useAnalytics();
  const [sheet, setSheet] = useState<'encryption' | 'demo' | null>(null);

  const feed = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'event' | 'alert';
      ts: string;
      title: string;
      desc: string;
      meta: string;
      icon: React.ReactNode;
      tint: string;
      resolved?: boolean;
    }> = [];
    for (const e of mockNeighborhoodEvents) {
      items.push({
        id: e.id,
        kind: 'event',
        ts: e.timestamp,
        title: e.title,
        desc: e.description,
        meta: e.relativeLocation,
        icon: getEventIcon(e.type, Colors),
        tint: Colors.primary,
      });
    }
    for (const a of mockSuspiciousAlerts) {
      const meta = getCategoryMeta(a.category, Colors);
      items.push({
        id: a.id,
        kind: 'alert',
        ts: a.createdAt,
        title: meta.label,
        desc: a.description,
        meta: a.approximateLocation,
        icon: meta.icon,
        tint: meta.tint,
        resolved: a.status === 'resolved',
      });
    }
    return items.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  }, [Colors]);

  const handleSignUp = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('guest_convert', { surface: 'guest_browse', mode: 'signup' });
    router.push({ pathname: '/welcome-features' as any, params: { mode: 'signup' } });
  };

  const handleSignIn = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('guest_convert', { surface: 'guest_browse', mode: 'signin' });
    router.push({ pathname: '/login' as any, params: { mode: 'signin' } });
  };

  const activeCount = feed.filter((f) => f.kind === 'alert' && !f.resolved).length;

  return (
    <OnboardingScreen
      glow={false}
      footer={
        <View>
          <PrimaryCTA
            label="Create my account"
            onPress={handleSignUp}
            testID="guest-signup"
          />
          <SecondaryAction
            label="I already have an account — sign in"
            onPress={handleSignIn}
            testID="guest-signin"
          />
        </View>
      }
    >
      {/* Demo banner */}
      <ParallaxLayer entrance="none">
        <View style={[styles.demoBanner, { backgroundColor: Colors.skyBlue }]}>
          <View style={[styles.demoBannerIcon, { backgroundColor: Colors.primary }]}>
            <Sparkles size={14} color={Colors.onPrimary} strokeWidth={2.6} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.demoBannerTitle, { color: Colors.slate }]}>
              Guest mode · demo neighborhood
            </Text>
            <Text style={[styles.demoBannerSub, { color: Colors.slateLight }]}>
              You're previewing a sample block. Create an account to see your real
              neighborhood and join the safety network.
            </Text>
          </View>
          <Pressable
            onPress={() => setSheet('demo')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="What is guest mode"
          >
            <ChevronRight size={16} color={Colors.slateLight} strokeWidth={2.4} />
          </Pressable>
        </View>
      </ParallaxLayer>

      {/* Block header */}
      <ParallaxLayer entrance="none" entranceDelay={80}>
        <View style={styles.blockHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.blockEyebrow, { color: Colors.slateLight }]}>
              LIVE BLOCK FEED
            </Text>
            <Text style={[styles.blockTitle, { color: Colors.slate }]}>
              Maple Street · 300 block
            </Text>
          </View>
          <View style={[styles.livePill, { backgroundColor: Colors.successLight }]}>
            <View style={[styles.liveDot, { backgroundColor: Colors.success }]} />
            <Text style={[styles.liveText, { color: Colors.success }]}>LIVE</Text>
          </View>
        </View>
        <View style={[styles.statsRow, { borderColor: Colors.border }]}>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: Colors.slate }]}>{feed.length}</Text>
            <Text style={[styles.statLabel, { color: Colors.slateLight }]}>events today</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: Colors.border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: Colors.slate }]}>{activeCount}</Text>
            <Text style={[styles.statLabel, { color: Colors.slateLight }]}>active alerts</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: Colors.border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: Colors.slate }]}>3</Text>
            <Text style={[styles.statLabel, { color: Colors.slateLight }]}>partners nearby</Text>
          </View>
        </View>
      </ParallaxLayer>

      {/* Security trust strip */}
      <ParallaxLayer entrance="none" entranceDelay={140}>
        <Pressable
          onPress={() => setSheet('encryption')}
          style={[styles.trustStrip, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="How Porchivo protects your data"
        >
          <View style={[styles.trustIcon, { backgroundColor: Colors.primary }]}>
            <Lock size={13} color={Colors.onPrimary} strokeWidth={2.6} />
          </View>
          <Text style={[styles.trustText, { color: Colors.slateLight }]}>
            End-to-end encrypted · Your address is never shared with partners without consent
          </Text>
        </Pressable>
      </ParallaxLayer>

      {/* Feed */}
      <ScrollView
        style={styles.feedScroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 8,
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {feed.map((item, i) => (
          <FeedCard key={item.id} item={item} index={i} Colors={Colors} />
        ))}
      </ScrollView>

      {/* Bottom sheets */}
      <InfoSheet
        visible={sheet === 'encryption'}
        onClose={() => setSheet(null)}
        eyebrow="Security"
        title="Your data is encrypted"
      >
        <View style={styles.sheetBody}>
          <Text style={[styles.sheetP, { color: Colors.slateLight }]}>
            Porchivo encrypts your personal data in transit and at rest. Your street
            address is never shown to a Porch Partner without your explicit, per-delivery
            consent — partners see only an approximate area until you grant access.
          </Text>
          <BulletRow Colors={Colors} icon={<ShieldCheck size={16} color={Colors.primary} />}>
            AES-256 encryption on stored profile and shipment data
          </BulletRow>
          <BulletRow Colors={Colors} icon={<Lock size={16} color={Colors.primary} />}>
            Biometric unlock (Face ID / Touch ID) secures your local session
          </BulletRow>
          <BulletRow Colors={Colors} icon={<Eye size={16} color={Colors.primary} />}>
            Approximate locations hide your exact home until you opt in per delivery
          </BulletRow>
          <Text style={[styles.sheetP, { color: Colors.slateLight, marginTop: 8 }]}>
            Read the full{' '}
            <Text style={[styles.sheetLink, { color: Colors.primary }]}>Privacy Policy</Text>.
          </Text>
        </View>
      </InfoSheet>

      <InfoSheet
        visible={sheet === 'demo'}
        onClose={() => setSheet(null)}
        eyebrow="Guest mode"
        title="Try Porchivo before you sign up"
      >
        <View style={styles.sheetBody}>
          <Text style={[styles.sheetP, { color: Colors.slateLight }]}>
            You're browsing a sample Maple Street block with realistic demo events and
            alerts. Interactions are read-only — sign up to:
          </Text>
          <BulletRow Colors={Colors} icon={<Bell size={16} color={Colors.primary} />}>
            Get real-time alerts for your actual block
          </BulletRow>
          <BulletRow Colors={Colors} icon={<Package size={16} color={Colors.primary} />}>
            Track your own packages and arrange safe handoffs
          </BulletRow>
          <BulletRow Colors={Colors} icon={<Users size={16} color={Colors.primary} />}>
            Join or start a neighborhood safety network
          </BulletRow>
          <Text style={[styles.sheetP, { color: Colors.slateLight, marginTop: 8 }]}>
            Sign up takes about 30 seconds — Face ID is all you'll need to come back.
          </Text>
        </View>
      </InfoSheet>
    </OnboardingScreen>
  );
}

// ─── Feed card ─────────────────────────────────────────────────────────────
function FeedCard({
  item,
  index,
  Colors,
}: {
  item: {
    id: string;
    kind: 'event' | 'alert';
    ts: string;
    title: string;
    desc: string;
    meta: string;
    icon: React.ReactNode;
    tint: string;
    resolved?: boolean;
  };
  index: number;
  Colors: AppColors;
}) {
  const fade = React.useRef(new Animated.Value(0)).current;
  const slide = React.useRef(new Animated.Value(16)).current;

  React.useEffect(() => {
    const delay = Math.min(index * 60, 360);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        tension: 60,
        friction: 9,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide, index]);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View
        style={[
          styles.card,
          { backgroundColor: Colors.surface, borderColor: Colors.border },
          item.kind === 'alert' && !item.resolved && { borderColor: item.tint + '55' },
        ]}
      >
        <View style={[styles.cardIcon, { backgroundColor: item.tint + '1A' }]}>{item.icon}</View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: Colors.slate }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.resolved ? (
              <View style={[styles.resolvedPill, { backgroundColor: Colors.successLight }]}>
                <Text style={[styles.resolvedText, { color: Colors.success }]}>Resolved</Text>
              </View>
            ) : null}
            <Text style={[styles.cardTime, { color: Colors.slateLighter }]}>
              {relTime(item.ts)}
            </Text>
          </View>
          <Text style={[styles.cardDesc, { color: Colors.slateLight }]} numberOfLines={3}>
            {item.desc}
          </Text>
          <View style={styles.cardMetaRow}>
            <View style={[styles.cardMetaDot, { backgroundColor: item.tint }]} />
            <Text style={[styles.cardMetaText, { color: Colors.slateLighter }]}>
              {item.meta}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function BulletRow({
  Colors,
  icon,
  children,
}: {
  Colors: AppColors;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletIcon, { backgroundColor: Colors.elevated }]}>{icon}</View>
      <Text style={[styles.bulletText, { color: Colors.slate }]}>{children}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    marginBottom: 14,
  },
  demoBannerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
    marginBottom: 2,
  },
  demoBannerSub: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  blockEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 12,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  trustIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: {
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 15,
    flex: 1,
  },
  feedScroll: {
    flex: 1,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 9,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  resolvedPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  resolvedText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  cardDesc: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 6,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardMetaDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  cardMetaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // ── Sheet body ──
  sheetBody: {
    paddingBottom: 10,
  },
  sheetP: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 12,
  },
  sheetLink: {
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  bulletIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
});
