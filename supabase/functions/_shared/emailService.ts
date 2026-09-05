// @ts-nocheck — Deno runtime
//
// Porchivo email service — one typed function per Resend template (23 total).
//
// All sends funnel through the SQL service `enqueue_template_email()`
// (email-templates-migration.sql), which is the single source of truth for:
//   • per-category preference checks (security/billing always send)
//   • dedupe via email_sends.dedupe_key UNIQUE (insert-or-skip)
//   • reference-number generation (PV-XXXXXXXX-XXXXXX)
//   • footer variable merge (company_address, support_email, unsubscribe_url)
//   • durable email_queue insert (drained by the send-email function)
//
// Variable names MUST match the {{snake_case}} placeholders baked into the
// Resend template HTML.

export type EmailCategory =
  | 'security'
  | 'billing'
  | 'partners'
  | 'packages'
  | 'community'
  | 'marketing';

interface SqlResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Minimal shape of a Supabase service-role client used here. */
export interface SqlRpcClient {
  rpc(fn: string, args: Record<string, unknown>): Promise<SqlResult<unknown>>;
}

export const WEB_BASE =
  Deno.env.get('WEB_BASE_URL') ?? 'https://porchivo.com';
export const APP_STORE_URL = 'https://apps.apple.com/app/id6797350605';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.rork.porchivo';
export const REVIEW_URL = `${APP_STORE_URL}?action=write-review`;

export interface EnqueueTemplateArgs {
  slug: string;
  recipient: string;
  userId: string | null;
  category: EmailCategory;
  dedupeKey: string;
  variables: Record<string, string>;
  sourceTable?: string;
  sourceId?: string | null;
}

/**
 * Enqueue a template email through the SQL service. Returns the email_sends
 * row id, or null when the send was skipped (unknown slug, opted out, or a
 * duplicate of the dedupe key). Never throws — email must not block callers.
 */
export async function enqueueTemplateEmail(
  client: SqlRpcClient,
  args: EnqueueTemplateArgs,
): Promise<string | null> {
  try {
    const { data, error } = await client.rpc('enqueue_template_email', {
      p_slug: args.slug,
      p_recipient: args.recipient,
      p_user_id: args.userId,
      p_category: args.category,
      p_dedupe_key: args.dedupeKey,
      p_variables: args.variables,
      p_source_table: args.sourceTable ?? null,
      p_source_id: args.sourceId ?? null,
    });
    if (error) {
      console.error(`[emailService] enqueue ${args.slug} failed:`, error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (e) {
    console.error(
      `[emailService] enqueue ${args.slug} threw:`,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

// ── 1. Account Deletion Confirmation (security) ─────────────────────────────
export interface AccountDeletionPayload {
  recipient: string;
  userId: string;
  firstName: string;
  requestDate: string;
  deletionDate: string;
  recoveryWindow: string;
}
export function sendAccountDeletionConfirmation(client: SqlRpcClient, p: AccountDeletionPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'account-deletion-confirmation',
    recipient: p.recipient,
    userId: p.userId,
    category: 'security',
    dedupeKey: `acct-del:${p.userId}`,
    variables: {
      first_name: p.firstName,
      request_date: p.requestDate,
      deletion_date: p.deletionDate,
      recovery_window: p.recoveryWindow,
      support_url: `${WEB_BASE}/guide`,
    },
    sourceTable: 'profiles',
    sourceId: p.userId,
  });
}

// ── 2. Porch Partner Request Received (partners) ────────────────────────────
export interface PartnerRequestPayload {
  recipient: string;
  userId: string;
  requestId: string;
  firstName: string;
  requesterName: string;
  requesterAddress: string;
  startDate: string;
  endDate: string;
  packageCount: string;
}
export function sendPartnerRequestReceived(client: SqlRpcClient, p: PartnerRequestPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'partner-request-received',
    recipient: p.recipient,
    userId: p.userId,
    category: 'partners',
    dedupeKey: `ptnr-req:${p.requestId}`,
    variables: {
      first_name: p.firstName,
      requester_name: p.requesterName,
      requester_address: p.requesterAddress,
      start_date: p.startDate,
      end_date: p.endDate,
      package_count: p.packageCount,
      request_url: `${WEB_BASE}/partners`,
    },
    sourceTable: 'partner_connections',
    sourceId: p.requestId,
  });
}

// ── 3. Porch Partner Request Accepted (partners, → requester) ───────────────
export interface PartnerAcceptedPayload {
  recipient: string;
  userId: string;
  requestId: string;
  firstName: string;
  partnerName: string;
  partnerAddress: string;
  startDate: string;
  endDate: string;
}
export function sendPartnerRequestAccepted(client: SqlRpcClient, p: PartnerAcceptedPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'partner-request-accepted',
    recipient: p.recipient,
    userId: p.userId,
    category: 'partners',
    dedupeKey: `ptnr-acc:${p.requestId}`,
    variables: {
      first_name: p.firstName,
      partner_name: p.partnerName,
      partner_address: p.partnerAddress,
      start_date: p.startDate,
      end_date: p.endDate,
      coverage_url: `${WEB_BASE}/partners`,
    },
    sourceTable: 'partner_connections',
    sourceId: p.requestId,
  });
}

