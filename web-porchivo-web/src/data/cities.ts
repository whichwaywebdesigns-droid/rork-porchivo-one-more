/**
 * Porchivo — City landing pages data.
 *
 * Each entry powers one pre-rendered city page (see src/pages/CityLanding.tsx).
 * City-specific fields (theftNote, hoaHook) are written per city during the
 * local content pass — sections render only when their field is non-empty, so
 * no placeholder or invented local facts ever ship.
 */
export type CityPage = {
  slug: string;
  name: string;
  state: string;
  hook: string;
  theftNote: string;
  neighborhoods: string[];
  hoaHook: string;
};

export const cities: CityPage[] = [
  {
    slug: "evansville-in",
    name: "Evansville",
    state: "IN",
    hook: "Package protection built for Evansville porches.",
    theftNote: "", // content pass: 1–2 sentences re: local porch theft
    neighborhoods: ["McCutchanville", "Haynie's Corner", "North Park"],
    hoaHook: "",
  },
];
