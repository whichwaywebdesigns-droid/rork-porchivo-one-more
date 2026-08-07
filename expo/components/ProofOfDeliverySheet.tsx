import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {
  Camera,
  Check,
  X,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useShipments } from '@/store/ShipmentsContext';
import {
  captureDeliveryPhoto,
  uploadDeliveryPhoto,
} from '@/lib/deliveryPhoto';
import { log } from '@/lib/logger';

interface ProofOfDeliverySheetProps {
  visible: boolean;
  shipmentId: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function ProofOfDeliverySheet({
  visible,
  shipmentId,
  onClose,
  onComplete,
}: ProofOfDeliverySheetProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useApp();
  const { completeShipment } = useShipments();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoAsset, setPhotoAsset] = useState<
    import('expo-image-picker').ImagePickerAsset | null
  >(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [skipping, setSkipping] = useState<boolean>(false);

  const handleCapture = useCallback(async () => {
    setCapturing(true);
    try {
      const result = await captureDeliveryPhoto();
      if (result) {
        setPhotoUri(result.uri);
        setPhotoAsset(result.asset);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg === 'camera-permission-denied') {
        Alert.alert(
          'Camera Permission Needed',
          'Please allow camera access in Settings to capture proof-of-delivery photos.',
          [{ text: 'OK' }],
        );
      } else if (msg === 'photo-too-large') {
        Alert.alert(
          'Photo Too Large',
          'The captured photo exceeds the 10 MB limit. Please try again.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Camera Error', 'Could not capture a photo. Please try again.', [{ text: 'OK' }]);
      }
    } finally {
      setCapturing(false);
    }
  }, []);

  const handleRetake = useCallback(() => {
    setPhotoUri(null);
    setPhotoAsset(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user?.id) return;

    // If no photo captured, allow skip — complete without photo
    if (!photoUri || !photoAsset) {
      setSkipping(true);
      try {
        await completeShipment(shipmentId, null);
        onComplete();
      } finally {
        setSkipping(false);
        resetState();
      }
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadDeliveryPhoto(
        user.id,
        shipmentId,
        photoUri,
        photoAsset,
      );
      await completeShipment(shipmentId, publicUrl);
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('[ProofOfDelivery] Upload error:', msg);
      Alert.alert(
        'Upload Failed',
        'Could not upload the proof photo. You can complete without a photo or try again.',
        [
          { text: 'Complete without photo', onPress: async () => {
            await completeShipment(shipmentId, null);
            onComplete();
          }},
          { text: 'Try Again', style: 'cancel' },
        ],
      );
    } finally {
      setUploading(false);
    }
  }, [user?.id, photoUri, photoAsset, shipmentId, completeShipment, onComplete]);

  const resetState = useCallback(() => {
    setPhotoUri(null);
    setPhotoAsset(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const busy = uploading || capturing || skipping;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Proof of Delivery</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={busy}
              hitSlop={8}
              style={styles.closeBtn}
            >
              <X size={22} color={colors.slateLight} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {!photoUri ? (
            <View style={styles.captureArea}>
              <View style={styles.captureIconWrap}>
                {capturing ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <Camera size={48} color={colors.primary} />
                )}
              </View>
              <Text style={styles.captureTitle}>
                {capturing ? 'Opening camera…' : 'Capture a delivery photo'}
              </Text>
              <Text style={styles.captureSub}>
                Take a photo of the package at the homeowner's porch as visual proof of delivery.
              </Text>
              <TouchableOpacity
                style={styles.captureBtn}
                onPress={handleCapture}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Camera size={20} color={colors.white} />
                <Text style={styles.captureBtnText}>
                  {capturing ? 'Opening…' : 'Take Photo'}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <Text style={styles.optionalNote}>
                A photo is recommended but optional. You can complete the delivery without one.
              </Text>
            </View>
          ) : (
            <View style={styles.previewArea}>
              <View style={styles.previewImageWrap}>
                <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
              </View>

              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.retakeBtn}
                  onPress={handleRetake}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={16} color={colors.slateLight} />
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.previewHint}>
                Looks good? Submit to mark this delivery as complete.
              </Text>
            </View>
          )}

          {/* Footer actions */}
          <View style={styles.footer}>
            {photoUri ? (
              <TouchableOpacity
                style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={busy}
                activeOpacity={0.85}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator size="small" color={colors.white} />
                    <Text style={styles.submitBtnText}>Uploading…</Text>
                  </>
                ) : (
                  <>
                    <Check size={20} color={colors.white} />
                    <Text style={styles.submitBtnText}>Submit & Complete</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.skipBtn, skipping && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={busy}
                activeOpacity={0.85}
              >
                {skipping ? (
                  <ActivityIndicator size="small" color={colors.slateLight} />
                ) : (
                  <Text style={styles.skipBtnText}>Complete without photo</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 34,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: colors.slate,
    },
    closeBtn: {
      padding: 4,
    },
    captureArea: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 28,
    },
    captureIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: colors.skyBlue,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    captureTitle: {
      fontSize: 17,
      fontWeight: '600' as const,
      color: colors.slate,
      marginBottom: 6,
      textAlign: 'center' as const,
    },
    captureSub: {
      fontSize: 14,
      color: colors.slateLight,
      textAlign: 'center' as const,
      lineHeight: 20,
      marginBottom: 22,
    },
    captureBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 32,
      width: '100%',
    },
    captureBtnText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600' as const,
    },
    divider: {
      width: '100%',
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: 20,
    },
    optionalNote: {
      fontSize: 13,
      color: colors.slateLighter,
      textAlign: 'center' as const,
      lineHeight: 18,
    },
    previewArea: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    previewImageWrap: {
      borderRadius: 14,
      overflow: 'hidden' as const,
      backgroundColor: colors.borderLight,
    },
    previewImage: {
      width: '100%',
      height: 260,
    },
    previewActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 14,
    },
    retakeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: colors.background,
    },
    retakeBtnText: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: colors.slateLight,
    },
    previewHint: {
      fontSize: 13,
      color: colors.slateLight,
      textAlign: 'center' as const,
      marginTop: 12,
      lineHeight: 18,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.success,
      borderRadius: 14,
      paddingVertical: 16,
      width: '100%',
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600' as const,
    },
    skipBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
    },
    skipBtnText: {
      fontSize: 15,
      fontWeight: '500' as const,
      color: colors.slateLight,
    },
  });
}
