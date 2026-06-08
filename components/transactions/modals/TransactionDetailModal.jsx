"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Edit2,
  Trash2,
  Plus,
  Check,
  X,
  Clock,
  CheckCircle2,
  History,
  CreditCard,
  AlertTriangle,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { usePriceList } from "@/hooks/usePriceList";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtC = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n ?? 0);
const fmtNum = (n) => {
  const v = parseFloat(n);
  return isNaN(v) ? "0" : String(v);
};
const sanitizeNum = (v) => {
  if (v === "" || v == null) return "";
  const n = parseFloat(v);
  return isNaN(n) ? "" : String(n);
};
const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return format(new Date(iso), "d MMM yyyy, h:mm a");
  } catch {
    return iso;
  }
};

// ─── tokenizer + fuzzy search (same as AddTransactionModal) ──────────────────
const unitSyn = {
  '"': "inch",
  inch: "inch",
  inches: "inch",
  in: "inch",
  mm: "mm",
  millimeter: "mm",
  millimetre: "mm",
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
  g: "g",
  gram: "g",
  gm: "g",
  ltr: "l",
  l: "l",
  liter: "l",
  litre: "l",
  ft: "foot",
  foot: "foot",
  feet: "foot",
  oz: "oz",
  ounce: "oz",
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
const unitToken = (w) => unitSyn[w.toLowerCase()] ?? null;
const isFrac = (t) => /^\d+\/\d+$/.test(t);
const isDec = (t) => /^\d+\.\d+$/.test(t);
const isNum = (t) => /^\d+$/.test(t);
const f2d = (f) => {
  const [a, b] = f.split("/").map(Number);
  return b ? a / b : null;
};
const d2f = (d) => {
  const o = [];
  for (const dn of [2, 3, 4, 5, 6, 8, 10, 12, 16]) {
    const num = Math.round(d * dn);
    if (Math.abs(num / dn - d) < 0.01) {
      let a = num,
        b = dn;
      while (b) {
        const t = b;
        b = a % b;
        a = t;
      }
      o.push(`${num / a}/${dn / a}`);
    }
  }
  return o;
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
    phs.push({ ph, val: m });
    return ph;
  });
  return s
    .split(/[^a-z0-9_]+/i)
    .filter(Boolean)
    .flatMap((p) => {
      const ph = phs.find((x) => x.ph === p);
      if (ph) return [ph.val];
      if (isNum(p)) return [p];
      const ut = unitToken(p);
      if (ut) return [ut];
      const c = p.replace(/[^\w]/g, "");
      return c ? [c] : [];
    })
    .filter(Boolean);
};
const lev = (a, b) => {
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
const scoreTok = (st, pt, fz = true) => {
  if (!st || !pt) return 0;
  if (pt === st) return 100;
  if (isDec(st) && isFrac(pt) && Math.abs(parseFloat(st) - f2d(pt)) < 0.01)
    return 100;
  if (isFrac(st) && isDec(pt) && Math.abs(f2d(st) - parseFloat(pt)) < 0.01)
    return 100;
  if (isDec(st) && d2f(parseFloat(st)).some((f) => pt.includes(f))) return 100;
  if (isFrac(st) && pt.includes(st)) return 70;
  if (isNum(st)) return 0;
  if (pt.startsWith(st)) return 5;
  if (new RegExp(`\\b${st}\\b`, "i").test(pt)) return 6;
  if (st.length >= 4 && pt.includes(st)) return 3;
  if (!fz) return 0;
  if (st.length >= 4 && lev(st, pt) <= Math.min(2, Math.floor(st.length / 3)))
    return 2;
  return 0;
};
const searchItems = (items, q) => {
  if (!q.trim()) return [];
  const toks = tokenize(q);
  if (!toks.length) return [];
  const sc = (it, fz) => {
    const pts = tokenize(it.path);
    let tot = 0;
    for (const st of toks) {
      const b = pts.reduce((m, pt) => Math.max(m, scoreTok(st, pt, fz)), 0);
      if (b === 0) return null;
      tot += b;
    }
    return tot;
  };
  let res = items
    .map((it) => {
      const s = sc(it, false);
      return s != null ? { ...it, _score: s } : null;
    })
    .filter(Boolean);
  if (!res.length)
    res = items
      .map((it) => {
        const s = sc(it, true);
        return s != null ? { ...it, _score: s } : null;
      })
      .filter(Boolean);
  return res.sort((a, b) => b._score - a._score);
};
const flattenPrice = (data, path = []) => {
  if (!data || typeof data !== "object") return [];
  const out = [];
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith("__")) continue;
    if (v?.type === "item") {
      const pp = [...path, k];
      out.push({
        name: k,
        fullPath: pp.join(" › "),
        path: pp.join(" › "),
        pathParts: pp,
        retailSell: v.retailSell ?? v.sell ?? 0,
        bulkSell: v.bulkSell ?? v.retailSell ?? v.sell ?? 0,
        cost: v.cost ?? 0,
        sellUnit: v.sellUnit ?? "piece",
        costUnit: v.costUnit ?? v.sellUnit ?? "piece",
      });
    } else if (v?.type === "category" && v.children) {
      out.push(...flattenPrice(v.children, [...path, k]));
    }
  }
  return out;
};

