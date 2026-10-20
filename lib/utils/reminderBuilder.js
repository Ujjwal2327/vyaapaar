/**
 * lib/utils/reminderBuilder.js
 *
 * The WhatsApp reminder text — deliberately short, fixed, and the same for
 * the single-contact and the multi-contact reminder. No template, no
 * placeholders to edit.
 *
 *   Hi Ramesh, a reminder from Sharma Store: ₹900 is pending (oldest bill 20 days old).
 *
 *   Pay by UPI
 *   ID: shop@okhdfcbank
 *   Amount: ₹900
 *
 *   Thank you!
 *
 * The UPI block is only added when the shop has a valid UPI ID; the QR code
 * itself goes as an image (lib/utils/upiQrImage.js), never as text.
 */

import { fmtINR } from "@/lib/utils/duesUtils";

export const buildReminderMessage = ({
  contactName,
  shopName,
  amount,
  daysOutstanding,
  vpa,
}) => {
  const age =
    daysOutstanding != null && daysOutstanding > 0
      ? ` (oldest bill ${daysOutstanding} day${daysOutstanding === 1 ? "" : "s"} old)`
      : "";

  const lines = [
    `Hi ${contactName || "there"}, a reminder from ${shopName || "us"}: ${fmtINR(amount)} is pending${age}.`,
  ];

  if (vpa) {
    lines.push("", "Pay by UPI", `ID: ${vpa}`, `Amount: ${fmtINR(amount)}`);
  }

  lines.push("", "Thank you!");
  return lines.join("\n");
};
