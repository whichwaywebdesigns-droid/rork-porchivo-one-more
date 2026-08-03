import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FileText, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { LEGAL_EFFECTIVE_DATE } from '@/constants/legal';

/**
 * Full-screen blocking gate shown to already-onboarded users when the legal
 * version they previously accepted is older than the current LEGAL_VERSION.
 * Forces them to re-accept the updated Terms + Privacy Policy (recording a new
 * timestamped, versioned consent row) before they can keep using the app.
 */
export default function ConsentGate() {
  const Colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { needsReconsent, isOnboarded, session, recordConsentNow, signOut } = useApp();
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleAccept = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await recordConsentNow();
    if (!ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Could Not Save',
        'We could not record your acceptance. Check your connection and try again.'
      );
      setSubmitting(false);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitting(false);
  }, [submitting, recordConsentNow]);

  const handleDecline = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Decline Updated Terms?',
      'You must accept the updated Terms of Service and Privacy Policy to keep using Porchivo. Declining will sign you out.',
      [
        { text: 'Review Again', style: 'cancel' },
        {
          text: 'Decline & Sign Out',
          style: 'destructive',
          onPress: () => {
            void signOut();
          },
        },
      ]
    );
  }, [signOut]);

  // Only gate authenticated, fully-onboarded users with a stale acceptance.
  if (!needsReconsent || !session || isOnboarded !== true) return null;

  const styles = makeStyles(Colors);

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <View
        style={[
          styles.card,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={styles.iconWrap}>
          <ShieldCheck size={30} color={Colors.white} />
        </View>
        <Text style={styles.title}>We&apos;ve updated our terms</Text>
        <Text style={styles.subtitle}>
          Our Terms of Service and Privacy Policy changed, effective {LEGAL_EFFECTIVE_DATE}.
          Please review and accept to continue using Porchivo.
        </Text>

        <ScrollView
          style={styles.linksScroll}
          contentContainerStyle={styles.linksContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>
              The update clarifies that Porchivo does not vet or background-check users,
              and that you assume the risks of in-person, neighbor-to-neighbor
              interactions — including any personal injury or property damage.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => router.push('/terms-of-service' as any)}
          >
            <FileText size={18} color={Colors.primary} />
            <Text style={styles.linkText}>Review Terms of Service</Text>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => router.push('/privacy-policy' as any)}
          >
            <FileText size={18} color={Colors.primary} />
            <Text style={styles.linkText}>Review Privacy Policy</Text>
            <ChevronRight size={18} color={Colors.slateLighter} />
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={[styles.acceptBtn, submitting && styles.acceptBtnDisabled]}
          activeOpacity={0.88}
          onPress={handleAccept}
          disabled={submitting}
          testID="reconsent-accept"
        >
          <Text style={styles.acceptText}>
            {submitting ? 'Saving…' : 'I Agree & Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.declineBtn}
          activeOpacity={0.7}
          onPress={handleDecline}
          disabled={submitting}
        >
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(Colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    overlay: {
      backgroundColor: Colors.background,
      zIndex: 9999,
    },
    card: {
      flex: 1,
      paddingHorizontal: 24,
      alignItems: 'center',
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    title: {
      fontSize: 24,
      fontWeight: '700' as const,
      color: Colors.slate,
      textAlign: 'center',
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: Colors.slateLight,
      textAlign: 'center',
      marginBottom: 20,
    },
    linksScroll: {
      alignSelf: 'stretch',
      flex: 1,
    },
    linksContent: {
      paddingBottom: 8,
    },
    highlightBox: {
      backgroundColor: Colors.peach,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    highlightText: {
      fontSize: 14,
      lineHeight: 21,
      color: Colors.slate,
      fontWeight: '500' as const,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    linkText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600' as const,
      color: Colors.slate,
    },
    acceptBtn: {
      alignSelf: 'stretch',
      backgroundColor: Colors.primary,
      borderRadius: 16,
      paddingVertical: 17,
      alignItems: 'center',
      marginTop: 8,
    },
    acceptBtnDisabled: {
      opacity: 0.7,
    },
    acceptText: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: Colors.white,
    },
    declineBtn: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    declineText: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: Colors.slateLighter,
    },
  });
}
