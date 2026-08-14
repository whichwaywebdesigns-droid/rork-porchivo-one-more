import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Shield, Mail, Globe, Building2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

const EFFECTIVE_DATE = 'August 14, 2026';
const LAST_UPDATED = 'August 14, 2026';
const POLICY_VERSION = '2.0';

interface RevisionEntry {
  version: string;
  date: string;
  summary: string;
}

const REVISION_HISTORY: RevisionEntry[] = [
  {
    version: '2.0',
    date: 'August 14, 2026',
    summary:
      'Comprehensive rewrite reflecting Porchivo\'s evolution into a community management platform. Adds HOA payments, maintenance requests, amenity reservations, document library, and community governance data practices. Removes all advertising-related sections. Adds service provider table.',
  },
  {
    version: '1.0',
    date: 'February 19, 2026',
    summary:
      'Initial published policy. Foreground-only location, first-party (non-tracking) advertising, 90-day package-data retention, 30-day deletion window.',
  },
];

interface SectionProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function Section({ number, title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{number}. {title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function SubHeading({ text }: { text: string }) {
  return <Text style={styles.subHeading}>{text}</Text>;
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Privacy Policy',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ marginRight: 8 }}>
              <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Shield size={28} color={Colors.white} />
          </View>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>Effective Date: {EFFECTIVE_DATE}</Text>
          <Text style={styles.headerVersion}>Version {POLICY_VERSION} · Last updated {LAST_UPDATED}</Text>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            <Text style={styles.bold}>Porchivo</Text> ("Porchivo," "we," "us," or "our") is a community management platform that helps homeowners associations, residents, board members, and property managers communicate, manage payments, handle maintenance requests, and access community documents — all in one place.
          </Text>
          <Text style={[styles.introText, { marginTop: 10 }]}>
            This Privacy Policy explains what information we collect, how we use it, who we share it with, and what rights you have over your data.
          </Text>
          <Text style={[styles.introText, { marginTop: 10 }]}>
            If you have questions, contact us at: <Text style={styles.bold}>support@porchivo.com</Text>
          </Text>
        </View>

        <Section number="1" title="Who This Policy Applies To">
          <Text style={styles.body}>This policy applies to:</Text>
          <Bullet text="Residents and homeowners who use the Porchivo mobile app to interact with their community" />
          <Bullet text="HOA board members who use Porchivo to manage their community" />
          <Bullet text="Property managers who use Porchivo to manage one or more communities" />
          <Bullet text="Visitors to our website at porchivo.com" />
          <Text style={[styles.body, { marginTop: 8 }]}>
            If your HOA or property management company has a separate agreement with Porchivo, that agreement may include additional privacy terms that apply to your community's data.
          </Text>
        </Section>

        <Section number="2" title="What Information We Collect">
          <SubHeading text="a. Information You Give Us Directly" />
          <Bullet text="Account information — your name, email address, phone number, and password when you create an account" />
          <Bullet text="Profile information — your unit or property address, role in the community (resident, board member, property manager), and community membership" />
          <Bullet text="Maintenance requests — descriptions, photos, and details you submit when reporting a maintenance issue" />
          <Bullet text="Messages and announcements — content you post, publish, or send through the platform" />
          <Bullet text="Documents — files you upload or access through your community's document library" />
          <Bullet text="Amenity reservations — dates, times, and details of reservations you make for community spaces" />
          <Bullet text="Support communications — messages you send us when you contact support" />

          <SubHeading text="b. Payment Information" />
          <Text style={styles.body}>
            When you pay HOA dues, assessments, or fees through Porchivo, payment processing is handled by our third-party payment processor. We do not store your full credit card number, debit card number, or bank account details on our servers. We receive and store:
          </Text>
          <Bullet text="Payment confirmation and transaction ID" />
          <Bullet text="Payment amount, date, and type" />
          <Bullet text="Last four digits of the card used (for your records)" />
          <Bullet text="Payment status and history" />
          <Text style={[styles.body, { marginTop: 8 }]}>
            Your full payment credentials are handled exclusively by our payment processor under their own security and privacy standards.
          </Text>

          <SubHeading text="c. Information Collected Automatically" />
          <Text style={styles.body}>When you use the Porchivo app or website, we automatically collect:</Text>
          <Bullet text="Device information — device type, operating system, and app version" />
          <Bullet text="Usage data — features you use, screens you visit, and actions you take in the app" />
          <Bullet text="Push notification tokens — a device identifier used to deliver notifications to your device" />
          <Bullet text="Crash and error reports — technical information about app errors to help us fix problems" />
          <Bullet text="IP address and general location — used for security and fraud prevention, not for precise location tracking" />
          <Text style={[styles.body, { marginTop: 8 }]}>
            We do not collect your precise GPS location unless you explicitly grant location permission for a specific feature that requires it.
          </Text>

          <SubHeading text="d. Information From Your Community" />
          <Text style={styles.body}>
            Because Porchivo is a community platform, some information about you may be provided by your HOA or property management company when they set up your community account. This may include your name, unit address, email, and community role. This information is used solely to give you access to your community's Porchivo account.
          </Text>
        </Section>

        <Section number="3" title="How We Use Your Information">
          <Text style={styles.body}>We use your information to:</Text>
          <Bullet text="Create and manage your Porchivo account" />
          <Bullet text="Give you access to your community's announcements, documents, and tools" />
          <Bullet text="Process HOA dues payments and maintain payment records" />
          <Bullet text="Send and receive maintenance requests within your community" />
          <Bullet text="Deliver push notifications about community updates, payment reminders, and maintenance status" />
          <Bullet text="Respond to your support requests" />
          <Bullet text="Improve the Porchivo platform and fix bugs" />
          <Bullet text="Detect, prevent, and address fraud, abuse, and security incidents" />
          <Bullet text="Meet our legal obligations" />
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>We do not use your information to serve you ads. Porchivo does not sell your personal information to anyone.</Text>
          </View>
        </Section>

        <Section number="4" title="Push Notifications">
          <Text style={styles.body}>
            Porchivo sends push notifications to keep you informed about your community. Notifications may include:
          </Text>
          <Bullet text="Community announcements and alerts" />
          <Bullet text="Payment reminders and confirmations" />
          <Bullet text="Maintenance request status updates" />
          <Bullet text="Meeting and event reminders" />
          <Text style={[styles.body, { marginTop: 8 }]}>
            <Text style={styles.bold}>You are in control.</Text> You can turn off push notifications at any time through your device settings or within the Porchivo app. Turning off notifications does not affect your ability to use the app.
          </Text>
          <Text style={[styles.body, { marginTop: 6 }]}>
            We do not include sensitive information — such as payment amounts, delinquency status, or personal details — in the notification text itself. Sensitive details are only visible inside the app after you log in.
          </Text>
        </Section>

        <Section number="5" title="How We Share Your Information">
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>We do not sell your personal information. We share your information only in these circumstances:</Text>
          </View>

          <SubHeading text="a. With Your Community" />
          <Text style={styles.body}>
            Information you submit — such as maintenance requests, document uploads, and announcements — is shared with authorized members of your HOA board or property management company as part of the platform's function. This is necessary for the service to work.
          </Text>

          <SubHeading text="b. With Service Providers" />
          <Text style={styles.body}>
            We use trusted third-party companies to help us operate Porchivo. These providers only process your data on our behalf and under our instructions:
          </Text>
          <View style={styles.providerTable}>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Supabase</Text>
              <Text style={styles.providerPurpose}>Database and authentication infrastructure</Text>
            </View>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Resend</Text>
              <Text style={styles.providerPurpose}>Transactional email delivery (account confirmations, deletion notices)</Text>
            </View>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Payment processor (e.g., Stripe)</Text>
              <Text style={styles.providerPurpose}>Secure payment processing for HOA dues and fees</Text>
            </View>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Push notification service</Text>
              <Text style={styles.providerPurpose}>Delivery of app notifications to your device</Text>
            </View>
            <View style={styles.providerRow}>
              <Text style={styles.providerName}>Crash reporting service</Text>
              <Text style={styles.providerPurpose}>App error detection and stability monitoring</Text>
            </View>
          </View>

          <SubHeading text="c. For Legal Reasons" />
          <Text style={styles.body}>
            We may disclose your information if required by law, court order, or government authority, or if we believe disclosure is necessary to protect the safety of any person or to prevent fraud or illegal activity.
          </Text>

          <SubHeading text="d. Business Transfers" />
          <Text style={styles.body}>
            If Porchivo is acquired, merged with, or sold to another company, your information may be transferred as part of that transaction. We will notify you before your information becomes subject to a different privacy policy.
          </Text>
        </Section>

        <Section number="6" title="Data Retention">
          <Text style={styles.body}>
            We keep your personal information for as long as your account is active or as long as needed to provide the service.
          </Text>
          <View style={styles.legalNote}>
            <Text style={styles.legalNoteText}>
              <Text style={styles.bold}>HOA payment and transaction records</Text> may be retained beyond account deletion as required by your homeowners association's legal and financial recordkeeping obligations. This data belongs to the community's records, not your personal profile.
            </Text>
          </View>
          <Text style={[styles.body, { marginTop: 8 }]}>
            When you request account deletion, your personal data is permanently removed within <Text style={styles.bold}>30 days</Text>. See "Your Rights and Choices" below for details.
          </Text>
        </Section>

        <Section number="7" title="Your Rights and Choices">
          <SubHeading text="a. Access and Correction" />
          <Text style={styles.body}>You can view and update your account information at any time from your profile settings in the app.</Text>

          <SubHeading text="b. Account Deletion" />
          <Text style={styles.body}>
            You can request permanent deletion of your Porchivo account from <Text style={styles.bold}>Settings → Account → Delete Account</Text>. Your account will be deactivated immediately and permanently deleted within 30 days. You may cancel this request within 30 days by contacting support@porchivo.com.
          </Text>
          <Text style={[styles.body, { fontSize: 13, color: Colors.slateLight }]}>
            Note: Account deletion removes your personal profile data. It does not erase HOA financial records that your association is legally required to retain.
          </Text>

          <SubHeading text="c. Push Notifications" />
          <Text style={styles.body}>
            You can disable push notifications through your device settings or inside the Porchivo app at any time.
          </Text>

          <SubHeading text="d. Photo and Camera Access" />
          <Text style={styles.body}>
            Porchivo requests camera or photo library access only when you choose to attach a photo to a maintenance request. You can revoke this permission at any time through your device settings.
          </Text>

          <SubHeading text="e. California Residents (CCPA)" />
          <View style={styles.legalNote}>
            <Text style={styles.legalNoteText}>
              If you are a California resident, you have the right to:
            </Text>
            <Bullet text="Know what personal information we collect and how we use it" />
            <Bullet text="Request deletion of your personal information" />
            <Bullet text="Opt out of the sale of your personal information (we do not sell personal information)" />
            <Bullet text="Not be discriminated against for exercising your privacy rights" />
            <Text style={[styles.legalNoteText, { marginTop: 6 }]}>
              To make a request, contact us at support@porchivo.com.
            </Text>
          </View>

          <SubHeading text="f. Virginia, Colorado, and Other U.S. State Privacy Laws" />
          <Text style={styles.body}>
            Residents of states with comprehensive privacy laws (including Virginia, Colorado, Connecticut, Utah, and others) have similar rights to access, correct, delete, and opt out of certain uses of personal data. Contact us at support@porchivo.com to make a request.
          </Text>
        </Section>

        <Section number="8" title="Children's Privacy">
          <Text style={styles.body}>
            Porchivo is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us at support@porchivo.com and we will delete it.
          </Text>
        </Section>

        <Section number="9" title="Security">
          <Text style={styles.body}>
            We take reasonable technical and organizational measures to protect your information from unauthorized access, disclosure, or loss. This includes encrypted data transmission (HTTPS/TLS), secure authentication, and role-based access controls so that only authorized community members can see community-specific data.
          </Text>
          <Text style={styles.body}>
            No system is completely secure. If you believe your account has been compromised, contact us immediately at support@porchivo.com.
          </Text>
        </Section>

        <Section number="10" title="Third-Party Links">
          <Text style={styles.body}>
            The Porchivo app or your community's documents may contain links to external websites or resources. We are not responsible for the privacy practices of those third parties. Review their privacy policies before providing them with any information.
          </Text>
        </Section>

        <Section number="11" title="Changes to This Privacy Policy">
          <Text style={styles.body}>
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you through the app or by email before the changes take effect. Your continued use of Porchivo after the effective date of any update means you accept the revised policy.
          </Text>
        </Section>

        <Section number="12" title="Revision History">
          <Text style={styles.body}>
            We maintain a versioned record of material changes to this policy so you can verify which practices were in effect on a given date.
          </Text>
          {REVISION_HISTORY.map((entry) => (
            <View key={entry.version} style={styles.revisionRow}>
              <View style={styles.revisionBadge}>
                <Text style={styles.revisionBadgeText}>v{entry.version}</Text>
              </View>
              <View style={styles.revisionBody}>
                <Text style={styles.revisionDate}>{entry.date}</Text>
                <Text style={styles.revisionSummary}>{entry.summary}</Text>
              </View>
            </View>
          ))}
        </Section>

        <Section number="13" title="Contact Us">
          <Text style={styles.body}>
            If you have questions, concerns, or requests related to this Privacy Policy, contact us at:
          </Text>
          <View style={styles.contactCard}>
            <View style={styles.contactRow}>
              <Building2 size={16} color={Colors.primary} />
              <Text style={styles.contactText}>Porchivo Support</Text>
            </View>
            <View style={styles.contactRow}>
              <Mail size={16} color={Colors.primary} />
              <Text style={styles.contactText}>support@porchivo.com</Text>
            </View>
            <View style={styles.contactRow}>
              <Globe size={16} color={Colors.primary} />
              <Text style={styles.contactText}>porchivo.com</Text>
            </View>
          </View>
        </Section>

        <View style={styles.legalNotice}>
          <Text style={styles.legalNoteText}>
            <Text style={styles.bold}>Legal Notice:</Text> This document was drafted to reflect Porchivo's known data practices as of the effective date. It is strongly recommended that a licensed attorney review this policy before publishing, particularly if Porchivo operates in or serves users in jurisdictions with specific privacy law requirements (including California, the European Union, or Canada).
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 WhichWay Web Labs LLC. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
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
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.slate,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.slateLight,
  },
  headerVersion: {
    fontSize: 12,
    color: Colors.slateLighter,
    marginTop: 4,
  },
  revisionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  revisionBadge: {
    backgroundColor: Colors.skyBlue,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  revisionBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  revisionBody: {
    flex: 1,
  },
  revisionDate: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 2,
  },
  revisionSummary: {
    fontSize: 13,
    color: Colors.slateLight,
    lineHeight: 20,
  },
  introCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
  },
  introText: {
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700' as const,
    color: Colors.slate,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 12,
  },
  subHeading: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginTop: 12,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingRight: 8,
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 8,
    marginTop: 1,
    fontWeight: '700' as const,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 21,
  },
  highlightBox: {
    backgroundColor: Colors.skyBlue,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    marginTop: 8,
  },
  highlightText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  legalNote: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  legalNoteText: {
    fontSize: 13,
    color: Colors.slateLight,
    lineHeight: 20,
  },
  providerTable: {
    marginTop: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
    overflow: 'hidden',
  },
  providerRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border || '#E5E7EB',
    gap: 10,
  },
  providerName: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.slate,
    width: 130,
  },
  providerPurpose: {
    flex: 1,
    fontSize: 13,
    color: Colors.slateLight,
    lineHeight: 19,
  },
  contactCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactText: {
    fontSize: 14,
    color: Colors.slate,
    flex: 1,
  },
  legalNotice: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.slateLighter,
  },
});
