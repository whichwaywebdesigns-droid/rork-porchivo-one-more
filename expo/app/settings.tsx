/**
 * Settings screen — the only screen that renders the decorative PorchLightHero.
 *
 * Theme UI layout (per spec):
 *  - ONE DoorFlipSwitch: value = (resolvedTheme === 'light'), ON = light, OFF = dark.
 *  - Pressing the switch sets preference to the opposite of resolvedTheme
 *    (light ↔ dark), never writes 'system'.
 *  - A segmented preference selector (Light | System | Dark) is always visible
 *    below the switch and shows which preference is active.
 *  - When preference === 'system', the switch still reflects the device-resolved
 *    state; the segmented control's "System" pill is highlighted.
 *
 * All other screens consume tokens only — no porch-light graphics.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImagePlus,
  Info,
  LifeBuoy,
  Lock,
  LogOut,
  PackageCheck,
  Shield,
  Smartphone,
  Star,
  Trash2,
  Truck,
  User,
  HandHeart,
  MapPin,
  Volume2,
} from 'lucide-react-native';
import {
  pickAvatarImage,
  uploadAvatar,
  removeAvatarAtPublicUrl,
} from '@/lib/avatar';

import { useTheme } from '@/hooks/useTheme';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { ReadOnlyNotice } from '@/components/BillingGraceBanner';
import { manualRequestReview } from '@/lib/storeReview';
import { useApp } from '@/store/AppContext';
import { useNotifications } from '@/store/NotificationsContext';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { NotificationPreferences, DeliverySound } from '@/lib/notificationPreferences';
import { ThemePreference, ThemeTokens } from '@/constants/theme';
import { DoorFlipSwitch } from '@/components/settings/DoorFlipSwitch';
import { PorchLightHero } from '@/components/settings/PorchLightHero';

// ── Preference options ────────────────────────────────────────────────────────

const PREF_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
  { label: 'Dark', value: 'dark' },
];

// ── Segmented preference selector ─────────────────────────────────────────────

interface SegmentedPrefProps {
  preference: ThemePreference;
  onSelect: (pref: ThemePreference) => void;
  tokens: ThemeTokens;
}

function SegmentedPref({ preference, onSelect, tokens }: SegmentedPrefProps) {
  return (
    <View
      style={[
        styles.segment,
        {
          backgroundColor: tokens.surfaceAlt,
          borderColor: tokens.border,
        },
      ]}
    >
      {PREF_OPTIONS.map(({ label, value }) => {
        const active = preference === value;
        return (
          <Pressable
            key={value}
            style={[
              styles.segmentPill,
              active && {
                backgroundColor: tokens.surface,
                borderColor: tokens.border,
                shadowColor: tokens.shadow,
              },
            ]}
            onPress={() => onSelect(value)}
            accessibilityRole="radio"
            accessibilityLabel={`${label} theme preference`}
            accessibilityState={{ checked: active }}
          >
            {value === 'system' && (
              <Smartphone
                size={11}
                color={active ? tokens.accent : tokens.textMuted}
                strokeWidth={2.2}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: active ? tokens.text : tokens.textMuted,
                  fontWeight: active ? ('700' as const) : ('500' as const),
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Setting row helper ────────────────────────────────────────────────────────

interface RowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  isLast?: boolean;
  tokens: ThemeTokens;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  isDestructive = false,
  isLast = false,
  tokens,
}: RowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: tokens.border },
      ]}
      onPress={onPress}
      activeOpacity={0.72}
      disabled={!onPress}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: isDestructive
              ? `${tokens.danger}18`
              : tokens.accentSoft,
          },
        ]}
      >
        {icon}
      </View>
      <Text
        style={[
          styles.rowLabel,
          { color: isDestructive ? tokens.danger : tokens.text },
        ]}
      >
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value != null && (
          <Text style={[styles.rowValue, { color: tokens.textMuted }]}>
            {value}
          </Text>
        )}
        {onPress != null && (
          <ChevronRight size={16} color={tokens.textMuted} strokeWidth={2.2} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Preference toggle row ─────────────────────────────────────────────────────

interface PrefToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  tokens: ThemeTokens;
  /** Billing grace stage 2 (day 14+): notification-preference writes are read-only. */
  disabled?: boolean;
}

