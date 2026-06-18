/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useCallback, useRef, useMemo, useEffect, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Banknote,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  Search,
  AlertTriangle,
  X,
  FileEdit,
  Link2,
  User,
} from "lucide-react";
import { usePriceList } from "@/hooks/usePriceList";

// ─── constants ────────────────────────────────────────────────────────────────
const STEPS_ITEM = ["Type", "Items", "Extras", "Payment", "Review"];
const STEPS_FINANCIAL = ["Type", "Details", "Payment", "Review"];
const PAYMENT_METHODS = ["cash", "UPI", "bank transfer", "cheque", "credit"];

const emptyItem = () => ({
  name: "",
  fullPath: "",
  quantity: "",
  price: "",
  unit: "",
});
const emptyExtra = () => ({ name: "", amount: "", note: "" });

const fmt = (n) =>
  `₹${(+n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtNum = (n) => {
  const v = parseFloat(n);
  return isNaN(v) ? "0" : String(v);
};
const sanitizeNum = (v) => {
  if (v === "" || v == null) return "";
  const n = parseFloat(v);
  return isNaN(n) ? "" : String(n);
};

// ─── draft helpers ────────────────────────────────────────────────────────────
const draftKey = (contactId) => `tx_draft_${contactId}`;
const saveDraft = (contactId, state) => {
  try {
    const hasContent =
      state.kind !== "item" ||
      state.type !== "out" ||
      state.itemsList.length > 0 ||
      state.financialTotal !== "" ||
      state.note !== "";
    if (!hasContent) return;
    localStorage.setItem(
      draftKey(contactId),
      JSON.stringify({ ...state, savedAt: new Date().toISOString() }),
    );
  } catch {}
};
const loadDraft = (contactId) => {
  try {
    const raw = localStorage.getItem(draftKey(contactId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const clearDraft = (contactId) => {
  try {
    localStorage.removeItem(draftKey(contactId));
  } catch {}
};
const draftSummary = (draft) => {
  if (!draft) return "";
  const parts = [];
  if (draft.kind && draft.type)
    parts.push(
      `${draft.kind === "item" ? "Item" : "Financial"} ${draft.type === "out" ? "Sale" : "Purchase"}`,
    );
  else if (draft.kind) parts.push(draft.kind === "item" ? "Item" : "Financial");
  else if (draft.type) parts.push(draft.type === "out" ? "Sale" : "Purchase");
  if (draft.kind === "item" && draft.itemsList?.length > 0) {
    const named = draft.itemsList.filter((it) => it.name?.trim());
    if (named.length > 0)
      parts.push(`${named.length} item${named.length !== 1 ? "s" : ""}`);
  }
  if (draft.financialTotal) parts.push(`₹${draft.financialTotal}`);
  return parts.join(" · ");
};

// ─── tokenizer ────────────────────────────────────────────────────────────────
const unitSynonyms = {
  '"': "inch",
  inch: "inch",
  inches: "inch",
  in: "inch",
  mm: "mm",
  millimeter: "mm",
  millimetre: "mm",
  millimeters: "mm",
  millimetres: "mm",
  cm: "cm",
  centimeter: "cm",
  centimetre: "cm",
  m: "m",
  meter: "m",
  metre: "m",
  meters: "m",
  metres: "m",
  kg: "kg",
  kilogram: "kg",
  kgs: "kg",
  kilograms: "kg",
  g: "g",
  gram: "g",
  gm: "g",
  grams: "g",
  ltr: "l",
  l: "l",
  liter: "l",
  litre: "l",
  liters: "l",
  litres: "l",
  ft: "foot",
  foot: "foot",
  feet: "foot",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  pcs: "piece",
  pc: "piece",
  piece: "piece",
  pieces: "piece",
  box: "box",
  boxes: "box",
  pack: "pack",
  packs: "pack",
  set: "set",
  sets: "set",
  pair: "pair",
  pairs: "pair",
};
const unitToken = (w) => unitSynonyms[w.toLowerCase()] ?? null;
const isFraction = (t) => /^\d+\/\d+$/.test(t);
const isDecimal = (t) => /^\d+\.\d+$/.test(t);
const isNumeric = (t) => /^\d+$/.test(t);
const frac2dec = (f) => {
  const [a, b] = f.split("/").map(Number);
  return b ? a / b : null;
};
const dec2fracs = (d) => {
  const out = [];
  for (const den of [2, 3, 4, 5, 6, 8, 10, 12, 16]) {
    const num = Math.round(d * den);
    if (Math.abs(num / den - d) < 0.01) {
      let a = num,
        b = den;
      while (b) {
        const t = b;
        b = a % b;
        a = t;
      }
      out.push(`${num / a}/${den / a}`);
    }
  }
  return out;
};
const tokenize = (text) => {
  if (!text) return [];
  let s = String(text)
    .toLowerCase()
    .replace(/["'`´]/g, "");
  const phs = [];
  let idx = 0;
  s = s.replace(/(\d+\/\d+)\s*["-]\s*(\d+\/\d+)/g, (_, a, b) => {
    const ph = `__R${idx++}__`;
    phs.push({ ph, val: `${a}-${b}` });
    return ph;
  });
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => {
    const ph = `__F${idx++}__`;
    phs.push({ ph, val: `${a}/${b}` });
    return ph;
  });
  s = s.replace(/(\d+\.\d+)/g, (m) => {
    const ph = `__D${idx++}__`;
    phs.push({ ph, val: m, decimal: true });
    return ph;
  });
  return s
    .split(/[^a-z0-9_]+/i)
    .filter(Boolean)
    .flatMap((p) => {
      const ph = phs.find((x) => x.ph === p);
      if (ph) return [ph.val];
      if (isNumeric(p)) return [p];
      const ut = unitToken(p);
      if (ut) return [ut];
      const c = p.replace(/[^\w]/g, "");
      return c ? [c] : [];
    })
    .filter(Boolean);
};
const levenshtein = (a, b) => {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};
const scoreToken = (st, pt, fuzzy = true) => {
  if (!st || !pt) return 0;
  if (pt === st) return 100;
  if (
    isDecimal(st) &&
    isFraction(pt) &&
    Math.abs(parseFloat(st) - frac2dec(pt)) < 0.01
  )
    return 100;
  if (
    isFraction(st) &&
    isDecimal(pt) &&
    Math.abs(frac2dec(st) - parseFloat(pt)) < 0.01
  )
    return 100;
  if (isDecimal(st) && dec2fracs(parseFloat(st)).some((f) => pt.includes(f)))
    return 100;
  if (isDecimal(pt) && dec2fracs(parseFloat(pt)).some((f) => st.includes(f)))
    return 100;
  if (isFraction(st) && pt.includes(st)) return 70;
  if (isNumeric(st)) return 0;
  if (!fuzzy) {
    if (pt.startsWith(st)) return 5;
    if (new RegExp(`\\b${st}\\b`, "i").test(pt)) return 6;
    if (st.length >= 4 && pt.includes(st)) return 3;
    return 0;
  }
  if (pt.startsWith(st)) return 5;
  if (new RegExp(`\\b${st}\\b`, "i").test(pt)) return 6;
  if (st.length >= 4 && pt.includes(st)) return 3;
  if (
    st.length >= 4 &&
    levenshtein(st, pt) <= Math.min(2, Math.floor(st.length / 3))
  )
    return 2;
  return 0;
};
const searchItems = (items, query) => {
  if (!query.trim()) return [];
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const score = (item, fuzzy) => {
    const pts = tokenize(item.path);
    let total = 0;
    for (const st of tokens) {
      const best = pts.reduce(
        (m, pt) => Math.max(m, scoreToken(st, pt, fuzzy)),
        0,
      );
      if (best === 0) return null;
      total += best;
    }
    return total;
  };
  let results = items
    .map((it) => {
      const s = score(it, false);
      return s != null ? { ...it, _score: s } : null;
    })
    .filter(Boolean);
  if (results.length === 0)
    results = items
      .map((it) => {
        const s = score(it, true);
        return s != null ? { ...it, _score: s } : null;
      })
      .filter(Boolean);
  return results.sort((a, b) => b._score - a._score);
};
const flattenPriceItems = (data, path = []) => {
  if (!data || typeof data !== "object") return [];
  const out = [];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("__")) continue;
    if (value?.type === "item") {
      const pathParts = [...path, key];
      out.push({
        name: key,
        fullPath: pathParts.join(" › "),
        path: pathParts.join(" › "),
        pathParts,
        retailSell: value.retailSell ?? value.sell ?? 0,
        bulkSell: value.bulkSell ?? value.retailSell ?? value.sell ?? 0,
        cost: value.cost ?? 0,
        sellUnit: value.sellUnit ?? "piece",
        costUnit: value.costUnit ?? value.sellUnit ?? "piece",
      });
    } else if (value?.type === "category" && value.children) {
      out.push(...flattenPriceItems(value.children, [...path, key]));
    }
  }
  return out;
};

