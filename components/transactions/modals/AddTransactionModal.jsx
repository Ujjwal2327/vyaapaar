/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
    // Only save if there's something meaningful beyond the default kind/type
    // selection — items added, a financial amount, a note, or non-default
    // kind/type choices all count as real user intent worth preserving.
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
  } catch {
    // ignore storage errors
  }
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
  } catch {
    // ignore
  }
};

const draftSummary = (draft) => {
  if (!draft) return "";
  const parts = [];
  if (draft.kind && draft.type) {
    parts.push(
      `${draft.kind === "item" ? "Item" : "Financial"} ${draft.type === "out" ? "Sale" : "Purchase"}`,
    );
  } else if (draft.kind) {
    parts.push(draft.kind === "item" ? "Item" : "Financial");
  } else if (draft.type) {
    parts.push(draft.type === "out" ? "Sale" : "Purchase");
  }
  if (draft.kind === "item" && draft.itemsList?.length > 0) {
    const named = draft.itemsList.filter((it) => it.name?.trim());
    if (named.length > 0) {
      parts.push(`${named.length} item${named.length !== 1 ? "s" : ""}`);
    }
  }
  if (draft.financialTotal) {
    parts.push(`₹${draft.financialTotal}`);
  }
  return parts.join(" · ");
};

// ─── tokenizer (mirrors priceListUtils exactly) ───────────────────────────────
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
      } // gcd
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
  // reducer  1/2-3/4
  s = s.replace(/(\d+\/\d+)\s*["-]\s*(\d+\/\d+)/g, (_, a, b) => {
    const ph = `__R${idx++}__`;
    phs.push({ ph, val: `${a}-${b}` });
    return ph;
  });
  // fraction 1/2
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => {
    const ph = `__F${idx++}__`;
    phs.push({ ph, val: `${a}/${b}` });
    return ph;
  });
  // decimal 1.25
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

// ─── Levenshtein distance ─────────────────────────────────────────────────────
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

// ─── token scoring (mirrors matchTokenAgainst) ────────────────────────────────
const scoreToken = (st, pt, fuzzy = true) => {
  if (!st || !pt) return 0;
  if (pt === st) return 100;

  // decimal ↔ fraction
  if (isDecimal(st) && isFraction(pt)) {
    if (Math.abs(parseFloat(st) - frac2dec(pt)) < 0.01) return 100;
  }
  if (isFraction(st) && isDecimal(pt)) {
    if (Math.abs(frac2dec(st) - parseFloat(pt)) < 0.01) return 100;
  }
  if (isDecimal(st) && dec2fracs(parseFloat(st)).some((f) => pt.includes(f)))
    return 100;
  if (isDecimal(pt) && dec2fracs(parseFloat(pt)).some((f) => st.includes(f)))
    return 100;

  // fraction
  if (isFraction(st) && pt.includes(st)) return 70;

  // numeric — no substring match
  if (isNumeric(st)) return 0;

  if (!fuzzy) {
    if (pt.startsWith(st)) return 5;
    const re = new RegExp(`\\b${st}\\b`, "i");
    if (re.test(pt)) return 6;
    if (st.length >= 4 && pt.includes(st)) return 3;
    return 0;
  }

  if (pt.startsWith(st)) return 5;
  const re = new RegExp(`\\b${st}\\b`, "i");
  if (re.test(pt)) return 6;
  if (st.length >= 4 && pt.includes(st)) return 3;

  // Levenshtein fuzzy
  if (st.length >= 4) {
    const dist = levenshtein(st, pt);
    const maxD = Math.min(2, Math.floor(st.length / 3));
    if (dist <= maxD) return 2;
  }
  return 0;
};

// ─── two-pass search (exact+substring first, fuzzy fallback) ─────────────────
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

  // pass 1: exact + substring only
  let results = items
    .map((it) => {
      const s = score(it, false);
      return s != null ? { ...it, _score: s } : null;
    })
    .filter(Boolean);

  // pass 2: fuzzy fallback
  if (results.length === 0) {
    results = items
      .map((it) => {
        const s = score(it, true);
        return s != null ? { ...it, _score: s } : null;
      })
      .filter(Boolean);
  }

  return results.sort((a, b) => b._score - a._score);
};

