import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * HTML shell for the web export (deployed under the marketing site's /app
 * subpath). Adds PWA install support (manifest + iOS meta tags) on top of the
 * expo-router defaults so "Add to Home Screen" launches full-screen.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <ScrollViewStyleReset />

        <link rel="manifest" href="/app/manifest.webmanifest" />
        <meta name="theme-color" content="#102040" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Porchivo" />
        <link rel="apple-touch-icon" href="/app/app-icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
