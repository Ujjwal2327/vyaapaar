"use client";

/**
 * components/documents/DocumentCard.jsx
 *
 * One row in the Documents list. Deliberately shows no "due" / "paid" / balance
 * figures — a document is not part of the ledger until it is converted.
 */

import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Truck,
  CalendarClock,
  CheckCircle2,
  Ban,
  Clock,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import {
  displayStatus,
  docRef,
  itemsPreview,
  partyName,
  typeInfo,
} from "@/lib/utils/documentUtils";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const STATUS_STYLES = {
  open: {
    label: "Open",
    icon: Clock,
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  expired: {
    label: "Expired",
    icon: CalendarClock,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  converted: {
    label: "Converted",
    icon: CheckCircle2,
    cls: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

export const StatusBadge = ({ doc, className = "" }) => {
  const s = STATUS_STYLES[displayStatus(doc)] ?? STATUS_STYLES.open;
  const Icon = s.icon;
  return (
    <Badge
      className={`${s.cls} border-0 text-sm px-2 py-0.5 gap-1 ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {s.label}
    </Badge>
  );
};

export const DocumentCard = ({ doc, onClick }) => {
  const isChallan = doc.docType === "challan";
  const Icon = isChallan ? Truck : FileText;
  const inactive = doc.status === "cancelled";
  const preview = itemsPreview(doc);

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-xl border p-4 cursor-pointer transition-colors hover:bg-muted/40 active:bg-muted/60 ${
        inactive ? "opacity-60 border-dashed" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-indigo-100 dark:bg-indigo-900/50">
          <Icon className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-base truncate">
                {partyName(doc)}
              </p>
              <p className="text-sm text-muted-foreground font-mono truncate">
                {doc.docNo
                  ? doc.docNo
                  : `${typeInfo(doc.docType).short} · number pending`}
                {!doc.docNo && <span className="sr-only">{docRef(doc)}</span>}
              </p>
            </div>
            <p className="text-xl font-bold tabular-nums shrink-0">
              {fmt(doc.totalAmount)}
            </p>
          </div>

          {preview && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {preview}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusBadge doc={doc} />
            {doc.gst && (
              <Badge className="text-sm px-2 py-0.5 border-0 bg-primary/10 text-primary font-normal">
                GST
              </Badge>
            )}
            {doc.status === "converted" && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <Receipt className="w-3.5 h-3.5" />
                Now a sale
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {doc.createdAt ? format(new Date(doc.createdAt), "d MMM yy") : ""}
              {doc.docType === "quotation" &&
              doc.status === "open" &&
              doc.validUntil
                ? ` · valid till ${format(new Date(`${doc.validUntil}T00:00:00`), "d MMM")}`
                : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
