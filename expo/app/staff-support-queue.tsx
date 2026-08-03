import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  LifeBuoy,
  Sparkles,
  Send,
  CheckCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
  X,
  Edit3,
  AlertTriangle,
  MessageSquare,
  User,
  FileText,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { useApp } from '@/store/AppContext';
import { error as logError } from '@/lib/logger';
import {
  fetchStaffSupportQueue,
  fetchStaffQueueCounts,
  sendStaffTicketReply,
  regenerateTicketAiDraft,
  isDraftAwaitingReview,
  TICKET_CATEGORY_LABELS,
  TICKET_CATEGORY_EMOJI,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  type StaffSupportTicket,
  type StaffTicketFilterStatus,
  type StaffQueueCounts,
  type DraftFeedback,
} from '@/lib/supportTickets';
import type { SupportTicketPriority } from '@/types/database';
import SupportTemplatePicker from '@/components/SupportTemplatePicker';
import {
  substituteTemplatePlaceholders,
  type SupportReplyTemplate,
} from '@/lib/supportTemplates';

// ─── Filter config ────────────────────────────────────────────────────────────

interface FilterTab {
  key: StaffTicketFilterStatus;
  label: string;
}

const FILTERS: FilterTab[] = [
  { key: 'all',             label: 'All' },
  { key: 'open',            label: 'Open' },
  { key: 'in_progress',     label: 'In Progress' },
  { key: 'waiting_on_user', label: 'Awaiting User' },
  { key: 'resolved',        label: 'Resolved' },
  { key: 'closed',          label: 'Closed' },
];

const PRIORITY_FILTERS: Array<SupportTicketPriority | 'all'> = [
  'all', 'urgent', 'high', 'normal', 'low',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusBadge(
  status: StaffSupportTicket['status'],
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

function priorityColor(priority: StaffSupportTicket['priority'], Colors: AppColors): string {
  switch (priority) {
    case 'urgent': return Colors.danger;
    case 'high':   return Colors.secondary;
    case 'normal': return Colors.primary;
    case 'low':    return Colors.slateLighter;
    default:       return Colors.slateLighter;
  }
}

// ─── Metric tile ──────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  accent,
  pulse,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  pulse?: boolean;
  icon: React.ReactNode;
}) {
  const Colors = useColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!pulse || value === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 850, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, value, pulseAnim]);

  return (
    <View style={[styles.metricCard, { backgroundColor: Colors.surface, borderColor: accent + '35' }]}>
      <Animated.View
        style={[
          styles.metricIcon,
          { backgroundColor: accent + '18' },
          pulse && value > 0 ? { transform: [{ scale: pulseAnim }] } : undefined,
        ]}
      >
        {icon}
      </Animated.View>
      <Text style={[styles.metricValue, { color: Colors.slate }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: Colors.slateLighter }]}>{label}</Text>
    </View>
  );
}

// ─── Filter tab ───────────────────────────────────────────────────────────────

