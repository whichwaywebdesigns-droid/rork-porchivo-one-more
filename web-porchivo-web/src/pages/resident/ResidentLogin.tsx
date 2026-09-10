/**
 * ResidentLogin — password-free sign-in for the /resident portal.
 *
 * Two steps, no inbox redirect needed:
 *   1. Email → we send a 6-digit code (existing accounts only — this screen
 *      never creates users; residents join via their community's invite).
 *   2. Code entry (auto-submits at 6 digits) → session → /resident dashboard.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Loader2, MailCheck, ArrowLeft, ShieldCheck } from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase";
import { useResidentAuth } from "@/providers/ResidentAuthProvider";
import { useResidentOrg } from "@/hooks/useResidentOrg";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type Phase = "email" | "code";

export default function ResidentLoginPage() {
  const { session, isLoadingSession, sendOtpCode, verifyOtpCode } = useResidentAuth();
  const { membership, isLoading: isLoadingOrg } = useResidentOrg();

  const [phase, setPhase] = useState<Phase>("email");
  const [emailValue, setEmailValue] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // Auto-return once the visitor already has an active community session.
  if (session && !isLoadingSession && !isLoadingOrg && membership) {
    return <Navigate to="/resident" replace />;
  }

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = useCallback(
    async (isResend: boolean): Promise<void> => {
      if (isSending || cooldown > 0) return;
      setIsSending(true);
      setError(null);
      const result = await sendOtpCode(emailValue);
      setIsSending(false);
      if (result.ok) {
        setPhase("code");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        if (isResend) setCode("");
      } else {
        setError(result.error ?? "Couldn't send the code.");
      }
    },
    [cooldown, emailValue, isSending, sendOtpCode],
  );

  const handleVerify = useCallback(
    async (value: string): Promise<void> => {
      if (isVerifying) return;
      setIsVerifying(true);
      setError(null);
      const result = await verifyOtpCode(emailValue, value);
      setIsVerifying(false);
      if (!result.ok) {
        setError(result.error ?? "Verification failed.");
        setCode("");
      }
      // On success the auth state change flips the redirect above.
    },
    [emailValue, isVerifying, verifyOtpCode],
  );

  if (!isSupabaseConfigured) {
    return (
      <div className="page-desk min-h-screen flex items-center justify-center px-4">
        <div className="paper-sheet w-full max-w-md rounded-xl px-8 py-10 text-center">
          <ShieldCheck className="w-10 h-10 text-brand-orange mx-auto mb-4" />
          <h1 className="text-lg font-bold text-brand-text-primary mb-2">Sign-in unavailable</h1>
          <p className="text-sm text-brand-text-secondary leading-relaxed">
            The backend isn't configured in this deployment yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-desk min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="packing-tape" aria-hidden />
        <div className="paper-sheet relative rounded-xl px-7 sm:px-9 py-9">
          {phase === "email" ? (
            <>
              <p className="label-header mb-2">Porchivo Resident Portal</p>
              <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Sign in to your home</h1>
              <p className="text-sm text-brand-text-secondary leading-relaxed mb-7">
                Enter the email your community registered and we'll send you a
                one-time 6-digit code. No password to remember.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendCode(false);
                }}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="resident-email"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-brand-text-muted mb-1.5"
                  >
                    Registered email
                  </label>
                  <input
                    id="resident-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    placeholder="you@home.com"
                    className="w-full rounded-lg border border-brand-navy-500/70 bg-white/70 dark:bg-brand-navy-800/60 px-3.5 py-2.5 text-[15px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-tape-gold/50 focus:border-brand-tape-gold transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-[13px] text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSending}
                  className="btn-orange w-full rounded-lg py-2.5 text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send my code
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="label-header mb-2">Porchivo Resident Portal</p>
              <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Enter your code</h1>
              <p className="text-sm text-brand-text-secondary leading-relaxed mb-6">
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-brand-text-primary">{emailValue}</span>. It
                expires shortly after it arrives.
              </p>

              <div className="flex flex-col items-center gap-5">
                <InputOTP
                  maxLength={CODE_LENGTH}
                  value={code}
                  onChange={setCode}
                  onComplete={(value) => void handleVerify(value)}
                  disabled={isVerifying}
                  aria-label="6-digit sign-in code"
                >
                  <InputOTPGroup>
                    {Array.from({ length: CODE_LENGTH }, (_, i) => (
                      <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                {error && (
                  <p className="text-[13px] text-red-600 text-center" role="alert">
                    {error}
                  </p>
                )}

                {isVerifying ? (
                  <p className="text-[13px] text-brand-text-muted flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking your code…
                  </p>
                ) : (
                  <button
                    onClick={() => void handleVerify(code)}
                    disabled={code.length < CODE_LENGTH}
                    className="btn-orange w-full rounded-lg py-2.5 text-[15px] disabled:opacity-60"
                  >
                    Verify &amp; sign in
                  </button>
                )}

                <div className="flex items-center gap-4 text-[13px]">
                  <button
                    onClick={() => {
                      setPhase("email");
                      setCode("");
                      setError(null);
                    }}
                    className="text-brand-text-muted hover:text-brand-text-secondary transition-colors"
                  >
                    Use a different email
                  </button>
                  <button
                    onClick={() => void handleSendCode(true)}
                    disabled={cooldown > 0 || isSending}
                    className="font-medium text-brand-blue-light hover:text-brand-blue transition-colors disabled:text-brand-text-muted disabled:hover:text-brand-text-muted"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="mt-8 pt-5 border-t border-dashed border-brand-navy-500/50 space-y-3">
            <p className="text-[11px] leading-relaxed text-brand-text-muted flex items-start gap-1.5">
              <MailCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              Don't have an account? Residents join through their community's invite — ask your
              HOA or property manager. This screen never signs anyone up.
            </p>
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
