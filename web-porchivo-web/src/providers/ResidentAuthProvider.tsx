/**
 * ResidentAuthProvider — Supabase session state + email-OTP sign-in/out for
 * the resident portal (/resident). Deliberately separate from PortalAuthProvider:
 * residents authenticate with a 6-digit code (no inbox redirect) and the flow
 * never creates accounts (`shouldCreateUser: false`) — residents exist only
 * through their community's invite, so an unknown email can't bootstrap one.
 *
 * Reviewer shortcut: ONLY `reviewer@porchivo.com` routes through the
 * `reviewer-access` edge function (App Review demo access) — no real OTP email
 * is sent; instead the reviewer enters the static demo code and the function
 * mints a real Supabase session server-side. All other emails use the normal
 * OTP flow untouched.
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

const REVIEWER_EMAIL = "reviewer@porchivo.com";

/** True when the entered email is the App Review demo account. */
export function isReviewerEmail(rawEmail: string): boolean {
  return normalizeEmail(rawEmail) === REVIEWER_EMAIL;
}

interface ReviewerTokenGrant {
  access_token?: string;
  refresh_token?: string;
}

interface ReviewerAccessResult {
  ok: boolean;
  error?: string;
  /** Present on the sign-in phase (code accepted) — standard token grant. */
  session?: ReviewerTokenGrant;
}

async function callReviewerAccess(payload: {
  email: string;
  code?: string;
}): Promise<ReviewerAccessResult> {
  const supabaseUrl = import.meta.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
  const apiKey = import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !apiKey) {
    return { ok: false, error: "The backend isn't configured in this deployment yet." };
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/reviewer-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as
      | (ReviewerTokenGrant & { error?: string })
      | null;
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 401
            ? "That code didn't match. Check the demo code and re-enter the 6 digits."
            : res.status === 429
              ? "Too many attempts. Wait a minute and try again."
              : "Demo sign-in failed. Please try again.",
      };
    }
    return { ok: true, session: data ?? undefined };
  } catch {
    return { ok: false, error: "Network issue reaching the demo service. Please retry." };
  }
}

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
    // Reviewer demo account: prepare it server-side (ensure phase) instead of
    // emailing a one-time code — the sign-in code is the static demo code.
    if (email === REVIEWER_EMAIL) {
      const result = await callReviewerAccess({ email });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
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
      // Reviewer demo account: exchange the static demo code for a real
      // session minted server-side (the demo password never leaves the edge
      // function) and adopt it into the Supabase client.
      if (email === REVIEWER_EMAIL) {
        const result = await callReviewerAccess({ email, code: code.trim() });
        if (!result.ok) return { ok: false, error: result.error };
        const accessToken = result.session?.access_token;
        const refreshToken = result.session?.refresh_token;
        if (!accessToken || !refreshToken) {
          return { ok: false, error: "Verification failed. Please try again." };
        }
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) return { ok: false, error: friendlyVerifyError(error.message) };
        return { ok: true };
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