function PrefToggle({ icon, label, description, value, onToggle, tokens, disabled }: PrefToggleProps) {
  return (
    <TouchableOpacity
      style={[styles.notifPrefRow, disabled && styles.notifPrefRowDisabled]}
      onPress={onToggle}
      activeOpacity={0.72}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
    >
      <View style={[styles.rowIcon, { backgroundColor: tokens.accentSoft }]}>
        {icon}
      </View>
      <View style={styles.notifPrefText}>
        <Text style={[styles.notifPrefLabel, { color: tokens.text }]}>
          {label}
        </Text>
        <Text style={[styles.notifPrefDesc, { color: tokens.textMuted }]}>
          {description}
        </Text>
      </View>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? tokens.accent : tokens.border },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            { transform: [{ translateX: value ? 20 : 0 }] },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, tokens }: { title: string; tokens: ThemeTokens }) {
  return (
    <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
      {title}
    </Text>
  );
}

// ── Profile card: avatar upload / display / remove ───────────────────────────

/**
 * Resident profile picture management for dashboard settings. Uploads
 * immediately on pick (unlike Edit Profile, which stages until Save) via the
 * shared `lib/avatar` helpers, persists the public URL through AppContext,
 * and best-effort removes the previous Storage object so uploads don't
 * accumulate. Disabled during billing-grace read-only mode.
 */
