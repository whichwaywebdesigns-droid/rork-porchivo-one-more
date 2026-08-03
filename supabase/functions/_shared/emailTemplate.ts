// @ts-nocheck — Deno runtime
//
// Branded Porchivo email template. Wraps body content in a consistent,
// email-client-safe HTML shell (inline styles, table layout) and a matching
// plain-text version. Supports light + dark mode via prefers-color-scheme,
// includes contact details in the footer, and every email links to the
// hosted Field Guide at porchivo.com/guide.
//
// Usage:
//   import { renderEmail } from '../_shared/emailTemplate.ts';
//   const { html, text } = renderEmail({
//     heading: 'Welcome to Porchivo',
//     bodyHtml: '<p>Your account is ready.</p>',
//     bodyText: 'Your account is ready.',
//   });
//   // Preview mode — returns HTML without the full document shell for iframe rendering:
//   const { html } = renderEmail({ ... }, { preview: true });

const GUIDE_URL = 'https://porchivo.com/guide';
const LOGO_URL = 'https://porchivo.com/porchivo-icon.png';
const SUPPORT_EMAIL = 'support@porchivo.com';
const WEBSITE_URL = 'https://porchivo.com';

// Porchivo brand palette — sourced from expo/constants/theme.ts light theme
const BRAND_NAVY = '#1A2B4A';
const BRAND_ACCENT = '#3A7BD5';
const BRAND_ORANGE = '#E8622A';
const BRAND_CANVAS = '#F5F7FA';
const BRAND_SURFACE = '#FFFFFF';

// Dark mode palette
const DARK_CANVAS = '#0D1117';
const DARK_SURFACE = '#161B22';
const DARK_TEXT = '#E6EDF3';
const DARK_TEXT_MUTED = '#8B949E';
const DARK_HEADING = '#F0F6FC';
const DARK_BORDER = '#30363D';
const DARK_ACCENT_HOVER = '#5A9BF5';

export interface RenderEmailOptions {
  /** Large headline at the top of the email body. */
  heading: string;
  /** Main content as HTML (already escaped/trusted markup). */
  bodyHtml: string;
  /** Main content as plain text (for the text/plain part). */
  bodyText: string;
  /** Optional primary call-to-action button. */
  cta?: { label: string; url: string } | null;
}

