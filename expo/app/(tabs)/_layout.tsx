import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, CreditCard, Wrench, MoreHorizontal } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useTranslation } from 'react-i18next';
import { TabShellSkeleton } from '@/components/SkeletonLoader';

/**
 * Hybrid Navigation — Tab Layout (unified)
 *
 * Every user sees the same 4 tabs (Home / Payments / Requests / More) so the
 * app reads as one product across tiers. Free-tier surfaces stay reachable:
 * My Deliveries and Porch Partner live under More; Account via More settings.
 * No IAP, no pricing, no paywall anywhere.
 */
export default function TabLayout() {
  const Colors = useColors();
  const { isLoading: isOrgLoading } = useOrganization();
  const { t } = useTranslation();

  const tabOptions = {
    headerShown: false,
    tabBarActiveTintColor: Colors.primary,
    tabBarInactiveTintColor: Colors.slateLighter,
    tabBarStyle: {
      backgroundColor: Colors.surface,
      borderTopColor: Colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      ...(Platform.OS === 'ios' ? { height: 82, paddingBottom: 24 } : {}),
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600' as const,
      letterSpacing: 0.3,
    },
  };

  if (isOrgLoading) {
    // Org context still resolving on first launch — show the shell skeleton
    // instead of flashing an incomplete bar.
    return <TabShellSkeleton />;
  }

  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ color, focused }) => (
            <Home size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: t('tab.payments'),
          tabBarIcon: ({ color, focused }) => (
            <CreditCard size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: t('tab.requests'),
          tabBarIcon: ({ color, focused }) => (
            <Wrench size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tab.more'),
          tabBarIcon: ({ color, focused }) => (
            <MoreHorizontal size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      {/* Reachable via More (My Deliveries / Porch Partner) — hidden from the bar */}
      <Tabs.Screen name="packages" options={{ href: null }} />
      <Tabs.Screen name="porch-partner" options={{ href: null }} />
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
