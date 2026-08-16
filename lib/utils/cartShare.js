"use client";

/**
 * lib/utils/cartShare.js
 *
 * A plain wa.me link can only pre-fill *text* — there's no URL parameter
 * for attaching a file, so a long itemised list arrives as wrapped,
 * hard-to-scan chat text. This file draws the same list as a clean,
 * receipt-style PNG instead, and shares it as a real attached file
 * through the Web Share API (navigator.share with a files array), which
 * opens the phone's native share sheet — the customer picks WhatsApp (or
 * whatever they'd rather use) and the image lands as an actual image
 * attachment, not text.
 *
 * Falls back to today's text-only wa.me link (buildWhatsAppInquiryLink,
 * from hooks/useCart.js) wherever file sharing isn't available — mainly
 * desktop browsers. On that path we also trigger a plain download of the
 * same image, since WhatsApp Web/Desktop users can drag a downloaded file
 * into a chat themselves.
 */

import { buildWhatsAppInquiryLink, CONFIRM_AVAILABILITY_LINE } from "@/hooks/useCart";

const fmtMoney = (n) =>
  (+n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const CANVAS_WIDTH = 720;
const PADDING = 32;
const HEADER_HEIGHT = 84;
const ROW_HEIGHT = 56;
const ROW_DIVIDER_GAP = 16;
const TOTAL_ROW_HEIGHT = 64;
const CONFIRM_LINE_HEIGHT = 32;
const FOOTER_HEIGHT = 44;
const RENDER_SCALE = 2; // draw at 2x for crisp text on phone screens

/**
 * Renders a vendor's cart to a PNG Blob. White background on purpose —
 * this is meant to be read inside WhatsApp's own chat background, not the
 * app's light/dark theme, so it stays legible either way.
 */
export const buildCartImageBlob = (vendorCart) => {
  const items = vendorCart.items;
  const height =
    HEADER_HEIGHT +
    items.length * ROW_HEIGHT +
    TOTAL_ROW_HEIGHT +
    CONFIRM_LINE_HEIGHT +
    FOOTER_HEIGHT +
    PADDING;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH * RENDER_SCALE;
  canvas.height = height * RENDER_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(RENDER_SCALE, RENDER_SCALE);

  const sans = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_WIDTH, height);

  // header
  ctx.fillStyle = "#111827";
  ctx.font = `700 24px ${sans}`;
  ctx.fillText(vendorCart.businessName, PADDING, 38);

  ctx.fillStyle = "#6b7280";
  ctx.font = `14px ${sans}`;
  ctx.fillText(
    `Enquiry — ${items.length} item${items.length !== 1 ? "s" : ""}`,
    PADDING,
    60,
  );

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, HEADER_HEIGHT - 6);
  ctx.lineTo(CANVAS_WIDTH - PADDING, HEADER_HEIGHT - 6);
  ctx.stroke();

  // items
  let y = HEADER_HEIGHT + 26;
  let total = 0;

  items.forEach((it, i) => {
    const lineTotal = (parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0);
    total += lineTotal;

    ctx.fillStyle = "#111827";
    ctx.font = `600 16px ${sans}`;
    ctx.fillText(`${i + 1}. ${it.name}`, PADDING, y);

    ctx.fillStyle = "#6b7280";
    ctx.font = `14px ${sans}`;
    ctx.fillText(
      `${it.qty} ${it.unit || "unit"}${it.price ? ` × ₹${fmtMoney(it.price)}` : ""}`,
      PADDING,
      y + 20,
    );

    if (lineTotal > 0) {
      ctx.fillStyle = "#111827";
      ctx.font = `600 16px ${sans}`;
      ctx.textAlign = "right";
      ctx.fillText(`₹${fmtMoney(lineTotal)}`, CANVAS_WIDTH - PADDING, y);
      ctx.textAlign = "left";
    }

    y += ROW_HEIGHT;
    if (i < items.length - 1) {
      ctx.strokeStyle = "#f3f4f6";
      ctx.beginPath();
      ctx.moveTo(PADDING, y - ROW_DIVIDER_GAP);
      ctx.lineTo(CANVAS_WIDTH - PADDING, y - ROW_DIVIDER_GAP);
      ctx.stroke();
    }
  });

  // total
  ctx.strokeStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(CANVAS_WIDTH - PADDING, y);
  ctx.stroke();
  y += 34;

  ctx.fillStyle = "#111827";
  ctx.font = `700 18px ${sans}`;
  ctx.fillText("Estimated total", PADDING, y);
  ctx.textAlign = "right";
  ctx.fillText(`₹${fmtMoney(total)}`, CANVAS_WIDTH - PADDING, y);
  ctx.textAlign = "left";

  // Confirm-availability ask — drawn directly onto the image on purpose.
  // WhatsApp (and other share targets) don't reliably forward a separate
  // `text` field alongside an attached file, so the only way to GUARANTEE
  // this line actually arrives with the picture is to make it part of the
  // picture. The same wording is still included in the caption text too
  // (see shareCartInquiry below) for platforms where that does come
  // through, but it no longer needs to for the ask to be visible.
  y += CONFIRM_LINE_HEIGHT;
  ctx.fillStyle = "#374151";
  ctx.font = `14px ${sans}`;
  ctx.fillText(CONFIRM_AVAILABILITY_LINE, PADDING, y);

  // footer — attribution only.
  ctx.fillStyle = "#9ca3af";
  ctx.font = `12px ${sans}`;
  ctx.fillText("Sent via Vyaapaar", PADDING, height - 16);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * The main entry point CartDrawer calls. Tries to share the cart as an
 * actual image file via the native share sheet; falls back to
 * download-the-image + open-WhatsApp-with-text on browsers that can't.
 * Returns which path was taken, mainly so the caller can adjust its
 * toast/loading copy if it wants to.
 */
