import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ChevronDown, Calendar, X, HandHeart, MapPin, Star, CheckCircle, ChevronRight, ScanBarcode } from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { usePackages } from '@/store/PackagesContext';
import { useApp } from '@/store/AppContext';
import { usePorchPartners } from '@/store/PorchPartnersContext';
import { Carrier, AddressNickname, PorchPartner } from '@/types';
import { log } from "@/lib/logger";
import BarcodeScannerModal from '@/components/BarcodeScannerModal';

const CARRIERS: Carrier[] = ['Amazon', 'UPS', 'FedEx', 'USPS', 'Other'];
const ADDRESS_OPTIONS: AddressNickname[] = ['Home', 'Work', 'Other'];

function PartnerAvatarSmall({ name }: { name: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const colorList = ['#1D4F91', '#059669', '#D97706', '#7C3AED', '#0891B2', '#DC2626'];
  const bg = colorList[name.charCodeAt(0) % colorList.length];
  return (
    <View style={[styles.partnerSmallAvatar, { width: 32, height: 32, borderRadius: 16, backgroundColor: bg }]}>
      <Text style={styles.partnerSmallAvatarText}>{initials}</Text>
    </View>
  );
}

export default function AddPackageScreen() {
  const router = useRouter();
  const { addPackage } = usePackages();
  const { user } = useApp();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState<string>('');
  const [carrier, setCarrier] = useState<Carrier>('Amazon');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [addressNickname, setAddressNickname] = useState<AddressNickname>('Home');
  const [customAddress, setCustomAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showCarrierPicker, setShowCarrierPicker] = useState<boolean>(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [showPartnerPicker, setShowPartnerPicker] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const { activePartners, assignPartnerToPackage } = usePorchPartners();

  const selectedPartner = activePartners.find((p) => p.id === selectedPartnerId);

  const handleBarcodeScanned = useCallback((data: string) => {
    setTrackingNumber(data);
    setShowScanner(false);
  }, []);

  const submitScale = useRef(new Animated.Value(1)).current;

  const handleSubmitPressIn = () => {
    Animated.spring(submitScale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handleSubmitPressOut = () => {
    Animated.spring(submitScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const validateDate = useCallback((dateStr: string): boolean => {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(month) || isNaN(day) || isNaN(year)) return false;
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }, []);

  const parseDateToISO = useCallback((dateStr: string): string => {
    const parts = dateStr.split('/');
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return new Date(year, month - 1, day).toISOString();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Please enter a package name.');
      return;
    }
    if (!trackingNumber.trim()) {
      Alert.alert('Missing Info', 'Please enter a tracking number.');
      return;
    }
    if (!validateDate(expectedDate)) {
      Alert.alert('Invalid Date', 'Please enter a valid future date (MM/DD/YYYY).');
      return;
    }
    if (addressNickname === 'Other' && !customAddress.trim()) {
      Alert.alert('Missing Info', 'Please enter a custom address label.');
      return;
    }

    log('[AddPackage] Submitting package:', name);

    let newPkg: ReturnType<typeof addPackage> | null = null;
    try {
      newPkg = addPackage(
        {
          name: name.trim(),
          carrier,
          trackingNumber: trackingNumber.trim(),
          expectedDeliveryDate: parseDateToISO(expectedDate),
          expectedDeliveryWindowStart: null,
          expectedDeliveryWindowEnd: null,
          addressNickname,
          customAddressLabel: addressNickname === 'Other' ? customAddress.trim() : null,
          notesForPartner: notes.trim(),
          porchPartnerId: selectedPartnerId,
        },
        user?.id ?? 'anonymous',
      );
    } catch (err: any) {
      if (err?.message === 'FREE_LIMIT_REACHED') {
        Alert.alert(
          'Free limit reached',
          'Free accounts can track 1 active package. Join a community on Porchivo to unlock unlimited tracking.',
          [
            { text: 'OK', style: 'default' },
          ],
        );
        return;
      }
      Alert.alert('Error', 'Could not add package. Please try again.');
      return;
    }

    if (selectedPartnerId && newPkg) {
      const street = user?.address ? user.address.split(',')[0] : 'your block';
      assignPartnerToPackage(
        newPkg.id,
        selectedPartnerId,
        user?.id ?? 'anonymous',
        `Neighbor on ${street}`,
      );
    }

    router.back();
  }, [name, carrier, trackingNumber, expectedDate, addressNickname, customAddress, notes, addPackage, user?.id, router, validateDate, parseDateToISO, selectedPartnerId, assignPartnerToPackage, user?.address]);

  const formatDateInput = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length > 4) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
    }
    setExpectedDate(formatted);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Add Package',
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <X size={22} color={colors.slate} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.label}>Package Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. New headphones"
            placeholderTextColor={colors.slateLighter}
            testID="input-package-name"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Carrier</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCarrierPicker(!showCarrierPicker)}
            testID="carrier-picker"
          >
            <Text style={styles.pickerValue}>{carrier}</Text>
            <ChevronDown size={18} color={colors.slateLight} />
          </TouchableOpacity>
          {showCarrierPicker && (
            <View style={styles.pickerOptions}>
              {CARRIERS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pickerOption, carrier === c && styles.pickerOptionActive]}
                  onPress={() => { setCarrier(c); setShowCarrierPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, carrier === c && styles.pickerOptionTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Tracking Number</Text>
          <View style={styles.trackingInputRow}>
            <TextInput
              style={[styles.input, styles.monoInput, styles.trackingInputWithScan]}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder="Paste or scan tracking number"
              placeholderTextColor={colors.slateLighter}
              autoCapitalize="characters"
              testID="input-tracking-number"
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setShowScanner(true)}
              activeOpacity={0.7}
              accessibilityLabel="Scan barcode with camera"
              accessibilityRole="button"
              testID="btn-scan-barcode"
            >
              <ScanBarcode size={20} color={colors.primary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Expected Delivery Date</Text>
          <View style={styles.dateInputWrap}>
            <Calendar size={18} color={colors.slateLight} />
            <TextInput
              style={styles.dateInput}
              value={expectedDate}
              onChangeText={formatDateInput}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={colors.slateLighter}
              keyboardType="number-pad"
              maxLength={10}
              testID="input-expected-date"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Delivery Address</Text>
          <View style={styles.addressRow}>
            {ADDRESS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.addressChip, addressNickname === opt && styles.addressChipActive]}
                onPress={() => setAddressNickname(opt)}
              >
                <Text style={[styles.addressChipText, addressNickname === opt && styles.addressChipTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {addressNickname === 'Other' && (
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              value={customAddress}
              onChangeText={setCustomAddress}
              placeholder="Enter address label"
              placeholderTextColor={colors.slateLighter}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Porch Partner <Text style={styles.optionalLabel}>(optional)</Text></Text>
          <TouchableOpacity
            style={styles.partnerPickerBtn}
            onPress={() => setShowPartnerPicker(!showPartnerPicker)}
            testID="partner-picker"
          >
            {selectedPartner ? (
              <View style={styles.selectedPartnerRow}>
                <PartnerAvatarSmall name={selectedPartner.name} />
                <View style={styles.selectedPartnerInfo}>
                  <Text style={styles.selectedPartnerName}>{selectedPartner.name}</Text>
                  <Text style={styles.selectedPartnerMeta}>{selectedPartner.street} · {selectedPartner.distance} mi</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { setSelectedPartnerId(null); setShowPartnerPicker(false); }}
                  hitSlop={12}
                >
                  <X size={16} color={colors.slateLighter} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.partnerPlaceholderRow}>
                <HandHeart size={18} color={colors.slateLighter} />
                <Text style={styles.partnerPlaceholderText}>Choose a trusted neighbor</Text>
                <ChevronDown size={16} color={colors.slateLighter} />
              </View>
            )}
          </TouchableOpacity>
          {showPartnerPicker && (
            <View style={styles.partnerOptions}>
              {activePartners.length === 0 ? (
                <View style={styles.noPartnersRow}>
                  <Text style={styles.noPartnersText}>No partners available yet</Text>
                </View>
              ) : (
                activePartners.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.partnerOption,
                      selectedPartnerId === p.id && styles.partnerOptionActive,
                    ]}
                    onPress={() => { setSelectedPartnerId(p.id); setShowPartnerPicker(false); }}
                  >
                    <PartnerAvatarSmall name={p.name} />
                    <View style={styles.partnerOptionInfo}>
                      <Text style={[
                        styles.partnerOptionName,
                        selectedPartnerId === p.id && { color: colors.primary },
                      ]}>{p.name}</Text>
                      <View style={styles.partnerOptionMeta}>
                        <MapPin size={10} color={colors.slateLighter} />
                        <Text style={styles.partnerOptionDist}>{p.distance} mi · {p.completedHolds} holds</Text>
                      </View>
                    </View>
                    <View style={styles.partnerOptionRating}>
                      <Star size={11} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.partnerOptionRatingText}>{p.rating}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes for Porch Partner <Text style={styles.optionalLabel}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Leave behind the planter"
            placeholderTextColor={colors.slateLighter}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            testID="input-notes"
          />
        </View>

        <Animated.View style={{ transform: [{ scale: submitScale }], marginTop: 8 }}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            onPressIn={handleSubmitPressIn}
            onPressOut={handleSubmitPressOut}
            activeOpacity={1}
            testID="submit-package"
          >
            <Text style={styles.submitText}>Add Package</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={handleBarcodeScanned}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  optionalLabel: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.slateLighter,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: colors.border,
  },
  monoInput: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  trackingInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trackingInputWithScan: {
    flex: 1,
  },
  scanButton: {
    backgroundColor: colors.skyBlue,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  dateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
    fontFamily: 'monospace',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500' as const,
  },
  pickerOptions: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pickerOptionActive: {
    backgroundColor: colors.skyBlue,
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  pickerOptionTextActive: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addressChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  addressChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  addressChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  addressChipTextActive: {
    color: colors.white,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  submitText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  partnerPickerBtn: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  partnerPlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  partnerPlaceholderText: {
    flex: 1,
    fontSize: 15,
    color: colors.slateLighter,
  },
  selectedPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  selectedPartnerInfo: {
    flex: 1,
  },
  selectedPartnerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  selectedPartnerMeta: {
    fontSize: 12,
    color: colors.slateLight,
    marginTop: 1,
  },
  partnerOptions: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  partnerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  partnerOptionActive: {
    backgroundColor: colors.skyBlue,
  },
  partnerOptionInfo: {
    flex: 1,
  },
  partnerOptionName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  partnerOptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  partnerOptionDist: {
    fontSize: 11,
    color: colors.slateLight,
  },
  partnerOptionRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  partnerOptionRatingText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#374151',
  },
  noPartnersRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noPartnersText: {
    fontSize: 14,
    color: colors.slateLighter,
  },
  partnerSmallAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerSmallAvatarText: {
    color: colors.white,
    fontWeight: '700' as const,
    fontSize: 12,
  },
  });
}
