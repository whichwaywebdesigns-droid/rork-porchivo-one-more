/**
 * Custom Branding — admins pick their community's accent color (stored on
 * `organizations.brand_color`) and it tints the Community tab surfaces.
 * Professional / Property Manager plans; admin-only (RLS: admin_user_id).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Palette, Check, Building2, Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/constants/colors';
import { useOrganization } from '@/store/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { warn } from '@/lib/logger';

const BRAND_PRESETS = [
  { hex: '#3A7BD5', label: 'Porchivo Blue' },
  { hex: '#E8622A', label: 'Warm Terracotta' },
  { hex: '#2E9B6F', label: 'Evergreen' },
  { hex: '#0891B2', label: 'Harbor Teal' },
  { hex: '#7C3AED', label: 'Wisteria' },
  { hex: '#D94040', label: 'Brick Red' },
  { hex: '#D97706', label: 'Amber' },
  { hex: '#DB2777', label: 'Azalea' },
] as const;

export default function OrgBrandingScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeOrg, isOrgAdmin } = useOrganization();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);

  const { data: orgMeta } = useQuery<{ planTier: string | null; brandColor: string | null }>({
    queryKey: ['org-meta', activeOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organizations')
        .select('plan_tier, brand_color')
        .eq('id', activeOrg!.id)
        .maybeSingle();
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        planTier: (row.plan_tier as string | null) ?? null,
        brandColor: (row.brand_color as string | null) ?? null,
      };
    },
    enabled: !!activeOrg?.id,
  });

  const planAllowed = orgMeta?.planTier === 'professional' || orgMeta?.planTier === 'enterprise';
  const currentColor = selected ?? orgMeta?.brandColor ?? null;
  const dirty = selected !== null && selected !== (orgMeta?.brandColor ?? null);

  const save = useCallback(async () => {
    if (!activeOrg?.id || !dirty) return;
    setSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({ brand_color: selected })
      .eq('id', activeOrg.id);
    setSaving(false);
    if (error) {
      warn('[OrgBranding] Save error:', error.code, error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['org-meta', activeOrg.id] });
    setSaved(true);
    setTimeout(() => router.back(), 650);
  }, [activeOrg?.id, dirty, selected, queryClient]);

  // ── Gate states ──────────────────────────────────────────────────────────
  if (!isOrgAdmin) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header />
        <GateCard
          icon={<Lock size={28} color={Colors.slateLighter} />}
          title="Admins only"
          body="Only your community's admin can change its branding."
        />
      </View>
    );
  }

  if (!planAllowed) {
    return (
      <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
        <Header />
        <GateCard
          icon={<Palette size={28} color={Colors.gold} />}
          title="Professional feature"
          body="Custom branding is available on the Professional and Property Manager plans. Upgrade your community's plan to make Porchivo feel like your own."
        />
      </View>
    );
  }

  const accent = currentColor ?? Colors.primary;
  const typeEmoji = activeOrg?.type === 'condo' ? '🏢' : activeOrg?.type === 'multifamily' ? '🏬' : activeOrg?.type === 'property_management' ? '🏗️' : '🏡';

  return (
    <View style={[styles.root, { backgroundColor: Colors.background, paddingTop: insets.top + 8 }]}>
      <Header />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: Colors.slateLighter }]}>Live preview</Text>

        {/* Preview — mirrors the Community tab org header */}
        <View style={[styles.previewCard, { backgroundColor: Colors.surface, borderColor: Colors.border, borderBottomColor: Colors.border }]}>
          <View style={styles.previewRow}>
            <View style={[styles.previewLogo, { backgroundColor: accent + '22' }]}>
              <Text style={{ fontSize: 22 }}>{typeEmoji}</Text>
            </View>
            <View style={styles.previewText}>
              <Text style={[styles.previewName, { color: Colors.slate }]} numberOfLines={1}>
                {activeOrg?.name ?? 'Your Community'}
              </Text>
              <Text style={[styles.previewType, { color: accent }]}>
                {activeOrg?.type === 'condo' ? 'Condo Association' : activeOrg?.type === 'multifamily' ? 'Multifamily' : activeOrg?.type === 'property_management' ? 'Property Management' : 'HOA'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: Colors.slateLighter }]}>Accent color</Text>
        <View style={styles.swatchGrid}>
          {BRAND_PRESETS.map((preset) => {
            const active = currentColor === preset.hex;
            return (
              <TouchableOpacity
                key={preset.hex}
                style={[styles.swatch, { borderColor: active ? preset.hex : Colors.border, borderWidth: active ? 2.5 : 1 }]}
                onPress={() => {
                  setSelected(preset.hex);
                  setSaved(false);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.swatchFill, { backgroundColor: preset.hex }]}>
                  {active ? <Check size={18} color="#fff" /> : null}
                </View>
                <Text style={[styles.swatchLabel, { color: Colors.slateLight }]} numberOfLines={1}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.noneRow, { borderColor: Colors.border }]}
          onPress={() => {
            setSelected(null);
            setSaved(false);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.noneDot, { backgroundColor: Colors.elevated, borderColor: Colors.border }]}>
            {currentColor === null ? <Check size={14} color={Colors.slate} /> : null}
          </View>
          <Text style={[styles.noneText, { color: Colors.slateLight }]}>Use default Porchivo blue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: dirty ? Colors.primary : Colors.elevated, opacity: dirty && !saving ? 1 : 0.6 }]}
          disabled={!dirty || saving}
          onPress={() => void save()}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : saved ? (
            <>
              <Check size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Saved</Text>
            </>
          ) : (
            <Text style={styles.saveBtnText}>Save Branding</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.hint, { color: Colors.slateLighter }]}>
          Your accent tints the community header and admin tools for every resident in this community.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Header() {
  const Colors = useColors();
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <ChevronLeft size={26} color={Colors.slate} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: Colors.slate }]}>Custom Branding</Text>
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

  body: { padding: 16, paddingBottom: 60 },
  sectionLabel: { fontSize: 12, fontWeight: '700' as const, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 8 },

  previewCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 18 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewLogo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  previewText: { flex: 1 },
  previewName: { fontSize: 16, fontWeight: '700' as const },
  previewType: { fontSize: 13, marginTop: 2, fontWeight: '600' as const },

  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  swatch: { width: '23%', borderRadius: 14, padding: 6, alignItems: 'center', gap: 6 },
  swatchFill: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  swatchLabel: { fontSize: 9.5, fontWeight: '600' as const, textAlign: 'center' },

  noneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 22,
  },
  noneDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noneText: { fontSize: 13.5, fontWeight: '500' as const },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 14,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  hint: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },

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
