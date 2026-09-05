# Porchivo — Textos para capturas de pantalla (es-419 / es-MX)

Draft for localized screenshot renders. Source of truth: `screenshots/deck.json`
(`headlines.es-MX` and `headlines.es-419` — identical copy; Play uses es-419,
App Store es-MX). Headline keys are the internal slide labels and stay English
so the renderer keeps mapping slides by label.

## Headlines (EN → ES)

| Slide label (internal) | EN headline | ES headline | Longest ES line |
|---|---|---|---|
| Porch Risk Score | Know Your Risk / Before It Arrives | Conoce el riesgo / antes de que llegue | 19 |
| Package Tracking | Every Package / Tracked | Cada paquete / bajo control | 12 |
| Community Hub | Your HOA / Reimagined | Tu condominio / reinventado | 13 |
| Maintenance Requests | Submit Track / Resolved | Mantenimiento / sin pendientes | 14 |
| Admin Dashboard | Built for / Property Managers | Hecho para / administradores | 15 |

Length check: longest English line is "Property Managers" (17 chars) at the
108px headline font. All ES lines are ≤19; "antes de que llegue" is the only
one longer than the EN maximum — if the renderer clips it, fallback:
"antes de que llegue" → "antes de que llegue" (keep) or shorten slide 1 to
"Conoce el riesgo / al instante".

## Labels (upload ordering / console display — internal, not user-facing)

| EN label | ES label |
|---|---|
| Porch Risk Score | Evaluación de riesgo |
| Package Tracking | Rastreo de paquetes |
| Community Hub | Centro comunitario |
| Maintenance Requests | Solicitudes de mantenimiento |
| Admin Dashboard | Panel de administración |

## Glossary compliance

- HOA → condominio (never "HOA" in Spanish copy)
- property manager → administrador
- risk scoring → evaluación de riesgo (label only; headline avoids jargon)
- "Porch Partners" never translated (not present in headlines)
- No dues-collection ("cobro") claims; no Porch Partners caps; no LFPDPPP audit claims

## Outstanding before these can ship

1. **Re-render** the 5 iPhone + 5 iPad screenshots (and Play phone set) with
   the `es-MX`/`es-419` headline blocks — renderer consumes `deck.json`.
2. **Feature graphic (1024×500)**: verify whether it carries baked English
   text; if so it needs an es-419 variant for Play.
3. **In-app UI inside the mockups stays English** until in-app es-MX
   localization ships — normal for staged localization; flag to consultant.
4. **Upload**: Play es-419 screenshot set can go up any time via the es-419
   listing. Apple es-MX screenshots are version-level localizations → blocked
   while 1.0.7 is WAITING_FOR_REVIEW; upload right after approval together
   with the staged es-MX text in `metadata/es-MX/appstore-es-MX.json`.
