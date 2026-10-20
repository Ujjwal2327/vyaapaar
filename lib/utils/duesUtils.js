/**
 * lib/utils/duesUtils.js
 *
 * Pure helpers for the WhatsApp dues reminders (components/reminders/*).
 *
 * "Dues" for a contact means the same figure the Contacts page already shows
 * as their balance: receivable minus payable, using categorizeBalance from
 * analyticsUtils.js so a reminder can never disagree with the ledger about
 * what is owed. Only a POSITIVE net is remindable — if you owe them money,
 * there is nothing to chase.
 *
 * "Days outstanding" is the age of the OLDEST unpaid sale (type "out" with a
 * balance still to collect). A part-payment doesn't reset it: the bill is
 * still unpaid. Advances that merely come back to you (an overpaid purchase)
 * count towards the amount but not the age, since they aren't a bill.
 */

import { differenceInCalendarDays } from "date-fns";
import { categorizeBalance } from "@/lib/utils/analyticsUtils";

const EPSILON = 0.01;

/** Same ceiling the database enforces on a pay-link amount. */
export const MAX_REMINDER_AMOUNT = 10000000;

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * rows: [{ contactId, type, totalAmount, paidAmount, createdAt }] for ONE
 * contact (deleted rows already excluded).
 */
export const computeDues = (rows, now = new Date()) => {
  let toReceive = 0;
  let toGive = 0;
  let unpaidCount = 0;
  let oldest = null;

  for (const row of rows ?? []) {
    const { toReceive: rec, toGive: give } = categorizeBalance(
      row.totalAmount,
      row.paidAmount,
      row.type,
    );
    toReceive += rec;
    toGive += give;

    if (row.type === "out" && rec > EPSILON && row.createdAt) {
      unpaidCount += 1;
      const at = new Date(row.createdAt);
      if (!Number.isNaN(at.getTime()) && (!oldest || at < oldest)) oldest = at;
    }
  }

  return {
    toReceive: round2(toReceive),
    toGive: round2(toGive),
    net: round2(toReceive - toGive),
    unpaidCount,
    oldestUnpaidAt: oldest ? oldest.toISOString() : null,
    daysOutstanding: oldest
      ? Math.max(0, differenceInCalendarDays(now, oldest))
      : null,
  };
};

/** Splits a flat list of rows by contactId → Map<contactId, dues>. */
export const groupDuesByContact = (rows, now = new Date()) => {
  const buckets = new Map();
  for (const row of rows ?? []) {
    if (!row.contactId) continue;
    if (!buckets.has(row.contactId)) buckets.set(row.contactId, []);
    buckets.get(row.contactId).push(row);
  }
  const result = new Map();
  buckets.forEach((list, id) => result.set(id, computeDues(list, now)));
  return result;
};

export const hasDues = (dues) => !!dues && dues.net > EPSILON;

// ─── formatting ─────────────────────────────────────────────────────────────

/** ₹5,200 for whole rupees, ₹5,200.50 otherwise — never ₹5,200.5. */
export const fmtINR = (n) => {
  const value = Number(n) || 0;
  const whole = Math.abs(value - Math.round(value)) < 0.005;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value);
};

export const daysAgoLabel = (days) => {
  if (days == null) return "";
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

/** "neutral" | "amber" | "red" — how pointed to make the age badge. */
export const daysTone = (days) =>
  days == null
    ? "neutral"
    : days >= 30
      ? "red"
      : days >= 15
        ? "amber"
        : "neutral";

// (The reminder message itself is built in lib/utils/reminderBuilder.js.)

/** Non-empty phone numbers, primary first; copes with the legacy `phone` field. */
export const phonesOf = (contact) =>
  (contact?.phones ?? (contact?.phone ? [contact.phone] : [])).filter(
    (p) => p && String(p).trim(),
  );

export const initialsOf = (name) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
