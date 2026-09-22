/**
 * ManageLayout — auth/org gate + kraft-themed chrome for every /manage route.
 *
 * - No session            → redirect to /manage/login
 * - Session, non-staff    → friendly access-denied panel
 * - Staff member          → portal shell
 *     · lg+  : slim left icon rail that expands on hover/focus (nav + user menu)
 *     · < lg : today's optimized top bar with section tabs (unchanged)
 */

import { NavLink, Link, Outlet, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  KeyRound,
  Braces,
  Megaphone,
  Wrench,
  CreditCard,
  FolderOpen,
  CalendarClock,
  Receipt,
  LogOut,
  ShieldAlert,
  ArrowLeft,
  Download,
  MonitorCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/portalTypes";
import { usePortalAuth } from "@/providers/PortalAuthProvider";
import { usePortalOrg } from "@/hooks/usePortalOrg";
import { BRAND } from "@/config/brand";
import { usePwaInstall } from "@/lib/pwa";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/manage", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/manage/members", label: "Pending members", icon: Users },
  { to: "/manage/invite-code", label: "Invite code", icon: KeyRound },
  { to: "/manage/announcements", label: "Announcements", icon: Megaphone },
  { to: "/manage/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/manage/documents", label: "Documents", icon: FolderOpen },
  { to: "/manage/amenities", label: "Amenities", icon: CalendarClock },
  { to: "/manage/ledger", label: "Ledger", icon: Receipt },
  { to: "/manage/api", label: "API", icon: Braces },
  { to: "/manage/billing", label: "Billing", icon: CreditCard },
];

function CenterPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-desk min-h-screen flex items-center justify-center px-4">
      <div className="paper-sheet w-full max-w-md rounded-xl px-8 py-10 text-center">{children}</div>
    </div>
  );
}

/** Shared arrow-key roving across nav links (links stay Tab-reachable). */
function handleNavArrowKeys(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
  const tabs = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>("a[href]"),
  ).filter((el) => el.offsetParent !== null);
  if (tabs.length === 0) return;
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current === -1) return;
  e.preventDefault();
  const next =
    e.key === "ArrowRight"
      ? (current + 1) % tabs.length
      : e.key === "ArrowLeft"
        ? (current - 1 + tabs.length) % tabs.length
        : e.key === "Home"
          ? 0
          : tabs.length - 1;
  tabs[next].focus();
}

interface RailNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

function RailNavItem({ to, label, icon: Icon, end }: RailNavItemProps) {
  return (
    <NavLink
      to={to}
      {...(end ? { end: true } : {})}
      title={label}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 h-10 text-[13px] font-medium whitespace-nowrap transition-colors ${
          isActive
            ? "bg-brand-orange/12 text-brand-orange"
            : "text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-navy-500/30"
        }`
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span className="opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 transition-opacity duration-150">
        {label}
      </span>
    </NavLink>
  );
}

/** Bottom-of-rail user menu: identity, install Porchivo (when available), sign out. */
function RailUserMenu({ email, roleLabel, onSignOut }: {
  email: string;
  roleLabel: string;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const initials = (email[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="mx-1 mb-1 flex items-center gap-3 rounded-lg px-3 h-10 text-left hover:bg-brand-navy-500/30 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-light"
          aria-label="Account menu"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue text-[12px] font-bold text-white">
            {initials}
          </span>
          <span className="text-[12px] font-medium text-brand-text-secondary whitespace-nowrap opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 transition-opacity duration-150">
            Account
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate text-[13px] font-semibold">{email}</p>
          <span className="inline-flex px-2 py-0.5 rounded-full bg-brand-navy-900 border border-brand-navy-500/60 text-[11px] font-semibold text-brand-text-muted">
            {roleLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canInstall && !isInstalled && (
          <DropdownMenuItem onClick={() => void promptInstall()}>
            <Download className="w-4 h-4" aria-hidden="true" />
            {t("pwa.install.button")}
          </DropdownMenuItem>
        )}
        {isInstalled && (
          <DropdownMenuItem disabled>
            <MonitorCheck className="w-4 h-4" aria-hidden="true" />
            {t("pwa.install.installedShort")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={onSignOut}
          className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

  const roleLabel = ROLE_LABELS[membership.role];

  return (
    <div className="page-desk min-h-screen">
      {/* Skip to main content — keyboard / screen-reader accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-orange focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* ── Desktop (lg+): hover-expand icon rail ── */}
      <aside
        aria-label="Manager portal sections"
        className="group/rail hidden lg:flex fixed inset-y-0 left-0 z-40 w-16 hover:w-60 focus-within:w-60 transition-[width] duration-200 ease-out flex-col bg-brand-navy-800/95 backdrop-blur border-r border-brand-navy-500/60 overflow-hidden"
      >
        {/* Brand + org */}
        <div className="h-14 px-3.5 flex items-center gap-3 border-b border-brand-navy-500/60 flex-shrink-0">
          <img
            src="/porchivo-icon-liquid-glass-512.png"
            alt=""
            aria-hidden="true"
            className="w-8 h-8 rounded-lg flex-shrink-0"
          />
          <div className="min-w-0 opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 transition-opacity duration-150">
            <p className="label-header text-[12px] whitespace-nowrap leading-tight">Porchivo Manager</p>
            <p className="text-[11px] text-brand-text-muted truncate whitespace-nowrap leading-tight max-w-[180px]">
              {org.name}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav
          aria-label="Manager portal sections"
          onKeyDown={handleNavArrowKeys}
          className="flex-1 px-2 py-2.5 space-y-1 overflow-y-auto overflow-x-hidden"
        >
          {NAV_ITEMS.map(({ to, label, icon, ...rest }) => (
            <RailNavItem key={to} to={to} label={label} icon={icon} {...("end" in rest ? { end: true } : {})} />
          ))}
        </nav>

        {/* Account */}
        <div className="px-1.5 pb-3 border-t border-brand-navy-500/60 pt-2 flex-shrink-0">
          <RailUserMenu email={email ?? ""} roleLabel={roleLabel} onSignOut={() => void signOut()} />
        </div>
      </aside>

      {/* ── Mobile / tablet (< lg): today's top bar + tabs, unchanged ── */}
      <header className="lg:hidden sticky top-0 z-20 bg-brand-navy-800/95 backdrop-blur border-b border-brand-navy-500/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="label-header whitespace-nowrap">Porchivo Manager</span>
            <span className="hidden sm:block text-sm font-semibold text-brand-text-primary truncate">
              {org.name}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-brand-navy-900 border border-brand-navy-500/60 text-[11px] font-semibold text-brand-text-muted">
              {roleLabel}
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

        <nav
          aria-label="Manager portal sections"
          className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto pb-1.5"
          onKeyDown={handleNavArrowKeys}
        >
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

      {/* Page body — wider, denser content area for desktop monitors */}
      <div className="lg:pl-16">
        <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 py-8 outline-none">
          <Outlet context={{ org }} />
        </main>

        <footer className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 pt-2">
          <p className="text-[11px] text-brand-text-muted">
            Manager portal · {BRAND.name} ·{" "}
            <Link to="/" className="hover:text-brand-text-secondary transition-colors">
              back to porchivo.com
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
