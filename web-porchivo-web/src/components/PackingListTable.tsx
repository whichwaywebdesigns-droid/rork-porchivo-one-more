/**
 * PackingListTable — reusable DECORATIVE container styled as a printed
 * packing list / receipt taped inside a shipping box.
 *
 * Visual-only module: every decorative layer (torn-edge serration, corner
 * tape accent, "PAID" stamp, footer barcode) is `pointer-events: none` /
 * `aria-hidden`, so any interactive children (buttons, links, forms) remain
 * fully functional and unchanged.
 *
 * Pass raw table rows as children — they render inside the receipt's
 * <table> completely untouched. Totals/summary rows go through the optional
 * `totals` render slot (tfoot) to keep valid table semantics while getting
 * the double-line totals treatment.
 *
 * Styles live in index.css under the `pack-list-*` namespace (pure CSS — no
 * images/SVG; the barcode reuses the repeating-gradient technique from the
 * shipping-label barcode).
 *
 * Usage:
 *   <PackingListTable
 *     header={{ company: "CARDBOARD BOX CO.", address: "...", orderNumber: "ORD-2026-0892", date: "Aug 20, 2026" }}
 *     footer={{ message: "Thank you for your business!", contactEmail: "support@porchivo.com" }}
 *     isPaid
 *     showTape
 *   >
 *     <tr><td>24×18×12 Custom RSC</td><td>500</td><td>$0.42</td><td>$210.00</td></tr>
 *   </PackingListTable>
 */

interface PackingListHeader {
  /** Company name line — uppercase receipt masthead. */
  company: string;
  /** Address line under the company name (hidden on mobile). */
  address?: string;
  /** Order / receipt number — monospace meta line. */
  orderNumber?: string;
  /** Receipt date — monospace meta line. */
  date?: string;
}

interface PackingListFooter {
  /** Italic thank-you line above the decorative barcode. */
  message?: string;
  /** Contact e-mail printed at the very bottom. */
  contactEmail?: string;
}

interface PackingListTableProps {
  /** Optional receipt masthead block. Omit for a bare table slip. */
  header?: PackingListHeader;
  /** Optional column headings rendered in the typewriter header row. */
  columns?: readonly string[];
  /** Optional totals/summary content rendered in a real <tfoot> so it gets
   *  the double-line "receipt total" treatment while keeping valid table
   *  semantics (pass <tr> with <td>s). */
  totals?: React.ReactNode;
  /** Optional receipts-style footer (thanks message + contact). */
  footer?: PackingListFooter;
  /** Green "PAID" rubber stamp overlay. Default false. */
  isPaid?: boolean;
  /** Packing-tape accent across the top-left corner. Default false. */
  showTape?: boolean;
  /** Existing content to wrap — left untouched and fully interactive. */
  children: React.ReactNode;
}

export default function PackingListTable({
  header,
  columns,
  totals,
  footer,
  isPaid = false,
  showTape = false,
  children,
}: PackingListTableProps) {
  return (
    <div className="pack-list">
      {showTape && <span aria-hidden className="pack-list-tape" />}

      {header && (
        <div className="pack-list-head">
          <p className="pack-list-company">{header.company}</p>
          {header.address && <p className="pack-list-address">{header.address}</p>}
          {(header.orderNumber || header.date) && (
            <p className="pack-list-meta">
              {header.orderNumber && <span>{header.orderNumber}</span>}
              {header.orderNumber && header.date && <span aria-hidden> · </span>}
              {header.date && <span>{header.date}</span>}
            </p>
          )}
        </div>
      )}

      <table className="pack-list-table">
        {columns && columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
        )}
        {/* Children are injected untouched — all interactivity preserved */}
        <tbody>{children}</tbody>
        {totals && <tfoot>{totals}</tfoot>}
      </table>

      {footer && (
        <div className="pack-list-foot">
          {footer.message && <p className="pack-list-thanks">{footer.message}</p>}
          <span aria-hidden className="pack-list-barcode" />
          {footer.contactEmail && (
            <p className="pack-list-contact">Questions? {footer.contactEmail}</p>
          )}
        </div>
      )}

      {isPaid && (
        <span aria-hidden className="pack-list-stamp">
          Paid
        </span>
      )}
    </div>
  );
}
