import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useColors } from '@/constants/colors';
import FadeSlideIn from './FadeSlideIn';

interface BenefitCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Staggered entrance delay, ms. */
  delay?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Calm benefit card with a soft accent icon tile. Enters via a quiet
 * fade + slide so a column of them reveals sequentially.
 */
export default function BenefitCard({
  title,
  description,
  icon,
  delay = 0,
  style,
}: BenefitCardProps) {
  const Colors = useColors();

  return (
    <FadeSlideIn delay={delay}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: Colors.surface,
            borderColor: Colors.border,
            shadowColor: Colors.cardShadow,
          },
          style as ViewStyle,
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: Colors.skyBlue }]}>
          {React.cloneElement(icon as React.ReactElement<{ color?: string }>, {
            color: Colors.primary,
          })}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: Colors.slate }]}>{title}</Text>
          <Text style={[styles.description, { color: Colors.slateLight }]}>
            {description}
          </Text>
        </View>
      </View>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 19,
  },
});
