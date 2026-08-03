import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, GitMerge, Users, Package, CheckCircle2 } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useOnboardingFlow } from '@/store/OnboardingFlowContext';
import { valuePreviewSupportingCopy } from '@/config/onboardingExperiments';
import {
  OnboardingScreen,
  OnboardingProgress,
  BenefitCard,
  PrimaryCTA,
  FadeSlideIn,
  ParallaxLayer,
  TiltCard,
} from '@/components/onboarding';

const BENEFITS = [
  {
    title: 'Real-time delivery visibility',
    description: 'See what arrived, what is on the way, and what needs attention.',
    icon: <Eye size={20} />,
  },
  {
    title: 'Cleaner package handoff tracking',
    description: 'Every handoff has a clear owner and status — no guesswork.',
    icon: <GitMerge size={20} />,
  },
  {
    title: 'Better communication across the building',
    description: 'Residents, staff, and managers stay aligned in one place.',
    icon: <Users size={20} />,
  },
];

/** A calm, illustrative mini-dashboard so the value feels tangible. */
function DashboardMock() {
  const Colors = useColors();
  const rows = [
    { label: 'Arrived · Unit 4B', state: 'Ready for pickup', done: true },
    { label: 'Out for delivery · Lobby', state: 'Arriving today', done: false },
    { label: 'Handed off · Front desk', state: 'Confirmed', done: true },
  ];
  return (
    <View
      style={[
        styles.mock,
        { backgroundColor: Colors.surface, borderColor: Colors.border, shadowColor: Colors.cardShadow },
      ]}
    >
      <View style={styles.mockHeader}>
        <Text style={[styles.mockTitle, { color: Colors.slate }]}>Today</Text>
        <View style={[styles.mockPill, { backgroundColor: Colors.skyBlue }]}>
          <Text style={[styles.mockPillText, { color: Colors.primary }]}>3 active</Text>
        </View>
      </View>
      {rows.map((r, i) => (
        <View
          key={i}
          style={[styles.mockRow, i < rows.length - 1 && { borderBottomColor: Colors.border, borderBottomWidth: 1 }]}
        >
          <View
            style={[
              styles.mockIcon,
              { backgroundColor: r.done ? Colors.successLight : Colors.skyBlue },
            ]}
          >
            {r.done ? (
              <CheckCircle2 size={16} color={Colors.success} />
            ) : (
              <Package size={16} color={Colors.primary} />
            )}
          </View>
          <View style={styles.mockCopy}>
            <Text style={[styles.mockLabel, { color: Colors.slate }]} numberOfLines={1}>
              {r.label}
            </Text>
            <Text
              style={[styles.mockState, { color: r.done ? Colors.success : Colors.slateLight }]}
              numberOfLines={1}
            >
              {r.state}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ValuePreviewScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { track } = useAnalytics();
  const { role, painPoint } = useOnboardingFlow();

  const handleContinue = () => {
    track('onboarding_step_complete', { step: 'value_preview', role, painPoint });
    router.push('/onboarding-setup' as any);
  };

  return (
    <OnboardingScreen
      footer={<PrimaryCTA label="Continue" onPress={handleContinue} testID="value-continue" />}
    >
      <View style={styles.top}>
        <OnboardingProgress step={4} total={5} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ParallaxLayer entrance="rotateX" entranceDelay={100}>
          <Text style={[styles.title, { color: Colors.slate }]}>
            Here's what clarity looks like
          </Text>
          <Text style={[styles.subtitle, { color: Colors.slateLight }]}>
            {valuePreviewSupportingCopy(role, painPoint)}
          </Text>
        </ParallaxLayer>

        <ParallaxLayer entrance="both" entranceDelay={250}>
          <TiltCard
            perspective={1100}
            maxTilt={6}
            pressScale={0.98}
          >
            <DashboardMock />
          </TiltCard>
        </ParallaxLayer>

        <View style={styles.benefits}>
          {BENEFITS.map((b, i) => (
            <BenefitCard
              key={b.title}
              title={b.title}
              description={b.description}
              icon={b.icon}
              delay={400 + i * 110}
            />
          ))}
        </View>
      </ScrollView>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  scroll: {
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 22,
    marginBottom: 22,
  },
  mock: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 22,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 4,
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mockTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  mockPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mockPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  mockIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockCopy: {
    flex: 1,
  },
  mockLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  mockState: {
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },
  benefits: {
    gap: 12,
  },
});
