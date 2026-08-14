import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { MapPin, Mail, Phone, Home, Shield, Bell, UserPlus, ChevronRight, FileText, Pencil, Send, LogOut, HelpCircle, CheckCircle, Trash2, Moon, Sun, ArrowRight, Handshake, BookOpen, Star, Building2, MailOpen } from 'lucide-react-native';
import { sendSMSInvite } from '@/utils/invite';
import { COPY } from '@/config/copy';
import { useColors, getColors } from '@/constants/colors';
import { useTheme } from '@/store/ThemeContext';
import { useApp } from '@/store/AppContext';
import { UserRole } from '@/types';
import { useRouter } from 'expo-router';
import { useOrganization } from '@/store/OrganizationContext';
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

export default function ProfileScreen() {
  const {
    user,
    updateRole,
    setLocationConsent,
    signOut,
    deleteAccount,
  } = useApp();
  const { isOrgMember } = useOrganization();
  // Dynamic colors — override static module-level Colors
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const Colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();
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
      <Stack.Screen options={{ title: 'Account' }} />

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

      {/* Join Your Community — shown to free users (no HOA connection) */}
      {!isOrgMember && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.slateLighter }]}>Join Your Community</Text>
          <View style={[styles.infoCard, { backgroundColor: Colors.surface }]}>
            <View style={[styles.communityCTAIcon, { backgroundColor: Colors.primary + '18' }]}>
              <Building2 size={24} color={Colors.primary} />
            </View>
            <Text style={[styles.communityHeadline, { color: Colors.slate }]}>
              Your community may already be on Porchivo.
            </Text>
            <Text style={[styles.communityBody, { color: Colors.slateLight }]}>
              If your HOA, condo association, or property manager uses Porchivo, ask them to send you an invitation. Once you accept, you'll get access to announcements, dues payments, documents, maintenance requests, and more — at no cost to you.
            </Text>
            <TouchableOpacity
              style={[styles.communityBtn, { backgroundColor: Colors.primary }]}
              onPress={() => router.push('/join-community' as any)}
              activeOpacity={0.85}
              testID="enter-invitation-code"
            >
              <MailOpen size={16} color="#fff" />
              <Text style={styles.communityBtnText}>Enter Invitation Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.communitySecondary, { borderColor: Colors.border }]}
              onPress={() => void Linking.openURL('mailto:support@porchivo.com?subject=Request%20Community%20Invitation')}
              activeOpacity={0.7}
            >
              <Text style={[styles.communitySecondaryText, { color: Colors.slateLight }]}>
                Request an Invitation
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
            { backgroundColor: Colors.surface },
            user.role === 'partner' && styles.roleCardActive,
          ]}
          onPress={() => handleRoleChange('partner')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleCardIcon, { backgroundColor: '#F0FDF4' }]}>
            <Handshake size={20} color={Colors.success} />
          </View>
          <View style={styles.roleCardBody}>
            <Text style={[styles.roleCardTitle, { color: Colors.slate }]}>Porch Partner</Text>
            <Text style={[styles.roleCardDesc, { color: Colors.slateLight }]}>Hold packages for neighbors and help your community.</Text>
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
            <Text style={[styles.roleCardDesc, { color: Colors.slateLight }]}>Protect your own packages and help neighbors at the same time.</Text>
          </View>
          <View style={[styles.roleCardCheck, user.role === 'both' && styles.roleCardCheckActive]}>
            {user.role === 'both' && <CheckCircle size={16} color={Colors.primary} />}
          </View>
        </TouchableOpacity>
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
  roleCardCheck: {
    width: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  roleCardCheckActive: {},
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
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.slateLighter,
    marginTop: 12,
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
  // Join Your Community styles
  communityCTAIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 14,
  },
  communityHeadline: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 22,
    marginBottom: 8,
  },
  communityBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  communityBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  communityBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  communitySecondary: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center' as const,
  },
  communitySecondaryText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
});
