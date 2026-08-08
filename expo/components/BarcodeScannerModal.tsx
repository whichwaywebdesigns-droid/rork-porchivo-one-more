import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeType } from 'expo-camera';
import { X, ScanLine, CheckCircle2, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useColors, AppColors } from '@/constants/colors';
import { log } from '@/lib/logger';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCAN_FRAME_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

const TRACKING_BARCODE_TYPES: BarcodeType[] = [
  'code128',
  'code39',
  'code93',
  'codabar',
  'ean13',
  'ean8',
  'itf14',
  'upc_a',
  'upc_e',
  'qr',
  'pdf417',
  'datamatrix',
  'aztec',
];

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}

export default function BarcodeScannerModal({
  visible,
  onClose,
  onScanned,
}: BarcodeScannerModalProps) {
  const colors = useColors();
  const styles = useStyleSheet(colors);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [flashAnim] = useState<Animated.Value>(new Animated.Value(0));
  const [lineAnim] = useState<Animated.Value>(new Animated.Value(0));
  const lastScanRef = useRef<{ data: string; time: number }>({ data: '', time: 0 });

  // Animated scan line
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(lineAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, lineAnim]);

  // Reset scanned state when modal reopens
  useEffect(() => {
    if (visible) {
      setScanned(false);
      flashAnim.setValue(0);
    }
  }, [visible, flashAnim]);

  const handleBarCodeScanned = useCallback(
    (result: { type: string; data: string }) => {
      const { data } = result;
      if (!data) return;

      // Debounce duplicate scans within 2 seconds
      const now = Date.now();
      if (
        lastScanRef.current.data === data &&
        now - lastScanRef.current.time < 2000
      ) {
        return;
      }
      lastScanRef.current = { data, time: now };

      setScanned(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Flash effect
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Brief delay so the user sees the success flash, then callback
      setTimeout(() => {
        onScanned(data);
      }, 350);
    },
    [onScanned, flashAnim],
  );

  const scanLineTranslateY = lineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_FRAME_SIZE - 4],
  });

  // Permission loading state
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Preparing camera…</Text>
        </View>
      </Modal>
    );
  }

  // Permission denied state
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconWrap}>
            <Camera size={36} color={colors.slateLighter} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionBody}>
            Porchivo needs camera access to scan package barcodes. Please grant camera permission to use this feature.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => requestPermission()}
            activeOpacity={0.85}
          >
            <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.permissionSecondary}
            onPress={onClose}
            hitSlop={12}
          >
            <Text style={styles.permissionSecondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Camera preview */}
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: TRACKING_BARCODE_TYPES,
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Dark overlay with transparent scan window */}
        <View style={styles.overlayContainer}>
          {/* Top section */}
          <View style={styles.overlayTop} />

          {/* Middle row: left overlay | scan frame | right overlay */}
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Animated scan line */}
              {!scanned && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [{ translateY: scanLineTranslateY }],
                    },
                  ]}
                />
              )}
            </View>
            <View style={styles.overlaySide} />
          </View>

          {/* Bottom section */}
          <View style={styles.overlayBottom}>
            {scanned ? (
              <View style={styles.scannedBanner}>
                <CheckCircle2 size={22} color={colors.success} />
                <Text style={styles.scannedText}>Barcode detected!</Text>
              </View>
            ) : (
              <View style={styles.hintWrap}>
                <ScanLine size={20} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.hintText}>
                  Point your camera at a package barcode
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Flash overlay on successful scan */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flashOverlay,
            { opacity: flashAnim },
          ]}
        />

        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
          accessibilityLabel="Close barcode scanner"
          accessibilityRole="button"
        >
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function useStyleSheet(colors: AppColors) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: '#000000',
        },
        loadingContainer: {
          flex: 1,
          backgroundColor: '#000000',
          alignItems: 'center',
          justifyContent: 'center',
        },
        loadingText: {
          fontSize: 16,
          color: '#FFFFFF',
          opacity: 0.7,
        },
        // ── Permission denied ──
        permissionContainer: {
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 12,
        },
        permissionIconWrap: {
          width: 72,
          height: 72,
          borderRadius: 24,
          backgroundColor: colors.skyBlue,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        },
        permissionTitle: {
          fontSize: 20,
          fontWeight: '700' as const,
          color: colors.slate,
        },
        permissionBody: {
          fontSize: 14,
          lineHeight: 20,
          color: colors.slateLight,
          textAlign: 'center',
          marginBottom: 12,
        },
        permissionButton: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          paddingHorizontal: 28,
          borderRadius: 14,
        },
        permissionButtonText: {
          fontSize: 16,
          fontWeight: '700' as const,
          color: colors.white,
        },
        permissionSecondary: {
          marginTop: 8,
        },
        permissionSecondaryText: {
          fontSize: 15,
          color: colors.slateLight,
        },
        // ── Overlay ──
        overlayContainer: {
          flex: 1,
        },
        overlayTop: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
        },
        overlayMiddle: {
          flexDirection: 'row',
          height: SCAN_FRAME_SIZE,
        },
        overlaySide: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
        },
        scanFrame: {
          width: SCAN_FRAME_SIZE,
          height: SCAN_FRAME_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        corner: {
          position: 'absolute' as const,
          width: 28,
          height: 28,
          borderColor: colors.primary,
          borderWidth: 3,
        },
        cornerTL: {
          top: 0,
          left: 0,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderTopLeftRadius: 8,
        },
        cornerTR: {
          top: 0,
          right: 0,
          borderLeftWidth: 0,
          borderBottomWidth: 0,
          borderTopRightRadius: 8,
        },
        cornerBL: {
          bottom: 0,
          left: 0,
          borderRightWidth: 0,
          borderTopWidth: 0,
          borderBottomLeftRadius: 8,
        },
        cornerBR: {
          bottom: 0,
          right: 0,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderBottomRightRadius: 8,
        },
        scanLine: {
          position: 'absolute' as const,
          left: 8,
          right: 8,
          height: 2,
          backgroundColor: colors.primary,
          borderRadius: 1,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 6,
          elevation: 4,
        },
        overlayBottom: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 20,
        },
        hintWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        hintText: {
          fontSize: 15,
          fontWeight: '600' as const,
          color: '#FFFFFF',
        },
        scannedBanner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: 'rgba(30, 156, 106, 0.25)',
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 30,
        },
        scannedText: {
          fontSize: 16,
          fontWeight: '700' as const,
          color: '#FFFFFF',
        },
        // ── Flash ──
        flashOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: '#FFFFFF',
        },
        // ── Close button ──
        closeButton: {
          position: 'absolute' as const,
          top: Platform.OS === 'ios' ? 54 : 24,
          right: 20,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [colors],
  );
}
