import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Package, Handshake, ChevronRight, Users } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import ShipmentCard from '@/components/ShipmentCard';
import { PorchPartnerSkeleton } from '@/components/SkeletonLoader';

/**
 * Porch Partner tab — visible in the Free Tier.
 * Shows hold requests, incoming packages to hold, and pickup coordination.
 */
export default function PorchPartnerScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { user, isPartner } = useApp();
  const { nearbyShipments, acceptShipment, isLoading: isShipmentsLoading } = useShipments();
  const { holds, isLoading: isHoldsLoading } = usePorchPartners();
  const [refreshing, setRefreshing] = React.useState(false);

  const activeHolds = holds.filter(
    (h) => h.status === 'pending' || h.status === 'picked_up',
  );

  // Skeleton on first load only — refetches with existing data keep the UI.
  const isInitialLoading =
    (isShipmentsLoading || isHoldsLoading) &&
    activeHolds.length === 0 &&
    nearbyShipments.length === 0;

  if (isInitialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Porch Partner',
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.slate,
            headerShadowVisible: false,
          }}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <PorchPartnerSkeleton />
        </ScrollView>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Porch Partner',
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
        {/* Hero card */}
        <View style={[styles.heroCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: Colors.success + '18' }]}>
            <Handshake size={28} color={Colors.success} />
          </View>
          <Text style={[styles.heroTitle, { color: Colors.slate }]}>
            Help your neighbors
          </Text>
          <Text style={[styles.heroBody, { color: Colors.slateLight }]}>
            Hold packages for neighbors and coordinate pickups. Build trust in your building.
          </Text>
        </View>

        {/* Active holds */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
            Active Holds
          </Text>
          {activeHolds.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
              <Package size={24} color={Colors.slateLighter} />
              <Text style={[styles.emptyText, { color: Colors.slateLight }]}>
                No active holds. You'll see requests here when neighbors need help.
              </Text>
            </View>
          ) : (
            activeHolds.map((hold) => (
              <TouchableOpacity
                key={hold.packageId}
                style={[styles.holdCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
                onPress={() => router.push({ pathname: '/partner-detail' as any, params: { id: hold.partnerId } })}
                activeOpacity={0.75}
              >
                <View style={[styles.holdIcon, { backgroundColor: Colors.primary + '18' }]}>
                  <Package size={18} color={Colors.primary} />
                </View>
                <View style={styles.holdInfo}>
                  <Text style={[styles.holdTitle, { color: Colors.slate }]} numberOfLines={1}>
                    {hold.homeownerNickname ?? 'Package hold'}
                  </Text>
                  <Text style={[styles.holdMeta, { color: Colors.slateLighter }]}>
                    {hold.status === 'picked_up' ? 'Picked up' : 'Pending pickup'}
                  </Text>
                </View>
                <ChevronRight size={16} color={Colors.slateLighter} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Nearby shipments (partner view) */}
        {isPartner && nearbyShipments.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
              Nearby Requests
            </Text>
            {nearbyShipments.slice(0, 5).map((shipment) => (
              <ShipmentCard
                key={shipment.id}
                shipment={shipment}
                onPress={() => router.push({ pathname: '/shipment-detail' as any, params: { id: shipment.id } })}
                onAccept={() => acceptShipment(shipment.id)}
                showDistance={user?.hasLocationConsent}
                variant="partner"
              />
            ))}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>
            Quick Actions
          </Text>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            onPress={() => router.push('/partners' as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '18' }]}>
              <Users size={18} color={Colors.primary} />
            </View>
            <Text style={[styles.actionText, { color: Colors.slate }]}>Find Partners</Text>
            <ChevronRight size={16} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  holdCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  holdIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdInfo: { flex: 1 },
  holdTitle: { fontSize: 15, fontWeight: '600' as const, marginBottom: 2 },
  holdMeta: { fontSize: 13 },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, fontSize: 15, fontWeight: '500' as const },
});
