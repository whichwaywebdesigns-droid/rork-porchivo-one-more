/**
 * Porchivo — Language Picker (Expo / React Native).
 *
 * Bottom-sheet style language selector with active-language highlighting:
 * the currently selected language gets a tinted background + checkmark.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { Check, Globe, ChevronDown } from 'lucide-react-native';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useColors } from '@/constants/colors';

export function LanguagePicker() {
  const { language, languages, languageMeta, setLanguage, isTransitioning } = useLanguage();
  const Colors = useColors();
  const [open, setOpen] = React.useState(false);

  const handleSelect = React.useCallback(
    async (code: string) => {
      if (code === language || isTransitioning) {
        setOpen(false);
        return;
      }
      setOpen(false);
      await setLanguage(code);
    },
    [language, isTransitioning, setLanguage],
  );

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: Colors.surface, borderColor: Colors.borderLight }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Language: ${languageMeta.englishName}. Tap to change.`}
      >
        <Globe size={18} color={Colors.primary} />
        <View style={styles.triggerText}>
          <Text style={[styles.triggerNative, { color: Colors.slate }]}>
            {languageMeta.nativeName}
          </Text>
          <Text style={[styles.triggerEnglish, { color: Colors.slateLight }]}>
            {languageMeta.englishName}
          </Text>
        </View>
        <Text style={styles.triggerFlag}>{languageMeta.flag}</Text>
        <ChevronDown size={16} color={Colors.slateLighter} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: Colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: Colors.borderLight }]} />
            <Text style={[styles.sheetTitle, { color: Colors.slate }]}>Select Language</Text>
            <FlatList
              data={languages}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isActive = item.code === language;
                return (
                  <TouchableOpacity
                    style={[
                      styles.langRow,
                      isActive && { backgroundColor: Colors.primary + '14' },
                    ]}
                    onPress={() => void handleSelect(item.code)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={styles.langFlag}>{item.flag}</Text>
                    <View style={styles.langText}>
                      <Text
                        style={[
                          styles.langNative,
                          { color: Colors.slate },
                          isActive && { fontWeight: '700', color: Colors.primary },
                        ]}
                      >
                        {item.nativeName}
                      </Text>
                      <Text style={[styles.langEnglish, { color: Colors.slateLight }]}>
                        {item.englishName}
                        {item.rtl ? ' · RTL' : ''}
                      </Text>
                      <Text style={[styles.langHello, { color: Colors.slateLighter }]}>
                        “{item.hello}”
                      </Text>
                    </View>
                    {isActive && <Check size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: Colors.borderLight }]} />
              )}
              style={styles.list}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  triggerText: {
    flex: 1,
    gap: 1,
  },
  triggerNative: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  triggerEnglish: {
    fontSize: 12,
  },
  triggerFlag: {
    fontSize: 20,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end' as const,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    paddingVertical: 14,
  },
  list: {
    paddingHorizontal: 8,
  },
  langRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  langFlag: {
    fontSize: 24,
  },
  langText: {
    flex: 1,
    gap: 1,
  },
  langNative: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  langEnglish: {
    fontSize: 12,
  },
  langHello: {
    fontSize: 12,
    fontStyle: 'italic' as const,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginLeft: 50,
  },
});
