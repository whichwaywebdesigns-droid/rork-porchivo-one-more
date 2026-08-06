import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  Check,
  User,
  Mail,
  Phone,
  Home,
  ChevronLeft,
  MapPin,
  CreditCard,
  ShieldAlert,
  Clock,
  Package,
  Users,
  Briefcase,
  FileText,
  AlertCircle,
  ChevronDown,
  Banknote,
  Lock,
  Trash2,
  ImagePlus,
  Gift,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useProfileExtension } from '@/store/ProfileExtensionContext';
import {
  pickAvatarImage,
  uploadAvatar,
  removeAvatarAtPublicUrl,
} from '@/lib/avatar';
import { log } from '@/lib/logger';
import type {
  StructuredAddress,
  SafeDropPreference,
  PreferredDeliveryWindow,
  PackageSize,
} from '@/types';
import { syncVolunteerStatus } from '@/lib/partnerVerification';

// ─── Address field helper ────────────────────────────────────────────────────

interface AddressBlockProps {
  title: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  address: StructuredAddress;
  onChange: (field: keyof StructuredAddress, value: string) => void;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
  testPrefix: string;
}

function AddressBlock({
  title,
  icon: Icon,
  address,
  onChange,
  colors,
  styles,
  testPrefix,
}: AddressBlockProps) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View style={[styles.sectionCardIcon, { backgroundColor: colors.skyBlue }]}>
          <Icon size={16} color={colors.primary} />
        </View>
        <Text style={styles.sectionCardTitle}>{title}</Text>
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.fieldContent}>
          <Text style={styles.fieldLabel}>Street Address</Text>
          <TextInput
            style={styles.fieldInput}
            value={address.street}
            onChangeText={(v) => onChange('street', v)}
            placeholder="123 Maple St"
            placeholderTextColor={colors.slateLighter}
            autoCapitalize="words"
            testID={`${testPrefix}-street`}
          />
        </View>
      </View>
      <View style={styles.fieldDivider} />

      <View style={styles.fieldRow}>
        <View style={styles.fieldContent}>
          <Text style={styles.fieldLabel}>Apt / Unit / Suite</Text>
          <TextInput
            style={styles.fieldInput}
            value={address.unit}
            onChangeText={(v) => onChange('unit', v)}
            placeholder="Apt 4B (optional)"
            placeholderTextColor={colors.slateLighter}
            autoCapitalize="words"
            testID={`${testPrefix}-unit`}
          />
        </View>
      </View>
      <View style={styles.fieldDivider} />

      <View style={styles.twoColRow}>
        <View style={[styles.fieldContent, { flex: 1.6 }]}>
          <Text style={styles.fieldLabel}>City</Text>
          <TextInput
            style={styles.fieldInput}
            value={address.city}
            onChangeText={(v) => onChange('city', v)}
            placeholder="Indianapolis"
            placeholderTextColor={colors.slateLighter}
            autoCapitalize="words"
            testID={`${testPrefix}-city`}
          />
        </View>
        <View style={styles.twoColDivider} />
        <View style={[styles.fieldContent, { flex: 0.9 }]}>
          <Text style={styles.fieldLabel}>State</Text>
          <TextInput
            style={styles.fieldInput}
            value={address.state}
            onChangeText={(v) => onChange('state', v.toUpperCase())}
            placeholder="IN"
            placeholderTextColor={colors.slateLighter}
            autoCapitalize="characters"
            maxLength={2}
            testID={`${testPrefix}-state`}
          />
        </View>
        <View style={styles.twoColDivider} />
        <View style={[styles.fieldContent, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>ZIP</Text>
          <TextInput
            style={styles.fieldInput}
            value={address.zip}
            onChangeText={(v) => onChange('zip', v)}
            placeholder="46201"
            placeholderTextColor={colors.slateLighter}
            keyboardType="number-pad"
            maxLength={10}
            testID={`${testPrefix}-zip`}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Chip selector ───────────────────────────────────────────────────────────

interface ChipOption<T extends string> {
  id: T;
  label: string;
  emoji?: string;
}

function ChipSelector<T extends string>({
  options,
  selected,
  onSelect,
  colors,
}: {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (id: T) => void;
  colors: AppColors;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {options.map((opt) => {
        const active = selected === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(opt.id);
            }}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.skyBlue : colors.surface,
            }}
          >
            {opt.emoji ? <Text style={{ fontSize: 13 }}>{opt.emoji}</Text> : null}
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? ('700' as const) : ('500' as const),
                color: active ? colors.primary : colors.slateLight,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Multi-chip (package sizes) ──────────────────────────────────────────────

function MultiChip({
  options,
  selected,
  onToggle,
  colors,
}: {
  options: { id: PackageSize; label: string; emoji: string; desc: string }[];
  selected: PackageSize[];
  onToggle: (id: PackageSize) => void;
  colors: AppColors;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => {
              Haptics.selectionAsync();
              onToggle(opt.id);
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.skyBlue : colors.surface,
            }}
          >
            <Text style={{ fontSize: 20, marginBottom: 2 }}>{opt.emoji}</Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: active ? ('700' as const) : ('500' as const),
                color: active ? colors.primary : colors.slateLight,
              }}
            >
              {opt.label}
            </Text>
            <Text style={{ fontSize: 10, color: colors.slateLighter, marginTop: 1 }}>
              {opt.desc}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Safe drop options ───────────────────────────────────────────────────────

const SAFE_DROP_OPTIONS: ChipOption<SafeDropPreference>[] = [
  { id: 'front_porch', label: 'Front Porch', emoji: '🏠' },
  { id: 'back_door', label: 'Back Door', emoji: '🚪' },
  { id: 'garage', label: 'Garage', emoji: '🅿️' },
  { id: 'mailroom', label: 'Mail Room', emoji: '📬' },
  { id: 'side_entrance', label: 'Side Entry', emoji: '🔑' },
  { id: 'leasing_office', label: 'Leasing Office', emoji: '🏢' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

const WINDOW_OPTIONS: ChipOption<PreferredDeliveryWindow>[] = [
  { id: 'any', label: 'Anytime', emoji: '🔄' },
  { id: 'morning', label: 'Morning 8–12', emoji: '🌅' },
  { id: 'afternoon', label: 'Afternoon 12–5', emoji: '☀️' },
  { id: 'evening', label: 'Evening 5–8', emoji: '🌆' },
];

const PACKAGE_SIZE_OPTIONS = [
  { id: 'small' as PackageSize, label: 'Small', emoji: '📦', desc: 'Under 2 lbs' },
  { id: 'medium' as PackageSize, label: 'Medium', emoji: '🗃️', desc: '2–15 lbs' },
  { id: 'large' as PackageSize, label: 'Large', emoji: '📫', desc: '15+ lbs' },
];

const RADIUS_OPTIONS: ChipOption<string>[] = [
  { id: '0.5', label: '0.5 mi' },
  { id: '1', label: '1 mi' },
  { id: '2', label: '2 mi' },
  { id: '5', label: '5 mi' },
];

// ─── Section wrapper ─────────────────────────────────────────────────────────

function SectionHeader({
  label,
  colors,
}: {
  label: string;
  colors: AppColors;
}) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700' as const,
        color: colors.primary,
        letterSpacing: 1.2,
        textTransform: 'uppercase' as const,
        marginTop: 28,
        marginBottom: 10,
        paddingHorizontal: 20,
      }}
    >
      {label}
    </Text>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useApp();
  const { extension, saveExtension, saveShippingAddress, saveBillingAddress, setBillingSameAsShipping, toggleAcceptedPackageSize } =
    useProfileExtension();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Core fields
  const [name, setName] = useState<string>(user?.name ?? '');
  const [email, setEmail] = useState<string>(user?.email ?? '');
  const [phone, setPhone] = useState<string>(user?.phone ?? '');
  const [homeAddress, setHomeAddress] = useState<string>(user?.address ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [pendingAvatarAsset, setPendingAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const role = user?.role ?? 'homeowner';
  const isHomeowner = role === 'homeowner' || role === 'both';
  const isPartner = role === 'partner' || role === 'both';

  const saveScale = useRef(new Animated.Value(1)).current;

  const AVATAR_HOSTS = ['file://', 'ph://', 'content://'];

  const hasChanges = useCallback(() => {
    if (!user) return false;
    return (
      name !== user.name ||
      email !== user.email ||
      phone !== user.phone ||
      homeAddress !== user.address ||
      avatarUri !== user.avatarUrl
    );
  }, [name, email, phone, homeAddress, avatarUri, user]);

  const handlePickImage = useCallback(async () => {
    try {
      const picked = await pickAvatarImage();
      if (!picked) return;
      setAvatarUri(picked.uri);
      setPendingAvatarAsset(picked.asset);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      const msg = e?.message === 'photo-permission-denied'
        ? 'Please allow photo library access to change your avatar.'
        : 'Could not open the photo library. Please try again.';
      Alert.alert('Error', msg);
    }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove photo?',
      'Your profile picture will be removed and replaced with your initial. This will be applied when you save.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setAvatarUri(null);
            setPendingAvatarAsset(null);
          },
        },
      ],
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = homeAddress.trim();

    if (!trimmedName) { Alert.alert('Name required', 'Please enter your name.'); return; }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Valid email required', 'Please enter a valid email address.');
      return;
    }

    Animated.sequence([
      Animated.timing(saveScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(saveScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    setIsSaving(true);
    try {
      // ── Upload avatar to Supabase Storage if a new local image was picked ──
      // A local file:// / ph:// / content:// URI means the user picked a new
      // photo that hasn't been uploaded yet. A remote https URL means the
      // avatar is already in Storage (or was cleared), so we persist it as-is.
      let finalAvatarUrl = avatarUri;
      const needsUpload =
        avatarUri !== user.avatarUrl &&
        avatarUri !== null &&
        AVATAR_HOSTS.some((p) => avatarUri.startsWith(p)) &&
        pendingAvatarAsset !== null;

      if (needsUpload) {
        try {
          finalAvatarUrl = await uploadAvatar(user.id, avatarUri, pendingAvatarAsset);
          // Best-effort: delete the previously stored avatar object so we
          // don't accumulate stale uploads per user.
          if (user.avatarUrl) {
            void removeAvatarAtPublicUrl(user.avatarUrl);
          }
        } catch (e: any) {
          const reason = e?.message === 'avatar-too-large'
            ? 'That photo is larger than 5 MB. Please choose a smaller image.'
            : 'Could not upload your photo. Please try again.';
          Alert.alert('Photo upload failed', reason);
          setIsSaving(false);
          return;
        }
      }

      // ── If the user cleared the avatar, best-effort delete the old object ──
      if (avatarUri === null && user.avatarUrl) {
        void removeAvatarAtPublicUrl(user.avatarUrl);
      }

      updateUser({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        address: trimmedAddress,
        avatarUrl: finalAvatarUrl,
      });
      setPendingAvatarAsset(null);

      // Sync volunteer status to Supabase (non-fatal if it fails — local still works)
      if (isPartner) {
        void syncVolunteerStatus(extension.isVolunteer).catch((e) =>
          log('[EditProfile] Volunteer sync error (non-fatal):', e),
        );
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.back(), 300);
    } catch {
      Alert.alert('Error', 'Could not save your profile. Please try again.');
      setIsSaving(false);
    }
  }, [user, name, email, phone, homeAddress, avatarUri, pendingAvatarAsset, updateUser, router, saveScale, AVATAR_HOSTS, isPartner, extension.isVolunteer]);

  const handleDiscard = useCallback(() => {
    if (hasChanges()) {
      Alert.alert('Discard changes?', 'You have unsaved changes that will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [hasChanges, router]);

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerLeft: () => (
            <TouchableOpacity onPress={handleDiscard} hitSlop={8}>
              <ChevronLeft size={24} color={colors.slate} strokeWidth={2} />
            </TouchableOpacity>
          ),
          headerRight: () => null,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickImage} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" transition={200} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Camera size={14} color={colors.white} />
            </View>
          </TouchableOpacity>

          {/* Explicit avatar action buttons */}
          <View style={styles.avatarActions}>
            <TouchableOpacity
              style={[styles.avatarActionBtn, { backgroundColor: colors.skyBlue }]}
              onPress={handlePickImage}
              activeOpacity={0.8}
              testID="edit-profile-change-photo"
            >
              <ImagePlus size={15} color={colors.primary} />
              <Text style={[styles.avatarActionText, { color: colors.primary }]}>
                {avatarUri ? 'Change Photo' : 'Upload Photo'}
              </Text>
            </TouchableOpacity>
            {avatarUri ? (
              <TouchableOpacity
                style={[styles.avatarActionBtn, styles.avatarActionBtnDanger]}
                onPress={handleRemovePhoto}
                activeOpacity={0.8}
                testID="edit-profile-remove-photo"
              >
                <Trash2 size={15} color={colors.danger} />
                <Text style={[styles.avatarActionText, { color: colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Role badge */}
          <View style={styles.roleBadgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: colors.skyBlue }]}>
              <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                {role === 'both' ? '🏠 Homeowner + Porch Partner' :
                 role === 'homeowner' ? '🏠 Homeowner' : '🤝 Porch Partner'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Basic Info ── */}
        <SectionHeader label="Basic Information" colors={colors} />
        <View style={[styles.sectionCard, { marginHorizontal: 20 }]}>
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIcon, { backgroundColor: colors.skyBlue }]}>
              <User size={16} color={colors.primary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={colors.slateLighter}
                autoCapitalize="words"
                testID="edit-profile-name"
              />
            </View>
          </View>
          <View style={styles.fieldDivider} />
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIcon, { backgroundColor: colors.skyBlue }]}>
              <Mail size={16} color={colors.primary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.slateLighter}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="edit-profile-email"
              />
            </View>
          </View>
          <View style={styles.fieldDivider} />
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIcon, { backgroundColor: colors.skyBlue }]}>
              <Phone size={16} color={colors.primary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.fieldInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 000-0000"
                placeholderTextColor={colors.slateLighter}
                keyboardType="phone-pad"
                testID="edit-profile-phone"
              />
            </View>
          </View>
          <View style={styles.fieldDivider} />
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIcon, { backgroundColor: colors.skyBlue }]}>
              <Home size={16} color={colors.primary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Home Address (for neighborhood matching)</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                value={homeAddress}
                onChangeText={setHomeAddress}
                placeholder="Your home address"
                placeholderTextColor={colors.slateLighter}
                multiline
                numberOfLines={2}
                testID="edit-profile-address"
              />
            </View>
          </View>
        </View>

        {/* ── Shipping Address ── */}
        <SectionHeader label="Shipping Address" colors={colors} />
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={styles.sectionNote}>
            Where packages should be delivered. May differ from your home address (e.g. workplace, PO Box).
          </Text>
          <AddressBlock
            title="Package Delivery Address"
            icon={MapPin}
            address={extension.shippingAddress}
            onChange={(field, value) => saveShippingAddress({ [field]: value })}
            colors={colors}
            styles={styles}
            testPrefix="shipping"
          />
        </View>

        {/* ── Billing Address ── */}
        <SectionHeader label="Billing Address" colors={colors} />
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={styles.sectionNote}>
            Used for payment processing and subscription billing.
          </Text>

          {/* Same as shipping toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <CreditCard size={16} color={colors.primary} />
              <Text style={styles.toggleLabel}>Same as shipping address</Text>
            </View>
            <Switch
              value={extension.billingAddressSameAsShipping}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                setBillingSameAsShipping(v);
              }}
              trackColor={{ false: colors.borderLight, true: colors.primary }}
              thumbColor={colors.white}
              testID="billing-same-as-shipping"
            />
          </View>

          {!extension.billingAddressSameAsShipping && (
            <AddressBlock
              title="Billing Address"
              icon={CreditCard}
              address={extension.billingAddress}
              onChange={(field, value) => saveBillingAddress({ [field]: value })}
              colors={colors}
              styles={styles}
              testPrefix="billing"
            />
          )}

          {extension.billingAddressSameAsShipping && (
            <View style={styles.infoBox}>
              <AlertCircle size={14} color={colors.primary} />
              <Text style={styles.infoBoxText}>Billing address mirrors your shipping address.</Text>
            </View>
          )}
        </View>

        {/* ── Emergency Contact ── */}
        <SectionHeader label="Emergency Contact" colors={colors} />
        <View style={[styles.sectionCard, { marginHorizontal: 20 }]}>
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIcon, { backgroundColor: colors.dangerLight }]}>
              <Users size={16} color={colors.danger} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Contact Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={extension.emergencyContactName}
                onChangeText={(v) => saveExtension({ emergencyContactName: v })}
                placeholder="Jane Doe"
                placeholderTextColor={colors.slateLighter}
                autoCapitalize="words"
                testID="emergency-contact-name"
              />
            </View>
          </View>
          <View style={styles.fieldDivider} />
          <View style={styles.fieldRow}>
            <View style={[styles.fieldIcon, { backgroundColor: colors.dangerLight }]}>
              <Phone size={16} color={colors.danger} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Contact Phone</Text>
              <TextInput
                style={styles.fieldInput}
                value={extension.emergencyContactPhone}
                onChangeText={(v) => saveExtension({ emergencyContactPhone: v })}
                placeholder="(555) 000-0000"
                placeholderTextColor={colors.slateLighter}
                keyboardType="phone-pad"
                testID="emergency-contact-phone"
              />
            </View>
          </View>
        </View>

        {/* ── Homeowner: Delivery Preferences ── */}
        {isHomeowner && (
          <>
            <SectionHeader label="Delivery Preferences" colors={colors} />
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={styles.sectionNote}>
                These instructions are shown to your delivery drivers and assigned Porch Partner.
              </Text>
              <View style={styles.sectionCard}>
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: '#FFF3E0' }]}>
                    <FileText size={16} color="#E65100" />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Delivery Instructions</Text>
                    <TextInput
                      style={[styles.fieldInput, styles.fieldInputMultiline]}
                      value={extension.deliveryInstructions}
                      onChangeText={(v) => saveExtension({ deliveryInstructions: v })}
                      placeholder='e.g. "Ring doorbell twice, leave at back step"'
                      placeholderTextColor={colors.slateLighter}
                      multiline
                      numberOfLines={3}
                      testID="delivery-instructions"
                    />
                  </View>
                </View>
                <View style={styles.fieldDivider} />
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: '#E8F5E9' }]}>
                    <Lock size={16} color="#2E7D32" />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Gate / Access Code</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={extension.accessCode}
                      onChangeText={(v) => saveExtension({ accessCode: v })}
                      placeholder='e.g. "#1234" (shared only with your assigned partner)'
                      placeholderTextColor={colors.slateLighter}
                      secureTextEntry={false}
                      testID="access-code"
                    />
                  </View>
                </View>
                <View style={styles.fieldDivider} />
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: colors.peach }]}>
                    <ShieldAlert size={16} color={colors.secondary} />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Safe Drop Notes</Text>
                    <TextInput
                      style={[styles.fieldInput, styles.fieldInputMultiline]}
                      value={extension.safeDropNotes}
                      onChangeText={(v) => saveExtension({ safeDropNotes: v })}
                      placeholder='e.g. "Behind the large planter on the right side of porch"'
                      placeholderTextColor={colors.slateLighter}
                      multiline
                      numberOfLines={2}
                      testID="safe-drop-notes"
                    />
                  </View>
                </View>
              </View>

              {/* Safe Drop Preference */}
              <Text style={styles.fieldSublabel}>Preferred Drop Location</Text>
              <ChipSelector
                options={SAFE_DROP_OPTIONS}
                selected={extension.safeDropPreference}
                onSelect={(pref) => saveExtension({ safeDropPreference: pref })}
                colors={colors}
              />

              {/* Delivery Window */}
              <Text style={[styles.fieldSublabel, { marginTop: 16 }]}>Preferred Delivery Window</Text>
              <ChipSelector
                options={WINDOW_OPTIONS}
                selected={extension.preferredDeliveryWindow}
                onSelect={(w) => saveExtension({ preferredDeliveryWindow: w })}
                colors={colors}
              />
            </View>
          </>
        )}

        {/* ── Porch Partner: Service Profile ── */}
        {isPartner && (
          <>
            <SectionHeader label="Porch Partner Profile" colors={colors} />
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={styles.sectionNote}>
                This information is used for ID verification, payout eligibility, and your public marketplace listing.
              </Text>
              <View style={styles.sectionCard}>
                {/* Legal Name */}
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: colors.skyBlue }]}>
                    <User size={16} color={colors.primary} />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Legal First Name (as on govt. ID)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={extension.legalFirstName}
                      onChangeText={(v) => saveExtension({ legalFirstName: v })}
                      placeholder="First name on your ID"
                      placeholderTextColor={colors.slateLighter}
                      autoCapitalize="words"
                      testID="legal-first-name"
                    />
                  </View>
                </View>
                <View style={styles.fieldDivider} />
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: colors.skyBlue }]}>
                    <User size={16} color={colors.primary} />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Legal Last Name</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={extension.legalLastName}
                      onChangeText={(v) => saveExtension({ legalLastName: v })}
                      placeholder="Last name on your ID"
                      placeholderTextColor={colors.slateLighter}
                      autoCapitalize="words"
                      testID="legal-last-name"
                    />
                  </View>
                </View>
                <View style={styles.fieldDivider} />
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: '#F3E5F5' }]}>
                    <Briefcase size={16} color="#6A1B9A" />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Business Name (optional)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={extension.businessName}
                      onChangeText={(v) => saveExtension({ businessName: v })}
                      placeholder="DBA / LLC name (if applicable)"
                      placeholderTextColor={colors.slateLighter}
                      autoCapitalize="words"
                      testID="business-name"
                    />
                  </View>
                </View>
                <View style={styles.fieldDivider} />
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: colors.skyBlue }]}>
                    <FileText size={16} color={colors.primary} />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Partner Bio</Text>
                    <TextInput
                      style={[styles.fieldInput, styles.fieldInputMultiline]}
                      value={extension.partnerBio}
                      onChangeText={(v) => saveExtension({ partnerBio: v })}
                      placeholder={`e.g. "Hi! I'm available daily 9–5, great with large packages."`}
                      placeholderTextColor={colors.slateLighter}
                      multiline
                      numberOfLines={3}
                      maxLength={200}
                      testID="partner-bio"
                    />
                    <Text style={styles.charCount}>{extension.partnerBio.length}/200</Text>
                  </View>
                </View>
              </View>

              {/* Volunteer toggle */}
              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: colors.successLight }]}>
                    <Gift size={16} color={colors.success} />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Hold Packages for Free</Text>
                    <Text style={styles.fieldHint}>Volunteer partners don't charge homeowners — community favor only</Text>
                  </View>
                  <Switch
                    value={extension.isVolunteer}
                    onValueChange={(v) => saveExtension({ isVolunteer: v })}
                    trackColor={{ false: colors.border, true: colors.success }}
                    ios_backgroundColor={colors.border}
                    testID="volunteer-toggle"
                  />
                </View>
              </View>

              {/* Accepted Package Sizes */}
              <Text style={styles.fieldSublabel}>Accepted Package Sizes</Text>
              <MultiChip
                options={PACKAGE_SIZE_OPTIONS}
                selected={extension.acceptedPackageSizes ?? ['small', 'medium', 'large']}
                onToggle={toggleAcceptedPackageSize}
                colors={colors}
              />

              {/* Service radius */}
              <Text style={[styles.fieldSublabel, { marginTop: 16 }]}>Service Radius</Text>
              <ChipSelector
                options={RADIUS_OPTIONS}
                selected={String(extension.serviceRadiusMiles)}
                onSelect={(r) => saveExtension({ serviceRadiusMiles: parseFloat(r) })}
                colors={colors}
              />

              {/* Max daily holds + service hours */}
              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: colors.successLight }]}>
                    <Package size={16} color={colors.success} />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Max Concurrent Holds</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={String(extension.maxDailyHolds)}
                      onChangeText={(v) => {
                        const n = parseInt(v, 10);
                        if (!isNaN(n) && n > 0 && n <= 50) saveExtension({ maxDailyHolds: n });
                      }}
                      keyboardType="number-pad"
                      placeholder="5"
                      placeholderTextColor={colors.slateLighter}
                      testID="max-daily-holds"
                    />
                  </View>
                </View>
                <View style={styles.fieldDivider} />
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: '#E3F2FD' }]}>
                    <Clock size={16} color="#1565C0" />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Availability / Hours</Text>
                    <TextInput
                      style={[styles.fieldInput, styles.fieldInputMultiline]}
                      value={extension.serviceHoursNotes}
                      onChangeText={(v) => saveExtension({ serviceHoursNotes: v })}
                      placeholder='e.g. "Weekdays 9am–5pm, some weekends"'
                      placeholderTextColor={colors.slateLighter}
                      multiline
                      numberOfLines={2}
                      testID="service-hours"
                    />
                  </View>
                </View>
              </View>

              {/* Tax Info */}
              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldIcon, { backgroundColor: '#FFF8E1' }]}>
                    <Banknote size={16} color="#F57F17" />
                  </View>
                  <View style={styles.fieldContent}>
                    <Text style={styles.fieldLabel}>Tax ID Last 4 digits (SSN / EIN)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={extension.taxIdLast4}
                      onChangeText={(v) => saveExtension({ taxIdLast4: v.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="Last 4 digits only"
                      placeholderTextColor={colors.slateLighter}
                      keyboardType="number-pad"
                      maxLength={4}
                      testID="tax-id-last4"
                    />
                  </View>
                </View>
              </View>
              <Text style={styles.taxNote}>
                Tax ID is stored locally only and used to pre-fill 1099 paperwork at year-end. Porchivo does not transmit or store your full SSN/EIN.
              </Text>
            </View>
          </>
        )}

        {/* ── Save ── */}
        <View style={styles.saveSection}>
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <TouchableOpacity
              style={[styles.saveButton, (!hasChanges() || isSaving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!hasChanges() || isSaving}
              activeOpacity={0.85}
              testID="edit-profile-save"
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Check size={18} color={colors.white} />
                  <Text style={styles.saveButtonText}>Save Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.saveNote}>
            Extended fields (shipping, billing, delivery preferences) save automatically as you type.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 60 },

    // Avatar
    avatarSection: {
      alignItems: 'center',
      paddingTop: 28,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    avatarWrapper: { position: 'relative', width: 96, height: 96, borderRadius: 48, marginBottom: 10 },
    avatarImage: { width: 96, height: 96, borderRadius: 48 },
    avatarPlaceholder: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
    },
    avatarInitial: { fontSize: 36, fontWeight: '700' as const, color: colors.white },
    cameraBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.secondary,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: colors.surface,
    },
    avatarHint: { fontSize: 13, color: colors.slateLighter, marginBottom: 10 },
    avatarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 12,
      marginTop: 4,
    },
    avatarActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
    },
    avatarActionBtnDanger: {
      backgroundColor: colors.dangerLight,
    },
    avatarActionText: {
      fontSize: 13,
      fontWeight: '600' as const,
    },
    roleBadgeRow: { flexDirection: 'row', justifyContent: 'center' },
    roleBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    roleBadgeText: { fontSize: 13, fontWeight: '600' as const },

    // Sections
    sectionNote: { fontSize: 13, color: colors.slateLight, lineHeight: 19, marginBottom: 10 },
    fieldSublabel: {
      fontSize: 13, fontWeight: '600' as const,
      color: colors.slate, marginTop: 12, marginBottom: 0,
    },
    charCount: { fontSize: 11, color: colors.slateLighter, marginTop: 2, textAlign: 'right' as const },
    taxNote: { fontSize: 12, color: colors.slateLighter, lineHeight: 17, marginTop: 8 },
    fieldHint: { fontSize: 12, color: colors.slateLight, lineHeight: 16, marginTop: 2 },

    // Cards
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
    },
    sectionCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    sectionCardIcon: {
      width: 28, height: 28, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    sectionCardTitle: {
      fontSize: 14, fontWeight: '600' as const, color: colors.slate,
    },

    // Fields
    fieldRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingVertical: 12, paddingHorizontal: 14,
    },
    fieldIcon: {
      width: 32, height: 32, borderRadius: 9,
      alignItems: 'center', justifyContent: 'center',
      marginRight: 12, marginTop: 2,
    },
    fieldContent: { flex: 1 },
    fieldLabel: {
      fontSize: 11, fontWeight: '600' as const,
      color: colors.slateLight,
      textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 3,
    },
    fieldInput: {
      fontSize: 15, color: colors.slate,
      paddingVertical: 2, paddingHorizontal: 0,
    },
    fieldInputMultiline: { minHeight: 44, textAlignVertical: 'top' as const },
    fieldDivider: { height: 1, backgroundColor: colors.borderLight, marginLeft: 58 },

    // Two-column layout for city/state/zip
    twoColRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingHorizontal: 14, paddingVertical: 12,
    },
    twoColDivider: { width: 1, backgroundColor: colors.borderLight, marginHorizontal: 12, marginTop: 18 },

    // Toggle
    toggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
    },
    toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    toggleLabel: { fontSize: 15, fontWeight: '500' as const, color: colors.slate },

    // Info box
    infoBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.skyBlue, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
    },
    infoBoxText: { flex: 1, fontSize: 13, color: colors.primary, fontWeight: '500' as const },

    // Save
    saveSection: { paddingHorizontal: 20, marginTop: 32 },
    saveButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    saveButtonDisabled: { backgroundColor: colors.slateLighter, shadowOpacity: 0, elevation: 0 },
    saveButtonText: { fontSize: 16, fontWeight: '600' as const, color: colors.white },
    saveNote: {
      fontSize: 12, color: colors.slateLighter, textAlign: 'center' as const,
      marginTop: 10, lineHeight: 17,
    },
  });
}