export const shareCartInquiry = async (vendorCart) => {
  const blob = await buildCartImageBlob(vendorCart);
  const filename = `enquiry-${vendorCart.businessName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  const file = new File([blob], filename, { type: "image/png" });
  const caption = `Enquiry for ${vendorCart.businessName} — see the attached list.\n\n${CONFIRM_AVAILABILITY_LINE}`;

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    // WhatsApp (and a fair few other share targets) don't reliably forward
    // the `text` field when a file is attached at the same time — that's a
    // gap in how the OS share sheet / receiving app handles a combined
    // payload, not something controllable from here. We still pass `text`
    // (and `title`, which some targets read instead) in case it works on
    // this platform, but also copy the caption to the clipboard first so
    // it's one paste away either way — the caller shows a toast about this.
    let copiedToClipboard = false;
    try {
      await navigator.clipboard.writeText(caption);
      copiedToClipboard = true;
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // share still goes ahead regardless, this is just a nice-to-have.
    }

    try {
      await navigator.share({
        files: [file],
        text: caption,
        title: `Enquiry for ${vendorCart.businessName}`,
      });
      return { method: "share", copiedToClipboard };
    } catch (err) {
      if (err?.name === "AbortError")
        return { method: "cancelled", copiedToClipboard };
      // Any other failure (permissions, an odd browser edge case) — drop
      // through to the download + wa.me fallback below instead of failing
      // the whole action.
    }
  }

  downloadBlob(blob, filename);
  window.open(buildWhatsAppInquiryLink(vendorCart), "_blank", "noopener,noreferrer");
  return { method: "fallback" };
};

/** The old plain-text-only path, kept as an explicit opt-out for anyone
 * who'd rather not deal with an image attachment at all. */
export const sendTextOnlyInquiry = (vendorCart) => {
  window.open(buildWhatsAppInquiryLink(vendorCart), "_blank", "noopener,noreferrer");
};