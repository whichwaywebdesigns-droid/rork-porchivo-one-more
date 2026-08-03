import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Animated,
  ScrollView,
  Dimensions,
  Easing,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import MapView, {
  Marker,
  Region,
  Polyline,
  Circle,
  PROVIDER_DEFAULT,
} from 'react-native-maps';
import { Image as ExpoImage } from 'expo-image';
import {
  MapPin,
  Navigation,
  Locate,
  Package,
  ChevronRight,
  Truck,
  Car,
  Bike,
  Users,
  HandHeart,
  Home,
  Star,
  Clock,
  Layers,
  Zap,
  CircleDot,
  Moon,
  Sun,
  Gauge,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { palette, radius, space, elevation } from '@/constants/theme';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import { useDrivers } from '@/store/DriversContext';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { Shipment, Driver, PorchPartner, VehicleType } from '@/types';
import { log } from '@/lib/logger';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

// Signature success chime — plays when the delivery countdown reaches zero
const ARRIVAL_CHIME = require('@/assets/audio/porch-light-verified-chime.mp3');

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

type ViewMode = 'all' | 'shipments' | 'drivers' | 'partners';
type SelectedItem =
  | { type: 'shipment'; data: Shipment }
  | { type: 'driver'; data: Driver }
  | { type: 'partner'; data: PorchPartner }
  | null;

type RouteInfo = {
  distanceKm: number;
  travelTimeMin: number;
  destinationLabel: string;
  shipmentId: string;
} | null;

type DistanceUnit = 'km' | 'mi';

type TrafficLevel = 'free' | 'moderate' | 'heavy';
type TrafficSegment = {
  coords: { latitude: number; longitude: number }[];
  level: TrafficLevel;
  color: string;
};

const TRAFFIC_COLORS: Record<TrafficLevel, string> = {
  free: '#1E9C6A',
  moderate: '#E8A317',
  heavy: '#E8622A',
};

const MI_PER_KM = 0.621371;

// Total countdown duration (28 min) — used for route progress calculation
const INITIAL_ETA_SECONDS = 28 * 60;

// ── Format a Date to 12-hour clock time (e.g. "3:45 PM") ─────────────────────
function formatClockTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

// ── Interpolate a point along a polyline at a given fraction (0–1) ───────────
function interpolatePolyline(
  coords: { latitude: number; longitude: number }[],
  fraction: number,
): { latitude: number; longitude: number }[] {
  if (coords.length < 2 || fraction <= 0) return [];
  if (fraction >= 1) return [...coords];

  // Compute cumulative distances
  const totalDist = polylineDistanceKm(coords);
  const targetDist = totalDist * fraction;
  let acc = 0;
  const result: { latitude: number; longitude: number }[] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const segDist = haversineKm(
      coords[i - 1].latitude, coords[i - 1].longitude,
      coords[i].latitude, coords[i].longitude,
    );
    if (acc + segDist >= targetDist) {
      const remaining = targetDist - acc;
      const t = segDist > 0 ? remaining / segDist : 0;
      result.push({
        latitude: coords[i - 1].latitude + (coords[i].latitude - coords[i - 1].latitude) * t,
        longitude: coords[i - 1].longitude + (coords[i].longitude - coords[i - 1].longitude) * t,
      });
      return result;
    }
    acc += segDist;
    result.push(coords[i]);
  }
  return result;
}

// ── Haversine distance between two coords (km) ────────────────────────────────
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Total polyline distance (km) ──────────────────────────────────────────────
function polylineDistanceKm(coords: { latitude: number; longitude: number }[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(
      coords[i - 1].latitude, coords[i - 1].longitude,
      coords[i].latitude, coords[i].longitude,
    );
  }
  return total;
}