// ── 4. Porch Partner Request Declined (partners, → requester) ───────────────
export interface PartnerDeclinedPayload {
  recipient: string;
  userId: string;
  requestId: string;
  firstName: string;
  partnerName: string;
  startDate: string;
  endDate: string;
  declineReason: string;
}
export function sendPartnerRequestDeclined(client: SqlRpcClient, p: PartnerDeclinedPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'partner-request-declined',
    recipient: p.recipient,
    userId: p.userId,
    category: 'partners',
    dedupeKey: `ptnr-dec:${p.requestId}`,
    variables: {
      first_name: p.firstName,
      partner_name: p.partnerName,
      start_date: p.startDate,
      end_date: p.endDate,
      decline_reason: p.declineReason,
      find_partner_url: `${WEB_BASE}/partners`,
    },
    sourceTable: 'partner_connections',
    sourceId: p.requestId,
  });
}

// ── 5. You've Been Added as a Porch Partner (partners, → partner) ───────────
export interface AddedAsPartnerPayload {
  recipient: string;
  userId: string;
  requestId: string;
  firstName: string;
  requesterName: string;
  requesterAddress: string;
  startDate: string;
  endDate: string;
}
export function sendAddedAsPartner(client: SqlRpcClient, p: AddedAsPartnerPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'added-as-partner',
    recipient: p.recipient,
    userId: p.userId,
    category: 'partners',
    dedupeKey: `ptnr-add:${p.requestId}`,
    variables: {
      first_name: p.firstName,
      requester_name: p.requesterName,
      requester_address: p.requesterAddress,
      start_date: p.startDate,
      end_date: p.endDate,
      settings_url: `${WEB_BASE}/app/settings`,
    },
    sourceTable: 'partner_connections',
    sourceId: p.requestId,
  });
}

// ── 6. High Risk Alert in Your Area (community) ─────────────────────────────
export interface HighRiskPayload {
  recipient: string;
  userId: string;
  orgId: string;
  firstName: string;
  neighborhood: string;
  radius: string;
  riskLevel: string;
  incidentCount: string;
  lastIncidentTime: string;
}
export function sendHighRiskAlert(client: SqlRpcClient, p: HighRiskPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'high-risk-alert',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `risk:${p.orgId}:${p.userId}:${new Date().toISOString().slice(0, 10)}`,
    variables: {
      first_name: p.firstName,
      neighborhood: p.neighborhood,
      radius: p.radius,
      risk_level: p.riskLevel,
      incident_count: p.incidentCount,
      last_incident_time: p.lastIncidentTime,
      risk_map_url: `${WEB_BASE}/safety`,
    },
    sourceTable: 'organizations',
    sourceId: p.orgId,
  });
}

