/**
 * ResidentAuthProvider — Supabase session state + email-OTP sign-in/out for
 * the resident portal (/resident). Deliberately separate from PortalAuthProvider:
 * residents authenticate with a 6-digit code (no inbox redirect) and the flow
 * never creates accounts (`shouldCreateUser: false`) — residents exist only
 * through their community's invite, so an unknown email can't bootstrap one.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export interface AuthStepResult {
  ok: boolean;
  /** Shown when !ok — friendly error text. */
  error?: string;
}

interface ResidentAuthContextValue {
  session: Session | null;
  userId: string | null;
  email: string | null;
  isLoadingSession: boolean;
  sendOtpCode: (email: string) => Promise<AuthStepResult>;
  verifyOtpCode: (email: string, code: string) => Promise<AuthStepResult>;
  signOut: () => Promise<void>;
}

const ResidentAuthContext = createContext<ResidentAuthContextValue | null>(null);

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function normalizeEmail(rawEmail: string): string | null {
  return EMAIL_RE.test(rawEmail.trim()) ? rawEmail.trim().toLowerCase() : null;
}

/** Maps Supabase auth errors to resident-friendly copy without leaking internals. */
function friendlySendError(message: string): string {
  if (/signups? not allowed|user not found|not registered|invalid login credentials/i.test(message)) {
    return "We couldn't find a resident account for that email. Residents are added by their community — ask your HOA or property manager for an invite first.";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return "Couldn't send the code. Check the address and try again.";
}

function friendlyVerifyError(message: string): string {
  if (/expired/i.test(message)) {
    return "That code has expired. Request a new one and try again.";
  }
  if (/invalid|not found/i.test(message)) {
    return "That code didn't match. Check the latest email and re-enter the 6 digits.";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return "Verification failed. Please try again.";
}

export function ResidentAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) {
          setSession(data.session);
          setIsLoadingSession(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingSession(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) setSession(nextSession);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const sendOtpCode = useCallback(async (rawEmail: string): Promise<AuthStepResult> => {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Security: never bootstrap accounts from the login screen.
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/resident`,
        },
      });
      if (error) return { ok: false, error: friendlySendError(error.message) };
      return { ok: true };
    } catch {
      return { ok: false, error: "Network issue sending the code. Please retry." };
    }
  }, []);

  const verifyOtpCode = useCallback(
    async (rawEmail: string, code: string): Promise<AuthStepResult> => {
      const email = normalizeEmail(rawEmail);
      if (!email) return { ok: false, error: "Please go back and re-enter your email." };
      if (!/^\d{6}$/.test(code.trim())) {
        return { ok: false, error: "Enter the 6-digit code from your email." };
      }
      try {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code.trim(),
          type: "email",
        });
        if (error) return { ok: false, error: friendlyVerifyError(error.message) };
        return { ok: true };
      } catch {
        return { ok: false, error: "Network issue verifying the code. Please retry." };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<ResidentAuthContextValue>(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      isLoadingSession,
      sendOtpCode,
      verifyOtpCode,
      signOut,
    }),
    [session, isLoadingSession, sendOtpCode, verifyOtpCode, signOut],
  );

  return <ResidentAuthContext.Provider value={value}>{children}</ResidentAuthContext.Provider>;
}

export function useResidentAuth(): ResidentAuthContextValue {
  const ctx = useContext(ResidentAuthContext);
  if (!ctx) throw new Error("useResidentAuth must be used inside <ResidentAuthProvider>");
  return ctx;
}

// Default export lets App.tsx lazy-load the provider (keeps supabase-js out
// of the marketing bundle).
export default ResidentAuthProvider;