const inputCls =
  "bg-muted border-0 rounded px-2 py-1 text-sm font-mono outline-none focus:bg-primary/10 focus:ring-1 focus:ring-primary min-w-0 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// ─── LinkedContactsPicker ─────────────────────────────────────────────────────
// Memo'd so parent modal re-renders don't remount this component mid-interaction.
const LinkedContactsPicker = memo(function LinkedContactsPicker({
  linkedContactIds,
  setLinkedContactIds,
  peopleData,
  currentContactId,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const blurTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(blurTimerRef.current), []);

  // Include linkedContactIds in deps so the list immediately re-filters
  // after a contact is added (no stale dropdown showing already-added contact).
  // memo() ensures this re-render stays local to the picker only.
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const excluded = new Set([currentContactId, ...linkedContactIds]);
    return peopleData
      .filter(
        (p) =>
          !excluded.has(p.id) && (q === "" || p.name.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [peopleData, query, currentContactId, linkedContactIds]);

  const addContact = useCallback(
    (person) => {
      setLinkedContactIds((prev) => {
        // Hard duplicate guard at write time
        if (prev.includes(person.id)) return prev;
        return [...prev, person.id];
      });
      setQuery("");
      setHoveredId(null);
      // Keep open=true so dropdown stays showing remaining contacts immediately.
      // Don't refocus — user can click another contact directly from the list.
    },
    [setLinkedContactIds],
  );

  const removeContact = useCallback(
    (id) => {
      setLinkedContactIds((prev) => prev.filter((x) => x !== id));
    },
    [setLinkedContactIds],
  );

  const linkedPeople = useMemo(
    () =>
      linkedContactIds
        .map((id) => peopleData.find((p) => p.id === id))
        .filter(Boolean),
    [linkedContactIds, peopleData],
  );

  const handleFocus = useCallback(() => {
    clearTimeout(blurTimerRef.current);
    setOpen(true);
  }, []);

  const handleBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  }, []);

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium flex items-center gap-1.5">
        <Link2 className="w-4 h-4 text-purple-500" />
        Also involves{" "}
        <span className="text-muted-foreground font-normal text-sm">
          (optional)
        </span>
      </Label>
      <p className="text-sm text-muted-foreground -mt-1">
        Add contacts referenced in this transaction but not financially
        responsible (e.g. a plumber buying on behalf of a customer).
      </p>

      {/* Selected chips — no tooltip, just name + remove */}
      {linkedPeople.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {linkedPeople.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-sm font-medium"
            >
              <User className="w-3 h-3 shrink-0" />
              {p.name}
              <button
                type="button"
                onClick={() => removeContact(p.id)}
                className="ml-0.5 hover:text-purple-900 dark:hover:text-purple-100 transition-colors"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search contacts to link…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full pl-10 pr-8 h-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {open && (
          <div className="absolute z-[200] top-full mt-1 left-0 right-0 rounded-md border bg-popover shadow-lg overflow-hidden">
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                {query
                  ? `No contacts matching "${query}"`
                  : "All contacts already added"}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {filtered.map((p) => {
                  const phone =
                    (p.phones ?? []).find((ph) => ph?.trim()) ?? null;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addContact(p);
                      }}
                      className="w-full px-3 py-2.5 text-sm hover:bg-accent active:bg-accent text-left flex items-start gap-2 transition-colors"
                    >
                      <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="capitalize">{p.category}</span>
                          {phone && <span> · {phone}</span>}
                        </p>
                        {p.address && (
                          <p className="text-sm text-muted-foreground truncate">
                            {p.address}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── PrimaryContactPicker ──────────────────────────────────────────────────
// Single-select contact picker shown only on the Unassigned page (no fixed
// `contact` prop), letting the user optionally attach a real contact at
// creation time instead of always assigning one after the fact.
// Memo'd for the same reason as LinkedContactsPicker — keep typing local.
const PrimaryContactPicker = memo(function PrimaryContactPicker({
  selectedContactId,
  setSelectedContactId,
  peopleData,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const blurTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(blurTimerRef.current), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return peopleData
      .filter((p) => q === "" || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [peopleData, query]);

  const selectedPerson = useMemo(
    () => peopleData.find((p) => p.id === selectedContactId) ?? null,
    [peopleData, selectedContactId],
  );

  const handleFocus = useCallback(() => {
    clearTimeout(blurTimerRef.current);
    setOpen(true);
  }, []);
  const handleBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  if (selectedPerson) {
    return (
      <div className="space-y-2">
        <Label className="text-base font-medium flex items-center gap-1.5">
          <User className="w-4 h-4 text-primary" />
          Contact{" "}
          <span className="text-muted-foreground font-normal text-sm">
            (optional)
          </span>
        </Label>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedPerson.name}
              </p>
              <p className="text-sm text-muted-foreground capitalize">
                {selectedPerson.category}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedContactId(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium flex items-center gap-1.5">
        <User className="w-4 h-4 text-primary" />
        Contact{" "}
        <span className="text-muted-foreground font-normal text-sm">
          (optional)
        </span>
      </Label>
      <p className="text-sm text-muted-foreground -mt-1">
        Leave blank for a quick walk-in sale — you can attach a contact later.
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search contacts… (optional)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full pl-10 pr-8 h-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {open && (
          <div className="absolute z-[200] top-full mt-1 left-0 right-0 rounded-md border bg-popover shadow-lg overflow-hidden">
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                {query ? `No contacts matching "${query}"` : "No contacts yet"}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {filtered.map((p) => {
                  const phone =
                    (p.phones ?? []).find((ph) => ph?.trim()) ?? null;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedContactId(p.id);
                        setQuery("");
                        setOpen(false);
                      }}
                      className="w-full px-3 py-2.5 text-sm hover:bg-accent active:bg-accent text-left flex items-start gap-2 transition-colors"
                    >
                      <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
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
    </div>
  );
});

// ─── PriceItemSearch ──────────────────────────────────────────────────────────
const PriceItemSearch = ({
  onSelect,
  onAddBlank,
  txType,
  sellPriceMode,
  allPriceItems,
  itemsList,
}) => {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState(null);
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingPrice, setPendingPrice] = useState("");
  const [pendingUnit, setPendingUnit] = useState("");
  const inputRef = useRef(null);
  const qtyRef = useRef(null);

  const priceKey =
    txType === "in"
      ? "cost"
      : sellPriceMode === "bulk"
        ? "bulkSell"
        : "retailSell";
  const unitKey = txType === "in" ? "costUnit" : "sellUnit";
  const priceLabel =
    txType === "in" ? "Cost" : sellPriceMode === "bulk" ? "Bulk" : "Retail";

  const results = useMemo(
    () => searchItems(allPriceItems, query).slice(0, 10),
    [allPriceItems, query],
  );

  const pickItem = (item) => {
    setPending(item);
    setPendingQty("1");
    setPendingPrice(String(item[priceKey] ?? 0));
    setPendingUnit(item[unitKey] ?? "");
    setQuery("");
    setFocused(false);
    setTimeout(() => qtyRef.current?.select(), 60);
  };

  const isDuplicate = pending
    ? (itemsList ?? []).some(
        (it) =>
          it.name === pending.fullPath &&
          String(it.price) === pendingPrice &&
          (it.unit || "") === (pendingUnit || ""),
      )
    : false;

  const confirmAdd = () => {
    if (!pending) return;
    const qty = parseFloat(pendingQty);
    if (!qty || qty <= 0) return;
    onSelect({
      name: pending.fullPath,
      quantity: String(qty),
      price: pendingPrice,
      unit: pendingUnit,
    });
    setPending(null);
    setPendingQty("1");
    setTimeout(() => inputRef.current?.focus(), 60);
  };
  const cancelPending = () => {
    setPending(null);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder={`Search catalog (${priceLabel.toLowerCase()} price)…`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (pending) setPending(null);
              }}
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
          </div>
          <button
            type="button"
            onClick={onAddBlank}
            className="shrink-0 h-10 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4" />
            Blank
          </button>
        </div>
        {focused && query.trim() && (
          <div className="absolute z-[200] top-full mt-1 left-0 right-0 rounded-md border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No results for "{query}"
              </p>
            ) : (
              results.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickItem(item);
                  }}
                  className="w-full px-3 py-2.5 text-sm hover:bg-accent text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      {item.pathParts.length > 1 && (
                        <p className="text-sm text-muted-foreground truncate">
                          {item.pathParts.slice(0, -1).join(" › ")}
                        </p>
                      )}
                    </div>
                    <p className="font-semibold text-sm shrink-0 text-right">
                      {fmt(item[priceKey])}
                      <span className="text-muted-foreground font-normal">
                        /{item[unitKey]}
                      </span>
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {pending && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{pending.name}</p>
            {pending.pathParts?.length > 1 && (
              <p className="text-sm text-muted-foreground truncate">
                {pending.pathParts.slice(0, -1).join(" › ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
                Qty
              </span>
              <input
                ref={qtyRef}
                type="number"
                min="0"
                value={pendingQty}
                onChange={(e) => setPendingQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAdd();
                  if (e.key === "Escape") cancelPending();
                }}
                className={`${inputCls} w-16`}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
                Unit
              </span>
              <input
                type="text"
                value={pendingUnit}
                onChange={(e) => setPendingUnit(e.target.value)}
                placeholder="—"
                className={`${inputCls} w-16`}
              />
            </div>
            <span className="text-sm text-muted-foreground mt-4">×</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
                Price ₹
              </span>
              <input
                type="number"
                min="0"
                value={pendingPrice}
                onChange={(e) => setPendingPrice(e.target.value)}
                className={`${inputCls} w-20`}
              />
            </div>
            {parseFloat(pendingQty) > 0 && parseFloat(pendingPrice) > 0 && (
              <>
                <span className="text-sm text-muted-foreground mt-4">=</span>
                <span className="text-sm font-semibold tabular-nums mt-4 text-primary">
                  {fmt(parseFloat(pendingQty) * parseFloat(pendingPrice))}
                </span>
              </>
            )}
          </div>
          {isDuplicate && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Already in cart with same price &amp; unit — adding again will
              create a duplicate row.
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelPending}
              className="flex-1 h-9 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmAdd}
              disabled={!(parseFloat(pendingQty) > 0)}
              className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CollapsibleCartItem ──────────────────────────────────────────────────────
const CollapsibleCartItem = ({
  item,
  index,
  onUpdate,
  onRemove,
  isExpanded,
  onToggle,
}) => {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.price) || 0;
  const total = qty * price;
  const parts = item.name ? item.name.split(" › ") : [""];
  const displayName = parts[parts.length - 1] || (
    <span className="italic text-muted-foreground">Unnamed</span>
  );
  const cat = parts.length > 1 ? parts.slice(0, -1).join(" › ") : "";

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2 px-3 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug truncate">
            {displayName}
          </p>
          {cat && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {cat}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground font-mono">
              {fmtNum(item.quantity)}
              {item.unit ? ` ${item.unit}` : ""} × {fmt(price)}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right pt-0.5">
          <p className="text-sm font-semibold tabular-nums whitespace-nowrap">
            {total > 0 ? (
              fmt(total)
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div className="border-b last:border-b-0 px-3 py-3 bg-primary/5 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdate(index, "name", e.target.value)}
            placeholder="Item name"
            className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm font-medium outline-none focus:ring-1 focus:ring-primary transition-colors"
            autoFocus
          />
          <p className="text-sm text-muted-foreground truncate px-1 min-h-[1.2em] mt-0.5">
            {cat}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors shrink-0 mt-0.5"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
            Qty
          </span>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate(index, "quantity", e.target.value)}
            placeholder="qty"
            className={`${inputCls} w-16`}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
            Unit
          </span>
          <input
            type="text"
            value={item.unit || ""}
            onChange={(e) => onUpdate(index, "unit", e.target.value)}
            placeholder="—"
            className={`${inputCls} w-16`}
          />
        </div>
        <span className="text-sm text-muted-foreground mt-4">×</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
            Price ₹
          </span>
          <input
            type="number"
            value={item.price}
            onChange={(e) => onUpdate(index, "price", e.target.value)}
            placeholder="₹0"
            className={`${inputCls} w-20`}
          />
        </div>
        {qty > 0 && price > 0 && (
          <>
            <span className="text-sm text-muted-foreground mt-4">=</span>
            <span className="text-sm font-semibold tabular-nums mt-4 text-primary">
              {fmt(total)}
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full h-8 flex items-center justify-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
      >
        <Check className="w-4 h-4" />
        Done
      </button>
    </div>
  );
};

// ─── ItemsTabPanel ────────────────────────────────────────────────────────────
const ItemsTabPanel = ({
  itemsList,
  itemsTotal,
  updateItem,
  removeItem,
  addBlankItem,
  addItemFromSearch,
  type,
  sellPriceMode,
  allPriceItems,
}) => {
  const [activeTab, setActiveTab] = useState("add");
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [blankPending, setBlankPending] = useState(null);
  const blankNameRef = useRef(null);
  const namedCount = itemsList.filter((it) => it.name?.trim()).length;

  const handleAddBlank = () => {
    setBlankPending({ name: "", qty: "1", price: "", unit: "" });
    setTimeout(() => blankNameRef.current?.focus(), 60);
  };
  const confirmBlank = () => {
    if (!blankPending) return;
    addItemFromSearch({
      name: blankPending.name,
      quantity: blankPending.qty,
      price: blankPending.price,
      unit: blankPending.unit,
    });
    setBlankPending(null);
  };
  const cancelBlank = () => setBlankPending(null);
  const blankQty = parseFloat(blankPending?.qty) || 0;
  const blankPrice = parseFloat(blankPending?.price) || 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 p-1 rounded-lg bg-muted shrink-0">
        {[
          { id: "add", label: "Add items" },
          {
            id: "cart",
            label: namedCount > 0 ? `Cart (${namedCount})` : "Cart",
          },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 h-8 rounded-md text-sm font-medium transition-all ${activeTab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === "add" && (
        <div className="space-y-2">
          <PriceItemSearch
            onSelect={addItemFromSearch}
            onAddBlank={handleAddBlank}
            txType={type}
            sellPriceMode={sellPriceMode}
            allPriceItems={allPriceItems}
            itemsList={itemsList}
          />
          {blankPending && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-sm text-muted-foreground font-medium">
                New blank item
              </p>
              <input
                ref={blankNameRef}
                type="text"
                value={blankPending.name}
                onChange={(e) =>
                  setBlankPending((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Item name"
                className="w-full bg-muted border-0 rounded px-2 py-1.5 text-sm font-medium outline-none focus:bg-primary/10 focus:ring-1 focus:ring-primary transition-colors"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
                    Qty
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={blankPending.qty}
                    onChange={(e) =>
                      setBlankPending((p) => ({ ...p, qty: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmBlank();
                      if (e.key === "Escape") cancelBlank();
                    }}
                    className={`${inputCls} w-16`}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
                    Unit
                  </span>
                  <input
                    type="text"
                    value={blankPending.unit}
                    onChange={(e) =>
                      setBlankPending((p) => ({ ...p, unit: e.target.value }))
                    }
                    placeholder="—"
                    className={`${inputCls} w-16`}
                  />
                </div>
                <span className="text-sm text-muted-foreground mt-4">×</span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.7em] text-muted-foreground uppercase tracking-wide font-medium">
                    Price ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={blankPending.price}
                    onChange={(e) =>
                      setBlankPending((p) => ({ ...p, price: e.target.value }))
                    }
                    className={`${inputCls} w-20`}
                  />
                </div>
                {blankQty > 0 && blankPrice > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground mt-4">
                      =
                    </span>
                    <span className="text-sm font-semibold tabular-nums mt-4 text-primary">
                      {fmt(blankQty * blankPrice)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelBlank}
                  className="flex-1 h-9 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBlank}
                  className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to cart
                </button>
              </div>
            </div>
          )}
          {namedCount > 0 && !blankPending && (
            <button
              type="button"
              onClick={() => setActiveTab("cart")}
              className="w-full text-sm text-center text-muted-foreground hover:text-foreground py-1.5 transition-colors"
            >
              {namedCount} item{namedCount !== 1 ? "s" : ""} in cart ·{" "}
              <span className="text-primary underline">View Cart →</span>
            </button>
          )}
        </div>
      )}
      {activeTab === "cart" && (
        <div className="flex flex-col gap-2">
          {itemsList.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center space-y-1">
              <p className="text-sm text-muted-foreground">No items yet</p>
              <button
                type="button"
                onClick={() => setActiveTab("add")}
                className="text-sm text-primary hover:underline"
              >
                Go to Add tab to search catalog
              </button>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                {itemsList.map((item, i) => (
                  <CollapsibleCartItem
                    key={i}
                    item={item}
                    index={i}
                    onUpdate={updateItem}
                    onRemove={(idx) => {
                      removeItem(idx);
                      setExpandedIndex(null);
                    }}
                    isExpanded={expandedIndex === i}
                    onToggle={() =>
                      setExpandedIndex(expandedIndex === i ? null : i)
                    }
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-sm px-0.5">
                <span className="text-muted-foreground">
                  {namedCount} item{namedCount !== 1 ? "s" : ""}
                </span>
                <span className="font-semibold tabular-nums">
                  {fmt(itemsTotal)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── blank state factory ──────────────────────────────────────────────────────
const blankState = () => ({
  step: 0,
  kind: "item",
  type: "out",
  itemsList: [],
  additionalAmounts: [],
  note: "",
  initialPayment: { amount: "", note: "", method: "cash" },
  financialTotal: "",
  linkedContactIds: [],
  selectedContactId: null,
});

// ─── main modal ───────────────────────────────────────────────────────────────
export const AddTransactionModal = ({
  open,
  onOpenChange,
  contact,
  onAdd,
  peopleData = [],
  currentContactId,
}) => {
  const { priceData, sellPriceMode } = usePriceList();
  // On the contact page, contact is always provided and contactId is its id.
  // On the Unassigned page, no `contact` prop is passed — fall back to a
  // fixed key so drafts still save/restore (rather than silently disabling
  // drafts, which is what happened before when contactId was undefined).
  const contactId = contact?.id ?? "unassigned";

  const [pendingDraft, setPendingDraft] = useState(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState("item");
  const [type, setType] = useState("out");
  const [itemsList, setItemsList] = useState([]);
  const [additionalAmounts, setAdditionalAmounts] = useState([]);
  const [note, setNote] = useState("");
  const [initialPayment, setInitialPayment] = useState({
    amount: "",
    note: "",
    method: "cash",
  });
  const [financialTotal, setFinancialTotal] = useState("");
  const [linkedContactIds, setLinkedContactIds] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);

  useEffect(() => {
    if (!open || !contactId) return;
    const draft = loadDraft(contactId);
    if (draft) {
      setPendingDraft(draft);
      setShowDraftPrompt(true);
    }
  }, [open, contactId]);

  const formStateRef = useRef({});
  formStateRef.current = {
    step,
    kind,
    type,
    itemsList,
    additionalAmounts,
    note,
    initialPayment,
    financialTotal,
    linkedContactIds,
    selectedContactId,
  };

  const allPriceItems = useMemo(
    () => flattenPriceItems(priceData),
    [priceData],
  );
  const steps =
    kind === "item"
      ? STEPS_ITEM
      : kind === "financial"
        ? STEPS_FINANCIAL
        : ["Type"];
  const stepName = steps[step];
  const isLastStep = step === steps.length - 1;

  const itemsTotal = itemsList.reduce(
    (s, it) => s + (parseFloat(it.price) || 0) * (parseFloat(it.quantity) || 0),
    0,
  );
  const extrasTotal = additionalAmounts.reduce(
    (s, ex) => s + (parseFloat(ex.amount) || 0),
    0,
  );
  const totalAmount =
    kind === "item"
      ? itemsTotal + extrasTotal
      : parseFloat(financialTotal) || 0;
  const paidNow = parseFloat(initialPayment.amount) || 0;
  const isOverpaid = paidNow > totalAmount && totalAmount > 0;
  const remaining = totalAmount - paidNow;
  const overpaidMsg =
    type === "out"
      ? `Customer is paying ${fmt(paidNow - totalAmount)} extra — they'll have a credit with us`
      : `We're paying ${fmt(paidNow - totalAmount)} extra — supplier will owe us change`;

  const applyState = (s) => {
    setStep(s.step ?? 0);
    setKind(s.kind ?? "item");
    setType(s.type ?? "out");
    setItemsList(s.itemsList ?? []);
    setAdditionalAmounts(s.additionalAmounts ?? []);
    setNote(s.note ?? "");
    setInitialPayment(
      s.initialPayment ?? { amount: "", note: "", method: "cash" },
    );
    setFinancialTotal(s.financialTotal ?? "");
    setLinkedContactIds(s.linkedContactIds ?? []);
    setSelectedContactId(s.selectedContactId ?? null);
  };
  const reset = () => applyState(blankState());

  const handleClose = (v) => {
    if (!v) {
      const current = formStateRef.current;
      const hasContent =
        current.kind !== "item" ||
        current.type !== "out" ||
        (current.itemsList ?? []).length > 0 ||
        current.financialTotal !== "" ||
        current.note !== "";
      if (hasContent && contactId) saveDraft(contactId, current);
      reset();
    }
    onOpenChange(v);
  };

  const handleNext = () => {
    isLastStep ? handleSubmit() : setStep((s) => s + 1);
  };
  const handleBack = () => {
    step === 0 ? handleClose(false) : setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    const history =
      paidNow > 0
        ? [
            {
              ...initialPayment,
              amount: paidNow,
              date: new Date().toISOString(),
            },
          ]
        : [];
    await onAdd({
      kind,
      type,
      itemsList:
        kind === "item" ? itemsList.filter((it) => it.name.trim()) : [],
      additionalAmounts:
        kind === "item" ? additionalAmounts.filter((ex) => ex.name.trim()) : [],
      totalAmount,
      paidAmount: paidNow,
      paidAmountHistory: history,
      itemListHistory: [],
      note,
      linkedContactIds,
      // Only relevant on the Unassigned page (no fixed `contact` prop) —
      // lets the user attach a real contact at creation time instead of
      // always assigning one after the fact. On the normal contact page
      // this stays undefined and useTransactions falls back to its own
      // fixed contactId, as before.
      ...(!contact && selectedContactId
        ? { contactId: selectedContactId }
        : {}),
      status:
        paidNow > totalAmount && totalAmount > 0
          ? "overpaid"
          : paidNow >= totalAmount && totalAmount > 0
            ? "complete"
            : "pending",
    });
    if (contactId) clearDraft(contactId);
    reset();
  };

  const handleRestoreDraft = () => {
    if (pendingDraft) applyState(pendingDraft);
    setShowDraftPrompt(false);
    setPendingDraft(null);
  };
  const handleDiscardDraft = () => {
    if (contactId) clearDraft(contactId);
    setShowDraftPrompt(false);
    setPendingDraft(null);
    reset();
  };

  const canProceed = () => {
    if (stepName === "Type") return kind !== null && type !== null;
    if (stepName === "Items") return itemsList.some((it) => it.name.trim());
    if (stepName === "Details") return parseFloat(financialTotal) > 0;
    if ((stepName === "Extras" || stepName === "Payment") && kind === "item")
      return totalAmount > 0;
    return true;
  };

  const updateItem = useCallback((i, field, value) => {
    setItemsList((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }, []);
  const removeItem = useCallback((i) => {
    setItemsList((prev) => prev.filter((_, j) => j !== i));
  }, []);
  const addBlankItem = useCallback(() => {
    setItemsList((prev) => [...prev, emptyItem()]);
  }, []);
  const addItemFromSearch = useCallback((item) => {
    setItemsList((prev) => [
      ...prev,
      {
        name: item.name,
        quantity: String(item.quantity ?? "1"),
        price: String(item.price),
        unit: item.unit || "",
      },
    ]);
  }, []);
  const updateExtra = useCallback((i, f, v) => {
    setAdditionalAmounts((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [f]: v };
      return next;
    });
  }, []);
  const removeExtra = useCallback((i) => {
    setAdditionalAmounts((prev) => prev.filter((_, j) => j !== i));
  }, []);

  // Linked contact names for review
  const linkedPeople = linkedContactIds
    .map((id) => peopleData.find((p) => p.id === id))
    .filter(Boolean);

  // Primary contact picked on the Unassigned page, for review display
  const reviewSelectedContact = selectedContactId
    ? peopleData.find((p) => p.id === selectedContactId)
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 flex flex-col h-[90svh] overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              New Transaction
              {step > 0 && kind && type && (
                <span className="flex items-center gap-1.5 ml-1">
                  {kind === "item" ? (
                    <Package className="w-4 h-4 text-blue-500 shrink-0" />
                  ) : (
                    <Banknote className="w-4 h-4 text-purple-500 shrink-0" />
                  )}
                  {type === "out" ? (
                    <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span className="text-sm font-normal text-muted-foreground">
                    {kind === "item" ? "Item" : "Financial"}{" "}
                    {type === "out" ? "Sale" : "Purchase"}
                  </span>
                </span>
              )}
              {kind && !showDraftPrompt && (
                <span className="ml-auto mr-7 text-sm font-normal text-muted-foreground tabular-nums">
                  {step + 1}/{steps.length}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-4 pt-2 pb-3 flex flex-col gap-3">
            {/* Draft restore prompt */}
            {showDraftPrompt && pendingDraft && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <FileEdit className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      Unsaved draft found
                    </p>
                    {draftSummary(pendingDraft) && (
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5 truncate">
                        {draftSummary(pendingDraft)}
                      </p>
                    )}
                    {pendingDraft.savedAt && (
                      <p className="text-[0.75em] text-amber-600/70 dark:text-amber-500/70 mt-0.5">
                        Saved{" "}
                        {(() => {
                          try {
                            const d = new Date(pendingDraft.savedAt),
                              now = new Date(),
                              diffMs = now - d,
                              diffMins = Math.floor(diffMs / 60000);
                            if (diffMins < 1) return "just now";
                            if (diffMins < 60)
                              return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
                            const diffHrs = Math.floor(diffMins / 60);
                            if (diffHrs < 24)
                              return `${diffHrs} hr${diffHrs !== 1 ? "s" : ""} ago`;
                            return d.toLocaleDateString();
                          } catch {
                            return "";
                          }
                        })()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-sm border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    onClick={handleDiscardDraft}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-sm bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white border-0"
                    onClick={handleRestoreDraft}
                  >
                    <FileEdit className="w-3.5 h-3.5 mr-1" />
                    Resume draft
                  </Button>
                </div>
              </div>
            )}

            {!showDraftPrompt && (
              <>
                {/* TYPE */}
                {stepName === "Type" && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-base font-medium">Kind</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            value: "item",
                            label: "Item",
                            icon: Package,
                            desc: "Items with qty & price",
                          },
                          {
                            value: "financial",
                            label: "Financial",
                            icon: Banknote,
                            desc: "Plain money in / out",
                          },
                        ].map(({ value, label, icon: Icon, desc }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setKind(value)}
                            className={`rounded-lg border-2 p-4 text-left transition-all ${kind === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                          >
                            <Icon className="w-6 h-6 mb-2 text-primary" />
                            <p className="font-semibold text-base">{label}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-medium">Direction</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            value: "out",
                            label: "Sale / We give",
                            icon: TrendingUp,
                            desc: contact?.name
                              ? `Sell to ${contact.name}`
                              : "Sell to walk-in customer",
                            color: "text-green-600",
                          },
                          {
                            value: "in",
                            label: "Purchase / We get",
                            icon: TrendingDown,
                            desc: contact?.name
                              ? `Buy from ${contact.name}`
                              : "Buy from walk-in supplier",
                            color: "text-red-600",
                          },
                        ].map(({ value, label, icon: Icon, desc, color }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setType(value)}
                            className={`rounded-lg border-2 p-4 text-left transition-all ${type === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                          >
                            <Icon className={`w-6 h-6 mb-2 ${color}`} />
                            <p className="font-semibold text-base">{label}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Primary contact picker — Unassigned page only (no fixed
                        `contact` prop passed in). Lets the user optionally
                        attach a real contact at creation time instead of
                        always assigning one after the fact. Shown first
                        since it's the more important field. */}
                    {!contact && peopleData.length > 0 && (
                      <PrimaryContactPicker
                        selectedContactId={selectedContactId}
                        setSelectedContactId={setSelectedContactId}
                        peopleData={peopleData}
                      />
                    )}

                    {/* Linked contacts picker — on the Type step */}
                    {peopleData.length > 1 && (
                      <LinkedContactsPicker
                        linkedContactIds={linkedContactIds}
                        setLinkedContactIds={setLinkedContactIds}
                        peopleData={peopleData}
                        currentContactId={currentContactId ?? contact?.id}
                      />
                    )}
                  </div>
                )}

                {/* ITEMS */}
                {stepName === "Items" && (
                  <ItemsTabPanel
                    itemsList={itemsList}
                    itemsTotal={itemsTotal}
                    updateItem={updateItem}
                    removeItem={removeItem}
                    addBlankItem={addBlankItem}
                    addItemFromSearch={addItemFromSearch}
                    type={type}
                    sellPriceMode={sellPriceMode}
                    allPriceItems={allPriceItems}
                  />
                )}

                {/* EXTRAS */}
                {stepName === "Extras" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">
                          Additional charges / discounts
                        </Label>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Use negative amount for discount
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAdditionalAmounts((p) => [...p, emptyExtra()])
                        }
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add
                      </Button>
                    </div>
                    {additionalAmounts.length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-4 border rounded-lg">
                        No extras — skip or add one
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {additionalAmounts.map((ex, i) => (
                          <div
                            key={i}
                            className="rounded-lg border p-3 space-y-2"
                          >
                            <div className="flex gap-2">
                              <Input
                                placeholder="Label (e.g. Delivery)"
                                value={ex.name}
                                onChange={(e) =>
                                  updateExtra(i, "name", e.target.value)
                                }
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeExtra(i)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-sm text-muted-foreground mb-0.5 block">
                                  Amount (₹)
                                </Label>
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="0"
                                  value={ex.amount}
                                  onChange={(e) =>
                                    updateExtra(i, "amount", e.target.value)
                                  }
                                  onBlur={(e) =>
                                    updateExtra(
                                      i,
                                      "amount",
                                      sanitizeNum(e.target.value),
                                    )
                                  }
                                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                              <div>
                                <Label className="text-sm text-muted-foreground mb-0.5 block">
                                  Note
                                </Label>
                                <Input
                                  placeholder="Optional"
                                  value={ex.note}
                                  onChange={(e) =>
                                    updateExtra(i, "note", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 border-t space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Items</span>
                        <span>{fmt(itemsTotal)}</span>
                      </div>
                      {additionalAmounts
                        .filter((e) => e.name.trim())
                        .map((e, i) => (
                          <div
                            key={i}
                            className="flex justify-between gap-2 text-muted-foreground min-w-0"
                          >
                            <span className="truncate min-w-0">{e.name}</span>
                            <span
                              className={`shrink-0 tabular-nums ${parseFloat(e.amount) < 0 ? "text-red-600" : ""}`}
                            >
                              {parseFloat(e.amount) < 0 ? "" : "+"}
                              {fmt(parseFloat(e.amount) || 0)}
                            </span>
                          </div>
                        ))}
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total</span>
                        <span>{fmt(totalAmount)}</span>
                      </div>
                      {totalAmount === 0 && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                          Total is ₹0 — set a price on at least one item to
                          continue.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground mb-1 block">
                        Note (optional)
                      </Label>
                      <Textarea
                        placeholder="Any notes…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                {/* FINANCIAL DETAILS */}
                {stepName === "Details" && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-medium mb-1 block">
                        Amount (₹)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={financialTotal}
                        onChange={(e) => setFinancialTotal(e.target.value)}
                        onBlur={(e) =>
                          setFinancialTotal(sanitizeNum(e.target.value))
                        }
                        className="text-xl h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label className="text-base font-medium mb-1 block">
                        Note
                      </Label>
                      <Textarea
                        placeholder="What is this payment for?"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {/* PAYMENT */}
                {stepName === "Payment" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/40 p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Total amount
                      </p>
                      <p className="text-3xl font-bold">{fmt(totalAmount)}</p>
                    </div>
                    <div>
                      <Label className="text-base font-medium mb-1 block">
                        Paid now (₹)
                      </Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Leave 0 if nothing paid yet. Overpayment is allowed.
                      </p>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={initialPayment.amount}
                        onChange={(e) =>
                          setInitialPayment((p) => ({
                            ...p,
                            amount: e.target.value,
                          }))
                        }
                        onBlur={(e) =>
                          setInitialPayment((p) => ({
                            ...p,
                            amount: sanitizeNum(e.target.value),
                          }))
                        }
                        className="h-12 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {isOverpaid && (
                        <div className="flex gap-2 mt-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          {overpaidMsg}
                        </div>
                      )}
                    </div>
                    {paidNow > 0 && (
                      <>
                        <div>
                          <Label className="text-base font-medium mb-1 block">
                            Method
                          </Label>
                          <Select
                            value={initialPayment.method}
                            onValueChange={(v) =>
                              setInitialPayment((p) => ({ ...p, method: v }))
                            }
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHODS.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m[0].toUpperCase() + m.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-base font-medium mb-1 block">
                            Payment note (optional)
                          </Label>
                          <Input
                            placeholder="e.g. Paid via Paytm"
                            value={initialPayment.note}
                            onChange={(e) =>
                              setInitialPayment((p) => ({
                                ...p,
                                note: e.target.value,
                              }))
                            }
                            className="h-10"
                          />
                        </div>
                      </>
                    )}
                    {totalAmount > 0 && (
                      <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-medium">
                            {fmt(totalAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Paid now
                          </span>
                          <span className="font-medium text-green-600">
                            {fmt(paidNow)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="text-muted-foreground">
                            {remaining < 0
                              ? type === "out"
                                ? "Customer credit"
                                : "Supplier owes us"
                              : "Remaining"}
                          </span>
                          <span
                            className={`font-semibold ${remaining < 0 ? "text-blue-600 dark:text-blue-400" : "text-amber-600"}`}
                          >
                            {fmt(Math.abs(remaining))}
                            {remaining < 0 && (
                              <span className="ml-1 text-sm font-normal">
                                (advance)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* REVIEW */}
                {stepName === "Review" && (
                  <div className="space-y-3">
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        {kind === "item" ? (
                          <Package className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Banknote className="w-5 h-5 text-purple-600" />
                        )}
                        <span className="font-semibold text-base capitalize">
                          {kind} {type === "out" ? "Sale" : "Purchase"}
                        </span>
                        <Badge variant="outline" className="text-sm ml-auto">
                          {paidNow > totalAmount && totalAmount > 0
                            ? "Overpaid"
                            : paidNow >= totalAmount && totalAmount > 0
                              ? "Complete"
                              : "Pending"}
                        </Badge>
                      </div>

                      {kind === "item" &&
                        itemsList.filter((it) => it.name.trim()).length > 0 && (
                          <div className="border rounded-lg divide-y overflow-hidden">
                            {itemsList
                              .filter((it) => it.name.trim())
                              .map((it, i) => {
                                const qty = parseFloat(it.quantity) || 0,
                                  price = parseFloat(it.price) || 0,
                                  total = qty * price;
                                const parts = it.name
                                  ? it.name.split(" › ")
                                  : [""];
                                const displayName =
                                  parts[parts.length - 1] || "Unnamed";
                                const cat =
                                  parts.length > 1
                                    ? parts.slice(0, -1).join(" › ")
                                    : "";
                                return (
                                  <div
                                    key={i}
                                    className="flex items-start gap-2 px-3 py-3"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium leading-snug truncate">
                                        {displayName}
                                      </p>
                                      {cat && (
                                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                                          {cat}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-1 mt-1">
                                        <span className="text-sm text-muted-foreground font-mono">
                                          {fmtNum(it.quantity)}
                                          {it.unit ? ` ${it.unit}` : ""} ×{" "}
                                          {fmt(price)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right pt-0.5">
                                      <p className="text-sm font-semibold tabular-nums whitespace-nowrap">
                                        {total > 0 ? (
                                          fmt(total)
                                        ) : (
                                          <span className="text-muted-foreground text-sm">
                                            —
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            {additionalAmounts
                              .filter((e) => e.name.trim())
                              .map((e, i) => (
                                <div
                                  key={i}
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
                        )}

                      {note && (
                        <div>
                          <p className="text-sm text-muted-foreground uppercase font-medium">
                            Note
                          </p>
                          <p className="text-sm">{note}</p>
                        </div>
                      )}

                      {/* Primary contact picked on Unassigned page */}
                      {!contact && reviewSelectedContact && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-primary shrink-0" />
                          <p className="text-sm">
                            <span className="text-muted-foreground">
                              Contact:{" "}
                            </span>
                            <span className="font-medium">
                              {reviewSelectedContact.name}
                            </span>
                          </p>
                        </div>
                      )}

                      {/* Linked contacts in review */}
                      {linkedPeople.length > 0 && (
                        <div className="rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 px-3 py-2.5">
                          <p className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1.5">
                            <Link2 className="w-3.5 h-3.5" />
                            Also involves
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {linkedPeople.map((p) => (
                              <span
                                key={p.id}
                                className="text-sm text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full"
                              >
                                {p.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-3 space-y-1.5">
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>{fmt(totalAmount)}</span>
                        </div>
                        {paidNow > 0 && (
                          <>
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Paid ({initialPayment.method})</span>
                              <span>{fmt(paidNow)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium">
                              <span>
                                {remaining < 0
                                  ? type === "out"
                                    ? "Customer credit"
                                    : "Supplier owes us"
                                  : "Remaining"}
                              </span>
                              <span
                                className={
                                  remaining < 0
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-amber-600"
                                }
                              >
                                {fmt(Math.abs(remaining))}
                                {remaining < 0 && (
                                  <span className="ml-1 text-sm font-normal">
                                    (advance)
                                  </span>
                                )}
                              </span>
                            </div>
                          </>
                        )}
                        {paidNow === 0 && (
                          <p className="text-sm text-amber-600">
                            No payment yet
                          </p>
                        )}
                      </div>
                      {isOverpaid && (
                        <div className="flex gap-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          {overpaidMsg}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {showDraftPrompt && <div className="h-2" />}
          </div>
        </div>

        {/* Fixed bottom nav */}
        <div className="border-t px-4 py-3 bg-background shrink-0">
          {!showDraftPrompt ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {step === 0 ? "Cancel" : "Back"}
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex-1"
              >
                {isLastStep ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Save
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              type="button"
              onClick={() => handleClose(false)}
              className="w-full"
            >
              <X className="w-4 h-4 mr-1" />
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
