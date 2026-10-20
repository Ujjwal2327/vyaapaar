"use client";

/**
 * components/reminders/SendReceiptDialog.jsx
 *
 * "Send receipt" for a payment the customer has made: shows the receipt
 * image and sends it over WhatsApp.
 *
 * Two ways to send, and the difference matters:
 *  - As text   → opens the customer's own WhatsApp chat with the receipt
 *                already typed in. You press send.
 *  - As image  → WhatsApp can't open a chat with an attachment, so this uses
 *                your phone's share sheet: you pick the chat yourself. (On
 *                a desktop browser the PNG is downloaded and the chat opened,
 *                and you attach it.) The receipt text is copied for you.
 *
 * Needs no server, so unlike the reminders it isn't gated on being online.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ImageIcon, Loader2, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { phonesOf } from "@/lib/utils/duesUtils";
import {
  buildReceiptBlob,
  buildReceiptData,
  buildReceiptText,
  receiptFilename,
} from "@/lib/utils/receiptImage";
import {
  buildWhatsAppLink,
  canShareFiles,
  deliverReminder,
} from "@/lib/utils/reminderShare";

export const SendReceiptDialog = ({
  open,
  onOpenChange,
  transaction,
  entry,
  contact,
}) => {
  const { profile } = useBusinessProfile();
  const phone = phonesOf(contact)[0] ?? null;

  const data = useMemo(
    () =>
      transaction && entry
        ? buildReceiptData({ transaction, entry, business: profile, contact })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transaction, entry, profile, contact?.id, contact?.name],
  );
  const text = useMemo(() => (data ? buildReceiptText(data) : ""), [data]);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !data) return;
    let cancelled = false;
    let url = null;
    setFailed(false);
    (async () => {
      try {
        const blob = await buildReceiptBlob(data);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setFile(new File([blob], receiptFilename(data), { type: "image/png" }));
        setPreviewUrl(url);
      } catch (err) {
        console.error("Receipt render failed:", err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setFile(null);
      setPreviewUrl(null);
    };
  }, [open, data]);

  const handleSendText = () => {
    window.open(
      buildWhatsAppLink(phone ?? "", text),
      "_blank",
      "noopener,noreferrer",
    );
    onOpenChange(false);
  };

  const handleSendImage = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      // Straight from the tap, nothing awaited first (see lib/utils/reminderShare.js).
      const result = await deliverReminder({
        phone: phone ?? "",
        message: text,
        files: [file],
      });
      switch (result.method) {
        case "share":
          toast.success("Share sheet opened — pick the chat", {
            description: result.copied
              ? "The receipt text is also copied."
              : undefined,
          });
          onOpenChange(false);
          break;
        case "fallback":
          toast.success("Receipt downloaded and WhatsApp opened", {
            description:
              "Your browser can't attach files directly — attach the image in the chat.",
          });
          onOpenChange(false);
          break;
        case "needs-tap":
          toast.info("Tap “Send as image” once more to open the share sheet.");
          break;
        case "blocked":
          toast.info(
            "Your browser blocked the popup — try “Send as text” instead.",
          );
          break;
        default:
          break; // cancelled
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't share the receipt");
    } finally {
      setBusy(false);
    }
  };

  const shareSheet = file ? canShareFiles([file]) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm p-0 gap-0 flex flex-col max-h-[92svh] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/60 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">Send receipt</DialogTitle>
              <DialogDescription className="text-sm mt-0.5 truncate">
                {contact?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="rounded-xl border bg-muted/30 p-2 flex items-center justify-center min-h-40">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Payment receipt"
                  className="w-full rounded-lg border bg-white"
                />
              ) : failed ? (
                <p className="text-sm text-muted-foreground p-6 text-center">
                  Couldn't draw the receipt image. You can still send it as
                  text.
                </p>
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="space-y-1.5">
              <Button
                className="w-full gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSendText}
              >
                <MessageCircle className="w-4 h-4" />
                {phone ? `Send as text to ${phone}` : "Send as text"}
              </Button>
              <p className="text-sm text-muted-foreground">
                {phone
                  ? "Opens their chat with the receipt typed in."
                  : "No phone number saved — WhatsApp will ask who to send it to."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Button
                variant="outline"
                className="w-full gap-1.5"
                onClick={handleSendImage}
                disabled={!file || busy}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                Send as image
              </Button>
              <p className="text-sm text-muted-foreground">
                {shareSheet || !file
                  ? "WhatsApp can't open a chat with a picture attached, so you'll choose the chat yourself in the share sheet. The text is copied in case it isn't included."
                  : "This browser can't attach files: the image is downloaded and the chat opened — attach it there."}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
