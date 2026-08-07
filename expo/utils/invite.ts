import { Platform, Linking, Alert, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REFERRAL_CREDIT_DAYS } from '@/lib/tiers';
import { log } from "../lib/logger";

const APP_DOWNLOAD_URL = 'https://porchivo.com/download';
const REFERRAL_STORAGE_KEY = 'porchivo_pending_referral_credits';

export async function grantReferralCredit(
  onApply: (days: number) => Promise<void> | void,
  days: number = REFERRAL_CREDIT_DAYS,
): Promise<void> {
  log('[Invite] Granting referral credit:', days, 'days');
  const existing = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
  const count = existing ? Number(existing) + 1 : 1;
  await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, String(count));
  await onApply(days);
}

/**
 * Generates a unique invite link with a short, shareable referral code.
 * The code encodes the inviter's user id + a timestamp so each invite is
 * unique and trackable, but stays short enough to look clean in a text.
 */
export function generateInviteLink(userId: string): string {
  const code = `${userId}-${Date.now().toString(36)}`;
  return `${APP_DOWNLOAD_URL}?ref=${code}`;
}

/** Returns just the referral code portion (without the URL prefix). */
export function generateInviteCode(userId: string): string {
  return `${userId}-${Date.now().toString(36)}`;
}

/** Neighbor-focused invite message (distinct from the partner referral message). */
export function getNeighborInviteMessage(senderName: string, inviteLink: string): string {
  const firstName = senderName.split(' ')[0] || senderName;
  return `Hey! ${firstName} invited you to join Porchivo — a neighborhood network that protects packages from porch pirates. When neighbors team up, thieves lose. Join the block and watch each other's deliveries.\n\nGet Porchivo free: ${inviteLink}`;
}

export function getInviteMessage(senderName: string, inviteLink: string): string {
  return `Hey! I'm using Porchivo to help keep me and my neighbors packages safe from porch pirates. Join me and become a porch partner so we can help protect each other's deliveries in our neighborhood.\n\nDownload Porchivo: ${inviteLink}`;
}

function buildSmsUrl(message: string): string {
  const encoded = encodeURIComponent(message);
  if (Platform.OS === 'ios') {
    return `sms:&body=${encoded}`;
  }
  return `sms:?body=${encoded}`;
}

export async function sendSMSInvite(senderName: string, userId: string): Promise<boolean> {
  const inviteLink = generateInviteLink(userId);
  const message = getInviteMessage(senderName, inviteLink);

  const smsUrl = buildSmsUrl(message);

  try {
    const canOpen = await Linking.canOpenURL(smsUrl);
    if (canOpen) {
      await Linking.openURL(smsUrl);
      log('[Invite] Opened native SMS composer via Linking');
      return true;
    }
  } catch (err) {
    log('[Invite] SMS via Linking failed:', err);
  }

  try {
    const result = await Share.share({
      message,
      title: 'Invite to Porchivo',
    });
    log('[Invite] Share result:', result.action);
    return result.action === Share.sharedAction;
  } catch (shareErr) {
    log('[Invite] Share fallback failed:', shareErr);
  }

  Alert.alert(
    'Invite Your Neighbors',
    'Copy this message and send it to your neighbors:\n\n' + message,
  );
  return false;
}

export async function shareInvite(senderName: string, userId: string): Promise<boolean> {
  const inviteLink = generateInviteLink(userId);
  const message = getInviteMessage(senderName, inviteLink);

  try {
    const result = await Share.share({
      message,
      title: 'Invite to Porchivo',
    });
    log('[Invite] Share result:', result.action);
    return result.action === Share.sharedAction;
  } catch (err) {
    log('[Invite] Share error:', err);
    Alert.alert(
      'Invite Your Neighbors',
      'Copy this message and send it to your neighbors:\n\n' + message,
    );
    return false;
  }
}
