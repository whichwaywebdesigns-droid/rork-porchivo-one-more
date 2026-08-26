import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, CreditCard, Wrench, MoreHorizontal, Package, Handshake, User, Building2 } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { isEnabled } from '@/lib/featureFlags';
import { TabShellSkeleton } from '@/components/SkeletonLoader';

/**
 * Hybrid Navigation — Tab Layout
 *
 * Free Tier (no HOA community):  [ Deliveries ] [ Porch Partner ] [ Account ]
 * Community Tier (HOA-connected): [ Home ] [ Payments ] [ Requests ] [ More ]
 *
 * The tier is determined by whether the user has an active org membership.
 * No IAP, no pricing, no paywall anywhere.
 */
export default function TabLayout() {
  const Colors = useColors();
  const { isOrgMember, isLoading: isOrgLoading } = useOrganization();
  const showPorchPartners = isEnabled('PORCH_PARTNERS');

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
    // Tier is still unknown (first launch, no cached membership) — show the
    // shell skeleton instead of committing to the wrong tab set and flipping.
    return <TabShellSkeleton />;
  }

  if (isOrgMember) {
    // ── Community Tier: 4-tab nav ──────────────────────────────────────
    return (
      <Tabs screenOptions={tabOptions}>
        <Tabs.Screen
          name="(home)"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Home size={22} color={color} fill={focused ? color : 'transparent'} />
            ),
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: 'Payments',
            tabBarIcon: ({ color, focused }) => (
              <CreditCard size={22} color={color} fill={focused ? color : 'transparent'} />
            ),
          }}
        />
        <Tabs.Screen
          name="requests"
          options={{
            title: 'Requests',
            tabBarIcon: ({ color, focused }) => (
              <Wrench size={22} color={color} fill={focused ? color : 'transparent'} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, focused }) => (
              <MoreHorizontal size={22} color={color} fill={focused ? color : 'transparent'} />
            ),
          }}
        />
        {/* Hide free-tier tabs — they live inside More > My Deliveries */}
        <Tabs.Screen name="packages" options={{ href: null }} />
        <Tabs.Screen name="porch-partner" options={{ href: showPorchPartners ? null : null }} />
        <Tabs.Screen name="create" options={{ href: null }} />
        <Tabs.Screen name="activity" options={{ href: null }} />
        <Tabs.Screen name="community" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    );
  }

  // ── Free Tier: 3-tab nav ────────────────────────────────────────────
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen
        name="packages"
        options={{
          title: 'Deliveries',
          tabBarIcon: ({ color, focused }) => (
            <Package size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="porch-partner"
        options={{
          title: 'Porch Partner',
          href: showPorchPartners ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Handshake size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      {/* Hide community-tier tabs */}
      <Tabs.Screen name="(home)" options={{ href: null }} />
      <Tabs.Screen name="payments" options={{ href: null }} />
      <Tabs.Screen name="requests" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
    </Tabs>
  );
}
