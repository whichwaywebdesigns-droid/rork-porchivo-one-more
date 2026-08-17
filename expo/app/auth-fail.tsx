import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, UserPlus, HelpCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Auth fail / "Oops!" screen — shown when a user attempts to sign in
 * without having created an account first. Displays the app logo, a
 * friendly message, and a back arrow to return to the login screen.
 */
export default function AuthFailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const logoScale = React.useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [fadeAnim, slideAnim, logoScale]);

  const goLogin = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/login?mode=signin' as any);
  };

  const goSignup = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/login?mode=signup' as any);
  };

  return (
    <LinearGradient
      colors={['#F5F7FA', '#EBF0F8', '#DCE6F5']}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Back arrow */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={goLogin}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        testID="auth-fail-back"
      >
        <ChevronLeft size={26} color="#1B3A6B" strokeWidth={2.5} />
      </TouchableOpacity>

      <View style={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Animated.View
          style={[
            styles.logoWrap,
            { transform: [{ scale: logoScale }] },
          ]}
        >
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.textBlock,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.oopsTitle}>Oops!</Text>
          <Text style={styles.oopsMessage}>
            We couldn't find an account with that email.{'\n'}
            You need to create an account first to sign in.
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.buttonBlock,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={goLogin}
            activeOpacity={0.85}
            testID="auth-fail-login"
          >
            <LinearGradient
              colors={['#1B3A6B', '#2C5299']}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <ChevronLeft size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.backToLoginText}>Back to Login</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createAccountBtn}
            onPress={goSignup}
            activeOpacity={0.7}
            testID="auth-fail-signup"
          >
            <UserPlus size={18} color="#1B3A6B" />
            <Text style={styles.createAccountText}>Create an Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Support', 'Contact us at support@porchivo.com', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Email Support',
                  onPress: () =>
                    Linking.openURL(
                      'mailto:support@porchivo.com?subject=Porchivo%20Support'
                    ),
                },
              ]);
            }}
            activeOpacity={0.7}
          >
            <HelpCircle size={13} color="rgba(27,58,107,0.5)" />
            <Text style={styles.supportText}>Need help? Contact support</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  textBlock: {
    alignItems: 'center',
    marginBottom: 40,
  },
  oopsTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1B3A6B',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  oopsMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(27,58,107,0.65)',
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonBlock: {
    width: '100%',
    alignItems: 'center',
  },
  backToLoginBtn: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  shadowColor: '#1B3A6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  backToLoginText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  createAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 24,
  },
  createAccountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B3A6B',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  supportText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(27,58,107,0.5)',
  },
});
