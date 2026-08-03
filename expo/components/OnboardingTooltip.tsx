import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { Package, Shield, Users, Bell, MapPin, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WALKTHROUGH_KEY = 'porchivo_walkthrough_seen';

interface WalkthroughStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const STEPS: WalkthroughStep[] = [
  {
    title: 'Track Your Packages',
    description: 'Add incoming deliveries and monitor their status in real time. Never miss a package again.',
    icon: <Package size={32} color={Colors.primary} />,
    accent: Colors.skyBlue,
  },
  {
    title: 'Porch Partners',
    description: 'Trusted neighbors can hold packages for you when you\'re away. Build a safety network together.',
    icon: <Users size={32} color={Colors.success} />,
    accent: '#E8F9F0',
  },
  {
    title: 'Neighborhood Watch',
    description: 'See delivery activity on your block and get alerts about suspicious activity nearby.',
    icon: <Shield size={32} color={Colors.secondary} />,
    accent: Colors.peach,
  },
  {
    title: 'Instant Alerts',
    description: 'Get notified the moment your package arrives and when your Porch Partner picks it up.',
    icon: <Bell size={32} color="#7C3AED" />,
    accent: '#F5F3FF',
  },
  {
    title: 'Location Safety',
    description: 'Share approximate location with partners so they know where to go. Your exact address stays private.',
    icon: <MapPin size={32} color={Colors.primary} />,
    accent: Colors.skyBlue,
  },
];

interface OnboardingWalkthroughProps {
  onComplete: () => void;
}

export default function OnboardingWalkthrough({ onComplete }: OnboardingWalkthroughProps) {
  const [visible, setVisible] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // P-15: delay the walkthrough so it doesn't stack on top of an already-
    // busy first-time home screen. Give the user 1.5s to orient first.
    let active = true;
    const timer = setTimeout(() => {
      AsyncStorage.getItem(WALKTHROUGH_KEY).then((val) => {
        if (!active) return;
        if (val !== 'true') {
          setVisible(true);
          animateIn();
        }
      });
    }, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, progressAnim]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setCurrentStep(prev => prev + 1);
        animateIn();
      });
    } else {
      handleDismiss();
    }
  }, [currentStep, fadeAnim, animateIn]);

  const handleDismiss = useCallback(async () => {
    await AsyncStorage.setItem(WALKTHROUGH_KEY, 'true');
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
      onComplete();
    });
  }, [fadeAnim, onComplete]);

  if (!visible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <Text style={styles.stepCount}>{currentStep + 1} of {STEPS.length}</Text>

          <View style={[styles.iconCircle, { backgroundColor: step.accent }]}>
            {step.icon}
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
            ))}
          </View>

          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Get started' : 'Next tip'}
          >
            <Text style={styles.nextButtonText}>{isLast ? 'Get Started' : 'Next'}</Text>
            {!isLast && <ChevronRight size={18} color={Colors.white} />}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDismiss} activeOpacity={0.7} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip walkthrough</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  stepCount: {
    fontSize: 12,
    color: Colors.slateLighter,
    fontWeight: '500' as const,
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.slate,
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: Colors.slateLight,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  nextButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  skipButton: {
    marginTop: 14,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 14,
    color: Colors.slateLighter,
    fontWeight: '500' as const,
  },
});
