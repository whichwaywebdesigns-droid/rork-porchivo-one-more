/**
 * ManageBilling — subscription snapshot + Stripe Customer Portal deep link
 * through the existing `create-billing-portal` edge function.
 */

import { useState } from "react";
import { ExternalLink, CreditCard, ShieldAlert } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { usePortalOrg } from "@/hooks/usePortalOrg";

interface BillingPortalResponse {
  url?: string;
}

export default function ManageBillingPage() {
  const { org } = usePortalOrg();
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const planLabel = org?.plan_tier
    ? org.plan_tier.charAt(0).toUpperCase() + org.plan_tier.slice(1)
    : null;
  const status = org?.subscription_status ?? null;
  const periodEnd = org?.current_period_end
    ? new Date(org.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const openPortal = async (): Promise<void> => {
    if (!org) return;
    setIsOpening(true);
    setPortalError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-billing-portal", {
        body: {
          orgId: org.id,
          returnUrl: `${window.location.origin}/manage/billing`,
        },
      });
      if (error) throw new Error(error.message);
      const url = (data as BillingPortalResponse | null)?.url;
      if (!url) throw new Error("missing url");
      window.location.href = url;
    } catch {
      setPortalError(
        "Couldn't open the billing portal. Only organization admins can manage payment settings — contact support if this keeps happening.",
      );
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Billing & subscription</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Your community plan covers every resident — they never pay a cent.
        </p>
      </div>

      {!planLabel ? (
        <div className="paper-sheet rounded-xl px-6 py-8 text-center">
          <CreditCard className="w-9 h-9 text-brand-text-muted mx-auto mb-3" />
          <p className="text-sm font-semibold text-brand-text-primary mb-1">No subscription yet</p>
          <p className="text-[13px] text-brand-text-secondary leading-relaxed">
            Residents get core features free regardless — community tools unlock once a plan is active.
          </p>
        </div>
      ) : (
        <div className="paper-sheet rounded-xl px-6 py-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted">
              Current plan
            </span>
            {status && (
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                  status === "active" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-900"
                }`}
              >
                {status === "past_due" ? "past due" : status}
              </span>
            )}
          </div>

          <div className="text-2xl font-bold text-brand-text-primary mb-1">{planLabel}</div>
          <p className="text-[13px] text-brand-text-secondary">
            {periodEnd ? `Current period ends ${periodEnd}.` : "Billing schedule unavailable."}
          </p>

          {status === "past_due" && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 px-3.5 py-3">
              <ShieldAlert className="w-4 h-4 text-orange-700 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-orange-900 leading-relaxed">
                Payment failed — update your card below to restore community tools for residents.
              </p>
            </div>
          )}

          <button
            onClick={() => void openPortal()}
            disabled={isOpening}
            className="btn-orange mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] disabled:opacity-60"
          >
            <ExternalLink className="w-4 h-4" />
            {isOpening ? "Opening Stripe…" : "Manage billing in Stripe"}
          </button>
          <p className="mt-3 text-[11px] text-brand-text-muted">
            Opens Stripe's secure customer portal — invoices, cards, cancellation. Returns you here.
          </p>
        </div>
      )}

      {portalError && (
        <p className="text-[13px] text-red-600 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2.5" role="alert">
          {portalError}
        </p>
      )}
    </div>
  );
}
