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
  Ban,
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

// ─── tokenizer + fuzzy search ──────────────────────────────────────────────
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

// ─── diff helpers ──────────────────────────────────────────────────────────────
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

// ─── shared input style ──────────────────────────────────────────────────────
const inputCls =
  "bg-muted border-0 rounded px-2 py-1 text-sm font-mono outline-none focus:bg-primary/10 focus:ring-1 focus:ring-primary min-w-0 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// ─── CatalogSearch ────────────────────────────────────────────────────────────
const CatalogSearch = ({
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
  const ref = useRef(null);
  const qtyRef = useRef(null);

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

  const pickItem = (item) => {
    setPending(item);
    setPendingQty("1");
    setPendingPrice(String(item[pk] ?? 0));
    setPendingUnit(item[uk] ?? "");
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
    setTimeout(() => ref.current?.focus(), 60);
  };

  const cancelPending = () => {
    setPending(null);
    setTimeout(() => ref.current?.focus(), 60);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={ref}
            type="text"
            placeholder="Search catalog…"
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
          {focused && query.trim() && (
            <div className="absolute z-[200] top-full mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto">
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
                      <p className="font-semibold text-sm shrink-0">
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
        {onAddBlank && (
          <button
            type="button"
            onClick={onAddBlank}
            className="shrink-0 h-10 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4" />
            Blank
          </button>
        )}
      </div>

      {pending && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
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
                  {fmtC(parseFloat(pendingQty) * parseFloat(pendingPrice))}
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
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ItemsEditTabPanel ────────────────────────────────────────────────────────
const ItemsEditTabPanel = ({
  editedTx,
  updateItem,
  removeItem,
  addItem,
  addFromCatalog,
  txType,
  sellPriceMode,
  allPriceItems,
  liveTotal,
  liveRemaining,
  saveBlockedZeroTotal,
}) => {
  const [activeTab, setActiveTab] = useState("cart");
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [blankPending, setBlankPending] = useState(null);
  const blankNameRef = useRef(null);
  const itemsList = editedTx?.itemsList ?? [];
  const namedCount = itemsList.filter((it) => it.name?.trim()).length;

  const handleAddBlank = () => {
    setBlankPending({ name: "", qty: "1", price: "", unit: "" });
    setTimeout(() => blankNameRef.current?.focus(), 60);
  };

  const confirmBlank = () => {
    if (!blankPending) return;
    addFromCatalog({
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

  const handleAddFromCatalog = (item) => {
    addFromCatalog(item);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 p-1 rounded-lg bg-muted">
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
          <CatalogSearch
            onSelect={handleAddFromCatalog}
            onAddBlank={handleAddBlank}
            txType={txType}
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
                      {fmtC(blankQty * blankPrice)}
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
                  onClick={() => {
                    confirmBlank();
                  }}
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
        <div className="space-y-2">
          <div className="border rounded-lg overflow-hidden">
            {itemsList.length === 0 ? (
              <div className="py-6 text-center space-y-1">
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
              itemsList.map((item, i) => (
                <CollapsibleCartItemDetail
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
              ))
            )}
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Revised total</span>
              <span>{fmtC(liveTotal)}</span>
            </div>
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Paid</span>
              <span>{fmtC(editedTx?.paidAmount ?? 0)}</span>
            </div>
            <div
              className={`flex justify-between font-semibold border-t pt-1 ${liveRemaining < 0 ? "text-blue-600 dark:text-blue-400" : "text-amber-600"}`}
            >
              <span>
                {liveRemaining < 0
                  ? txType === "out"
                    ? "Customer credit"
                    : "Supplier owes us"
                  : "Remaining"}
              </span>
              <span>
                {fmtC(Math.abs(liveRemaining))}
                {liveRemaining < 0 && (
                  <span className="ml-1 text-sm font-normal">(advance)</span>
                )}
              </span>
            </div>
          </div>

          {saveBlockedZeroTotal && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Cannot save: total is ₹0 but{" "}
                <strong>{fmtC(editedTx?.paidAmount ?? 0)}</strong> has already
                been paid. Add at least one item with a price, or delete this
                transaction and start fresh.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── CollapsibleCartItemDetail ────────────────────────────────────────────────
const CollapsibleCartItemDetail = ({
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
          <div className="flex items-center gap-1 mt-1">
            <span className="text-sm text-muted-foreground font-mono">
              {fmtNum(item.quantity)}
              {item.unit ? ` ${item.unit}` : ""} × {fmtC(price)}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right pt-0.5">
          <p className="text-sm font-semibold tabular-nums whitespace-nowrap">
            {total > 0 ? (
              fmtC(total)
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
              {fmtC(total)}
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

// ─── ItemViewRow ──────────────────────────────────────────────────────────────
const ItemViewRow = ({ item, index, isLast }) => {
  const qty = parseFloat(item.quantity) || 0,
    price = parseFloat(item.price) || 0;
  const total = qty * price;
  const parts = item.name ? item.name.split(" › ") : [""];
  const name = parts[parts.length - 1];
  const cat = parts.slice(0, -1).join(" › ");
  return (
    <div
      className={`flex items-start gap-2 px-3 py-3 overflow-hidden ${!isLast ? "border-b" : ""}`}
    >
      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-medium leading-snug truncate">
          {name || (
            <span className="italic text-muted-foreground">Unnamed</span>
          )}
        </p>
        {cat && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">{cat}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <span className="text-sm text-muted-foreground font-mono">
            {fmtNum(item.quantity)}
            {item.unit ? ` ${item.unit}` : ""} × {fmtC(price)}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right pt-0.5">
        <p className="text-sm font-semibold tabular-nums whitespace-nowrap">
          {total > 0 ? (
            fmtC(total)
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </p>
      </div>
    </div>
  );
};

// ─── ChangeHistoryEntry ───────────────────────────────────────────────────────
const ChangeHistoryEntry = ({ entry }) => (
  <div className="rounded-lg border px-3 py-2.5 space-y-1.5 overflow-hidden">
    <p className="text-sm font-medium text-muted-foreground">
      {fmtDate(entry.date)}
    </p>
    {(entry.changes ?? []).filter(Boolean).map((c, j) => (
      <p
        key={j}
        className={`text-sm break-all ${c.type === "added" ? "text-green-700 dark:text-green-400" : c.type === "removed" ? "text-red-700 dark:text-red-400" : "text-foreground"}`}
      >
        {typeof c === "string" ? c : c.text}
      </p>
    ))}
    {entry.noteChange && (
      <p className="text-sm text-muted-foreground break-all">
        Note: {entry.noteChange}
      </p>
    )}
    {entry.totalBefore !== undefined &&
      entry.totalBefore !== entry.totalAfter && (
        <p className="text-sm text-muted-foreground">
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

  const [editMode, setEditMode] = useState(false);
  const [editedTx, setEditedTx] = useState(null);
  const lastTxIdRef = useRef(null);

  useEffect(() => {
    if (!transaction) return;
    const txChanged = lastTxIdRef.current !== transaction.id;
    lastTxIdRef.current = transaction.id;
    if (txChanged) {
      setEditedTx({ ...transaction });
      setEditMode(false);
      return;
    }
    setEditedTx((prev) => {
      if (!prev || !editMode) return { ...transaction };
      return {
        ...prev,
        paidAmount: transaction.paidAmount,
        paidAmountHistory: transaction.paidAmountHistory,
        status: transaction.status,
        updatedAt: transaction.updatedAt,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          quantity: String(item.quantity ?? "1"),
          price: String(item.price),
          unit: item.unit || "",
        },
      ],
    }));
  }, []);

  if (!transaction || !editedTx) return null;

  const tx = transaction;
  const isItem = tx.kind === "item";
  const isPending = tx.status === "pending";
  const isOverpaid = tx.status === "overpaid";
  const isDeleted = tx.status === "deleted";
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

  const editedTotal = isItem
    ? liveTotal
    : parseFloat(editedTx?.totalAmount) || 0;
  const saveBlockedZeroTotal =
    editMode && editedTotal === 0 && (editedTx?.paidAmount ?? 0) > 0;

  const handleSave = async () => {
    if (saveBlockedZeroTotal) return;
    let updates;
    if (isItem) {
      const newTotal = liveTotal;
      const changes = diffItems(tx.itemsList, editedTx.itemsList);
      const noteChanged = tx.note !== editedTx.note;
      const hasChange = changes.length > 0 || noteChanged;
      const newHistory = hasChange
        ? [
            ...(editedTx.itemListHistory ?? []),
            {
              date: new Date().toISOString(),
              changes,
              ...(noteChanged
                ? {
                    noteChange: `"${tx.note || ""}" → "${editedTx.note || ""}"`,
                  }
                : {}),
              totalBefore: tx.totalAmount,
              totalAfter: newTotal,
            },
          ]
        : editedTx.itemListHistory;
      updates = {
        itemsList: editedTx.itemsList,
        additionalAmounts: editedTx.additionalAmounts,
        totalAmount: newTotal,
        note: editedTx.note,
        itemListHistory: newHistory,
      };
    } else {
      const newTotal = parseFloat(editedTx.totalAmount) || 0;
      const changes = diffFinancial(tx, { ...editedTx, totalAmount: newTotal });
      const newHistory =
        changes.length > 0
          ? [
              ...(editedTx.itemListHistory ?? []),
              {
                date: new Date().toISOString(),
                changes,
                totalBefore: tx.totalAmount,
                totalAfter: newTotal,
              },
            ]
          : editedTx.itemListHistory;
      updates = {
        totalAmount: newTotal,
        note: editedTx.note,
        itemListHistory: newHistory,
      };
    }
    await onUpdate(tx.id, updates);
    setEditMode(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg p-0 gap-0 flex flex-col h-[90svh] overflow-hidden">
        {/* header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            {isItem ? (
              <Package className="w-5 h-5 text-blue-600 shrink-0" />
            ) : (
              <Banknote className="w-5 h-5 text-purple-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-tight">
                {isItem ? "Item" : "Financial"} Transaction
              </DialogTitle>
              <p className="text-[0.75em] text-muted-foreground font-mono mt-0.5 break-all">
                {tx.id}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-4 py-3 space-y-4 min-w-0">
            {/* direction + status + date */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {tx.type === "out" ? (
                  <TrendingUp className="w-5 h-5 text-green-600 shrink-0" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {tx.type === "out"
                      ? "Sale (we gave / sold)"
                      : "Purchase (we received / bought)"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(tx.createdAt)}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 text-sm px-2 py-0.5 ${
                  isDeleted
                    ? "border-red-300 text-red-600 dark:border-red-700 dark:text-red-400"
                    : isPending
                      ? "border-amber-400 text-amber-700 dark:text-amber-400"
                      : isOverpaid
                        ? "border-blue-400 text-blue-700 dark:text-blue-400"
                        : "border-green-400 text-green-700 dark:text-green-400"
                }`}
              >
                {isDeleted ? (
                  <Trash2 className="w-3.5 h-3.5 mr-1 inline" />
                ) : isPending ? (
                  <Clock className="w-3.5 h-3.5 mr-1 inline" />
                ) : isOverpaid ? (
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 inline" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                )}
                {tx.status}
              </Badge>
            </div>

            {/* deleted banner */}
            {isDeleted && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex items-start gap-2">
                <Ban className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <div className="text-sm text-red-700 dark:text-red-400">
                  <p className="font-semibold mb-0.5">Transaction deleted</p>
                  <p>
                    This transaction has been soft-deleted. Any settlements it
                    was part of have been reversed on the linked transactions.
                    This record is kept for audit purposes only.
                  </p>
                </div>
              </div>
            )}

            {/* edit mode banner */}
            {editMode && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary font-medium">
                ✏️ Edit mode — make changes below, then tap Save
              </div>
            )}

            <Separator />

            {/* ITEMS */}
            {isItem && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Items</Label>
                {!editMode && (
                  <>
                    <div className="border rounded-lg divide-y overflow-hidden">
                      {(tx.itemsList ?? []).map((it, i) => (
                        <ItemViewRow
                          key={i}
                          item={it}
                          index={i}
                          isLast={i === (tx.itemsList ?? []).length - 1}
                        />
                      ))}
                      {tx.additionalAmounts
                        ?.filter((e) => e.name)
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
                              {fmtC(parseFloat(e.amount) || 0)}
                            </span>
                          </div>
                        ))}
                    </div>
                    {tx.itemsList?.length > 0 && (
                      <div className="flex justify-between items-center pt-1.5 text-sm">
                        <span className="text-sm text-muted-foreground">
                          {tx.itemsList.length} item
                          {tx.itemsList.length !== 1 ? "s" : ""}
                          {tx.additionalAmounts?.filter((e) => e.name).length >
                          0
                            ? ` + ${tx.additionalAmounts.filter((e) => e.name).length} extra`
                            : ""}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {fmtC(tx.totalAmount)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {editMode && (
                  <ItemsEditTabPanel
                    editedTx={editedTx}
                    updateItem={updateItem}
                    removeItem={removeItem}
                    addItem={addItem}
                    addFromCatalog={addFromCatalog}
                    txType={tx.type}
                    sellPriceMode={sellPriceMode}
                    allPriceItems={allPriceItems}
                    liveTotal={liveTotal}
                    liveRemaining={liveRemaining}
                    saveBlockedZeroTotal={saveBlockedZeroTotal}
                  />
                )}
              </div>
            )}

            {/* FINANCIAL AMOUNT */}
            {!isItem && (
              <div className="space-y-2">
                <Label className="text-base font-semibold mb-1.5 block">
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
                    className="text-xl font-semibold h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <p className="text-3xl font-bold">{fmtC(tx.totalAmount)}</p>
                )}
                {saveBlockedZeroTotal && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Cannot save: amount is ₹0 but{" "}
                      <strong>{fmtC(editedTx?.paidAmount ?? 0)}</strong> has
                      already been paid. Set a non-zero amount, or delete this
                      transaction and start fresh.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* NOTE */}
            <div>
              <Label className="text-base font-semibold mb-1 block">Note</Label>
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

            {/* PAYMENT SUMMARY */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Payment</Label>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2.5 min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5 truncate">
                    Total
                  </p>
                  <p className="text-base font-bold tabular-nums break-all leading-tight">
                    {fmtC(tx.totalAmount)}
                  </p>
                </div>
                <div className="rounded-lg border p-2.5 min-w-0">
                  <p className="text-sm text-muted-foreground mb-0.5 truncate">
                    Paid
                  </p>
                  <p className="text-base font-bold text-green-600 dark:text-green-400 tabular-nums break-all leading-tight">
                    {fmtC(tx.paidAmount)}
                  </p>
                </div>
                <div
                  className={`rounded-lg border p-2.5 min-w-0 ${isOverpaid ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30" : ""}`}
                >
                  <p className="text-sm text-muted-foreground mb-0.5 truncate">
                    {isOverpaid
                      ? "Advance"
                      : remaining === 0
                        ? "Status"
                        : "Due"}
                  </p>
                  <p
                    className={`text-base font-bold tabular-nums break-all leading-tight ${isOverpaid ? "text-amber-700 dark:text-amber-400" : remaining === 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {isOverpaid
                      ? `+${fmtC(overpaidAmt)}`
                      : remaining === 0
                        ? "Settled"
                        : fmtC(remaining)}
                  </p>
                </div>
              </div>

              {tx.paidAmount > 0 && !isOverpaid && (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              )}

              {isOverpaid && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {overpaidMsg}
                  </p>
                </div>
              )}

              {isPending && remaining > 0 && !editMode && !isDeleted && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-10"
                  onClick={onAddPayment}
                >
                  <CreditCard className="w-4 h-4 mr-1.5" />
                  Record payment
                </Button>
              )}
            </div>

            {/* PAYMENT HISTORY */}
            {tx.paidAmountHistory?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">
                    Payment history
                  </Label>
                </div>
                <div className="space-y-2">
                  {tx.paidAmountHistory.map((p, i) => {
                    const isSettlement = p.method === "settlement";
                    const isAdvanceApplied = p.method === "advance-applied";
                    const isSettlementType = isSettlement || isAdvanceApplied;
                    const amountVal = p.amount ?? 0;

                    let balanceLine = null;
                    if (isSettlementType && p.balanceBefore !== undefined) {
                      const before = p.balanceBefore,
                        after = p.balanceAfter ?? 0;
                      if (isAdvanceApplied) {
                        balanceLine = {
                          before: `Advance ${fmtC(Math.abs(before))}`,
                          after:
                            Math.abs(after) < 0.01
                              ? "Fully consumed"
                              : `Advance ${fmtC(Math.abs(after))} remaining`,
                          afterOk: Math.abs(after) < 0.01,
                        };
                      } else {
                        balanceLine = {
                          before: `Due ${fmtC(before)}`,
                          after:
                            after <= 0.01
                              ? "Fully settled"
                              : `${fmtC(after)} still due`,
                          afterOk: after <= 0.01,
                        };
                      }
                    }

                    return (
                      <div
                        key={i}
                        className={`rounded-lg border px-3 py-2.5 flex items-start justify-between gap-2 min-w-0 overflow-hidden ${isSettlementType ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30" : ""}`}
                      >
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p
                              className={`text-sm font-semibold ${isAdvanceApplied ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
                            >
                              {isAdvanceApplied
                                ? `−${fmtC(Math.abs(amountVal))}`
                                : fmtC(amountVal)}
                            </p>
                            {isSettlement && (
                              <span className="text-[0.75em] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                Auto-settled
                              </span>
                            )}
                            {isAdvanceApplied && (
                              <span className="text-[0.75em] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                Advance applied
                              </span>
                            )}
                          </div>
                          {balanceLine && (
                            <div className="flex items-center gap-1 mt-1 text-sm">
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
                          {!isSettlementType && (
                            <p className="text-sm text-muted-foreground mt-0.5 break-words">
                              {p.method}
                              {p.note ? ` · ${p.note}` : ""}
                            </p>
                          )}
                          {isSettlementType && p.partnerIds?.length > 0 && (
                            <div className="mt-1.5 space-y-1 overflow-hidden">
                              {p.partnerIds.map((pid) => {
                                const partnerTx = allTransactions.find(
                                  (t) => t.id === pid,
                                );
                                const partnerDeleted =
                                  partnerTx?.status === "deleted";
                                return (
                                  <button
                                    key={pid}
                                    type="button"
                                    onClick={() =>
                                      partnerTx &&
                                      !partnerDeleted &&
                                      onNavigateToTransaction?.(partnerTx)
                                    }
                                    className={`flex w-full items-center justify-between gap-1 text-left text-[0.75em] font-mono px-2 py-1 rounded border transition-colors overflow-hidden ${
                                      partnerDeleted
                                        ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 text-red-500 dark:text-red-400 cursor-default line-through"
                                        : partnerTx
                                          ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                                          : "border-muted bg-muted/30 text-muted-foreground cursor-default"
                                    }`}
                                    title={
                                      partnerDeleted
                                        ? "This transaction was deleted"
                                        : partnerTx
                                          ? "Open this transaction"
                                          : "Transaction not found"
                                    }
                                  >
                                    <span className="truncate">{pid}</span>
                                    {partnerDeleted && (
                                      <span className="ml-1.5 shrink-0 not-italic no-underline text-red-400">
                                        (deleted)
                                      </span>
                                    )}
                                    {!partnerDeleted && partnerTx && (
                                      <span className="ml-1.5 shrink-0 text-blue-500 dark:text-blue-400">
                                        ↗
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground shrink-0 text-right whitespace-nowrap ml-1">
                          {fmtDate(p.date)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CHANGE HISTORY */}
            {tx.itemListHistory?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">
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
        </div>

        {/* bottom action bar */}
        <div className="border-t px-4 py-3 flex items-center gap-2 bg-background shrink-0">
          {isDeleted ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          ) : !editMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setEditMode(true)}
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => onDelete(tx.id)}
              >
                <Trash2 className="w-4 h-4" />
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
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={handleSave}
                disabled={saveBlockedZeroTotal}
              >
                <Check className="w-4 h-4" />
                Save changes
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
