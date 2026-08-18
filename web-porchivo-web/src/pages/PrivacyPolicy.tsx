import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";

const EFFECTIVE_DATE = "August 18, 2026";
const LAST_UPDATED = "August 18, 2026";
const POLICY_VERSION = "2.1";
const COMPANY = "WhichWay Web Labs LLC";

interface RevisionEntry {
  version: string;
  date: string;
  summary: string;
}

const REVISION_HISTORY: RevisionEntry[] = [
  {
    version: "2.1",
    date: "August 18, 2026",
    summary:
      "Clarified location practices: property address is provided manually; precise device GPS is collected only when a user explicitly grants location permission for a specific feature; neighbors and partners see block-level or approximate location, never your exact address unless you choose to share it.",
  },
  {
    version: "2.0",
    date: "August 14, 2026",
    summary:
      "Comprehensive rewrite reflecting Porchivo's evolution into a community management platform. Adds HOA payments, maintenance requests, amenity reservations, document library, and community governance data practices. Removes all advertising-related sections. Adds service provider table.",
  },
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
      <h2 className="text-lg font-bold text-brand-text-primary mb-3">
        {number}. {title}
      </h2>
      <div className="text-brand-text-secondary leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-brand-text-primary mt-4 mb-2">{children}</h3>;
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
        <div className="mt-8 mb-12 pb-8 border-b border-brand-navy-500/50">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold mb-4">
            🛡️ Privacy
          </div>
          <h1 className="text-4xl font-bold text-brand-text-primary mb-3">Privacy Policy</h1>
          <p className="text-brand-text-secondary text-sm">
            Effective Date: <span className="text-brand-text-secondary font-medium">{EFFECTIVE_DATE}</span>
            &ensp;·&ensp;Operated by <span className="text-brand-text-secondary font-medium">{COMPANY}</span>
          </p>
          <p className="text-brand-text-muted text-xs mt-1.5">
            Version <span className="text-brand-text-secondary font-medium">{POLICY_VERSION}</span> · Last updated{" "}
            <span className="text-brand-text-secondary font-medium">{LAST_UPDATED}</span>
          </p>
        </div>

        {/* Intro */}
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-6 mb-10 text-brand-text-secondary leading-relaxed">
          <p>
            <strong className="text-brand-text-primary">Porchivo</strong> ("Porchivo," "we," "us," or "our") is a community
            management platform that helps homeowners associations, residents, board members, and property managers
            communicate, manage payments, handle maintenance requests, and access community documents — all in one
            place.
          </p>
          <p className="mt-3">
            This Privacy Policy explains what information we collect, how we use it, who we share it with, and what
            rights you have over your data.
          </p>
          <p className="mt-3">
            If you have questions, contact us at:{" "}
            <a href="mailto:support@porchivo.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              <strong>support@porchivo.com</strong>
            </a>
          </p>
        </div>

        <Section number="1" title="Who This Policy Applies To">
          <p>This policy applies to:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              <strong>Residents and homeowners</strong> who use the Porchivo mobile app to interact with their
              community
            </Bullet>
            <Bullet>
              <strong>HOA board members</strong> who use Porchivo to manage their community
            </Bullet>
            <Bullet>
              <strong>Property managers</strong> who use Porchivo to manage one or more communities
            </Bullet>
            <Bullet>
              <strong>Visitors</strong> to our website at porchivo.com
            </Bullet>
          </ul>
          <p className="mt-3">
            If your HOA or property management company has a separate agreement with Porchivo, that agreement may
            include additional privacy terms that apply to your community's data.
          </p>
        </Section>

        <Section number="2" title="What Information We Collect">
          <SubHeading>a. Information You Give Us Directly</SubHeading>
          <ul className="space-y-1.5">
            <Bullet>
              <strong>Account information</strong> — your name, email address, phone number, and password when you
              create an account
            </Bullet>
            <Bullet>
              <strong>Profile information</strong> — your unit or property address, role in the community (resident,
              board member, property manager), and community membership
            </Bullet>
            <Bullet>
              <strong>Maintenance requests</strong> — descriptions, photos, and details you submit when reporting a
              maintenance issue
            </Bullet>
            <Bullet>
              <strong>Messages and announcements</strong> — content you post, publish, or send through the platform
            </Bullet>
            <Bullet>
              <strong>Documents</strong> — files you upload or access through your community's document library
            </Bullet>
            <Bullet>
              <strong>Amenity reservations</strong> — dates, times, and details of reservations you make for community
              spaces
            </Bullet>
            <Bullet>
              <strong>Support communications</strong> — messages you send us when you contact support
            </Bullet>
          </ul>

          <SubHeading>b. Payment Information</SubHeading>
          <p>
            When you pay HOA dues, assessments, or fees through Porchivo, payment processing is handled by our
            third-party payment processor. We do not store your full credit card number, debit card number, or bank
            account details on our servers. We receive and store:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Payment confirmation and transaction ID</Bullet>
            <Bullet>Payment amount, date, and type</Bullet>
            <Bullet>Last four digits of the card used (for your records)</Bullet>
            <Bullet>Payment status and history</Bullet>
          </ul>
          <p className="mt-3">
            Your full payment credentials are handled exclusively by our payment processor under their own security
            and privacy standards.
          </p>

          <SubHeading>c. Information Collected Automatically</SubHeading>
          <p>When you use the Porchivo app or website, we automatically collect:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              <strong>Device information</strong> — device type, operating system, and app version
            </Bullet>
            <Bullet>
              <strong>Usage data</strong> — features you use, screens you visit, and actions you take in the app
            </Bullet>
            <Bullet>
              <strong>Push notification tokens</strong> — a device identifier used to deliver notifications to your
              device
            </Bullet>
            <Bullet>
              <strong>Crash and error reports</strong> — technical information about app errors to help us fix
              problems
            </Bullet>
            <Bullet>
              <strong>IP address and general location</strong> — used for security and fraud prevention, not for
              precise location tracking
            </Bullet>
          </ul>

          <SubHeading>d. Location Information</SubHeading>
          <p>
            Your primary location in Porchivo is the <strong>property address</strong> you enter during onboarding or
            profile setup (for example, your street address or unit number). This address is used to match you with
            your community, calculate neighborhood-level risk scores, and connect you with nearby porch partners.
          </p>
          <p className="mt-3">
            We do <strong>not</strong> collect your precise device GPS coordinates unless you explicitly grant location
            permission for a specific in-app feature that requires it (such as partner drop-off navigation or
            map-based neighborhood alerts). When location permission is granted, it is used only for that feature and
            is not stored or shared beyond what is necessary to provide the service.
          </p>
          <p className="mt-3">
            By default, other users — including neighbors and porch partners — see only your block-level or
            approximate location. They do not see your exact street address or precise GPS coordinates unless you
            explicitly choose to share that information for a specific delivery or request.
          </p>

          <SubHeading>e. Information From Your Community</SubHeading>
          <p>
            Because Porchivo is a community platform, some information about you may be provided by your HOA or
            property management company when they set up your community account. This may include your name, unit
            address, email, and community role. This information is used solely to give you access to your community's
            Porchivo account.
          </p>
        </Section>

        <Section number="3" title="How We Use Your Information">
          <p>We use your information to:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Create and manage your Porchivo account</Bullet>
            <Bullet>Give you access to your community's announcements, documents, and tools</Bullet>
            <Bullet>Process HOA dues payments and maintain payment records</Bullet>
            <Bullet>Send and receive maintenance requests within your community</Bullet>
            <Bullet>
              Deliver push notifications about community updates, payment reminders, and maintenance status
            </Bullet>
            <Bullet>Respond to your support requests</Bullet>
            <Bullet>Improve the Porchivo platform and fix bugs</Bullet>
            <Bullet>Detect, prevent, and address fraud, abuse, and security incidents</Bullet>
            <Bullet>Meet our legal obligations</Bullet>
          </ul>
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4 mt-4 font-semibold text-emerald-300">
            We do not use your information to serve you ads. Porchivo does not sell your personal information to
            anyone.
          </div>
        </Section>

        <Section number="4" title="Push Notifications">
          <p>
            Porchivo sends push notifications to keep you informed about your community. Notifications may include:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Community announcements and alerts</Bullet>
            <Bullet>Payment reminders and confirmations</Bullet>
            <Bullet>Maintenance request status updates</Bullet>
            <Bullet>Meeting and event reminders</Bullet>
          </ul>
          <p className="mt-3">
            <strong className="text-brand-text-primary">You are in control.</strong> You can turn off push notifications at any
            time through your device settings or within the Porchivo app. Turning off notifications does not affect
            your ability to use the app.
          </p>
          <p className="mt-2">
            We do not include sensitive information — such as payment amounts, delinquency status, or personal
            details — in the notification text itself. Sensitive details are only visible inside the app after you log
            in.
          </p>
        </Section>

        <Section number="5" title="How We Share Your Information">
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4 font-semibold text-emerald-300">
            We do not sell your personal information. We share your information only in these circumstances:
          </div>

          <SubHeading>a. With Your Community</SubHeading>
          <p>
            Information you submit — such as maintenance requests, document uploads, and announcements — is shared
            with authorized members of your HOA board or property management company as part of the platform's
            function. This is necessary for the service to work.
          </p>

          <SubHeading>b. With Service Providers</SubHeading>
          <p>
            We use trusted third-party companies to help us operate Porchivo. These providers only process your data
            on our behalf and under our instructions:
          </p>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm border border-brand-navy-500/50 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-brand-navy-700 text-brand-text-primary">
                  <th className="text-left px-4 py-2 font-semibold">Provider</th>
                  <th className="text-left px-4 py-2 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-brand-text-secondary">
                <tr className="border-t border-brand-navy-500/50">
                  <td className="px-4 py-2 font-medium text-brand-text-primary">Supabase</td>
                  <td className="px-4 py-2">Database and authentication infrastructure</td>
                </tr>
                <tr className="border-t border-brand-navy-500/50">
                  <td className="px-4 py-2 font-medium text-brand-text-primary">Resend</td>
                  <td className="px-4 py-2">Transactional email delivery (account confirmations, deletion notices)</td>
                </tr>
                <tr className="border-t border-brand-navy-500/50">
                  <td className="px-4 py-2 font-medium text-brand-text-primary">Payment processor (e.g., Stripe)</td>
                  <td className="px-4 py-2">Secure payment processing for HOA dues and fees</td>
                </tr>
                <tr className="border-t border-brand-navy-500/50">
                  <td className="px-4 py-2 font-medium text-brand-text-primary">Push notification service</td>
                  <td className="px-4 py-2">Delivery of app notifications to your device</td>
                </tr>
                <tr className="border-t border-brand-navy-500/50">
                  <td className="px-4 py-2 font-medium text-brand-text-primary">Crash reporting service</td>
                  <td className="px-4 py-2">App error detection and stability monitoring</td>
                </tr>
              </tbody>
            </table>
          </div>

          <SubHeading>c. For Legal Reasons</SubHeading>
          <p>
            We may disclose your information if required by law, court order, or government authority, or if we
            believe disclosure is necessary to protect the safety of any person or to prevent fraud or illegal
            activity.
          </p>

          <SubHeading>d. Business Transfers</SubHeading>
          <p>
            If Porchivo is acquired, merged with, or sold to another company, your information may be transferred as
            part of that transaction. We will notify you before your information becomes subject to a different
            privacy policy.
          </p>
        </Section>

        <Section number="6" title="Data Retention">
          <p>
            We keep your personal information for as long as your account is active or as long as needed to provide
            the service.
          </p>
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mt-3">
            <p className="text-brand-text-secondary text-sm">
              <strong className="text-blue-300">HOA payment and transaction records</strong> may be retained beyond
              account deletion as required by your homeowners association's legal and financial recordkeeping
              obligations. This data belongs to the community's records, not your personal profile.
            </p>
          </div>
          <p className="mt-3">
            When you request account deletion, your personal data is permanently removed within{" "}
            <strong className="text-brand-text-primary">30 days</strong>. See "Your Rights and Choices" below for details.
          </p>
        </Section>

        <Section number="7" title="Your Rights and Choices">
          <SubHeading>a. Access and Correction</SubHeading>
          <p>You can view and update your account information at any time from your profile settings in the app.</p>

          <SubHeading>b. Account Deletion</SubHeading>
          <p>
            You can request permanent deletion of your Porchivo account from{" "}
            <strong className="text-brand-text-primary">Settings → Account → Delete Account</strong>. Your account will be
            deactivated immediately and permanently deleted within 30 days. You may cancel this request within 30 days
            by contacting{" "}
            <a href="mailto:support@porchivo.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              support@porchivo.com
            </a>
            .
          </p>
          <p className="mt-2 text-sm text-brand-text-secondary">
            Note: Account deletion removes your personal profile data. It does not erase HOA financial records that
            your association is legally required to retain.
          </p>

          <SubHeading>c. Push Notifications</SubHeading>
          <p>
            You can disable push notifications through your device settings or inside the Porchivo app at any time.
          </p>

          <SubHeading>d. Photo and Camera Access</SubHeading>
          <p>
            Porchivo requests camera or photo library access only when you choose to attach a photo to a maintenance
            request. You can revoke this permission at any time through your device settings.
          </p>

          <SubHeading>e. California Residents (CCPA)</SubHeading>
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mt-2">
            <p className="text-brand-text-secondary text-sm">
              If you are a California resident, you have the right to:
            </p>
            <ul className="space-y-1.5 mt-2">
              <Bullet>Know what personal information we collect and how we use it</Bullet>
              <Bullet>Request deletion of your personal information</Bullet>
              <Bullet>Opt out of the sale of your personal information (we do not sell personal information)</Bullet>
              <Bullet>Not be discriminated against for exercising your privacy rights</Bullet>
            </ul>
            <p className="text-brand-text-secondary text-sm mt-2">
              To make a request, contact us at{" "}
              <a href="mailto:support@porchivo.com" className="text-blue-300 hover:text-blue-200 transition-colors">
                support@porchivo.com
              </a>
              .
            </p>
          </div>

          <SubHeading>f. Virginia, Colorado, and Other U.S. State Privacy Laws</SubHeading>
          <p>
            Residents of states with comprehensive privacy laws (including Virginia, Colorado, Connecticut, Utah, and
            others) have similar rights to access, correct, delete, and opt out of certain uses of personal data.
            Contact us at{" "}
            <a href="mailto:support@porchivo.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              support@porchivo.com
            </a>{" "}
            to make a request.
          </p>
        </Section>

        <Section number="8" title="Children's Privacy">
          <p>
            Porchivo is not directed to children under the age of 13. We do not knowingly collect personal
            information from children under 13. If you believe a child under 13 has provided us with personal
            information, please contact us at{" "}
            <a href="mailto:support@porchivo.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              support@porchivo.com
            </a>{" "}
            and we will delete it.
          </p>
        </Section>

        <Section number="9" title="Security">
          <p>
            We take reasonable technical and organizational measures to protect your information from unauthorized
            access, disclosure, or loss. This includes encrypted data transmission (HTTPS/TLS), secure authentication,
            and role-based access controls so that only authorized community members can see community-specific data.
          </p>
          <p>
            No system is completely secure. If you believe your account has been compromised, contact us immediately
            at{" "}
            <a href="mailto:support@porchivo.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              support@porchivo.com
            </a>
            .
          </p>
        </Section>

        <Section number="10" title="Third-Party Links">
          <p>
            The Porchivo app or your community's documents may contain links to external websites or resources. We are
            not responsible for the privacy practices of those third parties. Review their privacy policies before
            providing them with any information.
          </p>
        </Section>

        <Section number="11" title="Changes to This Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you
            through the app or by email before the changes take effect. Your continued use of Porchivo after the
            effective date of any update means you accept the revised policy.
          </p>
        </Section>

        <Section number="12" title="Revision History">
          <p>
            We maintain a versioned record of material changes to this policy so you can verify which practices were
            in effect on a given date.
          </p>
          <ul className="space-y-3 mt-3">
            {REVISION_HISTORY.map((entry) => (
              <li
                key={entry.version}
                className="bg-brand-navy-800/60 border border-brand-navy-500/50 rounded-lg p-4"
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-brand-text-primary font-semibold">Version {entry.version}</span>
                  <span className="text-brand-text-muted text-sm">· {entry.date}</span>
                </div>
                <p className="text-brand-text-secondary text-sm">{entry.summary}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section number="13" title="Contact Us">
          <p>
            If you have questions, concerns, or requests related to this Privacy Policy, contact us at:
          </p>
          <div className="bg-brand-navy-700 border border-brand-navy-500/50 rounded-xl p-5 mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">🏢</span>
              <span className="text-brand-text-primary font-semibold">Porchivo Support</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">✉️</span>
              <a href="mailto:support@porchivo.com" className="text-brand-text-secondary hover:text-emerald-400 transition-colors">
                support@porchivo.com
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">🌐</span>
              <span className="text-brand-text-secondary">porchivo.com</span>
            </div>
          </div>
        </Section>

        {/* Legal notice */}
        <div className="mt-8 bg-brand-navy-800/40 border border-brand-navy-500/50/50 rounded-lg p-4">
          <p className="text-xs text-brand-text-muted leading-relaxed">
            <strong>Legal Notice:</strong> This document was drafted to reflect Porchivo's known data practices as of
            the effective date. It is strongly recommended that a licensed attorney review this policy before
            publishing, particularly if Porchivo operates in or serves users in jurisdictions with specific privacy
            law requirements (including California, the European Union, or Canada).
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-brand-navy-500/50 text-center text-sm text-brand-text-muted">
          © 2026 {COMPANY}. All rights reserved. · Porchivo is a product of {COMPANY}.
        </div>
      </div>
    </PageLayout>
  );
}
