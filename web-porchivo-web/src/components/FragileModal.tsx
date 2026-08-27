/**
 * FragileModal — reusable DECORATIVE wrapper styled as a fragile-package
 * warning notice ("Handle With Care"). Wrap any EXISTING modal content
 * (alerts, confirmations, form dialogs) without touching its logic.
 *
 * Visual-only module: the hazard bar, FRAGILE corner stamps, corner tape,
 * and "THIS SIDE UP" footer stamp are all `pointer-events: none` /
 * `aria-hidden` — every interactive child (buttons, links, forms) remains
 * fully functional and unchanged.
 *
 * Pair with your existing backdrop and tint it with
 * `rgba(212, 196, 168, 0.15)` (the `.fragile-backdrop-tint` helper) so the
 * dialog feels like it's sitting on cardboard under a warning light.
 *
 * Styles live in index.css under the `fragile-*` namespace (pure CSS — no
 * images/SVG; the hazard stripes are a repeating diagonal gradient).
 *
 * Usage:
 *   <FragileModal showTape>
 *     <h2>Important Account Update</h2>
 *     <p>Your payment method is about to expire.</p>
 *     ...existing buttons/handlers unchanged...
 *   </FragileModal>
 */

interface FragileModalProps {
  /** Packing-tape accent across the top edge, overlapping the hazard bar. Default false. */
  showTape?: boolean;
  /** Two red "FRAGILE" warehouse stamps (top-right + bottom-left). Default true. */
  showStamps?: boolean;
  /** Diagonal-stripe "Handle With Care" header bar. Default true. */
  showHazardBar?: boolean;
  /** Existing modal content — left untouched and fully interactive. */
  children: React.ReactNode;
}

export default function FragileModal({
  showTape = false,
  showStamps = true,
  showHazardBar = true,
  children,
}: FragileModalProps) {
  return (
    <div className="fragile-modal">
      {showTape && <span aria-hidden className="fragile-modal-tape" />}

      {/* Decorative caution-tape bar — not clickable */}
      {showHazardBar && (
        <div aria-hidden className="fragile-modal-hazard">
          <span className="fragile-modal-hazard-text">⚠ Handle With Care</span>
        </div>
      )}

      {showStamps && (
        <>
          <span aria-hidden className="fragile-stamp fragile-stamp-tr">
            Fragile
          </span>
          <span aria-hidden className="fragile-stamp fragile-stamp-bl">
            Fragile
          </span>
        </>
      )}

      {/* Content zone — children stay fully interactive here */}
      <div className="fragile-modal-body">
        <div className="fragile-modal-frame">{children}</div>
      </div>

      {/* Decorative directional stamp */}
      <span aria-hidden className="fragile-modal-sideup">This Side Up</span>
    </div>
  );
}
