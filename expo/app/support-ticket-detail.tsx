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
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Send,
  RotateCcw,
  XCircle,
  CheckCircle,
  Clock,
  LifeBuoy,
  Mail,
  AlertCircle,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useAnalytics } from '@/store/AnalyticsContext';
import { log, error as logError } from '@/lib/logger';
import {
  fetchTicketById,
  replyToTicket,
  closeTicket,
  reopenTicket,
  SupportTicket,
  SupportTicketStatus,
  TICKET_CATEGORY_LABELS,
  TICKET_CATEGORY_EMOJI,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  isTicketActive,
} from '@/lib/supportTickets';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusBadgeColor(
  status: SupportTicketStatus,
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

function priorityColor(priority: SupportTicket['priority'], Colors: AppColors): string {
  switch (priority) {
    case 'urgent': return Colors.danger;
    case 'high':   return Colors.secondary;
    case 'normal': return Colors.primary;
    case 'low':
    default:       return Colors.slateLighter;
  }
}

// ─── Conversation bubbles ─────────────────────────────────────────────────────

function UserBubble({ text, timestamp }: { text: string; timestamp: string }) {
  const Colors = useColors();
  return (
    <View style={styles.bubbleRowUser}>
      <View style={styles.bubbleSpacer} />
      <View style={styles.bubbleUserWrap}>
        <View style={[styles.bubbleUser, { backgroundColor: Colors.primary }]}>
          <Text style={styles.bubbleUserText}>{text}</Text>
        </View>
        <Text style={[styles.bubbleTimestamp, { color: Colors.slateLighter }]}>
          {formatDateTime(timestamp)}
        </Text>
      </View>
    </View>
  );
}

function StaffBubble({ text, timestamp }: { text: string; timestamp: string }) {
  const Colors = useColors();
  return (
    <View style={styles.bubbleRowStaff}>
      <View style={[styles.bubbleAvatar, { backgroundColor: Colors.secondary + '20' }]}>
        <LifeBuoy size={14} color={Colors.secondary} strokeWidth={2} />
      </View>
      <View style={styles.bubbleStaffWrap}>
        <View style={[styles.bubbleStaff, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <Text style={[styles.bubbleStaffLabel, { color: Colors.secondary }]}>
            Support
          </Text>
          <Text style={[styles.bubbleStaffText, { color: Colors.slate }]}>
            {text}
          </Text>
        </View>
        <Text style={[styles.bubbleTimestamp, { color: Colors.slateLighter }]}>
          {formatDateTime(timestamp)}
        </Text>
      </View>
    </View>
  );
}

// ─── Empty reply state ────────────────────────────────────────────────────────

function NoReplyYet({ Colors }: { Colors: AppColors }) {
  return (
    <View style={[styles.noReplyWrap, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
      <Clock size={20} color={Colors.slateLighter} strokeWidth={1.8} />
      <Text style={[styles.noReplyTitle, { color: Colors.slateLight }]}>
        Waiting for a reply
      </Text>
      <Text style={[styles.noReplyBody, { color: Colors.slateLighter }]}>
        Our team will respond within 1 business day. You'll see their reply here.
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SupportTicketDetailScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { track } = useAnalytics();
  const params = useLocalSearchParams<{ id: string }>();
  const ticketId = params.id;

  const [replyText, setReplyText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<'close' | 'reopen' | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  // ── Ticket query ───────────────────────────────────────────────────────────
  const ticketQuery = useQuery<SupportTicket | null>({
    queryKey: ['support-ticket', ticketId],
    queryFn: () => (ticketId ? fetchTicketById(ticketId) : Promise.resolve(null)),
    enabled: !!ticketId,
    staleTime: 15_000,
  });

  const ticket = ticketQuery.data ?? null;
  const active = ticket ? isTicketActive(ticket.status) : false;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (!ticketId) return;
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
    setRefreshing(false);
  }, [queryClient, ticketId]);

  const handleReply = useCallback(async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !ticketId || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    void track('support_ticket_replied', { ticket_id: ticketId, reply_length: trimmed.length });

    try {
      const ok = await replyToTicket(ticketId, trimmed);
      if (ok) {
        setReplyText('');
        await queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
        await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert('Could not send reply', 'Please try again in a moment.');
      }
    } catch (err) {
      logError('[support-ticket-detail] reply error');
      Alert.alert('Could not send reply', 'Please try again in a moment.');
    } finally {
      setSending(false);
    }
  }, [replyText, ticketId, sending, track, queryClient]);

  const handleClose = useCallback(() => {
    if (!ticketId) return;
    Alert.alert(
      'Close this ticket?',
      'Closing marks this as resolved. You can re-open it later if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close ticket',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('close');
            void track('support_ticket_closed', { ticket_id: ticketId });
            const ok = await closeTicket(ticketId);
            if (ok) {
              await queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
              await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } else {
              Alert.alert('Could not close ticket', 'Please try again.');
            }
            setActionLoading(null);
          },
        },
      ],
    );
  }, [ticketId, track, queryClient]);

  const handleReopen = useCallback(async () => {
    if (!ticketId) return;
    setActionLoading('reopen');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    void track('support_ticket_reopened', { ticket_id: ticketId });
    try {
      const ok = await reopenTicket(ticketId);
      if (ok) {
        await queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
        await queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Alert.alert('Could not re-open ticket', 'Please try again.');
      }
    } catch (err) {
      logError('[support-ticket-detail] reopen error');
    } finally {
      setActionLoading(null);
    }
  }, [ticketId, track, queryClient]);

  const badge = ticket ? statusBadgeColor(ticket.status, Colors) : null;
  const accent = ticket ? priorityColor(ticket.priority, Colors) : Colors.primary;

  // ── Loading / not found ────────────────────────────────────────────────────
  if (ticketQuery.isLoading && !ticket) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Loading ticket…</Text>
        </View>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Ticket not found</Text>
        </View>
        <View style={styles.notFoundWrap}>
          <AlertCircle size={44} color={Colors.slateLighter} strokeWidth={1.5} />
          <Text style={[styles.notFoundTitle, { color: Colors.slate }]}>Ticket unavailable</Text>
          <Text style={[styles.notFoundBody, { color: Colors.slateLight }]}>
            This ticket may have been removed, or you don't have access to it.
          </Text>
          <TouchableOpacity
            style={[styles.notFoundBtn, { backgroundColor: Colors.primary }]}
            onPress={() => router.replace('/contact-support' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.notFoundBtnText}>Back to support</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={Colors.slate} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.slate }]} numberOfLines={1}>
            {ticket.subject}
          </Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {TICKET_CATEGORY_LABELS[ticket.category]} · #{ticket.id.slice(0, 8)}
          </Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: badge?.bg ?? '#999' }]}>
          <Text style={[styles.headerBadgeText, { color: badge?.text ?? '#fff' }]}>
            {TICKET_STATUS_LABELS[ticket.status]}
          </Text>
        </View>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Ticket meta card */}
        <View style={[styles.metaCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <View style={styles.metaHeader}>
            <View style={[styles.metaEmoji, { backgroundColor: Colors.primary + '12' }]}>
              <Text style={styles.metaEmojiText}>{TICKET_CATEGORY_EMOJI[ticket.category]}</Text>
            </View>
            <View style={styles.metaHeaderText}>
              <Text style={[styles.metaSubject, { color: Colors.slate }]}>{ticket.subject}</Text>
              <Text style={[styles.metaCategory, { color: Colors.slateLighter }]}>
                {TICKET_CATEGORY_LABELS[ticket.category]}
              </Text>
            </View>
          </View>

          <View style={[styles.metaDivider, { backgroundColor: Colors.border }]} />

          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={[styles.metaLabel, { color: Colors.slateLighter }]}>STATUS</Text>
              <View style={[styles.metaPill, { backgroundColor: badge?.bg ?? '#999' }]}>
                <Text style={[styles.metaPillText, { color: badge?.text ?? '#fff' }]}>
                  {TICKET_STATUS_LABELS[ticket.status]}
                </Text>
              </View>
            </View>
            <View style={styles.metaCell}>
              <Text style={[styles.metaLabel, { color: Colors.slateLighter }]}>PRIORITY</Text>
              <View style={[styles.metaPill, { backgroundColor: accent + '20' }]}>
                <Text style={[styles.metaPillText, { color: accent }]}>
                  {TICKET_PRIORITY_LABELS[ticket.priority]}
                </Text>
              </View>
            </View>
            <View style={styles.metaCell}>
              <Text style={[styles.metaLabel, { color: Colors.slateLighter }]}>OPENED</Text>
              <Text style={[styles.metaValue, { color: Colors.slate }]}>
                {formatDateTime(ticket.createdAt)}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={[styles.metaLabel, { color: Colors.slateLighter }]}>LAST UPDATE</Text>
              <Text style={[styles.metaValue, { color: Colors.slate }]}>
                {formatDateTime(ticket.updatedAt)}
              </Text>
            </View>
          </View>

          {ticket.appVersion || ticket.platform ? (
            <>
              <View style={[styles.metaDivider, { backgroundColor: Colors.border }]} />
              <View style={styles.metaDebugRow}>
                {ticket.platform ? (
                  <View style={[styles.metaDebugChip, { backgroundColor: Colors.background }]}>
                    <Text style={[styles.metaDebugText, { color: Colors.slateLighter }]}>
                      {ticket.platform}
                    </Text>
                  </View>
                ) : null}
                {ticket.appVersion ? (
                  <View style={[styles.metaDebugChip, { backgroundColor: Colors.background }]}>
                    <Text style={[styles.metaDebugText, { color: Colors.slateLighter }]}>
                      v{ticket.appVersion}
                    </Text>
                  </View>
                ) : null}
                {ticket.deviceModel ? (
                  <View style={[styles.metaDebugChip, { backgroundColor: Colors.background }]}>
                    <Text style={[styles.metaDebugText, { color: Colors.slateLighter }]} numberOfLines={1}>
                      {ticket.deviceModel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}
        </View>

        {/* Conversation */}
        <Text style={[styles.sectionHeader, { color: Colors.slateLighter }]}>CONVERSATION</Text>

        {/* Original message from user */}
        <UserBubble text={ticket.body} timestamp={ticket.createdAt} />

        {/* Staff reply (if any) */}
        {ticket.staffReply ? (
          <StaffBubble text={ticket.staffReply} timestamp={ticket.staffRepliedAt ?? ticket.updatedAt} />
        ) : active ? (
          <NoReplyYet Colors={Colors} />
        ) : null}

        {/* Resolution note */}
        {ticket.resolutionNote ? (
          <View style={[styles.resolutionBanner, { backgroundColor: Colors.success + '10', borderColor: Colors.success + '35' }]}>
            <CheckCircle size={14} color={Colors.success} />
            <View style={styles.resolutionBody}>
              <Text style={[styles.resolutionTitle, { color: Colors.success }]}>Resolution</Text>
              <Text style={[styles.resolutionText, { color: Colors.slateLight }]}>
                {ticket.resolutionNote}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Action buttons (close / reopen) */}
        <View style={styles.actionRow}>
          {active ? (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: Colors.danger + '45', backgroundColor: Colors.danger + '10' }]}
              onPress={handleClose}
              disabled={actionLoading !== null}
              activeOpacity={0.8}
            >
              {actionLoading === 'close' ? (
                <ActivityIndicator size="small" color={Colors.danger} />
              ) : (
                <>
                  <XCircle size={14} color={Colors.danger} strokeWidth={2} />
                  <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Close ticket</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: Colors.primary + '45', backgroundColor: Colors.primary + '10' }]}
              onPress={handleReopen}
              disabled={actionLoading !== null}
              activeOpacity={0.8}
            >
              {actionLoading === 'reopen' ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <RotateCcw size={14} color={Colors.primary} strokeWidth={2} />
                  <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Re-open</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}
            onPress={() => Linking.openURL('mailto:support@porchivo.com')}
            activeOpacity={0.8}
          >
            <Mail size={14} color={Colors.slateLight} strokeWidth={2} />
            <Text style={[styles.actionBtnText, { color: Colors.slateLight }]}>Email support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reply bar — only for active tickets */}
      {active ? (
        <View
          style={[
            styles.replyBar,
            {
              paddingBottom: insets.bottom + 10,
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
            },
          ]}
        >
          <TextInput
            style={[styles.replyInput, { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.slate }]}
            placeholder="Write a reply…"
            placeholderTextColor={Colors.slateLighter}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.replySendBtn,
              {
                backgroundColor: replyText.trim().length > 0 && !sending ? Colors.primary : Colors.slateLighter + '40',
              },
            ]}
            onPress={handleReply}
            disabled={replyText.trim().length === 0 || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Send size={16} color="#fff" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  headerBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700' as const },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  notFoundWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  notFoundTitle: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
  notFoundBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  notFoundBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 26, borderRadius: 14 },
  notFoundBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },

  // ── Meta card ────────────────────────────────────────────────────────────────
  metaCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  metaHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  metaEmoji: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaEmojiText: { fontSize: 20 },
  metaHeaderText: { flex: 1, gap: 2 },
  metaSubject: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 21 },
  metaCategory: { fontSize: 12 },

  metaDivider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  metaCell: { width: '50%', paddingHorizontal: 6, marginBottom: 10 },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  metaValue: { fontSize: 13, fontWeight: '600' as const },
  metaPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  metaPillText: { fontSize: 11, fontWeight: '700' as const },

  metaDebugRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaDebugChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  metaDebugText: { fontSize: 11, fontWeight: '500' as const },

  // ── Conversation ─────────────────────────────────────────────────────────────
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 6,
  },

  bubbleRowUser: { flexDirection: 'row', marginBottom: 14, gap: 8 },
  bubbleSpacer: { width: 32 },
  bubbleUserWrap: { flex: 1, alignItems: 'flex-end' },
  bubbleUser: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderBottomRightRadius: 5,
    maxWidth: '92%',
  },
  bubbleUserText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleTimestamp: { fontSize: 10, marginTop: 4, marginRight: 2 },

  bubbleRowStaff: { flexDirection: 'row', marginBottom: 14, gap: 8 },
  bubbleAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubbleStaffWrap: { flex: 1, alignItems: 'flex-start' },
  bubbleStaff: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    maxWidth: '92%',
  },
  bubbleStaffLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  bubbleStaffText: { fontSize: 14, lineHeight: 20 },
  bubbleTimestampStaff: { fontSize: 10, marginTop: 4, marginLeft: 2 },

  noReplyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    marginVertical: 8,
    gap: 8,
  },
  noReplyTitle: { fontSize: 14, fontWeight: '700' as const },
  noReplyBody: { fontSize: 12, textAlign: 'center', lineHeight: 17 },

  // ── Resolution banner ────────────────────────────────────────────────────────
  resolutionBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 14,
  },
  resolutionBody: { flex: 1, gap: 3 },
  resolutionTitle: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.4 },
  resolutionText: { fontSize: 13, lineHeight: 19 },

  // ── Action buttons ───────────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' as const },

  // ── Reply bar ────────────────────────────────────────────────────────────────
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 40,
  },
  replySendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
