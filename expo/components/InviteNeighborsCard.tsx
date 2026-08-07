import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Share,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Users, Link2, Copy, Check, ChevronRight, MapPin } from 'lucide-react-native';
import { palette, radius, space } from '@/constants/theme';
import {
  generateInviteLink,
  getNeighborInviteMessage,
} from '@/utils/invite';
import { track } from '@/lib/analytics';
import { log } from '@/lib/logger';
import { useToast } from '@/hooks/useToast';

interface InviteNeighborsCardProps {
  userId: string;
  userName: string;
}

/**
 * Prominent "invite your neighbors" card shown on the home screen.
 * Generates a unique referral link on demand and lets the user share it
 * via the native share sheet, copy it to clipboard, or preview the code.
 */
export default function InviteNeighborsCard({ userId, userName }: InviteNeighborsCardProps) {
  const toast = useToast();
  const [sharing, setSharing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [link, setLink] = useState<string>('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Subtle pulsing glow on the icon badge
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  const bounceBtn = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim]);

  const ensureLink = useCallback((): string => {
    if (!link) {
      const generated = generateInviteLink(userId);
      setLink(generated);
      track('neighbor_invite_link_generated', { source: 'home_card' });
      return generated;
    }
    return link;
  }, [link, userId]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bounceBtn();
    setSharing(true);
    const activeLink = ensureLink();
    const msg = getNeighborInviteMessage(userName, activeLink);
    try {
      const result = await Share.share({
        message: msg,
        title: 'Join my Porchivo block',
      });
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        track('neighbor_invite_shared', { method: 'system_share' });
        toast.success('Invite sent! Your neighbor will see the link once they open it.', {
          duration: 4000,
        });
      }
    } catch (e) {
      log('[InviteNeighbors] Share error:', e);
      toast.error('Could not open the share sheet. Please try again.');
    } finally {
      setSharing(false);
    }
  }, [sharing, bounceBtn, ensureLink, userName, toast]);

  const handleCopy = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const activeLink = ensureLink();
    try {
      await Clipboard.setStringAsync(activeLink);
      setCopied(true);
      track('neighbor_invite_shared', { method: 'clipboard' });
      toast.success('Invite link copied to clipboard!', {
        duration: 3000,
      });
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      toast.error('Could not copy the link. Please try again.');
    }
  }, [ensureLink, toast]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.6],
  });

  return (
    <View style={styles.card} testID="invite-neighbors-card">
      {/* Warm gradient backdrop — distinct from the gold referral card */}
      <LinearGradient
        colors={['rgba(58,123,213,0.08)', 'rgba(232,98,42,0.05)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={styles.headerRow}>
        <Animated.View style={[styles.iconWrap, { shadowOpacity: glowOpacity }]}>
          <Users size={20} color={palette.accent} strokeWidth={2.3} />
        </Animated.View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Invite your neighbors</Text>
          <Text style={styles.subtitle}>
            Build your block's safety net. Every neighbor who joins makes porch pirates lonelier.
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <MapPin size={15} color={palette.accent} strokeWidth={2.2} />
          <Text style={styles.statLabel}>Your block</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Users size={15} color={palette.warmOrange} strokeWidth={2.2} />
          <Text style={styles.statLabel}>More eyes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Link2 size={15} color={palette.successGreen} strokeWidth={2.2} />
          <Text style={styles.statLabel}>Free to join</Text>
        </View>
      </View>

      {/* Copy link row */}
      <TouchableOpacity
        style={styles.linkRow}
        onPress={handleCopy}
        activeOpacity={0.7}
        testID="invite-copy-link"
      >
        <Link2 size={14} color={palette.textMuted} />
        <Text style={styles.linkText} numberOfLines={1}>
          {link || 'porchivo.com/download?ref=…'}
        </Text>
        {copied ? (
          <View style={styles.copiedBadge}>
            <Check size={11} color={palette.onAccent} strokeWidth={3} />
            <Text style={styles.copiedText}>Copied</Text>
          </View>
        ) : (
          <Copy size={14} color={palette.textMuted} />
        )}
      </TouchableOpacity>

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
          onPress={handleShare}
          disabled={sharing}
          activeOpacity={0.88}
          testID="invite-share-btn"
        >
          <Users size={15} color={palette.onAccent} />
          <Text style={styles.shareBtnText}>
            {sharing ? 'Opening share…' : 'Invite neighbors'}
          </Text>
          <ChevronRight size={15} color={`${palette.onAccent}AA`} strokeWidth={2.6} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: palette.borderGlow,
    overflow: 'hidden' as const,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.accentGlow,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: `${palette.accent}30`,
    flexShrink: 0,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 3,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: palette.textPrimary,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 12.5,
    color: palette.textSecondary,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: palette.bgElevated,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  stat: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: palette.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.borderDark,
    marginHorizontal: 4,
  },
  linkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: palette.bgElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500' as const,
    color: palette.textMuted,
    fontFamily: undefined as never,
  },
  copiedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: palette.successGreen,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  copiedText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: palette.onAccent,
  },
  shareBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  shareBtnDisabled: {
    opacity: 0.65,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: palette.onAccent,
    letterSpacing: 0.2,
  },
});
