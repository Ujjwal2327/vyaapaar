"use client";

/**
 * components/documents/DocumentFormModal.jsx
 *
 * Create / edit a quotation or delivery challan on one scrolling form (these
 * have no payment step, so the bill wizard isn't needed).
 *
 * Prices are a SNAPSHOT: picking a catalog item copies its current retail (or
 * bulk, per the catalog's R/B switch) price onto the line, where it can be
 * edited. Whatever is saved here is what converting to a sale uses later —
 * the catalog is never consulted again for prices.
 *
 * Reuses the same GST building blocks as the bill form (GstBillPanel,
 * ItemTaxInputs, RateSelect, GstBreakup) and the catalog search the catalog
 * page uses (filterData), so a document and a bill behave the same way.
 */

import { useState, useEffect, useMemo, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Truck,
  Plus,
  Trash2,
  Search,
  X,
  User,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { usePriceList } from "@/hooks/usePriceList";
import { useGst } from "@/hooks/useGst";
import {
  GstBillPanel,
  GstBreakup,
  ItemTaxInputs,
  RateSelect,
} from "@/components/gst/GstFields";
import { buildSearchIndex, filterData } from "@/lib/utils/priceListUtils";
import { forEachCatalogItem } from "@/lib/utils/catalogPath";
import {
  buildGstSnapshot,
  computeGst,
  highestRate,
  normalizeHsn,
  parseRate,
  resolveBillGst,
  validateGstLines,
} from "@/lib/utils/gstUtils";
import { addDaysISO, typeInfo } from "@/lib/utils/documentUtils";

const fmt = (n) =>
  `₹${(+n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const inputCls =
  "bg-muted border-0 rounded px-2 py-1 text-sm font-mono outline-none focus:bg-primary/10 focus:ring-1 focus:ring-primary min-w-0 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// ─── contact picker (optional) ───────────────────────────────────────────────

const ContactPicker = ({ peopleData, selected, onSelect }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return peopleData
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [peopleData, query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{selected.name}</p>
            <p className="text-sm text-muted-foreground capitalize">
              {selected.category}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Remove contact"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder="Search contacts…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          clearTimeout(timer.current);
          setOpen(true);
        }}
        onBlur={() => {
          timer.current = setTimeout(() => setOpen(false), 150);
        }}
        className="w-full pl-10 pr-3 h-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && (
        <div className="absolute z-[200] top-full mt-1 left-0 right-0 rounded-md border bg-popover shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              {query ? `No contacts matching "${query}"` : "No contacts yet"}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((p) => {
                const phone = (p.phones ?? []).find((ph) => ph?.trim());
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(p);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2.5 text-sm hover:bg-accent text-left flex items-start gap-2"
                  >
                    <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="capitalize">{p.category}</span>
                        {phone && <span> · {phone}</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── one editable line ───────────────────────────────────────────────────────

const LineRow = ({ line, onChange, onRemove, gstOn }) => {
  const parts = (line.name || "").split(" › ");
  const path = parts.length > 1 ? parts.slice(0, -1).join(" › ") : "";
  const qty = parseFloat(line.quantity) || 0;
  const price = parseFloat(line.price) || 0;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={line.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Item name"
            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm font-medium outline-none focus:ring-1 focus:ring-primary"
          />
          {path && (
            <p className="text-sm text-muted-foreground truncate px-1 mt-0.5">
              {path}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground shrink-0"
          aria-label="Remove line"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
            Qty
          </span>
          <input
            type="number"
            min="0"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            className={`${inputCls} w-16`}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
            Unit
          </span>
          <input
            type="text"
            value={line.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            placeholder="—"
            className={`${inputCls} w-16`}
          />
        </div>
        <span className="text-sm text-muted-foreground pb-1.5">×</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
            Price ₹
          </span>
          <input
            type="number"
            min="0"
            value={line.price}
            onChange={(e) => onChange({ price: e.target.value })}
            className={`${inputCls} w-20`}
          />
        </div>
        {gstOn && (
          <ItemTaxInputs
            hsn={line.hsn}
            gstRate={line.gstRate}
            onHsn={(v) => onChange({ hsn: v })}
            onRate={(v) => onChange({ gstRate: v })}
          />
        )}
        {qty > 0 && price > 0 && (
          <span className="text-sm font-semibold tabular-nums text-primary pb-1.5">
            = {fmt(qty * price)}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── the form ────────────────────────────────────────────────────────────────

export const DocumentFormModal = ({
  open,
  onOpenChange,
  docType = "quotation",
  editing = null,
  peopleData = [],
  onSave,
}) => {
  const info = typeInfo(editing?.docType ?? docType);
  const isQuotation = (editing?.docType ?? docType) === "quotation";
  const Icon = isQuotation ? FileText : Truck;

  const { priceData, sellPriceMode } = usePriceList();
  const gstCfg = useGst();

  const [contactId, setContactId] = useState(null);
  const [typedName, setTypedName] = useState("");
  const [lines, setLines] = useState([]);
  const [extras, setExtras] = useState([]);
  const [note, setNote] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [gstOff, setGstOff] = useState(false);
  const [gstMode, setGstModeRaw] = useState("exclusive");
  const [gstPos, setGstPos] = useState(null);
  const [gstBuyerGstin, setGstBuyerGstin] = useState(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const setGstMode = (m) => {
    setGstModeRaw(m);
    try {
      localStorage.setItem("gstPriceMode", m);
    } catch {}
  };

  // Fill the form whenever it opens (editing → the document; else a blank one).
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSaving(false);

    let storedMode = "exclusive";
    try {
      const m = localStorage.getItem("gstPriceMode");
      if (m === "inclusive" || m === "exclusive") storedMode = m;
    } catch {}

    if (editing) {
      setContactId(editing.contactId ?? null);
      setTypedName(editing.contactId ? "" : (editing.party?.name ?? ""));
      setLines(
        (editing.itemsList ?? []).map((l) => ({
          name: l.name ?? "",
          quantity: String(l.quantity ?? ""),
          price: String(l.price ?? ""),
          unit: l.unit || "",
          hsn: l.hsn ?? "",
          gstRate:
            l.gstRate === undefined || l.gstRate === null
              ? ""
              : String(l.gstRate),
        })),
      );
      setExtras(
        (editing.additionalAmounts ?? []).map((e) => ({
          name: e.name ?? "",
          amount: String(e.amount ?? ""),
          note: e.note ?? "",
          gstRate:
            e.gstRate === undefined || e.gstRate === null
              ? ""
              : String(e.gstRate),
        })),
      );
      setNote(editing.note ?? "");
      setValidUntil(editing.validUntil ?? "");
      setGstOff(!editing.gst);
      setGstModeRaw(editing.gst?.mode ?? storedMode);
      setGstPos(editing.gst?.placeOfSupply ?? null);
      setGstBuyerGstin(editing.gst?.buyer?.gstin || null);
    } else {
      setContactId(null);
      setTypedName("");
      setLines([]);
      setExtras([]);
      setNote("");
      setValidUntil(isQuotation ? addDaysISO(15) : "");
      setGstOff(false);
      setGstModeRaw(storedMode);
      setGstPos(null);
      setGstBuyerGstin(null);
    }
  }, [open, editing, isQuotation]);

  const contact = useMemo(
    () => peopleData.find((p) => p.id === contactId) ?? null,
    [peopleData, contactId],
  );

  // ── catalog search (same engine as the catalog page) ─────────────────────
  const searchIndex = useMemo(() => buildSearchIndex(priceData), [priceData]);
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const filtered = filterData(priceData, query, searchIndex);
    const out = [];
    forEachCatalogItem(filtered, (segments, node) =>
      out.push({ segments, node }),
    );
    out.sort((a, b) => (b.node._matchScore ?? 0) - (a.node._matchScore ?? 0));
    return out.slice(0, 10);
  }, [priceData, searchIndex, query]);

  const addFromCatalog = ({ segments, node }) => {
    const retail = node.retailSell ?? node.sell ?? 0;
    const bulk = node.bulkSell ?? retail;
    setLines((prev) => [
      ...prev,
      {
        name: segments.join(" › "),
        quantity: "1",
        price: String(sellPriceMode === "bulk" ? bulk : retail), // the snapshot
        unit: node.sellUnit || "piece",
        hsn: node.hsn ?? "",
        gstRate: typeof node.gstRate === "number" ? String(node.gstRate) : "",
      },
    ]);
    setQuery("");
    setFocused(false);
  };

  const patchLine = (i, patch) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const patchExtra = (i, patch) =>
    setExtras((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  // ── GST ──────────────────────────────────────────────────────────────────
  const gstEligible = gstCfg.enabled || !!editing?.gst;
  const gstOn = gstEligible && !gstOff;
  const resolved = useMemo(
    () =>
      resolveBillGst({
        draft: { buyerGstin: gstBuyerGstin, pos: gstPos },
        sellerGstin: gstCfg.gstin,
        contactGstin: contact?.gstin,
      }),
    [gstBuyerGstin, gstPos, gstCfg.gstin, contact?.gstin],
  );
  const namedLines = lines.filter((l) => l.name.trim());
  const namedExtras = extras.filter((e) => e.name.trim());
  const calc = useMemo(
    () =>
      gstOn
        ? computeGst({
            items: namedLines,
            extras: namedExtras,
            mode: gstMode,
            intra: resolved.intra,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gstOn, lines, extras, gstMode, resolved.intra],
  );
  const gstProblems = useMemo(
    () =>
      gstOn
        ? validateGstLines(namedLines, { requireHsn: resolved.buyerValid })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gstOn, lines, resolved.buyerValid],
  );

  const plainTotal =
    namedLines.reduce(
      (s, l) => s + (parseFloat(l.price) || 0) * (parseFloat(l.quantity) || 0),
      0,
    ) + namedExtras.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const total = calc ? calc.grandTotal : Math.round(plainTotal * 100) / 100;

  const handleGstChange = (patch) => {
    if ("on" in patch) setGstOff(!patch.on);
    if ("mode" in patch) setGstMode(patch.mode);
    if ("pos" in patch) setGstPos(patch.pos);
    if ("buyerGstin" in patch) setGstBuyerGstin(patch.buyerGstin);
  };

  const gstReady =
    !gstOn ||
    (!!gstCfg.gstin &&
      !resolved.buyerProblem &&
      !!resolved.pos &&
      gstProblems.length === 0);
  const canSave = namedLines.length > 0 && total > 0 && gstReady && !saving;

  // ── save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const extraRate = highestRate(namedLines);
      const party = contact
        ? {
            name: contact.name,
            phone: (contact.phones ?? []).find((p) => p?.trim()) ?? "",
            address: contact.address ?? "",
            gstin: gstOn ? resolved.buyerGstin : (contact.gstin ?? ""),
          }
        : {
            name: typedName.trim(),
            phone: "",
            address: "",
            gstin: gstOn ? resolved.buyerGstin : "",
          };

      const payload = {
        docType: editing?.docType ?? docType,
        contactId: contact?.id ?? null,
        party,
        // Lines carry the SNAPSHOT price. HSN / rate only on a GST document.
        itemsList: namedLines.map(({ hsn, gstRate, ...l }) => ({
          ...l,
          name: l.name.trim(),
          ...(gstOn
            ? { hsn: normalizeHsn(hsn), gstRate: parseRate(gstRate) }
            : {}),
        })),
        additionalAmounts: namedExtras.map(({ gstRate, ...e }) =>
          gstOn ? { ...e, gstRate: parseRate(gstRate) ?? extraRate } : e,
        ),
        gst: gstOn
          ? buildGstSnapshot({
              business: gstCfg.business,
              buyerName: party.name,
              buyerAddress: party.address,
              buyerGstin: resolved.buyerGstin,
              placeOfSupply: resolved.pos,
              mode: gstMode,
            })
          : null,
        totalAmount: total,
        note: note.trim(),
        validUntil: isQuotation ? validUntil || null : null,
      };

      await onSave(payload);
      onOpenChange(false);
    } catch (err) {
      console.error("Saving document failed:", err);
      toast.error(
        err?.message === "DOC_NOT_OPEN"
          ? "This document can't be edited any more"
          : "Couldn't save. Please try again.",
      );
      setSaving(false);
    }
  };

  const hasContent = namedLines.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 gap-0 flex flex-col h-[90svh] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">
                {editing ? "Edit" : "New"} {info.label.toLowerCase()}
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                No ledger or stock effect until you convert it to a sale
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-5">
            {/* party */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Customer</Label>
              <ContactPicker
                peopleData={peopleData}
                selected={contact}
                onSelect={(p) => setContactId(p?.id ?? null)}
              />
              {!contact && (
                <Input
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="…or just type a name (optional)"
                  className="h-10"
                />
              )}
            </div>

            {isQuotation && (
              <div className="space-y-1.5">
                <Label htmlFor="doc-valid" className="text-base font-medium">
                  Valid until
                </Label>
                <Input
                  id="doc-valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-10"
                />
              </div>
            )}

            {/* items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Items</Label>
                <p className="text-sm text-muted-foreground">
                  Prices: {sellPriceMode === "bulk" ? "bulk" : "retail"}{" "}
                  (snapshot)
                </p>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search catalog to add…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 150)}
                    className="w-full pl-10 pr-8 h-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {query && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setQuery("");
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {focused && query.trim() && (
                    <div className="absolute z-[200] top-full mt-1 left-0 right-0 rounded-md border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                      {results.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          No results for "{query}"
                        </p>
                      ) : (
                        results.map((r, i) => {
                          const retail = r.node.retailSell ?? r.node.sell ?? 0;
                          const bulk = r.node.bulkSell ?? retail;
                          return (
                            <button
                              key={i}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addFromCatalog(r);
                              }}
                              className="w-full px-3 py-2.5 text-sm hover:bg-accent text-left"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">
                                    {r.segments[r.segments.length - 1]}
                                  </p>
                                  {r.segments.length > 1 && (
                                    <p className="text-sm text-muted-foreground truncate">
                                      {r.segments.slice(0, -1).join(" › ")}
                                    </p>
                                  )}
                                </div>
                                <p className="font-semibold shrink-0">
                                  {fmt(
                                    sellPriceMode === "bulk" ? bulk : retail,
                                  )}
                                  <span className="text-muted-foreground font-normal">
                                    /{r.node.sellUnit || "piece"}
                                  </span>
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) => [
                      ...prev,
                      {
                        name: "",
                        quantity: "1",
                        price: "",
                        unit: "",
                        hsn: "",
                        gstRate: "",
                      },
                    ])
                  }
                  className="shrink-0 h-10 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-4 h-4" />
                  Blank
                </button>
              </div>

              {lines.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6 border border-dashed rounded-lg">
                  Search the catalog above to add items
                </p>
              ) : (
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <LineRow
                      key={i}
                      line={l}
                      gstOn={gstOn}
                      onChange={(patch) => patchLine(i, patch)}
                      onRemove={() =>
                        setLines((prev) => prev.filter((_, j) => j !== i))
                      }
                    />
                  ))}
                </div>
              )}

              {gstOn && gstProblems.length > 0 && namedLines.length > 0 && (
                <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400 space-y-0.5">
                  <p className="font-medium">Fix before saving:</p>
                  {gstProblems.slice(0, 4).map((p, i) => (
                    <p key={i}>• {p}</p>
                  ))}
                  {gstProblems.length > 4 && (
                    <p>…and {gstProblems.length - 4} more</p>
                  )}
                </div>
              )}
            </div>

            {/* extras */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">
                    Extra charges / discounts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Use a negative amount for a discount
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setExtras((p) => [
                      ...p,
                      { name: "", amount: "", note: "", gstRate: "" },
                    ])
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {extras.map((e, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Label (e.g. Delivery)"
                      value={e.name}
                      onChange={(ev) =>
                        patchExtra(i, { name: ev.target.value })
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="any"
                      placeholder="₹"
                      value={e.amount}
                      onChange={(ev) =>
                        patchExtra(i, { amount: ev.target.value })
                      }
                      className="w-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setExtras((p) => p.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {gstOn && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">
                        GST rate
                      </Label>
                      <RateSelect
                        value={e.gstRate}
                        onChange={(v) => patchExtra(i, { gstRate: v })}
                        autoLabel={`Same as items (${highestRate(namedLines)}%)`}
                        className="flex-1"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* GST */}
            {gstEligible && (
              <GstBillPanel
                gst={gstCfg}
                draft={{
                  on: !gstOff,
                  mode: gstMode,
                  pos: gstPos,
                  buyerGstin: gstBuyerGstin,
                }}
                resolved={resolved}
                onChange={handleGstChange}
                contactGstin={contact?.gstin || ""}
              />
            )}

            <div className="space-y-1.5">
              <Label className="text-base font-medium">Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={
                  isQuotation
                    ? "Terms, delivery time, remarks…"
                    : "Vehicle no., driver, remarks…"
                }
              />
            </div>

            {/* totals */}
            {hasContent && (
              <div className="space-y-2">
                {calc ? (
                  <GstBreakup calc={calc} />
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-3 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{fmt(total)}</span>
                  </div>
                )}
                {total <= 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Total is ₹0 — set a price on at least one item.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t px-4 py-3 flex gap-2 shrink-0 bg-background">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {saving
              ? "Saving…"
              : editing
                ? "Save changes"
                : `Save ${info.label.toLowerCase()}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
