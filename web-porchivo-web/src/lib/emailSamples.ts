/**
 * Sample email templates for the preview page.
 * Each template matches a real email type that the send-email function
 * sends through the branded shell.
 */

import type { EmailTemplateOptions } from "@/lib/emailRenderer";

export interface SampleEmail {
  id: string;
  label: string;
  description: string;
  subject: string;
  template: EmailTemplateOptions;
}

export const SAMPLE_EMAILS: SampleEmail[] = [
  {
    id: "welcome",
    label: "Welcome",
    description: "New user onboarding",
    subject: "Welcome to Porchivo",
    template: {
      heading: "Welcome to Porchivo",
      bodyHtml:
        "<p>You're all set. Porchivo will now watch every incoming package and calculate a real-time porch risk score so you know when to pay attention.</p><p><strong>Here's what to do next:</strong></p><ul><li>Add your first tracking number</li><li>Enable push notifications for theft alerts</li><li>Invite a trusted neighbor as a Porch Partner</li></ul>",
      bodyText:
        "You're all set. Porchivo will now watch every incoming package and calculate a real-time porch risk score so you know when to pay attention.\n\nHere's what to do next:\n- Add your first tracking number\n- Enable push notifications for theft alerts\n- Invite a trusted neighbor as a Porch Partner",
      cta: { label: "Open Porchivo", url: "https://porchivo.com/download" },
    },
  },
  {
    id: "risk-alert",
    label: "Risk Alert",
    description: "High porch risk detected",
    subject: "High risk alert for your delivery",
    template: {
      heading: "High risk alert for your delivery",
      bodyHtml:
        "<p>A package from <strong>FedEx</strong> (tracking 7712 3456 8901) was just marked as <strong>delivered</strong>, but your porch risk score is <strong style=\"color:#E8622A;\">82 / 100 — High</strong>.</p><p>Factors contributing to this score:</p><ul><li>3 package thefts reported nearby in the last 30 days</li><li>Delivery occurred during peak porch-theft hours (1–4 PM)</li><li>No Porch Partner currently assigned</li></ul><p>We recommend asking a neighbor to hold this package until you're home.</p>",
      bodyText:
        "A package from FedEx (tracking 7712 3456 8901) was just marked as delivered, but your porch risk score is 82 / 100 — High.\n\nFactors:\n- 3 package thefts reported nearby in the last 30 days\n- Delivery during peak theft hours (1–4 PM)\n- No Porch Partner currently assigned\n\nWe recommend asking a neighbor to hold this package until you're home.",
      cta: { label: "Find a Porch Partner", url: "https://porchivo.com" },
    },
  },
  {
    id: "partner-request",
    label: "Partner Request",
    description: "Neighbor requesting to hold a package",
    subject: "Sarah wants to hold your package",
    template: {
      heading: "Sarah wants to hold your package",
      bodyHtml:
        "<p>Your neighbor <strong>Sarah K.</strong> (verified, 0.4 mi away) has offered to hold your FedEx delivery until you're home.</p><p>This is a free, neighbor-to-neighbor hold — Sarah earns community credit for helping out.</p><p>The package will be available for pickup at Sarah's porch. You'll get directions once you accept.</p>",
      bodyText:
        "Your neighbor Sarah K. (verified, 0.4 mi away) has offered to hold your FedEx delivery until you're home.\n\nThis is a free, neighbor-to-neighbor hold — Sarah earns community credit for helping out.\n\nThe package will be available for pickup at Sarah's porch. You'll get directions once you accept.",
      cta: { label: "Accept Hold", url: "https://porchivo.com" },
    },
  },
  {
    id: "verification",
    label: "ID Verification",
    description: "Partner identity verification result",
    subject: "Your identity verification is complete",
    template: {
      heading: "Your identity verification is complete",
      bodyHtml:
        "<p>Great news — your identity verification with <strong>Porchivo Partner</strong> has been approved.</p><p>You can now accept paid package holds from neighbors in your area. Payouts are processed via Stripe Connect and typically land in 1–2 business days.</p><p>Remember: always verify the recipient's identity before handing off a package, and never share your verification code with anyone.</p>",
      bodyText:
        "Great news — your identity verification with Porchivo Partner has been approved.\n\nYou can now accept paid package holds from neighbors in your area. Payouts are processed via Stripe Connect and typically land in 1–2 business days.\n\nRemember: always verify the recipient's identity before handing off a package, and never share your verification code with anyone.",
      cta: { label: "View Partner Dashboard", url: "https://porchivo.com" },
    },
  },
  {
    id: "invoice",
    label: "Invoice Receipt",
    description: "Premium subscription receipt",
    subject: "Your Porchivo Premium receipt",
    template: {
      heading: "Your Porchivo Premium receipt",
      bodyHtml:
        "<p>Thanks for being a Porchivo community subscriber! Here's your receipt for this billing period:</p><p><strong>Plan:</strong> Porchivo Community (Annual)<br/><strong>Amount:</strong> $1,908.00<br/><strong>Date:</strong> July 16, 2026<br/><strong>Payment method:</strong> Visa •••• 4242</p><p>Your subscription renews on July 16, 2027. You can manage your subscription anytime from the Manage Subscription screen in the app.</p>",
      bodyText:
        "Thanks for being a Porchivo community subscriber! Here's your receipt for this billing period:\n\nPlan: Porchivo Community (Annual)\nAmount: $1,908.00\nDate: July 16, 2026\nPayment method: Visa ending in 4242\n\nYour subscription renews on July 16, 2027. You can manage your subscription anytime from the Manage Subscription screen in the app.",
      cta: { label: "View Billing History", url: "https://porchivo.com" },
    },
  },
  {
    id: "hoa-invite",
    label: "HOA Invite",
    description: "Community invitation",
    subject: "You've been invited to Maple Court HOA",
    template: {
      heading: "You've been invited to Maple Court HOA",
      bodyHtml:
        "<p>Your HOA manager has invited you to join <strong>Maple Court HOA</strong> on Porchivo.</p><p>As a resident, you'll get:</p><ul><li>Full Premium package tracking — no extra cost</li><li>Building-wide delivery visibility for property managers</li><li>Theft alerts and neighborhood risk scoring</li><li>Access to the community Porch Partner network</li></ul><p>This invite is covered by your HOA's Porchivo Enterprise plan.</p>",
      bodyText:
        "Your HOA manager has invited you to join Maple Court HOA on Porchivo.\n\nAs a resident, you'll get:\n- Full Premium package tracking — no extra cost\n- Building-wide delivery visibility for property managers\n- Theft alerts and neighborhood risk scoring\n- Access to the community Porch Partner network\n\nThis invite is covered by your HOA's Porchivo Enterprise plan.",
      cta: { label: "Join Maple Court", url: "https://porchivo.com" },
    },
  },
];
