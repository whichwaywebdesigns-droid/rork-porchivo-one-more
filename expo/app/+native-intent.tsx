export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  // Preserve the incoming deep-link path on cold launch so the redirect
  // effect in _layout.tsx can route auth-aware (onboarded+session stays on
  // the deep-linked screen; unauthenticated falls back to /welcome).
  return path;
}