// ── 7. Suspicious Activity Reported Near You (community) ────────────────────
export interface SuspiciousActivityPayload {
  recipient: string;
  userId: string;
  alertId: string;
  firstName: string;
  location: string;
  reportTime: string;
  activityDescription: string;
  reporterLabel: string;
}
export function sendSuspiciousActivityReported(client: SqlRpcClient, p: SuspiciousActivityPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'suspicious-activity',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `susp:${p.alertId}:${p.userId}`,
    variables: {
      first_name: p.firstName,
      location: p.location,
      report_time: p.reportTime,
      activity_description: p.activityDescription,
      reporter_label: p.reporterLabel,
      report_url: `${WEB_BASE}/reports/${p.alertId}`,
    },
    sourceTable: 'suspicious_alerts',
    sourceId: p.alertId,
  });
}

// ── 8. Neighborhood Safety Digest (community) ───────────────────────────────
export interface SafetyDigestPayload {
  recipient: string;
  userId: string;
  orgId: string;
  weekKey: string;
  firstName: string;
  neighborhood: string;
  packagesDelivered: string;
  packagesAtRisk: string;
  theftReports: string;
  safestWindow: string;
}
export function sendSafetyDigest(client: SqlRpcClient, p: SafetyDigestPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'safety-digest',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `digest:${p.orgId}:${p.userId}:${p.weekKey}`,
    variables: {
      first_name: p.firstName,
      neighborhood: p.neighborhood,
      packages_delivered: p.packagesDelivered,
      packages_at_risk: p.packagesAtRisk,
      theft_reports: p.theftReports,
      safest_window: p.safestWindow,
      digest_url: `${WEB_BASE}/safety`,
    },
    sourceTable: 'organizations',
    sourceId: p.orgId,
  });
}

// ── 9. Subscription Started / Upgraded (billing) ────────────────────────────
export interface SubscriptionPayload {
  recipient: string;
  userId: string;
  eventName: string;
  firstName: string;
  planName: string;
  upgradeOrStart: string; // 'starting' | 'upgrading to'
  billingCycle: string;
  amount: string;
  nextBillingDate: string;
}
export function sendSubscriptionStarted(client: SqlRpcClient, p: SubscriptionPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'subscription-started',
    recipient: p.recipient,
    userId: p.userId,
    category: 'billing',
    dedupeKey: `sub:${p.eventName}`,
    variables: {
      first_name: p.firstName,
      plan_name: p.planName,
      upgrade_or_start: p.upgradeOrStart,
      billing_cycle: p.billingCycle,
      amount: p.amount,
      next_billing_date: p.nextBillingDate,
      dashboard_url: `${WEB_BASE}/app`,
    },
    sourceTable: 'subscriptions',
    sourceId: p.userId,
  });
}

// ── 10. New Member Joined Your Community (community) ────────────────────────
export interface MemberJoinedPayload {
  recipient: string;
  userId: string;
  membershipId: string;
  firstName: string;
  memberName: string;
  memberAddress: string;
  joinDate: string;
  communityName: string;
}
export function sendMemberJoined(client: SqlRpcClient, p: MemberJoinedPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'member-joined',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `join:${p.membershipId}:${p.userId}`,
    variables: {
      first_name: p.firstName,
      member_name: p.memberName,
      member_address: p.memberAddress,
      join_date: p.joinDate,
      community_name: p.communityName,
      directory_url: `${WEB_BASE}/app/resident-directory`,
    },
    sourceTable: 'org_memberships',
    sourceId: p.membershipId,
  });
}

