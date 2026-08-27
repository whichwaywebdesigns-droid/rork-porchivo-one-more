import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FoamPeanuts from "@/components/FoamPeanuts";

/**
 * "Oops!" screen — shown when a user attempts to sign in without having
 * created an account first. Displays the brand logo, a friendly message,
 * and a back arrow to return to the login/home screen.
 * Styled as a sheet of paper nestled in foam peanuts on the kraft desk.
 */
const AuthFail = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="page-desk flex min-h-screen flex-col items-center justify-center px-6">
      {/* Paper sheet nestled in foam peanuts */}
      <div className="relative max-w-md w-full">
        <FoamPeanuts />
        <div className="paper-sheet relative px-8 sm:px-12 py-12 text-center">
          {/* Back arrow */}
          <Link
            to="/"
            className="absolute left-6 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--paper-bg)] border border-[var(--paper-border)] shadow-md transition-transform hover:scale-105"
            aria-label="Back to Home"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand-text-primary"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </Link>

          {/* Logo */}
          <div
            className="mb-8 transition-all duration-500 relative z-[1]"
            style={{
              transform: mounted ? "scale(1)" : "scale(0.8)",
              opacity: mounted ? 1 : 0,
            }}
          >
            <img
              src="/porchivo-icon-liquid-glass-512.png"
              alt="Porchivo"
              className="h-24 w-24 rounded-3xl shadow-lg mx-auto"
            />
          </div>

          {/* Message */}
          <div
            className="text-center transition-all duration-500 relative z-[1]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(30px)",
            }}
          >
            <div className="label-header mb-2">Delivery notice</div>
            <h1 className="mb-3 text-5xl font-extrabold tracking-tight text-brand-text-primary">
              Oops!
            </h1>
            <p className="mb-10 text-lg font-medium leading-relaxed text-brand-text-secondary">
              We couldn't find an account with that email.
              <br />
              You need to create an account first to sign in.
            </p>

            {/* Buttons */}
            <div className="flex flex-col items-center gap-4">
              <Link
                to="/"
                className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#3D2B1F] px-6 py-4 text-base font-bold text-[#FAF8F5] shadow-lg transition-transform hover:scale-105"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12 19-7-7 7-7" />
                  <path d="M19 12H5" />
                </svg>
                Back to Home
              </Link>

              <Link
                to="/download"
                className="flex items-center gap-2 px-6 py-3 text-base font-semibold text-brand-text-primary transition-colors hover:opacity-80"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" x2="19" y1="8" y2="14" />
                  <line x1="22" x2="16" y1="11" y2="11" />
                </svg>
                Download the App
              </Link>
            </div>

            {/* Support link */}
            <a
              href="mailto:support@porchivo.com?subject=Porchivo%20Support"
              className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-brand-text-muted transition-colors hover:text-brand-text-secondary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              Need help? Contact support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthFail;
