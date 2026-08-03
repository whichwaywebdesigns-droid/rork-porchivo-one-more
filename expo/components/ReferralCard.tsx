import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Share,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, Users, ChevronRight } from 'lucide-react-native';
import { palette, radius, space } from '@/constants/theme';
import { generateInviteLink } from '@/utils/invite';

interface ReferralCardProps {
  userId: string;
  userName: string;
  onShared?: () => void;
}

export default function ReferralCard({ userId, userName, onShared }: ReferralCardProps) {
  const [sharing, setSharing] = useState<boolean>(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const bounceBtn = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bounceBtn();
    setSharing(true);
    const link = generateInviteLink(userId);
    const msg = `Hey! I'm using Porchivo to protect my packages from porch pirates — it's really good. Join me and we can watch each other's deliveries.\n\nGet it free: ${link}`;
    try {
      const result = await Share.share({ message: msg, title: 'Join me on Porchivo' });
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onShared?.();
      }
    } catch (e) {
      // Share dismissed — no-op
    } finally {
      setSharing(false);
    }
  }, [sharing, userId, bounceBtn, onShared]);

  return (
    <View style={styles.card} testID="referral-card">
      {/* Subtle gold glow */}
      <LinearGradient
        colors={['rgba(232,200,74,0.07)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Gift size={18} color={palette.gold} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Invite a neighbor, get 1 month free</Text>
          <Text style={styles.subtitle}>
            For every friend who joins, you both get 30 days of Premium.
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>30</Text>
          <Text style={styles.statLabel}>free days{'\n'}per referral</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Users size={18} color={palette.accent} />
          <Text style={styles.statLabel}>neighbor{'\n'}gets 30 too</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>∞</Text>
          <Text style={styles.statLabel}>no referral{'\n'}limit</Text>
        </View>
      </View>

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
          onPress={handleShare}
          disabled={sharing}
          activeOpacity={0.88}
          testID="referral-share-btn"
        >
          <Gift size={14} color={palette.onAccent} />
          <Text style={styles.shareBtnText}>
            {sharing ? 'Opening share…' : 'Share invite link'}
          </Text>
          <ChevronRight size={14} color={`${palette.onAccent}99`} strokeWidth={2.5} />
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.legal}>
        Credit applied automatically when your friend completes onboarding.
      </Text>
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
    overflow: 'hidden',
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${palette.gold}30`,
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    marginBottom: 4,
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 12,
    color: palette.textSecondary,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: palette.accent,
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 10,
    color: palette.textMuted,
    textAlign: 'center' as const,
    lineHeight: 14,
    fontWeight: '500' as const,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: palette.borderDark,
    marginHorizontal: 4,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
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
    flex: 1,
    textAlign: 'center' as const,
    letterSpacing: 0.2,
  },
  legal: {
    fontSize: 11,
    color: palette.textDisabled,
    textAlign: 'center' as const,
    marginTop: 10,
    lineHeight: 16,
  },
});
