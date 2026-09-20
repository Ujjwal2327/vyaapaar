/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState } from "react";
import { format, subWeeks } from "date-fns";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Search,
  TrendingUp,
  TrendingDown,
  Users,
  Smartphone,
  ArrowRight,
  Check,
  Store,
  Globe,
  Zap,
  FileDown,
  Upload,
  Receipt,
  CreditCard,
  ArrowLeftRight,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  BookOpen,
  BarChart3,
  Phone,
  MapPin,
  Menu,
  X,
  RefreshCw,
  GitMerge,
  UserPlus,
  ShoppingCart,
  MessageCircle,
  QrCode,
  Boxes,
  Table2,
  Calculator,
  FileText,
  History,
  Link2,
  FileEdit,
  Scale,
  AlertTriangle,
  ExternalLink,
  Share2,
  Plus,
  Minus,
  Ruler,
  Heart,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Logo from "@/components/Logo";
import { isValidUpiId } from "@/lib/utils/upi";

// Shared, properly-encoded link to the live demo business page — built once
// here (matching the encodeURIComponent pattern already used for this route
// in app/(public)/marketplace/page.jsx) instead of repeating a raw string
// with a literal space in it at each call site below.
//
// NOTE: this has to keep matching a REAL business (users.business_name) —
// it's the page every "See live demo" / "View demo store" link opens. The shop
// drawn in the mocks below (MOCK_SHOP) is illustrative only and is NOT that
// business; to make the live demo match the examples on this page, create a
// demo account with a general-store catalog and put its business name here.
const DEMO_BUSINESS_PATH = `/business/${encodeURIComponent("Maheshwari Sanitary Store")}`;

// The fictional shop behind every example on this page — a plain neighbourhood
// general store, on purpose: rice, dal, sugar and cooking oil are things
// everyone recognises at a glance. The items, prices, contacts and amounts in
// the mocks below are all built around it, so the numbers agree wherever they
// show up (e.g. the Sunflower Oil price on the invoice is its 1 L price in the
// table view).
const MOCK_SHOP = {
  name: "Sharma General Store",
  address: "12, Main Market",
  phone: "9812345678",
};

// ─── "Support Vyaapaar" QR ───────────────────────────────────────────────────
//
// Settings for the optional support card near the bottom of the page: a REAL,
// scannable UPI QR (unlike MockQr below, which is decorative on purpose).
//
// It's pre-filled with ₹69, and the payer can change the amount in their UPI
// app. That's what `mam` (minimum amount) is for in NPCI's UPI link spec: `am`
// on its own is a fixed amount that the payer's app should lock, while an `mam`
// below `am` says "editable — anything from `mam` up" (UPI declines anything
// under `mam`). Whether a given UPI app honours that is up to the app, so do a
// real test scan (GPay / PhonePe / Paytm) after changing anything here.
const SUPPORT_UPI = {
  vpa: "ujjwal2327-2@okicici",
  payeeName: "Vyaapaar",
  note: "Support Vyaapaar",
  defaultAmount: 69,
  minAmount: 1,
};

// Not lib/utils/upi.js's buildUpiPaymentLink: that only builds fixed-amount
// links (no `mam`), and it percent-encodes the "@" in the UPI ID, where NPCI's
// own examples keep it raw. isValidUpiId() guarantees the ID has nothing in it
// that would need escaping, so it goes in as-is.
const buildSupportUpiLink = ({
  vpa,
  payeeName,
  note,
  defaultAmount,
  minAmount,
}) => {
  if (!isValidUpiId(vpa) || !(defaultAmount > 0)) return null;

  const parts = [
    `pa=${vpa.trim()}`,
    `pn=${encodeURIComponent(payeeName)}`,
    `am=${defaultAmount.toFixed(2)}`,
  ];
  // `mam` only makes sense below the default amount.
  if (minAmount > 0 && minAmount < defaultAmount) {
    parts.push(`mam=${minAmount.toFixed(2)}`);
  }
  parts.push("cu=INR", `tn=${encodeURIComponent(note.slice(0, 50))}`);

  return `upi://pay?${parts.join("&")}`;
};

const SUPPORT_UPI_LINK = buildSupportUpiLink(SUPPORT_UPI);

// Same en-IN rupee formatting the app itself uses (TransactionSummary,
// SummaryCards, ...), so the mock numbers below read exactly like the real UI.
const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

// ─── Shared building blocks ──────────────────────────────────────────────────

const SectionHeader = ({ badge, title, description, className = "mb-14" }) => (
  <div className={`text-center ${className}`}>
    <Badge variant="secondary" className="mb-4">
      {badge}
    </Badge>
    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
      {title}
    </h2>
    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
      {description}
    </p>
  </div>
);

const CheckItem = ({ children }) => (
  <li className="flex items-start gap-2 text-sm">
    <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
    <span>{children}</span>
  </li>
);

// One feature = icon + title + plain-language description, a mock of the real
// screen, and the specifics as a short checklist underneath.
const SpotlightCard = ({
  icon: Icon,
  gradient,
  title,
  description,
  bullets,
  children,
}) => (
  <div className="bg-card border rounded-2xl p-6 flex flex-col gap-5">
    <div className="flex items-start gap-3">
      <div
        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-lg leading-tight">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {description}
        </p>
      </div>
    </div>

    <div className="rounded-xl bg-muted/40 border p-4 flex items-center justify-center flex-1 min-w-0">
      {children}
    </div>

    <ul className="space-y-2.5">
      {bullets.map((b) => (
        <CheckItem key={b}>{b}</CheckItem>
      ))}
    </ul>
  </div>
);

// ─── Mini mock components (decorative — nothing in here is interactive) ──────

const MockTransactionCard = ({ type, amount, name, status, items }) => (
  <div className="bg-card border rounded-xl p-3 shadow-sm text-xs">
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-1.5">
        {type === "sale" ? (
          <TrendingUp className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
        )}
        <span className="font-semibold text-foreground">
          {type === "sale" ? "Sale" : "Purchase"}
        </span>
      </div>
      <span
        className={`px-1.5 py-0.5 rounded-full font-medium text-[10px] ${
          status === "paid"
            ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
        }`}
      >
        {status === "paid" ? "Complete" : "Pending"}
      </span>
    </div>
    <p className="text-muted-foreground truncate mb-1">{items}</p>
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{name}</span>
      <span
        className={`font-bold ${
          type === "sale"
            ? "text-green-600 dark:text-green-400"
            : "text-red-500 dark:text-red-400"
        }`}
      >
        {type === "sale" ? "+" : "-"}₹{amount}
      </span>
    </div>
  </div>
);

// The icon drops out on the narrowest phone width so "Receivable" never gets
// clipped — same trade-off the real summary cards make with `truncate`.
const MockSummaryCard = ({ label, value, color, icon: Icon }) => (
  <div className="bg-card border rounded-lg p-2 flex-1 min-w-0">
    <div className="flex items-center gap-1 mb-1">
      <Icon className={`w-3 h-3 shrink-0 hidden sm:block ${color}`} />
      <span className="text-[10px] text-muted-foreground font-medium truncate">
        {label}
      </span>
    </div>
    <p
      className={`text-[13px] sm:text-sm font-bold whitespace-nowrap tabular-nums ${color}`}
    >
      {value}
    </p>
  </div>
);

