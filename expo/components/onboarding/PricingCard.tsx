import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PricingCardProps {
  title: string;
  /** Primary price, e.g. "$99.99". */
  price: string;
  /** Cadence label, e.g. "per year". */
  cadence: string;
  /** Optional secondary line, e.g. "$8.33/mo · billed annually". */
  detail?: string;
  /** Restrained badge label (e.g. "Save 40%"). Shown only when emphasized. */
  badge?: string;
  selected: boolean;
  /** Visually primary plan — slightly stronger border + tinted surface. */
  emphasized?: boolean;
  onPress: () => void;
  testID?: string;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Premium plan selector. The emphasized plan gets a quiet accent treatment —
 * no loud stickers or cheap "BEST DEAL" banners. Selection animates subtly.
 */
export default function PricingCard({
  title,
  price,
  cadence,
  detail,
  badge,
  selected,
  emphasized = false,
  onPress,
  testID,
  style,
}: PricingCardProps) {
  const Colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const select = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(select, {
      toValue: selected ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [selected, select]);

  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 3 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 3 }).start()
      }
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
          styles.card,
          {
            backgroundColor: selected ? Colors.skyBlue : Colors.surface,
            borderColor: selected ? Colors.primary : Colors.border,
            borderWidth: selected ? 2 : 1,
            shadowColor: Colors.cardShadow,
            shadowOpacity: select.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.16] }),
            transform: [{ scale }],
          },
          style as ViewStyle,
        ]}
    >
        <View style={styles.left}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: Colors.slate }]}>{title}</Text>
            {badge && emphasized ? (
              <View style={[styles.badge, { backgroundColor: Colors.successLight }]}>
                <Text style={[styles.badgeText, { color: Colors.success }]}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {detail ? (
            <Text style={[styles.detail, { color: Colors.slateLight }]}>{detail}</Text>
          ) : null}
        </View>

        <View style={styles.right}>
          <View style={styles.priceWrap}>
            <Text style={[styles.price, { color: Colors.slate }]}>{price}</Text>
            <Text style={[styles.cadence, { color: Colors.slateLighter }]}>{cadence}</Text>
          </View>
          <View
            style={[
              styles.radio,
              {
                borderColor: selected ? Colors.primary : Colors.border,
                backgroundColor: selected ? Colors.primary : 'transparent',
              },
            ]}
          >
            {selected ? <Check size={12} color={Colors.onPrimary} strokeWidth={3} /> : null}
          </View>
        </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 2,
  },
  left: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detail: {
    fontSize: 13,
    marginTop: 4,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceWrap: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  cadence: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