// ── Format distance with unit switching (km / mi) ────────────────────────────
function formatDistance(km: number, unit: DistanceUnit): string {
  if (unit === 'mi') {
    const mi = km * MI_PER_KM;
    if (mi < 0.1) return `${Math.round(mi * 5280)} ft`;
    return `${Math.round(mi * 10) / 10} mi`;
  }
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Math.round(km * 10) / 10} km`;
}

// ── Generate traffic congestion segments from route polyline ─────────────────
function generateTrafficSegments(
  coords: { latitude: number; longitude: number }[],
): TrafficSegment[] {
  if (coords.length < 2) return [];
  const SUB = 3;
  const segments: TrafficSegment[] = [];
  let idx = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    for (let j = 0; j < SUB; j++) {
      const t1 = j / SUB;
      const t2 = (j + 1) / SUB;
      const c1 = {
        latitude: p1.latitude + (p2.latitude - p1.latitude) * t1,
        longitude: p1.longitude + (p2.longitude - p1.longitude) * t1,
      };
      const c2 = {
        latitude: p1.latitude + (p2.latitude - p1.latitude) * t2,
        longitude: p1.longitude + (p2.longitude - p1.longitude) * t2,
      };
      const hash = (idx * 5 + 2) % 3;
      const level: TrafficLevel = hash === 0 ? 'free' : hash === 1 ? 'moderate' : 'heavy';
      segments.push({ coords: [c1, c2], level, color: TRAFFIC_COLORS[level] });
      idx++;
    }
  }
  return segments;
}

// ── Partner geo positions (deterministic mock based on id hash) ──────────────
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

// ── Vehicle icon resolver ────────────────────────────────────────────────────
function VehicleIcon({ type, size = 16, color = '#FFFFFF' }: { type: VehicleType; size?: number; color?: string }) {
  switch (type) {
    case 'van': return <Truck size={size} color={color} strokeWidth={2.4} />;
    case 'truck': return <Truck size={size} color={color} strokeWidth={2.4} />;
    case 'bike': return <Bike size={size} color={color} strokeWidth={2.4} />;
    case 'scooter': return <Bike size={size} color={color} strokeWidth={2.4} />;
    case 'car':
    default: return <Car size={size} color={color} strokeWidth={2.4} />;
  }
}

const DRIVER_STATUS_COLORS: Record<string, string> = {
  available: '#1E9C6A',
  busy: '#E8622A',
  offline: '#9CA8BB',
};

const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  open: '#3A7BD5',
  accepted: '#1E9C6A',
  completed: '#6B7F99',
};

// ── Avatar component for partner markers (profile pic or initials) ───────────
function PartnerAvatarMarker({ partner, size = 36 }: { partner: PorchPartner; size?: number }) {
  const colors = useColors();
  if (partner.avatarUrl) {
    return (
      <ExpoImage
        source={{ uri: partner.avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  const initials = partner.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={[pm.fallbackAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={pm.fallbackText}>{initials}</Text>
    </View>
  );
}

const pm = StyleSheet.create({
  fallbackAvatar: {
    backgroundColor: palette.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 13,
  },
});

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function MapScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, isPartner, isHomeowner } = useApp();
  const { activeShipments } = useShipments();
  const { drivers } = useDrivers();
  const { activePartners, holds } = usePorchPartners();
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo>(null);
  const [etaSeconds, setEtaSeconds] = useState<number>(INITIAL_ETA_SECONDS);
  const [isNightMode, setIsNightMode] = useState<boolean>(false);
  const [showTraffic, setShowTraffic] = useState<boolean>(false);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  // Bottom sheet animation
  const sheetAnim = useRef(new Animated.Value(0)).current;
  // Driver pulse animation
  const pulseAnim = useRef(new Animated.Value(0)).current;
  // ── Delivery-arrived sound + driver marker ────────────────────────────────
  const chimePlayerRef = useRef<AudioPlayer | null>(null);
  const hasPlayedArrivalSound = useRef<boolean>(false);
  const [deliveredDriverPos, setDeliveredDriverPos] = useState<{ latitude: number; longitude: number } | null>(null);

  // Route indicator dot pulse (under 15 min)
  const dotPulseAnim = useRef(new Animated.Value(0)).current;

  // ── Data filtering ─────────────────────────────────────────────────────────
  const shipmentPins = useMemo(
    () => activeShipments.filter((s) => s.approximateLocation),
    [activeShipments],
  );

  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.location && d.status !== 'offline'),
    [drivers],
  );

  const partnerPins = useMemo(
    () =>
      activePartners.map((p) => ({
        partner: p,
        location: getPartnerLocation(p),
        activeHolds: holds.filter(
          (h) => h.partnerId === p.id && (h.status === 'pending' || h.status === 'picked_up'),
        ).length,
      })),
    [activePartners, holds],
  );

  // ── Initial region ────────────────────────────────────────────────────────
  const initialRegion = useMemo(() => {
    if (userLocation) return { ...userLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 };
    if (shipmentPins.length > 0 && shipmentPins[0].approximateLocation) {
      return {
        latitude: shipmentPins[0].approximateLocation.lat,
        longitude: shipmentPins[0].approximateLocation.lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
    }
    if (activeDrivers.length > 0 && activeDrivers[0].location) {
      return {
        latitude: activeDrivers[0].location.lat,
        longitude: activeDrivers[0].location.lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
    }
    return DEFAULT_REGION;
  }, [shipmentPins, activeDrivers, userLocation]);

  // ── Location request ──────────────────────────────────────────────────────
  const requestLocation = useCallback(async () => {
    if (locationLoading) return;
    setLocationLoading(true);
    log('[MapScreen] Requesting user location...');
    try {
      if (Platform.OS !== 'web') {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          log('[MapScreen] Got location:', loc.coords.latitude, loc.coords.longitude);
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(coords);
          mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 800);
        } else {
          log('[MapScreen] Location permission denied');
        }
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setUserLocation(coords);
            mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 800);
          },
          (err) => log('[MapScreen] Web geolocation error:', err.message),
          { enableHighAccuracy: false, timeout: 10000 },
        );
      }
    } catch (e) {
      log('[MapScreen] Location error:', e);
    } finally {
      setLocationLoading(false);
    }
  }, [locationLoading]);

  useEffect(() => {
    if (user?.hasLocationConsent) void requestLocation();
  }, [user?.hasLocationConsent, requestLocation]);

  // ── Pulse animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.1, 0] });

  // ── Real-time countdown (1-second tick) ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setEtaSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Derived countdown values
  const etaMin = Math.floor(etaSeconds / 60);
  const etaSec = etaSeconds % 60;
  const countdownDisplay = `${String(etaMin).padStart(2, '0')}:${String(etaSec).padStart(2, '0')}`;
  const isDelivered = etaSeconds <= 0;

  // ── ETA arrival clock time (computed from countdown duration) ─────────────
  const arrivalTime = useMemo(() => {
    const arrival = new Date(Date.now() + etaSeconds * 1000);
    return formatClockTime(arrival);
  }, [etaSeconds]);

  // ── Route progress fraction (0 = just started, 1 = arrived) ───────────────
  const routeProgress = useMemo(
    () => Math.min(1, Math.max(0, 1 - etaSeconds / INITIAL_ETA_SECONDS)),
    [etaSeconds],
  );

  // ── Route indicator dot pulse (only when < 15 min) ───────────────────────
  useEffect(() => {
    const shouldPulse = routeInfo !== null && routeInfo.travelTimeMin < 15;
    if (!shouldPulse) {
      dotPulseAnim.stopAnimation();
      dotPulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(dotPulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [routeInfo, dotPulseAnim]);

  const dotPulseScale = dotPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const dotPulseOpacity = dotPulseAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.2, 0] });

  // ── Bottom sheet animation ────────────────────────────────────────────────
  useEffect(() => {
    if (selectedItem) {
      Animated.spring(sheetAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedItem, sheetAnim]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // ── Marker press handlers ─────────────────────────────────────────────────
  const handleShipmentPress = useCallback((shipment: Shipment) => {
    setSelectedItem({ type: 'shipment', data: shipment });
    if (shipment.approximateLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: shipment.approximateLocation.lat,
          longitude: shipment.approximateLocation.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        600,
      );
    }
  }, []);

  const handleDriverPress = useCallback((driver: Driver) => {
    setSelectedItem({ type: 'driver', data: driver });
    if (driver.location) {
      mapRef.current?.animateToRegion(
        {
          latitude: driver.location.lat,
          longitude: driver.location.lng,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        600,
      );
    }
  }, []);

  const handlePartnerPress = useCallback((partner: PorchPartner) => {
    setSelectedItem({ type: 'partner', data: partner });
    const loc = getPartnerLocation(partner);
    mapRef.current?.animateToRegion(
      { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      600,
    );
  }, []);

  const handleMapPress = useCallback(() => {
    setSelectedItem(null);
    setRouteInfo(null);
  }, []);

  const showShipments = viewMode === 'all' || viewMode === 'shipments';
  const showDrivers = viewMode === 'all' || viewMode === 'drivers';
  const showPartners = viewMode === 'all' || viewMode === 'partners';

  // ── Fit all markers ────────────────────────────────────────────────────────
  const handleFitAll = useCallback(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    if (showShipments) {
      shipmentPins.forEach((s) => {
        if (s.approximateLocation) coords.push({ latitude: s.approximateLocation.lat, longitude: s.approximateLocation.lng });
      });
    }
    if (showDrivers) {
      activeDrivers.forEach((d) => {
        if (d.location) coords.push({ latitude: d.location.lat, longitude: d.location.lng });
      });
    }
    if (showPartners) {
      partnerPins.forEach(({ location }) => coords.push({ latitude: location.lat, longitude: location.lng }));
    }
    if (userLocation) coords.push(userLocation);
    if (coords.length > 0) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 60, bottom: 280, left: 60 },
        animated: true,
      });
    }
  }, [shipmentPins, activeDrivers, partnerPins, userLocation, showShipments, showDrivers, showPartners]);

  // ── Filter bar config ──────────────────────────────────────────────────────
  const filterModes: { mode: ViewMode; label: string; icon: React.ReactNode; count: number }[] = [
    { mode: 'all', label: 'All', icon: <Layers size={13} color={viewMode === 'all' ? colors.white : colors.slateLight} />, count: shipmentPins.length + activeDrivers.length + partnerPins.length },
    { mode: 'shipments', label: 'Packages', icon: <Package size={13} color={viewMode === 'shipments' ? colors.white : colors.slateLight} />, count: shipmentPins.length },
    { mode: 'drivers', label: 'Drivers', icon: <Truck size={13} color={viewMode === 'drivers' ? colors.white : colors.slateLight} />, count: activeDrivers.length },
    { mode: 'partners', label: 'Partners', icon: <HandHeart size={13} color={viewMode === 'partners' ? colors.white : colors.slateLight} />, count: partnerPins.length },
  ];

  // ── Route line for first active shipment → assigned driver ─────────────────
  const routePolyline = useMemo(() => {
    if (!showShipments || shipmentPins.length === 0) return null;
    const sh = shipmentPins[0];
    if (!sh.approximateLocation) return null;

    // Find the driver assigned to this shipment (or nearest available driver)
    const assignedDriver = activeDrivers.find((d) => d.location);
    if (!assignedDriver?.location) {
      // Synthetic route from a mock driver position near the destination
      const dest = sh.approximateLocation;
      return [
        { latitude: dest.lat + 0.008, longitude: dest.lng - 0.006 },
        { latitude: dest.lat + 0.005, longitude: dest.lng - 0.003 },
        { latitude: dest.lat + 0.002, longitude: dest.lng - 0.001 },
        { latitude: dest.lat, longitude: dest.lng },
      ];
    }
    return [
      { latitude: assignedDriver.location.lat, longitude: assignedDriver.location.lng },
      {
        latitude: (assignedDriver.location.lat + sh.approximateLocation.lat) / 2,
        longitude: (assignedDriver.location.lng + sh.approximateLocation.lng) / 2,
      },
      { latitude: sh.approximateLocation.lat, longitude: sh.approximateLocation.lng },
    ];
  }, [showShipments, shipmentPins, activeDrivers]);

  // ── Traffic congestion segments (generated from route polyline) ───────────
  const trafficSegments = useMemo(
    () => (routePolyline ? generateTrafficSegments(routePolyline) : []),
    [routePolyline],
  );

  // ── Auto-zoom to route polyline when it appears ────────────────────────────
  useEffect(() => {
    if (routePolyline && routePolyline.length >= 2) {
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(routePolyline, {
          edgePadding: { top: 160, right: 80, bottom: 320, left: 80 },
          animated: true,
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [routePolyline]);

  // ── Arrival sound + driver marker when countdown reaches zero ────────────
  useEffect(() => {
    if (!isDelivered || hasPlayedArrivalSound.current) return;
    hasPlayedArrivalSound.current = true;

    // Compute the driver position at the delivery destination
    if (routePolyline && routePolyline.length >= 2) {
      const lastPoint = routePolyline[routePolyline.length - 1];
      setDeliveredDriverPos({ latitude: lastPoint.latitude, longitude: lastPoint.longitude });
    } else if (shipmentPins.length > 0 && shipmentPins[0].approximateLocation) {
      setDeliveredDriverPos({
        latitude: shipmentPins[0].approximateLocation.lat,
        longitude: shipmentPins[0].approximateLocation.lng,
      });
    }

    // Play the arrival chime (skip on web — browsers block autoplay)
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const player = createAudioPlayer(ARRIVAL_CHIME);
        chimePlayerRef.current = player;
        player.volume = 0.7;
        void Promise.resolve(player.play()).catch(() => {});
      } catch {
        // Audio is a non-critical delight
      }
    })();

    // Subtle haptic notification
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [isDelivered, routePolyline, shipmentPins]);

  // Cleanup the chime player on unmount
  useEffect(() => {
    return () => {
      try {
        chimePlayerRef.current?.remove();
      } catch {
        // ignore
      }
    };
  }, []);

  // ── Selected item detail ──────────────────────────────────────────────────
  const selectedTitle = selectedItem
    ? selectedItem.type === 'shipment'
      ? `${(selectedItem.data as Shipment).carrier} · ${(selectedItem.data as Shipment).packagesExpected}`
      : selectedItem.type === 'driver'
        ? (selectedItem.data as Driver).name
        : (selectedItem.data as PorchPartner).name
    : '';

  const selectedSub = selectedItem
    ? selectedItem.type === 'shipment'
      ? (selectedItem.data as Shipment).addressText
      : selectedItem.type === 'driver'
        ? `${(selectedItem.data as Driver).vehicleType} · ${(selectedItem.data as Driver).activeStops} stops · ★ ${(selectedItem.data as Driver).rating}`
        : `${(selectedItem.data as PorchPartner).street} · ★ ${(selectedItem.data as PorchPartner).rating}`
    : '';

  const selectedColor = selectedItem
    ? selectedItem.type === 'shipment'
      ? SHIPMENT_STATUS_COLORS[(selectedItem.data as Shipment).status] ?? colors.primary
      : selectedItem.type === 'driver'
        ? DRIVER_STATUS_COLORS[(selectedItem.data as Driver).status] ?? colors.primary
        : palette.sage
    : colors.primary;

  const handleSelectedPress = useCallback(() => {
    if (!selectedItem) return;
    if (selectedItem.type === 'shipment') {
      router.push(`/shipment-detail?id=${(selectedItem.data as Shipment).id}` as any);
    } else if (selectedItem.type === 'driver') {
      router.push(`/drivers` as any);
    } else {
      router.push({ pathname: '/partner-detail' as any, params: { id: (selectedItem.data as PorchPartner).id } });
    }
  }, [selectedItem, router]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Delivery Map',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
        }}
      />

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterModes.map(({ mode, label, icon, count }) => (
            <TouchableOpacity
              key={mode}
              style={[styles.filterPill, viewMode === mode && styles.filterPillActive]}
              onPress={() => setViewMode(mode)}
              activeOpacity={0.7}
              testID={`filter-${mode}`}
            >
              {icon}
              <Text style={[styles.filterPillText, viewMode === mode && styles.filterPillTextActive]}>
                {label}
              </Text>
              <View style={[styles.filterCount, viewMode === mode && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, viewMode === mode && styles.filterCountTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation={!!user?.hasLocationConsent}
          showsMyLocationButton={false}
          showsCompass={false}
          showsTraffic={showTraffic}
          onPress={handleMapPress}
          testID="map-view"
          customMapStyle={isNightMode ? nightMapStyle : lightMapStyle}
        >
          {/* ── Shipment / Package markers ──────────────────────────────────── */}
          {showShipments &&
            shipmentPins.map((s) => {
              const color = SHIPMENT_STATUS_COLORS[s.status] ?? colors.primary;
              return (
                <Marker
                  key={`s-${s.id}`}
                  coordinate={{
                    latitude: s.approximateLocation?.lat ?? 0,
                    longitude: s.approximateLocation?.lng ?? 0,
                  }}
                  onPress={() => handleShipmentPress(s)}
                  testID={`marker-shipment-${s.id}`}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.markerWrap}>
                    <View style={[styles.markerBubble, { backgroundColor: color, borderColor: colors.surface }]}>
                      <Package size={14} color={colors.white} strokeWidth={2.4} />
                    </View>
                    <View style={[styles.markerArrow, { borderTopColor: color }]} />
                  </View>
                </Marker>
              );
            })}

          {/* ── Driver markers with vehicle icons + pulse ring ──────────────── */}
          {showDrivers &&
            activeDrivers.map((d) => {
              if (!d.location) return null;
              const statusColor = DRIVER_STATUS_COLORS[d.status] ?? colors.primary;
              return (
                <Marker
                  key={`d-${d.id}`}
                  coordinate={{ latitude: d.location.lat, longitude: d.location.lng }}
                  onPress={() => handleDriverPress(d)}
                  testID={`marker-driver-${d.id}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.driverMarkerWrap}>
                    {/* Pulse ring */}
                    <Animated.View
                      style={[
                        styles.pulseRing,
                        {
                          backgroundColor: statusColor,
                          transform: [{ scale: pulseScale }],
                          opacity: pulseOpacity,
                        },
                      ]}
                    />
                    {/* Driver bubble */}
                    <View style={[styles.driverBubble, { backgroundColor: statusColor, borderColor: colors.surface }]}>
                      <VehicleIcon type={d.vehicleType} size={16} color={colors.white} />
                    </View>
                    {/* Active stops badge */}
                    {d.activeStops > 0 && (
                      <View style={styles.stopsBadge}>
                        <Text style={styles.stopsBadgeText}>{d.activeStops}</Text>
                      </View>
                    )}
                  </View>
                </Marker>
              );
            })}

          {/* ── Porch Partner markers with avatar ───────────────────────────── */}
          {showPartners &&
            partnerPins.map(({ partner, location, activeHolds }) => (
              <Marker
                key={`p-${partner.id}`}
                coordinate={{ latitude: location.lat, longitude: location.lng }}
                onPress={() => handlePartnerPress(partner)}
                testID={`marker-partner-${partner.id}`}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.partnerMarkerWrap}>
                  <View style={[styles.partnerMarkerBubble, { borderColor: colors.surface }]}>
                    <PartnerAvatarMarker partner={partner} size={34} />
                  </View>
                  {/* Active holds badge */}
                  {activeHolds > 0 && (
                    <View style={styles.holdsBadge}>
                      <Text style={styles.holdsBadgeText}>{activeHolds}</Text>
                    </View>
                  )}
                  <View style={[styles.partnerMarkerArrow, { borderTopColor: colors.surface }]} />
                </View>
              </Marker>
            ))}

          {/* ── Route polyline (driver → destination) ──────────────────────── */}
          {routePolyline && routePolyline.length >= 2 && (
            <>
              {/* Remaining route — dashed, dimmed */}
              <Polyline
                coordinates={interpolatePolyline(routePolyline, routeProgress).length > 1
                  ? routePolyline.slice(
                      // Find the index where progress ends
                      (() => {
                        const traveled = interpolatePolyline(routePolyline, routeProgress);
                        return Math.max(1, traveled.length - 1);
                      })(),
                    )
                  : routePolyline}
                strokeColor={colors.secondary}
                strokeWidth={routeInfo ? 5 : 3}
                strokeColors={[colors.secondary, colors.primary, colors.secondary]}
                lineDashPattern={[8, 6]}
                lineCap="round"
                tappable
                onPress={() => {
                  if (!routePolyline) return;
                  const distKm = polylineDistanceKm(routePolyline);
                  // Assume average urban delivery speed of 35 km/h
                  const travelMin = Math.max(1, Math.round((distKm / 35) * 60));
                  const sh = shipmentPins[0];
                  const label = sh?.addressText || sh?.carrier || 'Destination';
                  setRouteInfo({
                    distanceKm: Math.round(distKm * 10) / 10,
                    travelTimeMin: travelMin,
                    destinationLabel: label,
                    shipmentId: sh?.id ?? '',
                  });
                }}
              />
              {/* Completed route — solid, bright, thicker */}
              {routeProgress > 0.01 && (() => {
                const traveledCoords = interpolatePolyline(routePolyline, routeProgress);
                return traveledCoords.length >= 2 ? (
                  <Polyline
                    coordinates={traveledCoords}
                    strokeColor={palette.successGreen}
                    strokeWidth={routeInfo ? 6 : 4}
                    lineCap="round"
                  />
                ) : null;
              })()}
            </>
          )}

          {/* ── Traffic congestion overlay (colored segments) ──────────────── */}
          {showTraffic &&
            trafficSegments.map((seg, i) => (
              <Polyline
                key={`traffic-${i}`}
                coordinates={seg.coords}
                strokeColor={seg.color}
                strokeWidth={6}
                lineCap="round"
                zIndex={5}
              />
            ))}

          {/* ── Destination circle (radius around first shipment) ──────────── */}
          {showShipments && shipmentPins.length > 0 && shipmentPins[0].approximateLocation && (
            <Circle
              center={{
                latitude: shipmentPins[0].approximateLocation.lat,
                longitude: shipmentPins[0].approximateLocation.lng,
              }}
              radius={120}
              strokeColor={colors.primary}
              strokeWidth={1.5}
              fillColor={colors.primary + '15'}
            />
          )}

          {/* ── Arrived driver marker (shown when countdown reaches zero) ───── */}
          {isDelivered && deliveredDriverPos && (
            <Marker
              coordinate={deliveredDriverPos}
              anchor={{ x: 0.5, y: 0.5 }}
              testID="marker-arrived-driver"
            >
              <View style={styles.arrivedMarkerWrap}>
                {/* Pulse ring to draw attention */}
                <Animated.View
                  style={[
                    styles.arrivedPulseRing,
                    {
                      transform: [{ scale: pulseScale }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />
                {/* Driver bubble with checkmark / vehicle icon */}
                <View style={[styles.arrivedBubble, { borderColor: colors.surface }]}>
                  <Navigation size={16} color={colors.white} strokeWidth={2.6} />
                </View>
                {/* "Arrived" label badge */}
                <View style={styles.arrivedLabel}>
                  <Text style={styles.arrivedLabelText}>Arrived</Text>
                </View>
              </View>
            </Marker>
          )}
        </MapView>

        {/* ── Floating Controls ─────────────────────────────────────────────── */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={requestLocation}
            activeOpacity={0.8}
            testID="locate-btn"
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Locate size={20} color={colors.primary} strokeWidth={2.2} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleFitAll}
            activeOpacity={0.8}
            testID="fit-all-btn"
          >
            <Navigation size={20} color={colors.primary} strokeWidth={2.2} />
          </TouchableOpacity>

          {/* Night mode toggle */}
          <TouchableOpacity
            style={[
              styles.controlButton,
              isNightMode && { backgroundColor: colors.primary },
            ]}
            onPress={() => setIsNightMode((v) => !v)}
            activeOpacity={0.8}
            testID="night-mode-btn"
          >
            {isNightMode ? (
              <Sun size={20} color={colors.white} strokeWidth={2.2} />
            ) : (
              <Moon size={20} color={colors.primary} strokeWidth={2.2} />
            )}
          </TouchableOpacity>

          {/* Traffic overlay toggle */}
          <TouchableOpacity
            style={[
              styles.controlButton,
              showTraffic && { backgroundColor: colors.secondary },
            ]}
            onPress={() => setShowTraffic((v) => !v)}
            activeOpacity={0.8}
            testID="traffic-toggle-btn"
          >
            <Gauge
              size={20}
              color={showTraffic ? colors.white : colors.primary}
              strokeWidth={2.2}
            />
          </TouchableOpacity>

          {/* Distance unit toggle (km / mi) */}
          <TouchableOpacity
            style={[
              styles.controlButton,
              distanceUnit === 'mi' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setDistanceUnit((u) => (u === 'km' ? 'mi' : 'km'))}
            activeOpacity={0.8}
            testID="distance-unit-btn"
          >
            <Text
              style={[
                styles.unitToggleText,
                { color: distanceUnit === 'mi' ? colors.white : colors.primary },
              ]}
            >
              {distanceUnit}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── ETA Banner (top center) ───────────────────────────────────────── */}
        {showShipments && shipmentPins.length > 0 && (
          <View style={styles.etaBanner}>
            <View style={[styles.etaDot, isDelivered && { backgroundColor: palette.sage }]} />
            <Text style={styles.etaBannerText}>
              {isDelivered ? 'Delivered' : `${countdownDisplay} · ETA ${arrivalTime} · ${shipmentPins.length} active`}
            </Text>
            <Zap size={12} color={colors.secondary} strokeWidth={2.5} />
          </View>
        )}

        {/* ── Legend ─────────────────────────────────────────────────────────── */}
        {/* ── Traffic Legend ─────────────────────────────────────────────────── */}
        {showTraffic && (
          <View style={styles.trafficLegend}>
            <Text style={styles.trafficLegendTitle}>Traffic</Text>
            <View style={styles.trafficLegendItems}>
              <View style={styles.trafficLegendItem}>
                <View style={[styles.trafficLegendDot, { backgroundColor: TRAFFIC_COLORS.free }]} />
                <Text style={styles.trafficLegendText}>Free</Text>
              </View>
              <View style={styles.trafficLegendItem}>
                <View style={[styles.trafficLegendDot, { backgroundColor: TRAFFIC_COLORS.moderate }]} />
                <Text style={styles.trafficLegendText}>Moderate</Text>
              </View>
              <View style={styles.trafficLegendItem}>
                <View style={[styles.trafficLegendDot, { backgroundColor: TRAFFIC_COLORS.heavy }]} />
                <Text style={styles.trafficLegendText}>Heavy</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.legendBar}>
          {showShipments && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Packages</Text>
            </View>
          )}
          {showDrivers && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: palette.ember }]} />
              <Text style={styles.legendText}>Drivers</Text>
            </View>
          )}
          {showPartners && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: palette.sage }]} />
              <Text style={styles.legendText}>Partners</Text>
            </View>
          )}
        </View>

        {/* ── Route Info Box (shown when polyline is tapped) ────────────────── */}
        {routeInfo && (
          <View style={styles.routeInfoBox}>
            <View style={styles.routeInfoHeader}>
              <View style={styles.routeInfoIcon}>
                <Navigation size={15} color={colors.white} strokeWidth={2.4} />
              </View>
              <Text style={styles.routeInfoTitle}>Route Details</Text>
              <TouchableOpacity
                onPress={() => setRouteInfo(null)}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.routeInfoClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.routeInfoStats}>
              <View style={styles.routeInfoStat}>
                <Text style={styles.routeInfoStatValue}>
                  {formatDistance(routeInfo.distanceKm, distanceUnit)}
                </Text>
                <Text style={styles.routeInfoStatLabel}>Distance</Text>
              </View>
              <View style={styles.routeInfoDivider} />
              <View style={styles.routeInfoStat}>
                <Text style={styles.routeInfoStatValue}>{routeInfo.travelTimeMin} min</Text>
                <Text style={styles.routeInfoStatLabel}>Travel Time</Text>
              </View>
              <View style={styles.routeInfoDivider} />
              <View style={styles.routeInfoStat}>
                <Text style={styles.routeInfoStatValue}>{arrivalTime}</Text>
                <Text style={styles.routeInfoStatLabel}>Arrival</Text>
              </View>
              <View style={styles.routeInfoDivider} />
              <View style={styles.routeInfoStat}>
                <View style={styles.routeInfoDotWrap}>
                  {routeInfo.travelTimeMin < 15 && (
                    <Animated.View
                      style={[
                        styles.routeInfoIndicatorDot,
                        {
                          backgroundColor: '#1E9C6A',
                          position: 'absolute',
                          transform: [{ scale: dotPulseScale }],
                          opacity: dotPulseOpacity,
                        },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.routeInfoIndicatorDot,
                      { backgroundColor: routeInfo.travelTimeMin < 15 ? '#1E9C6A' : '#E8A317' },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.routeInfoStatLabel,
                    { color: routeInfo.travelTimeMin < 15 ? '#1E9C6A' : '#E8A317', marginTop: 2 },
                  ]}
                >
                  {routeInfo.travelTimeMin < 15 ? 'On Time' : 'Delayed'}
                </Text>
              </View>
            </View>
            <View style={styles.routeInfoDestRow}>
              <View style={styles.routeInfoDest}>
                <MapPin size={12} color={colors.slateLight} strokeWidth={2} />
                <Text style={styles.routeInfoDestText} numberOfLines={1}>
                  {routeInfo.destinationLabel}
                </Text>
              </View>
              {routeInfo.shipmentId ? (
                <TouchableOpacity
                  style={[
                    styles.routeInfoDetailsBtn,
                    { backgroundColor: routeInfo.travelTimeMin < 15 ? '#1E9C6A' : '#E8A317' },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    router.push(`/shipment-detail?id=${routeInfo.shipmentId}` as any);
                  }}
                >
                  <Text style={styles.routeInfoDetailsBtnText}>Delivery Details</Text>
                  <ChevronRight size={14} color={colors.white} strokeWidth={2.6} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Location consent banner ───────────────────────────────────────── */}
        {!user?.hasLocationConsent && (
          <TouchableOpacity
            style={styles.locationBanner}
            onPress={requestLocation}
            activeOpacity={0.85}
            testID="enable-location-banner"
          >
            <MapPin size={16} color={colors.white} />
            <Text style={styles.locationBannerText}>Enable location for live tracking</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Bottom Sheet (DoorDash-style) ────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: sheetTranslateY }] },
        ]}
      >
        <View style={styles.sheetHandle} />

        {/* ETA Hero */}
        {showShipments && shipmentPins.length > 0 && (
          <View style={styles.etaHero}>
            <View style={styles.etaLeft}>
              <Text style={styles.etaMinutes}>{countdownDisplay}</Text>
              <Text style={styles.etaLabel}>{isDelivered ? 'delivered' : 'min:sec away'}</Text>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaRight}>
              <View style={styles.etaRow}>
                <Clock size={13} color={colors.slateLight} strokeWidth={2} />
                <Text style={styles.etaDetail}>
                  {isDelivered ? (
                    <Text style={styles.etaDetailBold}>Package arrived</Text>
                  ) : (
                    <>Arriving by <Text style={styles.etaDetailBold}>{arrivalTime}</Text></>
                  )}
                </Text>
              </View>
              <View style={styles.etaRow}>
                <Navigation size={13} color={colors.slateLight} strokeWidth={2} />
                <Text style={styles.etaDetail}>
                  {activeDrivers.length} driver{activeDrivers.length === 1 ? '' : 's'} nearby
                </Text>
              </View>
              <View style={styles.etaRow}>
                <Package size={13} color={colors.slateLight} strokeWidth={2} />
                <Text style={styles.etaDetail} numberOfLines={1}>
                  {shipmentPins[0].carrier} · {shipmentPins[0].packagesExpected}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Summary stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + '18' }]}>
              <Package size={15} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={styles.statValue}>{shipmentPins.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.secondary + '18' }]}>
              <Truck size={15} color={colors.secondary} strokeWidth={2.2} />
            </View>
            <Text style={styles.statValue}>{activeDrivers.length}</Text>
            <Text style={styles.statLabel}>Drivers</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: palette.sageSoft }]}>
              <HandHeart size={15} color={palette.sage} strokeWidth={2.2} />
            </View>
            <Text style={styles.statValue}>{activePartners.length}</Text>
            <Text style={styles.statLabel}>Partners</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.goldSoft }]}>
              <Star size={15} color={colors.gold} strokeWidth={2.2} fill={colors.gold} />
            </View>
            <Text style={styles.statValue}>
              {holds.filter((h) => h.status === 'pending' || h.status === 'picked_up').length}
            </Text>
            <Text style={styles.statLabel}>Holds</Text>
          </View>
        </View>

        {/* Empty state */}
        {shipmentPins.length === 0 && activeDrivers.length === 0 && activePartners.length === 0 && (
          <View style={styles.emptyState}>
            <CircleDot size={32} color={colors.slateLighter} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No active deliveries</Text>
            <Text style={styles.emptyBody}>Shipments, drivers, and partners will appear here</Text>
          </View>
        )}
      </Animated.View>

      {/* ── Selected Item Card (slides up from bottom sheet) ─────────────────── */}
      {selectedItem && (
        <Animated.View
          style={[
            styles.selectedCard,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <TouchableOpacity
            style={styles.selectedCardInner}
            activeOpacity={0.9}
            onPress={handleSelectedPress}
            testID="selected-item-card"
          >
            {/* Left: icon or avatar */}
            {selectedItem.type === 'partner' ? (
              <View style={styles.selectedAvatar}>
                <PartnerAvatarMarker partner={selectedItem.data as PorchPartner} size={42} />
              </View>
            ) : (
              <View style={[styles.selectedDot, { backgroundColor: selectedColor }]}>
                {selectedItem.type === 'shipment' ? (
                  <Package size={16} color={colors.white} strokeWidth={2.4} />
                ) : (
                  <VehicleIcon
                    type={(selectedItem.data as Driver).vehicleType}
                    size={16}
                    color={colors.white}
                  />
                )}
              </View>
            )}

            {/* Middle: title + subtitle */}
            <View style={styles.selectedContent}>
              <Text style={styles.selectedTitle} numberOfLines={1}>{selectedTitle}</Text>
              <Text style={styles.selectedSub} numberOfLines={1}>{selectedSub}</Text>
            </View>

            {/* Right: action */}
            <View style={styles.selectedAction}>
              <Text style={styles.selectedActionText}>View</Text>
              <ChevronRight size={16} color={colors.primary} strokeWidth={2.4} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// ── Light map style (subtle, DoorDash-like) ──────────────────────────────────
const lightMapStyle = [
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.highway', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'water', stylers: [{ color: '#a0c4e8' }] },
  { featureType: 'landscape', stylers: [{ color: '#e8eef5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f0f4f8' }] },
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
];

// ── Night map style (dark, low-glare for evening delivery) ───────────────────
const nightMapStyle = [
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'simplified' }, { color: '#8a9bb0' }] },
  { featureType: 'road.highway', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'water', stylers: [{ color: '#1a3a5c' }] },
  { featureType: 'landscape', stylers: [{ color: '#1c2530' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3a4a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#283340' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#222d3a' }] },
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ color: '#1e2d28' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ color: '#1e2630' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
];

// ── Styles ───────────────────────────────────────────────────────────────────
function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Filter Bar ──────────────────────────────────────────────────────────
    filterBar: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingVertical: 8,
    },
    filterScroll: {
      paddingHorizontal: space.lg,
      gap: 8,
    },
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.elevated,
    },
    filterPillActive: {
      backgroundColor: colors.primary,
    },
    filterPillText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.slateLight,
    },
    filterPillTextActive: {
      color: colors.white,
    },
    filterCount: {
      backgroundColor: colors.borderLight,
      borderRadius: 8,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    filterCountActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    filterCountText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: colors.slateLight,
    },
    filterCountTextActive: {
      color: colors.white,
    },

    // ── Map ──────────────────────────────────────────────────────────────────
    mapContainer: {
      flex: 1,
      position: 'relative',
    },
    map: {
      flex: 1,
    },

    // ── Package markers ──────────────────────────────────────────────────────
    markerWrap: {
      alignItems: 'center',
    },
    markerBubble: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    markerArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 7,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      marginTop: -2,
    },

    // ── Driver markers ───────────────────────────────────────────────────────
    driverMarkerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
    },
    pulseRing: {
      position: 'absolute',
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    driverBubble: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
    stopsBadge: {
      position: 'absolute',
      top: -2,
      right: -4,
      backgroundColor: colors.secondary,
      borderRadius: 8,
      minWidth: 17,
      height: 17,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    stopsBadgeText: {
      fontSize: 9,
      fontWeight: '800' as const,
      color: colors.white,
    },

    // ── Partner markers ──────────────────────────────────────────────────────
    partnerMarkerWrap: {
      alignItems: 'center',
    },
    partnerMarkerBubble: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
      overflow: 'hidden',
    },
    holdsBadge: {
      position: 'absolute',
      top: -3,
      right: -6,
      backgroundColor: colors.primary,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    holdsBadgeText: {
      fontSize: 9,
      fontWeight: '800' as const,
      color: colors.white,
    },
    partnerMarkerArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 6,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      marginTop: -2,
    },

    // ── Floating Controls ────────────────────────────────────────────────────
    mapControls: {
      position: 'absolute',
      top: 14,
      right: 14,
      gap: 10,
    },
    controlButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
    },

    // ── Distance unit toggle text ───────────────────────────────────────────
    unitToggleText: {
      fontSize: 15,
      fontWeight: '800' as const,
    },

    // ── Traffic Legend ───────────────────────────────────────────────────────
    trafficLegend: {
      position: 'absolute',
      bottom: 52,
      left: 14,
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    trafficLegendTitle: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: colors.slate,
      marginBottom: 4,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    trafficLegendItems: {
      flexDirection: 'row',
      gap: 10,
    },
    trafficLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    trafficLegendDot: {
      width: 12,
      height: 4,
      borderRadius: 2,
    },
    trafficLegendText: {
      fontSize: 10,
      fontWeight: '600' as const,
      color: colors.slate,
    },

    // ── ETA Banner ───────────────────────────────────────────────────────────
    etaBanner: {
      position: 'absolute',
      top: 14,
      left: 14,
      right: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 9,
      ...elevation.low,
    },
    etaDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.successGreen,
    },
    etaBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700' as const,
      color: colors.slate,
      letterSpacing: 0.1,
    },

    // ── Legend ───────────────────────────────────────────────────────────────
    legendBar: {
      position: 'absolute',
      bottom: 14,
      left: 14,
      flexDirection: 'row',
      gap: 12,
      backgroundColor: 'rgba(255,255,255,0.95)',
      paddingHorizontal: 12,
      paddingVertical: 7,
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
      color: colors.slate,
    },

    // ── Location banner ──────────────────────────────────────────────────────
    locationBanner: {
      position: 'absolute',
      bottom: 14,
      left: 14,
      right: 14,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      ...elevation.raised,
    },
    locationBannerText: {
      color: colors.white,
      fontSize: 13,
      fontWeight: '600' as const,
      flex: 1,
    },

    // ── Route Info Box ──────────────────────────────────────────────────────
    routeInfoBox: {
      position: 'absolute',
      top: 72,
      left: 14,
      right: 14,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: 16,
      paddingVertical: 14,
      ...elevation.raised,
    },
    routeInfoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    routeInfoIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    routeInfoTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.slate,
    },
    routeInfoClose: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.slateLight,
    },
    routeInfoStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    routeInfoStat: {
      flex: 1,
      alignItems: 'center',
    },
    routeInfoStatValue: {
      fontSize: 22,
      fontWeight: '800' as const,
      color: colors.primary,
      letterSpacing: -0.5,
    },
    routeInfoStatLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: colors.slateLight,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      marginTop: 2,
    },
    routeInfoDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    routeInfoDestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    routeInfoDest: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.elevated,
      borderRadius: radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    routeInfoDestText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '500' as const,
      color: colors.slateLight,
    },
    routeInfoDotWrap: {
      width: 14,
      height: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    routeInfoIndicatorDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    routeInfoDetailsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    routeInfoDetailsBtnText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: colors.white,
    },

    // ── Arrived driver marker ───────────────────────────────────────────────
    arrivedMarkerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 56,
      height: 56,
    },
    arrivedPulseRing: {
      position: 'absolute',
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: palette.successGreen,
    },
    arrivedBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.successGreen,
      borderWidth: 2.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
    arrivedLabel: {
      position: 'absolute',
      bottom: -4,
      backgroundColor: palette.successGreen,
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    arrivedLabelText: {
      fontSize: 9,
      fontWeight: '800' as const,
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },

    // ── Bottom Sheet ─────────────────────────────────────────────────────────
    bottomSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: 10,
      paddingHorizontal: space.lg,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      ...elevation.raised,
      maxHeight: 340,
    },
    sheetHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 12,
    },

    // ── ETA Hero ─────────────────────────────────────────────────────────────
    etaHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: colors.elevated,
      borderRadius: radius.lg,
      paddingHorizontal: space.lg,
      paddingVertical: space.md + 2,
      marginBottom: 12,
    },
    etaLeft: {
      alignItems: 'center',
    },
    etaMinutes: {
      fontSize: 44,
      fontWeight: '900' as const,
      color: colors.primary,
      lineHeight: 46,
      letterSpacing: -1.5,
    },
    etaLabel: {
      fontSize: 12,
      color: colors.slateLight,
      fontWeight: '500' as const,
    },
    etaDivider: {
      width: 1,
      height: 50,
      backgroundColor: colors.border,
    },
    etaRight: {
      flex: 1,
      gap: 6,
    },
    etaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    etaDetail: {
      fontSize: 13,
      color: colors.slateLight,
      flex: 1,
    },
    etaDetailBold: {
      fontWeight: '700' as const,
      color: colors.slate,
    },

    // ── Stats Row ────────────────────────────────────────────────────────────
    statsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.elevated,
      borderRadius: radius.md,
      paddingVertical: 10,
      gap: 3,
    },
    statIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      fontSize: 17,
      fontWeight: '800' as const,
      color: colors.slate,
    },
    statLabel: {
      fontSize: 9.5,
      fontWeight: '600' as const,
      color: colors.slateLighter,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.6,
    },

    // ── Empty state ──────────────────────────────────────────────────────────
    emptyState: {
      paddingVertical: 28,
      alignItems: 'center',
      gap: 6,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.slate,
      marginTop: 4,
    },
    emptyBody: {
      fontSize: 13,
      color: colors.slateLight,
      textAlign: 'center' as const,
    },

    // ── Selected item card ───────────────────────────────────────────────────
    selectedCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: space.lg,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    },
    selectedCardInner: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      ...elevation.raised,
    },
    selectedDot: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
    },
    selectedContent: {
      flex: 1,
    },
    selectedTitle: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.slate,
    },
    selectedSub: {
      fontSize: 12,
      color: colors.slateLight,
      marginTop: 2,
    },
    selectedAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    selectedActionText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: colors.primary,
    },
  });
}
