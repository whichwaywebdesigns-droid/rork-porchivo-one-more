/**
 * PortalAuthProvider — Supabase session state + magic-link sign-in/out
 * for the manager portal. Scoped to the web app only; no marketing pages
 * depend on it (provider mounted around the /manage routes).
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

interface MagicLinkResult {
  ok: boolean;
  /** Shown when ok — tells the user where the link went. */
  message?: string;
  /** Shown when !ok — friendly error text. */
  error?: string;
}

interface PortalAuthContextValue {
  session: Session | null;
  userId: string | null;
  email: string | null;
  isLoadingSession: boolean;
  signInWithMagicLink: (email: string) => Promise<MagicLinkResult>;
  signOut: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
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

  const signInWithMagicLink = useCallback(async (rawEmail: string): Promise<MagicLinkResult> => {
    const email = rawEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/manage` },
      });
      if (error) {
        return { ok: false, error: "Couldn't send the link. Check the address and try again." };
      }
      return { ok: true, message: `Check ${email} — your sign-in link is on its way.` };
    } catch {
      return { ok: false, error: "Network issue sending the link. Please retry." };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<PortalAuthContextValue>(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      isLoadingSession,
      signInWithMagicLink,
      signOut,
    }),
    [session, isLoadingSession, signInWithMagicLink, signOut],
  );

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used inside <PortalAuthProvider>");
  return ctx;
}

// Default export lets App.tsx lazy-load the provider (keeps supabase-js out
// of the marketing bundle).
export default PortalAuthProvider;