// ─── flatten price list ───────────────────────────────────────────────────────
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

// ─── PriceItemSearch — stable identity (module-level) ────────────────────────
const PriceItemSearch = ({
  onSelect,
  txType,
  sellPriceMode,
  allPriceItems,
}) => {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

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

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder={`Search catalog (${priceLabel.toLowerCase()} price)…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className="w-full pl-9 pr-8 h-9 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {focused && query.trim() && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden max-h-60 overflow-y-auto">
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
                  onSelect({
                    name: item.fullPath,
                    quantity: "1",
                    price: String(item[priceKey] ?? 0),
                    unit: item[unitKey],
                  });
                  setQuery("");
                  inputRef.current?.blur();
                }}
                className="w-full px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    {item.pathParts.length > 1 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.pathParts.slice(0, -1).join(" › ")}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold text-xs shrink-0 text-right">
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
  );
};

// ─── ItemRow — always-visible compact inputs (module-level) ──────────────────
const ItemRow = ({ item, index, onUpdate, onRemove }) => {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.price) || 0;
  const total = qty * price;
  const cat =
    item.name && item.name.includes(" › ")
      ? item.name.split(" › ").slice(0, -1).join(" › ")
      : "";

  const inputCls =
    "bg-muted border-0 rounded px-1.5 py-0.5 text-xs font-mono outline-none focus:bg-primary/10 focus:ring-1 focus:ring-primary min-w-0 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-b-0 overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate(index, "name", e.target.value)}
          placeholder="Item name"
          className="w-full bg-muted border-0 rounded px-2 py-1 text-sm font-medium outline-none focus:bg-primary/10 focus:ring-1 focus:ring-primary transition-colors"
        />
        {/* always rendered so DOM structure stays stable — prevents sibling inputs losing focus */}
        <p className="text-[0.6875rem] text-muted-foreground truncate px-1 min-h-[1rem]">
          {cat}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate(index, "quantity", e.target.value)}
            placeholder="qty"
            className={`${inputCls} w-14`}
          />
          <input
            type="text"
            value={item.unit || ""}
            onChange={(e) => onUpdate(index, "unit", e.target.value)}
            placeholder="unit"
            className={`${inputCls} w-14`}
          />
          <span className="text-[0.6875rem] text-muted-foreground">×</span>
          <input
            type="number"
            value={item.price}
            onChange={(e) => onUpdate(index, "price", e.target.value)}
            placeholder="₹0"
            className={`${inputCls} w-16`}
          />
          {total > 0 && (
            <>
              <span className="text-[0.6875rem] text-muted-foreground">=</span>
              <span className="text-[0.6875rem] font-semibold tabular-nums">
                {fmt(total)}
              </span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="shrink-0 mt-1 w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ─── ItemDisplayRow — read-only, used in Review ───────────────────────────────
const ItemDisplayRow = ({ item, isLast }) => {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.price) || 0;
  const total = qty * price;
  const displayName = item.name ? item.name.split(" › ").pop() : "";
  const hasPath = item.name && item.name.includes(" › ");
  return (
    <div
      className={`flex items-start gap-2 py-2.5 overflow-hidden ${!isLast ? "border-b" : ""}`}
    >
      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-medium leading-snug break-all">
          {displayName}
        </p>
        {hasPath && (
          <p className="text-[0.6875rem] text-muted-foreground break-all mt-0.5">
            {item.name.split(" › ").slice(0, -1).join(" › ")}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="inline-flex items-center text-[0.6875rem] bg-muted rounded px-1.5 py-0.5 text-muted-foreground font-mono">
            {fmtNum(item.quantity)}
            {item.unit ? ` ${item.unit}` : ""}
          </span>
          <span className="text-[0.6875rem] text-muted-foreground shrink-0">
            ×
          </span>
          <span className="inline-flex items-center text-[0.6875rem] bg-muted rounded px-1.5 py-0.5 text-muted-foreground font-mono">
            {fmt(price)}
            {item.unit ? `/${item.unit}` : ""}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right pt-0.5">
        <p className="text-sm font-semibold tabular-nums whitespace-nowrap">
          {fmt(total)}
        </p>
      </div>
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
});

// ─── main modal ───────────────────────────────────────────────────────────────
export const AddTransactionModal = ({ open, onOpenChange, contact, onAdd }) => {
  const { priceData, sellPriceMode } = usePriceList();
  const contactId = contact?.id;

  // ── draft prompt state ────────────────────────────────────────────────────
  // null   = not checked yet / no draft found
  // object = draft loaded, showing restore prompt
  const [pendingDraft, setPendingDraft] = useState(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  // ── form state ────────────────────────────────────────────────────────────
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

  // ── check for a saved draft when the modal opens ──────────────────────────
  useEffect(() => {
    if (!open || !contactId) return;
    const draft = loadDraft(contactId);
    if (draft) {
      setPendingDraft(draft);
      setShowDraftPrompt(true);
    }
  }, [open, contactId]);

  // ── auto-save draft on every meaningful change while modal is open ────────
  // We intentionally do NOT save when the modal is closed (that's handled
  // by handleClose — which either clears on submit or saves on dismiss).
  const formStateRef = useRef({});
  useEffect(() => {
    formStateRef.current = {
      step,
      kind,
      type,
      itemsList,
      additionalAmounts,
      note,
      initialPayment,
      financialTotal,
    };
  });

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

  // overpayment framing
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
  };

  const reset = () => {
    applyState(blankState());
  };

  const handleClose = (v) => {
    if (!v) {
      // Closing without submitting — save whatever is in the form as a draft,
      // but only if there's actual content beyond the default kind/type selection
      // (avoids saving blank dismissals where the user opened and immediately closed).
      const current = formStateRef.current;
      const hasContent =
        current.kind !== "item" ||
        current.type !== "out" ||
        (current.itemsList ?? []).length > 0 ||
        current.financialTotal !== "" ||
        current.note !== "";
      if (hasContent && contactId) {
        saveDraft(contactId, current);
      }
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
      status:
        paidNow > totalAmount && totalAmount > 0
          ? "overpaid"
          : paidNow >= totalAmount && totalAmount > 0
            ? "complete"
            : "pending",
    });
    // Success — clear draft and reset form
    if (contactId) clearDraft(contactId);
    reset();
  };

  const handleRestoreDraft = () => {
    if (pendingDraft) {
      applyState(pendingDraft);
    }
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
    // Block the Payment and Review steps if items total to zero — that tx
    // would be permanently stuck as "pending" with nothing to ever settle.
    if ((stepName === "Extras" || stepName === "Payment") && kind === "item")
      return totalAmount > 0;
    return true;
  };

  // ── item mutators — useCallback so identity is stable ────────────────────
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
        quantity: "1",
        price: String(item.price),
        unit: item.unit || "",
      },
    ]);
  }, []);

  // extras mutators
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            New Transaction
            {step > 0 && kind && type && (
              <span className="flex items-center gap-1.5 ml-1">
                {kind === "item" ? (
                  <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                ) : (
                  <Banknote className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                )}
                {type === "out" ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-600 shrink-0" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" />
                )}
                <span className="text-xs font-normal text-muted-foreground">
                  {kind === "item" ? "Item" : "Financial"}{" "}
                  {type === "out" ? "Sale" : "Purchase"}
                </span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Draft restore prompt ─────────────────────────────────────────── */}
        {showDraftPrompt && pendingDraft && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <FileEdit className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Unsaved draft found
                </p>
                {draftSummary(pendingDraft) && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 truncate">
                    {draftSummary(pendingDraft)}
                  </p>
                )}
                {pendingDraft.savedAt && (
                  <p className="text-[0.625rem] text-amber-600/70 dark:text-amber-500/70 mt-0.5">
                    Saved{" "}
                    {(() => {
                      try {
                        const d = new Date(pendingDraft.savedAt);
                        const now = new Date();
                        const diffMs = now - d;
                        const diffMins = Math.floor(diffMs / 60000);
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
                className="flex-1 text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                onClick={handleDiscardDraft}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Discard
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white border-0"
                onClick={handleRestoreDraft}
              >
                <FileEdit className="w-3 h-3 mr-1" />
                Resume draft
              </Button>
            </div>
          </div>
        )}

        {/* progress */}
        {kind && !showDraftPrompt && (
          <div className="flex items-center gap-1 pb-1">
            {steps.map((s, i) => (
              <div
                key={s}
                className="flex-1 h-1 rounded-full transition-colors"
                style={{
                  background:
                    i <= step ? "hsl(var(--primary))" : "hsl(var(--muted))",
                }}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
              {step + 1}/{steps.length}
            </span>
          </div>
        )}

        {/* Hide form steps while draft prompt is showing */}
        {!showDraftPrompt && (
          <>
            {/* ── TYPE ──────────────────────────────────────────────────────────── */}
            {stepName === "Type" && (
              <div className="space-y-5 min-h-[13.75rem]">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Kind</Label>
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
                        <Icon className="w-5 h-5 mb-2 text-primary" />
                        <p className="font-semibold text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Direction</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        value: "out",
                        label: "Sale / We give",
                        icon: TrendingUp,
                        desc: `Sell to ${contact?.name}`,
                        color: "text-green-600",
                      },
                      {
                        value: "in",
                        label: "Purchase / We get",
                        icon: TrendingDown,
                        desc: `Buy from ${contact?.name}`,
                        color: "text-red-600",
                      },
                    ].map(({ value, label, icon: Icon, desc, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        className={`rounded-lg border-2 p-4 text-left transition-all ${type === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${color}`} />
                        <p className="font-semibold text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── ITEMS ─────────────────────────────────────────────────────────── */}
            {stepName === "Items" && (
              <div className="space-y-3 min-h-[13.75rem]">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBlankItem}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add blank
                  </Button>
                </div>

                {itemsList.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-4 border rounded-lg">
                    Search the catalog below or add a blank item
                  </p>
                ) : (
                  <div className="border rounded-lg px-3 max-h-56 overflow-y-auto overflow-x-hidden divide-y">
                    {itemsList.map((item, i) => (
                      <ItemRow
                        key={i}
                        item={item}
                        index={i}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                      />
                    ))}
                  </div>
                )}

                {itemsList.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {itemsList.filter((it) => it.name.trim()).length} item
                      {itemsList.filter((it) => it.name.trim()).length !== 1
                        ? "s"
                        : ""}
                    </span>
                    <span className="font-semibold tabular-nums">
                      Total: {fmt(itemsTotal)}
                    </span>
                  </div>
                )}

                {/* search at bottom */}
                <div className="pt-1 border-t space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Search catalog (
                    {type === "in"
                      ? "cost"
                      : sellPriceMode === "bulk"
                        ? "bulk"
                        : "retail"}{" "}
                    price)
                  </Label>
                  <PriceItemSearch
                    onSelect={addItemFromSearch}
                    txType={type}
                    sellPriceMode={sellPriceMode}
                    allPriceItems={allPriceItems}
                  />
                </div>
              </div>
            )}

            {/* ── EXTRAS ────────────────────────────────────────────────────────── */}
            {stepName === "Extras" && (
              <div className="space-y-3 min-h-[13.75rem]">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">
                      Additional charges / discounts
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                  <p className="text-xs text-center text-muted-foreground py-4 border rounded-lg">
                    No extras — skip or add one
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {additionalAmounts.map((ex, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-2">
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
                            <Label className="text-xs text-muted-foreground mb-0.5 block">
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
                            <Label className="text-xs text-muted-foreground mb-0.5 block">
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

                <div className="pt-2 border-t space-y-1 text-sm">
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
                          className={`shrink-0 tabular-nums ${
                            parseFloat(e.amount) < 0 ? "text-red-600" : ""
                          }`}
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
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Total is ₹0 — set a price on at least one item to
                      continue.
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
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

            {/* ── FINANCIAL DETAILS ─────────────────────────────────────────────── */}
            {stepName === "Details" && (
              <div className="space-y-4 min-h-[13.75rem]">
                <div>
                  <Label className="text-sm font-medium mb-1 block">
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
                    className="text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1 block">Note</Label>
                  <Textarea
                    placeholder="What is this payment for?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* ── PAYMENT ───────────────────────────────────────────────────────── */}
            {stepName === "Payment" && (
              <div className="space-y-4 min-h-[13.75rem]">
                <div className="rounded-lg border bg-muted/40 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total amount</p>
                  <p className="text-2xl font-bold">{fmt(totalAmount)}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">
                    Paid now (₹)
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
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
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {isOverpaid && (
                    <div className="flex gap-2 mt-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {overpaidMsg}
                    </div>
                  )}
                </div>

                {paidNow > 0 && (
                  <>
                    <div>
                      <Label className="text-sm font-medium mb-1 block">
                        Method
                      </Label>
                      <Select
                        value={initialPayment.method}
                        onValueChange={(v) =>
                          setInitialPayment((p) => ({ ...p, method: v }))
                        }
                      >
                        <SelectTrigger>
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
                      <Label className="text-sm font-medium mb-1 block">
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
                      />
                    </div>
                  </>
                )}

                {totalAmount > 0 && (
                  <div className="rounded-lg border p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{fmt(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid now</span>
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
                          <span className="ml-1 text-xs font-normal">
                            (advance)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── REVIEW ────────────────────────────────────────────────────────── */}
            {stepName === "Review" && (
              <div className="space-y-3 min-h-[13.75rem]">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {kind === "item" ? (
                      <Package className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Banknote className="w-4 h-4 text-purple-600" />
                    )}
                    <span className="font-semibold capitalize">
                      {kind} {type === "out" ? "Sale" : "Purchase"}
                    </span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {paidNow > totalAmount && totalAmount > 0
                        ? "Overpaid"
                        : paidNow >= totalAmount && totalAmount > 0
                          ? "Complete"
                          : "Pending"}
                    </Badge>
                  </div>

                  {kind === "item" &&
                    itemsList.filter((it) => it.name.trim()).length > 0 && (
                      <div className="border rounded-lg px-3 divide-y overflow-hidden">
                        {itemsList
                          .filter((it) => it.name.trim())
                          .map((it, i, arr) => (
                            <ItemDisplayRow
                              key={i}
                              item={it}
                              isLast={
                                i === arr.length - 1 &&
                                additionalAmounts.filter((e) => e.name.trim())
                                  .length === 0
                              }
                            />
                          ))}
                        {additionalAmounts
                          .filter((e) => e.name.trim())
                          .map((e, i) => (
                            <div
                              key={i}
                              className="py-2 flex justify-between gap-2 text-sm min-w-0"
                            >
                              <span className="text-muted-foreground truncate min-w-0">
                                {e.name}
                              </span>
                              <span
                                className={`shrink-0 tabular-nums ${
                                  parseFloat(e.amount) < 0 ? "text-red-600" : ""
                                }`}
                              >
                                {fmt(parseFloat(e.amount) || 0)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}

                  {note && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium">
                        Note
                      </p>
                      <p className="text-sm">{note}</p>
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-1">
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
                              <span className="ml-1 text-xs font-normal">
                                (advance)
                              </span>
                            )}
                          </span>
                        </div>
                      </>
                    )}
                    {paidNow === 0 && (
                      <p className="text-sm text-amber-600">No payment yet</p>
                    )}
                  </div>

                  {isOverpaid && (
                    <div className="flex gap-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {overpaidMsg}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* nav */}
            <div className="flex gap-2 pt-2 border-t">
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
          </>
        )}

        {/* When showing draft prompt, show action buttons below it */}
        {showDraftPrompt && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleClose(false)}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" />
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
