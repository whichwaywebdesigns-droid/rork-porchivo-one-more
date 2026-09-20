/**
 * ReturningUserChip — session-aware shortcut for existing users.
 *
 * Rendered on the marketing homepage only: when the browser holds a Supabase
 * session (the manager portal, resident portal, and the Expo web app all share
 * the same storage), a small floating pill offers a one-tap path straight into
 * the right portal. Invisible to logged-out visitors — no hidden link exists
 * to discover.
 *
 * Deliberately does NOT import supabase-js — it reads the persisted session
 * record from localStorage directly, keeping supabase-js out of the marketing
 * bundle (the same reason the portal providers are lazy-loaded in App.tsx).
 *
 * Routing: a `porchivo.last_portal` hint written by the portal providers wins;
 * otherwise a lightweight REST probe of org_memberships (RLS-scoped to the
 * caller) decides between the manager portal and the resident dashboard. The
 * destination page still validates/refreshes the session for real — the chip
 * never authenticates anything, it only routes.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, X } from "lucide-react";

type PortalTarget = "manage" | "resident";

/** Shape of the session record supabase-js persists to localStorage. */
interface StoredSession {
  access_token?: string;
  expires_at?: number;
  user?: { id?: string } | null;
  currentSession?: StoredSession;
}

/** Mirrors canViewAdminTools in lib/portalTypes.ts (client-side gate set). */
const MANAGER_ROLES: ReadonlySet<string> = new Set([
  "hoa_admin",
  "property_manager",
  "property_staff",
  "board_member",
  "super_admin",
]);

const DISMISS_KEY = "porchivo.returning_chip.dismissed";
const HINT_KEY = "porchivo.last_portal";

function readSupabaseUrl(): string | undefined {
  return import.meta.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
}

/** Reads the persisted Supabase session without loading supabase-js. */
function readStoredSession(): StoredSession | null {
  try {
    const url = readSupabaseUrl();
    let raw: string | null = null;
    if (url) {
      const projectRef = new URL(url).hostname.split(".")[0];
      raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    }
    if (!raw) {
      // Fallback: find the default storage key even if the URL env is missing
      const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
      if (key) raw = localStorage.getItem(key);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    const session = parsed.currentSession ?? parsed;
    return session.user?.id ? session : null;
  } catch {
    return null;
  }
}

function readPortalHint(): PortalTarget | null {
  try {
    const hint = localStorage.getItem(HINT_KEY);
    return hint === "manage" || hint === "resident" ? hint : null;
  } catch {
    return null;
  }
}

/** RLS-scoped probe: which portal does this session's active role belong to? */
async function probePortalTarget(
  supabaseUrl: string,
  accessToken: string,
  userId: string,
): Promise<PortalTarget | null> {
  const apiKey =
    (import.meta.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined);
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/org_memberships?select=role,status&user_id=eq.${encodeURIComponent(userId)}`,
      { headers: { apikey: apiKey, Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ role?: string; status?: string }>;
    const active = rows.filter((r) => r.status === "active" && r.role);
    if (active.length === 0) return null;
    return active.some((r) => MANAGER_ROLES.has(r.role as string)) ? "manage" : "resident";
  } catch {
    return null;
  }
}

export default function ReturningUserChip() {
  const { t } = useTranslation();
  const [target, setTarget] = useState<PortalTarget | null>(null);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* private browsing — chip just shows */
    }

    const session = readStoredSession();
    if (!session) return;

    const supabaseUrl = readSupabaseUrl();

    const decide = async () => {
      const hint = readPortalHint();
      let next: PortalTarget = hint ?? "resident";
      if (!hint && supabaseUrl && session.access_token && session.user?.id) {
        next =
          (await probePortalTarget(supabaseUrl, session.access_token, session.user.id)) ??
          "resident";
      }
      if (cancelled) return;
      setTarget(next);
      setVisible(true);
      requestAnimationFrame(() => setEntered(true));
    };
    void decide();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private browsing — dismissal is per-page-load only */
    }
  };

  if (!visible || !target) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 transition-all duration-300 ease-out ${
        entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <div className="flex items-center gap-1 rounded-full border border-white/15 bg-pv-navy/95 py-1.5 pl-4 pr-1.5 shadow-xl backdrop-blur-md">
        <Link
          to={target === "manage" ? "/manage" : "/resident"}
          className="flex items-center gap-2.5 rounded-full py-1.5 text-[13px] font-semibold text-white transition-colors hover:text-pv-amber"
        >
          <LayoutDashboard className="h-4 w-4 flex-shrink-0 text-pv-amber" aria-hidden="true" />
          {target === "manage"
            ? t("landing.returning.manager")
            : t("landing.returning.resident")}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("landing.returning.dismiss")}
          className="ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