// ── 11. Community Admin Invitation (community) ──────────────────────────────
export interface AdminInvitationPayload {
  recipient: string;
  userId: string | null;
  membershipId: string;
  firstName: string;
  communityName: string;
  inviterName: string;
  adminRole: string;
  expiryDate: string;
  inviteCode: string;
}
export function sendAdminInvitation(client: SqlRpcClient, p: AdminInvitationPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'admin-invitation',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `adm-inv:${p.membershipId}`,
    variables: {
      first_name: p.firstName,
      community_name: p.communityName,
      inviter_name: p.inviterName,
      admin_role: p.adminRole,
      expiry_date: p.expiryDate,
      accept_invite_url: `${WEB_BASE}/invite?code=${encodeURIComponent(p.inviteCode)}`,
    },
    sourceTable: 'org_memberships',
    sourceId: p.membershipId,
  });
}

// ── 12. Re-engagement (marketing) ───────────────────────────────────────────
export interface ReEngagementPayload {
  recipient: string;
  userId: string;
  monthKey: string;
  firstName: string;
  daysInactive: string;
  lastActiveDate: string;
  lifetimePackages: string;
  partnerCount: string;
}
export function sendReEngagement(client: SqlRpcClient, p: ReEngagementPayload) {
  return enqueueTemplateEmail(client, {
    slug: 're-engagement',
    recipient: p.recipient,
    userId: p.userId,
    category: 'marketing',
    dedupeKey: `reengage:${p.userId}:${p.monthKey}`,
    variables: {
      first_name: p.firstName,
      days_inactive: p.daysInactive,
      last_active_date: p.lastActiveDate,
      lifetime_packages: p.lifetimePackages,
      partner_count: p.partnerCount,
      return_url: `${WEB_BASE}/app`,
    },
    sourceTable: 'profiles',
    sourceId: p.userId,
  });
}

// ── 13. Referral Reward Confirmation (community) ────────────────────────────
export interface ReferralPayload {
  recipient: string;
  userId: string;
  referralId: string;
  firstName: string;
  referredName: string;
  rewardAmount: string;
  rewardType: string;
  totalReferrals: string;
}
export function sendReferralReward(client: SqlRpcClient, p: ReferralPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'referral-reward',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `ref:${p.referralId}`,
    variables: {
      first_name: p.firstName,
      referred_name: p.referredName,
      reward_amount: p.rewardAmount,
      reward_type: p.rewardType,
      total_referrals: p.totalReferrals,
      referral_url: `${WEB_BASE}/referral`,
    },
    sourceTable: 'referrals',
    sourceId: p.referralId,
  });
}

// ── 14. Milestone Email (community) ─────────────────────────────────────────
export interface MilestonePayload {
  recipient: string;
  userId: string;
  firstName: string;
  packageMilestone: string;
  joinDate: string;
  partnerUses: string;
  theftAttemptsBlocked: string;
}
export function sendMilestoneEmail(client: SqlRpcClient, p: MilestonePayload) {
  return enqueueTemplateEmail(client, {
    slug: 'milestone',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `mile:${p.userId}:${p.packageMilestone}`,
    variables: {
      first_name: p.firstName,
      package_milestone: p.packageMilestone,
      join_date: p.joinDate,
      partner_uses: p.partnerUses,
      theft_attempts_blocked: p.theftAttemptsBlocked,
      stats_url: `${WEB_BASE}/app/safety-score`,
    },
    sourceTable: 'profiles',
    sourceId: p.userId,
  });
}

// ── 15. App Update / New Feature Announcement (marketing, manual) ───────────
export interface AppUpdatePayload {
  recipient: string;
  userId: string | null;
  broadcastKey: string;
  firstName: string;
  featureName: string;
  featureDescription: string;
  platforms: string;
  appVersion: string;
  releaseDate: string;
}
export function sendAppUpdateAnnouncement(client: SqlRpcClient, p: AppUpdatePayload) {
  return enqueueTemplateEmail(client, {
    slug: 'app-update',
    recipient: p.recipient,
    userId: p.userId,
    category: 'marketing',
    dedupeKey: `upd:${p.broadcastKey}:${p.recipient}`,
    variables: {
      first_name: p.firstName,
      feature_name: p.featureName,
      feature_description: p.featureDescription,
      platforms: p.platforms,
      app_version: p.appVersion,
      release_date: p.releaseDate,
      update_url: PLAY_STORE_URL,
    },
    sourceTable: 'broadcasts',
    sourceId: null,
  });
}