function FilterTabItem({
  tab,
  isActive,
  count,
  onPress,
}: {
  tab: FilterTab;
  isActive: boolean;
  count?: number;
  onPress: () => void;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 55, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 90, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const accent =
    tab.key === 'waiting_on_user' ? Colors.secondary
    : tab.key === 'resolved' ? Colors.success
    : tab.key === 'closed' ? Colors.slateLighter
    : Colors.primary;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.View
        style={[
          styles.filterTab,
          {
            backgroundColor: isActive ? accent + '18' : Colors.surface,
            borderColor: isActive ? accent + '55' : Colors.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={[styles.filterTabText, { color: isActive ? accent : Colors.slateLight }]}>
          {tab.label}
        </Text>
        {count !== undefined && count > 0 ? (
          <View style={[styles.filterCount, { backgroundColor: accent }]}>
            <Text style={styles.filterCountText}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Ticket card ──────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  index,
  onOpen,
}: {
  ticket: StaffSupportTicket;
  index: number;
  onOpen: () => void;
}) {
  const Colors = useColors();
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1,
      delay: Math.min(index * 40, 400),
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [entranceAnim, index]);

  const badge = statusBadge(ticket.status, Colors);
  const pColor = priorityColor(ticket.priority, Colors);
  const emoji = TICKET_CATEGORY_EMOJI[ticket.category];
  const awaiting = isDraftAwaitingReview(ticket);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 55, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onOpen();
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: Colors.surface,
          borderColor: awaiting ? Colors.primary + '50' : Colors.border,
          borderLeftColor: pColor,
          transform: [
            { scale: scaleAnim },
            {
              translateY: entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
          opacity: entranceAnim,
        },
      ]}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <View style={styles.cardTop}>
          <View style={[styles.ticketEmoji, { backgroundColor: pColor + '15', borderColor: pColor + '35' }]}>
            <Text style={styles.ticketEmojiText}>{emoji}</Text>
          </View>

          <View style={styles.cardMain}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardSubject, { color: Colors.slate }]} numberOfLines={1}>
                {ticket.subject}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                  {TICKET_STATUS_LABELS[ticket.status]}
                </Text>
              </View>
            </View>

            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardCategory, { color: Colors.slateLighter }]} numberOfLines={1}>
                {TICKET_CATEGORY_LABELS[ticket.category]}
              </Text>
              <Text style={[styles.cardDot, { color: Colors.slateLighter }]}>·</Text>
              <Text style={[styles.cardPriority, { color: pColor }]}>
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </Text>
              <Text style={[styles.cardDot, { color: Colors.slateLighter }]}>·</Text>
              <Clock size={10} color={Colors.slateLighter} />
              <Text style={[styles.cardAge, { color: Colors.slateLighter }]}>
                {timeAgo(ticket.createdAt)}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              {awaiting ? (
                <View style={[styles.draftChip, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '45' }]}>
                  <Sparkles size={11} color={Colors.primary} />
                  <Text style={[styles.draftChipText, { color: Colors.primary }]}>AI draft ready</Text>
                </View>
              ) : ticket.aiDraftReply ? (
                <View style={[styles.draftChip, { backgroundColor: Colors.success + '14', borderColor: Colors.success + '40' }]}>
                  <CheckCircle size={11} color={Colors.success} />
                  <Text style={[styles.draftChipText, { color: Colors.success }]}>
                    Draft {ticket.aiDraftFeedback ?? 'reviewed'}
                  </Text>
                </View>
              ) : null}

              {ticket.staffReply ? (
                <View style={[styles.replyChip, { backgroundColor: Colors.secondary + '14', borderColor: Colors.secondary + '40' }]}>
                  <MessageSquare size={10} color={Colors.secondary} />
                  <Text style={[styles.replyChipText, { color: Colors.secondary }]}>replied</Text>
                </View>
              ) : null}

              <View style={styles.assigneeRow}>
                <User size={10} color={Colors.slateLighter} />
                <Text style={[styles.assigneeText, { color: Colors.slateLighter }]} numberOfLines={1}>
                  {ticket.userId.slice(0, 8)}
                </Text>
              </View>
            </View>
          </View>

          <ChevronRight size={15} color={Colors.slateLighter} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: StaffTicketFilterStatus }) {
  const Colors = useColors();
  const bounceAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -6, duration: 1300, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0,  duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim]);

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        {filter === 'resolved' || filter === 'closed' ? (
          <CheckCircle size={48} color={Colors.success} strokeWidth={1.5} />
        ) : (
          <LifeBuoy size={48} color={Colors.slateLighter} strokeWidth={1.5} />
        )}
      </Animated.View>
      <Text style={[styles.emptyText, { color: Colors.slateLight }]}>
        {filter === 'resolved' ? 'No resolved tickets'
          : filter === 'closed' ? 'No closed tickets'
          : filter === 'waiting_on_user' ? 'Nothing waiting on users'
          : 'No tickets in this view'}
      </Text>
      <Text style={[styles.emptyHint, { color: Colors.slateLighter }]}>
        Pull to refresh the queue
      </Text>
    </View>
  );
}

// ─── Reply modal ──────────────────────────────────────────────────────────────

interface ReplyModalProps {
  ticket: StaffSupportTicket | null;
  visible: boolean;
  onClose: () => void;
  onSent: () => void;
}

