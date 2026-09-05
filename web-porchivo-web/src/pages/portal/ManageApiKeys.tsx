/**
 * ManageApiKeys — Enterprise API access (api_keys + api-gateway).
 *
 * Enterprise-plan, staff-only. Create Bearer keys for external integrations:
 * keys are generated client-side, shown ONCE, and only their SHA-256 hash is
 * stored. The api-gateway verifies them (same package routes as the app) at
 * 60 req/min per key. Keys are revoked, never deleted — audit trail.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Braces,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  TriangleAlert,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { type ApiKeyRow } from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";

const GATEWAY_BASE = `${import.meta.env.EXPO_PUBLIC_SUPABASE_URL ?? ""}/functions/v1/api-gateway`;

/** 32 random bytes → base64url, prefixed `pvk_live_`. */
function generateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `pvk_live_${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ManageApiKeysPage() {
  const { org } = usePortalOrg();
  const orgId = org?.id;
  const planAllowed = org?.plan_tier === "enterprise";
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const keysQuery = useQuery({
    queryKey: ["portal", "apiKeys", orgId],
    enabled: Boolean(orgId) && planAllowed,
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error: e } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (e) throw new Error(e.message);
      return (data ?? []) as ApiKeyRow[];
    },
  });

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      if (!orgId) throw new Error("no org");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const key = generateKey();
      const { error: e } = await supabase.from("api_keys").insert({
        org_id: orgId,
        name,
        key_hash: await sha256Hex(key),
        key_prefix: key.slice(0, 13),
        created_by: user.id,
      });
      if (e) throw new Error(e.message);
      return key;
    },
    onSuccess: (key) => {
      setCreatedKey(key);
      setCopied(false);
      setNewName("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["portal", "apiKeys", orgId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (e) throw new Error(e.message);
    },
    onSuccess: () => {
      setConfirmingId(null);
      void queryClient.invalidateQueries({ queryKey: ["portal", "apiKeys", orgId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!planAllowed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">API access</h1>
        </div>
        <div className="paper-sheet rounded-xl px-6 py-8 text-center">
          <Braces className="w-8 h-8 text-brand-orange mx-auto mb-3" />
          <h2 className="text-lg font-bold text-brand-text-primary mb-2">Enterprise feature</h2>
          <p className="text-sm text-brand-text-secondary leading-relaxed max-w-md mx-auto">
            API access is available on the Enterprise plan. Build custom integrations against your community's
            package data with authenticated API keys.
          </p>
        </div>
      </div>
    );
  }

  const keys = keysQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">API access</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Authenticate external integrations against {org?.name ?? "your community"}'s package data. Rate limit:
          60 requests per minute per key.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-100 dark:bg-red-900/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {/* One-time full key reveal */}
      {createdKey && (
        <div className="paper-sheet rounded-xl px-6 py-5 border-2 border-brand-orange/60">
          <div className="flex items-center gap-2 mb-2">
            <TriangleAlert className="w-4 h-4 text-brand-orange" />
            <h2 className="text-[14px] font-bold text-brand-text-primary">
              Copy your key now — it won't be shown again
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap rounded-lg bg-brand-navy-900 text-brand-text-primary text-[12px] px-3 py-2.5">
              {createdKey}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(createdKey).then(() => setCopied(true));
              }}
              className="btn-orange flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px]"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className="mt-3 text-[13px] text-brand-text-muted hover:text-brand-text-secondary transition-colors"
          >
            Done — I saved it
          </button>
        </div>
      )}

      {/* Create */}
      <form
        className="paper-sheet rounded-xl px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (name) createKey.mutate(name);
        }}
      >
        <label htmlFor="api-key-name" className="block text-[13px] font-semibold text-brand-text-primary mb-2">
          New key name
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="api-key-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Front desk kiosk"
            className="flex-1 rounded-lg border border-brand-navy-500/60 bg-transparent px-3 py-2.5 text-[14px] text-brand-text-primary placeholder:text-brand-text-muted/60 focus:outline-none focus:border-brand-orange"
          />
          <button
            type="submit"
            disabled={!newName.trim() || createKey.isPending}
            className="btn-orange inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] disabled:opacity-60"
          >
            {createKey.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create key
          </button>
        </div>
      </form>

      {/* Key list */}
      {keysQuery.isLoading ? (
        <div className="py-10 flex justify-center">
          <div className="w-7 h-7 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <p className="text-[13px] text-brand-text-muted">
          No API keys yet — create one to connect an external integration.
        </p>
      ) : (
        <ul className="space-y-3">
          {keys.map((k) => {
            const revoked = Boolean(k.revoked_at);
            return (
              <li key={k.id} className="paper-sheet rounded-xl px-5 py-4 flex items-center gap-4">
                <KeyRound className={`w-4 h-4 flex-shrink-0 ${revoked ? "text-brand-text-muted" : "text-brand-orange"}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-brand-text-primary truncate">{k.name}</h3>
                  <p className="text-[12px] text-brand-text-muted">
                    <code>{k.key_prefix}…</code> · created {fmtDate(k.created_at)} ·{" "}
                    {k.last_used_at ? `last used ${fmtDate(k.last_used_at)}` : "never used"}
                  </p>
                </div>
                {revoked ? (
                  <span className="flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                    Revoked
                  </span>
                ) : confirmingId === k.id ? (
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => revokeKey.mutate(k.id)}
                      disabled={revokeKey.isPending}
                      className="text-[12px] font-semibold text-red-600 dark:text-red-400 hover:underline"
                    >
                      Confirm revoke
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="text-[12px] text-brand-text-muted hover:text-brand-text-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(k.id)}
                    className="flex-shrink-0 text-[12px] font-semibold text-red-600 dark:text-red-400 hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Docs */}
      <div className="paper-sheet rounded-xl px-6 py-5">
        <h2 className="text-[15px] font-bold text-brand-text-primary mb-1">Quick start</h2>
        <p className="text-[13px] text-brand-text-secondary mb-4">
          Send your key as a Bearer token to the API gateway. Keys act as a staff integration scoped to this
          community — they can list, log, and update packages.
        </p>
        <div className="space-y-3">
          {[
            `curl "${GATEWAY_BASE}/packages?status=arrived" \\\n  -H "Authorization: Bearer pvk_live_YOUR_KEY"`,
            `curl -X POST "${GATEWAY_BASE}/packages" \\\n  -H "Authorization: Bearer pvk_live_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: <a-random-uuid>" \\\n  -d '{"carrier":"UPS","tracking_number":"1Z999AA10123456784"}'`,
            `curl -X POST "${GATEWAY_BASE}/packages/PACKAGE_ID/status" \\\n  -H "Authorization: Bearer pvk_live_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"picked_up"}'`,
          ].map((snippet, i) => (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg bg-brand-navy-900 text-brand-text-primary text-[11px] leading-relaxed px-4 py-3"
            >
              {snippet}
            </pre>
          ))}
        </div>
      </div>
    </div>
  );
}
