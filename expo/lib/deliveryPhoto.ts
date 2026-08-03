import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';

/**
 * Storage bucket for proof-of-delivery photos. Created by
 * supabase/delivery-proof-photos-migration.sql (public-read, partner-scoped write).
 */
export const DELIVERY_PHOTOS_BUCKET = 'delivery-photos';

/** Max upload size enforced client-side (matches migration file_size_limit). */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Request camera permissions and launch the device camera to capture a
 * single proof-of-delivery photo. Falls back to the photo library if the
 * camera is unavailable (e.g. simulator). Returns the local URI + asset,
 * or null if the user cancelled.
 *
 * @throws Error('camera-permission-denied') if camera permission is refused.
 * @throws Error('photo-too-large') if the captured image exceeds the size cap.
 */
export async function captureDeliveryPhoto(): Promise<{
  uri: string;
  asset: ImagePicker.ImagePickerAsset;
} | null> {
  const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!cameraPerm.granted) {
    throw new Error('camera-permission-denied');
  }

  // Try camera first; if it fails or returns nothing, fall back to library.
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });
    // If camera was cancelled, try library as a fallback for simulator/dev
    if (result.canceled) {
      return null;
    }
  } catch (camErr) {
    warn('[deliveryPhoto] Camera unavailable, falling back to library:', camErr);
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libPerm.granted) {
      throw new Error('camera-permission-denied');
    }
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
  }

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  // Size guard
  const bytes = await resolveAssetBytes(asset);
  if (bytes !== null && bytes > MAX_PHOTO_BYTES) {
    throw new Error('photo-too-large');
  }

  return { uri: asset.uri, asset };
}

/**
 * Read the byte size of a picked asset, preferring ImagePicker's reported
 * fileSize and falling back to FileSystem.stat for file:// URIs.
 */
async function resolveAssetBytes(
  asset: ImagePicker.ImagePickerAsset,
): Promise<number | null> {
  if (typeof asset.fileSize === 'number' && asset.fileSize > 0) {
    return asset.fileSize;
  }
  if (asset.uri.startsWith('file://')) {
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (info.exists && typeof info.size === 'number') return info.size;
    } catch {
      /* fall through */
    }
  }
  return null;
}

/**
 * Upload a local image URI to the `delivery-photos` bucket under
 * `<uid>/<shipmentId>/<filename>` and return the public CDN URL.
 *
 * @param userId     Supabase auth user id (the partner capturing the photo).
 * @param shipmentId The shipment being completed.
 * @param localUri   Local file:// / ph:// / content:// URI from ImagePicker.
 * @param asset      The original ImagePicker asset (for mimeType).
 * @returns Public CDN URL of the uploaded photo.
 * @throws Error on size limit, upload failure, or missing URL.
 */
export async function uploadDeliveryPhoto(
  userId: string,
  shipmentId: string,
  localUri: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  // Path: <uid>/<shipmentId>/<timestamp>.<ext>
  const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = `${Date.now()}.${safeExt}`;
  const path = `${userId}/${shipmentId}/${fileName}`;

  // Determine mime type
  const mimeType =
    asset.mimeType ??
    (safeExt === 'png'
      ? 'image/png'
      : safeExt === 'webp'
        ? 'image/webp'
        : 'image/jpeg');

  // Upload via fetch -> Blob (cross-platform RN pattern)
  let blob: Blob;
  try {
    const response = await fetch(localUri);
    blob = await response.blob();
  } catch (e) {
    warn('[deliveryPhoto] Failed to read local URI for upload:', e);
    throw new Error('photo-read-failed');
  }

  const { error } = await supabase.storage
    .from(DELIVERY_PHOTOS_BUCKET)
    .upload(path, blob, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    warn('[deliveryPhoto] Storage upload error:', error.message);
    throw new Error('photo-upload-failed');
  }

  const { data } = supabase.storage
    .from(DELIVERY_PHOTOS_BUCKET)
    .getPublicUrl(path);
  if (!data?.publicUrl) {
    warn('[deliveryPhoto] No public URL returned for path:', path);
    throw new Error('photo-url-missing');
  }

  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  log('[deliveryPhoto] Uploaded to', publicUrl);
  return publicUrl;
}