// Same three states as components/price-list/StockBadge.jsx.
const MOCK_STOCK_STYLES = {
  ok: "bg-muted text-muted-foreground",
  low: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  out: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const MockStockBadge = ({ status, children }) => (
  <span
    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 whitespace-nowrap ${MOCK_STOCK_STYLES[status]}`}
  >
    {children}
  </span>
);

const MockPriceItem = ({ name, price, unit, stock }) => (
  <div className="flex justify-between items-center gap-2 py-1.5 border-b last:border-0 text-xs">
    <span className="flex items-center gap-1.5 min-w-0 text-foreground">
      <span className="truncate">{name}</span>
      {stock && (
        <MockStockBadge status={stock.status}>{stock.label}</MockStockBadge>
      )}
    </span>
    <span className="font-semibold text-foreground whitespace-nowrap shrink-0">
      ₹{price}/{unit}
    </span>
  </div>
);

// balance > 0 = they owe you (green), < 0 = you owe them (red) — the same
// colour language PersonCard.jsx uses for a contact's net balance.
const MockContactCard = ({ name, phone, category, color, balance = 0 }) => (
  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-xs">
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 ${color}`}
    >
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate">{name}</p>
      <p className="text-muted-foreground">{phone}</p>
    </div>
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
        {category}
      </span>
      <span
        className={`flex items-center gap-0.5 font-bold tabular-nums ${
          balance > 0
            ? "text-green-600 dark:text-green-400"
            : balance < 0
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
        }`}
      >
        {balance > 0 && <TrendingUp className="w-3 h-3" />}
        {balance < 0 && <TrendingDown className="w-3 h-3" />}
        {fmtINR(Math.abs(balance))}
      </span>
    </div>
  </div>
);

// The customer-side quantity control from components/marketplace/QuantityStepper.jsx
const MockStepper = ({ qty = 0 }) =>
  qty > 0 ? (
    <div className="flex items-center gap-1 shrink-0">
      <span className="w-6 h-6 rounded-md border flex items-center justify-center">
        <Minus className="w-3 h-3" />
      </span>
      <span className="w-8 h-6 rounded-md border bg-background flex items-center justify-center text-xs tabular-nums">
        {qty}
      </span>
      <span className="w-6 h-6 rounded-md border flex items-center justify-center">
        <Plus className="w-3 h-3" />
      </span>
    </div>
  ) : (
    <span className="h-6 px-2 rounded-md border flex items-center gap-1 text-xs font-medium shrink-0">
      <Plus className="w-3 h-3" />
      Add
    </span>
  );

const MockPills = ({ options, active }) => (
  <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted shrink-0">
    {options.map((o) => (
      <span
        key={o}
        className={`h-6 px-2 rounded-md text-[11px] font-medium flex items-center whitespace-nowrap ${
          o === active
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground"
        }`}
      >
        {o}
      </span>
    ))}
  </div>
);

// ── Report charts ────────────────────────────────────────────────────────────
// Drawn as plain SVG rather than pulling recharts into the marketing page —
// same colours as components/analytics/chartTheme.js (green sales, red
// purchases, indigo bars), so it reads like the real Reports screen.

const CHART_W = 300;
const CHART_H = 110;
const CHART_TOP = 12;
const CHART_BASE = 100;
const CHART_MAX = 90;

const SALES_SERIES = [38, 44, 41, 52, 49, 61, 58, 66, 63, 72, 69, 81];
const PURCHASE_SERIES = [30, 28, 35, 33, 40, 38, 44, 41, 46, 45, 50, 48];

const round1 = (n) => Math.round(n * 10) / 10;

const chartPoints = (values) =>
  values.map((v, i) => [
    round1(4 + (i * (CHART_W - 8)) / (values.length - 1)),
    round1(CHART_BASE - (v / CHART_MAX) * (CHART_BASE - CHART_TOP)),
  ]);

// Smooth line through the points (horizontal tangent at each one).
const smoothPath = (pts) =>
  pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = round1((px + x) / 2);
    return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");

const MockSalesChart = ({ className = "h-28" }) => {
  const sales = chartPoints(SALES_SERIES);
  const purchases = chartPoints(PURCHASE_SERIES);
  const salesLine = smoothPath(sales);
  const salesArea = `${salesLine} L${sales[sales.length - 1][0]},${CHART_BASE} L${sales[0][0]},${CHART_BASE} Z`;

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Line chart comparing sales and purchases over time"
      className={`w-full ${className}`}
    >
      {[CHART_TOP, (CHART_TOP + CHART_BASE) / 2, CHART_BASE].map((y) => (
        <line
          key={y}
          x1="0"
          x2={CHART_W}
          y1={y}
          y2={y}
          strokeDasharray="3 3"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          className="stroke-border"
        />
      ))}
      <path d={salesArea} className="fill-green-500/10" />
      <path
        d={smoothPath(purchases)}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-red-600 dark:stroke-red-400"
      />
      <path
        d={salesLine}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-green-600 dark:stroke-green-400"
      />
    </svg>
  );
};

const TOP_ITEMS = [
  { name: "Basmati Rice", value: 48500 },
  { name: "Sunflower Oil", value: 31200 },
  { name: "Toor Dal", value: 22800 },
];

