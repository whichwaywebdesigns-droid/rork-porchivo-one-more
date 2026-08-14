import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Linking, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { MapPin, Mail, Phone, Home, Shield, Bell, UserPlus, ChevronRight, FileText, Pencil, Send, LogOut, HelpCircle, CheckCircle, Trash2, Crown, Music, ShieldCheck, Gift, RefreshCw, CreditCard, Moon, Sun, BadgeDollarSign, ArrowRight, Handshake, BookOpen, Star } from 'lucide-react-native';
import { sendSMSInvite } from '@/utils/invite';
import { COPY } from '@/config/copy';
import { useColors, getColors } from '@/constants/colors';
import { useTheme } from '@/store/ThemeContext';
import { useApp } from '@/store/AppContext';
import { UserRole } from '@/types';
import { useRouter } from 'expo-router';
import { usePaywall } from '@/store/PaywallContext';
import { PAYWALL_TRIGGERS } from '@/lib/tiers';
import { isEnabled } from '@/lib/featureFlags';
import { manualRequestReview } from '@/lib/storeReview';
import { log } from "@/lib/logger";

// Static light-mode colors for module-level StyleSheet
const Colors = getColors(false);

const showPorchPartners = isEnabled('PORCH_PARTNERS');

const roleOptions: { key: UserRole; label: string }[] = [
  { key: 'homeowner', label: 'Homeowner' },
  { key: 'partner', label: 'Porch Partner' },
  { key: 'both', label: 'Both' },
];

const CHIMES: { id: string; label: string }[] = [
  { id: 'default', label: 'Classic' },
  { id: 'doorbell', label: 'Doorbell' },
  { id: 'chime', label: 'Soft Chime' },
  { id: 'alert', label: 'Alert Pulse' },
];

