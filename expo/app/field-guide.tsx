import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView as RNScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SlideInLeft,
  SlideInRight,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type AppColors } from '@/constants/colors';
import { useFieldGuide } from '@/store/FieldGuideContext';
import { useApp } from '@/store/AppContext';
import {
  FIELD_GUIDE,
  audienceLabel,
  type ManualBlock,
  type ManualSection,
} from '@/constants/fieldGuide';

const ORANGE = '#E8622A';
const NAVY = '#1A2B4A';

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void {
  if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {});
}

// ── Inline rich text: **stat** → bold orange ────────────────────────────────
function RichText({ text, color }: { text: string; color: string }): React.ReactElement {
  const parts = text.split('**');
  return (
    <Text style={[styles.bodyText, { color }]}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.bodyStat}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

// ── Animated sweep line under the header ────────────────────────────────────
function SweepLine(): React.ReactElement {
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  const style = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: interpolate(progress.value, [0, 0.1, 1], [0, 1, 1]),
  }));
  return (
    <View style={styles.sweepTrack}>
      <Animated.View style={[styles.sweepFill, style]}>
        <LinearGradient
          colors={[ORANGE, NAVY]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// ── Section index card ──────────────────────────────────────────────────────
function SectionCard({
  section,
  position,
  delayIndex,
  completed,
  onPress,
  Colors,
}: {
  section: ManualSection;
  position: number;
  delayIndex: number;
  completed: boolean;
  onPress: () => void;
  Colors: AppColors;
}): React.ReactElement {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const tag = audienceLabel(section.audience);

  return (
    <Animated.View entering={FadeInDown.delay(delayIndex * 50).duration(380)} style={style}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        onPress={onPress}
        style={[styles.card, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
      >
        <Text style={styles.cardWatermark}>{String(position).padStart(2, '0')}</Text>

        <View style={[styles.cardIcon, { backgroundColor: ORANGE + '14' }]}>
          <Ionicons name={section.icon as keyof typeof Ionicons.glyphMap} size={22} color={ORANGE} />
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: Colors.slate }]} numberOfLines={1}>
            {section.title}
          </Text>
          <Text style={[styles.cardTeaser, { color: Colors.slateLight }]} numberOfLines={2}>
            {section.teaser}
          </Text>
          {tag ? (
            <View style={[styles.audiencePill, { backgroundColor: NAVY + '12' }]}>
              <Text style={[styles.audiencePillText, { color: NAVY }]}>{tag}</Text>
            </View>
          ) : null}
        </View>

        {completed ? (
          <View style={[styles.badge, { backgroundColor: ORANGE }]}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        ) : (
          <View style={[styles.badgeEmpty, { borderColor: Colors.border }]} />
        )}

        <Ionicons name="chevron-forward" size={18} color={Colors.slateLighter} style={styles.cardChevron} />
      </Pressable>
    </Animated.View>
  );
}

// ── Block renderer ──────────────────────────────────────────────────────────
function Block({ block, Colors }: { block: ManualBlock; Colors: AppColors }): React.ReactElement {
  if (block.type === 'paragraph') {
    return (
      <View style={styles.blockSpacing}>
        <RichText text={block.text} color={Colors.slate} />
      </View>
    );
  }
  if (block.type === 'tip') {
    return (
      <View style={[styles.tipCard, { backgroundColor: ORANGE + '12' }]}>
        <Text style={styles.tipEmoji}>💡</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tipLabel, { color: ORANGE }]}>Tip</Text>
          <Text style={[styles.tipText, { color: Colors.slate }]}>{block.text}</Text>
        </View>
      </View>
    );
  }
  // table
  return (
    <View style={[styles.table, { borderColor: Colors.border }]}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        {block.headers.map((h, i) => (
          <Text key={i} style={[styles.tableHeaderCell, { color: Colors.slate }, i === 0 && styles.tableCellFirst]}>
            {h}
          </Text>
        ))}
      </View>
      {block.rows.map((row, ri) => (
        <View
          key={ri}
          style={[styles.tableRow, { backgroundColor: ri % 2 === 0 ? Colors.surface : Colors.palette.slate100 }]}
        >
          {row.map((cell, ci) => (
            <Text key={ci} style={[styles.tableCell, { color: Colors.slateLight }, ci === 0 && styles.tableCellFirst]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Section detail view ─────────────────────────────────────────────────────
function SectionView({
  section,
  position,
  total,
  direction,
  onBack,
  onNext,
  onPrev,
  Colors,
}: {
  section: ManualSection;
  position: number;
  total: number;
  direction: 'left' | 'right';
  onBack: () => void;
  onNext: () => void;
  onPrev: () => void;
  Colors: AppColors;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { isCompleted, markCompleted } = useFieldGuide();
  const [done, setDone] = useState<boolean>(isCompleted(section.id));

  const scrollProgress = useSharedValue(0);
  const checkScale = useSharedValue(isCompleted(section.id) ? 1 : 0);
  const lockedRef = useRef<boolean>(isCompleted(section.id));

  const complete = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    markCompleted(section.id);
    setDone(true);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    checkScale.value = withSequence(
      withTiming(1.2, { duration: 180, easing: Easing.out(Easing.back(2)) }),
      withSpring(1, { damping: 12, stiffness: 220 }),
    );
  }, [markCompleted, section.id, checkScale]);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    const max = e.contentSize.height - e.layoutMeasurement.height;
    const p = max > 0 ? Math.min(1, Math.max(0, e.contentOffset.y / max)) : 1;
    scrollProgress.value = p;
    if (p >= 0.96) {
      runOnJS(complete)();
    }
  });

  // Short content that does not scroll → mark complete after a beat.
  const onContentSize = useCallback(
    (_w: number, h: number) => {
      if (h < 560) {
        setTimeout(() => complete(), 900);
      }
    },
    [complete],
  );

  const ribbonStyle = useAnimatedStyle(() => ({ height: `${scrollProgress.value * 100}%` }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }], opacity: checkScale.value }));

  const Enter = direction === 'right' ? SlideInRight : SlideInLeft;

  // Horizontal swipe to navigate sections.
  const pan = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationX < -70) runOnJS(onNext)();
      else if (e.translationX > 70) runOnJS(onPrev)();
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        key={section.id}
        entering={Enter.duration(300)}
        style={[styles.sectionContainer, { backgroundColor: Colors.background }]}
      >
        {/* Left reading ribbon */}
        <View style={[styles.ribbonTrack, { top: insets.top }]} pointerEvents="none">
          <Animated.View style={[styles.ribbonFill, ribbonStyle]} />
        </View>

        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSize}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.sectionContent, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 120 }]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.ghostNumber, { color: Colors.slate }]}>{String(position).padStart(2, '0')}</Text>
            <View style={styles.sectionHeaderInner}>
              <View style={[styles.sectionIconChip, { backgroundColor: ORANGE + '14' }]}>
                <Ionicons name={section.icon as keyof typeof Ionicons.glyphMap} size={20} color={ORANGE} />
              </View>
              <Text style={[styles.sectionTitle, { color: Colors.slate }]}>{section.title}</Text>
            </View>
            {audienceLabel(section.audience) ? (
              <View style={[styles.audiencePill, styles.sectionAudiencePill, { backgroundColor: NAVY + '12' }]}>
                <Text style={[styles.audiencePillText, { color: NAVY }]}>{audienceLabel(section.audience)}</Text>
              </View>
            ) : null}
          </View>

          {section.blocks.map((block, i) => (
            <Block key={i} block={block} Colors={Colors} />
          ))}

          {/* Completion chip */}
          <Animated.View style={[styles.completeChip, { backgroundColor: ORANGE }, checkStyle]}>
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.completeChipText}>Section complete</Text>
          </Animated.View>

          {/* Prev / Next nav */}
          <View style={styles.navRow}>
            <Pressable
              onPress={() => {
                haptic();
                onPrev();
              }}
              style={[styles.navBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}
            >
              <Ionicons name="chevron-back" size={18} color={Colors.slate} />
              <Text style={[styles.navBtnText, { color: Colors.slate }]}>Previous</Text>
            </Pressable>

            <Text style={[styles.navCount, { color: Colors.slateLight }]}>
              {position} / {total}
            </Text>

            <Pressable
              onPress={() => {
                haptic();
                onNext();
              }}
              style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: ORANGE }]}
            >
              <Text style={[styles.navBtnText, { color: '#FFFFFF' }]}>
                {position === total ? 'Finish' : 'Next'}
              </Text>
              <Ionicons name={position === total ? 'checkmark' : 'arrow-forward'} size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.ScrollView>

        {/* Floating frosted back button */}
        <View style={[styles.backFloat, { top: insets.top + 8 }]}>
          <Pressable onPress={onBack} style={styles.backPressable}>
            <BlurView intensity={40} tint={Colors.palette === undefined ? 'light' : 'default'} style={styles.backBlur}>
              <Ionicons name="list" size={18} color={Colors.slate} />
              <Text style={[styles.backText, { color: Colors.slate }]}>Index</Text>
            </BlurView>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Featured link card → external subsection ────────────────────────────────
