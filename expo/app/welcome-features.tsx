import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Eye,
  GitMerge,
  Globe,
  Users,
  Package,
  Bell,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';
import type { AppColors } from '@/constants/colors';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useExperiments } from '@/store/ExperimentsContext';
import {
  OnboardingScreen,
  PrimaryCTA,
  ParallaxLayer,
  PerspectiveCarousel,
  ImmersiveReveal,
  ImmersiveScene,
  BrandLogoWithBox,
  type CarouselSlide,
} from '@/components/onboarding';

// ── Build carousel slides from trust items ──────────────────────────────────

function buildSlides(Colors: AppColors, trustItems: { id: string; label: string }[]): CarouselSlide[] {
  const visualMap: Record<string, { icon: React.ReactNode; subtitle: string }> = {
    visibility: {
      icon: <Eye size={48} strokeWidth={1.8} color={Colors.primary} />,
      subtitle: 'See what arrived, what is on the way, and what needs attention — in real time.',
    },
    handoff: {
      icon: <GitMerge size={48} strokeWidth={1.8} color={Colors.secondary} />,
      subtitle: 'Every handoff has a clear owner and status. No more guesswork at the door.',
    },
    coordination: {
      icon: <Users size={48} strokeWidth={1.8} color={Colors.success} />,
      subtitle: 'Residents, staff, and managers stay aligned in one calm, shared space.',
    },
  };

  const accentMap: Record<string, { accent: string; soft: string }> = {
    visibility: { accent: Colors.primary, soft: Colors.skyBlue },
    handoff: { accent: Colors.secondary, soft: Colors.peach },
    coordination: { accent: Colors.success, soft: Colors.successLight },
  };

  return trustItems.map((item) => {
    const visual = visualMap[item.id] ?? visualMap.visibility;
    const accent = accentMap[item.id] ?? accentMap.visibility;
    return {
      id: item.id,
      visual: (
        <View style={[styles.slideVisualInner]}>
          <View style={[styles.slideIconOrb, { backgroundColor: Colors.white }]}>
            {visual.icon}
          </View>
          <View style={[styles.slideFloatingIcon, { backgroundColor: accent.accent }]}>
            {item.id === 'visibility' && <Bell size={16} color={Colors.white} strokeWidth={2.4} />}
            {item.id === 'handoff' && <Package size={16} color={Colors.white} strokeWidth={2.4} />}
            {item.id === 'coordination' && <ShieldCheck size={16} color={Colors.white} strokeWidth={2.4} />}
          </View>
        </View>
      ),
      title: item.label,
      subtitle: visual.subtitle,
      accent: accent.accent,
      accentSoft: accent.soft,
    };
  });
}

export default function WelcomeFeaturesScreen() {
  const router = useRouter();
  const Colors = useColors();
  const { track } = useAnalytics();
  const { experiment } = useExperiments();
  const { welcome, trustItems } = experiment;
  const params = useLocalSearchParams<{ mode?: string }>();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    track('intro_view', { surface: 'welcome_features', mode: params.mode ?? 'signup' });
  }, [track, params.mode]);

  const handleContinue = () => {
    track('intro_complete', { surface: 'welcome_features', mode: params.mode ?? 'signup' });
    if (params.mode === 'signin') {
      router.push('/login' as any);
    } else {
      router.push({ pathname: '/login' as any, params: { mode: 'signup' } });
    }
  };

  const handleSkip = () => {
    track('intro_skip', { surface: 'welcome_features', mode: params.mode ?? 'signup' });
    void Haptics.selectionAsync();
    handleContinue();
  };

  const slides = buildSlides(Colors, trustItems);
  const insets = useSafeAreaInsets();

  return (
    <OnboardingScreen
      glow={false}
      footer={
        <ImmersiveReveal delay={900} axis="none" translateY={20} blur={6}>
          <View>
            <PrimaryCTA
              label={params.mode === 'signin' ? 'Continue to sign in' : 'Continue'}
              onPress={handleContinue}
              testID="welcome-features-continue"
            />
            <Pressable
              onPress={handleSkip}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              style={({ pressed }) => [
                styles.skipBtn,
                { opacity: pressed ? 0.55 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Skip intro"
              testID="welcome-features-skip"
            >
              <Text style={[styles.skipText, { color: Colors.slateLight }]}>
                Skip intro
              </Text>
              <ChevronRight size={14} color={Colors.slateLight} strokeWidth={2.4} />
            </Pressable>
          </View>
        </ImmersiveReveal>
      }
    >
      <ImmersiveScene>
        {/* Skip button pinned top-right while the scene reveals */}
        <Pressable
          onPress={handleSkip}
          hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
          style={({ pressed }) => [
            styles.skipTop,
            { top: insets.top + 6, opacity: pressed ? 0.55 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
          testID="welcome-features-skip-top"
        >
          <Text style={[styles.skipTopText, { color: Colors.slateLight }]}>
            Skip
          </Text>
        </Pressable>

        {/* Ambient gradient glow */}
        <View style={styles.glowContainer} pointerEvents="none">
          <View style={[styles.glowOrb, { backgroundColor: Colors.primary, opacity: 0.06 }]} />
          <View style={[styles.glowOrbSecondary, { backgroundColor: Colors.secondary, opacity: 0.04 }]} />
        </View>

        {/* Logo — far layer, leads the reveal, with the cardboard box underlaid */}
        <ImmersiveReveal delay={120} axis="rotateY" rotate={22} translateY={28} blur={14}>
          <ParallaxLayer entrance="none">
            <View style={styles.logoWrap}>
              <BrandLogoWithBox logoSize={88} testID="welcome-features-logo" />
            </View>
          </ParallaxLayer>
        </ImmersiveReveal>

        {/* Headline — mid layer, follows */}
        <ImmersiveReveal delay={260} axis="rotateX" rotate={14} translateY={24} blur={10}>
          <Text style={[styles.headline, { color: Colors.slate }]}>
            {welcome.headline}
          </Text>
        </ImmersiveReveal>

        {/* 3D Perspective Carousel — near layer, settles last */}
        <ImmersiveReveal delay={420} axis="both" rotate={12} translateY={32} blur={12}>
          <View style={styles.carouselSection}>
            <PerspectiveCarousel
              slides={slides}
              cardWidthRatio={0.82}
              gap={16}
              onSlideChange={(idx) => {
                setActiveSlide(idx);
                track('onboarding_carousel_slide', { index: idx, id: slides[idx]?.id });
              }}
              onDismiss={(slideId, remaining) => {
                track('onboarding_carousel_dismiss', { id: slideId, remaining });
              }}
            />
          </View>
        </ImmersiveReveal>

        {/* Subhead below carousel — final accent layer */}
        {welcome.subheadline.trim().length > 0 && (
          <ImmersiveReveal delay={640} axis="none" translateY={18} blur={6}>
            <Text style={[styles.subhead, { color: Colors.slateLight }]}>
              {welcome.subheadline}
            </Text>
          </ImmersiveReveal>
        )}
      </ImmersiveScene>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  glowOrbSecondary: {
    position: 'absolute',
    top: 40,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  logoWrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 16,
    marginBottom: 14,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 27,
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  carouselSection: {
    flex: 1,
    marginBottom: 8,
  },
  subhead: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  // ── Skip button ──
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 12,
    marginTop: 2,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  skipTop: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.04)',
    zIndex: 10,
  },
  skipTopText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // ── Slide visual styles ──
  slideVisualInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  slideIconOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2B4A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  slideFloatingIcon: {
    position: 'absolute',
    bottom: 20,
    right: 30,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2B4A',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
});
