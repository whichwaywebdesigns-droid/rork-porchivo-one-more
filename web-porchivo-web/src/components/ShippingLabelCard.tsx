/**
 * ShippingLabelCard — reusable DECORATIVE container styled as a physical
 * shipping label applied to a box.
 *
 * Visual-only module: every decorative layer (tape, fragile stamp, badge,
 * barcode) is `pointer-events: none` / `aria-hidden`, so any interactive
 * children (buttons, links, forms) remain fully functional and unchanged.
 *
 * Styles live in index.css under the `ship-label-*` namespace (no external
 * assets — the barcode is pure CSS repeating-linear-gradient).
 */

export type ShippingLabelPriority = "PRIORITY" | "STANDARD" | "CUSTOM";

interface ShippingLabelCardProps {
  /** Header badge tone. Omit for no badge. */
  priority?: ShippingLabelPriority;
  /** Shows the barcode strip + monospace tracking line. Omit to hide entirely. */
  trackingNumber?: string;
  /** Packing-tape accent across the top edge. Default false. */
  showTape?: boolean;
  /** Red "FRAGILE" rubber-stamp overlay. Default false. */
  isFragile?: boolean;
  /** Existing content to wrap — left untouched and fully interactive. */
  children: React.ReactNode;
}

const BADGE_BG: Record<ShippingLabelPriority, string> = {
  PRIORITY: "#3D2B1F",
  STANDARD: "#8B7355",
  CUSTOM: "#8B6914",
};

export default function ShippingLabelCard({
  priority,
  trackingNumber,
  showTape = false,
  isFragile = false,
  children,
}: ShippingLabelCardProps) {
  return (
    <div className="ship-label">
      {showTape && <span aria-hidden className="ship-label-tape" />}

      {/* Decorative header bar — not clickable */}
      <div aria-hidden className="ship-label-header">
        <span className="ship-label-header-title">Shipping Label</span>
        {priority && (
          <span
            className="ship-label-badge"
            style={{ backgroundColor: BADGE_BG[priority] }}
          >
            {priority}
          </span>
        )}
      </div>

      {/* Printable zone — children stay fully interactive here */}
      <div className="ship-label-frame">
        {children}
        {trackingNumber && (
          <div aria-hidden className="ship-label-barcode-block">
            <span className="ship-label-barcode-strip" />
            <span className="ship-label-tracking">{trackingNumber}</span>
          </div>
        )}
      </div>

      {isFragile && (
        <span aria-hidden className="ship-label-fragile">
          Fragile
        </span>
      )}
    </div>
  );
}
