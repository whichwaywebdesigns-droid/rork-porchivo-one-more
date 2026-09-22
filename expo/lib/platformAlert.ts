/**
 * platformAlert — cross-platform Alert + Prompt that actually work on web.
 *
 * React Native Web exports `Alert` as a silent stub: `Alert.alert(...)` shows
 * nothing on the web build and never fires button `onPress` callbacks. Every
 * flow that gated navigation or success feedback behind Alert appeared
 * completely dead in the browser preview (package logging, incident filing,
 * announcement validation, shipment posting, etc.). `Alert.prompt` is worse:
 * iOS-only even on native, so it silently no-ops on web AND Android.
 *
 * `showAlert` / `showPrompt` are drop-in replacements:
 *   - showAlert matches Alert.alert(title, message, buttons, cancelable).
 *   - showPrompt matches Alert.prompt(title, message, callback, ...) but the
 *     callback receives `null` on cancel (native Cancel text passes as '').
 *   - Both render through the mounted <PlatformAlertHost /> (styled in-app
 *     dialog on web, and a consistent native dialog for prompts); alerts on
 *     native pass straight through to the real RN Alert.
 *
 * If no host is mounted (shouldn't happen — it lives in the root layout), the
 * web path degrades to window.alert so feedback is never silently swallowed.
 */
import { Alert as RNAlert, Platform } from 'react-native';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
}

export type PromptKeyboardType = 'default' | 'numeric' | 'email-address' | 'phone-pad';

export interface AlertRequest {
  title?: string;
  message?: string;
  buttons: AlertButton[];
}

export interface PromptRequest {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: PromptKeyboardType;
  /** Receives the entered text, or null when the dialog is cancelled. */
  onSubmit: (value: string | null) => void;
}

export type DialogRequest =
  | ({ kind: 'alert' } & AlertRequest)
  | ({ kind: 'prompt' } & PromptRequest);

type DialogEmitter = (request: DialogRequest) => void;

let webEmitter: DialogEmitter | null = null;

/**
 * Called by <PlatformAlertHost /> on mount (web only). Pass null on cleanup.
 */
export function registerAlertEmitter(emitter: DialogEmitter | null): void {
  webEmitter = emitter;
}

/**
 * Drop-in replacement for Alert.alert — identical call signature.
 */
export function showAlert(
  title?: string,
  message?: string,
  buttons?: AlertButton[],
  cancelable?: boolean,
): void {
  const normalizedButtons: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  if (Platform.OS === 'web') {
    if (webEmitter) {
      webEmitter({ kind: 'alert', title, message, buttons: normalizedButtons });
    } else {
      // Last-resort fallback: never lose the feedback entirely.
      window.alert([title, message].filter(Boolean).join('\n\n'));
    }
    return;
  }

  RNAlert.alert(title ?? '', message, normalizedButtons, { cancelable });
}

/**
 * Drop-in replacement for Alert.prompt (which is iOS-only upstream).
 * Works on web, Android, and iOS. `onSubmit` receives null on cancel.
 */
export function showPrompt(
  title?: string,
  message?: string,
  onSubmit?: (value: string | null) => void,
  type: 'plain-text' | 'secure-text' = 'plain-text',
  defaultValue: string = '',
  keyboardType: PromptKeyboardType = 'default',
): void {
  const submit = onSubmit ?? (() => {});

  if (Platform.OS === 'web') {
    if (webEmitter) {
      webEmitter({
        kind: 'prompt',
        title,
        message,
        defaultValue,
        secure: type === 'secure-text',
        keyboardType,
        onSubmit: submit,
      });
    } else {
      // eslint-disable-next-line no-alert
      const value = window.prompt([title, message].filter(Boolean).join('\n\n'), defaultValue);
      submit(value);
    }
    return;
  }

  // Native: route through our host too so Android gets a working prompt
  // (Alert.prompt is iOS-only upstream) and styling stays consistent.
  webEmitter?.({
    kind: 'prompt',
    title,
    message,
    defaultValue,
    secure: type === 'secure-text',
    keyboardType,
    onSubmit: submit,
  });
}
