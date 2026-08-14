/**
 * UpgradeScreen — Informational screen for HOA-provisioned model.
 *
 * No IAP, no paywall, no pricing. If a user is not yet connected to a
 * community, this screen explains that Porchivo access is provided by
 * their HOA or property manager.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Building2, Mail, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { palette } from '@/constants/theme';
import { SUPPORT } from '@/config/app';

export default function UpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.slate} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Building2 size={40} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Porchivo Access</Text>

        <Text style={styles.bodyText}>
          Porchivo access is provided by your homeowners association or property manager.
          Contact your community administrator for an invitation.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.subText}>
          If your community is not yet on Porchivo, have your HOA board or property
          manager visit porchivo.com to get started.
        </Text>

        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => Linking.openURL(`mailto:${SUPPORT.email}`).catch(() => {})}
          activeOpacity={0.85}
        >
          <Mail size={18} color="#FFFFFF" />
          <Text style={styles.contactBtnText}>Contact Support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.websiteBtn}
          onPress={() => Linking.openURL(SUPPORT.websiteUrl).catch(() => {})}
          activeOpacity={0.7}
        >
          <Text style={styles.websiteBtnText}>Visit porchivo.com</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.slate,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  bodyText: {
    fontSize: 16,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: Colors.borderLight,
    marginBottom: 24,
  },
  subText: {
    fontSize: 14,
    color: Colors.slateLighter,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  contactBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  websiteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  websiteBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
