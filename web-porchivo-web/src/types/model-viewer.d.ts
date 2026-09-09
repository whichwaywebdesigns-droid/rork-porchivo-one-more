import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * JSX typing for the <model-viewer> custom element (@google/model-viewer).
 * Only the attributes this app actually sets are declared.
 */
type ModelViewerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  src?: string;
  alt?: string;
  poster?: string;
  "camera-orbit"?: string;
  "camera-controls"?: string;
  "auto-rotate"?: string;
  "rotation-per-second"?: string;
  "shadow-intensity"?: string;
  "shadow-softness"?: string;
  exposure?: string;
  "environment-image"?: string;
  "disable-zoom"?: string;
  "disable-pan"?: string;
  "interaction-prompt"?: string;
  "touch-action"?: string;
  "field-of-view"?: string;
  loading?: string;
  reveal?: string;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}

export {};
