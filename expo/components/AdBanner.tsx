import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Linking, Alert } from 'react-native';
import { X, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { usePaywall } from '@/store/PaywallContext';
import { PAYWALL_TRIGGERS } from '@/lib/tiers';
import { log } from "../lib/logger";

const AD_CONTENT = [
  {
    headline: 'Protect Your Porch',
    body: 'Upgrade to Premium for an ad-free experience',
    cta: 'Learn More',
    bgColor: '#EFF6FF',
    accentColor: Colors.primary,
    link: null,
  },
  {
    headline: 'Local Home Services',
    body: 'Find trusted pros in your neighborhood',
    cta: 'Explore',
    bgColor: '#FFF7ED',
    accentColor: Colors.secondary,
    link: 'https://porchivo.com',
  },
  {
    headline: 'Porchivo Premium',
    body: 'No ads, priority support, and more',
    cta: 'Upgrade',
    bgColor: '#FFFBEB',
    accentColor: '#D97706',
    link: null,
  },
  {
    headline: 'Neighborhood Watch',
    body: 'Invite neighbors to keep packages safe',
    cta: 'Invite Now',
    bgColor: '#ECFDF5',
    accentColor: Colors.success,
    link: null,
  },
];

interface AdBannerProps {
  variant?: 'banner' | 'inline';
  style?: object;
}

export default React.memo(function AdBanner({ variant = 'banner', style }: AdBannerProps) {
  const { capabilities } = useApp();
  const { guardPremiumAccess } = usePaywall();
  const [adIndex, setAdIndex] = useState<number>(Math.floor(Math.random() * AD_CONTENT.length));
  const [dismissed, setDismissed] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setAdIndex(prev => (prev + 1) % AD_CONTENT.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  const handleDismiss = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setDismissed(true);
    });
  }, [fadeAnim]);

  const handlePress = useCallback(() => {
    const ad = AD_CONTENT[adIndex];
    log('[AdBanner] Ad tapped:', ad.headline);
    const isUpgradeAd = ad.headline === 'Protect Your Porch' || ad.headline === 'Porchivo Premium';
    if (isUpgradeAd) {
      // C-3: route through guardPremiumAccess so the placement passed to
      // Superwall is a real PAYWALL_TRIGGERS value (configured as a campaign
      // in the Superwall dashboard), not the dead 'remove_ads_upgrade' string.
      guardPremiumAccess({ trigger: PAYWALL_TRIGGERS.manual });
      return;
    }
    if (ad.link) {
      Linking.openURL(ad.link).catch(() => Alert.alert('Error', 'Could not open the link.'));
    }
  }, [adIndex, guardPremiumAccess]);

  if (capabilities.isAdFree || dismissed) return null;

  const ad = AD_CONTENT[adIndex];

  if (variant === 'inline') {
    return (
      <Animated.View style={[styles.inlineContainer, { backgroundColor: ad.bgColor, opacity: fadeAnim }, style]}>
        <View style={styles.adLabelWrap}>
          <Text style={styles.adLabel}>AD</Text>
        </View>
        <TouchableOpacity style={styles.inlineContent} onPress={handlePress} activeOpacity={0.8}>
          <View style={styles.inlineTextWrap}>
            <Text style={[styles.inlineHeadline, { color: ad.accentColor }]}>{ad.headline}</Text>
            <Text style={styles.inlineBody}>{ad.body}</Text>
          </View>
          <View style={[styles.inlineCta, { backgroundColor: ad.accentColor }]}>
            <Text style={styles.inlineCtaText}>{ad.cta}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={14} color={Colors.slateLighter} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.bannerContainer, { backgroundColor: ad.bgColor, opacity: fadeAnim }, style]}>
      <TouchableOpacity style={styles.bannerContent} onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.bannerLeft}>
          <View style={styles.adLabelWrap}>
            <Text style={styles.adLabel}>AD</Text>
          </View>
          <View style={styles.bannerTextWrap}>
            <Text style={[styles.bannerHeadline, { color: ad.accentColor }]} numberOfLines={1}>{ad.headline}</Text>
            <Text style={styles.bannerBody} numberOfLines={1}>{ad.body}</Text>
          </View>
        </View>
        <View style={[styles.bannerCta, { backgroundColor: ad.accentColor }]}>
          <Text style={styles.bannerCtaText}>{ad.cta}</Text>
          <ExternalLink size={12} color={Colors.white} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.bannerDismiss} onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={12} color={Colors.slateLighter} />
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  bannerContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 36,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerHeadline: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  bannerBody: {
    fontSize: 11,
    color: Colors.slateLight,
    marginTop: 1,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  bannerCtaText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bannerDismiss: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adLabelWrap: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  adLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.slateLight,
    letterSpacing: 0.5,
  },
  inlineContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    position: 'relative' as const,
  },
  inlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  inlineTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  inlineHeadline: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  inlineBody: {
    fontSize: 12,
    color: Colors.slateLight,
    marginTop: 3,
  },
  inlineCta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inlineCtaText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  dismissBtn: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
