"use client";

/**
 * components/gst/Gstr1ExportDialog.jsx  (v2)
 *
 * v2:
 *  - Fixes a race: switching the month while a month was still loading let the
 *    slower response overwrite the newer one, so the dialog could show (and
 *    export) a different month than the one selected. Each load now carries a
 *    ticket and stale responses are dropped.
 *  - The JSON button says it is a draft for the portal's offline tool (the GSTN
 *    publishes no official schema), and the CSV register is offered first
 *    since that is what a CA actually reviews.
 *  - Uses the shadcn <Label>.
 *
 * Month-wise GSTR-1 export: pick a month, see what it contains, download the
 * JSON for the GST portal / offline tool or a CSV register for your CA.
 *
 * Shown only from Reports, and only once a GST invoice exists (the button is
 * gated by the caller). It reads the invoices straight from the server rather
 * than the local cache — what you file must be what's authoritative — so it
 * needs a connection.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  WifiOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useGst } from "@/hooks/useGst";
import { buildGstr1, gstr1PeriodRange, registerToCsv } from "@/lib/utils/gstr1";
import { istParts, normalizeGstin } from "@/lib/utils/gstUtils";

const PAGE_SIZE = 1000;
const COLUMNS =
  "id, status, items_list, additional_amounts, created_at, gst, invoice_no, invoice_seq, invoice_fy";

const rowToDoc = (r) => ({
  id: r.id,
  status: r.status,
  itemsList: r.items_list ?? [],
  additionalAmounts: r.additional_amounts ?? [],
  createdAt: r.created_at,
  gst: r.gst,
  invoiceNo: r.invoice_no,
  invoiceSeq: r.invoice_seq,
  invoiceFy: r.invoice_fy,
});

const fmtMoney = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n ?? 0);

const download = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const currentMonthValue = () => {
  const { year, month } = istParts(new Date());
  return `${year}-${String(month).padStart(2, "0")}`;
};

export const Gstr1ExportDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const gst = useGst();

  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [state, setState] = useState({ status: "idle" }); // idle | loading | ready | error
  const ticketRef = useRef(0);

  const [year, month] = useMemo(() => {
    const [y, m] = monthValue.split("-").map(Number);
    return [y, m];
  }, [monthValue]);

  const load = useCallback(async () => {
    if (!user || !gst.gstin || !year || !month) return;
    const ticket = ++ticketRef.current;
    setState({ status: "loading" });
    try {
      const { startIso, endIso } = gstr1PeriodRange(year, month);
      const rows = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("transactions")
          .select(COLUMNS)
          .eq("user_id", user.id)
          .not("invoice_no", "is", null)
          .gte("created_at", startIso)
          .lt("created_at", endIso)
          .order("invoice_seq", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE_SIZE) break;
      }

      // GST bills of this month that never got a number (still syncing).
      const { count: unnumbered, error: countErr } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("gst", "is", null)
        .is("invoice_no", null)
        .neq("status", "deleted")
        .gte("created_at", startIso)
        .lt("created_at", endIso);
      if (countErr) throw countErr;

      if (ticket !== ticketRef.current) return; // a newer month was picked

      const docs = rows.map(rowToDoc);
      const built = buildGstr1({ rows: docs, gstin: gst.gstin, year, month });

      const extra = [];
      if (unnumbered > 0)
        extra.push(
          `${unnumbered} GST bill${unnumbered !== 1 ? "s" : ""} from this month ${unnumbered !== 1 ? "are" : "is"} still waiting for an invoice number (not synced yet) and ${unnumbered !== 1 ? "are" : "is"} not included. Sync, then export again.`,
        );
      const otherGstin = docs.some(
        (d) =>
          d.status !== "deleted" &&
          normalizeGstin(d.gst?.seller?.gstin) !== normalizeGstin(gst.gstin),
      );
      if (otherGstin)
        extra.push(
          "Some invoices were issued under a different GSTIN than the one in Settings. The file uses your current GSTIN — check before filing.",
        );

      setState({
        status: "ready",
        ...built,
        warnings: [...extra, ...built.warnings],
      });
    } catch (err) {
      console.error("GSTR-1 export failed:", err);
      if (ticket === ticketRef.current) setState({ status: "error" });
    }
  }, [user, gst.gstin, year, month]);

  useEffect(() => {
    if (open && isOnline) load();
    // Drop any in-flight response when the dialog closes.
    return () => {
      ticketRef.current += 1;
    };
  }, [open, isOnline, load]);

  const stem = `GSTR1_${gst.gstin}_${String(month).padStart(2, "0")}${year}`;
  const ready = state.status === "ready";
  const empty = ready && state.totals.invoices + state.totals.cancelled === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 flex flex-col max-h-[92svh] overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base">GSTR-1 export</DialogTitle>
          <DialogDescription className="text-sm">
            Outward supplies from your GST invoices, for one month
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {!gst.gstin ? (
              <p className="text-sm text-muted-foreground">
                Add your GSTIN in Settings → Profile → GST billing to export.
              </p>
            ) : !isOnline ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  The export reads your invoices from the server, so it needs an
                  internet connection.
                </span>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="gstr1-month"
                    className="text-base font-medium"
                  >
                    Return period
                  </Label>
                  <Input
                    id="gstr1-month"
                    type="month"
                    value={monthValue}
                    max={currentMonthValue()}
                    onChange={(e) =>
                      e.target.value && setMonthValue(e.target.value)
                    }
                    className="h-11"
                  />
                </div>

                {state.status === "loading" && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reading invoices…
                  </div>
                )}

                {state.status === "error" && (
                  <div className="text-sm text-center space-y-2 py-4">
                    <p className="text-muted-foreground">
                      Couldn't read your invoices. Check your connection and try
                      again.
                    </p>
                    <Button variant="outline" size="sm" onClick={load}>
                      Retry
                    </Button>
                  </div>
                )}

                {empty && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No GST invoices in this month.
                  </p>
                )}

                {ready && !empty && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["Invoices", state.totals.invoices],
                        ["Cancelled", state.totals.cancelled],
                        ["Taxable value", fmtMoney(state.totals.taxable)],
                        ["Total tax", fmtMoney(state.totals.tax)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border p-3">
                          <p className="text-sm text-muted-foreground">
                            {label}
                          </p>
                          <p className="text-lg font-semibold tabular-nums">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      CGST {fmtMoney(state.totals.cgst)} · SGST{" "}
                      {fmtMoney(state.totals.sgst)} · IGST{" "}
                      {fmtMoney(state.totals.igst)} · {state.totals.b2b} to
                      registered buyers (B2B)
                    </p>

                    {state.warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400 space-y-1.5">
                        <p className="font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          Check before filing
                        </p>
                        {state.warnings.map((w, i) => (
                          <p key={i}>• {w}</p>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={() =>
                          download(
                            registerToCsv(state.register),
                            `${stem}_register.csv`,
                            "text/csv;charset=utf-8",
                          )
                        }
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Invoice register (CSV)
                      </Button>
                      <Button
                        className="flex-1 gap-1.5"
                        onClick={() => {
                          download(
                            JSON.stringify(state.json, null, 2),
                            `${stem}.json`,
                            "application/json",
                          );
                          toast.success("GSTR-1 JSON downloaded");
                        }}
                      >
                        <FileJson className="w-4 h-4" />
                        GSTR-1 JSON (draft)
                      </Button>
                    </div>

                    <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                      <Download className="w-4 h-4 shrink-0 mt-0.5" />
                      The JSON follows the GST offline tool's layout, but the
                      GST network publishes no official schema, so treat it as a
                      draft: import it in the offline tool or portal and check
                      every table before filing. Give the CSV register to your
                      CA. This app doesn't file the return for you.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
