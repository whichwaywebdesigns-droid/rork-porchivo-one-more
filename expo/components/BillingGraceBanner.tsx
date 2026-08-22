/**
 * BillingGraceBanner + gate notices — UI surfaces for the 3-stage billing
 * grace period (see `expo/hooks/useSubscriptionGate.ts` for the full timeline).
 *
 * Components:
 *   • BillingGraceBanner        — manager-only, persistent, NON-blocking banner
 *                                 shown on the admin dashboard during any grace
 *                                 stage. Links to the billing portal (BILL-08/09),
 *                                 the only path that can resolve a lapse.
 *   • ReadOnlyNotice            — small, non-alarming inline notice for stage 2.
 *                                 Residents: "Some settings are temporarily
 *                                 unavailable". Managers: admin-tools variant.
 *                                 NEVER a full-screen blocker, NEVER alarming
 *                                 language, NEVER anything implying the resident
 *                                 did something wrong.
 *   • StaffIntakeLockoutNotice  — stage-3 ONLY notice for staff package intake
 *                                 (the single point where staff FD and PKG intake stops).
 *   • RestrictedCommunityOverlay — stage-3 full restriction (BILL-07) on the
 *                                 community home. Managers get a billing CTA;
 *                                 residents are pointed to their property manager.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, CreditCard, Info, PauseCircle, ShieldAlert } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useSubscriptionGate, GRACE_READONLY_AFTER_DAYS, RESTRICTED_AFTER_DAYS } from '@/hooks/useSubscriptionGate';
import { useOrganization } from '@/store/OrganizationContext';

// ─── Manager billing banner ───────────────────────────────────────────────────

export function BillingGraceBanner() {
  const Colors = useColors();
  const router = useRouter();
  const { activeOrg } = useOrganization();
  const { stage, daysSincePaymentFailure, showManagerBillingBanner } = useSubscriptionGate();

  if (!showManagerBillingBanner || stage === 'ok') return null;

  const days = daysSincePaymentFailure ?? 0;
  let title: string;
  let detail: string;
  let accent: string;
  if (stage === 'past_due') {
    title = 'Payment failed';
    detail = `Your community's payment failed ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}. Residents and staff are unaffected while we retry. Update billing to keep Porchivo active.`;
    accent = Colors.gold;
  } else if (stage === 'grace_readonly') {
    title = `Billing past due — day ${days}`;
    detail = `Resident settings are read-only and your admin tools are limited until billing is updated. Staff package intake is still fully working. Read-only began on day ${GRACE_READONLY_AFTER_DAYS}.`;
    accent = Colors.danger;
  } else {
    title = 'Access paused — billing overdue';
    detail = `The 30-day grace period ended. App access and staff package intake are paused for your property. Update billing to restore everything instantly.`;
    accent = Colors.danger;
  }

  return (
    <View style={[styles.banner, { backgroundColor: accent + '14', borderColor: accent + '40' }]}>
      <View style={styles.bannerIconWrap}>
        <AlertTriangle size={18} color={accent} />
      </View>
      <View style={styles.bannerBody}>
        <Text style={[styles.bannerTitle, { color: accent }]}>{title}</Text>
        <Text style={[styles.bannerDetail, { color: Colors.slate }]}>{detail}</Text>
        <TouchableOpacity
          style={[styles.bannerCta, { backgroundColor: accent }]}
          onPress={() => router.push('/manage-subscription')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Manage billing"
        >
          <CreditCard size={14} color={'#FFFFFF'} />
          <Text style={styles.bannerCtaText}>Manage billing</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Inline read-only notice (stage 2) ────────────────────────────────────────

export function ReadOnlyNotice({ variant = 'resident' }: { variant?: 'resident' | 'manager' }) {
  const Colors = useColors();
  const { isResidentSettingsReadOnly, isManagerAdminReadOnly } = useSubscriptionGate();

  // Caller picks the variant matching the screen; only render when that gate applies.
  const active = variant === 'manager' ? isManagerAdminReadOnly : isResidentSettingsReadOnly;
  if (!active) return null;

  const text =
    variant === 'manager'
      ? 'Some admin tools are temporarily read-only while your community updates its billing. Billing remains fully available.'
      : 'Some settings are temporarily unavailable.';

  return (
    <View style={[styles.notice, { backgroundColor: Colors.gold + '12', borderColor: Colors.gold + '35' }]}>
      <Info size={14} color={Colors.gold} />
      <Text style={[styles.noticeText, { color: Colors.slate }]}>{text}</Text>
    </View>
  );
}

// ─── Staff intake lockout (stage 3 only) ──────────────────────────────────────

export function StaffIntakeLockoutNotice() {
  const Colors = useColors();
  const { isStaffIntakeLocked } = useSubscriptionGate();
  if (!isStaffIntakeLocked) return null;

  return (
    <View style={[styles.staffLock, { backgroundColor: Colors.danger + '12', borderColor: Colors.danger + '40' }]}>
      <ShieldAlert size={18} color={Colors.danger} />
      <View style={styles.bannerBody}>
        <Text style={[styles.bannerTitle, { color: Colors.danger }]}>Package intake is paused</Text>
        <Text style={[styles.bannerDetail, { color: Colors.slate }]}>
          Your community's Porchivo subscription is overdue, so intake is paused after the {RESTRICTED_AFTER_DAYS}-day
          grace period. Your property manager can restore access instantly by updating billing.
        </Text>
      </View>
    </View>
  );
}

// ─── Stage-3 full restriction overlay (BILL-07) ───────────────────────────────

export function RestrictedCommunityOverlay() {
  const Colors = useColors();
  const router = useRouter();
  const { isOrgAdmin } = useOrganization();
  const { isRestricted } = useSubscriptionGate();
  if (!isRestricted) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: Colors.surface }]}>
      <View style={[styles.overlayCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
        <View style={[styles.overlayIconWrap, { backgroundColor: Colors.danger + '14' }]}>
          <PauseCircle size={30} color={Colors.danger} />
        </View>
        <Text style={[styles.overlayTitle, { color: Colors.slate }]}>Porchivo is paused</Text>
        <Text style={[styles.overlayBody, { color: Colors.slateLighter }]}>
          Your community's subscription is past due, so most features are paused for the property.
          Package history and pickup codes stay available from your Packages tab.
        </Text>
        {isOrgAdmin ? (
          <TouchableOpacity
            style={[styles.bannerCta, { backgroundColor: Colors.primary, alignSelf: 'center' }]}
            onPress={() => router.push('/manage-subscription')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Update billing"
          >
            <CreditCard size={14} color={'#FFFFFF'} />
            <Text style={styles.bannerCtaText}>Update billing</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.overlayHint, { color: Colors.slateLighter }]}>
            Your property manager has been notified and can restore access by updating billing.
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  bannerIconWrap: {
    marginTop: 2,
  },
  bannerBody: {
    flex: 1,
    gap: 6,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  bannerDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  bannerCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    alignSelf: 'flex-start' as const,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  bannerCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
  },

  notice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 16,
  },

  staffLock: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 24,
  },
  overlayCard: {
    width: '100%' as unknown as number,
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center' as const,
    gap: 12,
  },
  overlayIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  overlayTitle: {
    fontSize: 19,
    fontWeight: '800' as const,
  },
  overlayBody: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center' as const,
  },
  overlayHint: {
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center' as const,
  },
});