// ── 16. HOA Pilot Welcome (community, manual) ───────────────────────────────
export interface HoaPilotPayload {
  recipient: string;
  userId: string | null;
  firstName: string;
  communityName: string;
  pilotStartDate: string;
  unitCount: string;
  accountManagerName: string;
}
export function sendHoaPilotWelcome(client: SqlRpcClient, p: HoaPilotPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'hoa-pilot-welcome',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `pilot:${p.recipient}:${p.pilotStartDate}`,
    variables: {
      first_name: p.firstName,
      community_name: p.communityName,
      pilot_start_date: p.pilotStartDate,
      unit_count: p.unitCount,
      account_manager_name: p.accountManagerName,
      hoa_dashboard_url: `${WEB_BASE}/app/admin-dashboard`,
    },
    sourceTable: 'organizations',
    sourceId: null,
  });
}

// ── 17. Review Request (community) ──────────────────────────────────────────
export interface ReviewRequestPayload {
  recipient: string;
  userId: string;
  assignmentId: string;
  firstName: string;
  itemName: string;
  partnerName: string;
  deliveredDate: string;
}
export function sendReviewRequest(client: SqlRpcClient, p: ReviewRequestPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'review-request',
    recipient: p.recipient,
    userId: p.userId,
    category: 'community',
    dedupeKey: `review:${p.assignmentId}`,
    variables: {
      first_name: p.firstName,
      item_name: p.itemName,
      partner_name: p.partnerName,
      delivered_date: p.deliveredDate,
      review_url: REVIEW_URL,
    },
    sourceTable: 'partner_assignments',
    sourceId: p.assignmentId,
  });
}

// ── 18. Package Arriving Today (packages) ───────────────────────────────────
export interface PackageArrivingPayload {
  recipient: string;
  userId: string;
  shipmentId: string;
  firstName: string;
  itemName: string;
  carrierName: string;
  deliveryWindow: string;
  trackingNumber: string;
}
export function sendPackageArrivingToday(client: SqlRpcClient, p: PackageArrivingPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'package-arriving',
    recipient: p.recipient,
    userId: p.userId,
    category: 'packages',
    dedupeKey: `arrive:${p.shipmentId}`,
    variables: {
      first_name: p.firstName,
      item_name: p.itemName,
      carrier_name: p.carrierName,
      delivery_window: p.deliveryWindow,
      tracking_number: p.trackingNumber,
      tracking_url: `${WEB_BASE}/app/shipment-detail?id=${encodeURIComponent(p.shipmentId)}`,
    },
    sourceTable: 'shipments',
    sourceId: p.shipmentId,
  });
}

// ── 19. Package Picked Up by Porch Partner (packages) ───────────────────────
export interface PackagePickedUpPayload {
  recipient: string;
  userId: string;
  recordId: string;
  firstName: string;
  partnerName: string;
  itemName: string;
  pickupTime: string;
  partnerAddress: string;
}
export function sendPackagePickedUp(client: SqlRpcClient, p: PackagePickedUpPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'package-picked-up',
    recipient: p.recipient,
    userId: p.userId,
    category: 'packages',
    dedupeKey: `pickup:${p.recordId}`,
    variables: {
      first_name: p.firstName,
      partner_name: p.partnerName,
      item_name: p.itemName,
      pickup_time: p.pickupTime,
      partner_address: p.partnerAddress,
      // The picked-up payload carries no shipmentId (SQL trigger sends are the
      // real source and deep-link to /app/chat?shipmentId=…) — route to the
      // packages tab so the resident can reach the conversation.
      message_url: `${WEB_BASE}/app/packages`,
    },
    sourceTable: 'partner_assignments',
    sourceId: p.recordId,
  });
}

