import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Users, Shield, AlertTriangle, Heart, MessageCircle, Ban } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
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

export default function CommunityGuidelinesScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Community Guidelines',
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
            <Users size={28} color={Colors.white} />
          </View>
          <Text style={styles.headerTitle}>Community Guidelines</Text>
          <Text style={styles.headerSubtitle}>Building safer neighborhoods together</Text>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Porchivo is built on trust between neighbors. These guidelines help keep our community safe, respectful, and effective at protecting packages. All users must follow these guidelines.
          </Text>
        </View>

        <Section
          title="Be Respectful & Honest"
          icon={<Heart size={18} color={Colors.primary} />}
        >
          <Bullet text="Treat every neighbor with courtesy and respect, whether they are a Homeowner or Porch Partner." />
          <Bullet text="Provide accurate information when creating package entries, alerts, and profile details." />
          <Bullet text="Communicate clearly and politely when coordinating package pickups or drop-offs." />
          <Bullet text="Respect the privacy of other users. Do not share their personal information outside the app." />
        </Section>

        <Section
          title="Porch Partner Standards"
          icon={<Shield size={18} color={Colors.primary} />}
        >
          <Bullet text="Handle all packages with care. Never open, tamper with, or damage a package entrusted to you." />
          <Bullet text="Pick up packages promptly after receiving a delivery notification." />
          <Bullet text="Return packages to the homeowner within the agreed timeframe." />
          <Bullet text="Keep tracking numbers and delivery details confidential." />
          <Bullet text="If you can no longer fulfill a Porch Partner commitment, notify the homeowner as soon as possible." />
        </Section>

        <Section
          title="Instant Alerts Best Practices"
          icon={<AlertTriangle size={18} color={Colors.primary} />}
        >
          <Bullet text="Only submit alerts for genuinely suspicious activity related to package safety." />
          <Bullet text="Be factual and objective in your descriptions. Avoid speculation or assumptions about individuals." />
          <Bullet text="Do not use alerts to target, profile, or discriminate against any person based on race, ethnicity, gender, religion, or any other protected characteristic." />
          <Bullet text="Never submit false or misleading alerts. This wastes community resources and erodes trust." />
          <Bullet text="For emergencies or crimes in progress, always call 911 first." />
        </Section>

        <Section
          title="Communication Standards"
          icon={<MessageCircle size={18} color={Colors.primary} />}
        >
          <Bullet text="Keep all communications within the app relevant to package protection and neighborhood safety." />
          <Bullet text="Do not use Porchivo to send spam, advertisements, or unsolicited messages." />
          <Bullet text="Do not use threatening, abusive, or harassing language toward any user." />
          <Bullet text="Report any inappropriate behavior through the app rather than engaging directly." />
        </Section>

        <Section
          title="Prohibited Behavior"
          icon={<Ban size={18} color={Colors.danger} />}
        >
          <Bullet text="Submitting knowingly false Instant Alert reports." />
          <Bullet text="Using the app to harass, stalk, threaten, or intimidate any person." />
          <Bullet text="Impersonating another person or creating fake accounts." />
          <Bullet text="Attempting to steal, intercept, or tamper with packages." />
          <Bullet text="Collecting personal information about other users without consent." />
          <Bullet text="Using automated tools, bots, or scrapers to access the app." />
          <Bullet text="Any activity that violates local, state, or federal law." />
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>
              Violations may result in immediate suspension or permanent removal from Porchivo at our sole discretion.
            </Text>
          </View>
        </Section>

        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>Report a Violation</Text>
          <Text style={styles.reportText}>
            If you encounter behavior that violates these guidelines, please report it through the app or contact us at support@porchivo.com. All reports are reviewed and kept confidential.
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
  section: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingRight: 8,
    marginBottom: 8,
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
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  highlightText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  reportCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.skyBlue,
    borderRadius: 14,
    padding: 16,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 8,
  },
  reportText: {
    fontSize: 14,
    color: Colors.slateLight,
    lineHeight: 21,
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
