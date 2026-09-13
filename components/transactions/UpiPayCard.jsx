"use client";

/**
 * components/transactions/UpiPayCard.jsx
 *
 * Small, self-contained "pay by UPI" widget used wherever a payment is
 * being recorded — AddPaymentModal, NetSettleModal, and the "Paid now"
 * step of AddTransactionModal. Renders a QR code (and, for outgoing
 * payments, a tappable "Open in UPI app" action) once there's a valid VPA
 * and a nonzero amount, or a prompt to add the missing UPI ID when there
 * isn't — never a broken or empty QR.
 *
 * Bidirectional:
 *  - direction="receive" — a sale: the CUSTOMER pays the BUSINESS. Encodes
 *    the business's own VPA. Only a QR makes sense here — the business's
 *    own device is showing this to the customer to scan, so a tappable
 *    "open UPI app" button would just open the business's own app to pay
 *    itself, which is meaningless.
 *  - direction="send" — a purchase: the BUSINESS pays a CONTACT. Encodes
 *    the contact's VPA. Here the person looking at the screen IS the one
 *    who should pay, so a tappable "Open in UPI app" link is the primary
 *    action (jumps straight into an installed UPI app on the same
 *    device), with the QR underneath as a fallback for when they're on a
 *    device without a UPI app (e.g. a laptop) and want to scan with their
 *    phone instead.
 *
 * Pure display. This has no idea whether the payment actually happened —
 * there's no gateway, callback, or webhook anywhere in this app. The shop
 * owner still records the payment by hand, same as any other method.
 */

import { useMemo } from "react";
import { buildUpiPaymentLink } from "@/lib/utils/upi";
import { UpiQrCode } from "@/components/UpiQrCode";
import { Button } from "@/components/ui/button";
import { QrCode, Settings, ExternalLink } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n ?? 0);

/**
 * direction: "receive" | "send" — see file header.
 * vpa: whoever should be PAID — the business's own UPI ID for "receive",
 *   the contact's UPI ID for "send".
 * payeeName: display name for whoever should be paid.
 * dueAmount: the amount to encode — always whatever's actually being
 *   collected/sent right now (e.g. a live "amount" field), not
 *   necessarily the transaction's full remaining balance. Zero/negative
 *   renders nothing.
 * note: optional short string folded into the UPI note (tn) field, e.g.
 *   "Txn a1b2c3d4" or "Net settlement" — full control left to the caller
 *   since what's identifying differs by context.
 * missingVpaMessage: React node shown instead of a QR when `vpa` isn't
 *   set/valid — different copy needed for "your own" vs "their" VPA.
 */
export const UpiPayCard = ({
  direction,
  vpa,
  payeeName,
  dueAmount,
  note,
  missingVpaMessage,
}) => {
  const link = useMemo(() => {
    if (!dueAmount || dueAmount <= 0) return null;
    return buildUpiPaymentLink({ vpa, payeeName, amount: dueAmount, note });
  }, [dueAmount, vpa, payeeName, note]);

  if (!dueAmount || dueAmount <= 0) return null;

  // No VPA set (or what's set doesn't look like a valid one) — either way
  // there's nothing scannable/tappable to offer, so nudge toward fixing it
  // instead of rendering an empty or broken QR.
  if (!link) {
    return (
      <div className="rounded-lg border border-dashed p-3 flex items-start gap-2.5 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-150">
        <Settings className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{missingVpaMessage}</span>
      </div>
    );
  }

  const isSend = direction === "send";

  return (
    <div className="rounded-lg border p-3 flex flex-col items-center gap-2.5 text-center animate-in fade-in slide-in-from-top-1 duration-150">
      <p className="text-sm font-medium flex items-center gap-1.5">
        <QrCode className="w-4 h-4 text-primary" />
        {isSend
          ? `Pay ${fmt(dueAmount)}${payeeName ? ` to ${payeeName}` : ""}`
          : `Customer scans to pay ${fmt(dueAmount)}`}
      </p>

      {isSend && (
        <Button asChild className="w-full gap-1.5">
          <a href={link}>
            <ExternalLink className="w-4 h-4" />
            Open in UPI app
          </a>
        </Button>
      )}

      <UpiQrCode link={link} size={isSend ? 160 : 180} />

      <p className="text-sm text-muted-foreground">
        {isSend
          ? "On a laptop or desktop? Scan this with your own phone's UPI app instead"
          : "Works with GPay, PhonePe, Paytm, and any other UPI app"}
      </p>
    </div>
  );
};