// ─── diff item lists ──────────────────────────────────────────────────────────
const diffItems = (before, after) => {
  const bM = Object.fromEntries((before || []).map((it) => [it.name, it]));
  const aM = Object.fromEntries((after || []).map((it) => [it.name, it]));
  const lines = [];
  for (const name of Object.keys(bM))
    if (!aM[name])
      lines.push({
        type: "removed",
        text: `Removed: ${name.split(" › ").pop()} (was ${fmtNum(bM[name].quantity)}${bM[name].unit ? ` ${bM[name].unit}` : ""} × ${fmtC(parseFloat(bM[name].price) || 0)})`,
      });
  for (const name of Object.keys(aM)) {
    if (!bM[name]) {
      const it = aM[name];
      lines.push({
        type: "added",
        text: `Added: ${name.split(" › ").pop()} (${fmtNum(it.quantity)}${it.unit ? ` ${it.unit}` : ""} × ${fmtC(parseFloat(it.price) || 0)})`,
      });
      continue;
    }
    const b = bM[name],
      a = aM[name];
    const parts = [];
    if (String(b.quantity) !== String(a.quantity))
      parts.push(`qty ${fmtNum(b.quantity)} → ${fmtNum(a.quantity)}`);
    if (String(b.price) !== String(a.price))
      parts.push(
        `price ${fmtC(parseFloat(b.price) || 0)} → ${fmtC(parseFloat(a.price) || 0)}`,
      );
    if ((b.unit || "") !== (a.unit || ""))
      parts.push(`unit "${b.unit || "—"}" → "${a.unit || "—"}"`);
    if (parts.length)
      lines.push({
        type: "changed",
        text: `Changed ${name.split(" › ").pop()}: ${parts.join(", ")}`,
      });
  }
  return lines;
};

// ─── diff financial transactions ──────────────────────────────────────────────
const diffFinancial = (before, after) => {
  const lines = [];
  const bAmt = parseFloat(before.totalAmount) || 0;
  const aAmt = parseFloat(after.totalAmount) || 0;
  if (Math.abs(bAmt - aAmt) > 0.001)
    lines.push({
      type: "changed",
      text: `Amount: ${fmtC(bAmt)} → ${fmtC(aAmt)}`,
    });
  if ((before.note || "") !== (after.note || ""))
    lines.push({
      type: "changed",
      text: `Note: "${before.note || ""}" → "${after.note || ""}"`,
    });
  if (before.type !== after.type)
    lines.push({
      type: "changed",
      text: `Direction: ${before.type === "out" ? "Sale" : "Purchase"} → ${after.type === "out" ? "Sale" : "Purchase"}`,
    });
  return lines;
};

