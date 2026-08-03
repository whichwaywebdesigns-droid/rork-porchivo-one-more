import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ArrowRight,
  Send,
  Clock,
  Pin,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  X,
  ChevronRight,
  Repeat2,
} from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useApp } from '@/store/AppContext';
import {
  AnnouncementPriority,
  AnnouncementCategory,
  VariationMode,
} from '@/types/organization';

const { width: SW } = Dimensions.get('window');

// ─── Phrase library — rich rotating wording per category ──────────────────────
// Each category has 6+ variations. The "Daily Spark" algorithm picks one based
// on the current day-of-year so every session feels fresh without manual effort.

const PHRASE_LIBRARY: Record<AnnouncementCategory, string[]> = {
  package: [
    'A package has arrived and is ready for pickup at the front desk. Please collect it at your earliest convenience.',
    'Good news — a delivery is waiting for you! Swing by the office during business hours to pick it up.',
    "You've got a parcel! It's safe with us at the front desk whenever you're ready.",
    'Package check: something arrived for you today. Pick it up during office hours (Mon–Fri, 9 AM–6 PM).',
    'Heads up — your delivery is here and in safe hands. Please retrieve it within 5 business days.',
    'Your package is ready for collection. Stop by the mailroom or front office when convenient.',
  ],
  maintenance: [
    'Scheduled maintenance is coming up. Please plan accordingly — temporary disruption may be expected.',
    'Our team will be performing maintenance work to keep things running smoothly. Details below.',
    "We're keeping your community in top shape. Here's what maintenance is scheduled this period.",
    'Maintenance notice: temporary service disruption expected during the window outlined below.',
    'Your comfort is our priority. Planned maintenance has been scheduled as described below.',
    'Routine upkeep is scheduled — we appreciate your patience as we maintain community standards.',
  ],
  safety: [
    'Your safety is our top priority. Please read this important community notice carefully.',
    'Community safety alert — please stay informed, stay vigilant, and look out for one another.',
    'An important safety update for all residents. Please review and share with your household.',
    'We want everyone safe and informed. Please read this notice and take appropriate precautions.',
    "Stay aware and stay safe. Here's what all residents should know right now.",
    'Security notice for the community. Please familiarize yourself with the details below.',
  ],
  meeting: [
    'Join us for an upcoming community meeting — your voice shapes our neighborhood.',
    'Your input matters. We hope to see you at our next community gathering.',
    'Community meeting coming up. Come share your ideas and hear the latest updates.',
    'Mark your calendar — a community gathering has been scheduled. Details inside.',
    'All residents are warmly invited to our upcoming meeting. Refreshments provided!',
    "We're getting together as a community. Bring your questions, ideas, and neighbors.",
  ],
  parking: [
    'A parking update affecting our community. Please review the details and plan ahead.',
    'Important parking notice — temporary changes are coming to the lot or garage.',
    'Heads up on parking availability. Please make alternate arrangements if needed.',
    'Parking area changes are scheduled. Review below and adjust your plans accordingly.',
    'Residents: please note upcoming changes to parking access. Details are outlined below.',
    'Parking lot notice for all residents — a scheduled change is coming up.',
  ],
  amenity: [
    "An update on your community amenities — here's what to expect in the coming days.",
    "Amenity notice for all residents. We're working to enhance your living experience.",
    "Planned amenity maintenance is scheduled. Here's what will be temporarily unavailable.",
    "We're improving your amenities! Some areas may be temporarily inaccessible.",
    'Amenity update: our team is working hard to keep community spaces in great shape.',
    'Scheduled amenity work is underway. We appreciate your patience during this period.',
  ],
  emergency: [
    'URGENT: Immediate attention is required by all residents. Please read this now.',
    'Emergency notice for all residents — please act on this information immediately.',
    'All residents: an urgent situation requires your immediate awareness and action.',
    'This is an emergency communication. Follow all instructions from management and authorities.',
    'Emergency alert — stay safe, stay calm, and stay informed. Details are below.',
    'Urgent community communication: your safety is paramount. Please read immediately.',
  ],
  general: [
    'A community update from your board — keeping you informed and connected.',
    "Staying connected: here's the latest news from your management team.",
    'Community bulletin — read the latest updates from your board.',
    "Your community, your updates. Here's what's happening this month.",
    'Keeping you in the loop with this community notice from management.',
    'News from your property team — we value transparency and open communication.',
  ],
};

// ─── Phrase Engine algorithm ──────────────────────────────────────────────────

