import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Shield, Mail, MapPin, Building2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

const EFFECTIVE_DATE = 'February 19, 2026';
const LAST_UPDATED = 'February 19, 2026';
const POLICY_VERSION = '1.0';

interface RevisionEntry {
  version: string;
  date: string;
  summary: string;
}

const REVISION_HISTORY: RevisionEntry[] = [
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
            <Text style={styles.bold}>Porchivo</Text> is a product of{' '}
            <Text style={styles.bold}>WhichWay Web Labs LLC</Text> ("we," "our," or "us"). This Privacy Policy explains how we collect, use, share, and protect your information when you use the Porchivo mobile application ("App"). By downloading, installing, or using Porchivo, you agree to the practices described in this policy.
          </Text>
        </View>

        <Section number="1" title="Information We Collect">
          <SubHeading text="a. Information You Provide" />
          <Bullet text='Account information: Name, email address, phone number, and password when you create a Porchivo account.' />
          <Bullet text='Profile information: Role selection (Homeowner or Porch Partner), display name, avatar, and home address or address nickname (e.g., "Home," "Work").' />
          <Bullet text="Package information: Carrier name, tracking numbers, expected delivery windows, item descriptions, and notes shared with your selected Porch Partner." />
          <Bullet text="Alerts and reports: Category, description text (up to 250 characters), and optional photos you submit through the Instant Alerts feature." />
          <Bullet text="Communications: Messages, feedback, or support requests you send to us or to other users through the App." />

          <SubHeading text="b. Information Collected Automatically" />
          <Bullet text="Location data: With your explicit consent, we collect your approximate location (street and block level) to group you with nearby neighbors, display neighborhood activity, and power the Instant Alerts feature. We use foreground location permission only and do not track your precise location in the background." />
          <Bullet text="Device information: Device model, operating system version, unique device identifiers, and mobile network information." />
          <Bullet text="Usage data: App activity, session duration, feature interactions, crash logs, and performance diagnostics." />
          <Bullet text="Push notification tokens: Device tokens used to deliver notifications about package status changes, Porch Partner updates, and neighborhood alerts." />

          <SubHeading text="c. Information from Third Parties" />
          <Bullet text="Contacts: If you choose to invite neighbors, we access your device contacts solely to facilitate SMS or email invitations. We do not store your full contact list on our servers." />
        </Section>

        <Section number="2" title="How We Use Your Information">
          <Text style={styles.body}>We use the information we collect to:</Text>
          <Bullet text="Operate, maintain, and improve the Porchivo App and its features (Track Every Delivery, Neighborhood Watch, Porch Partners, Instant Alerts)." />
          <Bullet text="Create and manage your account and authenticate your identity." />
          <Bullet text="Facilitate package tracking, Porch Partner coordination, and delivery driver assignments." />
          <Bullet text="Send push notifications for package status updates, pickup confirmations, and suspicious activity alerts on your block." />
          <Bullet text='Display anonymized neighborhood delivery activity (e.g., "Package delivered on your block") without revealing exact addresses or personal details to other users.' />
          <Bullet text="Display advertisements within the App to support our free service." />
          <Bullet text="Respond to your inquiries, feedback, and support requests." />
          <Bullet text="Detect, prevent, and address fraud, abuse, security issues, and technical problems." />
          <Bullet text="Comply with applicable legal obligations." />
        </Section>

        <Section number="3" title="How We Share Your Information">
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>We do not sell your personal information.</Text>
          </View>
          <Text style={styles.body}>We may share your data in the following limited circumstances:</Text>
          <Bullet text="With your Porch Partner: When you select a Porch Partner for a package, we share relevant delivery details (carrier, tracking number, delivery window, address nickname) with that specific partner only." />
          <Bullet text="With neighbors on your block: Instant Alerts you submit are shared in anonymized form (approximate location, category, description) with opted-in neighbors. Your name and exact address are never displayed." />
          <Bullet text="Service providers: We work with trusted third-party providers for cloud hosting, analytics, crash reporting, and push notification delivery. These providers process data on our behalf and are contractually required to protect your information." />
          <Bullet text="Legal requirements: We may disclose your information if required by law, regulation, legal process, or enforceable governmental request, or to protect the rights, safety, or property of WhichWay Web Labs LLC, our users, or the public." />
        </Section>

        <Section number="4" title="Advertising">
          <Text style={styles.body}>
            Porchivo is a free, ad-supported application. The ads we display are our own first-party promotions (for example, Porchivo Premium and neighborhood features). We do not use third-party ad networks, and we do not use cookies, device identifiers, or tracking technologies to serve personalized advertising or share your data with advertisers.
          </Text>
        </Section>

        <Section number="5" title="Your Rights and Choices">
          <Text style={styles.body}>
            Depending on your location, you may have the following rights regarding your personal data:
          </Text>
          <Bullet text="Access: Request a copy of the personal data we hold about you." />
          <Bullet text="Correction: Request that we correct inaccurate or incomplete data." />
          <Bullet text="Deletion: Request that we delete your account and associated personal data. You can initiate account deletion from Settings → Account → Delete Account within the App." />
          <Bullet text="Opt-out of notifications: You can manage or disable push notifications at any time through your device settings or the in-app notification preferences screen." />
          <Bullet text="Opt-out of location: You can revoke location permissions at any time through your device settings. Some features (Neighborhood Watch, Instant Alerts) will have reduced functionality without location access." />

          <View style={styles.legalNote}>
            <Text style={styles.legalNoteTitle}>For California residents (CCPA/CPRA)</Text>
            <Text style={styles.legalNoteText}>
              You have the right to know what personal information we collect, request deletion, and opt out of the sale of personal information. We do not sell personal information. To exercise your rights, contact us at the address below.
            </Text>
          </View>

          <View style={styles.legalNote}>
            <Text style={styles.legalNoteTitle}>For EU/EEA residents (GDPR)</Text>
            <Text style={styles.legalNoteText}>
              You have additional rights including data portability and the right to lodge a complaint with your local data protection authority.
            </Text>
          </View>
        </Section>

        <Section number="6" title="Data Retention and Deletion">
          <Text style={styles.body}>
            We retain your personal data for as long as your account is active or as needed to provide you with our services. Package tracking data is retained for 90 days after delivery completion, then automatically deleted. Instant Alert reports are retained for 30 days, then archived in anonymized form.
          </Text>
          <Text style={styles.body}>
            When you delete your account, we will delete or anonymize your personal data within 30 days, except where retention is required by law.
          </Text>
        </Section>

        <Section number="7" title="Data Security">
          <Text style={styles.body}>
            We implement industry-standard security measures to protect your personal information, including encryption of data in transit (TLS/SSL), secure cloud storage, and access controls. However, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security but are committed to protecting your data to the best of our ability.
          </Text>
        </Section>

        <Section number="8" title="Children's Privacy">
          <Text style={styles.body}>
            Porchivo is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If we discover that a child under 13 has provided us with personal information, we will promptly delete it. If you believe a child has provided us with personal data, please contact us immediately.
          </Text>
        </Section>

        <Section number="9" title="Changes to This Privacy Policy">
          <Text style={styles.body}>
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you through the App or by email and update the "Effective Date" at the top of this policy. Your continued use of Porchivo after changes are posted constitutes your acceptance of the updated policy.
          </Text>
        </Section>

        <Section number="10" title="Revision History">
          <Text style={styles.body}>
            We keep a record of material changes to this policy so you can see exactly what was in effect on any given date.
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

        <Section number="11" title="Contact Us">
          <Text style={styles.body}>
            If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at:
          </Text>
          <View style={styles.contactCard}>
            <View style={styles.contactRow}>
              <Building2 size={16} color={Colors.primary} />
              <Text style={styles.contactText}>WhichWay Web Labs LLC</Text>
            </View>
            <View style={styles.contactRow}>
              <Mail size={16} color={Colors.primary} />
              <Text style={styles.contactText}>support@porchivo.com</Text>
            </View>
            <View style={styles.contactRow}>
              <MapPin size={16} color={Colors.primary} />
              <Text style={styles.contactText}>Indianapolis, Indiana, United States</Text>
            </View>
          </View>
        </Section>

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
  legalNoteTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.slate,
    marginBottom: 4,
  },
  legalNoteText: {
    fontSize: 13,
    color: Colors.slateLight,
    lineHeight: 20,
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
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.slateLighter,
  },
});
