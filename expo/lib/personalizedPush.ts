/**
 * Personalized push notification templates for Porchivo.
 *
 * These templates use the user's name, package count, and risk data
 * to generate notifications that feel hand-crafted rather than generic.
 *
 * Usage:
 *   const payload = buildDeliveryAlert({ userName: 'Sarah', carrier: 'UPS', riskScore: 72 });
 *   await sendPushNotification(token, payload.title, payload.body, payload.data);
 */

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
}

/** Personalized out-for-delivery alert */
export function buildOFDAlert(params: {
  userName: string;
  carrier?: string;
  estimatedDelivery?: string;
  shipmentId?: string;
}): PushPayload {
  const { userName, carrier, estimatedDelivery, shipmentId } = params;
  const first = userName.split(' ')[0];
  const carrierStr = carrier ? `Your ${carrier} package` : 'A package';
  const etaStr = estimatedDelivery ? ` by ${estimatedDelivery}` : ' today';

  const titles = [
    `${first}, it's on the way! 📦`,
    `Package incoming, ${first}!`,
    `${carrierStr} is out for delivery`,
  ];
  const bodies = [
    `${carrierStr} is out for delivery${etaStr}. Keep an eye on your porch.`,
    `Your delivery is en route${etaStr}. Porch risk score updated.`,
    `${carrierStr} is heading your way${etaStr}. Porchivo is watching.`,
  ];

  const idx = Math.floor(Math.random() * titles.length);
  return {
    title: titles[idx],
    body: bodies[idx],
    data: shipmentId ? { shipmentId, type: 'out_for_delivery' } : { type: 'out_for_delivery' },
  };
}

/** Personalized delivered confirmation */
export function buildDeliveredAlert(params: {
  userName: string;
  carrier?: string;
  shipmentId?: string;
}): PushPayload {
  const { userName, carrier, shipmentId } = params;
  const first = userName.split(' ')[0];
  const carrierStr = carrier ? `Your ${carrier} package` : 'Your package';

  return {
    title: `${first}, package delivered! ✅`,
    body: `${carrierStr} has arrived. Bring it inside soon to stay safe.`,
    data: shipmentId ? { shipmentId, type: 'delivered' } : { type: 'delivered' },
  };
}

/** High-risk porch alert personalized to user */
export function buildHighRiskAlert(params: {
  userName: string;
  riskScore: number;
  activeAlertCount?: number;
}): PushPayload {
  const { userName, riskScore, activeAlertCount } = params;
  const first = userName.split(' ')[0];
  const alertNote = activeAlertCount && activeAlertCount > 0
    ? ` ${activeAlertCount} theft alert${activeAlertCount > 1 ? 's' : ''} active in your area.`
    : '';

  return {
    title: `⚠️ High porch risk, ${first} — ${riskScore}/100`,
    body: `Your porch risk just jumped to ${riskScore}.${alertNote} Tap to see what's driving it.`,
    data: { type: 'high_risk', riskScore },
  };
}

/** Winback / re-engagement nudge for lapsed free users */
export function buildWinbackNudge(params: {
  userName: string;
  daysSinceInstall: number;
  discountLabel?: string;
}): PushPayload {
  const { userName, daysSinceInstall, discountLabel } = params;
  const first = userName.split(' ')[0];
  const offerStr = discountLabel ?? '40% off your first 3 months';

  return {
    title: `${first}, a special offer just for you 🎁`,
    body: `You've been protecting your porch for ${daysSinceInstall} days. Upgrade to Premium now — ${offerStr}.`,
    data: { type: 'winback', trigger: 'manual' },
  };
}

/** Daily streak reminder — push to users who haven't opened the app today */
export function buildStreakReminder(params: {
  userName: string;
  currentStreak: number;
}): PushPayload {
  const { userName, currentStreak } = params;
  const first = userName.split(' ')[0];

  if (currentStreak === 0) {
    return {
      title: `Start your porch-guard streak, ${first}! 🔥`,
      body: 'Check in daily to build your streak and earn guardian badges.',
      data: { type: 'streak_reminder', streak: 0 },
    };
  }

  const urgency = currentStreak >= 7 ? `Don't break your ${currentStreak}-day streak!` : `Keep your ${currentStreak}-day streak going!`;
  return {
    title: `${first}, ${urgency} 🔥`,
    body: 'Open Porchivo and check in to protect your porch today.',
    data: { type: 'streak_reminder', streak: currentStreak },
  };
}

/** Referral reward confirmation */
export function buildReferralCreditAlert(params: {
  userName: string;
  referredName?: string;
  creditDays: number;
}): PushPayload {
  const { userName, referredName, creditDays } = params;
  const first = userName.split(' ')[0];
  const friendStr = referredName ? referredName.split(' ')[0] : 'your neighbor';

  return {
    title: `🎉 You earned ${creditDays} free days, ${first}!`,
    body: `${friendStr} joined Porchivo using your invite. Enjoy ${creditDays} days of Premium — on us.`,
    data: { type: 'referral_credit', creditDays },
  };
}

/** Neighborhood theft alert — personalized to proximity */
export function buildNeighborhoodAlert(params: {
  userName: string;
  streetName?: string;
  distance?: number;
}): PushPayload {
  const { userName, streetName, distance } = params;
  const first = userName.split(' ')[0];
  const locationStr = streetName
    ? `on ${streetName}`
    : distance
      ? `${distance} ft from your home`
      : 'near your home';

  return {
    title: `⚠️ Theft alert ${locationStr}`,
    body: `${first}, a neighbor reported suspicious activity nearby. Tap to see what happened.`,
    data: { type: 'neighborhood_alert' },
  };
}
