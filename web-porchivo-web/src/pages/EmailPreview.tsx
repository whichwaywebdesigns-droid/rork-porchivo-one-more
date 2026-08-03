import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sun, Moon, Mail, Code, Eye, Copy, Check, ChevronRight, Smartphone, Monitor } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";
import { renderEmail, togglePreviewDark } from "@/lib/emailRenderer";
import { SAMPLE_EMAILS } from "@/lib/emailSamples";

type ViewMode = "visual" | "html";
type ThemeMode = "light" | "dark";
type DeviceMode = "desktop" | "mobile";

export default function EmailPreviewPage() {
  const [selectedId, setSelectedId] = useState<string>(SAMPLE_EMAILS[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>("visual");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const selected = useMemo(
    () => SAMPLE_EMAILS.find((e) => e.id === selectedId) ?? SAMPLE_EMAILS[0],
    [selectedId],
  );

  const { html, text } = useMemo(
    () => renderEmail(selected.template, { preview: true }),
    [selected],
  );

  // Write rendered HTML into the iframe
  const writeIframe = useCallback(
    (content: string) => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(content);
      doc.close();
      // Apply theme after write
      requestAnimationFrame(() => {
        togglePreviewDark(iframe, theme === "dark");
      });
    },
    [theme],
  );

  useEffect(() => {
    writeIframe(html);
  }, [html, writeIframe]);

  // Toggle theme in iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    togglePreviewDark(iframe, theme === "dark");
  }, [theme]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(viewMode === "html" ? html : text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [html, text, viewMode]);

  const iframeWidth = device === "mobile" ? 390 : "100%";

  return (
    <PageLayout>
      <SEOHead
        title={`Email Preview · ${BRAND.name}`}
        description="Preview branded Porchivo email templates in light and dark mode."
        canonical={`${BRAND.url}/email-preview`}
        robots="noindex, nofollow"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <BreadcrumbNav items={[{ label: "Email Preview", href: "/email-preview" }]} />

        {/* Header */}
        <div className="flex items-start gap-4 mt-6 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 flex-shrink-0">
            <Mail className="w-6 h-6 text-brand-blue-light" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-text-primary tracking-tight">
              Email Preview
            </h1>
            <p className="text-brand-text-muted mt-1.5 text-[15px] leading-relaxed">
              Branded email templates with light/dark mode and contact details.
              Every email includes the logo, CTA, Field Guide link, and support contact.
            </p>
          </div>
        </div>

        {/* Main layout: sidebar + preview */}
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* ── Template selector sidebar ── */}
          <aside className="lg:sticky lg:top-[84px] lg:self-start">
            <div className="rounded-2xl border border-brand-navy-500/40 bg-brand-navy-800/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-brand-text-muted font-semibold px-3 py-2">
                Templates
              </p>
              <nav className="flex flex-col gap-1">
                {SAMPLE_EMAILS.map((email) => {
                  const isActive = email.id === selectedId;
                  return (
                    <button
                      key={email.id}
                      onClick={() => setSelectedId(email.id)}
                      className={`group flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                        isActive
                          ? "bg-brand-blue/15 border border-brand-blue/30"
                          : "hover:bg-brand-navy-700/60 border border-transparent"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] font-semibold leading-tight ${
                          isActive ? "text-brand-blue-light" : "text-brand-text-primary"
                        }`}>
                          {email.label}
                        </p>
                        <p className="text-[12px] text-brand-text-muted mt-0.5 leading-snug truncate">
                          {email.description}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        isActive
                          ? "text-brand-blue-light translate-x-0.5"
                          : "text-brand-text-muted group-hover:translate-x-0.5"
                      }`} />
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ── Preview area ── */}
          <div className="min-w-0">
            {/* Toolbar */}
            <div className="rounded-2xl border border-brand-navy-500/40 bg-brand-navy-800/40 px-4 py-3 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Subject line */}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-brand-text-muted font-semibold">
                    Subject
                  </p>
                  <p className="text-sm font-medium text-brand-text-primary truncate">
                    {selected.subject}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* View toggle */}
                  <div className="flex items-center rounded-lg bg-brand-navy-900/60 border border-brand-navy-500/30 p-0.5">
                    <button
                      onClick={() => setViewMode("visual")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                        viewMode === "visual"
                          ? "bg-brand-blue/20 text-brand-blue-light"
                          : "text-brand-text-muted hover:text-brand-text-secondary"
                      }`}
                      aria-label="Visual preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Visual
                    </button>
                    <button
                      onClick={() => setViewMode("html")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                        viewMode === "html"
                          ? "bg-brand-blue/20 text-brand-blue-light"
                          : "text-brand-text-muted hover:text-brand-text-secondary"
                      }`}
                      aria-label="HTML source"
                    >
                      <Code className="w-3.5 h-3.5" />
                      HTML
                    </button>
                  </div>

                  {/* Theme toggle */}
                  <button
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-navy-900/60 border border-brand-navy-500/30 text-[12px] font-medium text-brand-text-muted hover:text-brand-text-secondary transition-all"
                    aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                  >
                    {theme === "light" ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-brand-orange-light" />
                        Light
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-brand-blue-light" />
                        Dark
                      </>
                    )}
                  </button>

                  {/* Device toggle (visual mode only) */}
                  {viewMode === "visual" && (
                    <div className="flex items-center rounded-lg bg-brand-navy-900/60 border border-brand-navy-500/30 p-0.5">
                      <button
                        onClick={() => setDevice("desktop")}
                        className={`flex items-center px-2 py-1.5 rounded-md transition-all ${
                          device === "desktop"
                            ? "bg-brand-blue/20 text-brand-blue-light"
                            : "text-brand-text-muted hover:text-brand-text-secondary"
                        }`}
                        aria-label="Desktop view"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDevice("mobile")}
                        className={`flex items-center px-2 py-1.5 rounded-md transition-all ${
                          device === "mobile"
                            ? "bg-brand-blue/20 text-brand-blue-light"
                            : "text-brand-text-muted hover:text-brand-text-secondary"
                        }`}
                        aria-label="Mobile view"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Copy button */}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-navy-900/60 border border-brand-navy-500/30 text-[12px] font-medium text-brand-text-muted hover:text-brand-text-secondary transition-all"
                    aria-label={copied ? "Copied" : "Copy to clipboard"}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Preview surface */}
            <div
              className="rounded-2xl border border-brand-navy-500/40 overflow-hidden"
              style={{
                background: theme === "dark" ? "#0D1117" : "#F5F7FA",
              }}
            >
              {viewMode === "visual" ? (
                <div
                  className="flex justify-center items-start p-4 sm:p-6 transition-all"
                  style={{ minHeight: "500px" }}
                >
                  <div
                    style={{ width: iframeWidth, maxWidth: "100%" }}
                    className="transition-all duration-300"
                  >
                    <iframe
                      ref={iframeRef}
                      title="Email preview"
                      sandbox="allow-same-origin"
                      className="w-full rounded-lg border-0"
                      style={{
                        height: "600px",
                        background: theme === "dark" ? "#0D1117" : "#F5F7FA",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-6 overflow-auto" style={{ maxHeight: "600px" }}>
                  <pre className="text-[12px] leading-relaxed text-brand-text-secondary font-mono whitespace-pre-wrap break-all">
                    {html}
                  </pre>
                </div>
              )}
            </div>

            {/* Contact details summary */}
            <div className="mt-4 rounded-xl border border-brand-navy-500/30 bg-brand-navy-800/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-brand-text-muted font-semibold mb-2">
                Included in every email
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
                <span className="flex items-center gap-1.5 text-brand-text-secondary">
                  <Mail className="w-3.5 h-3.5 text-brand-text-muted" />
                  <a
                    href={`mailto:${BRAND.supportEmail}`}
                    className="text-brand-blue-light hover:underline"
                  >
                    {BRAND.supportEmail}
                  </a>
                </span>
                <span className="flex items-center gap-1.5 text-brand-text-secondary">
                  <span className="text-brand-text-muted">Website:</span>
                  <a
                    href={BRAND.url}
                    className="text-brand-blue-light hover:underline"
                  >
                    porchivo.com
                  </a>
                </span>
                <span className="flex items-center gap-1.5 text-brand-text-secondary">
                  <span className="text-brand-text-muted">Guide:</span>
                  <a
                    href={`${BRAND.url}/guide`}
                    className="text-brand-blue-light hover:underline"
                  >
                    porchivo.com/guide
                  </a>
                </span>
              </div>
            </div>

            {/* Dark mode note */}
            <p className="mt-3 text-[12px] text-brand-text-muted leading-relaxed">
              Dark mode uses <code className="text-brand-text-secondary bg-brand-navy-900/50 px-1 py-0.5 rounded text-[11px]">@media (prefers-color-scheme: dark)</code>{" "}
              with <code className="text-brand-text-secondary bg-brand-navy-900/50 px-1 py-0.5 rounded text-[11px]">color-scheme</code> meta tags.
              Supported by Apple Mail, iOS Mail, and Outlook.com dark. Gmail and desktop Outlook fall back to inline light styles.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
