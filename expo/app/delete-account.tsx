import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle2, XCircle, ChevronLeft, Trash2 } from 'lucide-react-native';
import { useApp } from '@/store/AppContext';
import { useColors } from '@/constants/colors';
import { useTheme } from '@/store/ThemeContext';
import { COPY } from '@/config/copy';
import { log } from '@/lib/logger';

type Step = 'info' | 'confirm' | 'success' | 'error';

export default function DeleteAccountScreen() {
  const { user, deleteAccount } = useApp();
  const Colors = useColors();
  const { isDark } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<Step>('info');
  const [confirmText, setConfirmText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const c = COPY.deleteAccount;

  const handleDelete = useCallback(async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') return;
    setLoading(true);
    try {
      await deleteAccount();
      setStep('success');
    } catch (err) {
      log('[DeleteAccount] Deletion error:', err);
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [confirmText, deleteAccount]);

  const handleBackToProfile = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile' as any);
    }
  }, [router]);

  const textColor = isDark ? Colors.slate : Colors.slate;
  const mutedColor = Colors.slateLighter;

  const bullet = (txt: string) => (
    <View style={styles.bulletRow} key={txt}>
      <View style={[styles.bullet, { backgroundColor: Colors.slateLighter }]} />
      <Text style={[styles.bulletText, { color: textColor }]}>{txt}</Text>
    </View>
  );

  const footerInfo = () => (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: mutedColor }]}>
        Questions? Contact{' '}
        <Text
          style={[styles.footerLink, { color: Colors.primary }]}
          onPress={() => Linking.openURL('mailto:support@porchivo.com')}
        >
          support@porchivo.com
        </Text>
      </Text>
    </View>
  );

  const renderInfo = () => (
    <View style={styles.content}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.dangerLight }]}>
        <Trash2 size={32} color={Colors.danger} />
      </View>
      <Text style={[styles.title, { color: textColor }]}>{c.infoTitle}</Text>
      <Text style={[styles.body, { color: textColor }]}>{c.infoBody}</Text>

      <Text style={[styles.subhead, { color: textColor }]}>{c.infoWhatHappensHeader}</Text>
      {c.infoWhatHappens.map(bullet)}

      <Text style={[styles.subhead, { color: textColor }]}>{c.infoWhatStaysHeader}</Text>
      <Text style={[styles.body, { color: textColor }]}>{c.infoWhatStays}</Text>

      <View style={[styles.importantBox, { backgroundColor: Colors.peach, borderColor: Colors.secondary }]}>
        <AlertTriangle size={18} color={Colors.secondary} />
        <Text style={[styles.importantText, { color: textColor }]}>{c.infoImportant}</Text>
      </View>

      <View style={styles.buttonStack}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: Colors.danger }]}
          onPress={() => setStep('confirm')}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: Colors.white }]}>{c.infoContinueCta}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textButton}
          onPress={handleBackToProfile}
          activeOpacity={0.8}
        >
          <Text style={[styles.textButtonText, { color: Colors.primary }]}>{c.infoBackCta}</Text>
        </TouchableOpacity>
      </View>
      {footerInfo()}
    </View>
  );

  const renderConfirm = () => (
    <View style={styles.content}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.dangerLight }]}>
        <AlertTriangle size={32} color={Colors.danger} />
      </View>
      <Text style={[styles.title, { color: textColor }]}>{c.confirmTitle}</Text>
      <Text style={[styles.body, { color: textColor }]}>{c.confirmBody}</Text>
      <Text style={[styles.detail, { color: textColor }]}>
        {c.confirmDetail(user?.email ?? 'this account')}
      </Text>
      <Text style={[styles.restore, { color: mutedColor }]}>{c.confirmRestore}</Text>

      <Text style={[styles.inputLabel, { color: textColor }]}>{c.confirmInputLabel}</Text>
      <TextInput
        style={[styles.input, { borderColor: Colors.border, color: textColor, backgroundColor: Colors.surface }]}
        value={confirmText}
        onChangeText={setConfirmText}
        placeholder={c.confirmInputPlaceholder}
        placeholderTextColor={mutedColor}
        autoCapitalize="characters"
        autoCorrect={false}
        testID="delete-account-confirm-input"
      />

      <View style={styles.buttonStack}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: Colors.danger },
            (confirmText.trim().toUpperCase() !== 'DELETE' || loading) && { opacity: 0.5 },
          ]}
          onPress={handleDelete}
          disabled={confirmText.trim().toUpperCase() !== 'DELETE' || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: Colors.white }]}>{c.confirmCta}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textButton}
          onPress={handleBackToProfile}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={[styles.textButtonText, { color: Colors.primary }]}>{c.confirmCancelCta}</Text>
        </TouchableOpacity>
      </View>
      {footerInfo()}
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.content}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.successLight }]}>
        <CheckCircle2 size={32} color={Colors.success} />
      </View>
      <Text style={[styles.title, { color: textColor }]}>{c.successTitle}</Text>
      <Text style={[styles.body, { color: textColor }]}>{c.successBody(user?.email ?? 'this account')}</Text>
      <Text style={[styles.restore, { color: mutedColor }]}>{c.successRestore}</Text>

      <View style={styles.buttonStack}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: Colors.primary }]}
          onPress={() => router.replace('/welcome' as any)}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: Colors.white }]}>{c.successDoneCta}</Text>
        </TouchableOpacity>
      </View>
      {footerInfo()}
    </View>
  );

  const renderError = () => (
    <View style={styles.content}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.dangerLight }]}>
        <XCircle size={32} color={Colors.danger} />
      </View>
      <Text style={[styles.title, { color: textColor }]}>{c.errorTitle}</Text>
      <Text style={[styles.body, { color: textColor }]}>{c.errorBody}</Text>
      <Text style={[styles.restore, { color: mutedColor }]}>{c.errorSupport}</Text>

      <View style={styles.buttonStack}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: Colors.primary }]}
          onPress={() => setStep('confirm')}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: Colors.white }]}>{c.errorRetryCta}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textButton}
          onPress={handleBackToProfile}
          activeOpacity={0.8}
        >
          <Text style={[styles.textButtonText, { color: Colors.primary }]}>{c.errorCancelCta}</Text>
        </TouchableOpacity>
      </View>
      {footerInfo()}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Delete Account',
          headerLeft: () => (
            <TouchableOpacity onPress={handleBackToProfile} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.slate} />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.slate,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'info' && renderInfo()}
        {step === 'confirm' && renderConfirm()}
        {step === 'success' && renderSuccess()}
        {step === 'error' && renderError()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  subhead: {
    fontSize: 16,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginTop: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    width: '100%',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  importantBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 24,
  },
  importantText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 10,
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  restore: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 24,
  },
  buttonStack: {
    width: '100%',
    marginTop: 'auto',
    paddingTop: 24,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  textButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    marginTop: 32,
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  footerLink: {
    fontWeight: '600',
  },
});