/** Returns the "Daily Spark" — a rotating phrase for a category keyed to today's date + offset. */
function getDailyPhrase(category: AnnouncementCategory, offset = 0): string {
  const phrases = PHRASE_LIBRARY[category];
  const dayIndex = Math.floor(Date.now() / 86400000) + offset;
  return phrases[dayIndex % phrases.length];
}

// ─── Category config ──────────────────────────────────────────────────────────

type CatMeta = { icon: string; label: string; accent: string };

const CAT_META: Record<AnnouncementCategory, CatMeta> = {
  general:     { icon: '📣', label: 'General',     accent: '#3A7BD5' },
  package:     { icon: '📦', label: 'Package',     accent: '#2E9B6F' },
  maintenance: { icon: '🔧', label: 'Maintenance', accent: '#E07B00' },
  safety:      { icon: '🛡️', label: 'Safety',      accent: '#8B5CF6' },
  meeting:     { icon: '📅', label: 'Meeting',     accent: '#0891B2' },
  parking:     { icon: '🚗', label: 'Parking',     accent: '#6B7F99' },
  amenity:     { icon: '🏊', label: 'Amenity',     accent: '#0891B2' },
  emergency:   { icon: '🚨', label: 'Emergency',   accent: '#D94040' },
};

const CAT_ORDER: AnnouncementCategory[] = [
  'general', 'package', 'maintenance', 'safety',
  'meeting', 'parking', 'amenity', 'emergency',
];

// ─── Priority config ──────────────────────────────────────────────────────────

type PriorityMeta = { color: string; label: string; desc: string; emoji: string };

const PRIORITY_META: Record<AnnouncementPriority, PriorityMeta> = {
  low:    { color: '#6B7F99', label: 'Low',    desc: 'Informational',  emoji: '○' },
  normal: { color: '#3A7BD5', label: 'Normal', desc: 'Standard',       emoji: '●' },
  high:   { color: '#E07B00', label: 'High',   desc: 'Important',      emoji: '▲' },
  urgent: { color: '#D94040', label: 'Urgent', desc: 'Immediate',      emoji: '!' },
};

const PRIORITY_ORDER: AnnouncementPriority[] = ['low', 'normal', 'high', 'urgent'];

// ─── Variation mode config ────────────────────────────────────────────────────

type VariationMeta = { label: string; desc: string; icon: string };

const VARIATION_META: Record<VariationMode, VariationMeta> = {
  daily:      { label: 'Daily',      desc: 'Refreshes each day',     icon: '☀️' },
  weekly:     { label: 'Weekly',     desc: 'Refreshes each week',    icon: '📆' },
  sequential: { label: 'Sequential', desc: 'Cycles by view count',   icon: '🔢' },
  random:     { label: 'Random',     desc: 'Seeded-random daily',    icon: '🎲' },
};

const VARIATION_ORDER: VariationMode[] = ['daily', 'weekly', 'sequential', 'random'];

// ─── Schedule presets ─────────────────────────────────────────────────────────

