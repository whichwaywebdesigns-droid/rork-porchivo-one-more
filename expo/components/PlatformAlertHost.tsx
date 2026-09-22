/**
 * PlatformAlertHost — renders showAlert()/showPrompt() dialogs.
 *
 * Mounted once in the root layout. On web it registers itself as the alert
 * emitter and renders every request as a styled in-app dialog (RN Modal works
 * on web via react-native-web). Button callbacks fire exactly like native
 * Alert — including navigation callbacks, which were previously swallowed by
 * the react-native-web Alert stub. Prompts add a TextInput (Alert.prompt is
 * iOS-only upstream, so this also gives Android a working prompt). Alerts on
 * native pass straight through to the real RN Alert in showAlert().
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  registerAlertEmitter,
  type AlertButton,
  type AlertRequest,
  type DialogRequest,
} from '@/lib/platformAlert';
import { useColors } from '@/constants/colors';

const MAX_INLINE_BUTTONS = 2;

export default function PlatformAlertHost() {
  const Colors = useColors();
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    registerAlertEmitter((req) => {
      setRequest(req);
      setPromptValue(req.kind === 'prompt' ? req.defaultValue ?? '' : '');
      setVisible(true);
      if (req.kind === 'prompt' && Platform.OS === 'web') {
        // Autofocus after the dialog mounts.
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    });
    return () => registerAlertEmitter(null);
  }, []);

  const finish = useCallback(() => setVisible(false), []);

  const handleButton = useCallback(
    (button: AlertButton) => {
      finish();
      // Defer the callback until after dismissal so screens can navigate
      // (router.back/replace) without fighting the closing dialog.
      requestAnimationFrame(() => button.onPress?.());
    },
    [finish],
  );

  const handleSubmitPrompt = useCallback(() => {
    if (request?.kind !== 'prompt') return;
    const value = promptValue;
    finish();
    requestAnimationFrame(() => request.onSubmit(value));
  }, [request, promptValue, finish]);

  const handleRequestClose = useCallback(() => {
    if (!request) return;
    finish();
    requestAnimationFrame(() => {
      if (request.kind === 'prompt') {
        request.onSubmit(null); // cancelled
      } else {
        const cancel = request.buttons.find((b) => b.style === 'cancel');
        cancel?.onPress?.();
      }
    });
  }, [request, finish]);

  if (!request || !visible) return null;

  const { title, message } = request;
  const buttons: AlertButton[] =
    request.kind === 'alert'
      ? request.buttons
      : [
          { text: 'Cancel', style: 'cancel' },
          { text: 'OK', style: 'default', onPress: handleSubmitPrompt },
        ];
  const inline = buttons.length <= MAX_INLINE_BUTTONS;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleRequestClose}>
      <KeyboardAvoidingView behavior={undefined} style={styles.overlay}>
        <Pressable style={styles.overlayTouch} onPress={handleRequestClose}>
          <Pressable
            style={[styles.card, { backgroundColor: Colors.surface }]}
            onPress={() => {}}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {title ? (
              <Text style={[styles.title, { color: Colors.slate }]}>{title}</Text>
            ) : null}
            {message ? (
              <Text style={[styles.message, { color: Colors.slateLight }]}>{message}</Text>
            ) : null}
            {request.kind === 'prompt' ? (
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.slate },
                ]}
                value={promptValue}
                onChangeText={setPromptValue}
                placeholderTextColor={Colors.slateLighter}
                secureTextEntry={request.secure}
                keyboardType={request.keyboardType === 'numeric' ? 'numeric' : 'default'}
                autoCapitalize={request.secure ? 'none' : 'sentences'}
                onSubmitEditing={handleSubmitPrompt}
                enablesReturnKeyAutomatically
              />
            ) : null}
            <View style={inline ? styles.buttonRow : styles.buttonStack}>
              {buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';
                return (
                  <Pressable
                    key={`${button.text}-${index}`}
                    onPress={() => handleButton(button)}
                    style={[
                      styles.button,
                      !inline && index > 0
                        ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }
                        : undefined,
                      inline && index > 0
                        ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.border }
                        : undefined,
                    ]}
                    android_ripple={{ color: Colors.border }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        { color: isDestructive ? Colors.danger : Colors.primary },
                        !isDestructive && !isCancel && styles.buttonTextBold,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  overlayTouch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 22,
    marginHorizontal: 20,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    marginHorizontal: 20,
  },
  input: {
    marginHorizontal: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.3)',
  },
  buttonStack: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.3)',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  buttonTextBold: {
    fontWeight: '700',
  },
});
