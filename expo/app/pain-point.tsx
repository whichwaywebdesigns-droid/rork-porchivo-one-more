import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BellRing, PackageSearch, MessagesSquare, ConciergeBell, LayoutGrid } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useOnboardingFlow, type PainPoint } from '@/store/OnboardingFlowContext';
import {
  OnboardingScreen,
  OnboardingProgress,
  SelectionCard,
  PrimaryCTA,
  FadeSlideIn,
  TiltCard,
} from '@/components/onboarding';

interface PainOption {
  key: PainPoint;
  title: string;
  icon: React.ReactNode;
}

const OPTIONS: PainOption[] = [
  { key: 'missed_alerts', title: 'Missed package alerts', icon: <BellRing size={22} /> },
  { key: 'delivery_confusion', title: 'Delivery confusion', icon: <PackageSearch size={22} /> },
  { key: 'resident_comms', title: 'Resident communication', icon: <MessagesSquare size={22} /> },
  { key: 'front_desk', title: 'Front desk workload', icon: <ConciergeBell size={22} /> },
  { key: 'all', title: 'All of the above', icon: <LayoutGrid size={22} /> },
];

export default function PainPointScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { track } = useAnalytics();
  const { painPoint: saved, setPainPoint } = useOnboardingFlow();
  const [selected, setSelected] = useState<PainPoint | null>(saved);

  const handleContinue = () => {
    if (!selected) return;
    setPainPoint(selected);
    track('onboarding_step_complete', { step: 'pain_point', painPoint: selected });
    router.push('/value-preview' as any);
  };

  return (
    <OnboardingScreen
      footer={
        <PrimaryCTA
          label="Continue"
          onPress={handleContinue}
          disabled={!selected}
          testID="painpoint-continue"
        />
      }
    >
      <View style={styles.top}>
        <OnboardingProgress step={3} total={5} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeSlideIn>
          <Text style={[styles.title, { color: Colors.slate }]}>
            What do you want Porchivo to help with most?
          </Text>
          <Text style={[styles.subtitle, { color: Colors.slateLight }]}>
            Pick the one that matters most right now.
          </Text>
        </FadeSlideIn>

        <View style={styles.list}>
          {OPTIONS.map((option, i) => (
            <FadeSlideIn key={option.key} delay={80 + i * 60}>
              <TiltCard
                perspective={1000}
                maxTilt={8}
                pressScale={0.98}
                onPress={() => setSelected(option.key)}
                style={styles.tiltWrap}
              >
                <SelectionCard
                  title={option.title}
                  icon={option.icon}
                  selected={selected === option.key}
                  onPress={() => setSelected(option.key)}
                  testID={`painpoint-${option.key}`}
                />
              </TiltCard>
            </FadeSlideIn>
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
    marginBottom: 26,
  },
  list: {
    gap: 12,
  },
  tiltWrap: {},
});
