/**
 * useToast — primary hook for showing transient toast/snackbar feedback.
 *
 * Usage:
 *   import { useToast } from '@/hooks/useToast';
 *   const toast = useToast();
 *   toast.success('Package added');
 *   toast.error('Could not save changes');
 *   toast.show({ message: 'Removed', actionLabel: 'Undo', onAction: () => restore() });
 */

import { useToastContext } from '@/providers/ToastProvider';
import type { ToastContextValue } from '@/providers/ToastProvider';

export function useToast(): ToastContextValue {
  const { show, success, error, info, warning, hide } = useToastContext();
  return { show, success, error, info, warning, hide };
}

export type { ToastOptions, ToastVariant } from '@/providers/ToastProvider';
