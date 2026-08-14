/**
 * BillingScreen — Informational screen for HOA-provisioned model.
 *
 * No subscription management needed. Access is provisioned by the HOA.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Building2, ArrowLeft, Mail, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SUPPORT } from '@/config/app';

export default function BillingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.slate} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>My Plan</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Building2 size={40} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Community-Provided Access</Text>

        <Text style={styles.bodyText}>
          Your Porchivo access is provided and managed by your homeowners association
          or property management company. There are no subscriptions, upgrades, or
          in-app purchases.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Plan</Text>
          <Text style={styles.infoValue}>Community Plan — Full Access</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Provided by</Text>
          <Text style={styles.infoValue}>Your HOA or Property Manager</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValueActive}>Active</Text>
        </View>

        <Text style={styles.subText}>
          Questions about your community's Porchivo plan? Contact your community
          administrator or our support team.
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
          <ExternalLink size={14} color={Colors.primary} />
          <Text style={styles.websiteBtnText}>Visit porchivo.com</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.slate,
  },
  topBarSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.slate,
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  bodyText: {
    fontSize: 15,
    color: Colors.slateLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.slateLight,
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.slate,
    fontWeight: '600' as const,
  },
  infoValueActive: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: '700' as const,
  },
  subText: {
    fontSize: 14,
    color: Colors.slateLighter,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 24,
    marginBottom: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  websiteBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
