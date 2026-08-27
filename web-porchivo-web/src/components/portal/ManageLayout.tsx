/**
 * ManageLayout — auth/org gate + kraft-themed chrome for every /manage route.
 *
 * - No session            → redirect to /manage/login
 * - Session, non-staff    → friendly access-denied panel
 * - Staff member          → portal shell (top bar, org name, nav tabs, sign out)
 */

import { NavLink, Link, Outlet, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  KeyRound,
  Megaphone,
  Wrench,
  CreditCard,
  LogOut,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/portalTypes";
import { usePortalAuth } from "@/providers/PortalAuthProvider";
import { usePortalOrg } from "@/hooks/usePortalOrg";
import { BRAND } from "@/config/brand";

const NAV_ITEMS = [
  { to: "/manage", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/manage/members", label: "Pending members", icon: Users },
  { to: "/manage/invite-code", label: "Invite code", icon: KeyRound },
  { to: "/manage/announcements", label: "Announcements", icon: Megaphone },
  { to: "/manage/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/manage/billing", label: "Billing", icon: CreditCard },
];

function CenterPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-desk min-h-screen flex items-center justify-center px-4">
      <div className="paper-sheet w-full max-w-md rounded-xl px-8 py-10 text-center">{children}</div>
    </div>
  );
}

export default function ManageLayout() {
  const { session, email, isLoadingSession, signOut } = usePortalAuth();
  const { membership, org, isLoading: isLoadingOrg } = usePortalOrg();

  if (!isSupabaseConfigured) {
    return (
      <CenterPanel>
        <ShieldAlert className="w-10 h-10 text-brand-orange mx-auto mb-4" />
        <h1 className="text-lg font-bold text-brand-text-primary mb-2">Portal not configured</h1>
        <p className="text-sm text-brand-text-secondary leading-relaxed">
          Supabase environment variables are missing from this deployment. Set{" "}
          <code className="text-[12px] bg-brand-navy-900 px-1 py-0.5 rounded">EXPO_PUBLIC_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="text-[12px] bg-brand-navy-900 px-1 py-0.5 rounded">EXPO_PUBLIC_SUPABASE_ANON_KEY</code>.
        </p>
      </CenterPanel>
    );
  }

  // Session restore in progress → spinner, never redirect mid-restore.
  // Org lookup only meaningful once a session exists.
  const isResolving = isLoadingSession || (Boolean(session) && isLoadingOrg);
  if (isResolving) {
    return (
      <div className="page-desk min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/manage/login" replace />;

  if (!membership || !org) {
    return (
      <CenterPanel>
        <ShieldAlert className="w-10 h-10 text-brand-orange mx-auto mb-4" />
        <h1 className="text-lg font-bold text-brand-text-primary mb-2">No community admin access</h1>
        <p className="text-sm text-brand-text-secondary leading-relaxed mb-6">
          {email ?? "This account"} isn't an admin, board member, or staff on any Porchivo community.
          Ask your HOA administrator to add you to the community first.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-brand-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to site
          </Link>
          <button
            onClick={() => void signOut()}
            className="text-sm font-medium text-brand-blue-light hover:text-brand-blue transition-colors"
          >
            Sign out
          </button>
        </div>
      </CenterPanel>
    );
  }

  return (
    <div className="page-desk min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-brand-navy-800/95 backdrop-blur border-b border-brand-navy-500/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="label-header whitespace-nowrap">Porchivo Manager</span>
            <span className="hidden sm:block text-sm font-semibold text-brand-text-primary truncate">
              {org.name}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-brand-navy-900 border border-brand-navy-500/60 text-[11px] font-semibold text-brand-text-muted">
              {ROLE_LABELS[membership.role]}
            </span>
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 text-[13px] text-brand-text-muted hover:text-brand-text-secondary transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto pb-1.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              {...("end" in rest ? { end: true } : {})}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-brand-orange/12 text-brand-orange"
                    : "text-brand-text-muted hover:text-brand-text-secondary"
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Page body */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Outlet context={{ org }} />
      </main>

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-8 pt-2">
        <p className="text-[11px] text-brand-text-muted">
          Manager portal · {BRAND.name} ·{" "}
          <Link to="/" className="hover:text-brand-text-secondary transition-colors">
            back to porchivo.com
          </Link>
        </p>
      </footer>
    </div>
  );
}
