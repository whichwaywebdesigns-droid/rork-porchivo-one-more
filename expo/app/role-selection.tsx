import React, { useState } from 'react';
import { ImageSourcePropType, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Home, Building2, UserCog, CircleDashed, BadgeDollarSign, ArrowRight } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { MARKETING_RATE_RANGE } from '@/lib/partnerRates';
import { useAnalytics } from '@/store/AnalyticsContext';
import { isEnabled } from '@/lib/featureFlags';
import {
  useOnboardingFlow,
  ROLE_LABEL,
  type PorchivoRole,
} from '@/store/OnboardingFlowContext';
import {
  OnboardingScreen,
  OnboardingProgress,
  SelectionCard,
  PrimaryCTA,
  FadeSlideIn,
  TiltCard,
} from '@/components/onboarding';

const ROLE_MARK: ImageSourcePropType = require('@/assets/images/role-mark.png');
const ROLE_MARK_HOA: ImageSourcePropType = require('@/assets/images/role-mark-hoa.png');
const ROLE_MARK_STAFF: ImageSourcePropType = require('@/assets/images/role-mark-staff.png');
const ROLE_MARK_OTHER: ImageSourcePropType = require('@/assets/images/role-mark-other.png');

interface RoleOption {
  key: PorchivoRole;
  subtitle: string;
  tagline: string;
  icon: React.ReactNode;
  imageSource?: ImageSourcePropType;
}

const OPTIONS: RoleOption[] = [
  {
    key: 'resident',
    subtitle: 'Track my own deliveries and handoffs.',
    tagline: 'Where porch pirates lurk, neighbors go to work.',
    icon: <Home size={22} />,
    imageSource: ROLE_MARK,
  },
  {
    key: 'property_manager',
    subtitle: 'Oversee deliveries across the whole building.',
    tagline: 'Every floor, every door \u2014 fewer thefts to answer for.',
    icon: <Building2 size={22} />,
    imageSource: ROLE_MARK_HOA,
  },
  {
    key: 'staff',
    subtitle: 'Manage the front desk and package handoffs.',
    tagline: 'Front desk in command, every package in hand.',
    icon: <UserCog size={22} />,
    imageSource: ROLE_MARK_STAFF,
  },
  {
    key: 'other',
    subtitle: "I'll explore and decide as I go.",
    tagline: 'Browse at your pace, find your place.',
    icon: <CircleDashed size={22} />,
    imageSource: ROLE_MARK_OTHER,
  },
];

export default function RoleSelectionScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { track } = useAnalytics();
  const { role: savedRole, setRole } = useOnboardingFlow();
  const [selected, setSelected] = useState<PorchivoRole | null>(savedRole);

  const handleContinue = () => {
    if (!selected) return;
    setRole(selected);
    track('onboarding_intent_selected', { role: selected });
    router.push('/pain-point' as any);
  };

  return (
    <OnboardingScreen
      footer={
        <PrimaryCTA
          label="Continue"
          onPress={handleContinue}
          disabled={!selected}
          testID="role-continue"
        />
      }
    >
      <View style={styles.top}>
        <OnboardingProgress step={2} total={5} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeSlideIn>
          <Text style={[styles.title, { color: Colors.slate }]}>How will you use Porchivo?</Text>
          <Text style={[styles.subtitle, { color: Colors.slateLight }]}>
            We'll tailor the experience to how you work.
          </Text>
        </FadeSlideIn>

        <View style={styles.list}>
          {OPTIONS.map((option, i) => (
            <FadeSlideIn key={option.key} delay={80 + i * 70}>
              <TiltCard
                perspective={1000}
                maxTilt={8}
                pressScale={0.98}
                onPress={() => setSelected(option.key)}
                style={styles.tiltWrap}
              >
                <SelectionCard
                  title={ROLE_LABEL[option.key]}
                  subtitle={option.subtitle}
                  tagline={option.tagline}
                  icon={option.icon}
                  imageSource={option.imageSource}
                  selected={selected === option.key}
                  onPress={() => setSelected(option.key)}
                  testID={`role-${option.key}`}
                />
              </TiltCard>
            </FadeSlideIn>
          ))}
        </View>

        {isEnabled('PORCH_PARTNERS') && (
          <FadeSlideIn delay={80 + OPTIONS.length * 70}>
            <TouchableOpacity
              style={[styles.earnTeaser, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              onPress={() => {
                void Haptics.selectionAsync();
                track('partner_nudge_tapped', { source: 'role_selection' });
                router.push('/partner-onboarding' as any);
              }}
              activeOpacity={0.85}
              testID="role-earn-teaser"
            >
              <View style={styles.earnTeaserIcon}>
                <BadgeDollarSign size={16} color="#16A34A" />
              </View>
              <View style={styles.earnTeaserText}>
                <Text style={[styles.earnTeaserTitle, { color: Colors.slate }]}>
                  Here to earn? Become a Porch Partner
                </Text>
                <Text style={[styles.earnTeaserSub, { color: Colors.slateLight }]}>
                  Hold packages for neighbors and make {MARKETING_RATE_RANGE}.
                </Text>
              </View>
              <ArrowRight size={15} color="#16A34A" />
            </TouchableOpacity>
          </FadeSlideIn>
        )}
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
    marginBottom: 26,
  },
  list: {
    gap: 12,
  },
  tiltWrap: {
    // TiltCard wraps SelectionCard — no extra styling needed,
    // but this ensures the card fills width properly
  },
  earnTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  earnTeaserIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F9EF',
  },
  earnTeaserText: {
    flex: 1,
  },
  earnTeaserTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  earnTeaserSub: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
});
