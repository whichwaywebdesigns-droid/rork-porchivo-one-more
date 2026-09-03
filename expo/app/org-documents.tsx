/**
 * Document Library — org-scoped (every community plan, Starter and up).
 * All active members can browse; staff/board add and remove. Two kinds:
 *  - external_url : link to an external doc (Google Drive, Dropbox, HOA site…)
 *  - file_path    : file in the private `org-documents` bucket (photo/PDF via
 *                   the image picker; path `{org_id}/{file}` for storage RLS).
 * Backed by `org_documents` + RLS.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import {
  ChevronLeft,
  FolderOpen,
  Plus,
  Trash2,
  Lock,
  Building2,
  Link2,
  ImagePlus,
  ExternalLink,
  FileText,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { warn } from '@/lib/logger';

const DOC_BUCKET = 'org-documents';

interface OrgDocument {
  id: string;
  org_id: string;
  name: string;
  external_url: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export default function OrgDocumentsScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, isOrgStaff } = useOrganization();
  const { session } = useApp();
  const userId = session?.user?.id ?? null;

  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [url, setUrl] = useState<string>('');

  const docsQuery = useQuery<OrgDocument[]>({
    queryKey: ['org-documents', activeOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_documents')
        .select('*')
        .eq('org_id', activeOrg!.id)
        .order('created_at', { ascending: false });
      if (error) {
        warn('[OrgDocuments] Fetch error:', error.code);
        return [];
      }
      return (data ?? []) as OrgDocument[];
    },
    enabled: !!activeOrg?.id,
  });

  const addLink = useMutation({
    mutationFn: async () => {
      if (!activeOrg?.id || !userId) throw new Error('Not ready');
      const trimmed = url.trim();
      const ok = /^https?:\/\//i.test(trimmed);
      if (!ok) throw new Error('Link must start with http:// or https://');
      const { error } = await supabase.from('org_documents').insert({
        org_id: activeOrg.id,
        name: name.trim(),
        external_url: trimmed,
        uploaded_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-documents', activeOrg?.id] });
      setAddOpen(false);
      setName('');
      setUrl('');
    },
    onError: (e: Error) => {
      Alert.alert('Could not add document', e.message);
    },
  });

  // Pick a photo from the library and upload it to the org's bucket folder.
  // Storage RLS scopes writes to `{org_id}/…` for staff, so the path prefix
  // must be the org id (same convention the migration policies enforce).
  const uploadPhoto = useMutation({
    mutationFn: async () => {
      if (!activeOrg?.id || !userId) throw new Error('Not ready');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error('Photo library permission was denied.');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
      const path = `${activeOrg.id}/${Date.now()}.${safeExt}`;
      const mimeType = asset.mimeType ?? 'image/jpeg';

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: upErr } = await supabase.storage
        .from(DOC_BUCKET)
        .upload(path, blob, { contentType: mimeType, upsert: false });
      if (upErr) {
        warn('[OrgDocuments] Upload error:', upErr.message);
        throw new Error('Upload failed — try again.');
      }

      const docName =
        name.trim() ||
        asset.fileName?.replace(/\.[^.]+$/, '') ||
        `Photo ${new Date().toLocaleDateString('en-US')}`;
      const { error } = await supabase.from('org_documents').insert({
        org_id: activeOrg.id,
        name: docName.slice(0, 120),
        file_path: path,
        file_size: typeof asset.fileSize === 'number' ? asset.fileSize : null,
        mime_type: mimeType,
        uploaded_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-documents', activeOrg?.id] });
      setAddOpen(false);
      setName('');
      setUrl('');
    },
    onError: (e: Error) => {
      Alert.alert('Could not add document', e.message);
    },
  });

  const removeDoc = useMutation({
    mutationFn: async (doc: OrgDocument) => {
      if (doc.file_path) {
        const { error: rmErr } = await supabase.storage.from(DOC_BUCKET).remove([doc.file_path]);
        if (rmErr) warn('[OrgDocuments] Storage remove (non-fatal):', rmErr.message);
      }
      const { error } = await supabase.from('org_documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['org-documents', activeOrg?.id] });
    },
    onError: (e: Error) => {
      Alert.alert('Could not remove document', e.message);
    },
  });

  const openDoc = useCallback(async (doc: OrgDocument) => {
    if (doc.external_url) {
      void Linking.openURL(doc.external_url);
      return;
    }
    if (doc.file_path) {
      const { data, error } = await supabase.storage
        .from(DOC_BUCKET)
        .createSignedUrl(doc.file_path, 300);
      if (error || !data?.signedUrl) {
        Alert.alert('Could not open document', 'The link expired — try again.');
        return;
      }
      void Linking.openURL(data.signedUrl);
    }
  }, []);

  const confirmRemove = useCallback(
    (doc: OrgDocument) => {
      Alert.alert('Remove document', `Remove "${doc.name}" from the library?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeDoc.mutate(doc) },
      ]);
    },
    [removeDoc],
  );

  // ── Gate states ──────────────────────────────────────────────────────────
  if (!activeOrg) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header title="Document Library" />
        <GateCard
          icon={<FolderOpen size={28} color={Colors.slateLighter} />}
          title="Join a community"
          body="The document library holds your HOA's bylaws, budgets, and notices. Ask your board for an invite to unlock it."
        />
      </View>
    );
  }

  const docs = docsQuery.data ?? [];

  return (
    <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
      <Header title="Document Library" />

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={docsQuery.isRefetching}
            onRefresh={() => void docsQuery.refetch()}
            tintColor={Colors.primary}
          />
        }
      >
        {docsQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
        ) : docs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <FolderOpen size={26} color={Colors.slateLighter} />
            <Text style={[styles.emptyTitle, { color: Colors.slate }]}>No documents yet</Text>
            <Text style={[styles.emptyBody, { color: Colors.slateLighter }]}>
              {isOrgStaff
                ? 'Add your bylaws, budgets, meeting minutes, and community notices.'
                : 'Your board will post bylaws, budgets, and notices here.'}
            </Text>
          </View>
        ) : (
          docs.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.docCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
              onPress={() => void openDoc(d)}
              activeOpacity={0.8}
            >
              <View style={[styles.docIcon, { backgroundColor: Colors.success + '18' }]}>
                {d.external_url ? (
                  <Link2 size={18} color={Colors.success} />
                ) : (
                  <FileText size={18} color={Colors.success} />
                )}
              </View>
              <View style={styles.docBody}>
                <Text style={[styles.docName, { color: Colors.slate }]} numberOfLines={1}>
                  {d.name}
                </Text>
                <Text style={[styles.docMeta, { color: Colors.slateLighter }]}>
                  {d.external_url ? 'External link' : 'File'}
                  {' · '}
                  {new Date(d.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              {isOrgStaff ? (
                <TouchableOpacity
                  onPress={() => confirmRemove(d)}
                  style={styles.trashBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={removeDoc.isPending}
                >
                  <Trash2 size={17} color={Colors.danger} />
                </TouchableOpacity>
              ) : (
                <ExternalLink size={15} color={Colors.slateLighter} />
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add document FAB — staff only */}
      {isOrgStaff ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: Colors.primary, bottom: insets.bottom + 20 }]}
          onPress={() => setAddOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}

      {/* Add document sheet */}
      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { backgroundColor: Colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetGrab}>
              <View style={[styles.grabHandle, { backgroundColor: Colors.border }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: Colors.slate }]}>Add Document</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
                placeholder="Document name (e.g. 2026 Budget)"
                placeholderTextColor={Colors.slateLighter}
                value={name}
                onChangeText={setName}
                maxLength={120}
              />
              <TextInput
                style={[styles.input, { backgroundColor: Colors.surface, borderColor: Colors.border, color: Colors.slate }]}
                placeholder="Link (https://…)"
                placeholderTextColor={Colors.slateLighter}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                keyboardType="url"
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.uploadBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}
                onPress={() => uploadPhoto.mutate()}
                disabled={uploadPhoto.isPending}
                activeOpacity={0.8}
              >
                {uploadPhoto.isPending ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <ImagePlus size={17} color={Colors.primary} />
                    <Text style={[styles.uploadBtnText, { color: Colors.primary }]}>
                      Upload a photo instead
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnSecondary, { borderColor: Colors.border }]}
                onPress={() => {
                  setAddOpen(false);
                  setName('');
                  setUrl('');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetBtnSecondaryText, { color: Colors.slateLight }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: Colors.primary, opacity: name.trim() && url.trim() && !addLink.isPending ? 1 : 0.5 }]}
                disabled={!name.trim() || !url.trim() || addLink.isPending}
                onPress={() => addLink.mutate()}
                activeOpacity={0.8}
              >
                {addLink.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sheetBtnText}>Add Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Header({ title }: { title: string }) {
  const Colors = useColors();
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <ChevronLeft size={26} color={Colors.slate} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: Colors.slate }]}>{title}</Text>
    </View>
  );
}

function GateCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  const Colors = useColors();
  return (
    <View style={[styles.gateCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      <View style={[styles.gateIcon, { backgroundColor: Colors.elevated }]}>{icon}</View>
      <Text style={[styles.gateTitle, { color: Colors.slate }]}>{title}</Text>
      <Text style={[styles.gateBody, { color: Colors.slateLighter }]}>{body}</Text>
      <TouchableOpacity
        style={[styles.gateBtn, { borderColor: Colors.border }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Building2 size={16} color={Colors.slateLight} />
        <Text style={[styles.gateBtnText, { color: Colors.slateLight }]}>Back to Community</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  headerTitle: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.3 },

  list: { padding: 16, paddingBottom: 120, gap: 10 },

  emptyCard: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 16, borderWidth: 1, marginTop: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  docIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docBody: { flex: 1, gap: 2 },
  docName: { fontSize: 15, fontWeight: '700' as const },
  docMeta: { fontSize: 12 },
  trashBtn: { padding: 6 },

  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetGrab: { alignItems: 'center', marginBottom: 8 },
  grabHandle: { width: 40, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: 18, fontWeight: '800' as const, marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    marginBottom: 10,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  uploadBtnText: { fontSize: 14, fontWeight: '600' as const },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  sheetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1 },
  sheetBtnSecondaryText: { fontSize: 15, fontWeight: '600' as const },
  sheetBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },

  gateCard: { marginTop: 40, marginHorizontal: 24, borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center' },
  gateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  gateTitle: { fontSize: 18, fontWeight: '800' as const, marginBottom: 8 },
  gateBody: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  gateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  gateBtnText: { fontSize: 13, fontWeight: '600' as const },
});
