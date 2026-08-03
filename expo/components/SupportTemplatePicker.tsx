import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  X,
  Search,
  Plus,
  Edit3,
  Trash2,
  FileText,
  CheckCircle,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { useColors, AppColors } from '@/constants/colors';
import { error as logError } from '@/lib/logger';
import {
  fetchSupportReplyTemplates,
  saveSupportReplyTemplate,
  deleteSupportReplyTemplate,
  substituteTemplatePlaceholders,
  SUPPORT_TEMPLATES_QUERY_KEY,
  type SupportReplyTemplate,
  type SupportTemplateCategory,
} from '@/lib/supportTemplates';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_CATEGORY_EMOJI,
} from '@/lib/supportTickets';
import type { SupportTicketCategory } from '@/types/database';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_FILTERS: Array<SupportTemplateCategory> = [
  'all',
  'delivery_issue',
  'payment_billing',
  'account_access',
  'partner_dispute',
  'app_bug',
  'safety_alert',
  'other',
];

function categoryAccent(cat: SupportTicketCategory | null, Colors: AppColors): string {
  switch (cat) {
    case 'delivery_issue':   return Colors.primary;
    case 'payment_billing':  return Colors.secondary;
    case 'account_access':   return Colors.gold;
    case 'partner_dispute':  return Colors.success;
    case 'app_bug':          return Colors.danger;
    case 'safety_alert':     return Colors.danger;
    case 'feature_request':  return Colors.primary;
    default:                 return Colors.slateLighter;
  }
}

// ─── Template row ─────────────────────────────────────────────────────────────

interface TemplateRowProps {
  template: SupportReplyTemplate;
  onSelect: (t: SupportReplyTemplate) => void;
  onEdit: (t: SupportReplyTemplate) => void;
  onDelete: (t: SupportReplyTemplate) => void;
}

