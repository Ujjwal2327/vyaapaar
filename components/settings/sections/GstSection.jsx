"use client";

// v2 (GST review): added a notice about who GST invoicing is (and isn't) for.

/**
 * components/settings/sections/GstSection.jsx
 *
 * The one Settings switch for GST (off by default). Turning it on reveals the
 * GSTIN field right here, inline; everything else GST-related in the app
 * (per-bill switch, HSN/rate fields, GST columns on the invoice, the GSTR-1
 * export) is gated on this switch and simply isn't there while it's off.
 *
 * Turning it off never touches invoices already issued: a bill that was
 * created as a GST invoice stays one (its number and tax are part of the
 * record), it just stops being offered for NEW bills.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt, Check, Loader2, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettingsSectionCard } from "@/components/settings/SettingsUI";
import { useGst } from "@/hooks/useGst";
import {
  gstinProblem,
  gstinState,
  normalizeGstin,
  stateLabel,
} from "@/lib/utils/gstUtils";

export const GstSection = () => {
  const gst = useGst();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Fill the box with the saved GSTIN once the profile arrives.
  useEffect(() => {
    setValue(gst.gstin);
  }, [gst.gstin]);

  const problem = gstinProblem(value);
  const normalized = normalizeGstin(value);
  const changed = normalized !== gst.gstin;
  const canSave = normalized.length === 15 && !problem && changed;

  const toggle = async (next) => {
    if (busy) return;
    setBusy(true);
    try {
      await gst.setEnabled(next);
      toast.success(next ? "GST billing is on" : "GST billing is off", {
        description: next
          ? "New sales default to GST invoices — you can switch it off per bill."
          : "Invoices you've already issued stay as they are.",
      });
    } catch (e) {
      console.error("GST toggle failed:", e);
      toast.error("Couldn't change this setting", {
        description: "Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await gst.saveGstin(value);
      toast.success("GSTIN saved");
    } catch (e) {
      toast.error(e?.message || "Couldn't save your GSTIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSectionCard
      icon={Receipt}
      title="GST billing"
      description="Issue GST tax invoices with an auto-numbered series, and export GSTR-1."
      action={
        <Switch
          checked={gst.enabled}
          onCheckedChange={toggle}
          disabled={busy || gst.isLoading}
        />
      }
    >
      {gst.enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gstin" className="text-[16px]">
              Your GSTIN
            </Label>
            <div className="flex gap-2">
              <Input
                id="gstin"
                value={value}
                onChange={(e) =>
                  setValue(normalizeGstin(e.target.value).slice(0, 15))
                }
                placeholder="15-character GSTIN"
                className={`font-mono uppercase ${problem ? "border-destructive" : ""}`}
                maxLength={15}
                autoCapitalize="characters"
              />
              <Button onClick={save} disabled={!canSave || saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span className="ml-1">Save</span>
              </Button>
            </div>
            {problem ? (
              <p className="text-sm text-destructive flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {problem}
              </p>
            ) : gst.gstin && !changed ? (
              <p className="text-sm text-muted-foreground">
                Registered in {stateLabel(gstinState(gst.gstin))}. Sales to
                buyers in other states are billed with IGST.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Needed before the first GST invoice. You can also add it from
                the bill itself.
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              For regular GST registrations only. Composition dealers can't
              charge GST or issue tax invoices (they issue a Bill of Supply),
              and unregistered businesses can't issue GST invoices. Not covered:
              credit/debit notes, reverse charge, exports/SEZ, e-invoicing (IRN)
              and e-way bills.
            </span>
          </div>

          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>New sales are GST invoices by default; switch off per bill.</li>
            <li>
              HSN and rate are asked once per item, then remembered in the
              catalog.
            </li>
            <li>
              Invoice numbers look like <code>INV/26-27/00001</code>, restart
              each April 1, and are never reused — a deleted invoice keeps its
              number and is reported as cancelled.
            </li>
            <li>
              A GSTR-1 export appears in Reports once you've issued a GST
              invoice. This is a standard tax invoice, not an e-invoice (IRN).
            </li>
          </ul>
        </div>
      )}
    </SettingsSectionCard>
  );
};
