import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Animated,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Linking,
} from 'react-native';
import { X, AlertTriangle, Package, Car, HelpCircle, User, Camera, MapPin, Send, Phone } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SuspiciousActivityCategory } from '@/types';
import { useAlerts, getCategoryLabel } from '@/store/AlertsContext';
import * as Haptics from 'expo-haptics';
import { log } from "../lib/logger";

interface ReportAlertSheetProps {
  visible: boolean;
  onClose: () => void;
}

const CATEGORIES: { value: SuspiciousActivityCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'suspicious_person', label: 'Suspicious Person', icon: <User size={18} color="#E65100" /> },
  { value: 'package_taken', label: 'Package Taken', icon: <Package size={18} color="#C62828" /> },
  { value: 'unknown_vehicle', label: 'Unknown Vehicle', icon: <Car size={18} color="#283593" /> },
  { value: 'other', label: 'Other', icon: <HelpCircle size={18} color="#6A1B9A" /> },
];

const CATEGORY_COLORS: Record<SuspiciousActivityCategory, { bg: string; border: string }> = {
  suspicious_person: { bg: '#FFF3E0', border: '#FFB74D' },
  package_taken: { bg: '#FFEBEE', border: '#EF9A9A' },
  unknown_vehicle: { bg: '#E8EAF6', border: '#9FA8DA' },
  other: { bg: '#F3E5F5', border: '#CE93D8' },
};

const MAX_CHARS = 250;

export default function ReportAlertSheet({ visible, onClose }: ReportAlertSheetProps) {
  const { submitAlert } = useAlerts();
  const [category, setCategory] = useState<SuspiciousActivityCategory | null>(null);
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      sheetAnim.setValue(0);
      setCategory(null);
      setDescription('');
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
    });
  }, [onClose, sheetAnim]);

  const handleCategorySelect = useCallback((cat: SuspiciousActivityCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCategory(cat);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!category) {
      Alert.alert('Select a category', 'Please choose a category for your report.');
      return;
    }
    if (description.trim().length === 0) {
      Alert.alert('Add a description', 'Please describe what you observed.');
      return;
    }

    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await submitAlert(category, description.trim(), null);
      log('[ReportAlertSheet] Alert submitted successfully');
      handleClose();
    } catch (e) {
      log('[ReportAlertSheet] Error submitting alert:', e);
      Alert.alert('Error', 'Could not submit alert. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [category, description, submitAlert, handleClose]);

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const backdropOpacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  const remainingChars = MAX_CHARS - description.length;
  const isOverLimit = remainingChars < 0;

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <Animated.View style={[styles.backdropOverlay, { opacity: backdropOpacity }]} />
        </Pressable>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslate }] }]}>
          <View style={styles.sheetHandle} />

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="close-report-sheet"
          >
            <X size={20} color={Colors.slateLight} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.sheetHeader}>
              <View style={styles.alertIconWrap}>
                <AlertTriangle size={22} color="#D84315" />
              </View>
              <Text style={styles.sheetTitle}>Report Suspicious Activity</Text>
              <Text style={styles.sheetSubtitle}>
                These are neighbor-to-neighbor tips, not police reports. Please report responsibly.
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.value;
                const colors = CATEGORY_COLORS[cat.value];
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryChip,
                      { backgroundColor: isSelected ? colors.bg : Colors.background },
                      isSelected && { borderColor: colors.border, borderWidth: 1.5 },
                    ]}
                    onPress={() => handleCategorySelect(cat.value)}
                    activeOpacity={0.7}
                    testID={`category-${cat.value}`}
                  >
                    {cat.icon}
                    <Text style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextActive,
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Description</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                placeholder="Describe what you saw..."
                placeholderTextColor={Colors.slateLighter}
                value={description}
                onChangeText={setDescription}
                maxLength={MAX_CHARS + 10}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="alert-description-input"
              />
              <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
                {remainingChars}
              </Text>
            </View>

            <View style={styles.locationRow}>
              <MapPin size={14} color={Colors.slateLight} />
              <Text style={styles.locationText}>
                Approximate location will be shared (street + block only)
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, (!category || description.trim().length === 0 || submitting) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!category || description.trim().length === 0 || submitting}
              activeOpacity={0.85}
              testID="submit-alert-btn"
            >
              <Send size={18} color={Colors.white} />
              <Text style={styles.submitBtnText}>
                {submitting ? 'Submitting...' : 'Submit Alert'}
              </Text>
            </TouchableOpacity>

            {/* Crime Stoppers USA — anonymous tip line */}
            <View style={styles.crimeStoppersCard}>
              <View style={styles.crimeStoppersHeader}>
                <View style={styles.crimeStoppersIconWrap}>
                  <Phone size={16} color="#1565C0" />
                </View>
                <Text style={styles.crimeStoppersTitle}>Crime Stoppers USA</Text>
              </View>
              <TouchableOpacity
                onPress={() => Linking.openURL('tel:18002228477')}
                activeOpacity={0.75}
                testID="crime-stoppers-call-btn"
              >
                <Text style={styles.crimeStoppersPhone}>1-800-222-TIPS</Text>
              </TouchableOpacity>
              <Text style={styles.crimeStoppersDesc}>
                Submit an anonymous tip about criminal activity in your area — 24/7, free, and confidential. You may be eligible for a cash reward.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 32 : 40,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 4,
  },
  alertIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FBE9E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.slateLight,
  },
  categoryChipTextActive: {
    color: Colors.slate,
    fontWeight: '600' as const,
  },
  inputWrap: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 12,
    position: 'relative',
  },
  textInput: {
    fontSize: 15,
    color: Colors.slate,
    padding: 14,
    minHeight: 100,
    lineHeight: 22,
  },
  charCount: {
    position: 'absolute',
    bottom: 10,
    right: 14,
    fontSize: 11,
    color: Colors.slateLighter,
    fontWeight: '500' as const,
  },
  charCountOver: {
    color: Colors.danger,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  locationText: {
    fontSize: 12,
    color: Colors.slateLight,
    fontWeight: '400' as const,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D84315',
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 8,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.slateLighter,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  crimeStoppersCard: {
    marginTop: 20,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
    gap: 8,
  },
  crimeStoppersHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 2,
  },
  crimeStoppersIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  crimeStoppersTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1E3A5F',
    letterSpacing: 0.2,
  },
  crimeStoppersPhone: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#1565C0',
    letterSpacing: 0.5,
    textDecorationLine: 'underline' as const,
  },
  crimeStoppersDesc: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 17,
    marginTop: 2,
  },
});
