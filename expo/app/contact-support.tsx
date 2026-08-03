import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Application from 'expo-application';
import { Platform as RNPlatform } from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  Send,
  CheckCircle,
  MessageSquare,
  Clock,
  Plus,
  X,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { useAnalytics } from '@/store/AnalyticsContext';
import { error as logError } from '@/lib/logger';
import {
  fetchMyTickets,
  createTicket,
  SupportTicket,
  SupportTicketCategory,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_CATEGORY_EMOJI,
  TICKET_STATUS_LABELS,
  isTicketActive,
} from '@/lib/supportTickets';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusBadgeColor(
  status: SupportTicket['status'],
  Colors: AppColors,
): { bg: string; text: string } {
  switch (status) {
    case 'open':            return { bg: Colors.primary + '20',   text: Colors.primary };
    case 'in_progress':     return { bg: Colors.gold + '20',      text: Colors.gold };
    case 'waiting_on_user': return { bg: Colors.secondary + '20', text: Colors.secondary };
    case 'resolved':        return { bg: Colors.success + '20',   text: Colors.success };
    case 'closed':          return { bg: Colors.border,           text: Colors.slateLighter };
    default:                return { bg: Colors.border,           text: Colors.slateLight };
  }
}

// ─── Category picker chip ─────────────────────────────────────────────────────

