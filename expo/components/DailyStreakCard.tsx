import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, ShieldCheck, CheckCircle2 } from 'lucide-react-native';
import { palette, radius, space } from '@/constants/theme';

const STREAK_KEY = 'porchivo_daily_streak';
const LAST_CHECK_KEY = 'porchivo_last_check_date';

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function getYesterdayKey(): string {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface DailyStreakCardProps {
  onCheckIn?: (streak: number) => void;
}

export default function DailyStreakCard({ onCheckIn }: DailyStreakCardProps) {
  const [streak, setStreak] = useState<number>(0);
  const [checkedToday, setCheckedToday] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void (async () => {
      const [storedStreak, lastDate] = await Promise.all([
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(LAST_CHECK_KEY),
      ]);
      const today = getTodayKey();
      const yesterday = getYesterdayKey();
      const currentStreak = storedStreak ? Number(storedStreak) : 0;

      if (lastDate === today) {
        setCheckedToday(true);
        setStreak(currentStreak);
      } else if (lastDate === yesterday) {
        setStreak(currentStreak);
        setCheckedToday(false);
      } else if (lastDate === null) {
        setStreak(0);
        setCheckedToday(false);
      } else {
        await AsyncStorage.setItem(STREAK_KEY, '0');
        setStreak(0);
        setCheckedToday(false);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    if (!checkedToday) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 950, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 950, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loaded, checkedToday, fadeAnim, pulseAnim]);

  const handleCheckIn = useCallback(async () => {
    if (checkedToday) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();

    const newStreak = streak + 1;
    setStreak(newStreak);
    setCheckedToday(true);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    await Promise.all([
      AsyncStorage.setItem(STREAK_KEY, String(newStreak)),
      AsyncStorage.setItem(LAST_CHECK_KEY, getTodayKey()),
    ]);

    onCheckIn?.(newStreak);
  }, [checkedToday, streak, scaleAnim, pulseAnim, onCheckIn]);

  if (!loaded) return null;

  const milestoneNext = streak < 3 ? 3 : streak < 7 ? 7 : streak < 14 ? 14 : streak < 30 ? 30 : null;
  const progressPct = milestoneNext ? Math.min((streak / milestoneNext) * 100, 100) : 100;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]} testID="daily-streak-card">
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <Flame size={12} color={checkedToday ? palette.warmOrange : palette.textMuted} />
          <Text style={[styles.label, checkedToday && styles.labelActive]}>
            Daily Porch Check
          </Text>
        </View>
        {checkedToday && (
          <View style={styles.donePill}>
            <CheckCircle2 size={10} color={palette.successGreen} />
            <Text style={styles.donePillText}>Done today</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Animated.View
          style={[
            styles.flameCircle,
            {
              transform: [{ scale: checkedToday ? scaleAnim : pulseAnim }],
              backgroundColor: checkedToday ? 'rgba(255,107,53,0.12)' : palette.bgElevated,
              borderColor: checkedToday ? 'rgba(255,107,53,0.3)' : palette.borderDark,
            },
          ]}
        >
          <Text style={styles.flameEmoji}>{checkedToday ? '🔥' : '🏠'}</Text>
          <Text style={styles.streakNum}>{streak}</Text>
        </Animated.View>

        <View style={styles.info}>
          <Text style={styles.streakLabel}>
            {streak === 0
              ? 'Start your streak!'
              : `${streak} day${streak === 1 ? '' : 's'} protecting your porch`}
          </Text>
          {milestoneNext && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBg}>
                <Animated.View
                  style={[styles.progressFill, { width: `${progressPct}%` as any }]}
                />
              </View>
              <Text style={styles.progressLabel}>{streak}/{milestoneNext} days to next badge</Text>
            </View>
          )}
          {!milestoneNext && (
            <View style={styles.badgeRow}>
              <ShieldCheck size={12} color={palette.successGreen} />
              <Text style={styles.badgeText}>Neighborhood Guardian unlocked 🏆</Text>
            </View>
          )}
        </View>
      </View>

      {!checkedToday && (
        <TouchableOpacity
          style={styles.checkInBtn}
          onPress={handleCheckIn}
          activeOpacity={0.85}
          testID="check-in-btn"
        >
          <LinearGradient
            colors={[palette.warmOrange, '#E05820']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Flame size={13} color={palette.textPrimary} />
          <Text style={styles.checkInText}>Check in — keep the streak alive</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.bgSurface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: palette.borderDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: palette.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  labelActive: {
    color: palette.warmOrange,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.successGlow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(68,255,136,0.25)',
  },
  donePillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: palette.successGreen,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  flameCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  flameEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  streakNum: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: palette.textPrimary,
    lineHeight: 16,
  },
  info: {
    flex: 1,
    gap: 8,
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: palette.textPrimary,
    lineHeight: 19,
  },
  progressWrap: {
    gap: 4,
  },
  progressBg: {
    height: 4,
    backgroundColor: palette.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: palette.warmOrange,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '500' as const,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeText: {
    fontSize: 12,
    color: palette.successGreen,
    fontWeight: '600' as const,
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.md,
    paddingVertical: 13,
    overflow: 'hidden',
    shadowColor: palette.warmOrange,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  checkInText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
});