export default function ProfileScreen() {
  const {
    user,
    updateRole,
    setLocationConsent,
    signOut,
    deleteAccount,
    tier,
    capabilities,
    chimeId,
    setChime,
    theftShieldEnabled,
    setTheftShield,
    referralCreditUntil,
    restorePurchase,
  } = useApp();
  const { guardPremiumAccess } = usePaywall();
  // Dynamic colors — override static module-level Colors
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const Colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const [restoring, setRestoring] = React.useState<boolean>(false);

  const handleRestore = React.useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const ok = await restorePurchase();
      if (ok) {
        Alert.alert('Restored', 'Your previous purchase has been restored.');
      } else {
        Alert.alert('No Purchase Found', 'We couldn\u2019t find a previous purchase on this account.');
      }
    } catch (err) {
      log('[Profile] Restore error:', err);
      Alert.alert('Restore Failed', 'Something went wrong. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [restoring, restorePurchase]);

  const handleManageSubscription = React.useCallback(() => {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : Platform.OS === 'android'
        ? 'https://play.google.com/store/account/subscriptions'
        : 'https://apps.apple.com/account/subscriptions';
    void Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open the link.'));
  }, []);
  const router = useRouter();
  const [chimePickerOpen, setChimePickerOpen] = React.useState<boolean>(false);
  const [inviting, setInviting] = React.useState(false);

  const handleInvite = React.useCallback(async () => {
    if (!user || inviting) return;
    setInviting(true);
    log('[Profile] Sending invite');
    try {
      await sendSMSInvite(user.name, user.id);
    } finally {
      setInviting(false);
    }
  }, [user, inviting]);

  const handleRoleChange = useCallback((role: UserRole) => {
    updateRole(role);
    log('[Profile] Role changed to:', role);
  }, [updateRole]);

  const handleLocationToggle = useCallback(() => {
    const newVal = !user?.hasLocationConsent;
    setLocationConsent(newVal);
  }, [user?.hasLocationConsent, setLocationConsent]);

  if (!user) return null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: Colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{
        title: 'Profile',
      }} />

      <View style={[styles.avatarSection, { backgroundColor: Colors.surface }]}>
        <TouchableOpacity style={styles.avatarTouchable} onPress={() => router.push('/edit-profile' as any)} activeOpacity={0.8}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name?.[0] ?? '?'}</Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Pencil size={11} color={Colors.white} />
          </View>
        </TouchableOpacity>
        <Text style={[styles.name, { color: Colors.slate }]}>{user.name}</Text>
        <View style={styles.rolePill}>
          <Shield size={12} color={Colors.primary} />
          <Text style={[styles.roleText, { color: Colors.primary }]}>
            {!showPorchPartners ? 'Homeowner' : user.role === 'both' ? 'Homeowner & Partner' : user.role === 'homeowner' ? 'Homeowner' : 'Porch Partner'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>Subscription</Text>
        <View style={[styles.infoCard, { backgroundColor: Colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Crown size={18} color={tier === 'free' ? Colors.slateLight : '#C8941E'} />
              <View>
                <Text style={[styles.settingText, { color: Colors.slate }]}>
                  {tier === 'lifetime' ? 'Lifetime' : tier === 'family' ? 'Family Plan' : tier === 'premium' ? 'Premium' : 'Free Plan'}
                </Text>
                {referralCreditUntil && Date.now() < referralCreditUntil && (
                  <Text style={styles.referralText}>Referral credit active</Text>
                )}
              </View>
            </View>
            {tier === 'free' ? (
              <TouchableOpacity
                style={styles.upgradePill}
                onPress={() => {
                  // C-3: route through guardPremiumAccess with a real
                  // PAYWALL_TRIGGERS value so the placement passed to Superwall
                  // is a configured campaign, not a dead 'remove_ads_upgrade'.
                  guardPremiumAccess({ trigger: PAYWALL_TRIGGERS.manual });
                }}
                activeOpacity={0.85}
                testID="open-upgrade"
              >
                <Text style={styles.upgradePillText}>Upgrade</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Active</Text>
              </View>
            )}
          </View>

          {capabilities.theftShield && (
            <>
              <View style={styles.infoRowDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <ShieldCheck size={18} color={Colors.primary} />
                  <Text style={[styles.settingText, { color: Colors.slate }]}>Theft Shield</Text>
                </View>
                <Switch
                  value={theftShieldEnabled}
                  onValueChange={(v) => void setTheftShield(v)}
                  trackColor={{ false: Colors.border, true: Colors.success }}
                  thumbColor={Colors.white}
                />
              </View>
            </>
          )}

          {capabilities.customChimes && (
            <>
              <View style={styles.infoRowDivider} />
              <TouchableOpacity style={styles.settingRow} onPress={() => setChimePickerOpen((p) => !p)} activeOpacity={0.7}>
                <View style={styles.settingLeft}>
                  <Music size={18} color={Colors.primary} />
                  <Text style={[styles.settingText, { color: Colors.slate }]}>Delivery Chime</Text>
                </View>
                <View style={styles.chimeRight}>
                  <Text style={styles.chimeValue}>{CHIMES.find((c) => c.id === chimeId)?.label ?? 'Classic'}</Text>
                  <ChevronRight size={16} color={Colors.slateLighter} style={{ transform: [{ rotate: chimePickerOpen ? '90deg' : '0deg' }] }} />
                </View>
              </TouchableOpacity>
              {chimePickerOpen && (
                <View style={styles.chimeList}>
                  {CHIMES.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chimeOption, chimeId === c.id && styles.chimeOptionActive]}
                      onPress={() => { void setChime(c.id); setChimePickerOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chimeOptionText, chimeId === c.id && styles.chimeOptionTextActive]}>
                        {c.label}
                      </Text>
                      {chimeId === c.id && <CheckCircle size={14} color={Colors.success} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          <View style={styles.infoRowDivider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/referral' as any)}
            activeOpacity={0.7}
            testID="referral-row"
          >
            <View style={styles.settingLeft}>
              <Gift size={18} color={Colors.secondary} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>Invite friend, get 1 month free</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>

          <View style={styles.infoRowDivider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleRestore}
            disabled={restoring}
            activeOpacity={0.7}
            testID="restore-purchases"
          >
            <View style={styles.settingLeft}>
              <RefreshCw size={18} color={Colors.primary} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>{restoring ? 'Restoring\u2026' : 'Restore Purchases'}</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>

          {tier !== 'free' && (
            <>
              <View style={styles.infoRowDivider} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => router.push('/billing' as any)}
                activeOpacity={0.7}
                testID="manage-plan"
              >
                <View style={styles.settingLeft}>
                  <CreditCard size={18} color={'#C8941E'} />
                  <View>
                    <Text style={[styles.settingText, { color: Colors.slate }]}>Manage Plan</Text>
                    <Text style={[styles.settingText, { fontSize: 11, color: Colors.slateLighter, marginTop: 1 }]}>
                      {tier === 'lifetime' ? 'Lifetime Member' : tier === 'family' ? 'Family Plan' : tier === 'enterprise' ? 'HOA Enterprise' : 'Premium Active'}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={Colors.slateLighter} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.subDisclosure}>
          {Platform.OS === 'android'
            ? 'Subscriptions are billed through Google Play and auto-renew unless canceled at least 24 hours before the end of the current period. Manage or cancel in Google Play \u203A Payments & subscriptions.'
            : 'Subscriptions are billed through your Apple ID and auto-renew unless canceled at least 24 hours before the end of the current period. Manage or cancel in Settings \u203A Apple ID \u203A Subscriptions.'}
        </Text>

        {/* Annual upsell nudge — shown to premium (monthly) users */}
        {tier === 'premium' && (
          <TouchableOpacity
            style={styles.annualUpsellCard}
            onPress={() => router.push('/upgrade?trigger=manual' as any)}
            activeOpacity={0.88}
            testID="annual-upsell-nudge"
          >
            <Crown size={15} color="#C8941E" />
            <View style={styles.annualUpsellText}>
              <Text style={styles.annualUpsellTitle}>Save 33\u202F— switch to Annual</Text>
              <Text style={styles.annualUpsellSub}>$79.99/yr \u00B7 $6.67/mo \u00B7 same Premium features</Text>
            </View>
            <ArrowRight size={14} color="#C8941E" />
          </TouchableOpacity>
        )}
      </View>

      {showPorchPartners && (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>Your Role</Text>

        {/* Homeowner card */}
        <TouchableOpacity
          style={[
            styles.roleCard,
            { backgroundColor: Colors.surface },
            user.role === 'homeowner' && styles.roleCardActive,
          ]}
          onPress={() => handleRoleChange('homeowner')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleCardIcon, { backgroundColor: Colors.skyBlue }]}>
            <Home size={20} color={Colors.primary} />
          </View>
          <View style={styles.roleCardBody}>
            <Text style={[styles.roleCardTitle, { color: Colors.slate }]}>Homeowner</Text>
            <Text style={[styles.roleCardDesc, { color: Colors.slateLight }]}>Track packages, get theft alerts, and set a safe drop-off preference.</Text>
          </View>
          <View style={[styles.roleCardCheck, user.role === 'homeowner' && styles.roleCardCheckActive]}>
            {user.role === 'homeowner' && <CheckCircle size={16} color={Colors.primary} />}
          </View>
        </TouchableOpacity>

        {/* Porch Partner card */}
        <TouchableOpacity
          style={[
            styles.roleCard,
            styles.roleCardPartner,
            { backgroundColor: Colors.surface },
            user.role === 'partner' && styles.roleCardActive,
          ]}
          onPress={() => handleRoleChange('partner')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleCardIcon, { backgroundColor: '#F0FDF4' }]}>
            <BadgeDollarSign size={20} color={Colors.success} />
          </View>
          <View style={styles.roleCardBody}>
            <Text style={[styles.roleCardTitle, { color: Colors.slate }]}>Porch Partner</Text>
            <Text style={[styles.roleCardDesc, { color: Colors.slateLight }]}>Hold packages for neighbors and earn <Text style={styles.roleCardEarnings}>$80–$250/mo</Text> — flexible, on your schedule.</Text>
          </View>
          <View style={[styles.roleCardCheck, user.role === 'partner' && styles.roleCardCheckActive]}>
            {user.role === 'partner' && <CheckCircle size={16} color={Colors.primary} />}
          </View>
        </TouchableOpacity>

        {/* Both card */}
        <TouchableOpacity
          style={[
            styles.roleCard,
            { backgroundColor: Colors.surface },
            user.role === 'both' && styles.roleCardActive,
          ]}
          onPress={() => handleRoleChange('both')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleCardIcon, { backgroundColor: '#FEF9EC' }]}>
            <Handshake size={20} color='#C8941E' />
          </View>
          <View style={styles.roleCardBody}>
            <Text style={[styles.roleCardTitle, { color: Colors.slate }]}>Both</Text>
            <Text style={[styles.roleCardDesc, { color: Colors.slateLight }]}>Protect your own packages and earn money helping neighbors at the same time.</Text>
          </View>
          <View style={[styles.roleCardCheck, user.role === 'both' && styles.roleCardCheckActive]}>
            {user.role === 'both' && <CheckCircle size={16} color={Colors.primary} />}
          </View>
        </TouchableOpacity>

        {/* Partner upsell CTA — shown only when user is homeowner-only */}
        {user.role === 'homeowner' && (
          <TouchableOpacity
            style={styles.partnerCta}
            onPress={() => router.push('/partner-onboarding' as any)}
            activeOpacity={0.85}
            testID="become-partner-cta"
          >
            <BadgeDollarSign size={15} color={Colors.success} />
            <Text style={styles.partnerCtaText}>See how Porch Partners earn $3–$25 per hold</Text>
            <ArrowRight size={14} color={Colors.success} />
          </TouchableOpacity>
        )}

        {/* Payout setup — shown for active partners */}
        {(user.role === 'partner' || user.role === 'both') && (
          <TouchableOpacity
            style={styles.payoutSetupCard}
            onPress={() => router.push('/partner-payout-setup' as any)}
            activeOpacity={0.85}
            testID="payout-setup-cta"
          >
            <BadgeDollarSign size={15} color={Colors.success} />
            <View style={styles.annualUpsellText}>
              <Text style={styles.payoutSetupTitle}>Set up payout account</Text>
              <Text style={styles.payoutSetupSub}>Earn $5–25 per hold · deposited via Stripe</Text>
            </View>
            <ArrowRight size={14} color={Colors.success} />
          </TouchableOpacity>
        )}
      </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>Contact Info</Text>
          <TouchableOpacity onPress={() => router.push('/edit-profile' as any)} hitSlop={8}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.infoCard, { backgroundColor: Colors.surface }]}>
          <View style={styles.infoRow}>
            <Mail size={18} color={Colors.slateLight} />
            <Text style={[styles.infoText, { color: Colors.slate }]}>{user.email}</Text>
          </View>
          <View style={styles.infoRowDivider} />
          <View style={styles.infoRow}>
            <Phone size={18} color={Colors.slateLight} />
            <Text style={[styles.infoText, { color: Colors.slate }]}>{user.phone}</Text>
          </View>
          <View style={styles.infoRowDivider} />
          <View style={styles.infoRow}>
            <Home size={18} color={Colors.slateLight} />
            <Text style={[styles.infoText, { color: Colors.slate }]}>{user.address}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>Settings</Text>
        <View style={[styles.infoCard, { backgroundColor: Colors.surface }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <MapPin size={18} color={Colors.primary} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>Location Access</Text>
            </View>
            <Switch
              value={user.hasLocationConsent}
              onValueChange={handleLocationToggle}
              trackColor={{ false: Colors.border, true: Colors.success }}
              thumbColor={Colors.white}
              accessibilityLabel="Toggle location access"
            />
          </View>

          <View style={[styles.infoRowDivider, { backgroundColor: Colors.borderLight }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              {isDark ? <Moon size={18} color={Colors.primary} /> : <Sun size={18} color={Colors.primary} />}
              <Text style={[styles.settingText, { color: Colors.slate }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => void toggleTheme()}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
              accessibilityLabel="Toggle dark mode"
            />
          </View>

          <View style={[styles.infoRowDivider, { backgroundColor: Colors.borderLight }]} />

          <TouchableOpacity style={styles.settingRow} onPress={() => void Linking.openSettings()}>
            <View style={styles.settingLeft}>
              <Bell size={18} color={Colors.primary} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>Push Notifications</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>

          <View style={styles.infoRowDivider} />

          <TouchableOpacity style={styles.settingRow} onPress={handleInvite} disabled={inviting}>
            <View style={styles.settingLeft}>
              <UserPlus size={18} color={Colors.primary} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>{inviting ? 'Sending...' : 'Invite Neighbors'}</Text>
            </View>
            <Send size={16} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.infoRowDivider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/how-it-works' as any)} testID="how-it-works-row">
            <View style={styles.settingLeft}>
              <HelpCircle size={18} color={Colors.primary} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>How It Works</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>

          <View style={styles.infoRowDivider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/field-guide' as any)} testID="field-guide-row">
            <View style={styles.settingLeft}>
              <BookOpen size={18} color={Colors.primary} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>The Porchivo Field Guide</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>

          <View style={styles.infoRowDivider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => void manualRequestReview()} testID="rate-app-row">
            <View style={styles.settingLeft}>
              <Star size={18} color={Colors.gold} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>Rate Porchivo</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>Legal & Policies</Text>
        <View style={[styles.infoCard, { backgroundColor: Colors.surface }]}>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/privacy-policy' as any)}>
            <View style={styles.settingLeft}>
              <FileText size={18} color={Colors.slateLight} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>Privacy Policy</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
          <View style={styles.infoRowDivider} />
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/terms-of-service' as any)}>
            <View style={styles.settingLeft}>
              <FileText size={18} color={Colors.slateLight} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>Terms of Service</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
          <View style={styles.infoRowDivider} />
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/community-guidelines' as any)}>
            <View style={styles.settingLeft}>
              <FileText size={18} color={Colors.slateLight} />
              <Text style={[styles.settingText, { color: Colors.slate }]}>Community Guidelines</Text>
            </View>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.supportButton}
          onPress={() => {
            Alert.alert(
              'Help & Support',
              'Contact us at support@porchivo.com',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Email Support', onPress: () => void Linking.openURL('mailto:support@porchivo.com?subject=Porchivo%20Support') },
              ]
            );
          }}
        >
          <Text style={styles.supportText}>Help & Support</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await signOut();
                      log('[Profile] Signed out successfully');
                      router.replace('/welcome' as any);
                    } catch (err) {
                      log('[Profile] Sign out error:', err);
                      Alert.alert('Error', 'Could not sign out. Please try again.');
                    }
                  },
                },
              ]
            );
          }}
          activeOpacity={0.8}
          testID="sign-out-btn"
        >
          <LogOut size={18} color={Colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={() => router.push('/delete-account' as any)}
          activeOpacity={0.8}
          testID="delete-account-btn"
        >
          <Trash2 size={18} color={Colors.danger} />
          <View style={styles.deleteAccountTextWrapper}>
            <Text style={styles.deleteAccountText}>{COPY.deleteAccount.menuLabel}</Text>
            <Text style={styles.deleteAccountSubtext}>{COPY.deleteAccount.menuSubtext}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.versionText}>Porchivo v1.0.6</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: getColors(false).background,
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: Colors.white,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  name: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 6,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.skyBlue,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slateLight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sectionTitleNoMargin: {
    marginBottom: 0,
  },
  roleCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  roleCardPartner: {
    // no additional defaults — just used as a tag for future specificity
  },
  roleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.skyBlue,
  },
  roleCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  roleCardBody: {
    flex: 1,
    gap: 2,
  },
  roleCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  roleCardDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  roleCardEarnings: {
    fontWeight: '700' as const,
    color: Colors.success,
  },
  roleCardCheck: {
    width: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  roleCardCheckActive: {
    // active state handled inline
  },
  partnerCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 2,
  },
  partnerCtaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  infoRowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 44,
  },
  infoText: {
    fontSize: 15,
    color: Colors.slate,
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingText: {
    fontSize: 15,
    color: Colors.slate,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.borderLight,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: Colors.success,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  supportButton: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  supportText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  subDisclosure: {
    marginTop: 10,
    fontSize: 11,
    color: Colors.slateLighter,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.slateLighter,
    marginTop: 12,
  },
  upgradePill: {
    backgroundColor: '#1D4F91',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  upgradePillText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  activePill: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activePillText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  referralText: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  chimeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chimeValue: {
    fontSize: 13,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  chimeList: {
    paddingVertical: 4,
    paddingBottom: 10,
  },
  chimeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginHorizontal: 10,
    borderRadius: 10,
  },
  chimeOptionActive: {
    backgroundColor: Colors.successLight,
  },
  chimeOptionText: {
    fontSize: 14,
    color: Colors.slate,
  },
  chimeOptionTextActive: {
    fontWeight: '600' as const,
    color: Colors.success,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 12,
  },
  deleteAccountTextWrapper: {
    flex: 1,
    gap: 2,
  },
  deleteAccountText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#E5484D',
  },
  deleteAccountSubtext: {
    fontSize: 11,
    color: Colors.slateLighter,
    lineHeight: 14,
  },
  // Annual upsell nudge (shown to premium/monthly users)
  annualUpsellCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#FFF8E6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F4E2A8',
    shadowColor: '#C8941E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  annualUpsellText: {
    flex: 1,
  },
  annualUpsellTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#C8941E',
    letterSpacing: -0.1,
  },
  annualUpsellSub: {
    fontSize: 11,
    color: '#A07018',
    marginTop: 2,
    fontWeight: '500' as const,
  },

  // Partner payout setup card
  payoutSetupCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    shadowColor: '#1E9C6A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  payoutSetupTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#15803D',
    letterSpacing: -0.1,
  },
  payoutSetupSub: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    fontWeight: '500' as const,
  },
});