function CategoryChip({
  category,
  selected,
  onSelect,
}: {
  category: SupportTicketCategory;
  selected: boolean;
  onSelect: () => void;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 55, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelect();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.categoryChip,
          {
            backgroundColor: selected ? Colors.primary + '14' : Colors.surface,
            borderColor: selected ? Colors.primary + '55' : Colors.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.categoryEmoji}>{TICKET_CATEGORY_EMOJI[category]}</Text>
        <Text
          style={[
            styles.categoryLabel,
            { color: selected ? Colors.primary : Colors.slateLight },
          ]}
          numberOfLines={1}
        >
          {TICKET_CATEGORY_LABELS[category]}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Ticket row ───────────────────────────────────────────────────────────────

function TicketRow({ ticket, onPress }: { ticket: SupportTicket; onPress: () => void }) {
  const Colors = useColors();
  const badge = statusBadgeColor(ticket.status, Colors);
  const active = isTicketActive(ticket.status);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.ticketRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
    >
      <View style={[styles.ticketEmoji, { backgroundColor: Colors.primary + '12' }]}>
        <Text style={styles.ticketEmojiText}>{TICKET_CATEGORY_EMOJI[ticket.category]}</Text>
      </View>
      <View style={styles.ticketMain}>
        <View style={styles.ticketTitleRow}>
          <Text style={[styles.ticketSubject, { color: Colors.slate }]} numberOfLines={1}>
            {ticket.subject}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusPillText, { color: badge.text }]}>
              {TICKET_STATUS_LABELS[ticket.status]}
            </Text>
          </View>
        </View>
        <View style={styles.ticketMetaRow}>
          <Text style={[styles.ticketCategory, { color: Colors.slateLighter }]} numberOfLines={1}>
            {TICKET_CATEGORY_LABELS[ticket.category]}
          </Text>
          <Text style={[styles.ticketDot, { color: Colors.slateLighter }]}>·</Text>
          <Clock size={10} color={Colors.slateLighter} />
          <Text style={[styles.ticketAge, { color: Colors.slateLighter }]}>
            {timeAgo(ticket.createdAt)}
          </Text>
          {active && ticket.staffReply ? (
            <View style={[styles.replyChip, { backgroundColor: Colors.secondary + '18', borderColor: Colors.secondary + '40' }]}>
              <MessageSquare size={9} color={Colors.secondary} />
              <Text style={[styles.replyChipText, { color: Colors.secondary }]}>new reply</Text>
            </View>
          ) : null}
        </View>
      </View>
      <ChevronRight size={15} color={Colors.slateLighter} />
    </TouchableOpacity>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessView({
  ticketId,
  onDone,
  onView,
}: {
  ticketId: string | null;
  onDone: () => void;
  onView: () => void;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [scaleAnim]);

  return (
    <View style={[styles.successRoot, { backgroundColor: Colors.background }]}>
      <Animated.View style={[styles.successContent, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.successIcon, { backgroundColor: Colors.success + '18' }]}>
          <CheckCircle size={52} color={Colors.success} strokeWidth={1.5} />
        </View>
        <Text style={[styles.successTitle, { color: Colors.slate }]}>Ticket submitted</Text>
        <Text style={[styles.successSub, { color: Colors.slateLight }]}>
          Our support team will review your request and reply within 1 business day. You can track
          the conversation here anytime.
        </Text>
        <View style={styles.successBtnRow}>
          <TouchableOpacity
            style={[styles.successBtnSecondary, { borderColor: Colors.border }]}
            onPress={onDone}
            activeOpacity={0.85}
          >
            <Text style={[styles.successBtnSecondaryText, { color: Colors.slateLight }]}>
              Back to support
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.successBtnPrimary, { backgroundColor: Colors.primary }]}
            onPress={onView}
            activeOpacity={0.85}
          >
            <Text style={styles.successBtnPrimaryText}>View ticket</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTicketsView({ onCreate }: { onCreate: () => void }) {
  const Colors = useColors();
  const bounceAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -6, duration: 1400, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim]);

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <LifeBuoy size={48} color={Colors.slateLighter} strokeWidth={1.5} />
      </Animated.View>
      <Text style={[styles.emptyTitle, { color: Colors.slate }]}>No tickets yet</Text>
      <Text style={[styles.emptyBody, { color: Colors.slateLight }]}>
        Need help with a delivery, billing, or the app? Start a conversation with our support team.
      </Text>
      <TouchableOpacity
        style={[styles.emptyCta, { backgroundColor: Colors.primary }]}
        onPress={onCreate}
        activeOpacity={0.85}
      >
        <Plus size={15} color="#fff" strokeWidth={2.5} />
        <Text style={styles.emptyCtaText}>New ticket</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ContactSupportScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, session } = useApp();
  const { track } = useAnalytics();
  const userId = session?.user?.id;

  const [mode, setMode] = useState<'list' | 'compose'>('list');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [category, setCategory] = useState<SupportTicketCategory>('delivery_issue');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const composeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  React.useEffect(() => {
    if (mode === 'compose') {
      composeAnim.setValue(0);
      Animated.timing(composeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [mode, composeAnim]);

  // ── Tickets query ──────────────────────────────────────────────────────────
  const ticketsQuery = useQuery<SupportTicket[]>({
    queryKey: ['support-tickets', userId],
    queryFn: fetchMyTickets,
    enabled: !!userId,
    staleTime: 30_000,
  });

  const tickets = useMemo<SupportTicket[]>(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const activeCount = useMemo(
    () => tickets.filter((t) => isTicketActive(t.status)).length,
    [tickets],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['support-tickets', userId] });
    setRefreshing(false);
  }, [queryClient, userId]);

  const resetComposer = useCallback(() => {
    setSubject('');
    setBody('');
    setCategory('delivery_issue');
  }, []);

  const handleCancelCompose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMode('list');
    resetComposer();
  }, [resetComposer]);

  const canSubmit = subject.trim().length > 2 && body.trim().length > 2 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    void track('support_ticket_created', {
      category,
      subject_length: subject.trim().length,
      body_length: body.trim().length,
    });

    try {
      const ticket = await createTicket({
        subject: subject.trim(),
        body: body.trim(),
        category,
        appVersion: Application.nativeApplicationVersion ?? null,
        platform: RNPlatform.OS,
        deviceModel: (RNPlatform.constants as unknown as Record<string, string | undefined> | undefined)?.Model ?? null,
      });
      if (ticket) {
        setSubmittedTicketId(ticket.id);
        await queryClient.invalidateQueries({ queryKey: ['support-tickets', userId] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        resetComposer();
        setMode('list');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert(
          'Could not submit ticket',
          'Please check your connection and try again. If the problem persists, email support@porchivo.com.',
          [{ text: 'OK' }],
        );
      }
    } catch (err) {
      logError('[contact-support] submit error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        'Could not submit ticket',
        'Please check your connection and try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, category, subject, body, track, queryClient, userId, resetComposer]);

  // ── Success view ───────────────────────────────────────────────────────────
  if (submittedTicketId) {
    return (
      <SuccessView
        ticketId={submittedTicketId}
        onDone={() => setSubmittedTicketId(null)}
        onView={() => {
          const id = submittedTicketId;
          setSubmittedTicketId(null);
          router.push(`/support-ticket-detail?id=${id}` as any);
        }}
      />
    );
  }

  // ── Compose mode ───────────────────────────────────────────────────────────
  if (mode === 'compose') {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: Colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
              backgroundColor: Colors.surface,
              borderBottomColor: Colors.border,
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleCancelCompose}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: Colors.slate }]}>New ticket</Text>
            <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
              Tell us how we can help
            </Text>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: Colors.primary + '14', borderColor: Colors.primary + '40' }]}>
            <LifeBuoy size={14} color={Colors.primary} />
          </View>
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: composeAnim }}>
            {/* Category */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: Colors.slate }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {TICKET_CATEGORIES.map((cat) => (
                  <CategoryChip
                    key={cat}
                    category={cat}
                    selected={category === cat}
                    onSelect={() => setCategory(cat)}
                  />
                ))}
              </View>
            </View>

            {/* Subject */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: Colors.slate }]}>Subject</Text>
              <TextInput
                style={[
                  styles.textField,
                  {
                    backgroundColor: Colors.surface,
                    borderColor: Colors.border,
                    color: Colors.slate,
                  },
                ]}
                placeholder="Brief summary of the issue…"
                placeholderTextColor={Colors.slateLighter}
                value={subject}
                onChangeText={setSubject}
                maxLength={120}
                returnKeyType="next"
              />
              {subject.length > 100 ? (
                <Text
                  style={[
                    styles.charCount,
                    { color: subject.length >= 120 ? Colors.danger : Colors.slateLighter },
                  ]}
                >
                  {subject.length}/120
                </Text>
              ) : null}
            </View>

            {/* Body */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: Colors.slate }]}>Details</Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: Colors.surface,
                    borderColor: Colors.border,
                    color: Colors.slate,
                  },
                ]}
                placeholder="What happened? When? What were you trying to do? Include any tracking numbers, dates, or screenshots you can share."
                placeholderTextColor={Colors.slateLighter}
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={2000}
              />
              <Text
                style={[
                  styles.charCount,
                  { color: body.length >= 2000 ? Colors.danger : Colors.slateLighter },
                ]}
              >
                {body.length}/2000
              </Text>
            </View>

            {/* Privacy note */}
            <View style={[styles.privacyNote, { backgroundColor: Colors.primary + '0A', borderColor: Colors.primary + '25' }]}>
              <Text style={[styles.privacyText, { color: Colors.slateLight }]}>
                Your ticket is visible to Porchivo support staff. We never share your data with
                third parties. Expect a reply within 1 business day.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Submit bar */}
        <View
          style={[
            styles.submitBar,
            {
              paddingBottom: insets.bottom + 12,
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: canSubmit ? Colors.primary : Colors.slateLighter + '40' }]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={15} color="#fff" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={[styles.submitBtnText, { opacity: canSubmit ? 1 : 0.6 }]}>
                  Submit ticket
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── List mode ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Contact support</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {tickets.length === 0
              ? 'We usually reply within 1 business day'
              : `${activeCount} active · ${tickets.length} total`}
          </Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: Colors.primary + '14', borderColor: Colors.primary + '40' }]}>
          <LifeBuoy size={14} color={Colors.primary} />
        </View>
      </Animated.View>

      {/* Loading state */}
      {ticketsQuery.isLoading && tickets.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={[styles.loaderText, { color: Colors.slateLighter }]}>
            Loading your tickets…
          </Text>
        </View>
      ) : tickets.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          <EmptyTicketsView onCreate={() => setMode('compose')} />
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          {/* Quick contact card */}
          <View style={[styles.quickContactCard, { backgroundColor: Colors.primary + '0A', borderColor: Colors.primary + '25' }]}>
            <View style={[styles.quickContactIcon, { backgroundColor: Colors.primary + '18' }]}>
              <MessageSquare size={16} color={Colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.quickContactBody}>
              <Text style={[styles.quickContactTitle, { color: Colors.slate }]}>
                Need a faster answer?
              </Text>
              <Text style={[styles.quickContactText, { color: Colors.slateLight }]}>
                Email support@porchivo.com — we reply within 1 business day.
              </Text>
            </View>
          </View>

          <Text style={[styles.listSectionHeader, { color: Colors.slateLighter }]}>
            YOUR TICKETS
          </Text>
          {tickets.map((ticket, i) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onPress={() => router.push(`/support-ticket-detail?id=${ticket.id}` as any)}
            />
          ))}
        </ScrollView>
      )}

      {/* FAB */}
      {tickets.length > 0 ? (
        <View
          style={[
            styles.fab,
            {
              bottom: insets.bottom + 24,
              backgroundColor: Colors.primary,
              shadowColor: Colors.primary,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setMode('compose');
            }}
            style={styles.fabInner}
            activeOpacity={0.85}
          >
            <Plus size={20} color="#fff" strokeWidth={2.5} />
            <Text style={styles.fabLabel}>New ticket</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Compose ──────────────────────────────────────────────────────────────
  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
    marginHorizontal: 4,
    marginBottom: 8,
    minWidth: 100,
    alignItems: 'center',
    gap: 4,
  },
  categoryEmoji: { fontSize: 18 },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center',
  },

  textField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 130,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },

  privacyNote: {
    marginHorizontal: 20,
    marginTop: 22,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyText: { fontSize: 12, lineHeight: 17 },

  submitBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },

  // ── List ─────────────────────────────────────────────────────────────────
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { fontSize: 14 },

  quickContactCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  quickContactIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickContactBody: { flex: 1, gap: 3 },
  quickContactTitle: { fontSize: 13, fontWeight: '700' as const, letterSpacing: -0.2 },
  quickContactText: { fontSize: 12, lineHeight: 17 },

  listSectionHeader: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    marginBottom: 10,
    marginLeft: 4,
  },

  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  ticketEmoji: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketEmojiText: { fontSize: 19 },
  ticketMain: { flex: 1 },
  ticketTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  ticketSubject: { fontSize: 14, fontWeight: '700' as const, flex: 1, lineHeight: 18 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: '700' as const },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  ticketCategory: { fontSize: 12 },
  ticketDot: { fontSize: 12 },
  ticketAge: { fontSize: 12, fontWeight: '600' as const },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    marginLeft: 4,
  },
  replyChipText: { fontSize: 9, fontWeight: '700' as const },

  // ── Empty ────────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },

  // ── Success ──────────────────────────────────────────────────────────────
  successRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successContent: { alignItems: 'center', gap: 16 },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.4 },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  successBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  successBtnSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
  },
  successBtnSecondaryText: { fontSize: 15, fontWeight: '600' as const },
  successBtnPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 14,
  },
  successBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },

  // ── FAB ───────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
  },
  fabLabel: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },
});