function ReplyModal({ ticket, visible, onClose, onSent }: ReplyModalProps) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [replyText, setReplyText] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [markResolved, setMarkResolved] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [templatePickerVisible, setTemplatePickerVisible] = useState<boolean>(false);

  // Reset state when a new ticket is opened.
  React.useEffect(() => {
    if (ticket) {
      setReplyText(ticket.aiDraftReply ?? '');
      setResolutionNote(ticket.resolutionNote ?? '');
      setMarkResolved(false);
      setEditMode(ticket.aiDraftReply ? false : true);
    }
  }, [ticket?.id]);

  const canSend = replyText.trim().length > 1 && !sending;

  const handleUseDraft = useCallback(() => {
    if (ticket?.aiDraftReply) {
      setReplyText(ticket.aiDraftReply);
      setEditMode(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [ticket?.aiDraftReply]);

  // Staff picked a saved reply template — drop it into the editor with
  // any {{placeholders}} substituted from the ticket context we already know.
  // Unknown placeholders are left intact so staff can spot and fill them.
  const handlePickTemplate = useCallback(
    (template: SupportReplyTemplate) => {
      const values: Record<string, string> = {
        first_name: '',
        unit: '',
        building_name: '',
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        time: new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        version: ticket?.appVersion ?? '',
      };
      const substituted = substituteTemplatePlaceholders(template.body, values);
      setReplyText(substituted);
      setEditMode(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [ticket?.appVersion],
  );

  const handleRegenerate = useCallback(async () => {
    if (!ticket) return;
    Alert.alert(
      'Regenerate AI draft?',
      'This clears the current draft and asks the AI to write a new one. It takes a few seconds to land.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            setRegenerating(true);
            try {
              await regenerateTicketAiDraft(ticket.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert(
                'Draft regenerating',
                'The new draft will appear in a few seconds. Pull to refresh the queue.',
                [{ text: 'OK', onPress: onClose }],
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to regenerate draft';
              logError('[staff-support-queue] regenerate: ' + msg);
              Alert.alert('Could not regenerate', msg);
            } finally {
              setRegenerating(false);
            }
          },
        },
      ],
    );
  }, [ticket, onClose]);

  const handleSend = useCallback(async () => {
    if (!ticket || !canSend) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Determine feedback label for analytics: 'accepted' if the staff sent the
    // AI draft verbatim, 'edited' if they started from the draft but changed it,
    // 'rejected' if there was no draft or they wrote a brand-new reply.
    let feedback: DraftFeedback = 'rejected';
    if (ticket.aiDraftReply) {
      feedback = replyText.trim() === ticket.aiDraftReply.trim() ? 'accepted' : 'edited';
    }

    try {
      await sendStaffTicketReply({
        ticketId: ticket.id,
        replyText: replyText.trim(),
        feedback,
        resolutionNote: resolutionNote.trim() || null,
        markResolved,
      });
      await queryClient.invalidateQueries({ queryKey: ['staff-support-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-support-queue-counts'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send reply';
      logError('[staff-support-queue] send: ' + msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Could not send reply', msg);
    } finally {
      setSending(false);
    }
  }, [ticket, canSend, replyText, resolutionNote, markResolved, queryClient, onSent]);

  if (!ticket) return null;

  const badge = statusBadge(ticket.status, Colors);
  const pColor = priorityColor(ticket.priority, Colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: Colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Modal header */}
        <View
          style={[
            styles.modalHeader,
            {
              paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
              backgroundColor: Colors.surface,
              borderBottomColor: Colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.modalCloseBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={Colors.slate} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.modalHeaderCenter}>
            <Text style={[styles.modalTitle, { color: Colors.slate }]} numberOfLines={1}>
              {ticket.subject}
            </Text>
            <View style={styles.modalHeaderMeta}>
              <View style={[styles.miniBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.miniBadgeText, { color: badge.text }]}>
                  {TICKET_STATUS_LABELS[ticket.status]}
                </Text>
              </View>
              <Text style={[styles.modalMetaText, { color: pColor }]}>
                {TICKET_PRIORITY_LABELS[ticket.priority]} priority
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Customer message */}
          <View style={[styles.sectionBlock, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <View style={styles.sectionBlockHeader}>
              <Text style={styles.sectionEmoji}>{TICKET_CATEGORY_EMOJI[ticket.category]}</Text>
              <Text style={[styles.sectionBlockTitle, { color: Colors.slate }]}>
                {TICKET_CATEGORY_LABELS[ticket.category]}
              </Text>
              <Text style={[styles.sectionBlockTime, { color: Colors.slateLighter }]}>
                {timeAgo(ticket.createdAt)}
              </Text>
            </View>
            <Text style={[styles.customerBody, { color: Colors.slateLight }]}>
              {ticket.body}
            </Text>

            {/* Device context */}
            {(ticket.platform || ticket.appVersion || ticket.deviceModel) ? (
              <View style={[styles.deviceStrip, { borderTopColor: Colors.border }]}>
                {ticket.platform ? (
                  <View style={styles.deviceChip}>
                    <Text style={[styles.deviceChipText, { color: Colors.slateLighter }]}>
                      {ticket.platform}
                    </Text>
                  </View>
                ) : null}
                {ticket.appVersion ? (
                  <View style={styles.deviceChip}>
                    <Text style={[styles.deviceChipText, { color: Colors.slateLighter }]}>
                      v{ticket.appVersion}
                    </Text>
                  </View>
                ) : null}
                {ticket.deviceModel ? (
                  <View style={styles.deviceChip}>
                    <Text style={[styles.deviceChipText, { color: Colors.slateLighter }]} numberOfLines={1}>
                      {ticket.deviceModel}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* AI draft panel */}
          {ticket.aiDraftReply ? (
            <View
              style={[
                styles.draftPanel,
                {
                  backgroundColor: Colors.primary + '0A',
                  borderColor: Colors.primary + '30',
                },
              ]}
            >
              <View style={styles.draftPanelHeader}>
                <View style={[styles.draftBadge, { backgroundColor: Colors.primary + '18' }]}>
                  <Sparkles size={13} color={Colors.primary} />
                  <Text style={[styles.draftBadgeText, { color: Colors.primary }]}>
                    AI-drafted reply
                  </Text>
                </View>
                {ticket.aiDraftModel ? (
                  <Text style={[styles.draftModel, { color: Colors.slateLighter }]} numberOfLines={1}>
                    {ticket.aiDraftModel}
                  </Text>
                ) : null}
              </View>

              <Text style={[styles.draftBody, { color: Colors.slate }]}>
                {ticket.aiDraftReply}
              </Text>

              <View style={styles.draftActions}>
                <TouchableOpacity
                  style={[styles.draftActionBtn, {
                    backgroundColor: editMode ? Colors.primary + '14' : Colors.surface,
                    borderColor: editMode ? Colors.primary + '45' : Colors.border,
                  }]}
                  onPress={() => setEditMode((p) => !p)}
                >
                  <Edit3 size={13} color={Colors.primary} />
                  <Text style={[styles.draftActionText, { color: Colors.primary }]}>
                    {editMode ? 'Editing' : 'Edit'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.draftActionBtn, {
                    backgroundColor: Colors.surface,
                    borderColor: Colors.border,
                  }]}
                  onPress={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <ActivityIndicator size={13} color={Colors.slateLight} />
                  ) : (
                    <RefreshCw size={13} color={Colors.slateLight} />
                  )}
                  <Text style={[styles.draftActionText, { color: Colors.slateLight }]}>
                    Regenerate
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.draftActionBtn, {
                    backgroundColor: Colors.surface,
                    borderColor: Colors.border,
                  }]}
                  onPress={handleUseDraft}
                >
                  <CheckCircle size={13} color={Colors.success} />
                  <Text style={[styles.draftActionText, { color: Colors.success }]}>
                    Use draft
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.noDraftBanner, { backgroundColor: Colors.gold + '0A', borderColor: Colors.gold + '30' }]}>
              <AlertTriangle size={14} color={Colors.gold} />
              <Text style={[styles.noDraftText, { color: Colors.slateLight }]}>
                No AI draft for this ticket. Write a reply from scratch below, or tap Regenerate after opening.
              </Text>
            </View>
          )}

          {/* Reply editor */}
          <View style={styles.editorLabelRow}>
            <Text style={[styles.editorLabel, { color: Colors.slate, flex: 1 }]}>
              Reply to customer
            </Text>
            <TouchableOpacity
              style={[
                styles.templateBtn,
                { backgroundColor: Colors.primary + '12', borderColor: Colors.primary + '38' },
              ]}
              onPress={() => setTemplatePickerVisible(true)}
              activeOpacity={0.85}
            >
              <FileText size={12} color={Colors.primary} strokeWidth={2.2} />
              <Text style={[styles.templateBtnText, { color: Colors.primary }]}>
                Templates
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[
              styles.replyEditor,
              {
                backgroundColor: Colors.surface,
                borderColor: editMode ? Colors.primary + '50' : Colors.border,
                color: Colors.slate,
              },
            ]}
            placeholder="Type the reply you want to send…"
            placeholderTextColor={Colors.slateLighter}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            textAlignVertical="top"
            maxLength={4000}
            editable={editMode}
          />
          <Text style={[styles.charCount, { color: Colors.slateLighter }]}>
            {replyText.length}/4000
          </Text>

          {/* Resolution note + resolve toggle */}
          <View style={styles.optionRow}>
            <TextInput
              style={[
                styles.resolutionInput,
                { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate },
              ]}
              placeholder="Resolution note (optional)"
              placeholderTextColor={Colors.slateLighter}
              value={resolutionNote}
              onChangeText={setResolutionNote}
              maxLength={500}
            />
          </View>

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setMarkResolved((p) => !p)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.toggleBox,
                {
                  backgroundColor: markResolved ? Colors.success : 'transparent',
                  borderColor: markResolved ? Colors.success : Colors.border,
                },
              ]}
            >
              {markResolved ? <CheckCircle size={14} color="#fff" /> : null}
            </View>
            <Text style={[styles.toggleLabel, { color: Colors.slateLight }]}>
              Mark ticket as resolved after sending
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Send bar */}
        <View
          style={[
            styles.sendBar,
            {
              paddingBottom: insets.bottom + 12,
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: canSend ? Colors.primary : Colors.slateLighter + '40' },
            ]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={15} color="#fff" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={[styles.sendBtnText, { opacity: canSend ? 1 : 0.6 }]}>
                  {markResolved ? 'Send & resolve' : 'Send reply'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Staff reply-template library — shared, saveable, filterable */}
      <SupportTemplatePicker
        visible={templatePickerVisible}
        defaultCategory={ticket?.category}
        onClose={() => setTemplatePickerVisible(false)}
        onPick={handlePickTemplate}
      />
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StaffSupportQueueScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useApp();
  const userRole = (session?.user?.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined;
  const isStaff = userRole === 'support_staff' || userRole === 'super_admin';

  const [activeFilter, setActiveFilter] = useState<StaffTicketFilterStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<SupportTicketPriority | 'all'>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTicket, setActiveTicket] = useState<StaffSupportTicket | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // Deep-link param: when the staff push notification is tapped, expo-router
  // delivers { ticketId } here. We auto-open that ticket's review modal once
  // the queue has loaded it. Consumed once so a background→foreground revisit
  // does not re-open the same ticket.
  const localSearchParams = useLocalSearchParams<{ ticketId?: string }>();
  const deepLinkTicketId = localSearchParams.ticketId;
  const consumedDeepLinkIdRef = useRef<string | null>(null);

  // ── Queue query ────────────────────────────────────────────────────────────
  const { data: tickets = [], isLoading } = useQuery<StaffSupportTicket[]>({
    queryKey: ['staff-support-queue', activeFilter, priorityFilter, searchText],
    queryFn: () =>
      fetchStaffSupportQueue({
        status: activeFilter,
        priority: priorityFilter,
        search: searchText,
        limit: 100,
      }),
    enabled: isStaff,
    staleTime: 15_000,
    retry: 1,
  });

  // ── Counts query ───────────────────────────────────────────────────────────
  const { data: counts } = useQuery<StaffQueueCounts>({
    queryKey: ['staff-support-queue-counts'],
    queryFn: fetchStaffQueueCounts,
    enabled: isStaff,
    staleTime: 30_000,
  });

  const tabCounts = useMemo<Partial<Record<StaffTicketFilterStatus, number>>>(() => {
    if (!counts) return {};
    return {
      all: counts.total,
      open: counts.open,
      in_progress: counts.inProgress,
      waiting_on_user: counts.waitingOnUser,
      resolved: counts.resolved,
      closed: counts.closed,
    };
  }, [counts]);

  // ── Deep-link: auto-open the ticket the staff push pointed at ─────────────
  // Runs after the queue has loaded so we can find the ticket row by id and
  // hydrate the review modal with the full record (incl. ai_draft_reply).
  useEffect(() => {
    if (!deepLinkTicketId || tickets.length === 0) return;
    if (consumedDeepLinkIdRef.current === deepLinkTicketId) return;
    const target = tickets.find((t) => t.id === deepLinkTicketId);
    if (target) {
      consumedDeepLinkIdRef.current = deepLinkTicketId;
      setActiveTicket(target);
      setModalVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [deepLinkTicketId, tickets]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['staff-support-queue'] }),
      queryClient.invalidateQueries({ queryKey: ['staff-support-queue-counts'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const handleOpenTicket = useCallback((ticket: StaffSupportTicket) => {
    setActiveTicket(ticket);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setActiveTicket(null);
  }, []);

  const handleSent = useCallback(() => {
    setModalVisible(false);
    setActiveTicket(null);
  }, []);

  // ── Access guard ───────────────────────────────────────────────────────────
  if (!isStaff) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
              backgroundColor: Colors.surface,
              borderBottomColor: Colors.border,
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
            <Text style={[styles.headerTitle, { color: Colors.slate }]}>Support Queue</Text>
            <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>Staff only</Text>
          </View>
        </View>
        <View style={styles.accessDenied}>
          <AlertTriangle size={44} color={Colors.danger} strokeWidth={1.5} />
          <Text style={[styles.accessDeniedTitle, { color: Colors.slate }]}>Access denied</Text>
          <Text style={[styles.accessDeniedBody, { color: Colors.slateLight }]}>
            You need a support staff or super admin role to view the support queue.
          </Text>
        </View>
      </View>
    );
  }

  const awaitingCount = counts?.awaitingReview ?? 0;
  const withDraftCount = counts?.withDraft ?? 0;
  const openCount = counts?.open ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 8),
            backgroundColor: Colors.surface,
            borderBottomColor: Colors.border,
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
          <Text style={[styles.headerTitle, { color: Colors.slate }]}>Support Queue</Text>
          <Text style={[styles.headerSub, { color: Colors.slateLighter }]}>
            {tickets.length} shown · {awaitingCount} awaiting review
          </Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: Colors.primary + '14', borderColor: Colors.primary + '40' }]}>
          <LifeBuoy size={14} color={Colors.primary} />
        </View>
      </View>

      {/* ── Metrics ─────────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricsRow}
        style={[styles.metricsWrap, { backgroundColor: Colors.background }]}
      >
        <MetricTile
          label="Open"
          value={openCount}
          accent={Colors.primary}
          icon={<LifeBuoy size={16} color={Colors.primary} />}
          pulse={openCount > 0}
        />
        <MetricTile
          label="Drafts ready"
          value={withDraftCount}
          accent={Colors.gold}
          icon={<Sparkles size={16} color={Colors.gold} />}
          pulse={withDraftCount > 0}
        />
        <MetricTile
          label="Awaiting review"
          value={awaitingCount}
          accent={Colors.secondary}
          icon={<Clock size={16} color={Colors.secondary} />}
          pulse={awaitingCount > 0}
        />
        <MetricTile
          label="Waiting on user"
          value={counts?.waitingOnUser ?? 0}
          accent={Colors.success}
          icon={<MessageSquare size={16} color={Colors.success} />}
        />
      </ScrollView>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <View style={[styles.searchWrap, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: Colors.background,
              borderColor: searchFocused ? Colors.primary + '60' : Colors.border,
            },
          ]}
        >
          <Search size={15} color={Colors.slateLighter} />
          <TextInput
            style={[styles.searchInput, { color: Colors.slate }]}
            placeholder="Search subject, body, user id…"
            placeholderTextColor={Colors.slateLighter}
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={Colors.slateLighter} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Filter tabs ────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={[styles.filtersWrap, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}
      >
        {FILTERS.map((tab) => (
          <FilterTabItem
            key={tab.key}
            tab={tab}
            isActive={activeFilter === tab.key}
            count={tabCounts[tab.key]}
            onPress={() => setActiveFilter(tab.key)}
          />
        ))}
      </ScrollView>

      {/* ── Priority filter ─────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.priorityRow}
        style={[styles.priorityWrap, { backgroundColor: Colors.surface, borderBottomColor: Colors.border }]}
      >
        {PRIORITY_FILTERS.map((p) => {
          const isActive = priorityFilter === p;
          const accent = p === 'urgent' ? Colors.danger
            : p === 'high' ? Colors.secondary
            : p === 'normal' ? Colors.primary
            : p === 'low' ? Colors.slateLighter
            : Colors.slateLight;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setPriorityFilter(p)}
              activeOpacity={1}
            >
              <View
                style={[
                  styles.priorityChip,
                  {
                    backgroundColor: isActive ? accent + '18' : Colors.background,
                    borderColor: isActive ? accent + '55' : Colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.priorityChipText,
                    { color: isActive ? accent : Colors.slateLight },
                  ]}
                >
                  {p === 'all' ? 'Any priority' : TICKET_PRIORITY_LABELS[p]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: Colors.slateLighter }]}>Loading queue…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          {tickets.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            tickets.map((ticket, i) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={i}
                onOpen={() => handleOpenTicket(ticket)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── Reply modal ─────────────────────────────────────────────────────── */}
      <ReplyModal
        ticket={activeTicket}
        visible={modalVisible}
        onClose={handleCloseModal}
        onSent={handleSent}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
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

  // Metrics
  metricsWrap: { maxHeight: 112 },
  metricsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  metricCard: {
    width: 100,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  metricIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  metricValue: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.5 },
  metricLabel: { fontSize: 10, fontWeight: '600' as const, textAlign: 'center' },

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  // Filters
  filtersWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  filtersRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabText: { fontSize: 13, fontWeight: '600' as const },
  filterCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: { fontSize: 10, fontWeight: '800' as const, color: '#fff' },

  // Priority
  priorityWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  priorityRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  priorityChipText: { fontSize: 12, fontWeight: '600' as const },

  // Loader
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  // List
  list: { paddingHorizontal: 16, paddingTop: 14 },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  ticketEmoji: {
    width: 42, height: 42, borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  ticketEmojiText: { fontSize: 20 },
  cardMain: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cardSubject: { fontSize: 14, fontWeight: '700' as const, flex: 1, lineHeight: 19 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' as const },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  cardCategory: { fontSize: 12 },
  cardDot: { fontSize: 12 },
  cardPriority: { fontSize: 12, fontWeight: '700' as const },
  cardAge: { fontSize: 12, fontWeight: '600' as const },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  draftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  draftChipText: { fontSize: 10, fontWeight: '700' as const },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  replyChipText: { fontSize: 10, fontWeight: '700' as const },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4 },
  assigneeText: { fontSize: 10, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 14,
  },
  emptyText: { fontSize: 16, fontWeight: '600' as const },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // Access denied
  accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  accessDeniedTitle: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  accessDeniedBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  modalCloseBtn: { padding: 6, marginTop: 2 },
  modalHeaderCenter: { flex: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  modalHeaderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  miniBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  miniBadgeText: { fontSize: 10, fontWeight: '700' as const },
  modalMetaText: { fontSize: 11, fontWeight: '600' as const },

  // Section block (customer message)
  sectionBlock: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sectionBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionEmoji: { fontSize: 18 },
  sectionBlockTitle: { fontSize: 13, fontWeight: '700' as const, flex: 1 },
  sectionBlockTime: { fontSize: 11 },
  customerBody: { fontSize: 14, lineHeight: 20 },
  deviceStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deviceChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(128,128,128,0.10)',
  },
  deviceChipText: { fontSize: 10, fontWeight: '600' as const },

  // Draft panel
  draftPanel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  draftPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  draftBadgeText: { fontSize: 11, fontWeight: '700' as const },
  draftModel: { fontSize: 10, maxWidth: 140 },
  draftBody: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  draftActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  draftActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
  },
  draftActionText: { fontSize: 12, fontWeight: '600' as const },

  // No draft banner
  noDraftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  noDraftText: { flex: 1, fontSize: 12, lineHeight: 17 },

  // Editor
  editorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  templateBtnText: { fontSize: 12, fontWeight: '700' as const },
  editorLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  replyEditor: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 130,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },

  optionRow: { marginTop: 12 },
  resolutionInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  toggleBox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleLabel: { fontSize: 13, flex: 1 },

  // Send bar
  sendBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },
});
