import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";

const EFFECTIVE_DATE = "February 19, 2026";
const LAST_UPDATED = "February 19, 2026";
const POLICY_VERSION = "1.0";
const COMPANY = "WhichWay Web Labs LLC";

interface RevisionEntry {
  version: string;
  date: string;
  summary: string;
}

const REVISION_HISTORY: RevisionEntry[] = [
  {
    version: "1.0",
    date: "February 19, 2026",
    summary:
      "Initial published policy. Foreground-only location, first-party (non-tracking) advertising, 90-day package-data retention, 30-day deletion window.",
  },
];

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-100 mb-3">
        {number}. {title}
      </h2>
      <div className="text-slate-300 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2">{children}</h3>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <PageLayout>
      <SEOHead
        title="Privacy Policy — Porchivo"
        description={`Privacy Policy for Porchivo, operated by ${COMPANY}. Effective ${EFFECTIVE_DATE}.`}
        canonical={`${BRAND.url}/privacy`}
        ogTitle="Porchivo Privacy Policy"
        ogDescription={`How Porchivo collects, uses, and protects your information. Operated by ${COMPANY}.`}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Privacy Policy", href: "/privacy" }]} />

        {/* Header */}
        <div className="mt-8 mb-12 pb-8 border-b border-slate-700">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold mb-4">
            🛡️ Privacy
          </div>
          <h1 className="text-4xl font-bold text-slate-100 mb-3">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">
            Effective Date: <span className="text-slate-300 font-medium">{EFFECTIVE_DATE}</span>
            &ensp;·&ensp;Operated by <span className="text-slate-300 font-medium">{COMPANY}</span>
          </p>
          <p className="text-slate-500 text-xs mt-1.5">
            Version <span className="text-slate-400 font-medium">{POLICY_VERSION}</span> · Last updated{" "}
            <span className="text-slate-400 font-medium">{LAST_UPDATED}</span>
          </p>
        </div>

        {/* Intro */}
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-6 mb-10 text-slate-300 leading-relaxed">
          <p>
            <strong className="text-slate-100">Porchivo</strong> is a product of{" "}
            <strong className="text-slate-100">{COMPANY}</strong> ("we," "our," or "us"). This Privacy Policy
            explains how we collect, use, share, and protect your information when you use the Porchivo mobile
            application ("App"). By downloading, installing, or using Porchivo, you agree to the practices
            described in this policy.
          </p>
        </div>

        <Section number="1" title="Information We Collect">
          <SubHeading>a. Information You Provide</SubHeading>
          <ul className="space-y-1.5">
            <Bullet>
              <strong>Account information:</strong> Name, email address, phone number, and password when you
              create a Porchivo account.
            </Bullet>
            <Bullet>
              <strong>Profile information:</strong> Role selection (Homeowner or Porch Partner), display name,
              avatar, home address or address nickname (e.g., "Home," "Work"), shipping address, billing
              address, and delivery preferences.
            </Bullet>
            <Bullet>
              <strong>Package information:</strong> Carrier name, tracking numbers, expected delivery windows,
              item descriptions, and notes shared with your selected Porch Partner.
            </Bullet>
            <Bullet>
              <strong>Delivery details:</strong> Safe-drop preferences, access codes, gate codes, and delivery
              instructions — shared only with your assigned Porch Partner.
            </Bullet>
            <Bullet>
              <strong>Alerts and reports:</strong> Category, description text (up to 250 characters), and
              optional photos you submit through the Instant Alerts feature.
            </Bullet>
            <Bullet>
              <strong>Porch Partner data:</strong> Legal name, government ID details (processed by Stripe
              Identity), payout bank information (processed by Stripe Connect), partner bio, accepted package
              sizes, and service availability.
            </Bullet>
            <Bullet>
              <strong>Communications:</strong> Messages, feedback, or support requests you send to us or to
              other users through the App.
            </Bullet>
          </ul>

          <SubHeading>b. Information Collected Automatically</SubHeading>
          <ul className="space-y-1.5">
            <Bullet>
              <strong>Location data:</strong> With your explicit consent, we collect your approximate location
              (street and block level) to group you with nearby neighbors, display neighborhood activity, and
              power the Instant Alerts feature. We use foreground location permission only and do not track
              your precise location in the background.
            </Bullet>
            <Bullet>
              <strong>Device information:</strong> Device model, operating system version, unique device
              identifiers, and mobile network information.
            </Bullet>
            <Bullet>
              <strong>Usage data:</strong> App activity, session duration, feature interactions, crash logs,
              and performance diagnostics.
            </Bullet>
            <Bullet>
              <strong>Push notification tokens:</strong> Device tokens used to deliver notifications about
              package status changes, Porch Partner updates, and neighborhood alerts.
            </Bullet>
          </ul>

          <SubHeading>c. Information from Third Parties</SubHeading>
          <ul className="space-y-1.5">
            <Bullet>
              <strong>Contacts:</strong> If you choose to invite neighbors, we access your device contacts
              solely to facilitate SMS or email invitations. We do not store your full contact list on our
              servers.
            </Bullet>
            <Bullet>
              <strong>Stripe:</strong> For Porch Partners, Stripe processes identity verification and payout
              account information. We receive verification status and payout account IDs only — not raw ID
              documents or full financial account details.
            </Bullet>
            <Bullet>
              <strong>Advertising partners:</strong> Our ad-serving partners may collect device identifiers
              and general usage data to display relevant ads (see Section 4).
            </Bullet>
          </ul>
        </Section>

        <Section number="2" title="How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              Operate, maintain, and improve the Porchivo App and its features (Track Every Delivery,
              Neighborhood Watch, Porch Partners, Instant Alerts).
            </Bullet>
            <Bullet>Create and manage your account and authenticate your identity.</Bullet>
            <Bullet>
              Facilitate package tracking, Porch Partner coordination, and delivery driver assignments.
            </Bullet>
            <Bullet>
              Share shipping address and delivery instructions with your assigned Porch Partner so they can
              retrieve your packages accurately.
            </Bullet>
            <Bullet>
              Process Porch Partner payouts via Stripe Connect, and generate 1099 tax documents for partners
              earning above IRS thresholds.
            </Bullet>
            <Bullet>
              Send push notifications for package status updates, pickup confirmations, and suspicious
              activity alerts on your block.
            </Bullet>
            <Bullet>
              Display anonymized neighborhood delivery activity (e.g., "Package delivered on your block")
              without revealing exact addresses or personal details to other users.
            </Bullet>
            <Bullet>Display advertisements within the App to support our free service.</Bullet>
            <Bullet>Respond to your inquiries, feedback, and support requests.</Bullet>
            <Bullet>
              Detect, prevent, and address fraud, abuse, security issues, and technical problems.
            </Bullet>
            <Bullet>Comply with applicable legal obligations.</Bullet>
          </ul>
        </Section>

        <Section number="3" title="How We Share Your Information">
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4 font-semibold text-emerald-300">
            We do not sell your personal information.
          </div>
          <p>We may share your data in the following limited circumstances:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              <strong>With your Porch Partner:</strong> When you select a Porch Partner for a package, we
              share relevant delivery details (carrier, tracking number, delivery window, shipping address,
              delivery instructions, and access code) with that specific partner only.
            </Bullet>
            <Bullet>
              <strong>With neighbors on your block:</strong> Instant Alerts you submit are shared in
              anonymized form (approximate location, category, description) with opted-in neighbors. Your name
              and exact address are never displayed.
            </Bullet>
            <Bullet>
              <strong>With Stripe:</strong> Identity verification data and payout account information for
              Porch Partners is processed by Stripe. We share only what is required for identity
              verification and payout processing.
            </Bullet>
            <Bullet>
              <strong>Service providers:</strong> We work with trusted third-party providers for cloud
              hosting, analytics, crash reporting, and push notification delivery. These providers process
              data on our behalf and are contractually required to protect your information.
            </Bullet>
            <Bullet>
              <strong>Advertising partners:</strong> We use third-party ad networks to serve ads. These
              partners may collect device identifiers and general usage data in accordance with their own
              privacy policies. We do not share your name, address, tracking numbers, or package details with
              advertisers.
            </Bullet>
            <Bullet>
              <strong>Legal requirements:</strong> We may disclose your information if required by law,
              regulation, legal process, or enforceable governmental request, or to protect the rights,
              safety, or property of {COMPANY}, our users, or the public.
            </Bullet>
          </ul>
        </Section>

        <Section number="4" title="Advertising">
          <p>
            Porchivo is a free, ad-supported application. Third-party ad networks may use cookies, device
            identifiers, and similar technologies to serve relevant advertisements. You can limit personalized
            advertising through your device settings:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>iOS: Settings → Privacy &amp; Security → Tracking</Bullet>
            <Bullet>Android: Settings → Privacy → Ads</Bullet>
          </ul>
        </Section>

        <Section number="5" title="Your Rights and Choices">
          <p>
            Depending on your location, you may have the following rights regarding your personal data:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              <strong>Access:</strong> Request a copy of the personal data we hold about you.
            </Bullet>
            <Bullet>
              <strong>Correction:</strong> Request that we correct inaccurate or incomplete data.
            </Bullet>
            <Bullet>
              <strong>Deletion:</strong> Request that we delete your account and associated personal data.
              You can initiate account deletion from Settings → Account → Delete Account within the App.
            </Bullet>
            <Bullet>
              <strong>Opt-out of notifications:</strong> You can manage or disable push notifications at any
              time through your device settings or the in-app notification preferences screen.
            </Bullet>
            <Bullet>
              <strong>Opt-out of location:</strong> You can revoke location permissions at any time through
              your device settings. Some features (Neighborhood Watch, Instant Alerts) will have reduced
              functionality without location access.
            </Bullet>
            <Bullet>
              <strong>Opt-out of data sharing for ads:</strong> See Section 4 above.
            </Bullet>
          </ul>

          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mt-4">
            <p className="font-semibold text-blue-300 mb-1">For California residents (CCPA/CPRA)</p>
            <p className="text-slate-400 text-sm">
              You have the right to know what personal information we collect, request deletion, and opt out
              of the sale of personal information. We do not sell personal information. To exercise your
              rights, contact us at the address below.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 mt-4">
            <p className="font-semibold text-slate-200 mb-1">For EU/EEA residents (GDPR)</p>
            <p className="text-slate-400 text-sm">
              You have additional rights including data portability and the right to lodge a complaint with
              your local data protection authority.
            </p>
          </div>
        </Section>

        <Section number="6" title="Data Retention and Deletion">
          <p>
            We retain your personal data for as long as your account is active or as needed to provide you
            with our services. Package tracking data is retained for 90 days after delivery completion, then
            automatically deleted. Instant Alert reports are retained for 30 days, then archived in
            anonymized form.
          </p>
          <p>
            When you delete your account, we will delete or anonymize your personal data within 30 days,
            except where retention is required by law.
          </p>
        </Section>

        <Section number="7" title="Data Security">
          <p>
            We implement industry-standard security measures to protect your personal information, including
            encryption of data in transit (TLS/SSL), secure cloud storage, and access controls. Sensitive
            fields such as access codes and delivery instructions are shared only with verified, assigned
            Porch Partners and never stored in plain-readable form accessible to third parties.
          </p>
          <p>
            However, no method of electronic transmission or storage is 100% secure. We cannot guarantee
            absolute security but are committed to protecting your data to the best of our ability.
          </p>
        </Section>

        <Section number="8" title="Children's Privacy">
          <p>
            Porchivo is not intended for use by children under the age of 13. We do not knowingly collect
            personal information from children under 13. If we discover that a child under 13 has provided
            us with personal information, we will promptly delete it. If you believe a child has provided us
            with personal data, please contact us immediately.
          </p>
        </Section>

        <Section number="9" title="Changes to This Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we will
            notify you through the App or by email and update the "Effective Date" at the top of this policy.
            Your continued use of Porchivo after changes are posted constitutes your acceptance of the
            updated policy.
          </p>
        </Section>

        <Section number="10" title="Revision History">
          <p>
            We maintain a versioned record of material changes to this policy so you can verify which
            practices were in effect on a given date.
          </p>
          <ul className="space-y-3 mt-3">
            {REVISION_HISTORY.map((entry) => (
              <li
                key={entry.version}
                className="bg-slate-800/60 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-slate-100 font-semibold">Version {entry.version}</span>
                  <span className="text-slate-500 text-sm">· {entry.date}</span>
                </div>
                <p className="text-slate-400 text-sm">{entry.summary}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section number="11" title="Contact Us">
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or your personal data,
            please contact us at:
          </p>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">🏢</span>
              <span className="text-slate-200 font-semibold">{COMPANY}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">✉️</span>
              <a href="mailto:support@porchivo.com" className="text-slate-300 hover:text-emerald-400 transition-colors">
                support@porchivo.com
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">📍</span>
              <span className="text-slate-300">Indianapolis, Indiana, United States</span>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-700 text-center text-sm text-slate-500">
          © 2026 {COMPANY}. All rights reserved. · Porchivo is a product of {COMPANY}.
        </div>
      </div>
    </PageLayout>
  );
}
