"use client";

/**
 * lib/utils/receiptImage.js
 *
 * The "payment received" receipt a shop sends a customer after they've paid:
 * a clean PNG (drawn on a canvas, same approach as lib/utils/cartShare.js)
 * plus the same facts as plain text.
 *
 * buildReceiptData is pure and works out the balance AS OF that payment —
 * i.e. what was still due right after it, not what's due today — so a
 * receipt for an older payment doesn't quietly quote a later balance.
 */

import { format } from "date-fns";
import { fmtINR } from "@/lib/utils/duesUtils";

const EPSILON = 0.01;

const describeBill = (tx) => {
  if (tx.kind === "item" && tx.itemsList?.length > 0) {
    const names = tx.itemsList
      .slice(0, 2)
      .map((it) => (it.name || "").split(" › ").pop())
      .filter(Boolean)
      .join(", ");
    const more = tx.itemsList.length > 2 ? ` +${tx.itemsList.length - 2}` : "";
    if (names) return names + more;
  }
  return tx.note?.trim() || "";
};

const METHOD_LABELS = {
  cash: "Cash",
  upi: "UPI",
  "bank transfer": "Bank transfer",
  cheque: "Cheque",
  credit: "Credit",
};
const methodLabel = (m) =>
  METHOD_LABELS[(m || "").toLowerCase()] ??
  (m ? m[0].toUpperCase() + m.slice(1) : "");

/**
 * @param {object} p
 * @param {object} p.transaction  the bill the payment was recorded against
 * @param {object} p.entry        one element of transaction.paidAmountHistory
 * @param {object|null} p.business   from useBusinessProfile
 * @param {object|null} p.contact
 */
export const buildReceiptData = ({ transaction, entry, business, contact }) => {
  const history = [...(transaction.paidAmountHistory ?? [])].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  const at = history.findIndex(
    (e) =>
      e.date === entry.date &&
      e.amount === entry.amount &&
      e.method === entry.method,
  );
  const upTo = at === -1 ? history : history.slice(0, at + 1);
  const paidSoFar = upTo.reduce((s, e) => s + (e.amount ?? 0), 0);
  const total = Number(transaction.totalAmount) || 0;
  const balanceAfter = Math.round((total - paidSoFar) * 100) / 100;

  return {
    shopName: business?.businessName || "Our shop",
    shopPhone: business?.phone || "",
    contactName: contact?.name || "",
    amount: Number(entry.amount) || 0,
    method: methodLabel(entry.method),
    note: entry.note?.trim() || "",
    date: entry.date,
    bill: describeBill(transaction),
    ref: transaction.id ? transaction.id.slice(0, 8).toUpperCase() : "",
    total,
    balanceAfter: balanceAfter > EPSILON ? balanceAfter : 0,
    overpaid: balanceAfter < -EPSILON ? Math.abs(balanceAfter) : 0,
    settled: balanceAfter <= EPSILON,
  };
};

const safeDate = (iso) => {
  try {
    return format(new Date(iso), "d MMM yyyy, h:mm a");
  } catch {
    return "";
  }
};

export const buildReceiptText = (d) => {
  const lines = [
    `✅ Payment received: ${fmtINR(d.amount)}`,
    d.contactName ? `Thank you, ${d.contactName}!` : "Thank you!",
    "",
    `Paid to: ${d.shopName}`,
    `Date: ${safeDate(d.date)}`,
  ];
  if (d.method) lines.push(`Method: ${d.method}`);
  if (d.bill) lines.push(`Towards: ${d.bill}`);
  lines.push(
    d.overpaid > EPSILON
      ? `Advance with us: ${fmtINR(d.overpaid)}`
      : d.settled
        ? "Balance: fully paid ✓"
        : `Balance due: ${fmtINR(d.balanceAfter)}`,
  );
  if (d.ref) lines.push(`Ref: #${d.ref}`);
  return lines.join("\n");
};

export const receiptFilename = (d) =>
  `Receipt_${d.ref || "payment"}_${new Date(d.date).toISOString().slice(0, 10)}.png`;

// ─── image ──────────────────────────────────────────────────────────────────

const W = 720;
const PAD = 40;
const SCALE = 2; // draw at 2x so text stays crisp on phone screens
const SANS = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/**
 * White background on purpose: it's read inside WhatsApp's own chat
 * background, so it shouldn't follow the app's light/dark theme.
 */
export const buildReceiptBlob = (d) => {
  const rows = [
    d.contactName && ["Paid by", d.contactName],
    ["Date", safeDate(d.date)],
    d.method && ["Method", d.method],
    d.bill && ["Towards", d.bill],
    d.ref && ["Reference", `#${d.ref}`],
  ].filter(Boolean);

  const ROW_H = 44;
  const HEADER_H = 250;
  const FOOTER_H = 150;
  const H = HEADER_H + rows.length * ROW_H + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // green check badge
  const cx = W / 2;
  ctx.fillStyle = "#dcfce7";
  ctx.beginPath();
  ctx.arc(cx, 62, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 14, 63);
  ctx.lineTo(cx - 4, 74);
  ctx.lineTo(cx + 15, 51);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#6b7280";
  ctx.font = `500 18px ${SANS}`;
  ctx.fillText("Payment received", cx, 130);

  ctx.fillStyle = "#111827";
  ctx.font = `700 46px ${SANS}`;
  ctx.fillText(fmtINR(d.amount), cx, 184);

  ctx.fillStyle = "#6b7280";
  ctx.font = `15px ${SANS}`;
  ctx.fillText(`to ${d.shopName}`, cx, 214);

  // divider
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, HEADER_H - 14);
  ctx.lineTo(W - PAD, HEADER_H - 14);
  ctx.stroke();

  // detail rows
  ctx.textAlign = "left";
  let y = HEADER_H + 14;
  rows.forEach(([label, value]) => {
    ctx.fillStyle = "#6b7280";
    ctx.font = `15px ${SANS}`;
    ctx.fillText(label, PAD, y);
    ctx.fillStyle = "#111827";
    ctx.font = `600 16px ${SANS}`;
    ctx.textAlign = "right";
    // keep a long item list from running off the card
    let text = String(value);
    const maxW = W - PAD * 2 - 130;
    while (ctx.measureText(text).width > maxW && text.length > 4)
      text = text.slice(0, -2);
    ctx.fillText(
      text === String(value) ? text : `${text.trimEnd()}…`,
      W - PAD,
      y,
    );
    ctx.textAlign = "left";
    y += ROW_H;
  });

  // balance pill
  const pillY = y + 6;
  const status =
    d.overpaid > EPSILON
      ? {
          text: `Advance with us: ${fmtINR(d.overpaid)}`,
          bg: "#dbeafe",
          fg: "#1d4ed8",
        }
      : d.settled
        ? { text: "Fully paid ✓", bg: "#dcfce7", fg: "#15803d" }
        : {
            text: `Balance due: ${fmtINR(d.balanceAfter)}`,
            bg: "#fef3c7",
            fg: "#b45309",
          };
  ctx.fillStyle = status.bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(PAD, pillY, W - PAD * 2, 52, 12);
  else ctx.rect(PAD, pillY, W - PAD * 2, 52);
  ctx.fill();
  ctx.fillStyle = status.fg;
  ctx.font = `700 19px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(status.text, cx, pillY + 33);

  ctx.fillStyle = "#9ca3af";
  ctx.font = `12px ${SANS}`;
  ctx.fillText("Thank you for your payment • Sent via Vyaapaar", cx, H - 22);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't render receipt"))),
      "image/png",
    ),
  );
};
