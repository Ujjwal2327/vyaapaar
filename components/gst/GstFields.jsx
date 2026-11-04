"use client";

/**
 * components/gst/GstFields.jsx  (v3)
 *
 * v3: ItemTaxInputs / RateSelect take variant="form" — full-size labelled
 * HSN + GST-rate fields for the catalog Add/Edit item dialogs (the default
 * "compact" look is for the cramped qty × price rows on a bill).
 *
 * Changes in v2 vs v1:
 *  - RateSelect and the place-of-supply picker now use the shadcn <Select>
 *    (Radix) instead of native <select>. The native ones were the source of the
 *    "white text on white background" dropdown in dark mode: the closed box was
 *    themed, but the OS-drawn option list was not.
 *  - HSN field uses the shadcn <Input>.
 *  - New RememberTaxCheckbox (shadcn <Checkbox> + <Label>) replaces the raw
 *    <input type="checkbox"> that AddTransactionModal and TransactionDetailModal
 *    each had.
 *
 * The small GST building blocks shared by the new-bill modal, the transaction
 * detail/edit modal and the catalog item forms:
 *
 *   RateSelect / ItemTaxInputs  – the HSN + GST-rate pair on an item line
 *   RememberTaxCheckbox         – "save these to the catalog item"
 *   SellerGstinInline           – asks for the shop's own GSTIN, once, inline
 *   GstBillPanel                – per-bill switch + price mode + buyer GSTIN
 *                                 + place of supply
 *   GstBreakup                  – taxable / CGST / SGST|IGST / round-off / total
 *
 * Nothing here decides WHETHER GST shows — callers gate on useGst().enabled
 * (or on the bill already being a GST bill).
 */

import { useId, useState } from "react";
import { toast } from "sonner";
import { Receipt, AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GST_RATE_OPTIONS,
  GST_LEGACY_RATE_OPTIONS,
  GST_STATE_OPTIONS,
  gstinProblem,
  gstinState,
  normalizeGstin,
  normalizeHsn,
  stateLabel,
} from "@/lib/utils/gstUtils";

const fmtMoney = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

const fmtRate = (r) => `${Number((Number(r) || 0).toFixed(3))}%`;

// Matches the compact qty / unit / price boxes next to it in the cart rows.
const compactTrigger =
  "h-8 border-0 bg-muted px-2 text-sm font-mono shadow-none focus-visible:ring-1";

// Radix <SelectItem> can't have an empty value, so "no choice / automatic" gets
// a sentinel that is translated back to "" at the edge.
const AUTO = "__auto__";

// ─── rate + HSN on an item line ──────────────────────────────────────────────

