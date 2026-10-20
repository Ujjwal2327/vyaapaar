"use client";

/**
 * components/reminders/ReminderComposer.jsx
 *
 * One WhatsApp dues reminder for one contact. Rendered inside ReminderDialog.
 *
 * What's editable: the amount (it feeds the message and the QR). What isn't:
 * the message itself — it's a short fixed text (lib/utils/reminderBuilder.js).
 *
 * What gets sent, all through the share sheet:
 *   • the message, with the shop's UPI ID and the amount in it
 *   • a UPI QR image for exactly that amount        (when a UPI ID is set)
 *   • a statement PDF of the unpaid bills            (ticked by default)
 *
 * Both files are built the moment they're needed (on open, and again if the
 * amount changes) rather than when Send is pressed: the share sheet has to be
 * opened right after the tap, and building a PDF takes long enough to lose it.
 *
 * Offline: everything is disabled — see `isOnline`. Mount with key={contact.id}.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  MessageCircle,
  CalendarClock,
  Loader2,
  WifiOff,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Share2,
  QrCode,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchDueRows } from "@/hooks/useDues";
import {
  daysAgoLabel,
  daysTone,
  fmtINR,
  MAX_REMINDER_AMOUNT,
  phonesOf,
  round2,
} from "@/lib/utils/duesUtils";
import { buildReminderMessage } from "@/lib/utils/reminderBuilder";
import { buildUpiQrFile } from "@/lib/utils/upiQrImage";
import {
  canShareFiles,
  deliverReminder,
  shareFiles,
} from "@/lib/utils/reminderShare";
import { isValidUpiId } from "@/lib/utils/upi";

// ─── small shared pieces ────────────────────────────────────────────────────

const TONE_CLASSES = {
  neutral: "bg-muted text-muted-foreground",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

/** "12d" pill — amber from 15 days, red from 30. */
export const DaysBadge = ({ days, className = "" }) => {
  if (days == null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium whitespace-nowrap ${TONE_CLASSES[daysTone(days)]} ${className}`}
      title="Days since the oldest unpaid bill"
    >
      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
      {days === 0 ? "Today" : `${days}d`}
    </span>
  );
};

export const OfflineNotice = () => (
  <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
    <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
    <span>
      <strong>Reminders need an internet connection.</strong> Amounts are read
      fresh from the server. Reconnect to continue.
    </span>
  </div>
);

// ─── composer ───────────────────────────────────────────────────────────────

export const ReminderComposer = ({
  contact,
  dues,
  business,
  isOnline,
  onSent,
  onCancel,
}) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const phone = phonesOf(contact)[0] ?? null;

  const [amount, setAmount] = useState(() => String(dues.net));
  const [attachStatement, setAttachStatement] = useState(true);
  const [statementState, setStatementState] = useState("idle"); // idle | preparing | ready | error
  const [qrState, setQrState] = useState("idle"); // idle | preparing | ready | error
  const statementFileRef = useRef(null);
  const qrFileRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [followUp, setFollowUp] = useState(null); // { type: "share", files, message } | { type: "link", url }

  const vpa = business?.upiId?.trim() || "";
  const hasUpi = isValidUpiId(vpa);

  const parsedAmount = round2(parseFloat(amount));
  const amountValid = parsedAmount > 0 && parsedAmount <= MAX_REMINDER_AMOUNT;
  const amountDiffers =
    amountValid && Math.abs(parsedAmount - dues.net) > 0.001;

  const message = useMemo(
    () =>
      buildReminderMessage({
        contactName: contact.name,
        shopName: business?.businessName,
        amount: amountValid ? parsedAmount : dues.net,
        daysOutstanding: dues.daysOutstanding,
        vpa: hasUpi ? vpa : null,
      }),
    [
      contact.name,
      business?.businessName,
      amountValid,
      parsedAmount,
      dues.net,
      dues.daysOutstanding,
      hasUpi,
      vpa,
    ],
  );

  // QR image — rebuilt whenever the amount it encodes changes.
  useEffect(() => {
    qrFileRef.current = null;
    if (!hasUpi || !amountValid) {
      setQrState("idle");
      return;
    }
    let cancelled = false;
    setQrState("preparing");
    buildUpiQrFile({
      shopName: business?.businessName,
      vpa,
      amount: parsedAmount,
    })
      .then((file) => {
        if (cancelled) return;
        qrFileRef.current = file;
        setQrState("ready");
      })
      .catch((err) => {
        console.error("QR image failed:", err);
        if (!cancelled) setQrState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [hasUpi, amountValid, parsedAmount, vpa, business?.businessName]);

  // Statement PDF — built as soon as the box is (or starts) ticked.
  const contactRef = useRef(contact);
  contactRef.current = contact;
  useEffect(() => {
    if (!attachStatement) {
      statementFileRef.current = null;
      setStatementState("idle");
      return;
    }
    if (!userId) return;

    let cancelled = false;
    statementFileRef.current = null;
    setStatementState("preparing");

    (async () => {
      try {
        const [rows, { buildStatementFile }] = await Promise.all([
          fetchDueRows(userId, {
            contactId: contactRef.current.id,
            withDetails: true,
          }),
          import("@/lib/utils/statementPdfGenerator"),
        ]);
        const file = await buildStatementFile({
          business,
          contact: contactRef.current,
          rows,
        });
        if (cancelled) return;
        statementFileRef.current = file;
        setStatementState("ready");
      } catch (err) {
        console.error("Statement generation failed:", err);
        if (!cancelled) setStatementState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachStatement, userId, contact.id, business]);

  const readyFiles = () =>
    [
      qrState === "ready" ? qrFileRef.current : null,
      attachStatement && statementState === "ready"
        ? statementFileRef.current
        : null,
    ].filter(Boolean);

  const files = readyFiles();
  const preparing = qrState === "preparing" || statementState === "preparing";
  const locked = !isOnline || sending;
  const canSend =
    isOnline &&
    !sending &&
    amountValid &&
    !preparing &&
    !(attachStatement && statementState === "error");

  const sheet = files.length > 0 && canShareFiles(files);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setFollowUp(null);
    try {
      // Nothing is awaited before this: it must run while the tap is fresh.
      const result = await deliverReminder({
        phone,
        message,
        files: readyFiles(),
      });
      switch (result.method) {
        case "needs-tap":
          setFollowUp({
            type: "share",
            files: result.files,
            message: result.message,
          });
          toast.info("Almost there — tap “Share” to continue.");
          break;
        case "blocked":
          setFollowUp({ type: "link", url: result.url });
          toast.info("Your browser blocked the popup — tap “Open WhatsApp”.");
          break;
        case "cancelled":
          toast.info("Sharing cancelled");
          break;
        case "share":
          toast.success("Share sheet opened — pick the chat", {
            description: result.copied
              ? "The message is also copied, in case WhatsApp drops the text."
              : undefined,
          });
          onSent?.(contact.id);
          break;
        case "fallback":
          toast.success("Files downloaded and WhatsApp opened", {
            description:
              "Your browser can't attach files directly — attach them in the chat.",
          });
          onSent?.(contact.id);
          break;
        default:
          onSent?.(contact.id);
      }
    } catch (err) {
      console.error("Reminder failed:", err);
      toast.error("Couldn't open WhatsApp", {
        description: "Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleFollowUpShare = async () => {
    if (followUp?.type !== "share") return;
    try {
      const result = await shareFiles({
        files: followUp.files,
        message: followUp.message,
      });
      if (result.method === "share") {
        setFollowUp(null);
        onSent?.(contact.id);
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't open the share sheet");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="p-4 space-y-4">
          {!isOnline && <OfflineNotice />}

          {/* what's owed + how old */}
          <div className="rounded-xl border bg-muted/30 p-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400 leading-tight">
                {fmtINR(dues.net)}
              </p>
              {dues.toGive > 0.01 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {fmtINR(dues.toReceive)} receivable − {fmtINR(dues.toGive)}{" "}
                  payable
                </p>
              )}
            </div>
            {dues.daysOutstanding != null && (
              <div className="text-right shrink-0 space-y-1">
                <DaysBadge
                  days={dues.daysOutstanding}
                  className="text-base px-2.5 py-1"
                />
                <p className="text-sm text-muted-foreground">
                  Oldest unpaid bill
                  <br />
                  {daysAgoLabel(dues.daysOutstanding)}
                  {dues.oldestUnpaidAt &&
                    ` · ${format(new Date(dues.oldestUnpaidAt), "d MMM yyyy")}`}
                </p>
                {dues.unpaidCount > 1 && (
                  <p className="text-sm text-muted-foreground">
                    {dues.unpaidCount} unpaid bills
                  </p>
                )}
              </div>
            )}
          </div>

          {/* amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="reminder-amount"
                className="text-base font-medium"
              >
                Amount to ask for (₹)
              </Label>
              {amountDiffers && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-sm text-muted-foreground"
                  onClick={() => setAmount(String(dues.net))}
                  disabled={locked}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Full {fmtINR(dues.net)}
                </Button>
              )}
            </div>
            <Input
              id="reminder-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={locked}
              className="h-12 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {!amountValid && amount !== "" && (
              <p className="text-sm text-destructive">
                Enter an amount between ₹0.01 and {fmtINR(MAX_REMINDER_AMOUNT)}.
              </p>
            )}
            {amountValid && parsedAmount > dues.net + 0.001 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                That's more than the {fmtINR(dues.net)} outstanding.
              </p>
            )}
          </div>

          {/* what will be sent */}
          <div className="space-y-2">
            <Label className="text-base font-medium">What will be sent</Label>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
              <p className="text-sm whitespace-pre-wrap break-words">
                {message}
              </p>

              {hasUpi ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 shrink-0" />+ UPI QR image for{" "}
                  {amountValid ? fmtINR(parsedAmount) : "the amount"}
                  {qrState === "preparing" && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {qrState === "error" && (
                    <span className="text-destructive">
                      · couldn't draw it, sending without
                    </span>
                  )}
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  Add your UPI ID in Settings → Profile to include the QR and
                  UPI details.
                </p>
              )}
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <Checkbox
                id="reminder-statement"
                checked={attachStatement}
                onCheckedChange={(v) => setAttachStatement(v === true)}
                disabled={locked}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor="reminder-statement"
                  className="text-base font-medium cursor-pointer"
                >
                  Attach statement (PDF)
                </Label>
                <p className="text-sm text-muted-foreground">
                  {attachStatement && statementState === "preparing"
                    ? "Preparing statement…"
                    : attachStatement && statementState === "error"
                      ? "Couldn't prepare the statement — untick to send without it."
                      : "Every unpaid bill with its age."}
                </p>
              </div>
              {statementState === "preparing" && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0 mt-1" />
              )}
            </div>
          </div>

          {/* how it reaches WhatsApp */}
          <p className="text-sm text-muted-foreground">
            {files.length === 0 ? (
              phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Opens {contact.name}'s chat ({phone}) with the message typed
                  in.
                </span>
              ) : (
                "WhatsApp will ask who to send it to."
              )
            ) : sheet ? (
              `WhatsApp can't open a chat with files attached, so you'll pick ${contact.name}'s chat in the share sheet. The message is copied for you to paste if it isn't included.`
            ) : (
              "This browser can't attach files: they'll be downloaded and the chat opened — attach them there."
            )}
          </p>

          {/* shown only when a browser needs a fresh tap to finish */}
          {followUp && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium">One more tap</p>
              {followUp.type === "share" ? (
                <Button
                  className="w-full gap-1.5"
                  onClick={handleFollowUpShare}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              ) : (
                <Button
                  className="w-full gap-1.5"
                  asChild
                  onClick={() => {
                    setFollowUp(null);
                    onSent?.(contact.id);
                  }}
                >
                  <a
                    href={followUp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open WhatsApp
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-3 flex gap-2 shrink-0 bg-background">
        <Button variant="outline" onClick={onCancel} disabled={sending}>
          Cancel
        </Button>
        <Button
          className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
          onClick={handleSend}
          disabled={!canSend}
        >
          {sending || preparing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MessageCircle className="w-4 h-4" />
          )}
          {sending
            ? "Opening…"
            : preparing
              ? "Preparing…"
              : sheet
                ? "Share on WhatsApp"
                : "Send on WhatsApp"}
        </Button>
      </div>
    </div>
  );
};
