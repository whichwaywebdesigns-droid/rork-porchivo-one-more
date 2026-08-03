import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Share,
  Clipboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Gift,
  Copy,
  Check,
  Users,
  Zap,
  Crown,
  ChevronLeft,
  TrendingUp,
  Share2,
  Heart,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { palette, radius, space } from '@/constants/theme';
import { useApp } from '@/store/AppContext';
import { generateInviteLink } from '@/utils/invite';
import { useAnalytics } from '@/store/AnalyticsContext';

const STEPS = [
  {
    num: '1',
    icon: Share2,
    title: 'Share your link',
    body: 'Send your personal invite to a neighbor, friend, or anyone who gets packages.',
  },
  {
    num: '2',
    icon: Users,
    title: 'They download & join',
    body: 'When they complete onboarding using your link, the credit kicks in automatically.',
  },
  {
    num: '3',
    icon: Crown,
    title: 'Both of you get 30 days',
    body: 'You earn one month of Premium. They get Premium too — on the house.',
  },
];

const PERKS = [
  { icon: Zap,      label: 'Theft Shield active',           sub: '90-sec live tracking' },
  { icon: Users,    label: 'Porch Partner access',          sub: 'Hire a trusted neighbor' },
  { icon: Gift,     label: 'Custom delivery chimes',         sub: 'Know the moment it lands' },
  { icon: TrendingUp, label: 'Quarterly tax invoices',      sub: 'Ready to file, always' },
];

