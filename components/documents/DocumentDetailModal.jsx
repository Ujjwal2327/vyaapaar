"use client";

/**
 * components/documents/DocumentDetailModal.jsx
 *
 * Read-only view of one quotation / challan, with the actions that make sense
 * for its state:
 *
 *   open       → Convert to sale (one tap), Edit, Cancel, PDF / Share
 *   converted  → a "now a sale" banner with a link to the sale; no way to
 *                convert again (the button is gone, and the database would
 *                refuse to create a second sale even if it were somehow pressed)
 *   cancelled  → a banner; PDF only
 *
 * "Convert" is a single tap on purpose. It is safe to be one tap because it is
 * idempotent end to end (see hooks/useDocuments.js): the button disables while
 * the conversion runs, and a repeat — double tap, second device, retry — can
 * never create a second sale.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Truck,
  Receipt,
  Edit2,
  Ban,
  FileDown,
  Share2,
  Loader2,
  CheckCircle2,
  ArrowRight,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { GstBreakup } from "@/components/gst/GstFields";
import { StatusBadge } from "@/components/documents/DocumentCard";
import {
  computeDocTotals,
  docRef,
  lineAmount,
  partyName,
  typeInfo,
} from "@/lib/utils/documentUtils";
import { parseRate, stateLabel } from "@/lib/utils/gstUtils";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n ?? 0);

const fmtNum = (n) => {
  const v = parseFloat(n);
  return isNaN(v) ? "0" : String(v);
};

const safeDate = (iso, pattern = "d MMM yyyy, h:mm a") => {
  try {
    return format(new Date(iso), pattern);
  } catch {
    return "";
  }
};

export const DocumentDetailModal = ({
  open,
  onOpenChange,
  doc,
  contact,
  business,
  converting = false,
  onConvert,
  onEdit,
  onCancel,
  onViewSale,
}) => {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showPrices, setShowPrices] = useState(false); // challan only

  if (!doc) return null;

  const info = typeInfo(doc.docType);
  const isChallan = doc.docType === "challan";
  const Icon = isChallan ? Truck : FileText;
  const isOpen = doc.status === "open";
  const { total, calc } = computeDocTotals(doc);
  const extras = (doc.additionalAmounts ?? []).filter((e) => e?.name);

  const runPdf = async (mode) => {
    if (pdfBusy) return;
    setPdfBusy(true);
    const t = toast.loading("Preparing PDF...");
    try {
      const { downloadDocumentPdf, shareDocumentPdf } =
        await import("@/lib/utils/documentPdfGenerator");
      const args = { doc, business, showPrices: !isChallan || showPrices };
      if (mode === "share") {
        const r = await shareDocumentPdf(args);
        if (r.method === "cancelled") toast.dismiss(t);
        else
          toast.success(
            r.method === "share" ? "Ready to share" : "PDF downloaded",
            { id: t },
          );
      } else {
        await downloadDocumentPdf(args);
        toast.success("PDF downloaded", { id: t });
      }
    } catch (err) {
      console.error("Document PDF failed:", err);
      toast.error("Couldn't prepare the PDF", {
        id: t,
        description: "Please try again.",
      });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg p-0 gap-0 flex flex-col h-[90svh] overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-tight">
                {info.label}
              </DialogTitle>
              <p className="text-sm text-muted-foreground font-mono mt-0.5 break-all">
                {doc.docNo ?? `${docRef(doc)} · number pending`}
              </p>
            </div>
            <StatusBadge doc={doc} className="mr-6" />
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-4 py-3 space-y-4 min-w-0">
            {/* state banners */}
            {doc.status === "converted" && (
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2.5 space-y-2">
                <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold">Converted to a sale</span>
                    {doc.convertedAt ? ` on ${safeDate(doc.convertedAt)}` : ""}.
                    The sale already counts in the ledger and stock — this
                    document can't be converted again.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onViewSale?.(doc)}
                >
                  <Receipt className="w-4 h-4" />
                  View the sale
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            {doc.status === "cancelled" && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                <Ban className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  This document was cancelled. It had no effect on the ledger or
                  stock.
                </p>
              </div>
            )}
            {isOpen && (
              <p className="text-sm text-muted-foreground">
                Open. Nothing here is in the ledger or stock yet — it only
                happens when you convert it to a sale, using the prices below.
              </p>
            )}

            {/* party + dates */}
            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-base">
                <User className="w-4 h-4 text-muted-foreground" />
                {partyName(doc)}
              </p>
              {contact?.phones?.find((p) => p?.trim()) && (
                <p className="text-muted-foreground">
                  {contact.phones.find((p) => p?.trim())}
                </p>
              )}
              {(doc.party?.address || contact?.address) && (
                <p className="text-muted-foreground">
                  {doc.party?.address || contact?.address}
                </p>
              )}
              <p className="text-muted-foreground">
                Created {safeDate(doc.createdAt)}
              </p>
              {doc.docType === "quotation" && doc.validUntil && (
                <p className="text-muted-foreground">
                  Valid until{" "}
                  {safeDate(`${doc.validUntil}T00:00:00`, "d MMM yyyy")}
                </p>
              )}
              {doc.gst && (
                <p className="text-muted-foreground">
                  GST · place of supply{" "}
                  {stateLabel(doc.gst.placeOfSupply) || "—"} · prices{" "}
                  {doc.gst.mode === "inclusive" ? "include" : "exclude"} GST
                  {doc.gst.buyer?.gstin
                    ? ` · buyer ${doc.gst.buyer.gstin}`
                    : " · unregistered buyer"}
                </p>
              )}
            </div>

            {/* items */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Items (quoted prices)
              </Label>
              <div className="border rounded-lg divide-y overflow-hidden">
                {(doc.itemsList ?? []).map((l, i) => {
                  const parts = (l.name || "").split(" › ");
                  const cat = parts.slice(0, -1).join(" › ");
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-3 overflow-hidden"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug truncate">
                          {parts[parts.length - 1] || "Unnamed"}
                        </p>
                        {cat && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {cat}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-sm text-muted-foreground font-mono">
                            {fmtNum(l.quantity)}
                            {l.unit ? ` ${l.unit}` : ""} ×{" "}
                            {fmt(parseFloat(l.price) || 0)}
                          </span>
                          {doc.gst && parseRate(l.gstRate) !== null && (
                            <span className="text-[0.7em] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium whitespace-nowrap">
                              GST {parseRate(l.gstRate)}%
                              {l.hsn ? ` · HSN ${l.hsn}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-semibold tabular-nums whitespace-nowrap pt-0.5">
                        {fmt(lineAmount(l))}
                      </p>
                    </div>
                  );
                })}
                {extras.map((e, i) => (
                  <div
                    key={`x${i}`}
                    className="py-2.5 px-3 flex justify-between gap-2 text-sm min-w-0"
                  >
                    <span className="text-muted-foreground truncate min-w-0">
                      {e.name}
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${parseFloat(e.amount) < 0 ? "text-red-600" : ""}`}
                    >
                      {fmt(parseFloat(e.amount) || 0)}
                    </span>
                  </div>
                ))}
              </div>
              {calc ? (
                <GstBreakup calc={calc} />
              ) : (
                <div className="flex justify-between font-semibold text-sm px-0.5">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(total)}</span>
                </div>
              )}
            </div>

            {doc.note?.trim() && (
              <div>
                <Label className="text-base font-semibold mb-1 block">
                  Note
                </Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {doc.note}
                </p>
              </div>
            )}

            <Separator />

            {/* PDF */}
            <div className="space-y-2">
              {isChallan && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="challan-prices"
                    checked={showPrices}
                    onCheckedChange={(v) => setShowPrices(v === true)}
                  />
                  <Label
                    htmlFor="challan-prices"
                    className="text-sm font-normal text-muted-foreground cursor-pointer"
                  >
                    Show rates and amounts on the challan PDF
                  </Label>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={pdfBusy}
                  onClick={() => runPdf("download")}
                >
                  {pdfBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={pdfBusy}
                  onClick={() => runPdf("share")}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-3 space-y-2 bg-background shrink-0">
          {isOpen && (
            <Button
              className="w-full gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onConvert?.(doc)}
              disabled={converting}
            >
              {converting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Receipt className="w-4 h-4" />
              )}
              {converting ? "Converting…" : "Convert to sale"}
            </Button>
          )}
          <div className="flex items-center gap-2">
            {isOpen && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => onEdit?.(doc)}
                  disabled={converting}
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => onCancel?.(doc)}
                  disabled={converting}
                >
                  <Ban className="w-4 h-4" />
                  Cancel
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
