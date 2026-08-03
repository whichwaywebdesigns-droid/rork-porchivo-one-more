import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';

/**
 * Storage bucket name for user avatars. Created by
 * supabase/avatar-storage-migration.sql (public-read, owner-scoped write).
 */
export const AVATAR_BUCKET = 'avatars';

/** Max upload size enforced client-side (matches migration file_size_limit). */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Lift a local `file://` (or `ph://` on iOS) URI returned by
 * expo-image-picker into a File that supabase-js can upload. Falls back to
 * the raw URI when `fetch` cannot read the source (e.g. some content://
 * schemes on Android), in which case supabase-js will resolve it directly.
 */
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

/**
 * Read the byte size of a picked asset, preferring ImagePicker's reported
 * fileSize and falling back to FileSystem.stat for `file://` URIs.
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
 * Pick a single square-cropped image from the library and return its local
 * URI plus the asset, or `null` if the user cancelled. Requests library
 * permission first; throws on hard permission denial so the caller can show
 * a user-facing message.
 */
export async function pickAvatarImage(): Promise<{
  uri: string;
  asset: ImagePicker.ImagePickerAsset;
} | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('photo-permission-denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, asset };
}

/**
 * Upload a local image URI to the `avatars` bucket under
 * `<uid>/<filename>` and return the public CDN URL. Overwrites any
 * existing object at the same path (upsert). Throws on size limit,
 * auth, or network failure so the caller can surface a real error.
 *
 * @param userId  Supabase auth user id — used as the storage path prefix.
 * @param localUri  Local `file://` / `ph://` / `content://` URI to upload.
 * @param asset  The original ImagePicker asset (for mimeType + fileSize).
 * @returns Public URL of the uploaded avatar.
 */
export async function uploadAvatar(
  userId: string,
  localUri: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  // ── Size guard ──────────────────────────────────────────────────────────
  const bytes = await resolveAssetBytes(asset);
  if (bytes !== null && bytes > MAX_AVATAR_BYTES) {
    throw new Error('avatar-too-large');
  }

  // ── Path: `<uid>/<timestamp>.<ext>` ──────────────────────────────────────
  // Namespacing by uid is what the Storage RLS policies enforce.
  const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const fileName = `${Date.now()}.${safeExt}`;
  const path = `${userId}/${fileName}`;

  // ── Determine mime type ──────────────────────────────────────────────────
  const mimeType =
    asset.mimeType ??
    (safeExt === 'png'
      ? 'image/png'
      : safeExt === 'webp'
        ? 'image/webp'
        : safeExt === 'gif'
          ? 'image/gif'
          : 'image/jpeg');

  // ── Upload ───────────────────────────────────────────────────────────────
  // supabase-js v2 accepts a Blob (from fetch) for cross-platform RN uploads.
  let blob: Blob;
  try {
    blob = await uriToBlob(localUri);
  } catch (e) {
    warn('[avatar] Failed to read local URI for upload:', e);
    throw new Error('avatar-read-failed');
  }

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    warn('[avatar] Storage upload error:', error.message);
    throw new Error('avatar-upload-failed');
  }

  // ── Public URL ───────────────────────────────────────────────────────────
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    warn('[avatar] No public URL returned for path:', path);
    throw new Error('avatar-url-missing');
  }

  // Cache-bust so other devices/surfaces pick up the new image immediately
  // instead of serving a CDN-cached copy of the previous upload.
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  log('[avatar] Uploaded to', publicUrl);
  return publicUrl;
}

/**
 * Remove the avatar object at a public URL previously produced by
 * `uploadAvatar`. Best-effort — errors are swallowed since the profile
 * row is the source of truth and a stale orphaned object is harmless.
 */
export async function removeAvatarAtPublicUrl(publicUrl: string): Promise<void> {
  try {
    const path = extractStoragePathFromPublicUrl(publicUrl);
    if (!path) return;
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    if (error) warn('[avatar] remove error (non-fatal):', error.message);
  } catch (e) {
    warn('[avatar] remove threw (non-fatal):', e);
  }
}

/**
 * Parse a Supabase Storage public URL back into the object path
 * (`<uid>/<file>`). Returns null if the URL doesn't match the expected shape.
 */
function extractStoragePathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Expected path: /storage/v1/object/public/avatars/<uid>/<file>
    const match = u.pathname.match(
      /\/storage\/v1\/object\/public\/avatars\/(.+)$/,
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
