import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * "Oops!" screen — shown when a user attempts to sign in without having
 * created an account first. Displays the brand logo, a friendly message,
 * and a back arrow to return to the login/home screen.
 */
const AuthFail = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#F5F7FA] via-[#EBF0F8] to-[#DCE6F5] px-6 dark:from-[#0D1B3E] dark:via-[#132040] dark:to-[#1A2B52]">
      {/* Back arrow */}
      <Link
        to="/"
        className="absolute left-6 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-md transition-transform hover:scale-105 dark:bg-white/10"
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
          className="text-[#1B3A6B] dark:text-[#4A8FE8]"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
      </Link>

      {/* Logo */}
      <div
        className="mb-8 transition-all duration-500"
        style={{
          transform: mounted ? "scale(1)" : "scale(0.8)",
          opacity: mounted ? 1 : 0,
        }}
      >
        <img
          src="/porchivo-icon.png"
          alt="Porchivo"
          className="h-28 w-28 rounded-3xl shadow-lg"
        />
      </div>

      {/* Message */}
      <div
        className="max-w-md text-center transition-all duration-500"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(30px)",
        }}
      >
        <h1 className="mb-3 text-5xl font-extrabold tracking-tight text-[#1B3A6B] dark:text-[#E8EEF8]">
          Oops!
        </h1>
        <p className="mb-10 text-lg font-medium leading-relaxed text-[#1B3A6B]/65 dark:text-[#E8EEF8]/65">
          We couldn't find an account with that email.
          <br />
          You need to create an account first to sign in.
        </p>

        {/* Buttons */}
        <div className="flex flex-col items-center gap-4">
          <Link
            to="/"
            className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#1B3A6B] px-6 py-4 text-base font-bold text-white shadow-lg transition-transform hover:scale-105 dark:bg-[#4A8FE8]"
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
            className="flex items-center gap-2 px-6 py-3 text-base font-semibold text-[#1B3A6B] transition-colors hover:text-[#2C5299] dark:text-[#4A8FE8]"
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
          className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-[#1B3A6B]/50 transition-colors hover:text-[#1B3A6B]/70 dark:text-[#E8EEF8]/40"
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
  );
};

export default AuthFail;