function HiddenServicesCard({
  delayIndex,
  onPress,
}: {
  delayIndex: number;
  onPress: () => void;
}): React.ReactElement {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeInDown.delay(delayIndex * 50).duration(380)} style={style}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        onPress={onPress}
        style={styles.featuredCard}
      >
        <LinearGradient
          colors={[NAVY, '#0F1B30']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.featuredIcon}>
          <Ionicons name="lock-open" size={22} color={ORANGE} />
        </View>
        <View style={styles.featuredBody}>
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>5 HIDDEN FEATURES</Text>
          </View>
          <Text style={styles.featuredTitle}>Porchivo Delivery Insights — UPS & Amazon Hidden Services</Text>
          <Text style={styles.featuredTeaser}>
            Unlock carrier features most customers never know exist.
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.featuredChevron} />
      </Pressable>
    </Animated.View>
  );
}

// ── Root screen ─────────────────────────────────────────────────────────────
export default function FieldGuideScreen(): React.ReactElement {
  const Colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isCompleted, reset } = useFieldGuide();
  const { isHomeowner, isPartner } = useApp();

  // Build the reading order from the signed-in user's role: sections written
  // for everyone plus those matching their role come first; anything else is
  // grouped below under "Also available".
  const { relevant, rest, ordered, personalized } = useMemo(() => {
    const isRelevant = (s: ManualSection): boolean =>
      s.audience === 'all' ||
      (s.audience === 'homeowner' && isHomeowner) ||
      (s.audience === 'partner' && isPartner);
    const rel = FIELD_GUIDE.filter(isRelevant);
    const other = FIELD_GUIDE.filter((s) => !isRelevant(s));
    return { relevant: rel, rest: other, ordered: [...rel, ...other], personalized: other.length > 0 };
  }, [isHomeowner, isPartner]);

  const total = ordered.length;
  const roleLabel = isHomeowner && isPartner ? 'sender & partner' : isPartner ? 'partner' : 'sender';

  const [active, setActive] = useState<number | null>(null);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const visitedCount = visited.size;
  const overall = useSharedValue(0);
  React.useEffect(() => {
    overall.value = withSpring(total > 0 ? visitedCount / total : 0, { damping: 16, stiffness: 120 });
  }, [visitedCount, overall, total]);
  const overallStyle = useAnimatedStyle(() => ({ width: `${overall.value * 100}%` }));

  const openSection = useCallback((i: number) => {
    haptic();
    setDirection('right');
    setVisited((prev) => new Set(prev).add(i));
    setActive(i);
  }, []);

  const goNext = useCallback(() => {
    setActive((cur) => {
      if (cur === null) return cur;
      if (cur >= total - 1) return null; // finish → back to index
      const next = cur + 1;
      setDirection('right');
      setVisited((prev) => new Set(prev).add(next));
      return next;
    });
  }, [total]);

  const goPrev = useCallback(() => {
    setActive((cur) => {
      if (cur === null) return cur;
      if (cur <= 0) return null; // back to index
      const next = cur - 1;
      setDirection('left');
      setVisited((prev) => new Set(prev).add(next));
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Rigid);
    reset();
    setMenuOpen(false);
  }, [reset]);

  if (active !== null) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <SectionView
          section={ordered[active]}
          position={active + 1}
          total={total}
          direction={direction}
          onBack={() => setActive(null)}
          onNext={goNext}
          onPrev={goPrev}
          Colors={Colors}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: Colors.background }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={10}>
          <Ionicons name="close" size={22} color={Colors.slateLight} />
        </Pressable>

        <Pressable onPress={() => setMenuOpen((v) => !v)} style={styles.menuBtn} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.slateLight} />
        </Pressable>

        {menuOpen ? (
          <Animated.View
            entering={FadeIn.duration(140)}
            style={[styles.menu, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
          >
            <Pressable onPress={handleReset} style={styles.menuItem}>
              <Ionicons name="refresh" size={16} color={Colors.danger} />
              <Text style={[styles.menuItemText, { color: Colors.danger }]}>Reset Progress</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <View style={[styles.brandBadge, { backgroundColor: NAVY }]}>
          <Ionicons name="shield-checkmark" size={30} color={ORANGE} />
        </View>
        <Text style={[styles.title, { color: Colors.slate }]}>The Porchivo Field Guide</Text>
        <Text style={[styles.subtitle, { color: Colors.slateLight }]}>
          {personalized ? `Tailored to your ${roleLabel} role.` : 'Everything you need. Nothing you don’t.'}
        </Text>
        <SweepLine />

        {/* Sticky progress bar */}
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: NAVY + '22' }]}>
            <Animated.View style={[styles.progressFill, { backgroundColor: ORANGE }, overallStyle]} />
          </View>
          <Text style={[styles.progressLabel, { color: Colors.slateLight }]}>
            {visitedCount} of {total} sections visited
          </Text>
        </View>
      </View>

      {/* Index list */}
      <RNScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => menuOpen && setMenuOpen(false)}
      >
        <HiddenServicesCard
          delayIndex={0}
          onPress={() => {
            haptic();
            router.push('/ups-amazon/hub');
          }}
        />

        {relevant.map((s, i) => (
          <SectionCard
            key={s.id}
            section={s}
            position={i + 1}
            delayIndex={i}
            completed={isCompleted(s.id)}
            onPress={() => openSection(i)}
            Colors={Colors}
          />
        ))}

        {rest.length > 0 ? (
          <View style={styles.groupHeader}>
            <View style={[styles.groupHeaderLine, { backgroundColor: Colors.border }]} />
            <Text style={[styles.groupHeaderText, { color: Colors.slateLight }]}>Also available</Text>
            <View style={[styles.groupHeaderLine, { backgroundColor: Colors.border }]} />
          </View>
        ) : null}

        {rest.map((s, i) => {
          const pos = relevant.length + i;
          return (
            <SectionCard
              key={s.id}
              section={s}
              position={pos + 1}
              delayIndex={pos}
              completed={isCompleted(s.id)}
              onPress={() => openSection(pos)}
              Colors={Colors}
            />
          );
        })}
      </RNScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  closeBtn: { position: 'absolute', left: 16, top: 0, paddingTop: 0, zIndex: 10 },
  menuBtn: { position: 'absolute', right: 16, top: 0, zIndex: 10 },
  menu: {
    position: 'absolute',
    right: 16,
    top: 36,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  menuItemText: { fontSize: 14, fontWeight: '600' },
  brandBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 12, textAlign: 'center' },

  // Audience pill
  audiencePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  audiencePillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  sectionAudiencePill: { marginTop: 10, marginLeft: 52 },

  // Featured link-out card
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    paddingRight: 40,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featuredIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,98,42,0.18)',
  },
  featuredBody: { flex: 1, gap: 4 },
  featuredBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(232,98,42,0.22)',
  },
  featuredBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: ORANGE },
  featuredTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  featuredTeaser: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.7)' },
  featuredChevron: { position: 'absolute', right: 16 },

  // Group divider
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 2, paddingHorizontal: 4 },
  groupHeaderLine: { flex: 1, height: StyleSheet.hairlineWidth },
  groupHeaderText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sweepTrack: { width: '100%', height: 3, borderRadius: 2, overflow: 'hidden' },
  sweepFill: { height: 3, borderRadius: 2, overflow: 'hidden' },

  // Progress
  progressWrap: { width: '100%', marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 4, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 999 },
  progressLabel: { fontSize: 11, fontWeight: '600' },

  // Index list
  listContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    paddingRight: 40,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardWatermark: {
    position: 'absolute',
    right: -6,
    top: -14,
    fontSize: 72,
    fontWeight: '900',
    color: 'rgba(26,43,74,0.05)',
  },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardTeaser: { fontSize: 13, lineHeight: 18 },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeEmpty: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  cardChevron: { position: 'absolute', right: 14, bottom: 14 },

  // Section view
  sectionContainer: { flex: 1 },
  ribbonTrack: { position: 'absolute', left: 0, bottom: 0, width: 3, zIndex: 5, justifyContent: 'flex-start' },
  ribbonFill: { width: 3, backgroundColor: ORANGE, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  sectionContent: { paddingHorizontal: 22 },
  sectionHeader: { marginBottom: 20, minHeight: 64, justifyContent: 'center' },
  ghostNumber: { position: 'absolute', left: -2, top: -18, fontSize: 88, fontWeight: '900', opacity: 0.08 },
  sectionHeaderInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIconChip: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 22, fontWeight: '800', flex: 1, letterSpacing: -0.4 },

  blockSpacing: { marginBottom: 16 },
  bodyText: { fontSize: 17, lineHeight: 27 },
  bodyStat: { fontWeight: '800', color: ORANGE },

  tipCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    paddingLeft: 12,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: ORANGE,
    marginLeft: -4,
    marginBottom: 16,
  },
  tipEmoji: { fontSize: 18, marginTop: 1 },
  tipLabel: { fontSize: 13, fontWeight: '700', fontStyle: 'italic', marginBottom: 3 },
  tipText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },

  table: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  tableRow: { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 14 },
  tableHeaderRow: { backgroundColor: 'transparent' },
  tableHeaderCell: { flex: 1, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  tableCell: { flex: 1, fontSize: 15, lineHeight: 20 },
  tableCellFirst: { flex: 1.1, fontWeight: '600' },

  completeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    marginTop: 10,
    marginBottom: 24,
  },
  completeChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  navBtnPrimary: { borderWidth: 0 },
  navBtnText: { fontSize: 14, fontWeight: '700' },
  navCount: { fontSize: 13, fontWeight: '700' },

  backFloat: { position: 'absolute', left: 16, zIndex: 30, borderRadius: 999, overflow: 'hidden' },
  backPressable: { borderRadius: 999, overflow: 'hidden' },
  backBlur: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9 },
  backText: { fontSize: 14, fontWeight: '700' },
});
