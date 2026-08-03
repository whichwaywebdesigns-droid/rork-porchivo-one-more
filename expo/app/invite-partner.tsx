import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  UserPlus,
  MessageSquare,
  Share2,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Send,
  Users,
  Shield,
  Sparkles,
  Link,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { generateInviteLink, getInviteMessage, sendSMSInvite, shareInvite, grantReferralCredit } from '@/utils/invite';
import * as Clipboard from 'expo-clipboard';
import { log } from "@/lib/logger";

type InviteStep = 'method' | 'compose' | 'success';

const INVITE_METHODS = [
  {
    id: 'sms',
    label: 'Text Message',
    desc: 'Send an SMS invite directly',
    icon: MessageSquare,
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    id: 'share',
    label: 'Share Link',
    desc: 'Share via any app on your phone',
    icon: Share2,
    color: Colors.primary,
    bg: Colors.skyBlue,
  },
  {
    id: 'copy',
    label: 'Copy Invite Link',
    desc: 'Copy link to clipboard and share manually',
    icon: Copy,
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
] as const;

export default function InvitePartnerScreen() {
  const router = useRouter();
  const { user, applyReferralCredit } = useApp();
  const [step, setStep] = useState<InviteStep>('method');
  const [neighborName, setNeighborName] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.5)).current;

  const inviteLink = user ? generateInviteLink(user.id) : '';
  const defaultMessage = user ? getInviteMessage(user.name, inviteLink) : '';

  const handleMethodSelect = useCallback((methodId: string) => {
    log('[InvitePartner] Method selected:', methodId);
    setSelectedMethod(methodId);

    if (methodId === 'copy') {
      void Clipboard.setStringAsync(inviteLink).then(() => {
        log('[InvitePartner] Link copied to clipboard');
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        Alert.alert('Copied!', 'Invite link copied to clipboard. Share it with your neighbor!');
      });
      return;
    }

    setStep('compose');
  }, [inviteLink]);

  const handleSend = useCallback(async () => {
    if (!user || sending) return;
    setSending(true);
    log('[InvitePartner] Sending invite via:', selectedMethod);

    try {
      let success = false;
      if (selectedMethod === 'sms') {
        success = await sendSMSInvite(user.name, user.id);
      } else {
        success = await shareInvite(user.name, user.id);
      }

      if (success) {
        await grantReferralCredit(applyReferralCredit);
        setStep('success');
        Animated.parallel([
          Animated.timing(successAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        ]).start();
      }
    } catch (err) {
      log('[InvitePartner] Send error:', err);
      Alert.alert('Error', 'Could not send invite. Please try again.');
    } finally {
      setSending(false);
    }
  }, [user, sending, selectedMethod, successAnim, successScale]);

  const handleBack = useCallback(() => {
    if (step === 'compose') {
      setStep('method');
    } else {
      router.back();
    }
  }, [step, router]);

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{
        title: 'Invite a Porch Partner',
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.primary,
        headerShadowVisible: false,
      }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'method' && (
          <View>
            <View style={styles.heroSection}>
              <View style={styles.heroIconWrap}>
                <UserPlus size={32} color={Colors.primary} />
              </View>
              <Text style={styles.heroTitle}>Grow Your Porch Network</Text>
              <Text style={styles.heroSubtitle}>
                Invite trusted neighbors to join Porchivo. The more partners on your block, the safer everyone's packages are.
              </Text>
            </View>

            <View style={styles.benefitsRow}>
              <View style={styles.benefitCard}>
                <Shield size={18} color={Colors.primary} />
                <Text style={styles.benefitText}>Protect packages together</Text>
              </View>
              <View style={styles.benefitCard}>
                <Users size={18} color="#059669" />
                <Text style={styles.benefitText}>Build a trusted network</Text>
              </View>
              <View style={styles.benefitCard}>
                <Sparkles size={18} color={Colors.secondary} />
                <Text style={styles.benefitText}>Reduce porch theft</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Choose how to invite</Text>

            {INVITE_METHODS.map((method) => {
              const Icon = method.icon;
              return (
                <TouchableOpacity
                  key={method.id}
                  style={styles.methodCard}
                  onPress={() => handleMethodSelect(method.id)}
                  activeOpacity={0.7}
                  testID={`method-${method.id}`}
                >
                  <View style={[styles.methodIconWrap, { backgroundColor: method.bg }]}>
                    <Icon size={20} color={method.color} />
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodLabel}>{method.label}</Text>
                    <Text style={styles.methodDesc}>{method.desc}</Text>
                  </View>
                  {method.id === 'copy' && copied ? (
                    <View style={styles.copiedBadge}>
                      <Check size={12} color={Colors.white} />
                    </View>
                  ) : (
                    <ChevronRight size={18} color={Colors.slateLighter} />
                  )}
                </TouchableOpacity>
              );
            })}

            <View style={styles.linkPreview}>
              <Link size={14} color={Colors.primary} />
              <Text style={styles.linkPreviewText} numberOfLines={1}>{inviteLink}</Text>
            </View>
          </View>
        )}

        {step === 'compose' && (
          <View>
            <TouchableOpacity style={styles.backRow} onPress={handleBack} activeOpacity={0.7}>
              <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
              <Text style={styles.backText}>Back to methods</Text>
            </TouchableOpacity>

            <View style={styles.composeSection}>
              <Text style={styles.composeTitle}>
                {selectedMethod === 'sms' ? 'Send Text Invite' : 'Share Invite'}
              </Text>
              <Text style={styles.composeSubtitle}>
                A personalized invite message will be sent with your referral link.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Neighbor's Name (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Sarah, James..."
                  placeholderTextColor={Colors.slateLighter}
                  value={neighborName}
                  onChangeText={setNeighborName}
                  testID="neighbor-name-input"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Add a personal note (optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Add a personal message..."
                  placeholderTextColor={Colors.slateLighter}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  testID="custom-message-input"
                />
              </View>

              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>Message Preview</Text>
                <View style={styles.previewCard}>
                  <Text style={styles.previewText}>
                    {neighborName ? `Hey ${neighborName}! ` : ''}{customMessage ? customMessage + '\n\n' : ''}{defaultMessage}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.85}
                testID="send-invite-btn"
              >
                <Send size={18} color={Colors.white} />
                <Text style={styles.sendButtonText}>
                  {sending ? 'Sending...' : selectedMethod === 'sms' ? 'Open SMS' : 'Share Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'success' && (
          <Animated.View style={[styles.successSection, { opacity: successAnim, transform: [{ scale: successScale }] }]}>
            <View style={styles.successIconWrap}>
              <Check size={40} color={Colors.white} />
            </View>
            <Text style={styles.successTitle}>Invite Sent!</Text>
            <Text style={styles.successSubtitle}>
              Your neighbor will receive the invite and can join your Porchivo network. You and your friend each get 1 month of Premium free once they sign up.
            </Text>

            <View style={styles.successStats}>
              <View style={styles.successStatCard}>
                <Text style={styles.successStatValue}>Stronger</Text>
                <Text style={styles.successStatLabel}>Block network</Text>
              </View>
              <View style={styles.successStatCard}>
                <Text style={styles.successStatValue}>Safer</Text>
                <Text style={styles.successStatLabel}>Package protection</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.inviteAnotherBtn}
              onPress={() => {
                setStep('method');
                setNeighborName('');
                setCustomMessage('');
                setSelectedMethod(null);
              }}
              activeOpacity={0.85}
              testID="invite-another-btn"
            >
              <UserPlus size={16} color={Colors.primary} />
              <Text style={styles.inviteAnotherText}>Invite Another Neighbor</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.back()}
              activeOpacity={0.85}
              testID="done-btn"
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 32,
    backgroundColor: Colors.white,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.slate,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
    textAlign: 'center' as const,
    lineHeight: 21,
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  benefitCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  benefitText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.slate,
    textAlign: 'center' as const,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slateLight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 4,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  methodIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: {
    flex: 1,
    gap: 2,
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.slate,
  },
  methodDesc: {
    fontSize: 12,
    color: Colors.slateLight,
  },
  copiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.skyBlue,
    borderRadius: 10,
  },
  linkPreviewText: {
    flex: 1,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  composeSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  composeTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 6,
  },
  composeSubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 20,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.slate,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  previewSection: {
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slateLight,
    marginBottom: 8,
  },
  previewCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  previewText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 19,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  successSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 15,
    color: Colors.slateLight,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 28,
  },
  successStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  successStatCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 4,
  },
  successStatValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  successStatLabel: {
    fontSize: 11,
    color: Colors.slateLighter,
    fontWeight: '500' as const,
  },
  inviteAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.skyBlue,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    marginBottom: 10,
  },
  inviteAnotherText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  doneBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.slateLight,
  },
});
