/**
 * ManageLogin — magic-link sign-in for the manager portal.
 * If the visitor already has an active staff session they go straight in.
 */

import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { MailCheck, Loader2, ArrowLeft } from "lucide-react";

import { usePortalAuth } from "@/providers/PortalAuthProvider";
import { usePortalOrg } from "@/hooks/usePortalOrg";

type LoginPhase = "idle" | "sending" | "sent";

export default function ManageLoginPage() {
  const { session, signInWithMagicLink } = usePortalAuth();
  const { membership, isLoading } = usePortalOrg();

  const [emailValue, setEmailValue] = useState<string>("");
  const [phase, setPhase] = useState<LoginPhase>("idle");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Already signed in as staff → straight to the dashboard.
  if (session && !isLoading && membership) {
    return <Navigate to="/manage" replace />;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setPhase("sending");
    setFeedback(null);
    const result = await signInWithMagicLink(emailValue);
    setFeedback({ ok: result.ok, text: result.ok ? (result.message ?? "") : (result.error ?? "") });
    setPhase(result.ok ? "sent" : "idle");
  };

  return (
    <div className="page-desk min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="packing-tape" aria-hidden />
        <div className="paper-sheet relative rounded-xl px-7 sm:px-9 py-9">
          <p className="label-header mb-2">Porchivo Manager Portal</p>
          <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Sign in to your community</h1>
          <p className="text-sm text-brand-text-secondary leading-relaxed mb-7">
            Enter your work email and we'll send a secure sign-in link. No password needed —
            click the link from your desk and you're in.
          </p>

          {phase === "sent" ? (
            <div className="text-center py-4">
              <MailCheck className="w-10 h-10 text-green-700 mx-auto mb-4" />
              <p className="text-sm text-brand-text-primary font-medium leading-relaxed">{feedback?.text}</p>
              <p className="mt-2 text-[12px] text-brand-text-muted">
                The link opens this portal right here. It expires shortly after it arrives.
              </p>
              <button
                onClick={() => setPhase("idle")}
                className="mt-6 text-[13px] font-medium text-brand-blue-light hover:text-brand-blue transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label htmlFor="portal-email" className="block text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mb-1.5">
                  Work email
                </label>
                <input
                  id="portal-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder="manager@yourhoa.org"
                  className="w-full rounded-lg border border-brand-navy-500/70 bg-white/70 dark:bg-brand-navy-800/60 px-3.5 py-2.5 text-[15px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-tape-gold/50 focus:border-brand-tape-gold transition-colors"
                />
              </div>

              {feedback && !feedback.ok && (
                <p className="text-[13px] text-red-600" role="alert">{feedback.text}</p>
              )}

              <button
                type="submit"
                disabled={phase === "sending"}
                className="btn-orange w-full rounded-lg py-2.5 text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {phase === "sending" && <Loader2 className="w-4 h-4 animate-spin" />}
                Send sign-in link
              </button>
            </form>
          )}

          <div className="mt-8 pt-5 border-t border-dashed border-brand-navy-500/50">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[13px] text-brand-text-muted hover:text-brand-text-secondary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to porchivo.com
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