// ─── CatalogSearch (module-level, stable) ────────────────────────────────────
const CatalogSearch = ({ onSelect, txType, sellPriceMode, allPriceItems }) => {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const pk =
    txType === "in"
      ? "cost"
      : sellPriceMode === "bulk"
        ? "bulkSell"
        : "retailSell";
  const uk = txType === "in" ? "costUnit" : "sellUnit";
  const results = useMemo(
    () => searchItems(allPriceItems, query).slice(0, 10),
    [allPriceItems, query],
  );
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={ref}
          type="text"
          placeholder="Search catalog…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className="w-full pl-9 pr-8 h-8 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden max-h-48 overflow-y-auto">
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
                    price: String(item[pk] ?? 0),
                    unit: item[uk],
                  });
                  setQuery("");
                  ref.current?.blur();
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
                  <p className="font-semibold text-xs shrink-0">
                    {fmtC(item[pk])}
                    <span className="text-muted-foreground font-normal">
                      /{item[uk]}
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

// ─── ItemEditRow (module-level) ───────────────────────────────────────────────
const ItemEditRow = ({ item, index, onUpdate, onRemove }) => {
  const qty = parseFloat(item.quantity) || 0,
    price = parseFloat(item.price) || 0;
  return (
    <div className="rounded border p-2.5 space-y-2 bg-background">
      <div className="flex gap-2">
        <Input
          value={item.name}
          onChange={(e) => onUpdate(index, "name", e.target.value)}
          placeholder="Item name"
          className="flex-1 h-8 text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <Label className="text-xs text-muted-foreground mb-0.5 block">
            Qty
          </Label>
          <Input
            type="number"
            min="0"
            step="any"
            value={item.quantity}
            onChange={(e) => onUpdate(index, "quantity", e.target.value)}
            onBlur={(e) =>
              onUpdate(index, "quantity", sanitizeNum(e.target.value))
            }
            placeholder="1"
            className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-0.5 block">
            Price (₹)
          </Label>
          <Input
            type="number"
            min="0"
            step="any"
            value={item.price}
            onChange={(e) => onUpdate(index, "price", e.target.value)}
            onBlur={(e) =>
              onUpdate(index, "price", sanitizeNum(e.target.value))
            }
            placeholder="0"
            className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-0.5 block">
            Unit
          </Label>
          <Input
            value={item.unit || ""}
            onChange={(e) => onUpdate(index, "unit", e.target.value)}
            placeholder="kg, ft…"
            className="h-8 text-sm"
          />
        </div>
      </div>
      {item.name && (
        <p className="text-xs text-muted-foreground text-right">
          {fmtNum(item.quantity)}
          {item.unit ? ` ${item.unit}` : ""} × {fmtC(price)} ={" "}
          <span className="font-semibold text-foreground">
            {fmtC(qty * price)}
          </span>
        </p>
      )}
    </div>
  );
};

// ─── ItemViewRow (module-level) ───────────────────────────────────────────────
const ItemViewRow = ({ item }) => {
  const qty = parseFloat(item.quantity) || 0,
    price = parseFloat(item.price) || 0;
  const parts = item.name ? item.name.split(" › ") : [""];
  const name = parts[parts.length - 1];
  const cat = parts.slice(0, -1).join(" › ");
  return (
    <div className="py-2 border-b last:border-b-0">
      <p className="text-sm font-medium leading-tight">{name}</p>
      {cat && (
        <p className="text-xs text-muted-foreground leading-tight">{cat}</p>
      )}
      <p className="text-xs text-muted-foreground mt-0.5">
        {fmtNum(item.quantity)}
        {item.unit ? ` ${item.unit}` : ""} · {fmtC(price)}
        {item.unit ? `/${item.unit}` : ""} ·{" "}
        <span className="font-medium text-foreground">{fmtC(qty * price)}</span>
      </p>
    </div>
  );
};

