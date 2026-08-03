/**
 * OnboardingFlowContext — typed local state for the refined onboarding flow.
 *
 * Holds the answers the user gives across the 6-screen flow (role, primary
 * pain point, and lightweight setup details) and persists them to
 * AsyncStorage. State is shaped so it can sync to Supabase later with no
 * restructuring: the `toSupabasePayload()` helper returns a flat, snake_case
 * object ready for an `onboarding_responses` row.
 *
 * This is intentionally separate from the legacy OnboardingContext (intent +
 * checklist) so the new flow can evolve independently.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { UserRole } from '@/types';

// ── Public types ────────────────────────────────────────────────────────────

export type PorchivoRole = 'resident' | 'property_manager' | 'staff' | 'other';

export type PainPoint =
  | 'missed_alerts'
  | 'delivery_confusion'
  | 'resident_comms'
  | 'front_desk'
  | 'all';

export interface SetupDetails {
  buildingName: string;
  unit: string;
  /** null = not yet answered, true/false = explicit preference. */
  notificationsEnabled: boolean | null;
}

export interface OnboardingFlowState {
  role: PorchivoRole | null;
  painPoint: PainPoint | null;
  setup: SetupDetails;
  /** True once the user reached the end of the flow (entered the app). */
  completed: boolean;
}

const DEFAULT_SETUP: SetupDetails = {
  buildingName: '',
  unit: '',
  notificationsEnabled: null,
};

const DEFAULT_STATE: OnboardingFlowState = {
  role: null,
  painPoint: null,
  setup: DEFAULT_SETUP,
  completed: false,
};

const STORAGE_KEY = 'porchivo_onboarding_flow_v1';

// ── Mapping helpers ──────────────────────────────────────────────────────────

/** Maps the richer onboarding role onto the app's core UserRole. */
export function porchivoRoleToUserRole(role: PorchivoRole | null): UserRole {
  switch (role) {
    case 'staff':
      return 'partner';
    case 'property_manager':
      return 'both';
    case 'resident':
    case 'other':
    default:
      return 'homeowner';
  }
}

/** Human-readable role label for UI. */
export const ROLE_LABEL: Record<PorchivoRole, string> = {
  resident: 'Resident',
  property_manager: 'Property Manager',
  staff: 'Staff',
  other: 'Other',
};

/** Flat snake_case payload ready for a future Supabase insert. */
export function toSupabasePayload(state: OnboardingFlowState) {
  return {
    role: state.role,
    pain_point: state.painPoint,
    building_name: state.setup.buildingName || null,
    unit: state.setup.unit || null,
    notifications_enabled: state.setup.notificationsEnabled,
    completed: state.completed,
  } as const;
}

// ── Context ──────────────────────────────────────────────────────────────────

export const [OnboardingFlowProvider, useOnboardingFlow] = createContextHook(() => {
  const [state, setState] = useState<OnboardingFlowState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<OnboardingFlowState>;
          setState({
            ...DEFAULT_STATE,
            ...parsed,
            setup: { ...DEFAULT_SETUP, ...(parsed.setup ?? {}) },
          });
        }
      } catch {
        // corrupted / unreadable — fall back to defaults
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback((next: OnboardingFlowState) => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setRole = useCallback(
    (role: PorchivoRole) => {
      setState((prev) => {
        const next = { ...prev, role };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setPainPoint = useCallback(
    (painPoint: PainPoint) => {
      setState((prev) => {
        const next = { ...prev, painPoint };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateSetup = useCallback(
    (updates: Partial<SetupDetails>) => {
      setState((prev) => {
        const next = { ...prev, setup: { ...prev.setup, ...updates } };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const markCompleted = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, completed: true };
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return useMemo(
    () => ({
      ...state,
      isLoaded,
      setRole,
      setPainPoint,
      updateSetup,
      markCompleted,
      reset,
    }),
    [state, isLoaded, setRole, setPainPoint, updateSetup, markCompleted, reset],
  );
});
