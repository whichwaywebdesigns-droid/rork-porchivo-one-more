import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, PlusCircle, Clock, User, Package, Crown, Building2 } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useOrganization } from '@/store/OrganizationContext';
import { isEnabled } from '@/lib/featureFlags';

function GoProTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const Colors = useColors();
  return (
    <View style={styles.wrapper}>
      <User size={22} color={color} fill={focused ? color : 'transparent'} />
      <View style={[styles.proBadge, { backgroundColor: Colors.primary, borderColor: Colors.background }]}>
        <Crown size={8} color="#FFFFFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative' as const,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    position: 'absolute' as const,
    top: -3,
    right: -5,
    borderRadius: 8,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});

export default function TabLayout() {
  const { isHomeowner } = useApp();
  const Colors = useColors();
  const isFree = false; // HOA-provisioned model — all users have full access
  const { isOrgMember, isOrgPending } = useOrganization();
  const showCommunity = isEnabled('COMMUNITY_MODE');
  const showPorchPartners = isEnabled('PORCH_PARTNERS');
  // Dot indicator when org membership is pending
  const hasCommunityDot = isOrgPending && !isOrgMember;

  return (
    <Tabs
      screenOptions={{
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
      }}
    >
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
        name="packages"
        options={{
          title: 'Packages',
          tabBarIcon: ({ color, focused }) => (
            <Package size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <PlusCircle size={24} color={color} />,
          href: showPorchPartners && isHomeowner ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <Clock size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          href: showCommunity ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.wrapper}>
              <Building2 size={22} color={color} fill={focused ? color : 'transparent'} />
              {hasCommunityDot ? (
                <View style={[styles.proBadge, { backgroundColor: Colors.gold, borderColor: Colors.background }]} />
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isFree ? 'Go Pro' : 'Profile',
          tabBarIcon: ({ color, focused }) =>
            isFree ? (
              <GoProTabIcon color={color} focused={focused} />
            ) : (
              <User size={22} color={color} fill={focused ? color : 'transparent'} />
            ),
          tabBarActiveTintColor: Colors.primary,
        }}
      />
    </Tabs>
  );
}
