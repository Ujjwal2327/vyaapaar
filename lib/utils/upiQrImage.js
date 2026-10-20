"use client";

/**
 * lib/utils/upiQrImage.js
 *
 * The UPI payment QR a reminder carries as an image: shop name, the amount,
 * a QR for exactly that amount, and the UPI ID in text underneath. Drawn on a
 * canvas like lib/utils/receiptImage.js; the QR matrix comes from the `qrcode`
 * package the app already uses (components/UpiQrCode.jsx) and is painted
 * module-by-module, so it stays razor sharp at any scale.
 *
 * Nothing is stored or hosted: the amount lives in the QR (UPI's `am`
 * parameter) and in the image itself, and that's all.
 *
 * `qrcode` is imported lazily so it stays out of the page bundle until a
 * reminder is actually being prepared.
 */

import { fmtINR } from "@/lib/utils/duesUtils";
import { buildUpiPaymentLink } from "@/lib/utils/upi";

const W = 720;
const SCALE = 2;
const SANS = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const QUIET_MODULES = 4; // the white margin scanners need around a QR
const QR_BOX = 420;

const slug = (s) =>
  (s || "shop")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 30)
    .replace(/-$/, "") || "shop";

const fitText = (ctx, text, maxWidth) => {
  let t = String(text);
  if (ctx.measureText(t).width <= maxWidth) return t;
  while (t.length > 4 && ctx.measureText(`${t}…`).width > maxWidth)
    t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
};

/**
 * @param {object} p
 * @param {string} p.shopName
 * @param {string} p.vpa      the shop's UPI ID
 * @param {number} p.amount   rupees; frozen into the QR
 * @returns {Promise<File>}   a PNG
 */
export const buildUpiQrFile = async ({ shopName, vpa, amount }) => {
  const link = buildUpiPaymentLink({
    vpa,
    payeeName: shopName,
    amount,
    note: "Dues payment",
  });
  if (!link) throw new Error("Invalid UPI ID or amount");

  const { create } = await import("qrcode");
  const qr = create(link, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const total = n + QUIET_MODULES * 2;
  const px = Math.max(2, Math.floor(QR_BOX / total));
  const qrSize = px * total;

  const H = 200 + qrSize + 154; // title block + QR + caption/UPI ID + margin
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  const cx = W / 2;

  ctx.fillStyle = "#111827";
  ctx.font = `700 28px ${SANS}`;
  ctx.fillText(fitText(ctx, shopName || "Pay via UPI", W - 80), cx, 62);

  ctx.fillStyle = "#6b7280";
  ctx.font = `500 17px ${SANS}`;
  ctx.fillText("Amount to pay", cx, 112);

  ctx.fillStyle = "#111827";
  ctx.font = `700 52px ${SANS}`;
  ctx.fillText(fmtINR(amount), cx, 172);

  // QR: light card, then each dark module as a square
  const top = 200;
  const left = (W - qrSize) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.fillRect(left, top, qrSize, qrSize);
  ctx.strokeRect(left, top, qrSize, qrSize);

  ctx.fillStyle = "#111111";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        ctx.fillRect(
          left + (c + QUIET_MODULES) * px,
          top + (r + QUIET_MODULES) * px,
          px,
          px,
        );
      }
    }
  }

  const below = top + qrSize;
  ctx.fillStyle = "#374151";
  ctx.font = `500 18px ${SANS}`;
  ctx.fillText("Scan with GPay, PhonePe, Paytm or any UPI app", cx, below + 44);

  ctx.fillStyle = "#6b7280";
  ctx.font = `15px ${SANS}`;
  ctx.fillText("or pay to UPI ID", cx, below + 84);
  ctx.fillStyle = "#111827";
  ctx.font = `600 20px ${SANS}`;
  ctx.fillText(fitText(ctx, vpa, W - 80), cx, below + 114);

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't render QR"))),
      "image/png",
    ),
  );
  return new File([blob], `Pay_${slug(shopName)}_${amount}.png`, {
    type: "image/png",
  });
};
