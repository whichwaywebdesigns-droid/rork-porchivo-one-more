import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";

const EFFECTIVE_DATE = "June 22, 2026";
const COMPANY = "WhichWay Web Labs LLC";

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

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

export default function TermsOfServicePage() {
  return (
    <PageLayout>
      <SEOHead
        title="Terms of Service — Porchivo"
        description={`Terms of Service for Porchivo, operated by ${COMPANY}. Effective ${EFFECTIVE_DATE}.`}
        canonical={`${BRAND.url}/terms`}
        ogTitle="Porchivo Terms of Service"
        ogDescription={`Terms and conditions governing use of the Porchivo app, operated by ${COMPANY}.`}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <BreadcrumbNav items={[{ label: "Home", href: "/" }, { label: "Terms of Service", href: "/terms" }]} />

        {/* Header */}
        <div className="mt-8 mb-12 pb-8 border-b border-slate-700">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold mb-4">
            📄 Legal
          </div>
          <h1 className="text-4xl font-bold text-slate-100 mb-3">Terms of Service</h1>
          <p className="text-slate-400 text-sm">
            Effective Date: <span className="text-slate-300 font-medium">{EFFECTIVE_DATE}</span>
            &ensp;·&ensp;Operated by <span className="text-slate-300 font-medium">{COMPANY}</span>
          </p>
        </div>

        {/* Intro */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 mb-10 text-slate-300 leading-relaxed">
          <p>
            Welcome to <strong className="text-slate-100">Porchivo</strong>, a mobile application developed
            and operated by <strong className="text-slate-100">{COMPANY}</strong> ("Company," "we," "our," or
            "us"). These Terms of Service ("Terms") govern your access to and use of the Porchivo application
            ("App"), including all features, content, and services available through it.
          </p>
          <p className="mt-3">
            By creating an account or using Porchivo, you agree to be bound by these Terms and our{" "}
            <a href="#/privacy" className="text-amber-400 hover:text-amber-300 transition-colors underline">
              Privacy Policy
            </a>
            . If you do not agree, do not download, install, or use the App.
          </p>
        </div>

        {/* Sections */}
        <Section number="1" title="Eligibility">
          <p>
            You must be at least 18 years of age to create an account and use Porchivo. By using the App, you
            represent and warrant that you meet this age requirement and have the legal capacity to enter into
            these Terms. We do not knowingly allow users under 18 to register or use the App.
          </p>
        </Section>

        <Section number="2" title="Account Registration">
          <p>
            To use Porchivo, you must create an account and provide accurate, current, and complete information
            including your name, email address, and phone number. You are responsible for:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Maintaining the confidentiality of your login credentials.</Bullet>
            <Bullet>All activity that occurs under your account.</Bullet>
            <Bullet>Promptly notifying us of any unauthorized access or use of your account.</Bullet>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that contain false information or violate
            these Terms.
          </p>
        </Section>

        <Section number="3" title="Description of Service">
          <p>
            Porchivo is a free, ad-supported neighborhood safety application designed to help communities
            prevent package theft. The App provides the following features:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              <strong>Track Every Delivery:</strong> Log incoming packages, add tracking numbers, and receive
              real-time status updates.
            </Bullet>
            <Bullet>
              <strong>Neighborhood Watch:</strong> View anonymized delivery activity on your block in near
              real-time.
            </Bullet>
            <Bullet>
              <strong>Porch Partners:</strong> Coordinate with trusted neighbors who can hold packages on your
              behalf when you are away.
            </Bullet>
            <Bullet>
              <strong>Instant Alerts:</strong> Report and receive notifications about suspicious activity
              related to package safety in your neighborhood.
            </Bullet>
          </ul>
          <p>
            Users may select one of two roles upon sign-in: Homeowner or Porch Partner. Roles may be changed
            at any time within the App.
          </p>
        </Section>

        <Section number="4" title="License to Use">
          <p>
            We grant you a limited, non-exclusive, non-transferable, revocable license to download, install,
            and use Porchivo on a compatible mobile device that you own or control, solely for your personal,
            non-commercial use in accordance with these Terms.
          </p>
          <p>This license does not grant you any right to:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Modify, reverse-engineer, decompile, or disassemble the App or any part of it.</Bullet>
            <Bullet>Reproduce, distribute, publicly display, or create derivative works from the App.</Bullet>
            <Bullet>Use the App for any commercial purpose without our prior written consent.</Bullet>
            <Bullet>Remove, alter, or obscure any copyright, trademark, or proprietary notices.</Bullet>
          </ul>
        </Section>

        <Section number="5" title="User Conduct and Acceptable Use">
          <p>By using Porchivo, you agree to:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              Use the App only for its intended purpose of neighborhood package protection and community safety.
            </Bullet>
            <Bullet>
              Provide truthful and accurate information in all package entries, alerts, and communications.
            </Bullet>
            <Bullet>Treat other users with respect and courtesy.</Bullet>
            <Bullet>Comply with all applicable local, state, and federal laws.</Bullet>
          </ul>
        </Section>

        <Section number="6" title="Prohibited Activities">
          <p>You agree not to:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Submit false, misleading, or malicious Instant Alert reports.</Bullet>
            <Bullet>Use the App to harass, stalk, threaten, or intimidate any person.</Bullet>
            <Bullet>Impersonate another person or misrepresent your identity or role.</Bullet>
            <Bullet>Intercept, tamper with, or steal packages belonging to others.</Bullet>
            <Bullet>Use the App to facilitate any illegal activity.</Bullet>
            <Bullet>Collect personal information about other users without their consent.</Bullet>
            <Bullet>
              Attempt to gain unauthorized access to the App, its servers, or other users' accounts.
            </Bullet>
            <Bullet>Upload viruses, malware, or any harmful code.</Bullet>
            <Bullet>Spam, solicit, or send unsolicited communications to other users.</Bullet>
            <Bullet>Use automated bots, scrapers, or similar tools to access the App.</Bullet>
          </ul>
          <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 mt-4 text-red-300">
            Violation of these rules may result in immediate suspension or permanent termination of your
            account at our sole discretion.
          </div>
        </Section>

        <Section number="7" title="User-Generated Content">
          <p>
            Porchivo allows you to submit content including package descriptions, Instant Alert reports,
            photos, and text descriptions ("User Content"). By submitting User Content, you:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Retain ownership of your original content.</Bullet>
            <Bullet>
              Grant {COMPANY} a worldwide, royalty-free, non-exclusive license to use, display, reproduce, and
              distribute your User Content solely for the purpose of operating and improving the App.
            </Bullet>
            <Bullet>
              Represent and warrant that your User Content does not violate any third party's rights,
              including intellectual property, privacy, or publicity rights.
            </Bullet>
            <Bullet>
              Acknowledge that User Content submitted through Instant Alerts will be shared in anonymized form
              with nearby opted-in users.
            </Bullet>
          </ul>
          <p>
            We reserve the right to remove any User Content that violates these Terms or that we deem
            inappropriate, without prior notice.
          </p>
        </Section>

        <Section number="8" title="Porch Partner Responsibilities">
          <p>If you choose the Porch Partner role, you agree to:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Handle all packages entrusted to you with reasonable care.</Bullet>
            <Bullet>
              Pick up packages promptly after delivery notification and return them to the homeowner within the
              agreed timeframe.
            </Bullet>
            <Bullet>Not open, tamper with, or damage any package.</Bullet>
            <Bullet>
              Not share tracking numbers, delivery details, or personal information of homeowners with any
              third party.
            </Bullet>
          </ul>
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 mt-4">
            <p className="font-semibold text-slate-200 mb-1">Important Disclaimer</p>
            <p className="text-slate-400 text-sm">
              Porchivo is a coordination platform only. {COMPANY} is not responsible for lost, stolen, or
              damaged packages. All package hand-offs between Homeowners and Porch Partners are voluntary,
              neighbor-to-neighbor arrangements. Users participate at their own risk.
            </p>
          </div>
        </Section>

        <Section number="9" title="No Vetting, Background Checks, or Endorsement">
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-sm uppercase tracking-wide leading-relaxed">
            PORCHIVO DOES NOT VET, SCREEN, BACKGROUND-CHECK, IDENTITY-VERIFY, OR OTHERWISE INVESTIGATE ANY
            USER, HOMEOWNER, PORCH PARTNER, NEIGHBOR, OR THIRD PARTY.
          </div>
          <p>
            Porchivo is a neutral coordination and information platform that connects neighbors. We do not
            employ, supervise, direct, or control any user, and no user is our agent, employee, partner, or
            representative. Specifically, you acknowledge and agree that:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              We do not conduct criminal, identity, credit, reference, or other background checks on any user,
              and any optional verification badge a user may obtain does not constitute a guarantee,
              endorsement, or warranty by us as to that person's identity, trustworthiness, character, or
              fitness.
            </Bullet>
            <Bullet>
              We make no representation or warranty regarding the conduct, reliability, honesty, or suitability
              of any Homeowner, Porch Partner, or other user.
            </Bullet>
            <Bullet>
              You are solely responsible for deciding whether to interact with, share information with, hand
              packages to, or allow access to any other user, and for taking your own precautions.
            </Bullet>
            <Bullet>
              Listing, matching, or appearing in the App is not an endorsement or recommendation of any user
              by {COMPANY}.
            </Bullet>
          </ul>
        </Section>

        <Section number="10" title="Assumption of Risk; Personal Injury and Bodily Harm">
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-sm uppercase tracking-wide leading-relaxed">
            YOU USE PORCHIVO AND PARTICIPATE IN ANY NEIGHBOR-TO-NEIGHBOR ARRANGEMENT ENTIRELY AT YOUR OWN
            RISK. {COMPANY.toUpperCase()} IS NOT RESPONSIBLE OR LIABLE FOR ANY BODILY INJURY, PERSONAL INJURY,
            EMOTIONAL DISTRESS, ILLNESS, DEATH, OR PROPERTY DAMAGE ARISING OUT OF OR RELATED TO YOUR USE OF
            THE APP OR YOUR INTERACTIONS WITH OTHER USERS.
          </div>
          <p>
            Porchivo facilitates in-person, real-world interactions between neighbors, including package
            hand-offs, meetups, and entering or approaching another person's property. By using the App, you
            knowingly and voluntarily assume all risks associated with those interactions, including but not
            limited to:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              Physical injury, assault, harassment, theft, or property damage caused by another user or third
              party.
            </Bullet>
            <Bullet>
              Slips, falls, accidents, animal encounters, or other hazards on any property you visit or where
              a hand-off occurs.
            </Bullet>
            <Bullet>
              Any dispute, altercation, or harm that arises before, during, or after a Porch Partner
              arrangement or any other coordinated activity.
            </Bullet>
          </ul>
          <p>
            To the maximum extent permitted by law, you release and discharge {COMPANY} and its officers,
            directors, employees, and agents from any and all claims, demands, damages, and liabilities of
            every kind — whether for bodily injury, personal injury, death, or property loss or damage —
            arising out of or in any way connected with your use of the App or your interactions with other
            users. You are encouraged to meet in safe locations, take reasonable safety precautions, and
            contact local law enforcement (call 911) in any emergency.
          </p>
        </Section>

        <Section number="11" title="Instant Alerts Disclaimer">
          <p>
            The Instant Alerts feature allows users to share neighbor-to-neighbor tips about suspicious
            activity on their block. Instant Alerts are not police reports, emergency services, or official
            crime reports. By using this feature, you understand that:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>
              You should contact local law enforcement (call 911) for any emergency or crime in progress.
            </Bullet>
            <Bullet>{COMPANY} does not verify the accuracy of user-submitted alerts.</Bullet>
            <Bullet>
              You are solely responsible for the content and accuracy of any alert you submit.
            </Bullet>
            <Bullet>
              Submitting knowingly false reports may result in account termination and may violate applicable
              laws.
            </Bullet>
          </ul>
        </Section>

        <Section number="12" title="Advertising">
          <p>
            Porchivo is a free application supported by third-party advertisements. By using the App, you
            agree to the display of ads within the App. Ad content is provided by third-party networks and
            does not constitute our endorsement. Your interactions with advertisers are solely between you and
            the advertiser.
          </p>
        </Section>

        <Section number="13" title="Intellectual Property">
          <p>
            All rights, title, and interest in and to the Porchivo App, including its design, logos,
            "Porchivo" name, the slogan "When porch pirates lurk, neighbors go to work," graphics, software,
            and all related intellectual property, are owned by {COMPANY} and are protected by United States
            and international copyright, trademark, and other intellectual property laws.
          </p>
          <p>
            You may not use our trademarks, trade names, or branding without our prior written permission.
          </p>
        </Section>

        <Section number="14" title="Privacy">
          <p>
            Your use of Porchivo is also governed by our{" "}
            <a href="#/privacy" className="text-amber-400 hover:text-amber-300 transition-colors underline">
              Privacy Policy
            </a>
            , which describes how we collect, use, share, and protect your information. By using the App, you
            consent to the practices described in the Privacy Policy. The Privacy Policy is incorporated into
            these Terms by reference.
          </p>
        </Section>

        <Section number="15" title="Third-Party Services">
          <p>
            The App may contain links to or integrations with third-party services, including but not limited
            to mapping services, carrier tracking APIs, and ad networks. These third-party services are
            governed by their own terms and privacy policies. {COMPANY} is not responsible for the content,
            accuracy, or practices of any third-party service.
          </p>
        </Section>

        <Section number="16" title="Disclaimers">
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-sm uppercase tracking-wide leading-relaxed">
            THE APP IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND,
            WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </div>
          <p>We do not warrant that:</p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>The App will be uninterrupted, error-free, or secure.</Bullet>
            <Bullet>Package tracking information will be accurate or up to date.</Bullet>
            <Bullet>
              Instant Alerts or Neighborhood Watch activity reflects verified or accurate information.
            </Bullet>
            <Bullet>The App will meet your specific requirements.</Bullet>
          </ul>
        </Section>

        <Section number="17" title="Limitation of Liability">
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-sm uppercase tracking-wide leading-relaxed space-y-3">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {COMPANY.toUpperCase()}, ITS OFFICERS,
              DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR
              PROPERTY, ARISING OUT OF OR RELATED TO YOUR USE OF THE APP.
            </p>
            <p>
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12)
              MONTHS PRECEDING THE CLAIM, OR $100 USD, WHICHEVER IS GREATER.
            </p>
          </div>
        </Section>

        <Section number="18" title="Indemnification">
          <p>
            You agree to defend, indemnify, and hold harmless {COMPANY} and its officers, directors,
            employees, and agents from and against any claims, liabilities, damages, losses, and expenses
            (including reasonable attorneys' fees) arising out of or related to:
          </p>
          <ul className="space-y-1.5 mt-2">
            <Bullet>Your use or misuse of the App.</Bullet>
            <Bullet>Your User Content.</Bullet>
            <Bullet>Your violation of these Terms.</Bullet>
            <Bullet>Your violation of any rights of a third party.</Bullet>
            <Bullet>Any package loss, damage, or theft occurring during a Porch Partner arrangement.</Bullet>
          </ul>
        </Section>

        <Section number="19" title="Account Termination">
          <p>
            We may suspend or terminate your account at any time, with or without notice, for conduct that we
            believe violates these Terms, is harmful to other users, or is otherwise objectionable.
          </p>
          <p>
            You may delete your account at any time through Settings → Account → Delete Account. Your
            account will be deactivated immediately and your personal data will be permanently deleted
            within 30 days. You may contact us within the 30-day window to restore your account. Upon
            deletion, your personal data will be handled in accordance with our Privacy Policy.
          </p>
        </Section>

        <Section number="20" title="Governing Law and Dispute Resolution">
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State of
            Indiana, United States, without regard to its conflict of law provisions.
          </p>
          <p>
            Any dispute arising out of or relating to these Terms or the App shall first be attempted to be
            resolved through good-faith negotiation. If unresolved within thirty (30) days, either party may
            pursue binding arbitration administered in Indianapolis, Indiana, in accordance with the rules of
            the American Arbitration Association. You agree to waive any right to a jury trial or to
            participate in a class action lawsuit.
          </p>
        </Section>

        <Section number="21" title="Changes to These Terms">
          <p>
            We reserve the right to modify these Terms at any time. When we make material changes, we will
            notify you through the App or by email and update the "Effective Date" at the top of this
            document. Your continued use of Porchivo after changes are posted constitutes acceptance of the
            revised Terms.
          </p>
        </Section>

        <Section number="22" title="Severability">
          <p>
            If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions
            shall remain in full force and effect.
          </p>
        </Section>

        <Section number="23" title="Entire Agreement">
          <p>
            These Terms, together with the Privacy Policy and any other legal documents referenced herein,
            constitute the entire agreement between you and {COMPANY} regarding your use of Porchivo and
            supersede all prior agreements and understandings.
          </p>
        </Section>

        <Section number="24" title="Contact Us">
          <p>If you have questions or concerns about these Terms, please contact us at:</p>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-amber-400">🏢</span>
              <span className="text-slate-200 font-semibold">{COMPANY}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-amber-400">✉️</span>
              <a href="mailto:support@porchivo.com" className="text-slate-300 hover:text-amber-400 transition-colors">
                support@porchivo.com
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-amber-400">📍</span>
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