function buildSchedulePresets(): Array<{ label: string; iso: string }> {
  const now = new Date();

  function make(offsetHours: number, h: number, m: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() + Math.floor(offsetHours / 24));
    d.setHours(h, m, 0, 0);
    return d;
  }

  const t9am  = make(1, 9,  0);
  const t6pm  = make(1, 18, 0);
  const t3d   = make(3, 9,  0);
  const t7d   = make(7, 9,  0);

  function fmt(d: Date): string {
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  return [
    { label: `Tomorrow 9 AM · ${fmt(t9am)}`,  iso: t9am.toISOString() },
    { label: `Tomorrow 6 PM · ${fmt(t6pm)}`,  iso: t6pm.toISOString() },
    { label: `In 3 days · ${fmt(t3d)}`,         iso: t3d.toISOString()  },
    { label: `Next week · ${fmt(t7d)}`,          iso: t7d.toISOString()  },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated 3-dot step indicator */
function StepDots({ step }: { step: number }) {
  const Colors = useColors();
  return (
    <View style={dots.row}>
      {[1, 2, 3].map((n) => {
        const active = n === step;
        const done   = n < step;
        return (
          <View
            key={n}
            style={[
              dots.dot,
              {
                width:  active ? 20 : done ? 12 : 8,
                backgroundColor: active
                  ? Colors.primary
                  : done
                  ? Colors.primary + '60'
                  : Colors.border,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const dots = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { height: 8, borderRadius: 4 },
});

/** Daily Spark banner — shows a rotating phrase suggestion */
function PhraseSpark({
  category,
  onUse,
}: {
  category: AnnouncementCategory;
  onUse: (text: string) => void;
}) {
  const Colors = useColors();
  const [offset, setOffset] = useState<number>(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const phrase = useMemo(
    () => getDailyPhrase(category, offset),
    [category, offset]
  );

  const rotate = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setOffset((o) => o + 1);
  }, [fadeAnim]);

  // Reset offset when category changes
  useEffect(() => { setOffset(0); }, [category]);

  return (
    <View style={[spark.root, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}>
      <View style={spark.header}>
        <View style={spark.headerLeft}>
          <Sparkles size={13} color={Colors.secondary} />
          <Text style={[spark.label, { color: Colors.secondary }]}>DAILY SPARK</Text>
        </View>
        <TouchableOpacity onPress={rotate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <RefreshCw size={13} color={Colors.slateLighter} />
        </TouchableOpacity>
      </View>
      <Animated.Text
        style={[spark.phrase, { color: Colors.slateLight, opacity: fadeAnim }]}
        numberOfLines={3}
      >
        {phrase}
      </Animated.Text>
      <TouchableOpacity
        onPress={() => onUse(phrase)}
        style={[spark.useBtn, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}
        activeOpacity={0.8}
      >
        <Text style={[spark.useBtnText, { color: Colors.primary }]}>Use this wording →</Text>
      </TouchableOpacity>
    </View>
  );
}

const spark = StyleSheet.create({
  root: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.4 },
  phrase: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  useBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  useBtnText: { fontSize: 12, fontWeight: '700' as const },
});

/** Single variation body card with delete button */
function VariationCard({
  value,
  index,
  onChange,
  onRemove,
}: {
  value: string;
  index: number;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const Colors = useColors();
  return (
    <View style={[vCard.root, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <View style={vCard.header}>
        <View style={[vCard.badge, { backgroundColor: Colors.primary + '18' }]}>
          <Repeat2 size={11} color={Colors.primary} />
          <Text style={[vCard.badgeText, { color: Colors.primary }]}>
            Variation {index + 2}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Trash2 size={14} color={Colors.slateLighter} />
        </TouchableOpacity>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={`Alternative wording for this announcement…`}
        placeholderTextColor={Colors.slateLighter}
        style={[vCard.input, { color: Colors.slate }]}
        multiline
        maxLength={1000}
        textAlignVertical="top"
      />
      <Text style={[vCard.charCount, { color: Colors.slateLighter }]}>
        {value.length}/1000
      </Text>
    </View>
  );
}

const vCard = StyleSheet.create({
  root: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '700' as const },
  input: { fontSize: 13, lineHeight: 20, minHeight: 72 },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: 4 },
});

/** Preview modal — shows how the card will render for residents */
function PreviewModal({
  visible,
  title,
  body,
  priority,
  category,
  isPinned,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  category: AnnouncementCategory;
  isPinned: boolean;
  onClose: () => void;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacAnim]);

  if (!visible) return null;

  const pMeta = PRIORITY_META[priority];
  const cMeta = CAT_META[category];

  return (
    <Animated.View style={[pm.backdrop, { opacity: opacAnim }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <Animated.View
        style={[
          pm.modal,
          { backgroundColor: Colors.background, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Modal header */}
        <View style={pm.modalHeader}>
          <View style={[pm.previewBadge, { backgroundColor: Colors.elevated }]}>
            <Eye size={12} color={Colors.slateLighter} />
            <Text style={[pm.previewLabel, { color: Colors.slateLighter }]}>
              RESIDENT VIEW
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={18} color={Colors.slate} />
          </TouchableOpacity>
        </View>

        {/* Preview card */}
        <View
          style={[
            pm.card,
            {
              backgroundColor: Colors.surface,
              borderColor: Colors.border,
              borderLeftColor: pMeta.color,
            },
          ]}
        >
          <View style={pm.cardTopRow}>
            <View style={pm.cardMeta}>
              <Text style={pm.catEmoji}>{cMeta.icon}</Text>
              <Text style={[pm.catLabel, { color: Colors.slateLighter }]}>
                {cMeta.label.toUpperCase()}
              </Text>
              {isPinned ? (
                <View style={[pm.pinPill, { backgroundColor: '#C5850030' }]}>
                  <Text style={[pm.pinText, { color: '#C58500' }]}>📌 Pinned</Text>
                </View>
              ) : null}
            </View>
            <View style={[pm.pBadge, { backgroundColor: pMeta.color + '1A' }]}>
              <View style={[pm.pDot, { backgroundColor: pMeta.color }]} />
              <Text style={[pm.pText, { color: pMeta.color }]}>{pMeta.label}</Text>
            </View>
          </View>
          <Text style={[pm.cardTitle, { color: Colors.slate }]} numberOfLines={2}>
            {title || 'Your announcement title'}
          </Text>
          <Text style={[pm.cardBody, { color: Colors.slateLight }]} numberOfLines={4}>
            {body || 'Your announcement body will appear here.'}
          </Text>
          <View style={pm.cardFooter}>
            <Text style={[pm.cardMeta2, { color: Colors.slateLighter }]}>
              Just now
            </Text>
          </View>
        </View>

        <Text style={[pm.hint, { color: Colors.slateLighter }]}>
          This is how your announcement will appear to residents.
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const pm = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 20,
  },
  modal: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewLabel: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.2 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  catEmoji: { fontSize: 13 },
  catLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  pinPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  pinText: { fontSize: 9, fontWeight: '700' as const },
  pBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  pDot: { width: 5, height: 5, borderRadius: 3 },
  pText: { fontSize: 10, fontWeight: '700' as const },
  cardTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 5, letterSpacing: -0.2 },
  cardBody: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  cardFooter: { flexDirection: 'row' },
  cardMeta2: { fontSize: 10 },
  hint: { fontSize: 11, textAlign: 'center' },
});

// ─── Section label ─────────────────────────────────────────────────────────────

function SLabel({ title }: { title: string }) {
  const Colors = useColors();
  return (
    <Text style={[sl.text, { color: Colors.slateLighter }]}>
      {title.toUpperCase()}
    </Text>
  );
}

const sl = StyleSheet.create({
  text: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.3, marginBottom: 10 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PostAnnouncementScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { user }  = useApp();
  const { postAnnouncement, isPostingAnnouncement, activeOrg } = useOrganization();

  // ── Step state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Form state ─────────────────────────────────────────────────────────
  const [category,    setCategory]    = useState<AnnouncementCategory>('general');
  const [priority,    setPriority]    = useState<AnnouncementPriority>('normal');
  const [title,       setTitle]       = useState<string>('');
  const [body,        setBody]        = useState<string>('');
  // Phrase variations
  const [variations,  setVariations]  = useState<string[]>([]);
  const [rotateMode,  setRotateMode]  = useState<VariationMode>('daily');
  const [rotateOn,    setRotateOn]    = useState<boolean>(false);
  // Options
  const [isPinned,    setIsPinned]    = useState<boolean>(false);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduleIso, setScheduleIso] = useState<string | null>(null);
  const [hasExpiry,   setHasExpiry]   = useState<boolean>(false);
  const [expiryDays,  setExpiryDays]  = useState<number>(7);
  // Preview
  const [previewVisible, setPreview]  = useState<boolean>(false);

  const schedulePresets = useMemo(buildSchedulePresets, []);

  // ── Step slide animation ───────────────────────────────────────────────
  const goToStep = useCallback(
    (nextStep: 1 | 2 | 3) => {
      const dir = nextStep > step ? SW : -SW;
      Animated.timing(slideAnim, {
        toValue: -dir,
        duration: 260,
        useNativeDriver: true,
      }).start(() => {
        setStep(nextStep);
        slideAnim.setValue(dir);
        Animated.spring(slideAnim, {
          toValue: 0,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      });
    },
    [step, slideAnim]
  );

  // ── Phrase spark handler ───────────────────────────────────────────────
  const handleUsePhrase = useCallback((text: string) => {
    setBody(text);
  }, []);

  // ── Variation management ───────────────────────────────────────────────
  const addVariation = useCallback(() => {
    setVariations((v) => [...v, '']);
    setRotateOn(true);
  }, []);

  const updateVariation = useCallback((idx: number, val: string) => {
    setVariations((v) => {
      const next = [...v];
      next[idx] = val;
      return next;
    });
  }, []);

  const removeVariation = useCallback((idx: number) => {
    setVariations((v) => {
      const next = v.filter((_, i) => i !== idx);
      if (next.length === 0) setRotateOn(false);
      return next;
    });
  }, []);

  // ── Expiry ISO ─────────────────────────────────────────────────────────
  function expiryIso(): string | null {
    if (!hasExpiry) return null;
    const d = new Date();
    d.setDate(d.getDate() + expiryDays);
    return d.toISOString();
  }

  // ── Validation ─────────────────────────────────────────────────────────
  const step1Valid = true; // always valid — category + priority have defaults
  const step2Valid = title.trim().length > 0 && body.trim().length > 0;
  const canPost    = step2Valid && (!isScheduled || !!scheduleIso);

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handlePost() {
    if (!step2Valid) {
      Alert.alert('Missing content', 'Please add a title and body before posting.');
      return;
    }
    if (isScheduled && !scheduleIso) {
      Alert.alert('Choose schedule time', 'Please select when to publish this announcement.');
      return;
    }

    const activeVariations = rotateOn
      ? variations.filter((v) => v.trim().length > 0)
      : [];

    try {
      await postAnnouncement({
        title,
        body,
        priority,
        category,
        isPinned,
        scheduledAt: isScheduled ? scheduleIso : null,
        expiresAt: expiryIso(),
        authorDisplayName: user?.name ?? null,
        bodyVariations: activeVariations.length > 0 ? activeVariations : null,
        variationMode: activeVariations.length > 0 ? rotateMode : null,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not post announcement. Please try again.');
    }
  }

  // ─── Step 1 — Broadcast Type ───────────────────────────────────────────
  function renderStep1() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.stepContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[S.stepTitle, { color: Colors.slate }]}>What type of broadcast?</Text>
        <Text style={[S.stepSub, { color: Colors.slateLighter }]}>
          Choose a category and priority level to shape your message.
        </Text>

        {/* Category grid */}
        <View style={{ marginTop: 20 }}>
          <SLabel title="Category" />
          <View style={S.catGrid}>
            {CAT_ORDER.map((cat) => {
              const meta = CAT_META[cat];
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.8}
                  style={[
                    S.catCard,
                    {
                      backgroundColor: active ? meta.accent + '18' : Colors.surface,
                      borderColor: active ? meta.accent : Colors.border,
                    },
                  ]}
                >
                  <Text style={S.catEmoji}>{meta.icon}</Text>
                  <Text
                    style={[
                      S.catLabel,
                      { color: active ? meta.accent : Colors.slateLight },
                    ]}
                  >
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Priority */}
        <View style={{ marginTop: 24 }}>
          <SLabel title="Priority" />
          <View style={S.priorityRow}>
            {PRIORITY_ORDER.map((p) => {
              const meta = PRIORITY_META[p];
              const active = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  activeOpacity={0.8}
                  style={[
                    S.priorityCard,
                    {
                      backgroundColor: active ? meta.color + '1A' : Colors.surface,
                      borderColor: active ? meta.color : Colors.border,
                    },
                  ]}
                >
                  <Text style={[S.priorityEmoji, { color: meta.color }]}>{meta.emoji}</Text>
                  <Text style={[S.priorityLabel, { color: active ? meta.color : Colors.slateLight }]}>
                    {meta.label}
                  </Text>
                  <Text style={[S.priorityDesc, { color: Colors.slateLighter }]}>{meta.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  }

  // ─── Step 2 — Craft Message ────────────────────────────────────────────
  function renderStep2() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.stepContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[S.stepTitle, { color: Colors.slate }]}>Craft your message</Text>
        <Text style={[S.stepSub, { color: Colors.slateLighter }]}>
          Write your announcement or tap a Daily Spark to get started instantly.
        </Text>

        {/* Daily Spark */}
        <View style={{ marginTop: 20 }}>
          <PhraseSpark category={category} onUse={handleUsePhrase} />
        </View>

        {/* Title */}
        <View style={{ marginBottom: 18 }}>
          <SLabel title="Title" />
          <View style={[S.inputWrap, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Announcement title…"
              placeholderTextColor={Colors.slateLighter}
              style={[S.titleInput, { color: Colors.slate }]}
              maxLength={120}
              returnKeyType="next"
            />
          </View>
          <Text style={[S.charCount, { color: Colors.slateLighter }]}>{title.length}/120</Text>
        </View>

        {/* Primary body */}
        <View style={{ marginBottom: 6 }}>
          <View style={S.bodyLabelRow}>
            <SLabel title={rotateOn ? 'Primary Wording' : 'Message'} />
            {rotateOn ? (
              <View style={[S.variation1Badge, { backgroundColor: Colors.primary + '15' }]}>
                <Text style={[S.variation1Text, { color: Colors.primary }]}>Variation 1</Text>
              </View>
            ) : null}
          </View>
          <View
            style={[
              S.inputWrap,
              S.bodyWrap,
              {
                backgroundColor: Colors.surface,
                borderColor: rotateOn ? Colors.primary + '60' : Colors.border,
              },
            ]}
          >
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write your community update here…"
              placeholderTextColor={Colors.slateLighter}
              style={[S.bodyInput, { color: Colors.slate }]}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
          </View>
          <Text style={[S.charCount, { color: Colors.slateLighter }]}>{body.length}/1000</Text>
        </View>

        {/* Phrase Rotation section */}
        <View
          style={[
            S.rotationBox,
            { backgroundColor: Colors.elevated, borderColor: Colors.border },
          ]}
        >
          <View style={S.rotationHeader}>
            <View style={S.rotationHeaderLeft}>
              <Repeat2 size={15} color={Colors.primary} />
              <View>
                <Text style={[S.rotationTitle, { color: Colors.slate }]}>
                  Phrase Rotation
                </Text>
                <Text style={[S.rotationSub, { color: Colors.slateLighter }]}>
                  Auto-rotate wording so residents see fresh language each cycle.
                </Text>
              </View>
            </View>
            <Switch
              value={rotateOn}
              onValueChange={(v) => {
                setRotateOn(v);
                if (v && variations.length === 0) addVariation();
                if (!v) setVariations([]);
              }}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {rotateOn ? (
            <View style={{ marginTop: 12 }}>
              {/* Variation cards */}
              {variations.map((v, i) => (
                <VariationCard
                  key={i}
                  index={i}
                  value={v}
                  onChange={(val) => updateVariation(i, val)}
                  onRemove={() => removeVariation(i)}
                />
              ))}

              {/* Add variation button */}
              {variations.length < 5 ? (
                <TouchableOpacity
                  onPress={addVariation}
                  style={[S.addVarBtn, { borderColor: Colors.primary + '50' }]}
                  activeOpacity={0.8}
                >
                  <Plus size={14} color={Colors.primary} />
                  <Text style={[S.addVarText, { color: Colors.primary }]}>
                    Add Another Wording
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Rotation mode */}
              <View style={{ marginTop: 14 }}>
                <SLabel title="Rotation Schedule" />
                <View style={S.modeGrid}>
                  {VARIATION_ORDER.map((mode) => {
                    const meta = VARIATION_META[mode];
                    const active = rotateMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => setRotateMode(mode)}
                        activeOpacity={0.8}
                        style={[
                          S.modeCard,
                          {
                            backgroundColor: active ? Colors.primary + '15' : Colors.surface,
                            borderColor: active ? Colors.primary : Colors.border,
                          },
                        ]}
                      >
                        <Text style={S.modeIcon}>{meta.icon}</Text>
                        <Text style={[S.modeLabel, { color: active ? Colors.primary : Colors.slateLight }]}>
                          {meta.label}
                        </Text>
                        <Text style={[S.modeDesc, { color: Colors.slateLighter }]}>
                          {meta.desc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={[S.modeSummary, { backgroundColor: Colors.primary + '0D', borderColor: Colors.primary + '30' }]}>
                  <Text style={[S.modeSummaryText, { color: Colors.primary }]}>
                    {`✓  Residents see a different wording ${VARIATION_META[rotateMode].desc.toLowerCase()}.`}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  // ─── Step 3 — Schedule & Launch ────────────────────────────────────────
  function renderStep3() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.stepContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[S.stepTitle, { color: Colors.slate }]}>Schedule & launch</Text>
        <Text style={[S.stepSub, { color: Colors.slateLighter }]}>
          Optionally pin, schedule, or set an expiry — then broadcast to your community.
        </Text>

        {/* Preview */}
        <TouchableOpacity
          onPress={() => setPreview(true)}
          style={[S.previewBtn, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}
          activeOpacity={0.8}
        >
          <Eye size={15} color={Colors.slateLight} />
          <Text style={[S.previewBtnText, { color: Colors.slateLight }]}>
            Preview how residents will see this
          </Text>
          <ChevronRight size={14} color={Colors.slateLighter} />
        </TouchableOpacity>

        <View style={{ marginTop: 20 }}>
          <SLabel title="Options" />

          {/* Pin */}
          <View style={[S.optRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <View style={S.optLeft}>
              <Pin size={16} color="#C58500" />
              <View>
                <Text style={[S.optTitle, { color: Colors.slate }]}>Pin to top</Text>
                <Text style={[S.optDesc, { color: Colors.slateLighter }]}>
                  Stays above other announcements
                </Text>
              </View>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: Colors.border, true: '#C58500' }}
              thumbColor="#fff"
            />
          </View>

          {/* Schedule */}
          <View style={[S.optRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <View style={S.optLeft}>
              <Clock size={16} color={Colors.primary} />
              <View>
                <Text style={[S.optTitle, { color: Colors.slate }]}>Schedule publishing</Text>
                <Text style={[S.optDesc, { color: Colors.slateLighter }]}>
                  Auto-publish at a future date/time
                </Text>
              </View>
            </View>
            <Switch
              value={isScheduled}
              onValueChange={(v) => {
                setIsScheduled(v);
                if (!v) setScheduleIso(null);
              }}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {isScheduled ? (
            <View style={[S.presetsWrap, { borderColor: Colors.border }]}>
              {schedulePresets.map((p) => {
                const sel = scheduleIso === p.iso;
                return (
                  <TouchableOpacity
                    key={p.iso}
                    onPress={() => setScheduleIso(p.iso)}
                    style={[
                      S.presetRow,
                      {
                        backgroundColor: sel ? Colors.primary + '12' : Colors.elevated,
                        borderColor: sel ? Colors.primary : 'transparent',
                      },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Clock size={12} color={sel ? Colors.primary : Colors.slateLighter} />
                    <Text style={[S.presetText, { color: sel ? Colors.primary : Colors.slateLight }]}>
                      {p.label}
                    </Text>
                    {sel ? <ChevronRight size={13} color={Colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* Auto-expire */}
          <View style={[S.optRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <View style={S.optLeft}>
              <Text style={{ fontSize: 16 }}>⏳</Text>
              <View>
                <Text style={[S.optTitle, { color: Colors.slate }]}>Auto-expire</Text>
                <Text style={[S.optDesc, { color: Colors.slateLighter }]}>
                  Remove announcement after N days
                </Text>
              </View>
            </View>
            <Switch
              value={hasExpiry}
              onValueChange={setHasExpiry}
              trackColor={{ false: Colors.border, true: Colors.secondary }}
              thumbColor="#fff"
            />
          </View>

          {hasExpiry ? (
            <View
              style={[S.expiryRow, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}
            >
              <Text style={[S.expiryLabel, { color: Colors.slateLight }]}>Expire after:</Text>
              <View style={S.expiryPills}>
                {[3, 7, 14, 30].map((days) => (
                  <TouchableOpacity
                    key={days}
                    onPress={() => setExpiryDays(days)}
                    activeOpacity={0.8}
                    style={[
                      S.expiryPill,
                      {
                        backgroundColor: expiryDays === days ? Colors.secondary + '20' : Colors.surface,
                        borderColor: expiryDays === days ? Colors.secondary : Colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.expiryPillText,
                        { color: expiryDays === days ? Colors.secondary : Colors.slateLight },
                      ]}
                    >
                      {days}d
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Rotation summary if enabled */}
        {rotateOn && variations.filter((v) => v.trim()).length > 0 ? (
          <View style={[S.summaryBox, { backgroundColor: Colors.primary + '0A', borderColor: Colors.primary + '25' }]}>
            <Repeat2 size={14} color={Colors.primary} />
            <Text style={[S.summaryText, { color: Colors.primary }]}>
              {`${1 + variations.filter((v) => v.trim()).length} phrase${1 + variations.filter((v) => v.trim()).length > 1 ? 's' : ''} · rotates ${VARIATION_META[rotateMode].desc.toLowerCase()}`}
            </Text>
          </View>
        ) : null}

        {/* Big broadcast CTA */}
        <TouchableOpacity
          onPress={handlePost}
          disabled={!canPost || isPostingAnnouncement}
          activeOpacity={0.85}
          style={[
            S.ctaBtn,
            {
              backgroundColor: canPost ? Colors.primary : Colors.elevated,
              opacity: isPostingAnnouncement ? 0.7 : 1,
              marginTop: 24,
            },
          ]}
        >
          {isPostingAnnouncement ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={18} color={canPost ? '#fff' : Colors.slateLighter} />
              <Text style={[S.ctaBtnText, { color: canPost ? '#fff' : Colors.slateLighter }]}>
                {isScheduled
                  ? scheduleIso
                    ? 'Schedule Broadcast'
                    : 'Choose a Schedule Time'
                  : 'Broadcast Now'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const headerTitle = step === 1 ? 'Broadcast Type' : step === 2 ? 'Craft Message' : 'Schedule & Launch';

  return (
    <KeyboardAvoidingView
      style={[S.root, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Preview Modal (overlay) */}
      <PreviewModal
        visible={previewVisible}
        title={title}
        body={body}
        priority={priority}
        category={category}
        isPinned={isPinned}
        onClose={() => setPreview(false)}
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        style={[
          S.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (step === 1) {
              router.back();
            } else {
              goToStep((step - 1) as 1 | 2 | 3);
            }
          }}
          style={S.headerSide}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>

        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: Colors.slate }]}>{headerTitle}</Text>
          {activeOrg ? (
            <View style={S.headerSubRow}>
              <StepDots step={step} />
              <Text style={[S.headerSub, { color: Colors.slateLighter }]} numberOfLines={1}>
                {activeOrg.name}
              </Text>
            </View>
          ) : (
            <StepDots step={step} />
          )}
        </View>

        {/* Right: Next or Post */}
        {step < 3 ? (
          <TouchableOpacity
            onPress={() => goToStep((step + 1) as 2 | 3)}
            disabled={step === 2 && !step2Valid}
            style={[
              S.nextBtn,
              {
                backgroundColor:
                  step === 2 && !step2Valid ? Colors.elevated : Colors.primary,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text
              style={[
                S.nextBtnText,
                { color: step === 2 && !step2Valid ? Colors.slateLighter : '#fff' },
              ]}
            >
              Next
            </Text>
            <ArrowRight
              size={14}
              color={step === 2 && !step2Valid ? Colors.slateLighter : '#fff'}
            />
          </TouchableOpacity>
        ) : (
          <Pressable
            onPress={handlePost}
            disabled={!canPost || isPostingAnnouncement}
            style={[
              S.nextBtn,
              {
                backgroundColor: canPost ? Colors.primary : Colors.elevated,
                opacity: isPostingAnnouncement ? 0.6 : 1,
              },
            ]}
          >
            {isPostingAnnouncement ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Send size={14} color={canPost ? '#fff' : Colors.slateLighter} />
                <Text style={[S.nextBtnText, { color: canPost ? '#fff' : Colors.slateLighter }]}>
                  {isScheduled ? 'Schedule' : 'Post'}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* ── Steps ──────────────────────────────────────────────────────── */}
      <Animated.View
        style={[S.stepWrap, { transform: [{ translateX: slideAnim }] }]}
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  headerSide: { width: 38 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSub: { fontSize: 11 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nextBtnText: { fontSize: 13, fontWeight: '700' as const },

  // Step layout
  stepWrap: { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 20 },
  stepTitle: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },
  stepSub: { fontSize: 13, lineHeight: 18, marginTop: 5 },

  // Category grid
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catCard: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  catEmoji: { fontSize: 28 },
  catLabel: { fontSize: 13, fontWeight: '700' as const },

  // Priority
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 3,
  },
  priorityEmoji: { fontSize: 16, fontWeight: '800' as const },
  priorityLabel: { fontSize: 12, fontWeight: '700' as const },
  priorityDesc: { fontSize: 10, textAlign: 'center' },

  // Inputs
  inputWrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  bodyWrap: { paddingVertical: 12 },
  titleInput: { fontSize: 16, fontWeight: '600' as const, paddingVertical: 10 },
  bodyInput: { fontSize: 14, lineHeight: 22, minHeight: 110 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  bodyLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  variation1Badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  variation1Text: { fontSize: 10, fontWeight: '700' as const },

  // Rotation box
  rotationBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 6,
  },
  rotationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rotationHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  rotationTitle: { fontSize: 14, fontWeight: '700' as const },
  rotationSub: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  addVarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    justifyContent: 'center',
  },
  addVarText: { fontSize: 13, fontWeight: '600' as const },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  modeCard: {
    width: '47%',
    flexGrow: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 2,
    alignItems: 'center',
  },
  modeIcon: { fontSize: 18 },
  modeLabel: { fontSize: 12, fontWeight: '700' as const },
  modeDesc: { fontSize: 10, textAlign: 'center' },
  modeSummary: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeSummaryText: { fontSize: 12, fontWeight: '600' as const },

  // Step 3 options
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  previewBtnText: { flex: 1, fontSize: 13, fontWeight: '600' as const },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  optLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  optTitle: { fontSize: 14, fontWeight: '600' as const },
  optDesc: { fontSize: 11, marginTop: 2 },
  presetsWrap: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 0,
  },
  presetText: { flex: 1, fontSize: 13, fontWeight: '500' as const },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  expiryLabel: { fontSize: 13, fontWeight: '500' as const },
  expiryPills: { flexDirection: 'row', gap: 6 },
  expiryPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  expiryPillText: { fontSize: 12, fontWeight: '700' as const },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  summaryText: { fontSize: 12, fontWeight: '600' as const, flex: 1 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '700' as const },
});
