"use client";

/**
 * lib/utils/reminderShare.js
 *
 * Gets a reminder into WhatsApp.
 *
 *  - With files (the UPI QR image, the statement PDF) → the native share
 *    sheet (navigator.share with a files array). A wa.me link can only carry
 *    text, and WhatsApp offers no way for a website to open a chat with an
 *    attachment, so the person picks the chat in the share sheet themselves.
 *    The message text is copied to the clipboard at the same moment, because
 *    WhatsApp doesn't always keep the text that comes with shared files.
 *    Where the browser can't share files (most desktops) the files are
 *    downloaded and the person's chat is opened with the text instead.
 *  - With no files → a wa.me link addressed to the contact's number.
 *
 * Call deliverReminder() straight from the click handler with everything
 * already prepared: browsers only allow navigator.share / window.open shortly
 * after a tap, so nothing here may be awaited before them. (That's why the
 * QR image and PDF are built ahead of time, not when Send is pressed.)
 */

/** 10-digit Indian numbers get the 91 country code; anything else is passed through as digits. */
export const normalizeWhatsAppPhone = (phone) => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `91${digits.slice(1)}`;
  return digits;
};

/** With no phone this is https://wa.me/?text=… — WhatsApp then asks who to send it to. */
export const buildWhatsAppLink = (phone, text) =>
  `https://wa.me/${normalizeWhatsAppPhone(phone)}?text=${encodeURIComponent(text)}`;

export const canShareFiles = (files) =>
  Array.isArray(files) &&
  files.length > 0 &&
  typeof navigator !== "undefined" &&
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files });

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const downloadFile = (file) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Opens the share sheet with `files` + `message`. Also used by the
 * "tap to share" button that appears after a `needs-tap` result.
 */
export const shareFiles = async ({ files, message }) => {
  // Start the clipboard copy and the share in the same tick, without awaiting
  // the copy first: awaiting anything before navigator.share() can cost the
  // fresh-tap permission it needs (notably on iOS Safari).
  const copying = copyToClipboard(message);
  try {
    await navigator.share({ files, text: message, title: files[0]?.name });
    return { method: "share", copied: await copying };
  } catch (err) {
    const copied = await copying;
    if (err?.name === "AbortError") return { method: "cancelled", copied };
    if (err?.name === "NotAllowedError") return { method: "needs-tap", copied };
    throw err;
  }
};

/**
 * @param {object} p
 * @param {string} [p.phone]    contact's number (used by the wa.me routes)
 * @param {string} p.message
 * @param {File[]} [p.files]    QR image / PDF to attach
 *
 * Resolves to { method, ... }, method being one of:
 *   "whatsapp"  – wa.me chat opened with the text (no files)
 *   "share"     – share sheet shown (files attached)
 *   "fallback"  – files downloaded + wa.me chat opened
 *   "cancelled" – person dismissed the share sheet
 *   "needs-tap" – share refused for lack of a fresh tap (result.files/message to retry)
 *   "blocked"   – popup blocked (result.url to open from a button)
 */
export const deliverReminder = async ({ phone, message, files = [] }) => {
  if (canShareFiles(files)) {
    const result = await shareFiles({ files, message });
    return result.method === "needs-tap"
      ? { ...result, files, message }
      : result;
  }

  const waLink = buildWhatsAppLink(phone, message);
  files.forEach(downloadFile);

  const win = window.open(waLink, "_blank", "noopener,noreferrer");
  if (!win) return { method: "blocked", url: waLink };
  return { method: files.length ? "fallback" : "whatsapp" };
};
