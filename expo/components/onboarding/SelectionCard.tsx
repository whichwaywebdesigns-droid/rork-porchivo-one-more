import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
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

interface SelectionCardProps {
  title: string;
  subtitle?: string;
  /** Optional clever one-liner shown beneath the subtitle in an accent tone. */
  tagline?: string;
  icon?: React.ReactNode;
  /** Optional brand/illustration image shown in place of the icon badge. */
  imageSource?: ImageSourcePropType;
  selected: boolean;
  onPress: () => void;
  /** Show a radio (single-select) or check (multi-select) affordance. */
  indicator?: 'radio' | 'check';
  testID?: string;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Tactile one-tap selection card with a subtle selected-state lift and a quiet
 * accent border. Used for role and pain-point screens.
 */
export default function SelectionCard({
  title,
  subtitle,
  tagline,
  icon,
  imageSource,
  selected,
  onPress,
  indicator = 'radio',
  testID,
  style,
}: SelectionCardProps) {
  const Colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(lift, {
      toValue: selected ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [selected, lift]);

  const handleIn = () =>
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 3,
    }).start();
  const handleOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 3,
    }).start();

  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
          styles.card,
          {
            backgroundColor: Colors.surface,
            borderColor: selected ? Colors.primary : Colors.border,
            borderWidth: selected ? 2 : 1,
            shadowColor: Colors.cardShadow,
            shadowOpacity: lift.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.14] }),
            shadowRadius: lift.interpolate({ inputRange: [0, 1], outputRange: [8, 16] }),
            transform: [{ scale }],
          },
          style as ViewStyle,
        ]}
    >
        {imageSource ? (
          <View
            style={[
              styles.imageWrap,
              {
                borderColor: selected ? Colors.primary : Colors.border,
                backgroundColor: Colors.surface,
              },
            ]}
          >
            <Image source={imageSource} style={styles.image} resizeMode="contain" />
          </View>
        ) : icon ? (
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: selected ? Colors.primary : Colors.skyBlue },
            ]}
          >
            {React.cloneElement(icon as React.ReactElement<{ color?: string }>, {
              color: selected ? Colors.onPrimary : Colors.primary,
            })}
          </View>
        ) : null}

        <View style={styles.copy}>
          <Text
            style={[styles.title, { color: selected ? Colors.primary : Colors.slate }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: Colors.slateLight }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          {tagline ? (
            <Text
              style={[styles.tagline, { color: selected ? Colors.primary : Colors.slateLight }]}
              numberOfLines={2}
            >
              {tagline}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            indicator === 'radio' ? styles.radio : styles.checkbox,
            {
              borderColor: selected ? Colors.primary : Colors.border,
              backgroundColor: selected ? Colors.primary : 'transparent',
            },
          ]}
        >
          {selected ? <Check size={13} color={Colors.onPrimary} strokeWidth={3} /> : null}
        </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 42,
    height: 42,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  tagline: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 5,
    fontStyle: 'italic',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