// ── 20. Package Left Too Long / At-Risk Alert (packages) ────────────────────
export interface PackageAtRiskPayload {
  recipient: string;
  userId: string;
  shipmentId: string;
  round: string; // '1' | '2' — one re-alert after the longer threshold
  firstName: string;
  itemName: string;
  timeElapsed: string;
  riskLevel: string;
  deliveryLocation: string;
}
export function sendPackageAtRisk(client: SqlRpcClient, p: PackageAtRiskPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'package-at-risk',
    recipient: p.recipient,
    userId: p.userId,
    category: 'packages',
    dedupeKey: `atrisk:${p.shipmentId}:${p.round}`,
    variables: {
      first_name: p.firstName,
      item_name: p.itemName,
      time_elapsed: p.timeElapsed,
      risk_level: p.riskLevel,
      delivery_location: p.deliveryLocation,
      request_partner_url: `${WEB_BASE}/partners`,
    },
    sourceTable: 'shipments',
    sourceId: p.shipmentId,
  });
}

// ── 21a. Package Reported Missing (security) ─────────────────────────────────
// Fired when a package incident is reported but not yet confirmed stolen.
// Neutral/investigating tone; includes investigation_status. Split from the
// single stolen email per the 2026-09-05 update (missing vs stolen states).
export interface PackageMissingPayload {
  recipient: string;
  userId: string;
  reportId: string;
  firstName: string;
  itemName: string;
  lastSeenTime: string;
  investigationStatus: string;
}
export function sendPackageMissing(client: SqlRpcClient, p: PackageMissingPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'package-missing',
    recipient: p.recipient,
    userId: p.userId,
    category: 'security',
    dedupeKey: `inc-new:${p.reportId}`,
    variables: {
      first_name: p.firstName,
      item_name: p.itemName,
      last_seen_time: p.lastSeenTime,
      report_id: p.reportId.slice(0, 8),
      investigation_status: p.investigationStatus,
      report_url: `${WEB_BASE}/reports/${p.reportId}`,
    },
    sourceTable: 'incident_reports',
    sourceId: p.reportId,
  });
}

// ── 21b. Package Reported Stolen (security) ──────────────────────────────────
export interface PackageStolenPayload {
  recipient: string;
  userId: string;
  reportId: string;
  firstName: string;
  itemName: string;
  lastSeenTime: string;
  itemValue: string;
}
export function sendPackageStolen(client: SqlRpcClient, p: PackageStolenPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'package-stolen',
    recipient: p.recipient,
    userId: p.userId,
    category: 'security',
    dedupeKey: `inc-new:${p.reportId}`,
    variables: {
      first_name: p.firstName,
      item_name: p.itemName,
      last_seen_time: p.lastSeenTime,
      report_id: p.reportId.slice(0, 8),
      item_value: p.itemValue,
      report_url: `${WEB_BASE}/reports/${p.reportId}`,
    },
    sourceTable: 'incident_reports',
    sourceId: p.reportId,
  });
}

// ── 22. Package Theft Resolved / Recovered (security) ───────────────────────
export interface TheftResolvedPayload {
  recipient: string;
  userId: string;
  reportId: string;
  firstName: string;
  itemName: string;
  recoveryDate: string;
  recoverySource: string;
}
export function sendTheftResolved(client: SqlRpcClient, p: TheftResolvedPayload) {
  return enqueueTemplateEmail(client, {
    slug: 'theft-resolved',
    recipient: p.recipient,
    userId: p.userId,
    category: 'security',
    dedupeKey: `inc-res:${p.reportId}`,
    variables: {
      first_name: p.firstName,
      item_name: p.itemName,
      recovery_date: p.recoveryDate,
      recovery_source: p.recoverySource,
      report_id: p.reportId.slice(0, 8),
      close_report_url: `${WEB_BASE}/reports/${p.reportId}`,
    },
    sourceTable: 'incident_reports',
    sourceId: p.reportId,
  });
}
