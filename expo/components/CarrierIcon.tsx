import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { Carrier } from '@/types';

interface CarrierIconProps {
  carrier: Carrier;
  size?: number;
}

const carrierColors: Record<Carrier, string> = {
  Amazon: '#FF9900',
  UPS: '#351C15',
  USPS: '#004B87',
  FedEx: '#4D148C',
  Other: Colors.slateLight,
};

export default React.memo(function CarrierIcon({ carrier, size = 40 }: CarrierIconProps) {
  const bg = carrierColors[carrier];
  const letter = carrier === 'Other' ? '?' : carrier[0];

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
});
