import React, { useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

interface InfoSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Optional eyebrow label above the title (e.g. "Privacy"). */
  eyebrow?: string;
  children: React.ReactNode;
}

/**
 * Lightweight bottom sheet for secondary, explanatory content — terms
 * summaries, permission explainers, security messaging. Keeps the primary
 * auth flow free of full-screen legal takeovers.
 *
 * Settles in with a slide + fade; tap the scrim or drag the grabber to close.
 */
export default function InfoSheet({
  visible,
  onClose,
  title,
  eyebrow,
  children,
}: InfoSheetProps) {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const slide = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      Animated.spring(slide, {
        toValue: 1,
        tension: 50,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = () => {
    void Haptics.selectionAsync();
    onClose();
  };

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_H, 0],
  });
  const scrimOpacity = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const sheetStyle: ViewStyle = {
    backgroundColor: Colors.surface,
    paddingBottom: insets.bottom + 14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_H * 0.82,
    transform: [{ translateY }],
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <Animated.View
            style={[styles.scrim, { backgroundColor: '#050C1E', opacity: scrimOpacity }]}
          />
        </Pressable>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Grabber */}
          <View style={styles.grabberWrap}>
            <View style={[styles.grabber, { backgroundColor: Colors.border }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              {eyebrow ? (
                <Text style={[styles.eyebrow, { color: Colors.primary }]}>{eyebrow}</Text>
              ) : null}
              <Text style={[styles.title, { color: Colors.slate }]}>{title}</Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeBtn, { backgroundColor: Colors.elevated }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={Colors.slateLight} strokeWidth={2.4} />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 6 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    flex: 1,
  },
  sheet: {
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
    marginTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    marginBottom: 4,
  },
});
