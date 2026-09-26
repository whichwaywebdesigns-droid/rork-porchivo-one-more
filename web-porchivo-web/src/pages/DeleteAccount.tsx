import { Link, useLocation } from "react-router-dom";
import { Mail, ShieldCheck, Trash2, Timer } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";

/**
 * Public account & data deletion page — required by Google Play's Data safety
 * policy ("Account deletion" URL). Serves real, crawlable content at both
 * /delete-account and /data-deletion so Play's URL verification never sees a
 * soft-404 from the SPA fallback.
 */

function useVariant() {
  const { pathname } = useLocation();
  const isDataVariant = pathname.startsWith("/data-deletion");
  return {
    isDataVariant,
    canonical: isDataVariant
      ? "https://www.porchivo.com/data-deletion"
      : "https://www.porchivo.com/delete-account",
  };
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">
        {n}
      </span>
      <span className="pt-0.5 text-brand-text-secondary leading-relaxed">{children}</span>
    </li>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-brand-navy-500/25 bg-white/85 dark:bg-brand-navy-800/60 p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-bold text-brand-text-primary mb-4">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DeleteAccount() {
  const { isDataVariant, canonical } = useVariant();

  return (
    <PageLayout>
      <SEOHead
        title={
          isDataVariant
            ? "Delete Your Porchivo Data — Porchivo"
            : "Delete Your Porchivo Account — Porchivo"
        }
        description="Delete your Porchivo account and personal data at any time — instantly from the app, or by email request. No account or sign-in required to view this page."
        canonical={canonical}
      />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <BreadcrumbNav
          items={[
            { label: "Home", href: "/" },
            {
              label: isDataVariant ? "Delete Your Data" : "Delete Your Account",
              href: canonical,
            },
          ]}
        />

        <h1 className="text-4xl font-bold text-brand-text-primary mb-3">
          {isDataVariant ? "Delete Your Porchivo Data" : "Delete Your Porchivo Account"}
        </h1>
        <p className="text-lg text-brand-text-secondary mb-8 leading-relaxed">
          You can delete your Porchivo account and all associated personal data at any
          time — no questions asked. Deleting your account also deletes your data; if
          you want only certain data removed while keeping your account, use the data
          deletion request below. This page is public and does not require you to sign in.
        </p>

        <div className="space-y-6">
          <Card icon={<Trash2 className="h-5 w-5 text-brand-blue" />} title="Option 1 — Delete instantly from the app (recommended)">
            <ol className="space-y-3">
              <Step n={1}>
                Open the <strong>Porchivo</strong> app on your phone and sign in.
              </Step>
              <Step n={2}>
                Go to <strong>Profile → Settings → Delete Account</strong>.
              </Step>
              <Step n={3}>
                Type <strong>DELETE</strong> to confirm. Your account is deactivated
                immediately and scheduled for deletion.
              </Step>
            </ol>
          </Card>

          <Card icon={<Mail className="h-5 w-5 text-brand-blue" />} title="Option 2 — Delete by email request">
            <p className="text-brand-text-secondary leading-relaxed mb-3">
              Send an email to{" "}
              <a
                href={`mailto:${BRAND.supportEmail}?subject=Account%20deletion%20request`}
                className="font-semibold text-brand-blue underline underline-offset-2"
              >
                {BRAND.supportEmail}
              </a>{" "}
              with the subject <strong>"Account deletion request"</strong>. Please write
              from the email address registered to your Porchivo account and include the
              name of your community so we can locate it.
            </p>
            <p className="text-brand-text-secondary leading-relaxed">
              For a <strong>data deletion request only</strong> (delete certain data but
              keep your account), use the same address with the subject{" "}
              <strong>"Data deletion request"</strong> and describe which data you want
              removed.
            </p>
          </Card>

          <Card icon={<Timer className="h-5 w-5 text-brand-blue" />} title="What happens next">
            <ul className="list-disc pl-5 space-y-2 text-brand-text-secondary leading-relaxed">
              <li>Your account is deactivated immediately after confirmation.</li>
              <li>
                Personal data — profile, contact details, shipments, packages, photos,
                notifications, messages, and community memberships — is permanently
                deleted within <strong>30 days</strong>.
              </li>
              <li>
                Deleted data is removed from active systems and backups on the same
                schedule.
              </li>
              <li>
                We may retain the minimum records required by law (for example payment
                or tax records), as described in our{" "}
                <Link to="/privacy" className="text-brand-blue underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </li>
            </ul>
          </Card>

          <Card icon={<ShieldCheck className="h-5 w-5 text-brand-blue" />} title="Questions?">
            <p className="text-brand-text-secondary leading-relaxed">
              Contact us any time at{" "}
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="font-semibold text-brand-blue underline underline-offset-2"
              >
                {BRAND.supportEmail}
              </a>
              . Porchivo is operated by WhichWay Web Labs LLC.
            </p>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
