/**
 * ManageInviteCode — shows the community invite code residents use to join,
 * copy-to-clipboard, and regeneration via `regenerate_org_invite_code`
 * (server allows hoa_admin / super_admin only).
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, RefreshCw, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { canRegenInviteCode } from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";

export default function ManageInviteCodePage() {
  const { membership, org, refetch: refetchOrg } = usePortalOrg();
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState<boolean>(false);
  const [confirmingRegen, setConfirmingRegen] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canRegen = membership ? canRegenInviteCode(membership.role) : false;
  const inviteCode = org?.invite_code ?? "";

  const regenMutation = useMutation({
    mutationFn: async () => {
      if (!org) throw new Error("no org");
      const { data, error } = await supabase.rpc("regenerate_org_invite_code", {
        p_org_id: org.id,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: async () => {
      setErrorText(null);
      await queryClient.invalidateQueries({ queryKey: ["portal", "org"] });
      void refetchOrg?.();
    },
    onError: (err: Error) => {
      setErrorText(
        err.message.includes("Access denied")
          ? "Only HOA Admins can regenerate the invite code."
          : "Couldn't regenerate right now. Please try again.",
      );
    },
  });

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions/insecure context) — code stays visible for manual copy.
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Community invite code</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Share this code with your neighbors — they enter it in the Porchivo app to join{" "}
          {org?.name ?? "your community"}.
        </p>
      </div>

      <div className="paper-sheet rounded-xl px-6 py-7 text-center">
        <div className="font-mono text-[42px] leading-none font-bold tracking-[0.35em] text-brand-text-primary select-all">
          {inviteCode || "—"}
        </div>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={() => void handleCopy()}
            disabled={!inviteCode}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-brand-navy-500/70 text-[13px] font-medium text-brand-text-secondary hover:text-brand-text-primary hover:border-brand-navy-500 transition-colors disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-700" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy code
              </>
            )}
          </button>

          {canRegen && (
            confirmingRegen ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-[12px] text-brand-text-secondary">Invalidate the old code?</span>
                <button
                  onClick={() => regenMutation.mutate()}
                  disabled={regenMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-700/90 hover:bg-red-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-60"
                >
                  {regenMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Yes, new code
                </button>
                <button
                  onClick={() => setConfirmingRegen(false)}
                  className="text-[13px] text-brand-text-muted hover:text-brand-text-secondary transition-colors"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingRegen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-brand-navy-500/70 text-[13px] font-medium text-brand-text-secondary hover:text-brand-text-primary hover:border-brand-navy-500 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Regenerate
              </button>
            )
          )}
        </div>
        {canRegen && !confirmingRegen && (
          <p className="mt-4 text-[11px] text-brand-text-muted">
            Regenerating immediately invalidates the previous code everywhere it's been shared.
          </p>
        )}
        {!canRegen && (
          <p className="mt-4 text-[11px] text-brand-text-muted">
            Only HOA Admins can regenerate the code.
          </p>
        )}
      </div>

      {errorText && (
        <p className="text-[13px] text-red-600 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2.5" role="alert">
          {errorText}
        </p>
      )}
    </div>
  );
}
