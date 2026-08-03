import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
  Platform,
} from 'react-native';
import { AlertTriangle, ExternalLink } from 'lucide-react-native';
import { palette, radius } from '@/constants/theme';
import { getTodayFact } from '@/mocks/dailyPackageTheftFacts';
import { log } from "../lib/logger";

interface DailyPackageTheftFactProps {
  dateOverride?: string;
}

function DailyPackageTheftFact({ dateOverride }: DailyPackageTheftFactProps) {
  const fact = useMemo(() => getTodayFact(dateOverride), [dateOverride]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 200,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    ).start();
  }, [fadeAnim, pulseAnim]);

  const handleSourcePress = () => {
    if (fact.sourceUrl) {
      if (Platform.OS === 'web') {
        window.open(fact.sourceUrl, '_blank');
      } else {
        Linking.openURL(fact.sourceUrl).catch(err =>
          log('[DailyFact] Failed to open URL:', err)
        );
      }
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]} testID="daily-fact">
      <View style={styles.headerRow}>
        <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <AlertTriangle size={12} color={palette.warmOrange} />
        </Animated.View>
        <Text style={styles.heading}>Today's Theft Reality</Text>
      </View>
      <Text style={styles.factText} numberOfLines={4}>
        {fact.factText}
      </Text>
      <TouchableOpacity
        style={styles.sourceRow}
        onPress={handleSourcePress}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        testID="fact-source-link"
      >
        <Text style={styles.sourceLabel}>Source: {fact.sourceName}</Text>
        <ExternalLink size={10} color={palette.textDisabled} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default React.memo(DailyPackageTheftFact);

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.bgSurface,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.warmOrangeGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: palette.warmOrange,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  factText: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 10,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceLabel: {
    fontSize: 11,
    color: palette.textDisabled,
    fontWeight: '500' as const,
  },
});
