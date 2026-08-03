import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, MapPin, Bell, Package, X, BadgeDollarSign, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { palette } from '@/constants/theme';
import {
  useOnboarding,
  finalTaskLabel,
  finalTaskRoute,
} from '@/store/OnboardingContext';
import { useAnalytics } from '@/store/AnalyticsContext';
import { useApp } from '@/store/AppContext';

interface ChecklistItem {
  key: keyof import('@/store/OnboardingContext').ChecklistProgress;
  label: string;
  route: string;
  icon: React.ReactNode;
}

function useChecklistItems(): ChecklistItem[] {
  const { intent } = useOnboarding();
  return [
    {
      key: 'homeAreaConfirmed',
      label: 'Confirm your home area',
      route: '/edit-profile',
      icon: <MapPin size={15} color={palette.accent} />,
    },
    {
      key: 'alertsEnabled',
      label: 'Turn on alerts',
      route: '/notifications-permission',
      icon: <Bell size={15} color={palette.warmOrange} />,
    },
    {
      key: 'safeDropoffSet',
      label: 'Set your safe drop-off preference',
      route: '/safe-dropoff',
      icon: <Package size={15} color={palette.successGreen} />,
    },
    {
      key: 'finalTaskDone',
      label: finalTaskLabel(intent),
      route: finalTaskRoute(intent),
      icon: <ChevronRight size={15} color={palette.textSecondary} />,
    },
  ];
}

interface Props {
  /** Called when the user dismisses the checklist (all done or manually closed). */
  onDismiss?: () => void;
}

