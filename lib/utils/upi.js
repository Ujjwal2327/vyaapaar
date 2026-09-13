/**
 * lib/utils/upi.js
 *
 * Builds a standard "upi://pay?..." deep link for the remaining due amount
 * on a transaction, so a customer can scan a QR code and pay with any UPI
 * app (GPay, PhonePe, Paytm, ...) instead of the shop owner reading out an
 * account number. This is convenience only — there is no payment gateway,
 * callback, or webhook involved anywhere in this app. The shop owner still
 * records the payment by hand once it lands (see AddPaymentModal.jsx),
 * exactly like every other payment method already supported here.
 *
 * Link format follows the convention every major UPI app supports:
 *   upi://pay?pa=<vpa>&pn=<payee name>&am=<amount>&cu=INR&tn=<note>
 */

// Deliberately loose: real VPAs vary a lot in their local part — numeric
// mobile-linked handles ("9876543210@ybl"), alphanumeric ones
// ("john.doe@oksbi"), underscores/dots/hyphens are all common. The one
// thing every VPA has is a single "@" separating a non-empty identifier
// from a short, alphabetic bank/PSP handle (okhdfcbank, ybl, upi, paytm,
// oksbi, ...). This checks exactly that, and nothing stricter — the goal
// is to catch "clearly not a VPA" typos, not to second-guess real ones.
const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export const isValidUpiId = (vpa) => {
  if (!vpa || typeof vpa !== "string") return false;
  return UPI_ID_REGEX.test(vpa.trim());
};

/**
 * Builds a "upi://pay?..." link for the given amount.
 *
 * @param {object} params
 * @param {string} params.vpa - the payee's UPI ID, e.g. "shop@okhdfcbank"
 * @param {string} [params.payeeName] - shown on the paying app's confirm
 *   screen; falls back to a generic label if not set
 * @param {number|string} params.amount - amount in rupees, e.g. 1250.5
 * @param {string} [params.note] - short transaction note (kept brief —
 *   UPI apps are inconsistent about how much of `tn` they display, and
 *   some silently truncate long values mid-word)
 * @returns {string|null} the deep link, or null if the vpa/amount aren't
 *   usable — callers should treat null the same as "nothing to show" and
 *   never render a QR code from a null link.
 */
export const buildUpiPaymentLink = ({ vpa, payeeName, amount, note }) => {
  if (!isValidUpiId(vpa)) return null;

  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return null;

  const parts = [
    `pa=${encodeURIComponent(vpa.trim())}`,
    `pn=${encodeURIComponent((payeeName || "").trim() || "Merchant")}`,
    `am=${encodeURIComponent(amt.toFixed(2))}`,
    `cu=INR`,
  ];
  if (note && note.trim()) {
    parts.push(`tn=${encodeURIComponent(note.trim().slice(0, 50))}`);
  }

  return `upi://pay?${parts.join("&")}`;
};
