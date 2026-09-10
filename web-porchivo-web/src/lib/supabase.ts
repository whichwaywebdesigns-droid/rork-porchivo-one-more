/**
 * Supabase browser client for the manager portal.
 *
 * Reads the cross-platform public env vars — vite.config.ts exposes
 * EXPO_PUBLIC_* through `envPrefix`, so no separate VITE_ vars are needed.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
// Prefer the new publishable key — legacy JWT anon keys were disabled
// server-side (2026-07-12) and every request carrying one now 401s
// ("Legacy API keys are disabled"). Mirrors expo/lib/supabase.ts (M-1).
const supabaseAnonKey =
  (import.meta.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  // Placeholder values keep the client constructable even when unconfigured;
  // every screen checks `isSupabaseConfigured` before touching the network.
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "public-anon-key-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
