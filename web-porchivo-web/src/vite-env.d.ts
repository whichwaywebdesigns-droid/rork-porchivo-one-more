/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key (client-side token, safe to expose). */
  readonly VITE_POSTHOG_API_KEY?: string;
  /** Optional PostHog host; defaults to the US cloud endpoint. */
  readonly VITE_POSTHOG_HOST?: string;
}