const TemplateRow = React.memo(function TemplateRow({
  template,
  onSelect,
  onEdit,
  onDelete,
}: TemplateRowProps) {
  const Colors = useColors();
  const accent = categoryAccent(template.category, Colors);

  const handleSelect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelect(template);
  }, [onSelect, template]);

  const handleEdit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onEdit(template);
  }, [onEdit, template]);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDelete(template);
  }, [onDelete, template]);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: Colors.surface, borderColor: Colors.border },
      ]}
    >
      <TouchableOpacity
        style={styles.rowMain}
        onPress={handleSelect}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.rowEmoji,
            { backgroundColor: accent + '15', borderColor: accent + '35' },
          ]}
        >
          <Text style={styles.rowEmojiText}>
            {template.category ? TICKET_CATEGORY_EMOJI[template.category] : '📝'}
          </Text>
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowHeader}>
            <Text
              style={[styles.rowLabel, { color: Colors.slate }]}
              numberOfLines={1}
            >
              {template.label}
            </Text>
            {template.isDefault ? (
              <View
                style={[
                  styles.defaultChip,
                  { backgroundColor: Colors.gold + '18', borderColor: Colors.gold + '40' },
                ]}
              >
                <Sparkles size={9} color={Colors.gold} />
                <Text style={[styles.defaultChipText, { color: Colors.gold }]}>
                  seed
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.rowPreview, { color: Colors.slateLight }]}
            numberOfLines={2}
          >
            {template.body}
          </Text>
          {template.category ? (
            <View
              style={[
                styles.rowCatChip,
                { backgroundColor: accent + '12', borderColor: accent + '30' },
              ]}
            >
              <Text style={[styles.rowCatText, { color: accent }]}>
                {TICKET_CATEGORY_LABELS[template.category]}
              </Text>
            </View>
          ) : null}
        </View>
        <ChevronRight size={15} color={Colors.slateLighter} />
      </TouchableOpacity>

      <View style={[styles.rowActions, { borderTopColor: Colors.border }]}>
        <TouchableOpacity
          style={styles.rowActionBtn}
          onPress={handleEdit}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Edit3 size={13} color={Colors.primary} />
          <Text style={[styles.rowActionText, { color: Colors.primary }]}>
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rowActionBtn}
          onPress={handleDelete}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Trash2 size={13} color={Colors.danger} />
          <Text style={[styles.rowActionText, { color: Colors.danger }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Editor sub-modal ─────────────────────────────────────────────────────────

interface TemplateEditorProps {
  visible: boolean;
  initial?: SupportReplyTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

function TemplateEditor({ visible, initial, onClose, onSaved }: TemplateEditorProps) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [label, setLabel] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [category, setCategory] = useState<SupportTicketCategory | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Re-seed when opened with a fresh initial template (or for a new row).
  React.useEffect(() => {
    if (!visible) return;
    setLabel(initial?.label ?? '');
    setBody(initial?.body ?? '');
    setCategory(initial?.category ?? null);
  }, [visible, initial?.id]);

  const canSave = label.trim().length > 0 && body.trim().length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await saveSupportReplyTemplate({
        id: initial?.id,
        label: label.trim(),
        body: body.trim(),
        category,
      });
      await queryClient.invalidateQueries({ queryKey: SUPPORT_TEMPLATES_QUERY_KEY });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save template';
      logError('[SupportTemplatePicker] save: ' + msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Could not save template', msg);
    } finally {
      setSaving(false);
    }
  }, [canSave, initial?.id, label, body, category, queryClient, onSaved]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.editorRoot, { backgroundColor: Colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.editorHeader,
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
          <View style={styles.editorHeaderCenter}>
            <Text style={[styles.editorTitle, { color: Colors.slate }]}>
              {initial ? 'Edit template' : 'New template'}
            </Text>
            <Text style={[styles.editorSub, { color: Colors.slateLighter }]}>
              Saved to the shared staff library
            </Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.fieldLabel, { color: Colors.slate }]}>Label</Text>
          <TextInput
            style={[
              styles.fieldInput,
              { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate },
            ]}
            placeholder="e.g. Package theft report follow-up"
            placeholderTextColor={Colors.slateLighter}
            value={label}
            onChangeText={setLabel}
            maxLength={120}
          />

          <Text style={[styles.fieldLabel, { color: Colors.slate, marginTop: 16 }]}>
            Category (optional)
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catPickerRow}
            style={styles.catPickerWrap}
          >
            <TouchableOpacity
              onPress={() => setCategory(null)}
              activeOpacity={1}
            >
              <View
                style={[
                  styles.catChip,
                  {
                    backgroundColor: category === null ? Colors.slateLight + '18' : Colors.surface,
                    borderColor: category === null ? Colors.slateLight + '55' : Colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.catChipText,
                    { color: category === null ? Colors.slateLight : Colors.slateLighter },
                  ]}
                >
                  No category
                </Text>
              </View>
            </TouchableOpacity>
            {(Object.keys(TICKET_CATEGORY_LABELS) as SupportTicketCategory[]).map((c) => {
              const active = category === c;
              const accent = categoryAccent(c, Colors);
              return (
                <TouchableOpacity key={c} onPress={() => setCategory(c)} activeOpacity={1}>
                  <View
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: active ? accent + '18' : Colors.surface,
                        borderColor: active ? accent + '55' : Colors.border,
                      },
                    ]}
                  >
                    <Text style={styles.catChipEmoji}>{TICKET_CATEGORY_EMOJI[c]}</Text>
                    <Text
                      style={[
                        styles.catChipText,
                        { color: active ? accent : Colors.slateLight },
                      ]}
                    >
                      {TICKET_CATEGORY_LABELS[c]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.fieldLabel, { color: Colors.slate, marginTop: 16 }]}>
            Body
          </Text>
          <Text style={[styles.fieldHint, { color: Colors.slateLighter }]}>
            Use {'{{first_name}}'}, {'{{unit}}'}, {'{{date}}'} etc. as placeholders staff can
            fill when composing the reply.
          </Text>
          <TextInput
            style={[
              styles.bodyInput,
              { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate },
            ]}
            placeholder="Write the reply template…"
            placeholderTextColor={Colors.slateLighter}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            maxLength={4000}
          />
          <Text style={[styles.charCount, { color: Colors.slateLighter }]}>
            {body.length}/4000
          </Text>
        </ScrollView>

        <View
          style={[
            styles.editorSendBar,
            {
              paddingBottom: insets.bottom + 12,
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.editorSaveBtn,
              { backgroundColor: canSave ? Colors.primary : Colors.slateLighter + '40' },
            ]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <CheckCircle size={15} color="#fff" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.editorSaveText}>
                  {initial ? 'Save changes' : 'Create template'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main picker modal ────────────────────────────────────────────────────────

export interface SupportTemplatePickerProps {
  visible: boolean;
  /** Optional category hint (e.g. the ticket's category) used as the default filter. */
  defaultCategory?: SupportTemplateCategory;
  onClose: () => void;
  /**
   * Called when staff pick a template. Receives the raw template body — the
   * caller is responsible for placeholder substitution and inserting into the
   * reply editor.
   */
  onPick: (template: SupportReplyTemplate) => void;
}

export default function SupportTemplatePicker({
  visible,
  defaultCategory = 'all',
  onClose,
  onPick,
}: SupportTemplatePickerProps) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [activeCat, setActiveCat] = useState<SupportTemplateCategory>(defaultCategory);
  const [editorVisible, setEditorVisible] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<SupportReplyTemplate | null>(null);

  // React when the default category changes (e.g. picker re-opened for a new ticket).
  React.useEffect(() => {
    if (visible) setActiveCat(defaultCategory);
  }, [visible, defaultCategory]);

  const { data: templates = [], isLoading } = useQuery<SupportReplyTemplate[]>({
    queryKey: [...SUPPORT_TEMPLATES_QUERY_KEY, activeCat],
    queryFn: () => fetchSupportReplyTemplates(activeCat),
    enabled: visible,
    staleTime: 30_000,
    retry: 1,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const handlePick = useCallback(
    (t: SupportReplyTemplate) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onPick(t);
      onClose();
    },
    [onPick, onClose],
  );

  const handleNew = useCallback(() => {
    setEditingTemplate(null);
    setEditorVisible(true);
  }, []);

  const handleEdit = useCallback((t: SupportReplyTemplate) => {
    setEditingTemplate(t);
    setEditorVisible(true);
  }, []);

  const handleDelete = useCallback(
    (t: SupportReplyTemplate) => {
      Alert.alert(
        'Delete template?',
        `"${t.label}" will be removed from the shared staff library. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteSupportReplyTemplate(t.id);
                await queryClient.invalidateQueries({ queryKey: SUPPORT_TEMPLATES_QUERY_KEY });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to delete template';
                logError('[SupportTemplatePicker] delete: ' + msg);
                Alert.alert('Could not delete', msg);
              }
            },
          },
        ],
      );
    },
    [queryClient],
  );

  const handleEditorSaved = useCallback(() => {
    setEditorVisible(false);
    setEditingTemplate(null);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.pickerRoot, { backgroundColor: Colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.pickerHeader,
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
          <View style={styles.pickerHeaderCenter}>
            <Text style={[styles.pickerTitle, { color: Colors.slate }]}>
              Reply templates
            </Text>
            <Text style={[styles.pickerSub, { color: Colors.slateLighter }]}>
              {templates.length} saved · shared staff library
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleNew}
            style={[
              styles.newBtn,
              { backgroundColor: Colors.primary + '14', borderColor: Colors.primary + '40' },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={16} color={Colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchWrap,
            { backgroundColor: Colors.surface, borderBottomColor: Colors.border },
          ]}
        >
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
              placeholder="Search templates…"
              placeholderTextColor={Colors.slateLighter}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={14} color={Colors.slateLighter} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catFilterRow}
          style={[
            styles.catFilterWrap,
            { backgroundColor: Colors.surface, borderBottomColor: Colors.border },
          ]}
        >
          {CATEGORY_FILTERS.map((c) => {
            const active = activeCat === c;
            const accent =
              c === 'all' ? Colors.slateLight : categoryAccent(c as SupportTicketCategory, Colors);
            return (
              <TouchableOpacity key={c} onPress={() => setActiveCat(c)} activeOpacity={1}>
                <View
                  style={[
                    styles.catFilterChip,
                    {
                      backgroundColor: active ? accent + '18' : Colors.background,
                      borderColor: active ? accent + '55' : Colors.border,
                    },
                  ]}
                >
                  {c !== 'all' ? (
                    <Text style={styles.catFilterEmoji}>
                      {TICKET_CATEGORY_EMOJI[c as SupportTicketCategory]}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.catFilterText,
                      { color: active ? accent : Colors.slateLight },
                    ]}
                  >
                    {c === 'all' ? 'All categories' : TICKET_CATEGORY_LABELS[c as SupportTicketCategory]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.loadingText, { color: Colors.slateLighter }]}>
              Loading templates…
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <FileText size={44} color={Colors.slateLighter} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: Colors.slateLight }]}>
              {search ? 'No templates match your search' : 'No templates yet'}
            </Text>
            <Text style={[styles.emptyBody, { color: Colors.slateLighter }]}>
              {search
                ? 'Try a different keyword or clear the search.'
                : 'Tap the + button to save your first reply template.'}
            </Text>
            {!search ? (
              <TouchableOpacity
                style={[styles.emptyCta, { backgroundColor: Colors.primary }]}
                onPress={handleNew}
                activeOpacity={0.85}
              >
                <Plus size={15} color="#fff" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.emptyCtaText}>New template</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + 32 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filtered.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                onSelect={handlePick}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Editor sub-modal */}
      <TemplateEditor
        visible={editorVisible}
        initial={editingTemplate}
        onClose={() => {
          setEditorVisible(false);
          setEditingTemplate(null);
        }}
        onSaved={handleEditorSaved}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pickerRoot: { flex: 1 },

  // Header
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  pickerHeaderCenter: { flex: 1 },
  pickerTitle: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3 },
  pickerSub: { fontSize: 12, marginTop: 1 },
  newBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  // Category filter
  catFilterWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  catFilterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  catFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  catFilterEmoji: { fontSize: 12 },
  catFilterText: { fontSize: 12, fontWeight: '600' as const },

  // List
  list: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },

  // Row
  row: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  rowEmoji: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEmojiText: { fontSize: 18 },
  rowBody: { flex: 1 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  rowLabel: { fontSize: 14, fontWeight: '700' as const, flex: 1 },
  defaultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  defaultChipText: { fontSize: 9, fontWeight: '700' as const },
  rowPreview: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  rowCatChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  rowCatText: { fontSize: 10, fontWeight: '700' as const },
  rowActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 18,
  },
  rowActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rowActionText: { fontSize: 12, fontWeight: '600' as const },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 6,
  },
  emptyCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' as const },

  // Loader
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  // ── Editor ────────────────────────────────────────────────────────────────
  editorRoot: { flex: 1 },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  editorHeaderCenter: { flex: 1 },
  editorTitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  editorSub: { fontSize: 11, marginTop: 2 },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },

  catPickerWrap: { maxHeight: 44 },
  catPickerRow: { paddingVertical: 4, gap: 8, paddingRight: 16 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  catChipEmoji: { fontSize: 12 },
  catChipText: { fontSize: 12, fontWeight: '600' as const },

  bodyInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 180,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },

  editorSendBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editorSaveBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  editorSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },

  // Shared
  modalCloseBtn: { padding: 6, marginTop: 2 },
});
