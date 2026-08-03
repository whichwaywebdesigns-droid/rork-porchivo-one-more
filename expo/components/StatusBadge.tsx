import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Clock, Package, X } from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { ShipmentStatus } from '@/types';

interface StatusBadgeProps {
  status: ShipmentStatus;
  size?: 'small' | 'medium';
}

function StatusBadgeIcon({ status, size, color }: { status: ShipmentStatus; size: number; color: string }) {
  switch (status) {
    case 'open': return <Clock size={size} color={color} />;
    case 'accepted': return <Package size={size} color={color} />;
    case 'completed': return <Check size={size} color={color} />;
    case 'cancelled': return <X size={size} color={color} />;
  }
}

export default React.memo(function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const colors = useColors();
  const isSmall = size === 'small';

  const config = useMemo(() => ({
    open:      { label: 'Open',      bg: colors.primaryLight,  text: colors.primary },
    accepted:  { label: 'Accepted',  bg: colors.secondaryLight, text: colors.secondary },
    completed: { label: 'Completed', bg: colors.successLight,  text: colors.success },
    cancelled: { label: 'Cancelled', bg: colors.borderLight,   text: colors.slateLighter },
  }), [colors]);

  const item = config[status];

  return (
    <View style={[styles.badge, { backgroundColor: item.bg }, isSmall && styles.badgeSmall]}>
      <StatusBadgeIcon status={status} size={isSmall ? 10 : 12} color={item.text} />
      <Text style={[styles.label, { color: item.text }, isSmall && styles.labelSmall]}>
        {item.label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  labelSmall: {
    fontSize: 11,
  },
});
