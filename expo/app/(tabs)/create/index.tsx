import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Animated, ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Package, ChevronDown, Check, Truck, ChevronLeft, Crosshair, MapPin } from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import { Carrier } from '@/types';
import { log } from "@/lib/logger";

const carriers: Carrier[] = ['Amazon', 'UPS', 'USPS', 'FedEx', 'Other'];

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useApp();
  const { addShipment } = useShipments();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const [showCarrierPicker, setShowCarrierPicker] = useState(false);
  const [packages, setPackages] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [approxOnly, setApproxOnly] = useState(true);
  const [usePrecise, setUsePrecise] = useState(false);
  const [preciseCoords, setPreciseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const _successAnim = useRef(new Animated.Value(0)).current;

  const fetchPreciseLocation = useCallback(async () => {
    setFetchingLocation(true);
    log('[Create] Fetching precise location...');
    try {
      if (Platform.OS !== 'web') {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          log('[Create] Precise location:', loc.coords.latitude, loc.coords.longitude);
          setPreciseCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } else {
          log('[Create] Location permission denied');
        }
      } else {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              log('[Create] Web precise location:', pos.coords.latitude, pos.coords.longitude);
              setPreciseCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (err) => log('[Create] Web geolocation error:', err.message),
            { enableHighAccuracy: true, timeout: 15000 }
          );
        }
      }
    } catch (e) {
      log('[Create] Precise location error:', e);
    } finally {
      setFetchingLocation(false);
    }
  }, []);

  useEffect(() => {
    if (user?.hasPreciseLocationConsent) {
      setUsePrecise(true);
      void fetchPreciseLocation();
    }
  }, [user?.hasPreciseLocationConsent, fetchPreciseLocation]);

  const isValid = carrier && packages.trim();

  const handlePost = useCallback(() => {
    if (!isValid || !user || !carrier) return;
    const now = new Date().toISOString();

    const approxLoc = preciseCoords
      ? { lat: preciseCoords.lat + (Math.random() - 0.5) * 0.004, lng: preciseCoords.lng + (Math.random() - 0.5) * 0.004 }
      : { lat: 37.7749, lng: -122.4194 };

    addShipment({
      homeownerId: user.id,
      homeownerName: user.name,
      partnerId: null,
      partnerName: null,
      status: 'open',
      carrier,
      packagesExpected: packages,
      deliveryWindowStart: now,
      deliveryWindowEnd: now,
      addressText: user.address,
      approximateLocation: approxLoc,
      preciseLocation: usePrecise && preciseCoords ? preciseCoords : null,
      dropoffLocation: null,
      homeLocationVisibleToPartner: !approxOnly,
      notes,
      preferredReturnTime: returnTime || 'Anytime',
      trackingNumber: trackingNumber.trim() || null,
      trackingSubmittedAt: trackingNumber.trim() ? new Date().toISOString() : null,
      carrierTrackingUrl: null,
      deliveryStatus: 'pending',
      completionPhotoUrl: null,
    });

    log('[Create] Shipment posted');
    Alert.alert(
      'Shipment Posted!',
      'Your neighbors will be notified. A Porch Partner will accept soon.',
      [{ text: 'Great!', onPress: () => router.push('/(tabs)/(home)' as any) }]
    );
  }, [isValid, user, carrier, packages, trackingNumber, notes, returnTime, approxOnly, usePrecise, preciseCoords, addShipment, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{
        title: 'New Shipment',
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ marginRight: 8 }}>
            <ChevronLeft size={24} color={colors.slate} strokeWidth={2} />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Package size={24} color={colors.primary} />
          <Text style={styles.heroText}>Post a shipment for a neighbor to protect</Text>
        </View>

        <Text style={styles.sectionLabel}>Carrier</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowCarrierPicker(!showCarrierPicker)}
          activeOpacity={0.85}
        >
          <Text style={[styles.pickerButtonText, !carrier && styles.placeholder]}>
            {carrier ?? 'Select carrier'}
          </Text>
          <ChevronDown size={18} color={colors.slateLight} />
        </TouchableOpacity>
        {showCarrierPicker && (
          <View style={styles.pickerList}>
            {carriers.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.pickerItem, carrier === c && styles.pickerItemSelected]}
                onPress={() => { setCarrier(c); setShowCarrierPicker(false); }}
              >
                <Text style={[styles.pickerItemText, carrier === c && styles.pickerItemTextSelected]}>{c}</Text>
                {carrier === c && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>Packages Expected</Text>
        <TextInput
          style={styles.textInput}
          value={packages}
          onChangeText={setPackages}
          placeholder="e.g., 2 boxes, one medium, one small"
          placeholderTextColor={colors.slateLighter}
        />

        <Text style={styles.sectionLabel}>Tracking Number (Optional)</Text>
        <View style={styles.trackingInputRow}>
          <View style={styles.trackingIconWrap}>
            <Truck size={16} color={colors.primary} />
          </View>
          <TextInput
            style={styles.trackingInput}
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            placeholder="Enter tracking number if available"
            placeholderTextColor={colors.slateLighter}
            autoCapitalize="characters"
          />
        </View>
        <Text style={styles.trackingHint}>You can add this later from shipment details. You'll be notified when your package is delivered.</Text>

        <Text style={styles.sectionLabel}>Address</Text>
        <View style={styles.addressRow}>
          <Text style={styles.addressText}>{user?.address ?? 'Not set'}</Text>
        </View>
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setApproxOnly(!approxOnly)}
          activeOpacity={0.7}
        >
          <View style={[styles.toggle, approxOnly && styles.toggleActive]}>
            {approxOnly && <Check size={12} color={colors.white} />}
          </View>
          <Text style={styles.toggleText}>Show only approximate location until a partner is selected</Text>
        </TouchableOpacity>

        {user?.hasPreciseLocationConsent && (
          <TouchableOpacity
            style={styles.preciseRow}
            onPress={() => {
              const next = !usePrecise;
              setUsePrecise(next);
              if (next && !preciseCoords) void fetchPreciseLocation();
            }}
            activeOpacity={0.7}
            testID="precise-toggle"
          >
            <View style={[styles.preciseToggle, usePrecise && styles.preciseToggleActive]}>
              {usePrecise && <Crosshair size={12} color={colors.white} />}
            </View>
            <View style={styles.preciseInfo}>
              <Text style={styles.preciseLabel}>Include precise location</Text>
              <Text style={styles.preciseHint}>
                {fetchingLocation ? 'Getting your exact location...' :
                  preciseCoords ? 'Exact drop-off pin for partners' : 'Tap to get your precise coordinates'}
              </Text>
            </View>
            {fetchingLocation && <ActivityIndicator size="small" color="#7C3AED" />}
            {!fetchingLocation && preciseCoords && usePrecise && <MapPin size={16} color="#7C3AED" />}
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>Notes / Instructions</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any special instructions for your Porch Partner"
          placeholderTextColor={colors.slateLighter}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.sectionLabel}>Preferred Return Time</Text>
        <TextInput
          style={styles.textInput}
          value={returnTime}
          onChangeText={setReturnTime}
          placeholder="e.g., After 6 PM"
          placeholderTextColor={colors.slateLighter}
        />

        <TouchableOpacity
          style={[styles.postButton, !isValid && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={!isValid}
          activeOpacity={0.85}
          testID="post-shipment-btn"
        >
          <Text style={[styles.postButtonText, !isValid && styles.postButtonTextDisabled]}>
            Post Porch Partner Shipment
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.skyBlue,
      padding: 16,
      borderRadius: 14,
      marginBottom: 24,
    },
    heroText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500' as const,
      flex: 1,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.slate,
      marginBottom: 8,
      marginTop: 4,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    pickerButton: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    pickerButtonText: {
      fontSize: 15,
      color: colors.slate,
    },
    placeholder: {
      color: colors.slateLighter,
    },
    pickerList: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginTop: -8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    pickerItem: {
      padding: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    pickerItemSelected: {
      backgroundColor: colors.skyBlue,
    },
    pickerItemText: {
      fontSize: 15,
      color: colors.slate,
    },
    pickerItemTextSelected: {
      color: colors.primary,
      fontWeight: '600' as const,
    },
    textInput: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.slate,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top' as const,
    },
    trackingInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      overflow: 'hidden',
    },
    trackingIconWrap: {
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.skyBlue,
      alignSelf: 'stretch',
    },
    trackingInput: {
      flex: 1,
      padding: 14,
      fontSize: 15,
      color: colors.slate,
    },
    trackingHint: {
      fontSize: 12,
      color: colors.slateLight,
      marginBottom: 16,
      lineHeight: 17,
    },
    addressRow: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    addressText: {
      fontSize: 15,
      color: colors.slate,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    toggle: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    toggleText: {
      fontSize: 13,
      color: colors.slateLight,
      flex: 1,
    },
    preciseRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      marginBottom: 16,
      backgroundColor: colors.elevated,
      borderRadius: 12,
      padding: 14,
    },
    preciseToggle: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    preciseToggleActive: {
      backgroundColor: '#7C3AED',
      borderColor: '#7C3AED',
    },
    preciseInfo: {
      flex: 1,
    },
    preciseLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.slate,
    },
    preciseHint: {
      fontSize: 11,
      color: colors.slateLight,
      marginTop: 1,
    },
    postButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    postButtonDisabled: {
      backgroundColor: colors.borderLight,
      shadowOpacity: 0,
      elevation: 0,
    },
    postButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600' as const,
    },
    postButtonTextDisabled: {
      color: colors.slateLighter,
    },
  });
}