const MockTopItems = () => {
  const max = Math.max(...TOP_ITEMS.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {TOP_ITEMS.map((it) => (
        <div key={it.name} className="space-y-1">
          <div className="flex justify-between gap-2 text-xs">
            <span className="truncate text-foreground">{it.name}</span>
            <span className="font-semibold tabular-nums shrink-0">
              {fmtINR(it.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400"
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const MockKpi = ({ label, value, tone, icon: Icon }) => {
  const toneCls =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : "text-green-600 dark:text-green-400";
  return (
    <div className="rounded-xl border bg-card p-3 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-4 h-4 shrink-0 ${toneCls}`} />
        <span className="text-xs text-muted-foreground font-medium truncate">
          {label}
        </span>
      </div>
      <p className={`text-lg sm:text-xl font-bold leading-tight ${toneCls}`}>
        {value}
      </p>
    </div>
  );
};

// ── QR-style pattern ─────────────────────────────────────────────────────────
// Decorative and deliberately NOT a real, scannable code — it just needs to
// look like the QR the app shows for UPI payments. Built once at module load
// from a fixed seed so it never changes between renders.

const QR_N = 25;

const buildQrPath = () => {
  const grid = Array.from({ length: QR_N }, () => Array(QR_N).fill(false));
  const inFinderZone = (x, y) =>
    (x < 8 && y < 8) || (x >= QR_N - 8 && y < 8) || (x < 8 && y >= QR_N - 8);

  let seed = 20260918;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let y = 0; y < QR_N; y++) {
    for (let x = 0; x < QR_N; x++) {
      if (!inFinderZone(x, y)) grid[y][x] = rand() > 0.52;
    }
  }

  const finder = (ox, oy) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const ring = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y][ox + x] = ring || core;
      }
    }
  };
  finder(0, 0);
  finder(QR_N - 7, 0);
  finder(0, QR_N - 7);

  let d = "";
  for (let y = 0; y < QR_N; y++) {
    for (let x = 0; x < QR_N; x++) {
      if (grid[y][x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
};

const QR_PATH = buildQrPath();

const MockQr = () => (
  <svg
    viewBox={`0 0 ${QR_N} ${QR_N}`}
    shapeRendering="crispEdges"
    role="img"
    aria-label="Example UPI QR code"
    className="w-full h-full"
  >
    <path d={QR_PATH} fill="#111111" />
  </svg>
);

// ─── Reports ─────────────────────────────────────────────────────────────────

// Mirrors /analytics: summary cards, sales vs purchases, top-selling items.
const ReportsMock = () => {
  const now = new Date();
  const ticks = [subWeeks(now, 11), subWeeks(now, 6), now].map((d) =>
    format(d, "d MMM"),
  );

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-semibold text-base">Reports</p>
        <MockPills options={["Daily", "Weekly", "Monthly"]} active="Weekly" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MockKpi
          label="Receivable"
          value="₹12,400"
          tone="green"
          icon={TrendingUp}
        />
        <MockKpi
          label="Payable"
          value="₹4,200"
          tone="red"
          icon={TrendingDown}
        />
        <MockKpi label="Net" value="+₹8,200" tone="green" icon={Scale} />
      </div>

      <div className="rounded-xl border bg-card p-3">
        <p className="font-semibold text-sm mb-1">Sales vs purchases</p>
        <div className="flex gap-4 text-xs text-muted-foreground mb-2">
          <span>
            Sales{" "}
            <span className="font-semibold text-foreground">
              {fmtINR(184200)}
            </span>
          </span>
          <span>
            Purchases{" "}
            <span className="font-semibold text-foreground">
              {fmtINR(112500)}
            </span>
          </span>
        </div>
        <MockSalesChart className="h-28" />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <p className="font-semibold text-sm">Top-selling items</p>
          <MockPills
            options={["By revenue", "By quantity"]}
            active="By revenue"
          />
        </div>
        <MockTopItems />
      </div>
    </div>
  );
};

// Compact version for inside the hero phone frame.
const HeroReportsTab = () => (
  <>
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold text-foreground">Reports</p>
      <MockPills options={["Daily", "Weekly", "Monthly"]} active="Weekly" />
    </div>

    <div className="bg-card border rounded-xl p-2.5">
      <p className="text-xs font-semibold">Sales vs purchases</p>
      <div className="flex gap-3 text-[10px] text-muted-foreground my-1">
        <span>
          Sales{" "}
          <span className="font-semibold text-foreground">
            {fmtINR(184200)}
          </span>
        </span>
        <span>
          Purchases{" "}
          <span className="font-semibold text-foreground">
            {fmtINR(112500)}
          </span>
        </span>
      </div>
      <MockSalesChart className="h-16" />
    </div>

    <div className="bg-card border rounded-xl p-2.5">
      <p className="text-xs font-semibold mb-2">Top-selling items</p>
      <MockTopItems />
    </div>
  </>
);

// ─── UPI + invoice ───────────────────────────────────────────────────────────

// One invoice drives both mocks below, so the amount on the UPI QR is
// always the balance due on the invoice next to it.
const INVOICE_ROWS = [
  {
    name: "Basmati Rice",
    path: "Groceries › Staples",
    qty: "10 kg",
    price: 120,
    amount: 1200,
  },
  {
    name: "Sunflower Oil",
    path: "Cooking Oil › 1 L",
    qty: "3 pack",
    price: 145,
    amount: 435,
  },
  {
    name: "Sugar",
    path: "Groceries › Staples",
    qty: "5 kg",
    price: 46,
    amount: 230,
  },
];
const INVOICE_DELIVERY = 100;
const INVOICE_PAID = 1000;
const INVOICE_TOTAL =
  INVOICE_ROWS.reduce((sum, r) => sum + r.amount, 0) + INVOICE_DELIVERY;
const INVOICE_BALANCE = INVOICE_TOTAL - INVOICE_PAID;

// Mirrors AddPaymentModal + UpiPayCard: pick UPI, get a QR for the amount.
const MockUpiPayment = () => (
  <div className="w-full min-w-0 max-w-[280px] space-y-3">
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">Remaining balance</p>
      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
        {fmtINR(INVOICE_BALANCE)}
      </p>
    </div>

    <div>
      <p className="text-xs font-medium mb-1.5">Payment method</p>
      <div className="flex flex-wrap gap-1.5">
        {["Cash", "UPI", "Bank transfer", "Cheque"].map((m) => (
          <span
            key={m}
            className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center ${
              m === "UPI"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {m}
          </span>
        ))}
      </div>
    </div>

    <div className="rounded-lg border bg-card p-3 flex flex-col items-center gap-2.5 text-center">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <QrCode className="w-3.5 h-3.5 text-primary" />
        Customer scans to pay {fmtINR(INVOICE_BALANCE)}
      </p>
      <div className="w-36 h-36 bg-white rounded-lg border p-2">
        <MockQr />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Works with GPay, PhonePe, Paytm, and any other UPI app
      </p>
    </div>

    <div className="rounded-lg border border-dashed bg-card/50 p-3 space-y-2 text-xs">
      <p className="text-muted-foreground text-center">
        Paying a supplier? Pay {fmtINR(8500)} to Gupta Wholesale
      </p>
      <span className="h-8 rounded-md bg-primary text-primary-foreground font-medium flex items-center justify-center gap-1.5">
        <ExternalLink className="w-3.5 h-3.5" />
        Open in UPI app
      </span>
    </div>
  </div>
);

// Mirrors the PDF from lib/utils/invoicePdfGenerator.js, plus the two
// buttons TransactionDetailModal puts above it.
const MockInvoice = () => (
  <div className="w-full min-w-0 space-y-3">
    <div className="flex gap-2">
      <div className="flex-1 h-8 rounded-md border bg-background text-xs font-medium flex items-center justify-center gap-1.5">
        <FileDown className="w-3.5 h-3.5" />
        Download PDF
      </div>
      <div className="flex-1 h-8 rounded-md border bg-background text-xs font-medium flex items-center justify-center gap-1.5">
        <Share2 className="w-3.5 h-3.5" />
        Share invoice
      </div>
    </div>

    {/* The PDF itself — always black on white, like the printed page. */}
    <div className="bg-white text-neutral-900 rounded-md border border-neutral-200 shadow-md p-3 sm:p-4 text-[10px] sm:text-[11px] leading-snug">
      <div className="flex justify-between gap-3 pb-2.5 border-b-2 border-neutral-900">
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight">
            {MOCK_SHOP.name}
          </p>
          <p className="text-neutral-600 mt-1">{MOCK_SHOP.address}</p>
          <p className="text-neutral-600">Ph: {MOCK_SHOP.phone}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold tracking-tight">INVOICE</p>
          <p className="text-neutral-600 mt-1">Ref #0D9EDDF1</p>
          <p className="text-neutral-600">{format(new Date(), "d MMM yyyy")}</p>
        </div>
      </div>

      <div className="py-2.5">
        <p className="text-[9px] font-bold text-neutral-500 uppercase mb-0.5">
          Bill to
        </p>
        <p className="text-xs font-bold">Ramesh Kumar</p>
        <p className="text-neutral-600">9876543210</p>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100 border-b border-neutral-900 text-[9px] sm:text-[10px]">
            <th className="text-left font-bold px-1 py-1.5 sm:px-1.5">Item</th>
            <th className="text-left font-bold px-1 py-1.5 sm:px-1.5">Qty</th>
            <th className="text-right font-bold px-1 py-1.5 sm:px-1.5">
              Price
            </th>
            <th className="text-right font-bold px-1 py-1.5 sm:px-1.5">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {INVOICE_ROWS.map((r) => (
            <tr key={r.name} className="border-b border-neutral-200 align-top">
              <td className="px-1 py-1.5 sm:px-1.5">
                <p>{r.name}</p>
                <p className="text-[8px] text-neutral-400">{r.path}</p>
              </td>
              <td className="px-1 py-1.5 sm:px-1.5 whitespace-nowrap">
                {r.qty}
              </td>
              <td className="px-1 py-1.5 sm:px-1.5 text-right">
                {fmtINR(r.price)}
              </td>
              <td className="px-1 py-1.5 sm:px-1.5 text-right">
                {fmtINR(r.amount)}
              </td>
            </tr>
          ))}
          <tr className="border-b border-neutral-200">
            <td className="px-1 py-1.5 sm:px-1.5" colSpan={3}>
              Delivery
            </td>
            <td className="px-1 py-1.5 sm:px-1.5 text-right">
              {fmtINR(INVOICE_DELIVERY)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-end mt-2.5">
        <div className="w-3/5 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-neutral-600">Total</span>
            <span>{fmtINR(INVOICE_TOTAL)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Paid</span>
            <span>{fmtINR(INVOICE_PAID)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-neutral-900 pt-1 mt-1 text-xs font-bold">
            <span>Balance Due</span>
            <span>{fmtINR(INVOICE_BALANCE)}</span>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-neutral-500 text-center border-t border-neutral-300 pt-2 mt-3">
        Generated with Vyaapaar • Page 1 of 1
      </p>
    </div>
  </div>
);

// ─── Catalog: table view + stock ─────────────────────────────────────────────

// Cooking oil by pack size, priced per pack. The 1 L column matches the
// Sunflower Oil price on the mock invoice.
const PIVOT_COLS = ["500 ml", "1 L", "5 L"];
const PIVOT_ROWS = [
  { name: "Sunflower Oil", prices: [75, 145, 700] },
  { name: "Mustard Oil", prices: [90, 170, 820] },
  {
    name: "Groundnut Oil",
    prices: [110, 210, 950],
    stock: { 2: { status: "low", label: "Low: 6" } },
  },
];

// Mirrors CategoryItem's Table toggle + PivotTable.
const MockPivotTable = () => (
  <div className="w-full min-w-0 space-y-2">
    <div className="flex gap-2">
      <div className="flex-1 min-w-0 flex items-center justify-between rounded-md bg-secondary text-secondary-foreground px-3 py-2 text-sm font-semibold">
        <span>Cooking Oil</span>
        <ChevronUp className="w-4 h-4" />
      </div>
      <div className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium shrink-0">
        <Table2 className="w-3.5 h-3.5" />
        Table
      </div>
    </div>

    <div className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="text-left font-semibold px-2 sm:px-3 py-2 border-b whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5">
                Cooking Oil
                <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
              </span>
            </th>
            {PIVOT_COLS.map((c) => (
              <th
                key={c}
                className="text-right font-semibold px-2 sm:px-3 py-2 border-b whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PIVOT_ROWS.map((row, idx) => (
            <tr
              key={row.name}
              className={idx % 2 === 1 ? "bg-muted" : "bg-card"}
            >
              <th className="text-left font-medium px-2 sm:px-3 py-2 border-b whitespace-nowrap">
                {row.name}
              </th>
              {row.prices.map((p, i) => (
                <td
                  key={i}
                  className="px-2 sm:px-3 py-2 border-b text-right align-top"
                >
                  <div className="whitespace-nowrap">
                    <span className="font-semibold">₹{p}</span>
                    <span className="hidden sm:inline text-muted-foreground text-[0.7em] ml-1">
                      /pack
                    </span>
                  </div>
                  {row.stock?.[i] && (
                    <div className="flex justify-end mt-0.5">
                      <MockStockBadge status={row.stock[i].status}>
                        {row.stock[i].label}
                      </MockStockBadge>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Catalog rows with stock badges, plus the "you're about to oversell" note
// AddTransactionModal shows while a sale is being built.
const MockStockCard = () => (
  <div className="w-full min-w-0 space-y-3">
    <div className="rounded-lg border bg-card px-3 py-1">
      <MockPriceItem
        name="Sugar"
        price="46"
        unit="kg"
        stock={{ status: "ok", label: "42 in stock" }}
      />
      <MockPriceItem
        name="Basmati Rice"
        price="120"
        unit="kg"
        stock={{ status: "low", label: "Low: 4" }}
      />
      <MockPriceItem
        name="Toor Dal"
        price="160"
        unit="kg"
        stock={{ status: "out", label: "Out of stock" }}
      />
    </div>

    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold truncate">Basmati Rice</p>
        <MockStockBadge status="low">Low: 4</MockStockBadge>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        Qty 6 × ₹120 ={" "}
        <span className="font-semibold text-primary">{fmtINR(720)}</span>
      </p>
      <div className="flex items-start gap-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Only 4 kg in stock — this will leave it 2 short. You can still add it.
        </span>
      </div>
    </div>
  </div>
);

// ─── Public catalog: cart + material calculator ──────────────────────────────

const MockCatalogRow = ({ name, price, qty = 0, last = false }) => (
  <div
    className={`flex items-center justify-between gap-2 py-1.5 text-xs ${
      last ? "" : "border-b"
    }`}
  >
    <span className="min-w-0 truncate">{name}</span>
    <div className="flex items-center gap-2 shrink-0">
      <span className="font-semibold whitespace-nowrap">{price}</span>
      <MockStepper qty={qty} />
    </div>
  </div>
);

// Open state of components/marketplace/MaterialCalculator.jsx:
// 750 gram → 750 / 1000 = 0.75 kg, at ₹120 a kg = ₹90.
const MockCalculator = () => (
  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5 mt-1">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-muted-foreground">
        Calculate quantity
      </p>
      <X className="w-3 h-3 text-muted-foreground" />
    </div>

    <div className="flex items-center gap-2 flex-wrap">
      <div className="h-8 w-20 rounded-md border bg-background px-2 flex items-center text-xs tabular-nums">
        750
      </div>
      <div className="h-8 w-28 rounded-md border bg-background px-2 flex items-center justify-between text-xs">
        gram
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </div>
    </div>

    <div className="rounded-md bg-background border px-3 py-2 space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-muted-foreground">You'll need</span>
        <span className="font-semibold tabular-nums">0.75 kg</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Estimated cost</span>
        <span className="font-semibold tabular-nums text-primary">₹90</span>
      </div>
    </div>

    <div className="h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-1">
      <Plus className="w-3 h-3" />
      Add 0.75 kg to cart
    </div>
  </div>
);

// ─── Section: Hero ────────────────────────────────────────────────────────────

const HERO_TABS = [
  { id: "ledger", label: "Ledger" },
  { id: "catalog", label: "Catalog" },
  { id: "contacts", label: "Contacts" },
  { id: "reports", label: "Reports" },
];

const HeroSection = () => {
  const [activeTab, setActiveTab] = useState("ledger");

  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="space-y-6 text-center lg:text-left">
            <Badge
              variant="outline"
              className="gap-1.5 px-3 py-1 text-sm border-primary/30 text-primary bg-primary/5"
            >
              <Store className="w-3.5 h-3.5" />
              Made for Indian small businesses
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
              Run your business,{" "}
              <span className="relative">
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  not your paperwork
                </span>
              </span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
              Replace paper ledgers, WhatsApp price lists, and scattered contact
              books with one fast, free app. Catalog. Contacts. Khata. Reports —
              all in one place, with UPI collections and stock tracking built
              in.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button size="lg" className="text-base gap-2 h-12 px-6" asChild>
                <Link href="/register">
                  Start for free
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base gap-2 h-12 px-6"
                asChild
              >
                <Link href={DEMO_BUSINESS_PATH}>
                  <Globe className="w-4 h-4" />
                  See live demo
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm text-muted-foreground">
              {[
                "Free forever",
                "No credit card",
                "Setup in 2 mins",
                "Works offline",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: App preview mockup */}
          <div className="relative lg:h-[500px] h-auto flex items-center justify-center">
            {/* Tab switcher */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:top-4 lg:right-4 z-20 flex gap-1 bg-muted p-1 rounded-lg shadow-sm">
              {HERO_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Phone frame */}
            <div className="mt-14 w-72 sm:w-80 bg-card border-2 border-border rounded-3xl shadow-2xl overflow-hidden">
              {/* Phone status bar */}
              <div className="bg-muted/60 px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Vyaapaar
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-green-500 rounded-full" />
                  <span className="text-[10px] text-muted-foreground">
                    Live
                  </span>
                </div>
              </div>

              {/* Tab content */}
              <div className="p-3 space-y-2 min-h-[390px]">
                {activeTab === "ledger" && (
                  <>
                    <div className="flex gap-2 mb-3">
                      <MockSummaryCard
                        label="Receivable"
                        value="₹12,400"
                        color="text-green-600 dark:text-green-400"
                        icon={TrendingUp}
                      />
                      <MockSummaryCard
                        label="Payable"
                        value="₹4,200"
                        color="text-red-600 dark:text-red-400"
                        icon={TrendingDown}
                      />
                      <MockSummaryCard
                        label="Net"
                        value="+₹8,200"
                        color="text-green-600 dark:text-green-400"
                        icon={Scale}
                      />
                    </div>
                    <MockTransactionCard
                      type="sale"
                      amount="3,200"
                      name="Ramesh Kumar"
                      status="pending"
                      items="Basmati Rice × 20, Toor Dal × 5"
                    />
                    <MockTransactionCard
                      type="purchase"
                      amount="8,500"
                      name="Gupta Wholesale"
                      status="paid"
                      items="Sugar × 100, Basmati Rice × 50"
                    />
                    <MockTransactionCard
                      type="sale"
                      amount="1,100"
                      name="Sunita Devi"
                      status="pending"
                      items="Toor Dal × 4, Sugar × 10"
                    />
                  </>
                )}

                {activeTab === "catalog" && (
                  <>
                    <div className="bg-secondary rounded-lg px-3 py-2 text-xs font-bold mb-1">
                      Groceries
                    </div>
                    <div className="ml-3 border-l-2 border-border pl-3 space-y-0.5">
                      <div className="bg-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                        Staples
                      </div>
                      <div className="ml-3 border-l-2 border-border pl-3">
                        <MockPriceItem
                          name="Sugar"
                          price="46"
                          unit="kg"
                          stock={{ status: "ok", label: "42 in stock" }}
                        />
                        <MockPriceItem
                          name="Basmati Rice"
                          price="120"
                          unit="kg"
                          stock={{ status: "low", label: "Low: 4" }}
                        />
                        <MockPriceItem name="Toor Dal" price="160" unit="kg" />
                      </div>
                    </div>
                    <div className="bg-secondary rounded-lg px-3 py-2 text-xs font-bold mt-2">
                      Cooking Oil
                    </div>
                    <div className="ml-3 border-l-2 border-border pl-3 space-y-0.5">
                      <div className="bg-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                        1 L
                      </div>
                      <div className="ml-3 border-l-2 border-border pl-3">
                        <MockPriceItem
                          name="Sunflower Oil"
                          price="145"
                          unit="pack"
                        />
                        <MockPriceItem
                          name="Mustard Oil"
                          price="170"
                          unit="pack"
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "contacts" && (
                  <div className="space-y-2">
                    <div className="relative mb-3">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <div className="bg-muted rounded-lg pl-7 pr-3 py-2 text-xs text-muted-foreground">
                        Search contacts...
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium pb-1">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2 py-1">
                        <Scale className="w-3 h-3" />
                        With balance
                      </span>
                      <span className="inline-flex items-center rounded-md border px-2 py-1 text-muted-foreground">
                        Highest balance ↓
                      </span>
                    </div>
                    <MockContactCard
                      name="Ramesh Kumar"
                      phone="9876543210"
                      category="Customer"
                      color="bg-orange-500"
                      balance={8200}
                    />
                    <MockContactCard
                      name="Sunita Devi"
                      phone="7900123456"
                      category="Customer"
                      color="bg-green-500"
                      balance={1100}
                    />
                    <MockContactCard
                      name="Raju Delivery"
                      phone="9012345678"
                      category="Helper"
                      color="bg-blue-500"
                      balance={-650}
                    />
                    <MockContactCard
                      name="Gupta Wholesale"
                      phone="9123456789"
                      category="Supplier"
                      color="bg-pink-500"
                      balance={-3400}
                    />
                  </div>
                )}

                {activeTab === "reports" && <HeroReportsTab />}
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -right-2 top-1/4 bg-green-500 text-white text-xs px-2.5 py-1.5 rounded-full shadow-lg font-medium hidden sm:flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Settled ₹8,200
            </div>
            <div className="absolute -left-2 top-[22%] bg-background border shadow-lg text-xs px-2.5 py-1.5 rounded-full font-medium hidden sm:flex items-center gap-1 text-foreground">
              <QrCode className="w-3 h-3 text-primary" />
              UPI QR ready
            </div>
            <div className="absolute -left-2 bottom-1/4 bg-background border shadow-lg text-xs px-2.5 py-1.5 rounded-full font-medium hidden sm:flex items-center gap-1 text-foreground">
              <Globe className="w-3 h-3 text-primary" />
              Catalog shared
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Section: Pain Points ─────────────────────────────────────────────────────

const PAIN_POINTS = [
  { before: "📒 Paper price lists", after: "Digital catalog" },
  { before: "📱 WhatsApp for prices", after: "Shareable link" },
  { before: "📓 Paper khata book", after: "Auto-settle ledger" },
  { before: "📞 Saved-number chaos", after: "Organized contacts" },
  { before: "🧾 Handwritten bills", after: "PDF invoices" },
  { before: "📦 Counting stock by eye", after: "Low-stock alerts" },
  { before: "🏦 Reading out bank details", after: "Scan-to-pay QR" },
  { before: "🧮 Month-end guesswork", after: "Live reports" },
];

const PainPointsSection = () => (
  <section className="py-12 border-y bg-muted/20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
        Replace the mess you're dealing with today
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PAIN_POINTS.map(({ before, after }) => (
          <div
            key={before}
            className="bg-card rounded-xl border p-4 text-center space-y-2"
          >
            <p className="text-sm text-muted-foreground line-through">
              {before}
            </p>
            <div className="text-primary text-lg">↓</div>
            <p className="text-sm font-semibold text-foreground">{after}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Section: Four Modules ────────────────────────────────────────────────────

const ModuleCard = ({ mod }) => {
  const Icon = mod.icon;

  const body = (
    <>
      <div
        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center mb-5 shadow-md group-hover:scale-105 transition-transform duration-300`}
      >
        <Icon className="w-7 h-7 text-white" />
      </div>

      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
        {mod.tagline}
      </p>
      <h3 className="text-xl font-bold mb-3">{mod.title}</h3>
      <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
        {mod.description}
      </p>

      <ul className="space-y-2.5">
        {mod.features.map((f) => (
          <CheckItem key={f}>{f}</CheckItem>
        ))}
      </ul>

      {mod.demo && (
        <Button
          variant="outline"
          size="sm"
          className="mt-6 w-full gap-2"
          asChild
        >
          <Link href={mod.demo}>
            <Globe className="w-3.5 h-3.5" />
            {mod.demoLabel}
          </Link>
        </Button>
      )}
    </>
  );

  return (
    <div
      className={`group relative bg-card border-2 border-transparent hover:border-primary/20 rounded-2xl p-7 transition-all duration-300 hover:shadow-lg ${
        mod.wide ? "lg:col-span-3" : ""
      }`}
    >
      {mod.badge && (
        <div className="absolute -top-3 -right-3">
          <Badge className="bg-emerald-500 text-white border-0 shadow-md">
            {mod.badge}
          </Badge>
        </div>
      )}

      {mod.wide ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-2">{body}</div>
          <div className="lg:col-span-3 min-w-0">{mod.visual}</div>
        </div>
      ) : (
        body
      )}
    </div>
  );
};

const ModulesSection = () => {
  const modules = [
    {
      icon: Package,
      gradient: "from-blue-500 to-cyan-500",
      title: "Product Catalog",
      tagline: "Your price list, always up to date",
      description:
        "Organize thousands of products in nested categories. Set retail and bulk prices, see whole size ranges as a table, and let stock count itself. Share a public link — no login needed.",
      features: [
        "Unlimited categories & subcategories",
        "Retail + bulk pricing per item",
        "Table view for sizes × variants",
        "Optional stock tracking & low-stock alerts",
        "Cost price & profit — even across units",
        "Instant search — typos & fractions welcome",
        "Bulk edit in text format",
        "Public link with cart & WhatsApp enquiry",
      ],
      demo: DEMO_BUSINESS_PATH,
      demoLabel: "View live catalog",
    },
    {
      icon: Receipt,
      gradient: "from-emerald-500 to-teal-500",
      title: "Transaction Ledger",
      tagline: "Khata book — reimagined",
      description:
        "Track every sale and purchase with full payment history. Collect by UPI QR, send PDF invoices, and settle mutual dues in one tap.",
      features: [
        "Itemised or plain-amount bills, with extra charges & discounts",
        "Paid, pending & advance amounts",
        "Auto-settle & one-tap net settle",
        "UPI QR to collect or send payments",
        "PDF invoices & purchase bills",
        "Full payment & edit history",
        "Walk-in sales — assign a contact later",
        "Link other contacts, bill just one",
      ],
      demo: null,
      demoLabel: null,
      badge: "New",
    },
    {
      icon: Users,
      gradient: "from-violet-500 to-purple-500",
      title: "Contact Management",
      tagline: "Every business relationship, organized",
      description:
        "Keep customers, suppliers, and workers in one place — each with a live balance. Multiple phone numbers, addresses, UPI IDs, notes. Import from your phone, export to PDF.",
      features: [
        "Custom categories (Customer, Supplier…)",
        "Multiple numbers, photos, addresses & notes",
        "Live balance on every contact",
        "Filter & sort by who owes what",
        "UPI ID per contact for direct payments",
        "Import from .vcf / device contacts",
        "Export to PDF — table, grid or bento",
        "Find & merge duplicates, bulk edit as text",
      ],
      demo: null,
      demoLabel: null,
    },
    {
      icon: BarChart3,
      gradient: "from-amber-500 to-orange-500",
      title: "Reports",
      tagline: "Know where the money is",
      description:
        "See sales, purchases, top sellers, profit margin and outstanding dues as clear charts — by day, week or month. Built from the transactions you already record, so there's nothing extra to enter.",
      features: [
        "Sales vs purchases — daily, weekly or monthly",
        "Top sellers by revenue or by quantity",
        "Profit margin, from the cost prices you set",
        "Receivable vs payable, tracked over time",
        "Live receivable, payable & net at a glance",
        "Works offline, from your last sync",
      ],
      demo: null,
      demoLabel: null,
      badge: "New",
      wide: true,
      visual: <ReportsMock />,
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          badge="Four modules, one app"
          title="Everything your business needs"
          description="Not four separate apps. One product that connects your prices, your people, your payments, and your numbers."
          className="mb-16"
        />

        <div className="grid lg:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <ModuleCard key={mod.title} mod={mod} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Section: How transactions work ──────────────────────────────────────────

const LedgerDemoSection = () => (
  <section className="py-20 bg-muted/20 border-y">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeader
        badge="Transaction Ledger"
        title="Your digital khata book"
        description="Track every rupee owed and owing. Settle dues automatically — no calculator, no drama."
        className="mb-12"
      />

      <div className="grid md:grid-cols-3 gap-6">
        {[
          {
            step: "1",
            title: "Add transactions",
            desc: "Record sales and purchases with itemized lists or as a plain financial amount. Pick items from your catalog and the prices fill in. Attach a part-payment right away.",
            icon: Receipt,
            color:
              "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
          },
          {
            step: "2",
            title: "Track the balance",
            desc: "See receivables and payables at a glance per contact. Mark payments as they come in. Overpayments are tracked as advance credit.",
            icon: BarChart3,
            color:
              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
          },
          {
            step: "3",
            title: "Settle in one tap",
            desc: "Auto-settle offsets sales against purchases automatically. Net settle records one payment and closes everything at once.",
            icon: Zap,
            color:
              "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
          },
        ].map(({ step, title, desc, icon: Icon, color }) => (
          <div key={step} className="bg-card border rounded-2xl p-6 relative">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="absolute top-5 right-5 text-4xl font-black text-muted/20 select-none leading-none">
              {step}
            </div>
            <h3 className="font-semibold text-base mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* Live balance preview */}
      <div className="mt-10 bg-card border rounded-2xl p-5 max-w-md mx-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Contact summary — Ramesh Kumar
        </p>
        <div className="grid grid-cols-3 gap-3 text-center mb-4">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-3">
            <p className="text-lg font-bold text-green-600">₹12,400</p>
            <p className="text-xs text-muted-foreground mt-0.5">Receivable</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-lg font-bold text-red-500">₹4,200</p>
            <p className="text-xs text-muted-foreground mt-0.5">Payable</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-lg font-bold text-primary">+₹8,200</p>
            <p className="text-xs text-muted-foreground mt-0.5">Net</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-9 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Auto-Settle
          </div>
          <div className="flex-1 h-9 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-medium text-green-700 border-green-300 dark:border-green-700 dark:text-green-400">
            <Zap className="w-3.5 h-3.5" />
            Net Settle ₹8,200
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ─── Section: UPI + invoices ─────────────────────────────────────────────────

const PaymentsSection = () => (
  <section className="py-20">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeader
        badge="UPI & invoices"
        title="Collect by UPI. Bill with a PDF."
        description="Choose UPI when you record a payment and a QR for the exact amount appears. Then send a clean invoice, straight from the transaction."
        className="mb-12"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SpotlightCard
          icon={QrCode}
          gradient="from-violet-500 to-fuchsia-500"
          title="Scan-to-pay UPI QR"
          description="Customers scan the QR with GPay, PhonePe, Paytm or any UPI app. The money goes straight to your account — you just log the payment."
          bullets={[
            "The QR always matches the amount you're collecting, even for part-payments",
            "Paying a supplier? Jump into your UPI app in one tap",
            "Save a UPI ID on each contact to pay them directly",
            "No payment gateway in between",
          ]}
        >
          <MockUpiPayment />
        </SpotlightCard>

        <SpotlightCard
          icon={FileText}
          gradient="from-rose-500 to-pink-500"
          title="Invoices & purchase bills"
          description="Every sale gets an invoice and every purchase a purchase bill — one tap from the transaction, as a clean black-and-white PDF."
          bullets={[
            "Your business details, items, charges, amount paid and balance due",
            "Download it, or share it straight to WhatsApp, email or Drive",
            "Works for walk-in sales too",
          ]}
        >
          <MockInvoice />
        </SpotlightCard>
      </div>
    </div>
  </section>
);

// ─── Section: Table view + stock ─────────────────────────────────────────────

const CatalogSpotlightSection = () => (
  <section className="py-20 bg-muted/20 border-y">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeader
        badge="Catalog, level up"
        title="Prices at a glance. Stock under control."
        description="Compare every size and brand in one table and, if you want it, let Vyaapaar keep count of what's on the shelf."
        className="mb-12"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SpotlightCard
          icon={Table2}
          gradient="from-indigo-500 to-blue-500"
          title="Table view"
          description="A category made of sizes or variants becomes a table: products down the side, sizes across the top. Swap the two with one tap."
          bullets={[
            "Shows sell, cost or profit — retail or bulk — just like the list",
            "Tap a price for its details; in edit mode, tap to change it",
            "Remembers your choice for each category",
          ]}
        >
          <MockPivotTable />
        </SpotlightCard>

        <SpotlightCard
          icon={Boxes}
          gradient="from-amber-500 to-orange-500"
          title="Stock tracking"
          description="Turn it on for the items you count. Every sale takes stock down and every purchase adds it back."
          bullets={[
            "Off by default — items you don't track stay exactly as they are",
            "Editing or deleting a bill puts the stock right again",
            "Warns before you oversell, but never blocks a sale",
            "Low-stock alerts in Settings, badges in the catalog",
          ]}
        >
          <MockStockCard />
        </SpotlightCard>
      </div>
    </div>
  </section>
);

// ─── Section: Feature Grid ────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Globe,
    title: "Public catalog link",
    desc: "Share a searchable catalog page with customers. They can build a cart and send you an itemised WhatsApp enquiry — no app required.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Search,
    title: "Instant search",
    desc: "Fuzzy-match search finds any product even with typos or partial names. Works on fractions too: type '1/2' or '0.5'.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: Zap,
    title: "Bulk text edit",
    desc: "Edit your whole price list — or all your contacts — as plain text. Paste from Excel, WhatsApp, or type freehand — just use pipes.",
    gradient: "from-yellow-500 to-amber-500",
  },
  {
    icon: Table2,
    title: "Table view",
    desc: "Turn a category of sizes or variants into a table — products down the side, sizes across the top — and swap them in a tap.",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    icon: Boxes,
    title: "Stock tracking",
    desc: "Switch it on per item. Sales take stock down, purchases add it back, and low-stock alerts show up in Settings.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: TrendingUp,
    title: "Dual pricing",
    desc: "Set retail and bulk sell prices separately. Track cost price and profit margin per item.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Ruler,
    title: "Unit-smart profit",
    desc: "Bought by the kilo, sold by the gram? Cost and sell prices are compared across units, so the profit is always right.",
    gradient: "from-lime-500 to-green-500",
  },
  {
    icon: Calculator,
    title: "Material calculator",
    desc: "Customers enter what they need in any compatible unit — say grams for an item priced per kg — and see the quantity and cost.",
    gradient: "from-sky-500 to-indigo-500",
  },
  {
    icon: QrCode,
    title: "UPI scan-to-pay",
    desc: "Pick UPI when you record a payment and get a QR for the exact amount. Paying a supplier? Open your UPI app in one tap.",
    gradient: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: FileText,
    title: "Invoices & purchase bills",
    desc: "Download or share a clean PDF for any sale or purchase — your details, items, charges, amount paid and balance.",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: CreditCard,
    title: "Payment history",
    desc: "Every payment is logged with method, date, and note. Settlements are traced across linked transactions.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: History,
    title: "Edit history",
    desc: "Every change is logged as before → after. While editing, each line shows what changed and can be reset in one tap.",
    gradient: "from-slate-500 to-zinc-600",
  },
  {
    icon: UserPlus,
    title: "Walk-in sales",
    desc: "Record a sale or purchase without picking a contact first, then assign the right person later — solo or in bulk.",
    gradient: "from-teal-500 to-green-500",
  },
  {
    icon: Link2,
    title: "Bill one, tag another",
    desc: "Collecting an order for a neighbour? Bill the one who pays and tag the other — it shows under both, but only counts for the payer.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: FileEdit,
    title: "Auto-saved drafts",
    desc: "Closed a half-entered bill by accident? It's saved as a draft you can resume or discard next time.",
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    icon: FileDown,
    title: "PDF export",
    desc: "Export contacts to a professional PDF in table, grid, or bento layout — landscape or portrait.",
    gradient: "from-red-500 to-orange-500",
  },
  {
    icon: Upload,
    title: "Import & merge contacts",
    desc: "Upload a .vcf file or pick straight from your phone's contact list, then find and merge any duplicates.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: BookOpen,
    title: "Notes everywhere",
    desc: "Add notes to categories, items, and contacts. Great for supplier terms, item specs, or anything else.",
    gradient: "from-purple-500 to-violet-500",
  },
  {
    icon: RefreshCw,
    title: "Offline-first sync",
    desc: "Keep working with zero signal — sales, prices, and contacts queue locally and sync the instant you're back online.",
    gradient: "from-sky-500 to-blue-500",
  },
  {
    icon: GitMerge,
    title: "Smart conflict resolution",
    desc: "Edited the same thing on two devices? Keep yours, keep the server's, or merge both — with a field-by-field picker for contacts.",
    gradient: "from-fuchsia-500 to-purple-500",
  },
  {
    icon: Smartphone,
    title: "Mobile-first, light & dark",
    desc: "Designed for one-handed use on any phone, with light, dark or system themes and adjustable text size.",
    gradient: "from-cyan-500 to-blue-500",
  },
];

const FeaturesSection = () => (
  <section className="py-24">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHeader
        badge="Features"
        title="Built for how you actually work"
        description="Every feature comes from a real need — not a feature checklist."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="group bg-card border rounded-xl p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <div
                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}
              >
                <Icon className="w-[18px] h-[18px] text-white" />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

// ─── Section: Public catalog highlight ───────────────────────────────────────

const PublicCatalogSection = () => (
  <section className="py-20 border-y bg-muted/20">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <Badge variant="secondary" className="mb-4">
            Customer-facing catalog
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Share your prices without picking up the phone
          </h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Every business gets a public URL. Customers browse and search your
            full catalog, add items to a cart, work out how much they need, and
            send you an itemised enquiry on WhatsApp — no app, no login. Your
            address links to Google Maps, and your phone is still just a tap
            away.
          </p>
          <ul className="space-y-3 mb-6">
            {[
              "Instant search with typo tolerance",
              "Retail prices only — cost stays private",
              "Cart with quantity steppers, no login needed",
              "Material calculator: need 750 g of something priced per kg? It converts and prices it",
              "The enquiry goes out as a clean itemised picture, or plain text if they prefer",
              "Works on any mobile browser",
              "Updates automatically when you edit",
            ].map((item) => (
              <CheckItem key={item}>{item}</CheckItem>
            ))}
          </ul>
          <Button variant="outline" className="gap-2" asChild>
            <Link href={DEMO_BUSINESS_PATH}>
              <Globe className="w-4 h-4" />
              See a live example
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        <div className="bg-card border rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-tight">
                {MOCK_SHOP.name}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                {MOCK_SHOP.address}
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 shrink-0">
              <ShoppingCart className="w-3.5 h-3.5" />2
            </div>
          </div>

          <div className="space-y-1 mb-3">
            <div className="bg-secondary rounded-lg px-3 py-2 text-sm font-bold">
              Groceries
            </div>
            <div className="ml-3 border-l-2 border-border pl-3 space-y-0.5">
              <div className="bg-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                Staples
              </div>
              <div className="ml-3 border-l-2 border-border pl-3">
                <MockCatalogRow name="Toor Dal" price="₹160/kg" qty={2} />
                <MockCatalogRow name="Sugar" price="₹46/kg" qty={3} />
                <MockCatalogRow name="Basmati Rice" price="₹120/kg" last />
                <MockCalculator />
              </div>
            </div>
          </div>

          <div className="space-y-1 mb-4">
            <div className="bg-secondary rounded-lg px-3 py-2 text-sm font-bold">
              Cooking Oil
            </div>
            <div className="ml-3 border-l-2 border-border pl-3 space-y-0.5">
              <div className="bg-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                1 L
              </div>
              <div className="ml-3 border-l-2 border-border pl-3">
                <MockCatalogRow name="Sunflower Oil" price="₹145/pack" />
                <MockCatalogRow name="Mustard Oil" price="₹170/pack" last />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Phone className="w-3 h-3" />
              <span>{MOCK_SHOP.phone} — tap to call</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white">
              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                Send enquiry
              </span>
              <span className="opacity-90">2 items</span>
            </div>
            <p className="text-[11px] text-muted-foreground text-right underline underline-offset-2">
              Send as plain text instead
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ─── Section: CTA ─────────────────────────────────────────────────────────────

const CTASection = () => (
  <section className="py-24 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700">
    {/* Subtle radial highlight */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_30%,rgba(255,255,255,0.10),transparent)] pointer-events-none" />
    {/* Bottom fade to page */}
    <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />

    <div className="relative max-w-3xl mx-auto px-4 text-center text-white">
      <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
        Ready to ditch the paper?
      </h2>
      <p className="text-lg text-indigo-100 mb-8 max-w-xl mx-auto">
        Join businesses already using Vyaapaar. Free, forever. No credit card.
        Up and running in under two minutes.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          size="lg"
          className="text-base gap-2 h-12 px-7 bg-white text-indigo-700 hover:bg-indigo-50 border-0 font-semibold shadow-lg"
          asChild
        >
          <Link href="/register">
            Create free account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="text-base gap-2 h-12 px-7 border-white/40 text-white hover:bg-white/15 hover:border-white/60"
          asChild
        >
          <Link href={DEMO_BUSINESS_PATH}>
            <Store className="w-4 h-4" />
            View demo store
          </Link>
        </Button>
      </div>
    </div>
  </section>
);

// ─── Section: Support (real UPI QR) ──────────────────────────────────────────

// The QR generator (the `qrcode` package) is only needed way down the page, so
// it's loaded on demand instead of sitting in the landing page's main bundle.
const UpiQrCode = dynamic(
  () => import("@/components/UpiQrCode").then((m) => m.UpiQrCode),
  {
    ssr: false,
    loading: () => (
      <div className="w-56 h-56 rounded-lg border bg-muted/30" aria-hidden />
    ),
  },
);

const SupportSection = () => {
  // Never render a broken QR — the link is null if the UPI ID isn't valid.
  if (!SUPPORT_UPI_LINK) return null;

  return (
    <section className="py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card border rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 min-w-0 space-y-4 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-sm mx-auto sm:mx-0">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Vyaapaar is free to use
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If it's saving you time, you can chip in with UPI.{" "}
                <span className="font-semibold text-foreground">
                  {fmtINR(SUPPORT_UPI.defaultAmount)}
                </span>{" "}
                is pre-filled — change it to whatever you like.
              </p>
            </div>
            {/* A phone can't scan its own screen, so small screens also get a
                tap-to-pay link. */}
            <Button className="gap-2 sm:hidden" asChild>
              <a href={SUPPORT_UPI_LINK}>
                <ExternalLink className="w-4 h-4" />
                Pay in your UPI app
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">
              UPI ID:{" "}
              <span className="font-mono text-foreground select-all">
                {SUPPORT_UPI.vpa}
              </span>
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-2">
            <UpiQrCode link={SUPPORT_UPI_LINK} size={224} />
            <p className="text-sm text-muted-foreground text-center max-w-56">
              Scan with GPay, PhonePe, Paytm or any UPI app
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Nav ──────────────────────────────────────────────────────────────────────

const Nav = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Logo />

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-2">
            {user ? (
              <Button size="sm" className="gap-1.5" asChild>
                <Link href="/catalog">
                  Go to Catalog
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button size="sm" className="gap-1.5" asChild>
                  <Link href="/register">
                    Get started free
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="sm:hidden p-2 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t py-3 space-y-2 pb-4">
            {user ? (
              <Button className="w-full gap-2" asChild>
                <Link href="/catalog" onClick={() => setMobileOpen(false)}>
                  Go to Catalog
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  asChild
                >
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button className="w-full gap-2" asChild>
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    Get started free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────

const Footer = () => (
  <footer className="bg-muted/30 border-t py-12">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
        <div className="sm:col-span-2">
          <Logo className="mb-3" />
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Modern inventory, contacts, and transaction tracking for growing
            Indian businesses. Free, fast, and built with ❤️ in India.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-4 text-sm">Product</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              { label: "Get started", path: "/register" },
              { label: "Sign in", path: "/login" },
              {
                label: "Demo catalog",
                path: DEMO_BUSINESS_PATH,
              },
            ].map(({ label, path }) => (
              <li key={label}>
                <Link
                  href={path}
                  className="hover:text-foreground transition-colors text-left"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-4 text-sm">Features</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              "Product Catalog",
              "Transaction Ledger",
              "Contact Management",
              "Reports",
              "UPI & Invoices",
              "Public Catalog",
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Vyaapaar. Made with ❤️ in India.</p>
        <p className="text-xs">Free forever · No credit card · No ads</p>
      </div>
    </div>
  </footer>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <HeroSection />
      <PainPointsSection />
      <ModulesSection />
      <LedgerDemoSection />
      <PaymentsSection />
      <CatalogSpotlightSection />
      <FeaturesSection />
      <PublicCatalogSection />
      <CTASection />
      <SupportSection />
      <Footer />
    </div>
  );
}