function ProfileCard({ tokens }: { tokens: ThemeTokens }) {
  const { user, updateUser } = useApp();
  const { isResidentSettingsReadOnly } = useSubscriptionGate();
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const router = useRouter();

  const handlePickImage = useCallback(async () => {
    if (!user || isUploading) return;
    try {
      const picked = await pickAvatarImage();
      if (!picked) return;
      setIsUploading(true);
      const publicUrl = await uploadAvatar(user.id, picked.uri, picked.asset);
      // Best-effort cleanup of the previously stored object (non-fatal).
      if (user.avatarUrl) {
        void removeAvatarAtPublicUrl(user.avatarUrl);
      }
      updateUser({ avatarUrl: publicUrl });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const msg =
        e?.message === 'photo-permission-denied'
          ? 'Please allow photo library access to change your picture.'
          : e?.message === 'avatar-too-large'
          ? 'That photo is larger than 5 MB. Please choose a smaller image.'
          : 'Could not upload your photo. Please try again.';
      Alert.alert('Photo upload failed', msg);
    } finally {
      setIsUploading(false);
    }
  }, [user, isUploading, updateUser]);

  const handleRemovePhoto = useCallback(() => {
    if (!user) return;
    const previousUrl = user.avatarUrl;
    if (!previousUrl) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove photo?',
      'Your profile picture will be removed and replaced with your initial.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive' as const,
          onPress: () => {
            void removeAvatarAtPublicUrl(previousUrl);
            updateUser({ avatarUrl: null });
          },
        },
      ],
    );
  }, [user, updateUser]);

  if (!user) return null;

  const initial = user.name?.trim()?.[0]?.toUpperCase() ?? '?';
  const disabled = isResidentSettingsReadOnly || isUploading;

  return (
    <View
      style={[
        styles.card,
        styles.cardRows,
        {
          backgroundColor: tokens.card,
          borderColor: tokens.border,
          shadowColor: tokens.shadow,
        },
      ]}
    >
      <View style={styles.profileBody}>
        <TouchableOpacity
          style={styles.avatarTouch}
          onPress={() => void handlePickImage()}
          activeOpacity={0.8}
          disabled={disabled}
          accessibilityRole="imagebutton"
          accessibilityLabel={
            user.avatarUrl ? 'Change profile picture' : 'Upload profile picture'
          }
          testID="settings-avatar-press"
        >
          {user.avatarUrl ? (
            <Image
              source={{ uri: user.avatarUrl }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View
              style={[styles.avatarPlaceholder, { backgroundColor: tokens.accentSoft }]}
            >
              <Text style={[styles.avatarInitial, { color: tokens.accent }]}>
                {initial}
              </Text>
            </View>
          )}
          {isUploading && (
            <View style={styles.avatarUploading}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
          {!isUploading && (
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: tokens.accent, borderColor: tokens.card },
              ]}
            >
              <Camera size={11} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <Text
            style={[styles.profileName, { color: tokens.text }]}
            numberOfLines={1}
          >
            {user.name || 'Your profile'}
          </Text>
          <Text
            style={[styles.profileEmail, { color: tokens.textMuted }]}
            numberOfLines={1}
          >
            {user.email}
          </Text>

          <View style={styles.profileActions}>
            <TouchableOpacity
              style={[styles.actionPill, { backgroundColor: tokens.accentSoft }]}
              onPress={() => void handlePickImage()}
              activeOpacity={0.7}
              disabled={disabled}
              testID="settings-change-photo"
              accessibilityRole="button"
              accessibilityLabel={
                user.avatarUrl ? 'Change photo' : 'Upload photo'
              }
            >
              <ImagePlus size={13} color={tokens.accent} strokeWidth={2.2} />
              <Text style={[styles.actionPillText, { color: tokens.accent }]}>
                {user.avatarUrl ? 'Change photo' : 'Upload photo'}
              </Text>
            </TouchableOpacity>
            {user.avatarUrl ? (
              <TouchableOpacity
                style={[styles.actionPill, { backgroundColor: `${tokens.danger}14` }]}
                onPress={handleRemovePhoto}
                activeOpacity={0.7}
                disabled={disabled}
                testID="settings-remove-photo"
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Trash2 size={13} color={tokens.danger} strokeWidth={2.2} />
                <Text style={[styles.actionPillText, { color: tokens.danger }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: tokens.border }]} />
      <SettingRow
        icon={<User size={16} color={tokens.accent} strokeWidth={2} />}
        label="Edit profile"
        onPress={() => router.push('/edit-profile' as any)}
        isLast
        tokens={tokens}
      />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { preference, setPreference, resolvedTheme, isDark, tokens } =
    useTheme();
  const { signOut } = useApp();
  const { expoPushToken } = useNotifications();
  const { prefs, loaded: prefsLoaded, togglePref, setDeliverySound } = useNotificationPreferences();
  // Billing grace period — stage 2 (day 14+): notification-preference writes
  // are read-only for residents (soft notice, views stay readable).
  const { isResidentSettingsReadOnly } = useSubscriptionGate();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /**
   * Switch is ON when resolvedTheme === 'light'.
   * Pressing toggles between 'light' and 'dark' — never writes 'system'.
   * The segmented selector is the only way to reach 'system'.
   */
  const handleSwitchPress = useCallback(() => {
    void setPreference(resolvedTheme === 'light' ? 'dark' : 'light');
  }, [resolvedTheme, setPreference]);

  const handlePref = useCallback(
    (pref: ThemePreference) => {
      void setPreference(pref);
    },
    [setPreference],
  );

  const switchIsOn = resolvedTheme === 'light';

  return (
    <View style={[styles.root, { backgroundColor: tokens.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Hero section ── */}
      <View style={styles.heroWrap}>
        <PorchLightHero isDark={isDark} tokens={tokens} />

        {/* Back button — floats over hero */}
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              top: insets.top + 10,
              backgroundColor: isDark
                ? 'rgba(13,27,62,0.70)'
                : 'rgba(255,255,255,0.72)',
              shadowColor: tokens.shadow,
            },
          ]}
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={tokens.text} strokeWidth={2} />
        </TouchableOpacity>

        {/* Hero title — anchored to bottom of hero */}
        <View style={styles.heroFooter}>
          <Text style={[styles.heroTitle, { color: tokens.text }]}>
            Settings
          </Text>
          <Text style={[styles.heroSubtitle, { color: tokens.textMuted }]}>
            {preference === 'system'
              ? `Following device · ${isDark ? 'dark' : 'light'} now`
              : isDark
              ? 'Dark mode is on'
              : 'Light mode is on'}
          </Text>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile ── */}
        <SectionHeader title="PROFILE" tokens={tokens} />

        <ProfileCard tokens={tokens} />

        {/* ── Appearance ── */}
        <SectionHeader title="APPEARANCE" tokens={tokens} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              shadowColor: tokens.shadow,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: tokens.text }]}>
            Display theme
          </Text>
          <Text style={[styles.cardSubtitle, { color: tokens.textMuted }]}>
            Flip the switch or choose a preference below.
          </Text>

          {/* ── Single rocker switch: ON = light, OFF = dark ── */}
          <View style={styles.switchCentred}>
            <DoorFlipSwitch
              value={switchIsOn}
              onPress={handleSwitchPress}
              label={switchIsOn ? 'Light on' : 'Dark on'}
              tokens={tokens}
              testID="theme-switch-main"
            />
          </View>

          {/* ── Segmented preference selector ── */}
          <View style={styles.prefRow}>
            <SegmentedPref
              preference={preference}
              onSelect={handlePref}
              tokens={tokens}
            />
          </View>

          {/* System note — only shown when system is active */}
          {preference === 'system' && (
            <View
              style={[
                styles.systemNote,
                { backgroundColor: tokens.accentSoft, borderColor: `${tokens.accent}28` },
              ]}
            >
              <Smartphone
                size={12}
                color={tokens.accent}
                strokeWidth={2.2}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.systemNoteText, { color: tokens.accent }]}>
                Switch reflects device appearance automatically.
              </Text>
            </View>
          )}
        </View>

        {/* ── Support ── */}
        <SectionHeader title="SUPPORT" tokens={tokens} />

        <View
          style={[
            styles.card,
            styles.cardRows,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              shadowColor: tokens.shadow,
            },
          ]}
        >
          <SettingRow
            icon={<LifeBuoy size={16} color={tokens.accent} strokeWidth={2} />}
            label="Contact support"
            onPress={() => router.push('/contact-support' as any)}
            tokens={tokens}
          />
          <SettingRow
            icon={<Star size={16} color={tokens.accent} strokeWidth={2} />}
            label="Rate Porchivo"
            onPress={() => void manualRequestReview()}
            isLast
            tokens={tokens}
          />
        </View>

        {/* ── Notifications ── */}
        <SectionHeader title="NOTIFICATIONS" tokens={tokens} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              shadowColor: tokens.shadow,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: tokens.text }]}>
            Delivery alerts
          </Text>
          <Text style={[styles.cardSubtitle, { color: tokens.textMuted }]}>
            Choose which push notifications you receive about your packages.
          </Text>

          <ReadOnlyNotice />

          {prefsLoaded && (
            <>
              <PrefToggle
                icon={<Truck size={16} color={tokens.accent} strokeWidth={2} />}
                label="Out for delivery"
                description="Get pinged when your package leaves the truck."
                value={prefs.outForDeliveryAlerts}
                onToggle={() => togglePref('outForDeliveryAlerts')}
                disabled={isResidentSettingsReadOnly}
                tokens={tokens}
              />
              <PrefToggle
                icon={<PackageCheck size={16} color={tokens.accent} strokeWidth={2} />}
                label="Package delivered"
                description="Get pinged the moment your package arrives at your porch."
                value={prefs.deliveredAlerts}
                onToggle={() => togglePref('deliveredAlerts')}
                disabled={isResidentSettingsReadOnly}
                tokens={tokens}
              />
              <PrefToggle
                icon={<HandHeart size={16} color={tokens.accent} strokeWidth={2} />}
                label="Porch Partner updates"
                description="Pickup, handoff, and completed notifications."
                value={prefs.partnerPickupAlerts}
                onToggle={() => togglePref('partnerPickupAlerts')}
                disabled={isResidentSettingsReadOnly}
                tokens={tokens}
              />
              <PrefToggle
                icon={<MapPin size={16} color={tokens.accent} strokeWidth={2} />}
                label="Neighborhood alerts"
                description="Theft warnings and community activity nearby."
                value={prefs.communityAlerts}
                onToggle={() => togglePref('communityAlerts')}
                disabled={isResidentSettingsReadOnly}
                tokens={tokens}
              />

              {/* Delivery sound picker */}
              <View style={styles.notifPrefRow}>
                <View style={[styles.rowIcon, { backgroundColor: tokens.accentSoft }]}>
                  <Volume2 size={16} color={tokens.accent} strokeWidth={2} />
                </View>
                <View style={styles.notifPrefText}>
                  <Text style={[styles.notifPrefLabel, { color: tokens.text }]}>
                    Delivery sound
                  </Text>
                  <Text style={[styles.notifPrefDesc, { color: tokens.textMuted }]}>
                    Choose the sound played for delivery status updates.
                  </Text>
                </View>
              </View>

              <View style={styles.soundPickerRow}>
                {(['default', 'chime', 'silent'] as DeliverySound[]).map((sound) => {
                  const active = prefs.deliverySound === sound;
                  const labels: Record<DeliverySound, string> = {
                    default: 'Default',
                    chime: 'Chime',
                    silent: 'Silent',
                  };
                  return (
                    <TouchableOpacity
                      key={sound}
                      style={[
                        styles.soundPill,
                        {
                          backgroundColor: active ? tokens.accent : tokens.surfaceAlt,
                          borderColor: active ? tokens.accent : tokens.border,
                        },
                      ]}
                      onPress={() => { if (!isResidentSettingsReadOnly) void setDeliverySound(sound); }}
                      activeOpacity={0.7}
                      disabled={isResidentSettingsReadOnly}
                      accessibilityRole="radio"
                      accessibilityLabel={`${labels[sound]} delivery sound`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.soundPillLabel,
                          {
                            color: active ? '#FFFFFF' : tokens.textMuted,
                            fontWeight: active ? ('700' as const) : ('500' as const),
                          },
                        ]}
                      >
                        {labels[sound]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {!prefsLoaded && (
            <Text style={[styles.cardSubtitle, { color: tokens.textMuted }]}>
              Loading preferences...
            </Text>
          )}

          <View style={[styles.divider, { backgroundColor: tokens.border }]} />

          <SettingRow
            icon={<Bell size={16} color={tokens.accent} strokeWidth={2} />}
            label="All notifications"
            onPress={() => router.push('/notifications' as any)}
            tokens={tokens}
          />
        </View>

        {/* ── Privacy & Security ── */}
        <SectionHeader title="PRIVACY & SECURITY" tokens={tokens} />

        <View
          style={[
            styles.card,
            styles.cardRows,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              shadowColor: tokens.shadow,
            },
          ]}
        >
          <SettingRow
            icon={<Lock size={16} color={tokens.accent} strokeWidth={2} />}
            label="Privacy policy"
            onPress={() => router.push('/privacy-policy' as any)}
            tokens={tokens}
          />
          <SettingRow
            icon={<FileText size={16} color={tokens.accent} strokeWidth={2} />}
            label="Terms of service"
            onPress={() => router.push('/terms-of-service' as any)}
            tokens={tokens}
          />
          <SettingRow
            icon={<Shield size={16} color={tokens.accent} strokeWidth={2} />}
            label="Community guidelines"
            onPress={() => router.push('/community-guidelines' as any)}
            isLast
            tokens={tokens}
          />
        </View>

        {/* ── About ── */}
        <SectionHeader title="ABOUT" tokens={tokens} />

        <View
          style={[
            styles.card,
            styles.cardRows,
            {
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              shadowColor: tokens.shadow,
            },
          ]}
        >
          <SettingRow
            icon={<Info size={16} color={tokens.accent} strokeWidth={2} />}
            label="App version"
            value="1.0.6"
            tokens={tokens}
          />
          <SettingRow
            icon={<LogOut size={16} color={tokens.danger} strokeWidth={2} />}
            label="Sign out"
            onPress={async () => {
              try {
                await signOut();
              } catch {
                // signOut itself handles navigation; ignore errors here
              }
              router.replace('/welcome' as any);
            }}
            isDestructive
            isLast
            tokens={tokens}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heroWrap: {
    position: 'relative' as const,
  },
  backBtn: {
    position: 'absolute' as const,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  heroFooter: {
    position: 'absolute' as const,
    bottom: 14,
    left: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 4,
  },
  cardRows: {
    padding: 0,
    overflow: 'hidden' as const,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 19,
    marginBottom: 20,
  },

  // ── Switch ────────────────────────────────────────────────────────────────
  switchCentred: {
    alignItems: 'center',
    marginBottom: 20,
  },

  // ── Segmented preference selector ─────────────────────────────────────────
  prefRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  segment: {
    flexDirection: 'row' as const,
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  segmentPill: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },

  // ── System note ───────────────────────────────────────────────────────────
  systemNote: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  systemNoteText: {
    fontSize: 12,
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 17,
  },

  // ── Notification preference toggles ───────────────────────────────────────
  notifPrefRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  /** Billing grace stage 2 — dimmed but still readable (views stay live). */
  notifPrefRowDisabled: {
    opacity: 0.55,
  },
  notifPrefText: {
    flex: 1,
  },
  notifPrefLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  notifPrefDesc: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center' as const,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  // ── Sound picker ───────────────────────────────────────────────────────────
  soundPickerRow: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingLeft: 44,
    paddingRight: 4,
    marginBottom: 12,
  },
  soundPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  soundPillLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: -4,
  },

  // ── Profile card ──────────────────────────────────────────────────────────
  profileBody: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    padding: 16,
  },
  avatarTouch: {
    width: 72,
    height: 72,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  avatarUploading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cameraBadge: {
    position: 'absolute' as const,
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 1,
  },
  profileActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 10,
  },
  actionPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },

  // ── Setting rows ─────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  rowRight: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
});
