import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Package,
  FileText,
  Handshake,
  User,
  ChevronRight,
  Building2,
  CalendarDays,
  Wrench,
  Users,
  BarChart2,
  LayoutDashboard,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { isEnabled } from '@/lib/featureFlags';

/**
 * More tab — Community Tier only.
 * Documents, amenity reservations, Porch Partner, account settings,
 * and "My Deliveries" (package tracking preserved from free tier).
 */
export default function MoreScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { activeOrg, isOrgAdmin, isOrgStaff, refreshOrgContext } = useOrganization();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrgContext();
    setRefreshing(false);
  };

  const sections = [
    {
      title: 'My Deliveries',
      items: [
        {
          label: 'Track Packages',
          icon: <Package size={18} color={Colors.primary} />,
          iconBg: Colors.primary + '18',
          route: '/(tabs)/packages',
        },
        {
          label: 'Porch Partner',
          icon: <Handshake size={18} color={Colors.success} />,
          iconBg: Colors.success + '18',
          route: '/(tabs)/porch-partner',
        },
      ],
    },
    {
      title: 'Community',
      items: [
        {
          label: 'Announcements',
          icon: <Building2 size={18} color={Colors.secondary} />,
          iconBg: Colors.secondary + '18',
          route: '/announcements',
        },
        ...(isEnabled('ORG_CALENDAR') ? [{
          label: 'Calendar & Events',
          icon: <CalendarDays size={18} color={Colors.primary} />,
          iconBg: Colors.primary + '18',
          route: '/community-calendar',
        }] : []),
        ...(isEnabled('ORG_MAINTENANCE') ? [{
          label: 'Maintenance',
          icon: <Wrench size={18} color={'#E07B00'} />,
          iconBg: '#E07B0018',
          route: '/submit-maintenance',
        }] : []),
        ...(isEnabled('ORG_RESIDENT_DIRECTORY') ? [{
          label: 'Resident Directory',
          icon: <Users size={18} color={Colors.gold} />,
          iconBg: Colors.gold + '18',
          route: '/resident-directory',
        }] : []),
      ],
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Account Settings',
          icon: <User size={18} color={Colors.primary} />,
          iconBg: Colors.primary + '18',
          route: '/(tabs)/profile',
        },
        {
          label: 'Privacy Policy',
          icon: <FileText size={18} color={Colors.slateLight} />,
          iconBg: Colors.border + '22',
          route: '/privacy-policy',
        },
        {
          label: 'Terms of Service',
          icon: <FileText size={18} color={Colors.slateLight} />,
          iconBg: Colors.border + '22',
          route: '/terms-of-service',
        },
      ],
    },
  ];

  // Admin section
  if (isOrgAdmin) {
    sections.push({
      title: 'Admin',
      items: [
        ...(isEnabled('ORG_ADMIN_DASHBOARD') ? [{
          label: 'Admin Dashboard',
          icon: <LayoutDashboard size={18} color={Colors.primary} />,
          iconBg: Colors.primary + '18',
          route: '/admin-dashboard',
        }] : []),
        {
          label: 'Role Management',
          icon: <Users size={18} color={Colors.primary} />,
          iconBg: Colors.primary + '18',
          route: '/role-management',
        },
        {
          label: 'Analytics',
          icon: <BarChart2 size={18} color={Colors.success} />,
          iconBg: Colors.success + '18',
          route: '/analytics-dashboard',
        },
      ],
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen
        options={{
          title: 'More',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.slate,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Org header */}
        {activeOrg && (
          <View style={[styles.orgHeader, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <View style={[styles.orgIcon, { backgroundColor: Colors.primary + '18' }]}>
              <Building2 size={22} color={Colors.primary} />
            </View>
            <View style={styles.orgInfo}>
              <Text style={[styles.orgName, { color: Colors.slate }]} numberOfLines={1}>
                {activeOrg.name}
              </Text>
              <Text style={[styles.orgType, { color: Colors.slateLighter }]}>
                {activeOrg.city ? `${activeOrg.city}, ${activeOrg.state}` : 'Community Member'}
              </Text>
            </View>
          </View>
        )}

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuRow,
                    idx > 0 && { borderTopColor: Colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>
                    {item.icon}
                  </View>
                  <Text style={[styles.menuLabel, { color: Colors.slate }]}>{item.label}</Text>
                  <ChevronRight size={16} color={Colors.slateLighter} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  orgHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  orgIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgInfo: { flex: 1 },
  orgName: { fontSize: 16, fontWeight: '700' as const, marginBottom: 2 },
  orgType: { fontSize: 13 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' as const },
});
