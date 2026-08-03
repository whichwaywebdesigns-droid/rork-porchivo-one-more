import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Animated,
  ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  MapPin,
  Locate,
  Package,
  HandHeart,
  Users,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { palette } from '@/constants/theme';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { Shipment, PorchPartner } from '@/types';
import { log } from "@/lib/logger";

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

type ViewMode = 'all' | 'shipments' | 'partners';

const PARTNER_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  pp_1: { lat: 37.7755, lng: -122.4180 },
  pp_2: { lat: 37.7740, lng: -122.4210 },
  pp_3: { lat: 37.7762, lng: -122.4170 },
  pp_4: { lat: 37.7735, lng: -122.4230 },
  pp_5: { lat: 37.7770, lng: -122.4160 },
};

function getPartnerLocation(partner: PorchPartner): { lat: number; lng: number } {
  return PARTNER_LOCATIONS[partner.id] ?? {
    lat: 37.7749 + (partner.distance * 0.009 * (partner.id.charCodeAt(3) % 2 === 0 ? 1 : -1)),
    lng: -122.4194 + (partner.distance * 0.012 * (partner.id.charCodeAt(4) % 2 === 0 ? 1 : -1)),
  };
}

export default function NetworkMapScreen() {
  const router = useRouter();
  const { user } = useApp();
  const { activeShipments } = useShipments();
  const { activePartners, holds } = usePorchPartners();
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItem, setSelectedItem] = useState<{ type: 'shipment' | 'partner'; data: Shipment | PorchPartner } | null>(null);
  const slideAnim = useRef(new Animated.Value(200)).current;

  const shipmentPins = useMemo(() =>
    activeShipments.filter(s => s.approximateLocation),
    [activeShipments]
  );

  const partnerPins = useMemo(() =>
    activePartners.map(p => ({
      partner: p,
      location: getPartnerLocation(p),
      activeHolds: holds.filter(h => h.partnerId === p.id && (h.status === 'pending' || h.status === 'picked_up')).length,
    })),
    [activePartners, holds]
  );

  const initialRegion = useMemo(() => {
    if (userLocation) {
      return { ...userLocation, latitudeDelta: 0.025, longitudeDelta: 0.025 };
    }
    if (shipmentPins.length > 0 && shipmentPins[0].approximateLocation) {
      return {
        latitude: shipmentPins[0].approximateLocation.lat,
        longitude: shipmentPins[0].approximateLocation.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      };
    }
    return DEFAULT_REGION;
  }, [shipmentPins, userLocation]);

  const requestLocation = useCallback(async () => {
    if (locationLoading) return;
    setLocationLoading(true);
    log('[NetworkMap] Requesting user location...');
    try {
      if (Platform.OS !== 'web') {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(coords);
          mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
        }
      } else {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              setUserLocation(coords);
              mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
            },
            (err) => log('[NetworkMap] Web geolocation error:', err.message),
            { enableHighAccuracy: false, timeout: 10000 }
          );
        }
      }
    } catch (e) {
      log('[NetworkMap] Location error:', e);
    } finally {
      setLocationLoading(false);
    }
  }, [locationLoading]);

  useEffect(() => {
    if (user?.hasLocationConsent) {
      void requestLocation();
    }
  }, [user?.hasLocationConsent]);

  useEffect(() => {
    if (selectedItem) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 200, duration: 200, useNativeDriver: true }).start();
    }
  }, [selectedItem, slideAnim]);

  const handleShipmentPress = useCallback((shipment: Shipment) => {
    setSelectedItem({ type: 'shipment', data: shipment });
    if (shipment.approximateLocation) {
      mapRef.current?.animateToRegion({
        latitude: shipment.approximateLocation.lat,
        longitude: shipment.approximateLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600);
    }
  }, []);

  const handlePartnerPress = useCallback((partner: PorchPartner) => {
    setSelectedItem({ type: 'partner', data: partner });
    const loc = getPartnerLocation(partner);
    mapRef.current?.animateToRegion({
      latitude: loc.lat,
      longitude: loc.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  }, []);

  const handleMapPress = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const showShipments = viewMode === 'all' || viewMode === 'shipments';
  const showPartners = viewMode === 'all' || viewMode === 'partners';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Partner-Shipments Network',
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.primary,
        headerShadowVisible: false,
      }} />

      <View style={styles.filterBar}>
        {(['all', 'shipments', 'partners'] as ViewMode[]).map((mode) => {
          const labels: Record<ViewMode, string> = { all: 'All', shipments: 'Shipments', partners: 'Partners' };
          const icons: Record<ViewMode, React.ReactNode> = {
            all: <Layers size={13} color={viewMode === mode ? Colors.white : Colors.slateLight} />,
            shipments: <Package size={13} color={viewMode === mode ? Colors.white : Colors.slateLight} />,
            partners: <Users size={13} color={viewMode === mode ? Colors.white : Colors.slateLight} />,
          };
          return (
            <TouchableOpacity
              key={mode}
              style={[styles.filterPill, viewMode === mode && styles.filterPillActive]}
              onPress={() => setViewMode(mode)}
              activeOpacity={0.7}
              testID={`filter-${mode}`}
            >
              {icons[mode]}
              <Text style={[styles.filterPillText, viewMode === mode && styles.filterPillTextActive]}>
                {labels[mode]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation={!!user?.hasLocationConsent}
          showsMyLocationButton={false}
          showsCompass={false}
          onPress={handleMapPress}
          testID="network-map-view"
        >
          {showShipments && shipmentPins.map((s) => (
            <Marker
              key={`s-${s.id}`}
              coordinate={{
                latitude: s.approximateLocation?.lat ?? 0,
                longitude: s.approximateLocation?.lng ?? 0,
              }}
              onPress={() => handleShipmentPress(s)}
              testID={`shipment-marker-${s.id}`}
            >
              <View style={styles.shipmentMarker}>
                <View style={styles.shipmentMarkerInner}>
                  <Package size={12} color={Colors.white} />
                </View>
                <View style={styles.shipmentMarkerArrow} />
              </View>
            </Marker>
          ))}

          {showPartners && partnerPins.map(({ partner, location, activeHolds }) => (
            <Marker
              key={`p-${partner.id}`}
              coordinate={{ latitude: location.lat, longitude: location.lng }}
              onPress={() => handlePartnerPress(partner)}
              testID={`partner-marker-${partner.id}`}
            >
              <View style={styles.partnerMarker}>
                <View style={styles.partnerMarkerInner}>
                  <HandHeart size={12} color={Colors.white} />
                </View>
                {activeHolds > 0 && (
                  <View style={styles.holdsBadge}>
                    <Text style={styles.holdsBadgeText}>{activeHolds}</Text>
                  </View>
                )}
                <View style={styles.partnerMarkerArrow} />
              </View>
            </Marker>
          ))}
        </MapView>

        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={requestLocation}
            activeOpacity={0.8}
            testID="locate-btn"
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Locate size={20} color={Colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.legendBar}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.secondary }]} />
            <Text style={styles.legendText}>Shipments ({shipmentPins.length})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.sage }]} />
            <Text style={styles.legendText}>Partners ({activePartners.length})</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.panelHandle} />
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.secondary + '18' }]}>
              <Package size={16} color={Colors.secondary} />
            </View>
            <Text style={styles.statValue}>{shipmentPins.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: palette.sageSoft }]}>
              <Users size={16} color={palette.sage} />
            </View>
            <Text style={styles.statValue}>{activePartners.length}</Text>
            <Text style={styles.statLabel}>Partners</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.primary + '18' }]}>
              <HandHeart size={16} color={Colors.primary} />
            </View>
            <Text style={styles.statValue}>
              {holds.filter(h => h.status === 'pending' || h.status === 'picked_up').length}
            </Text>
            <Text style={styles.statLabel}>Holdings</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: palette.sky }]}>
              <Shield size={16} color={palette.navy} />
            </View>
            <Text style={styles.statValue}>
              {holds.filter(h => h.status === 'returned').length}
            </Text>
            <Text style={styles.statLabel}>Returned</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardScroll}>
          {showPartners && partnerPins.map(({ partner, activeHolds }) => (
            <TouchableOpacity
              key={partner.id}
              style={styles.networkCard}
              onPress={() => router.push({ pathname: '/partner-detail' as any, params: { id: partner.id } })}
              activeOpacity={0.7}
            >
              <View style={styles.networkCardAvatar}>
                <Text style={styles.networkCardAvatarText}>
                  {partner.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <Text style={styles.networkCardName} numberOfLines={1}>{partner.name}</Text>
              <Text style={styles.networkCardSub}>{partner.distance} mi · {activeHolds} active</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectedItem && (
        <Animated.View style={[styles.selectedOverlay, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity
            style={styles.selectedCardInner}
            activeOpacity={0.9}
            onPress={() => {
              if (selectedItem.type === 'shipment') {
                router.push(`/shipment-detail?id=${(selectedItem.data as Shipment).id}` as any);
              } else {
                router.push({ pathname: '/partner-detail' as any, params: { id: (selectedItem.data as PorchPartner).id } });
              }
            }}
            testID="selected-item-card"
          >
            <View style={[
              styles.selectedDot,
              { backgroundColor: selectedItem.type === 'shipment' ? palette.ember : palette.sage }
            ]} />
            <View style={styles.selectedContent}>
              {selectedItem.type === 'shipment' ? (
                <>
                  <Text style={styles.selectedTitle}>
                    {(selectedItem.data as Shipment).carrier} · {(selectedItem.data as Shipment).packagesExpected}
                  </Text>
                  <Text style={styles.selectedSub}>{(selectedItem.data as Shipment).addressText}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.selectedTitle}>{(selectedItem.data as PorchPartner).name}</Text>
                  <Text style={styles.selectedSub}>
                    {(selectedItem.data as PorchPartner).street} · ★ {(selectedItem.data as PorchPartner).rating}
                  </Text>
                </>
              )}
            </View>
            <View style={styles.selectedAction}>
              <Text style={styles.selectedActionText}>View</Text>
              <ChevronRight size={14} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slateLight,
  },
  filterPillTextActive: {
    color: Colors.white,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  shipmentMarker: {
    alignItems: 'center',
  },
  shipmentMarkerInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  shipmentMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.secondary,
    marginTop: -2,
  },
  partnerMarker: {
    alignItems: 'center',
  },
  partnerMarkerInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.sage,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  partnerMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: palette.sage,
    marginTop: -2,
  },
  holdsBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  holdsBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  mapControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 10,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  legendBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  bottomPanel: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.slate,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.slateLighter,
    textTransform: 'uppercase' as const,
  },
  cardScroll: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  networkCard: {
    width: 110,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 6,
  },
  networkCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkCardAvatarText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  networkCardName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.slate,
    textAlign: 'center' as const,
  },
  networkCardSub: {
    fontSize: 10,
    color: Colors.slateLighter,
    textAlign: 'center' as const,
  },
  selectedOverlay: {
    position: 'absolute',
    bottom: 240,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  selectedCardInner: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  selectedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  selectedContent: {
    flex: 1,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  selectedSub: {
    fontSize: 12,
    color: Colors.slateLight,
    marginTop: 2,
  },
  selectedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  selectedActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