// ─── ChangeHistoryEntry ───────────────────────────────────────────────────────
const ChangeHistoryEntry = ({ entry }) => (
  <div className="rounded-lg border px-3 py-2.5 space-y-1.5">
    <p className="text-xs font-medium text-muted-foreground">
      {fmtDate(entry.date)}
    </p>
    {(entry.changes ?? []).filter(Boolean).map((c, j) => (
      <p
        key={j}
        className={`text-sm ${
          c.type === "added"
            ? "text-green-700 dark:text-green-400"
            : c.type === "removed"
              ? "text-red-700 dark:text-red-400"
              : "text-foreground"
        }`}
      >
        {typeof c === "string" ? c : c.text}
      </p>
    ))}
    {entry.noteChange && (
      <p className="text-xs text-muted-foreground">Note: {entry.noteChange}</p>
    )}
    {entry.totalBefore !== undefined &&
      entry.totalBefore !== entry.totalAfter && (
        <p className="text-xs text-muted-foreground">
          Total: {fmtC(entry.totalBefore)} → {fmtC(entry.totalAfter)}
        </p>
      )}
  </div>
);

// ─── main modal ───────────────────────────────────────────────────────────────
export const TransactionDetailModal = ({
  open,
  onOpenChange,
  transaction,
  contact,
  allTransactions = [],
  onUpdate,
  onDelete,
  onAddPayment,
  onNavigateToTransaction,
}) => {
  const { priceData, sellPriceMode } = usePriceList();

  // ── all hooks first, unconditionally ─────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editedTx, setEditedTx] = useState(null);

  useEffect(() => {
    if (transaction) {
      setEditedTx({ ...transaction });
      setEditMode(false);
    }
  }, [transaction]);

  const allPriceItems = useMemo(() => flattenPrice(priceData), [priceData]);

  const liveTotal = useMemo(() => {
    if (!editedTx) return 0;
    if (editedTx.kind !== "item") return parseFloat(editedTx.totalAmount) || 0;
    const items = (editedTx.itemsList ?? []).reduce(
      (s, it) =>
        s + (parseFloat(it.price) || 0) * (parseFloat(it.quantity) || 0),
      0,
    );
    const extras = (editedTx.additionalAmounts ?? []).reduce(
      (s, ex) => s + (parseFloat(ex.amount) || 0),
      0,
    );
    return items + extras;
  }, [editedTx]);

  const liveRemaining = useMemo(
    () => liveTotal - (editedTx?.paidAmount ?? 0),
    [editedTx, liveTotal],
  );

  const updateItem = useCallback((i, field, value) => {
    setEditedTx((prev) => {
      const next = [...(prev.itemsList ?? [])];
      next[i] = { ...next[i], [field]: value };
      return { ...prev, itemsList: next };
    });
  }, []);
  const addItem = useCallback(() => {
    setEditedTx((prev) => ({
      ...prev,
      itemsList: [
        ...(prev.itemsList ?? []),
        { name: "", quantity: "1", price: "0", unit: "" },
      ],
    }));
  }, []);
  const removeItem = useCallback((i) => {
    setEditedTx((prev) => ({
      ...prev,
      itemsList: (prev.itemsList ?? []).filter((_, j) => j !== i),
    }));
  }, []);
  const addFromCatalog = useCallback((item) => {
    setEditedTx((prev) => ({
      ...prev,
      itemsList: [
        ...(prev.itemsList ?? []),
        {
          name: item.name,
          quantity: "1",
          price: String(item.price),
          unit: item.unit || "",
        },
      ],
    }));
  }, []);

  // ── early return after all hooks ─────────────────────────────────────────
  if (!transaction || !editedTx) return null;

  const tx = transaction;
  const isItem = tx.kind === "item";
  const isPending = tx.status === "pending";
  const isOverpaid = tx.status === "overpaid";
  const remaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
  const progress =
    tx.totalAmount > 0
      ? Math.min((tx.paidAmount / tx.totalAmount) * 100, 100)
      : 0;
  const overpaidAmt = Math.abs(remaining);
  const overpaidMsg =
    tx.type === "out"
      ? `Customer overpaid ${fmtC(overpaidAmt)} — they have a credit with us`
      : `We overpaid ${fmtC(overpaidAmt)} — supplier owes us this back`;

  const handleSave = async () => {
    const u = { ...editedTx };
    if (isItem) {
      u.totalAmount = liveTotal;
      const changes = diffItems(tx.itemsList, u.itemsList);
      const noteChanged = tx.note !== u.note;
      const hasChange = changes.length > 0 || noteChanged;
      if (hasChange) {
        u.itemListHistory = [
          ...(u.itemListHistory ?? []),
          {
            date: new Date().toISOString(),
            changes,
            ...(noteChanged
              ? { noteChange: `"${tx.note || ""}" → "${u.note || ""}"` }
              : {}),
            totalBefore: tx.totalAmount,
            totalAfter: u.totalAmount,
          },
        ];
      }
    } else {
      // financial: track changes separately
      const changes = diffFinancial(tx, u);
      if (changes.length > 0) {
        u.itemListHistory = [
          ...(u.itemListHistory ?? []),
          {
            date: new Date().toISOString(),
            changes,
            totalBefore: tx.totalAmount,
            totalAfter: parseFloat(u.totalAmount) || 0,
          },
        ];
      }
    }
    const total = parseFloat(u.totalAmount || 0);
    const paid = u.paidAmount ?? 0;
    u.status =
      paid > total && total > 0
        ? "overpaid"
        : paid >= total && total > 0
          ? "complete"
          : "pending";
    await onUpdate(tx.id, u);
    setEditMode(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg p-0 gap-0 overflow-hidden">
        {/* ── header ── */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            {isItem ? (
              <Package className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <Banknote className="w-4 h-4 text-purple-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-tight">
                {isItem ? "Item" : "Financial"} Transaction
              </DialogTitle>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 break-all">
                {tx.id}
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="px-4 py-3 space-y-4">
            {/* direction + status + date */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {tx.type === "out" ? (
                  <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {tx.type === "out"
                      ? "Sale (we gave / sold)"
                      : "Purchase (we received / bought)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(tx.createdAt)}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 text-xs ${isPending ? "border-amber-400 text-amber-700 dark:text-amber-400" : isOverpaid ? "border-blue-400 text-blue-700 dark:text-blue-400" : "border-green-400 text-green-700 dark:text-green-400"}`}
              >
                {isPending ? (
                  <Clock className="w-3 h-3 mr-1 inline" />
                ) : isOverpaid ? (
                  <AlertTriangle className="w-3 h-3 mr-1 inline" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                )}
                {tx.status}
              </Badge>
            </div>

            {/* edit mode banner */}
            {editMode && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary font-medium">
                ✏️ Edit mode — make changes below, then tap Save
              </div>
            )}

            <Separator />

            {/* ── ITEMS (item tx) ───────────────────────────────────────────── */}
            {isItem && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Items</Label>
                  {editMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={addItem}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg px-3 py-0.5">
                  {editMode ? (
                    (editedTx.itemsList ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center">
                        No items yet
                      </p>
                    ) : (
                      (editedTx.itemsList ?? []).map((item, i) => (
                        <div
                          key={i}
                          className="py-1.5 border-b last:border-b-0"
                        >
                          <ItemEditRow
                            item={item}
                            index={i}
                            onUpdate={updateItem}
                            onRemove={removeItem}
                          />
                        </div>
                      ))
                    )
                  ) : (
                    (tx.itemsList ?? []).map((it, i) => (
                      <ItemViewRow key={i} item={it} />
                    ))
                  )}
                  {!editMode &&
                    tx.additionalAmounts
                      ?.filter((e) => e.name)
                      .map((e, i) => (
                        <div
                          key={i}
                          className="py-1.5 border-b last:border-b-0 flex justify-between text-sm"
                        >
                          <span className="text-muted-foreground">
                            {e.name}
                          </span>
                          <span
                            className={
                              parseFloat(e.amount) < 0 ? "text-red-600" : ""
                            }
                          >
                            {fmtC(parseFloat(e.amount) || 0)}
                          </span>
                        </div>
                      ))}
                </div>

                {editMode && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Search catalog to add
                    </Label>
                    <CatalogSearch
                      onSelect={addFromCatalog}
                      txType={tx.type}
                      sellPriceMode={sellPriceMode}
                      allPriceItems={allPriceItems}
                    />
                  </div>
                )}

                {/* live totals while editing */}
                {editMode && (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
                    <div className="flex justify-between font-semibold">
                      <span>Revised total</span>
                      <span>{fmtC(liveTotal)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Paid</span>
                      <span>{fmtC(editedTx.paidAmount ?? 0)}</span>
                    </div>
                    <div
                      className={`flex justify-between font-semibold border-t pt-1 ${liveRemaining < 0 ? "text-blue-600 dark:text-blue-400" : "text-amber-600"}`}
                    >
                      <span>
                        {liveRemaining < 0
                          ? tx.type === "out"
                            ? "Customer credit"
                            : "Supplier owes us"
                          : "Remaining"}
                      </span>
                      <span>
                        {fmtC(Math.abs(liveRemaining))}
                        {liveRemaining < 0 && (
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

            {/* ── FINANCIAL AMOUNT (financial tx) ──────────────────────────── */}
            {!isItem && (
              <div>
                <Label className="text-sm font-semibold mb-1.5 block">
                  Amount
                </Label>
                {editMode ? (
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={editedTx.totalAmount ?? 0}
                    onChange={(e) =>
                      setEditedTx((p) => ({
                        ...p,
                        totalAmount: e.target.value,
                      }))
                    }
                    onBlur={(e) =>
                      setEditedTx((p) => ({
                        ...p,
                        totalAmount: sanitizeNum(e.target.value),
                      }))
                    }
                    className="text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <p className="text-2xl font-bold">{fmtC(tx.totalAmount)}</p>
                )}
              </div>
            )}

            {/* ── NOTE ─────────────────────────────────────────────────────── */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Note</Label>
              {editMode ? (
                <Textarea
                  value={editedTx.note ?? ""}
                  rows={2}
                  placeholder="Add a note…"
                  onChange={(e) =>
                    setEditedTx((p) => ({ ...p, note: e.target.value }))
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tx.note || <span className="italic">No note</span>}
                </p>
              )}
            </div>

            <Separator />

            {/* ── PAYMENT SUMMARY ───────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payment</Label>

              {/* amounts grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                  <p className="text-sm font-bold">{fmtC(tx.totalAmount)}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Paid</p>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">
                    {fmtC(tx.paidAmount)}
                  </p>
                </div>
                <div
                  className={`rounded-lg border p-2.5 ${isOverpaid ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30" : ""}`}
                >
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {isOverpaid
                      ? "Advance"
                      : remaining === 0
                        ? "Status"
                        : "Due"}
                  </p>
                  <p
                    className={`text-sm font-bold ${isOverpaid ? "text-amber-700 dark:text-amber-400" : remaining === 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {isOverpaid
                      ? `+${fmtC(overpaidAmt)}`
                      : remaining === 0
                        ? "Settled"
                        : fmtC(remaining)}
                  </p>
                </div>
              </div>

              {/* progress bar */}
              {tx.paidAmount > 0 && !isOverpaid && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              )}

              {/* overpayment banner */}
              {isOverpaid && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {overpaidMsg}
                  </p>
                </div>
              )}

              {isPending && remaining > 0 && !editMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9"
                  onClick={onAddPayment}
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  Record payment
                </Button>
              )}
            </div>

            {/* ── PAYMENT HISTORY ───────────────────────────────────────────── */}
            {tx.paidAmountHistory?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-sm font-semibold">
                    Payment history
                  </Label>
                </div>
                <div className="space-y-2">
                  {tx.paidAmountHistory.map((p, i) => {
                    const isSettlement = p.method === "settlement";
                    const isAdvanceApplied = p.method === "advance-applied";
                    const isSettlementType = isSettlement || isAdvanceApplied;
                    const amountVal = p.amount ?? 0;

                    // Build a human-readable before→after balance line when
                    // balanceBefore was stored (all new settlement entries have it).
                    let balanceLine = null;
                    if (isSettlementType && p.balanceBefore !== undefined) {
                      const before = p.balanceBefore;
                      const after = p.balanceAfter ?? 0;
                      if (isAdvanceApplied) {
                        // before is negative (advance), after moves toward 0
                        const beforeLabel = `Advance ${fmtC(Math.abs(before))}`;
                        const afterLabel =
                          Math.abs(after) < 0.01
                            ? "Fully consumed"
                            : `Advance ${fmtC(Math.abs(after))} remaining`;
                        balanceLine = {
                          before: beforeLabel,
                          after: afterLabel,
                          afterOk: Math.abs(after) < 0.01,
                        };
                      } else {
                        // before is positive (due), after moves toward 0
                        const beforeLabel = `Due ${fmtC(before)}`;
                        const afterLabel =
                          after <= 0.01
                            ? "Fully settled"
                            : `${fmtC(after)} still due`;
                        balanceLine = {
                          before: beforeLabel,
                          after: afterLabel,
                          afterOk: after <= 0.01,
                        };
                      }
                    }

                    return (
                      <div
                        key={i}
                        className={`rounded-lg border px-3 py-2 flex items-start justify-between gap-2 ${
                          isSettlementType
                            ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                            : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          {/* Amount + badge row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p
                              className={`text-sm font-semibold ${isAdvanceApplied ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
                            >
                              {isAdvanceApplied
                                ? `−${fmtC(Math.abs(amountVal))}`
                                : fmtC(amountVal)}
                            </p>
                            {isSettlement && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                Auto-settled
                              </span>
                            )}
                            {isAdvanceApplied && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                Advance applied
                              </span>
                            )}
                          </div>

                          {/* Before → After balance context */}
                          {balanceLine && (
                            <div className="flex items-center gap-1 mt-1 text-xs">
                              <span className="text-muted-foreground">
                                {balanceLine.before}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span
                                className={
                                  balanceLine.afterOk
                                    ? "text-green-600 dark:text-green-400 font-medium"
                                    : "text-amber-600 font-medium"
                                }
                              >
                                {balanceLine.after}
                              </span>
                            </div>
                          )}

                          {/* Method / note for non-settlement entries */}
                          {!isSettlementType && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.method}
                              {p.note ? ` · ${p.note}` : ""}
                            </p>
                          )}

                          {/* Partner transaction IDs — full UUID, clickable */}
                          {isSettlementType && p.partnerIds?.length > 0 && (
                            <div className="mt-1.5 space-y-1">
                              {p.partnerIds.map((pid) => {
                                const partnerTx = allTransactions.find(
                                  (t) => t.id === pid,
                                );
                                return (
                                  <button
                                    key={pid}
                                    type="button"
                                    onClick={() =>
                                      partnerTx &&
                                      onNavigateToTransaction?.(partnerTx)
                                    }
                                    className={`block w-full text-left text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                                      partnerTx
                                        ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                                        : "border-muted bg-muted/30 text-muted-foreground cursor-default"
                                    }`}
                                    title={
                                      partnerTx
                                        ? "Open this transaction"
                                        : "Transaction not found"
                                    }
                                  >
                                    {pid}
                                    {partnerTx && (
                                      <span className="ml-1.5 text-blue-500 dark:text-blue-400">
                                        ↗
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0 text-right whitespace-nowrap">
                          {fmtDate(p.date)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── CHANGE HISTORY (both item and financial) ──────────────────── */}
            {tx.itemListHistory?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-sm font-semibold">
                    Change history
                  </Label>
                </div>
                <div className="space-y-2">
                  {tx.itemListHistory.map((h, i) => (
                    <ChangeHistoryEntry key={i} entry={h} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── bottom action bar ── */}
        <div className="border-t px-4 py-3 flex items-center gap-2 bg-background">
          {!editMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setEditMode(true)}
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => onDelete(tx.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => {
                  setEditMode(false);
                  setEditedTx({ ...transaction });
                }}
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={handleSave}>
                <Check className="w-3.5 h-3.5" />
                Save changes
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