export const RateSelect = ({
  value,
  onChange,
  className = "",
  autoLabel = null, // e.g. "Auto (18%)" → adds an option meaning "decide for me"
  variant = "compact", // "compact" (bill rows) | "form" (normal full-size field)
  id,
}) => {
  const empty = value === null || value === undefined || value === "";
  const current = empty ? (autoLabel ? AUTO : "") : String(value);

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === AUTO ? "" : v)}
    >
      <SelectTrigger
        id={id}
        {...(variant === "form" ? {} : { size: "sm" })}
        aria-label="GST rate"
        className={cn(
          variant === "form" ? "w-full" : compactTrigger,
          className,
        )}
      >
        <SelectValue placeholder="Rate…" />
      </SelectTrigger>
      <SelectContent>
        {autoLabel && <SelectItem value={AUTO}>{autoLabel}</SelectItem>}
        {GST_RATE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
        {GST_LEGACY_RATE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/**
 * HSN + GST rate for one item. Renders two label-over-input columns so it
 * drops straight into the qty × price rows the item forms already use.
 */
export const ItemTaxInputs = ({
  hsn,
  gstRate,
  onHsn,
  onRate,
  variant = "compact",
}) => {
  const uid = useId();

  if (variant === "form") {
    return (
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-hsn`}>HSN code</Label>
            <Input
              id={`${uid}-hsn`}
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={hsn ?? ""}
              onChange={(e) => onHsn(normalizeHsn(e.target.value))}
              placeholder="e.g. 3917"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-rate`}>GST rate</Label>
            <RateSelect
              id={`${uid}-rate`}
              variant="form"
              value={gstRate}
              onChange={onRate}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          HSN is the product code printed on tax invoices — 4 digits is enough
          for most small shops. Ask your CA if you're unsure of the code or
          rate.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
          HSN
        </span>
        <Input
          type="text"
          inputMode="numeric"
          maxLength={8}
          value={hsn ?? ""}
          onChange={(e) => onHsn(normalizeHsn(e.target.value))}
          placeholder="e.g. 3917"
          aria-label="HSN code"
          className="h-8 w-20 min-w-0 border-0 bg-muted px-2 font-mono text-sm shadow-none focus-visible:ring-1"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
          GST
        </span>
        <RateSelect value={gstRate} onChange={onRate} className="w-24" />
      </div>
    </>
  );
};

/** "Save the HSN & rate I just typed onto the catalog item". */
export const RememberTaxCheckbox = ({ checked, onChange }) => {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label
        htmlFor={id}
        className="text-sm font-normal text-muted-foreground cursor-pointer"
      >
        Remember HSN &amp; rate for this item
      </Label>
    </div>
  );
};

// ─── the shop's own GSTIN, asked once ────────────────────────────────────────

export const SellerGstinInline = ({ gst, onSaved }) => {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const problem = gstinProblem(value);
  const ready = normalizeGstin(value).length === 15 && !problem;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const g = await gst.saveGstin(value);
      toast.success("GSTIN saved", {
        description: `Registered in ${stateLabel(gstinState(g))}`,
      });
      onSaved?.(g);
    } catch (e) {
      toast.error(e?.message || "Couldn't save your GSTIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
        Add your GSTIN to issue GST invoices
      </p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) =>
            setValue(normalizeGstin(e.target.value).slice(0, 15))
          }
          placeholder="15-character GSTIN"
          className="h-10 font-mono uppercase"
          maxLength={15}
          autoCapitalize="characters"
        />
        <Button
          type="button"
          onClick={save}
          disabled={!ready || saving}
          className="shrink-0"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span className="ml-1">Save</span>
        </Button>
      </div>
      {problem && (
        <p className="text-sm text-destructive flex items-start gap-1">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {problem}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Asked once — it's saved to your profile.
      </p>
    </div>
  );
};

// ─── the per-bill panel ──────────────────────────────────────────────────────

/**
 * draft: { on, mode, pos, buyerGstin }  (pos/buyerGstin null = automatic)
 * resolved: result of resolveBillGst for the same inputs
 * canSwitch: false once a bill IS a GST invoice (it can't turn back into a
 *   plain bill — its number has been, or will be, issued).
 * hideSellerPrompt lets the edit form reuse this without the seller-GSTIN box.
 */
export const GstBillPanel = ({
  gst,
  draft,
  resolved,
  onChange,
  contactGstin = "",
  canSwitch = true,
  hideSellerPrompt = false,
}) => {
  const sellerReady = hideSellerPrompt || !!gst.gstin;

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {canSwitch ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-base font-medium leading-tight">GST invoice</p>
              <p className="text-sm text-muted-foreground">
                {draft.on
                  ? "Tax invoice with an auto-numbered series"
                  : "Off for this bill — it's a plain bill"}
              </p>
            </div>
          </div>
          <Switch
            checked={draft.on}
            onCheckedChange={(v) => onChange({ on: v })}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary shrink-0" />
          <p className="text-base font-medium">GST details</p>
        </div>
      )}

      {draft.on && (
        <>
          {!sellerReady && <SellerGstinInline gst={gst} />}

          {/* prices include GST or not */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              Item prices
            </p>
            <div className="flex gap-1 p-1 rounded-lg bg-muted">
              {[
                { id: "exclusive", label: "Exclude GST (add on top)" },
                { id: "inclusive", label: "Include GST" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange({ mode: id })}
                  className={`flex-1 min-h-8 px-2 py-1 rounded-md text-sm font-medium transition-all ${
                    draft.mode === id
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* buyer */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              Buyer GSTIN{" "}
              <span className="font-normal">(blank = unregistered buyer)</span>
            </p>
            <Input
              value={resolved.buyerGstin}
              onChange={(e) =>
                onChange({
                  buyerGstin: normalizeGstin(e.target.value).slice(0, 15),
                })
              }
              placeholder={contactGstin || "15-character GSTIN"}
              className={cn(
                "h-10 font-mono uppercase",
                resolved.buyerProblem && "border-destructive",
              )}
              maxLength={15}
              autoCapitalize="characters"
            />
            {resolved.buyerProblem ? (
              <p className="text-sm text-destructive flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {resolved.buyerProblem}
              </p>
            ) : resolved.buyerValid ? (
              <p className="text-sm text-muted-foreground">
                Registered buyer — HSN is required on every item.
              </p>
            ) : null}
          </div>

          {/* place of supply */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              Place of supply
            </p>
            <Select
              value={resolved.pos || ""}
              onValueChange={(v) => onChange({ pos: v })}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Choose a state…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {GST_STATE_OPTIONS.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {resolved.intra
                ? "Same state as you — CGST + SGST."
                : "Different state from you — IGST."}
            </p>
            {resolved.buyerValid &&
              resolved.pos &&
              gstinState(resolved.buyerGstin) !== resolved.pos && (
                <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  The buyer's GSTIN is from{" "}
                  {stateLabel(gstinState(resolved.buyerGstin))}, but you chose{" "}
                  {stateLabel(resolved.pos)}. That is correct only if the goods
                  are delivered to {stateLabel(resolved.pos)}. Otherwise pick
                  the buyer's state.
                </p>
              )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── tax breakup ─────────────────────────────────────────────────────────────

const Row = ({ label, value, bold = false }) => (
  <div
    className={`flex justify-between gap-3 ${bold ? "font-semibold border-t pt-1 mt-1" : "text-muted-foreground"}`}
  >
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

/** calc: the object computeGst / computeGstForTx returns. */
export const GstBreakup = ({ calc, className = "" }) => {
  if (!calc) return null;
  const rates = calc.byRate.filter((g) => g.rate > 0);
  return (
    <div
      className={`rounded-lg border bg-muted/30 p-3 space-y-0.5 text-sm ${className}`}
    >
      <Row label="Taxable value" value={fmtMoney(calc.taxable)} />
      {rates.map((g) =>
        calc.intra ? (
          <div key={g.rate} className="space-y-0.5">
            <Row
              label={`CGST ${fmtRate(g.rate / 2)}`}
              value={fmtMoney(g.cgst)}
            />
            <Row
              label={`SGST ${fmtRate(g.rate / 2)}`}
              value={fmtMoney(g.sgst)}
            />
          </div>
        ) : (
          <Row
            key={g.rate}
            label={`IGST ${fmtRate(g.rate)}`}
            value={fmtMoney(g.igst)}
          />
        ),
      )}
      {Math.abs(calc.roundOff) > 0.004 && (
        <Row
          label="Round off"
          value={`${calc.roundOff < 0 ? "−" : "+"}${fmtMoney(Math.abs(calc.roundOff))}`}
        />
      )}
      <Row label="Invoice total" value={fmtMoney(calc.grandTotal)} bold />
    </div>
  );
};
