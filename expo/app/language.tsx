/**
 * Language — dedicated language-selection screen (Settings → Language).
 *
 * Lists every ENABLED locale from the registry (planned languages never
 * render here), showing the native name ("Español (Estados Unidos)") as the
 * primary label with the English name as the secondary line. Selection
 * applies immediately via the global fade transition and persists locally +
 * to the profile. No country flags — flags represent countries, not
 * languages. Touch targets are ≥ 56pt and every row exposes radio semantics
 * for screen readers.
 */

import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { LocaleMeta } from '@/i18n/localeRegistry';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { language, languages, setLanguage, isTransitioning } = useLanguage();
  const { tokens, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSelect = (meta: LocaleMeta): void => {
    if (meta.code === language || isTransitioning) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void setLanguage(meta.code);
  };

  return (
    <View style={[styles.root, { backgroundColor: tokens.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: tokens.accentSoft }]}
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}
        >
          <ChevronLeft size={22} color={tokens.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: tokens.text }]}>
          {t('language.title')}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.descriptionRow}>
          <View style={[styles.descriptionIcon, { backgroundColor: tokens.accentSoft }]}>
            <Globe size={15} color={tokens.accent} strokeWidth={2.2} />
          </View>
          <Text style={[styles.description, { color: tokens.textMuted }]}>
            {t('language.description')}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: tokens.card, borderColor: tokens.border, shadowColor: tokens.shadow },
          ]}
        >
          {languages.map((meta, index) => {
            const isActive = meta.code === language;
            return (
              <TouchableOpacity
                key={meta.code}
                style={[
                  styles.row,
                  index < languages.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: tokens.border,
                  },
                  isActive && { backgroundColor: `${tokens.accent}0F` },
                ]}
                onPress={() => handleSelect(meta)}
                activeOpacity={0.7}
                disabled={isTransitioning}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={t('language.rowA11y', {
                  name: meta.nativeName,
                  state: isActive ? t('language.selected') : t('language.rowStateAvailable'),
                })}
              >
                <View style={styles.rowText}>
                  <Text
                    style={[
                      styles.rowNative,
                      { color: tokens.text },
                      isActive && { color: tokens.accent, fontWeight: '700' as const },
                    ]}
                  >
                    {meta.nativeName}
                  </Text>
                  <Text style={[styles.rowEnglish, { color: tokens.textMuted }]}>
                    {meta.englishName}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    { borderColor: isActive ? tokens.accent : tokens.border },
                  ]}
                >
                  {isActive && <Check size={14} color={tokens.accent} strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  descriptionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  descriptionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden' as const,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 64,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowNative: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  rowEnglish: {
    fontSize: 12.5,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