export interface RenderEmailMeta {
  /** When true, wraps output in a preview-safe document with explicit dark/light classes for iframe rendering. */
  preview?: boolean;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export function renderEmail(opts: RenderEmailOptions, meta?: RenderEmailMeta): RenderedEmail {
  const year = new Date().getFullYear();
  const previewMode = meta?.preview ?? false;

  const ctaHtml = opts.cta
    ? `<tr><td style="padding:8px 0 24px;">
         <a href="${opts.cta.url}" class="porch-cta" style="display:inline-block;background:${BRAND_ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:10px;mso-hide:all;">${opts.cta.label}</a>
         <!--[if mso]><div style="text-align:left;"><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${opts.cta.url}" style="height:48px;v-text-anchor:middle;width:${Math.max(120, opts.cta.label.length * 12)}px;" arcsize="10%" fillcolor="${BRAND_ACCENT}" stroke="f"><w:anchorlock/><center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:600;">${opts.cta.label}</center></v:roundrect></div><![endif]-->
       </td></tr>`
    : '';

  // Dark-mode CSS: injected in <head> so email clients that support prefers-color-scheme
  // (Apple Mail, iOS Mail, Outlook.com dark) can override inline styles. Gmail and most
  // desktop Outlook do NOT support this — inline styles remain the source of truth for them.
  const darkModeCss = `
  <style type="text/css">
  /* ---- Dark mode overrides (email-client-safe) ---- */
  @media (prefers-color-scheme: dark) {
    .porch-body { background-color: ${DARK_CANVAS} !important; }
    .porch-canvas { background-color: ${DARK_CANVAS} !important; }
    .porch-card { background-color: ${DARK_SURFACE} !important; }
    .porch-heading { color: ${DARK_HEADING} !important; }
    .porch-body-text { color: ${DARK_TEXT} !important; }
    .porch-body-text a { color: ${BRAND_ACCENT} !important; }
    .porch-footer { border-top-color: ${DARK_BORDER} !important; }
    .porch-footer-text { color: ${DARK_TEXT_MUTED} !important; }
    .porch-footer-link { color: ${DARK_TEXT_MUTED} !important; }
    .porch-footer-guide { color: ${DARK_TEXT_MUTED} !important; }
    .porch-footer-guide a { color: ${BRAND_ACCENT} !important; }
    .porch-cta {
      background-color: ${DARK_ACCENT_HOVER} !important;
    }
    .porch-contact-label { color: ${DARK_TEXT_MUTED} !important; }
    .porch-contact-link { color: ${BRAND_ACCENT} !important; }
    /* Apple Mail / iOS: force dark background on the whole email body */
    body { background-color: ${DARK_CANVAS} !important; }
  }
  /* Preview-mode toggle: when .porch-preview-dark is on <html>, force dark styles */
  ${previewMode ? `
  .porch-preview-dark .porch-body { background-color: ${DARK_CANVAS} !important; }
  .porch-preview-dark .porch-canvas { background-color: ${DARK_CANVAS} !important; }
  .porch-preview-dark .porch-card { background-color: ${DARK_SURFACE} !important; }
  .porch-preview-dark .porch-heading { color: ${DARK_HEADING} !important; }
  .porch-preview-dark .porch-body-text { color: ${DARK_TEXT} !important; }
  .porch-preview-dark .porch-body-text a { color: ${BRAND_ACCENT} !important; }
  .porch-preview-dark .porch-footer { border-top-color: ${DARK_BORDER} !important; }
  .porch-preview-dark .porch-footer-text { color: ${DARK_TEXT_MUTED} !important; }
  .porch-preview-dark .porch-footer-link { color: ${DARK_TEXT_MUTED} !important; }
  .porch-preview-dark .porch-footer-guide { color: ${DARK_TEXT_MUTED} !important; }
  .porch-preview-dark .porch-footer-guide a { color: ${BRAND_ACCENT} !important; }
  .porch-preview-dark .porch-cta { background-color: ${DARK_ACCENT_HOVER} !important; }
  .porch-preview-dark .porch-contact-label { color: ${DARK_TEXT_MUTED} !important; }
  .porch-preview-dark .porch-contact-link { color: ${BRAND_ACCENT} !important; }
  .porch-preview-dark body { background-color: ${DARK_CANVAS} !important; }
  ` : ''}
  </style>`;

  // Contact details block for the footer
  const contactHtml = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
            <tr>
              <td class="porch-contact-label" style="font-size:12px;line-height:1.6;color:#999999;">
                <a href="mailto:${SUPPORT_EMAIL}" class="porch-contact-link" style="color:${BRAND_ACCENT};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
                &nbsp;&middot;&nbsp;
                <a href="${WEBSITE_URL}" class="porch-contact-link" style="color:${BRAND_ACCENT};text-decoration:none;font-weight:600;">porchivo.com</a>
              </td>
            </tr>
          </table>`;

  // In preview mode, add both classes so the consumer can toggle dark by
  // adding/removing .porch-preview-dark on <html> via JS in their iframe.
  const htmlClass = previewMode ? ' class="porch-preview-root porch-preview-dark"' : '';
  const html = `<!DOCTYPE html>
<html lang="en"${htmlClass}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${opts.heading}</title>
${darkModeCss}
</head>
<body class="porch-body" style="margin:0;padding:0;background:${BRAND_CANVAS};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="porch-canvas" style="background:${BRAND_CANVAS};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="porch-card" style="max-width:560px;background:${BRAND_SURFACE};border-radius:16px;overflow:hidden;">
        <tr><td style="background:${BRAND_NAVY};padding:28px 32px;text-align:center;">
          <a href="${WEBSITE_URL}" style="text-decoration:none;display:inline-block;">
            <img src="${LOGO_URL}" alt="Porchivo" width="48" height="48" style="display:block;width:48px;height:48px;border:0;outline:none;" />
          </a>
        </td></tr>
        <tr><td style="padding:32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td class="porch-heading" style="font-size:24px;font-weight:700;color:${BRAND_NAVY};padding-bottom:16px;">${opts.heading}</td></tr>
            <tr><td class="porch-body-text" style="font-size:16px;line-height:1.6;color:#333333;padding-bottom:24px;">${opts.bodyHtml}</td></tr>
            ${ctaHtml}
          </table>
        </td></tr>
        <tr><td class="porch-footer" style="border-top:1px solid #ECECEC;padding:24px 32px;">
          <p class="porch-footer-guide" style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#666666;">
            New to Porchivo? The <a href="${GUIDE_URL}" style="color:${BRAND_ACCENT};font-weight:600;text-decoration:none;">Porchivo Field Guide</a> walks you through everything you need — nothing you don't.
          </p>
          <p class="porch-footer-text" style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#999999;">
            <a href="${GUIDE_URL}" class="porch-footer-link" style="color:#999999;text-decoration:underline;">porchivo.com/guide</a> · &copy; ${year} Porchivo
          </p>
          ${contactHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const ctaText = opts.cta ? `\n\n${opts.cta.label}: ${opts.cta.url}` : '';
  const text =
    `${opts.heading}\n\n${opts.bodyText}${ctaText}\n\n` +
    `New to Porchivo? The Porchivo Field Guide walks you through everything you need — nothing you don't:\n${GUIDE_URL}\n\n` +
    `Contact: ${SUPPORT_EMAIL} · ${WEBSITE_URL}\n` +
    `© ${year} Porchivo`;

  return { html, text };
}