export default function ActivationChecklist({ onDismiss }: Props) {
  const router = useRouter();
  const { checklist, completedCount, totalCount, updateChecklist, isLoaded } = useOnboarding();
  const { track } = useAnalytics();
  const { isHomeowner, isPartner } = useApp();
  const items = useChecklistItems();

  const [dismissed, setDismissed] = useState<boolean>(false);
  const [firstWinShown, setFirstWinShown] = useState<boolean>(false);
  const prevCompletedRef = useRef<number>(completedCount);

  const bannerAnim = useRef(new Animated.Value(0)).current;
  const containerAnim = useRef(new Animated.Value(0)).current;

  // Entrance animation
  useEffect(() => {
    if (!isLoaded) return;
    Animated.spring(containerAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 60,
    }).start();
  }, [isLoaded, containerAnim]);

  // Show success banner on first item completion
  useEffect(() => {
    if (completedCount > prevCompletedRef.current && completedCount === 1 && !firstWinShown) {
      setFirstWinShown(true);
      Animated.sequence([
        Animated.timing(bannerAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(bannerAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount, firstWinShown, bannerAnim]);

  const handleItemPress = useCallback(
    async (item: ChecklistItem) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      track('checklist_item_tapped', { key: item.key });

      // Mark final task done immediately when tapped (it's an exploration action)
      if (item.key === 'finalTaskDone' && !checklist.finalTaskDone) {
        await updateChecklist({ finalTaskDone: true });
        track('checklist_item_completed', { key: item.key });
      }

      router.push(item.route as any);
    },
    [checklist.finalTaskDone, updateChecklist, track, router],
  );

  const handleDismiss = useCallback(() => {
    void Haptics.selectionAsync();
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  // When all done and user is a homeowner-only, show a partner upsell nudge
  const allDone = completedCount >= totalCount;
  const showPartnerNudge = allDone && isHomeowner && !isPartner && !dismissed;

  if (!isLoaded || (dismissed && !showPartnerNudge)) return null;
  if (allDone && !showPartnerNudge) return null;

  const progressFraction = Math.min(completedCount / totalCount, 1);

  // Partner nudge card — shown after checklist completion for homeowners
  if (showPartnerNudge) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: containerAnim,
            transform: [{ translateY: containerAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <View style={styles.partnerNudgeCard}>
          <View style={styles.partnerNudgeDismiss}>
            <TouchableOpacity
              onPress={handleDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <X size={14} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.partnerNudgeTop}>
            <View style={styles.partnerNudgeIconWrap}>
              <BadgeDollarSign size={20} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerNudgeTitle}>Your porch is protected. 🎉</Text>
              <Text style={styles.partnerNudgeSub}>Want to help protect others — and get paid?</Text>
            </View>
          </View>
          <Text style={styles.partnerNudgeBody}>
            Porch Partners earn <Text style={styles.partnerNudgeHighlight}>$80–$250/mo</Text> holding neighbors' packages. Takes 2 min to get verified.
          </Text>
          <TouchableOpacity
            style={styles.partnerNudgeCta}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              track('partner_nudge_tapped', { source: 'checklist_completion' });
              router.push('/partner-onboarding' as any);
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.partnerNudgeCtaText}>See how it works</Text>
            <ArrowRight size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: containerAnim,
          transform: [
            {
              translateY: containerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Success banner — first win */}
      <Animated.View
        style={[
          styles.firstWinBanner,
          {
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Check size={13} color={palette.successGreen} strokeWidth={3} />
        <Text style={styles.firstWinText}>Nice. Porchivo is starting to work for you now.</Text>
      </Animated.View>

      {/* Card */}
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Your protection setup</Text>
            <Text style={styles.headerProgress}>
              {completedCount} of {totalCount} complete
            </Text>
          </View>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={handleDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <X size={15} color={palette.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${progressFraction * 100}%` },
            ]}
          />
        </View>

        <Text style={styles.subheader}>
          Complete these steps to get the most out of Porchivo.
        </Text>

        {/* Items */}
        <View style={styles.itemsList}>
          {items.map((item) => {
            const done = checklist[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.item, done && styles.itemDone]}
                onPress={() => handleItemPress(item)}
                activeOpacity={done ? 0.7 : 0.85}
                testID={`checklist-${item.key}`}
              >
                {/* Status indicator */}
                <View style={[styles.itemCheck, done && styles.itemCheckDone]}>
                  {done ? (
                    <Check size={12} color={palette.onAccent} strokeWidth={3.5} />
                  ) : (
                    <View style={styles.itemCheckEmpty} />
                  )}
                </View>

                {/* Label */}
                <Text style={[styles.itemLabel, done && styles.itemLabelDone]}>
                  {item.label}
                </Text>

                {/* Icon / chevron */}
                {!done && <ChevronRight size={15} color={palette.textMuted} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  firstWinBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: palette.sageSoft,
    borderWidth: 1,
    borderColor: 'rgba(30,156,106,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  firstWinText: {
    flex: 1,
    color: palette.successGreen,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderDark,
    padding: 16,
    shadowColor: palette.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  headerProgress: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: palette.bgElevated,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: -2,
    marginRight: -4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.bgElevated,
    overflow: 'hidden' as const,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: palette.accent,
  },
  subheader: {
    color: palette.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 14,
  },
  itemsList: {
    gap: 6,
  },
  item: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  itemDone: {
    backgroundColor: palette.sageSoft,
    borderColor: 'rgba(30,156,106,0.2)',
  },
  itemCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: palette.borderDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  itemCheckDone: {
    backgroundColor: palette.successGreen,
    borderColor: palette.successGreen,
  },
  itemCheckEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.bgElevated,
  },
  itemLabel: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 13.5,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  itemLabelDone: {
    color: palette.textSecondary,
    textDecorationLine: 'line-through' as const,
  },

  // Partner nudge card
  partnerNudgeCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    padding: 16,
    gap: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  partnerNudgeDismiss: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    zIndex: 1,
  },
  partnerNudgeTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingRight: 24,
  },
  partnerNudgeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#DCFCE7',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  partnerNudgeTitle: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#14532D',
    marginBottom: 2,
  },
  partnerNudgeSub: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  partnerNudgeBody: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  partnerNudgeHighlight: {
    fontWeight: '800' as const,
    color: '#15803D',
  },
  partnerNudgeCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginTop: 2,
  },
  partnerNudgeCtaText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