export default function ReferralScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, referralCreditUntil } = useApp();
  const { track } = useAnalytics();

  const [copied, setCopied] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const copyScale = useRef(new Animated.Value(1)).current;

  const inviteLink = user ? generateInviteLink(user.id) : 'https://porchivo.com/download';
  const hasActiveCredit = referralCreditUntil != null && Date.now() < referralCreditUntil;
  const creditDaysLeft = hasActiveCredit && referralCreditUntil
    ? Math.max(1, Math.ceil((referralCreditUntil - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
    track('referral_screen_view');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(copyScale, { toValue: 0.9, duration: 70, useNativeDriver: true }),
      Animated.timing(copyScale, { toValue: 1.06, duration: 100, useNativeDriver: true }),
      Animated.timing(copyScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== 'web') {
      Clipboard.setString(inviteLink);
    }
    setCopied(true);
    track('referral_link_copied');
    setTimeout(() => setCopied(false), 2400);
  }, [inviteLink, copyScale, track]);

  const handleShare = useCallback(async () => {
    if (sharing || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    const msg = `Hey! I use Porchivo to protect my packages from porch pirates — it's legitimately good. Join with my link and we both get a free month of Premium.\n\n${inviteLink}`;
    try {
      const result = await Share.share({ message: msg, title: 'Join Porchivo — free month for both of us' });
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        track('referral_share_completed');
      }
    } catch {
      // dismissed
    } finally {
      setSharing(false);
    }
  }, [sharing, user, inviteLink, track]);

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={10} activeOpacity={0.7}>
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite & Earn</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.heroIconRing}>
            <View style={styles.heroIconInner}>
              <Gift size={32} color={palette.accent} />
            </View>
          </View>
          <Text style={styles.heroTitle}>Give a month. Get a month.</Text>
          <Text style={styles.heroSub}>
            Every neighbor who joins with your link gets 30 days of Porchivo Premium — and so do you.
          </Text>

          {hasActiveCredit && (
            <View style={styles.activeCreditBadge}>
              <Heart size={12} color={palette.successGreen} fill={palette.successGreen} />
              <Text style={styles.activeCreditText}>
                {creditDaysLeft} days of referral credit remaining
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Link card */}
        <View style={[styles.linkCard, { backgroundColor: Colors.surface }]}>
          <Text style={styles.linkLabel}>YOUR INVITE LINK</Text>
          <Text style={styles.linkUrl} numberOfLines={1}>{inviteLink}</Text>

          <View style={styles.linkActions}>
            <Animated.View style={[{ flex: 1 }, { transform: [{ scale: copyScale }] }]}>
              <TouchableOpacity
                style={[styles.copyBtn, copied && styles.copyBtnDone]}
                onPress={handleCopy}
                activeOpacity={0.85}
                testID="copy-link-btn"
              >
                {copied
                  ? <Check size={15} color="#fff" />
                  : <Copy size={15} color="#fff" />
                }
                <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy link'}</Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
              onPress={handleShare}
              disabled={sharing}
              activeOpacity={0.85}
              testID="share-invite-btn"
            >
              <Share2 size={15} color={palette.accent} />
              <Text style={styles.shareBtnText}>{sharing ? 'Opening…' : 'Share'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* What they get */}
        <View style={[styles.section, { backgroundColor: Colors.surface }]}>
          <Text style={styles.sectionTitle}>What your friend unlocks</Text>
          {PERKS.map((p, i) => {
            const Icon = p.icon;
            return (
              <View key={i} style={[styles.perkRow, i < PERKS.length - 1 && styles.perkRowBorder]}>
                <View style={styles.perkIcon}>
                  <Icon size={15} color={palette.accent} />
                </View>
                <View style={styles.perkText}>
                  <Text style={styles.perkLabel}>{p.label}</Text>
                  <Text style={styles.perkSub}>{p.sub}</Text>
                </View>
                <Check size={14} color={palette.successGreen} />
              </View>
            );
          })}
        </View>

        {/* How it works */}
        <Text style={styles.howTitle}>How it works</Text>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <View key={i} style={[styles.stepRow, { backgroundColor: Colors.surface }]}>
              <View style={styles.stepNumWrap}>
                <Text style={styles.stepNum}>{s.num}</Text>
              </View>
              <View style={styles.stepIcon}>
                <Icon size={16} color={palette.accent} />
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepText}>{s.body}</Text>
              </View>
            </View>
          );
        })}

        {/* Fine print */}
        <Text style={styles.finePrint}>
          Credit applies when your friend completes onboarding via your unique link. No cap on referrals — every valid join earns you another 30 days. Referral credit cannot be combined with an active paid subscription.
        </Text>

        {/* Big share CTA */}
        <TouchableOpacity
          style={[styles.bigCta, sharing && styles.bigCtaDisabled]}
          onPress={handleShare}
          disabled={sharing}
          activeOpacity={0.88}
          testID="big-share-cta"
        >
          <Gift size={18} color="#fff" />
          <Text style={styles.bigCtaText}>
            {sharing ? 'Opening share sheet…' : 'Share your invite link'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700' as const,
    color: palette.ink,
    letterSpacing: -0.2,
  },

  scroll: {
    paddingHorizontal: 18,
    gap: 14,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  heroIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.accentGlowStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: `${palette.accent}28`,
  },
  heroIconInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${palette.accent}40`,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: palette.ink,
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 8,
    lineHeight: 31,
  },
  heroSub: {
    fontSize: 14,
    color: palette.slate500,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  activeCreditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.sageSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 14,
    borderWidth: 1,
    borderColor: `${palette.successGreen}30`,
  },
  activeCreditText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: palette.successGreen,
  },

  // Link card
  linkCard: {
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.borderDark,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  linkLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: palette.slate300,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  linkUrl: {
    fontSize: 13,
    color: palette.accent,
    fontWeight: '600' as const,
    marginBottom: 14,
    lineHeight: 18,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 10,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  copyBtnDone: {
    backgroundColor: palette.successGreen,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#fff',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.accent,
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: palette.accent,
  },

  // Perks
  section: {
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: palette.slate500,
    letterSpacing: 0.3,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  perkRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.borderDark,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${palette.accent}20`,
  },
  perkText: { flex: 1 },
  perkLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.ink,
    lineHeight: 18,
  },
  perkSub: {
    fontSize: 12,
    color: palette.slate500,
    marginTop: 1,
  },

  // Steps
  howTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: palette.slate500,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  stepNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.accentGlowStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${palette.accent}30`,
    flexShrink: 0,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: palette.accent,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBody: { flex: 1, paddingTop: 2 },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: palette.ink,
    marginBottom: 3,
  },
  stepText: {
    fontSize: 12,
    color: palette.slate500,
    lineHeight: 17,
  },

  // CTA
  bigCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: palette.accent,
    borderRadius: radius.pill,
    paddingVertical: 17,
    marginTop: 4,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  bigCtaDisabled: { opacity: 0.65 },
  bigCtaText: {
    fontSize: 15,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },

  finePrint: {
    fontSize: 11,
    color: palette.slate300,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
