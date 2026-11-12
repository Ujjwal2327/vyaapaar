/* eslint-disable react/no-unescaped-entities */
"use client";

/**
 * components/LandingPage.jsx  (v3 — slimmer rewrite)
 *
 * v3: the page is now one hero, a six-module overview, three focused
 * spotlights (get paid · quote & bill with GST · reports) and a short list of
 * supporting details. New since v2: GST tax invoices + GSTR-1 export,
 * quotations & delivery challans, WhatsApp payment reminders + receipts.
 * Removed: the pain-point strip, the 20-card feature grid and the
 * long mock-ups. The hero background no longer uses hsl(var(--primary)) —
 * the theme colours are oklch, so that gradient never rendered.
 */

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  Heart,
  Menu,
  MessageCircle,
  Package,
  QrCode,
  Receipt,
  RefreshCw,
  Scale,
  Store,
  Table2,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { isValidUpiId } from "@/lib/utils/upi";

// Must keep matching a REAL, published business (users.business_name with
// catalog_public = true) — every "live demo" link opens it.
const DEMO_BUSINESS_PATH = `/business/maheshwari-sanitary-store`;

// The fictional shop behind every example on this page.
const SHOP = { name: "Sharma General Store", upi: "sharma@okhdfcbank" };

// ─── "Support Vyaapaar" QR (real, scannable) ─────────────────────────────────
// Pre-filled with ₹69; `mam` makes the amount editable in most UPI apps.
// Do a real test scan (GPay / PhonePe / Paytm) after changing anything here.
const SUPPORT_UPI = {
  vpa: "ujjwal2327-2@okicici",
  payeeName: "Vyaapaar",
  note: "Support Vyaapaar",
  defaultAmount: 69,
  minAmount: 1,
};

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
  if (minAmount > 0 && minAmount < defaultAmount) {
    parts.push(`mam=${minAmount.toFixed(2)}`);
  }
  parts.push("cu=INR", `tn=${encodeURIComponent(note.slice(0, 50))}`);
  return `upi://pay?${parts.join("&")}`;
};

const SUPPORT_UPI_LINK = buildSupportUpiLink(SUPPORT_UPI);

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

// ─── Layout helpers ──────────────────────────────────────────────────────────

const Section = ({ id, className = "", children }) => (
  <section id={id} className={`py-20 sm:py-24 ${className}`}>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
  </section>
);

const Heading = ({ title, description }) => (
  <div className="max-w-2xl mb-12">
    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
    {description && (
      <p className="mt-3 text-lg text-muted-foreground">{description}</p>
    )}
  </div>
);

const IconBadge = ({ icon: Icon }) => (
  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
    <Icon className="w-5 h-5" />
  </div>
);

const GREEN = "text-green-600 dark:text-green-400";
const RED = "text-red-600 dark:text-red-400";

// ─── Product mock-ups (decorative — nothing here is interactive) ─────────────

const Stat = ({ label, value, tone, icon: Icon }) => (
  <div className="rounded-lg border p-2 min-w-0">
    <div className="flex items-center gap-1 mb-1">
      <Icon className={`w-3 h-3 shrink-0 hidden sm:block ${tone}`} />
      <span className="text-[10px] text-muted-foreground truncate">
        {label}
      </span>
    </div>
    <p
      className={`text-[13px] font-bold tabular-nums whitespace-nowrap ${tone}`}
    >
      {value}
    </p>
  </div>
);

const TxnRow = ({ sale, name, items, amount, paid }) => (
  <div className="border rounded-xl p-3 text-xs">
    <div className="flex items-center justify-between mb-1">
      <span className="font-semibold flex items-center gap-1.5">
        {sale ? (
          <TrendingUp className={`w-3.5 h-3.5 ${GREEN}`} />
        ) : (
          <TrendingDown className={`w-3.5 h-3.5 ${RED}`} />
        )}
        {sale ? "Sale" : "Purchase"}
      </span>
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
          paid
            ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
        }`}
      >
        {paid ? "Complete" : "Pending"}
      </span>
    </div>
    <p className="text-muted-foreground truncate mb-1">{items}</p>
    <div className="flex justify-between">
      <span className="text-muted-foreground">{name}</span>
      <span className={`font-bold ${sale ? GREEN : RED}`}>
        {sale ? "+" : "-"}₹{amount}
      </span>
    </div>
  </div>
);

const STOCK_CLS = {
  ok: "bg-muted text-muted-foreground",
  low: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
};

const CATALOG_ROWS = [
  ["Sugar", "₹46/kg", ["ok", "42 in stock"]],
  ["Basmati Rice", "₹120/kg", ["low", "Low: 4"]],
  ["Toor Dal", "₹160/kg"],
  ["Sunflower Oil 1 L", "₹145/pack"],
  ["Mustard Oil 1 L", "₹170/pack"],
];

const SALES = [38, 44, 41, 52, 49, 61, 58, 66, 63, 72, 69, 81];
const BUYS = [30, 28, 35, 33, 40, 38, 44, 41, 46, 45, 50, 48];
const linePath = (vals) =>
  vals
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${((i * 300) / (vals.length - 1)).toFixed(1)},${100 - v}`,
    )
    .join(" ");

const MockChart = ({ className = "h-28" }) => (
  <svg
    viewBox="0 0 300 100"
    preserveAspectRatio="none"
    role="img"
    aria-label="Sales and purchases over the last 12 weeks"
    className={`w-full ${className}`}
  >
    {[10, 50, 90].map((y) => (
      <line
        key={y}
        x1="0"
        x2="300"
        y1={y}
        y2={y}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
        className="stroke-border"
      />
    ))}
    <path
      d={linePath(BUYS)}
      fill="none"
      strokeWidth="2"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      className="stroke-red-600 dark:stroke-red-400"
    />
    <path
      d={linePath(SALES)}
      fill="none"
      strokeWidth="2"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      className="stroke-green-600 dark:stroke-green-400"
    />
  </svg>
);

const TOP_ITEMS = [
  ["Basmati Rice", 48500],
  ["Sunflower Oil", 31200],
  ["Toor Dal", 22800],
];

const TopItems = () => (
  <div className="space-y-2.5">
    {TOP_ITEMS.map(([name, value]) => (
      <div key={name} className="space-y-1">
        <div className="flex justify-between text-xs">
          <span>{name}</span>
          <span className="font-semibold tabular-nums">{fmtINR(value)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${(value / TOP_ITEMS[0][1]) * 100}%` }}
          />
        </div>
      </div>
    ))}
  </div>
);

// ─── Hero ────────────────────────────────────────────────────────────────────

const HERO_TABS = ["Ledger", "Catalog", "Reports"];

const PhoneMock = () => {
  const [tab, setTab] = useState("Ledger");

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit mx-auto mb-4">
        {HERO_TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border-2 bg-card shadow-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/60 flex items-center gap-1.5 text-xs font-bold">
          <Store className="w-4 h-4 text-primary" />
          Vyaapaar
        </div>

        <div className="p-3 space-y-2 h-[350px]">
          {tab === "Ledger" && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-1">
                <Stat
                  label="Receivable"
                  value="₹12,400"
                  tone={GREEN}
                  icon={TrendingUp}
                />
                <Stat
                  label="Payable"
                  value="₹4,200"
                  tone={RED}
                  icon={TrendingDown}
                />
                <Stat label="Net" value="+₹8,200" tone={GREEN} icon={Scale} />
              </div>
              <TxnRow
                sale
                name="Ramesh Kumar"
                items="Basmati Rice × 20, Toor Dal × 5"
                amount="3,200"
              />
              <TxnRow
                name="Gupta Wholesale"
                items="Sugar × 100, Basmati Rice × 50"
                amount="8,500"
                paid
              />
              <TxnRow
                sale
                name="Sunita Devi"
                items="Toor Dal × 4, Sugar × 10"
                amount="1,100"
              />
            </>
          )}

          {tab === "Catalog" && (
            <>
              <div className="bg-secondary rounded-lg px-3 py-2 text-xs font-bold">
                Groceries
              </div>
              <div className="ml-2 border-l-2 pl-3">
                {CATALOG_ROWS.map(([name, price, stock]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-2 py-2 border-b last:border-0 text-xs"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{name}</span>
                      {stock && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${STOCK_CLS[stock[0]]}`}
                        >
                          {stock[1]}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      {price}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "Reports" && (
            <>
              <div className="border rounded-xl p-3">
                <p className="text-xs font-semibold">Sales vs purchases</p>
                <div className="flex gap-3 text-[10px] text-muted-foreground my-1">
                  <span>
                    Sales <b className="text-foreground">{fmtINR(184200)}</b>
                  </span>
                  <span>
                    Purchases{" "}
                    <b className="text-foreground">{fmtINR(112500)}</b>
                  </span>
                </div>
                <MockChart className="h-24" />
              </div>
              <div className="border rounded-xl p-3">
                <p className="text-xs font-semibold mb-2">Top-selling items</p>
                <TopItems />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Hero = () => (
  <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]" />
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
      <div className="text-center lg:text-left space-y-6">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight">
          Run your business, not your paperwork
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
          Catalog, ledger, contacts, GST invoices and reports in one fast app
          built for Indian shops. It works offline and it's free.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
          <Button size="lg" className="h-12 px-6 text-base gap-2" asChild>
            <Link href="/register">
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-6 text-base gap-2"
            asChild
          >
            <Link href={DEMO_BUSINESS_PATH}>
              <Globe className="w-4 h-4" />
              See a live catalog
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start text-sm text-muted-foreground">
          {["No credit card", "Setup in two minutes", "Works offline"].map(
            (t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                {t}
              </span>
            ),
          )}
        </div>
      </div>
      <PhoneMock />
    </div>
  </section>
);

// ─── Modules ─────────────────────────────────────────────────────────────────

const MODULES = [
  {
    icon: Package,
    title: "Catalog",
    text: "Nested categories, retail and bulk prices, optional stock tracking and a public link for customers.",
  },
  {
    icon: Receipt,
    title: "Ledger",
    text: "Every sale and purchase with full payment history, auto-settle and UPI collection.",
  },
  {
    icon: Users,
    title: "Contacts",
    text: "Customers, suppliers and helpers, each with a live balance. Import from your phone.",
  },
  {
    icon: FileText,
    title: "Quotations and challans",
    text: "Send quotes and delivery challans as PDFs. Turn one into a sale with a single tap.",
    isNew: true,
  },
  {
    icon: FileSpreadsheet,
    title: "GST billing",
    text: "Auto-numbered tax invoices with CGST, SGST or IGST, and a monthly GSTR-1 export.",
    isNew: true,
  },
  {
    icon: BarChart3,
    title: "Reports",
    text: "Sales, top sellers, profit margin and what's owed, by day, week or month.",
  },
];

const Modules = () => (
  <Section id="features" className="border-y bg-muted/20">
    <Heading
      title="Everything a shop needs, in one place"
      description="One product that connects your prices, your people, your payments and your numbers."
    />
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MODULES.map(({ icon, title, text, isNew }) => (
        <div key={title} className="bg-card border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <IconBadge icon={icon} />
            {isNew && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                New
              </span>
            )}
          </div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {text}
          </p>
        </div>
      ))}
    </div>
  </Section>
);

// ─── Spotlights ──────────────────────────────────────────────────────────────

const Spotlight = ({
  title,
  description,
  points,
  reverse = false,
  children,
}) => (
  <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
    <div className={`space-y-5 ${reverse ? "lg:order-2" : ""}`}>
      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
      <ul className="space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-sm">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
    <div
      className={`rounded-2xl border bg-muted/30 p-5 sm:p-8 ${reverse ? "lg:order-1" : ""}`}
    >
      {children}
    </div>
  </div>
);

// Mirrors lib/utils/reminderBuilder.js and the receipt text.
const ReminderMock = () => (
  <div className="max-w-sm mx-auto space-y-3 text-sm">
    <div className="rounded-2xl rounded-tl-sm border bg-card p-4 space-y-3 shadow-sm">
      <p>
        Hi Ramesh, a reminder from {SHOP.name}: <b>{fmtINR(900)}</b> is pending
        (oldest bill 20 days old).
      </p>
      <div className="text-muted-foreground">
        <p>Pay by UPI</p>
        <p>ID: {SHOP.upi}</p>
        <p>Amount: {fmtINR(900)}</p>
      </div>
      <p>Thank you!</p>
    </div>
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5">
        <QrCode className="w-3.5 h-3.5 text-primary" />
        UPI QR for {fmtINR(900)}
      </span>
      <span className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5">
        <FileText className="w-3.5 h-3.5 text-primary" />
        Statement.pdf
      </span>
    </div>
    <div className="rounded-2xl rounded-tr-sm border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 text-green-800 dark:text-green-300 ml-8">
      Payment received: {fmtINR(1000)}. Balance: fully paid ✓
    </div>
  </div>
);

// A tax invoice as the PDF prints it (always black on white), plus a document.
const GstMock = () => (
  <div className="max-w-sm mx-auto space-y-3">
    <div className="bg-white text-neutral-900 rounded-md border border-neutral-200 shadow-md p-4 text-[11px] leading-snug">
      <div className="flex justify-between gap-3 pb-2 border-b-2 border-neutral-900">
        <div>
          <p className="text-[13px] font-bold">{SHOP.name}</p>
          <p className="text-neutral-600">GSTIN: 09ABCDE1234F1Z5</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold">TAX INVOICE</p>
          <p className="text-neutral-600">INV/26-27/00001</p>
        </div>
      </div>
      <div className="flex justify-between py-2 border-b border-neutral-200">
        <div>
          <p className="font-medium">Storage Container Set</p>
          <p className="text-neutral-500 text-[10px]">HSN 3924 · 4 × ₹2,500</p>
        </div>
        <span>₹10,000.00</span>
      </div>
      <div className="pt-2 ml-auto w-3/5 space-y-0.5 text-neutral-600">
        <div className="flex justify-between">
          <span>CGST 9%</span>
          <span>₹900.00</span>
        </div>
        <div className="flex justify-between">
          <span>SGST 9%</span>
          <span>₹900.00</span>
        </div>
        <div className="flex justify-between border-t-2 border-neutral-900 pt-1 mt-1 text-xs font-bold text-neutral-900">
          <span>Invoice total</span>
          <span>₹11,800.00</span>
        </div>
      </div>
    </div>
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-xs">
      <span className="flex items-center gap-2 min-w-0">
        <Truck className="w-4 h-4 text-primary shrink-0" />
        <span className="truncate">Quotation for Ramesh Kumar · Open</span>
      </span>
      <span className="rounded-md bg-green-600 text-white font-medium px-2.5 py-1.5 whitespace-nowrap">
        Convert to sale
      </span>
    </div>
  </div>
);

const ReportsMock = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Receivable" value="₹12,400" tone={GREEN} icon={TrendingUp} />
      <Stat label="Payable" value="₹4,200" tone={RED} icon={TrendingDown} />
      <Stat label="Net" value="+₹8,200" tone={GREEN} icon={Scale} />
    </div>
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold">Sales vs purchases</p>
      <p className="text-xs text-muted-foreground mb-2">Last 12 weeks</p>
      <MockChart />
    </div>
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold mb-3">Top-selling items</p>
      <TopItems />
    </div>
  </div>
);

const Spotlights = () => (
  <Section>
    <div className="space-y-24">
      <Spotlight
        title="Get paid without chasing people"
        description="Collect by UPI at the counter, and remind customers on WhatsApp when a bill is overdue."
        points={[
          "A UPI QR for the exact amount appears when you record a payment",
          "Send payment reminders with the QR and a statement PDF, to one person or many",
          "Send a payment receipt the moment a customer pays",
        ]}
      >
        <ReminderMock />
      </Spotlight>

      <Spotlight
        reverse
        title="Quote, deliver and bill with GST"
        description="Share a quotation or challan before the sale, then issue a proper tax invoice when it happens."
        points={[
          "Invoice numbers run in an unbroken series and restart each April",
          "CGST, SGST or IGST is picked from the place of supply",
          "Quotations and challans don't touch your ledger or stock until you convert them",
          "Export the month's GSTR-1 data and an invoice register for your CA",
        ]}
      >
        <GstMock />
      </Spotlight>

      <Spotlight
        title="Know where the money is"
        description="Reports are built from the transactions you already record, so there's nothing extra to enter."
        points={[
          "Sales against purchases, and top sellers by revenue or quantity",
          "Profit margin using each item's cost at the time of sale",
          "Receivable and payable tracked over time, even from your last sync when offline",
        ]}
      >
        <ReportsMock />
      </Spotlight>
    </div>
  </Section>
);

// ─── Details ─────────────────────────────────────────────────────────────────

const DETAILS = [
  {
    icon: Globe,
    title: "Shareable catalog",
    text: "A public link with a cart, a unit calculator and WhatsApp enquiries. Cost prices stay private.",
  },
  {
    icon: Boxes,
    title: "Stock tracking",
    text: "Sales take stock down, purchases add it back. It warns before you oversell but never blocks a sale.",
  },
  {
    icon: Table2,
    title: "Table view",
    text: "See sizes and variants side by side in one price table.",
  },
  {
    icon: RefreshCw,
    title: "Offline first",
    text: "Keep working with no signal. Changes sync later and you resolve any conflicts yourself.",
  },
  {
    icon: Users,
    title: "Contact tools",
    text: "Import from .vcf or your phone, merge duplicates and export a PDF directory.",
  },
  {
    icon: Zap,
    title: "Bulk edit",
    text: "Edit the whole price list or contact list as plain text.",
  },
];

const Details = () => (
  <Section className="border-y bg-muted/20">
    <Heading title="The details that save time" />
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
      {DETAILS.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex gap-3">
          <Icon className="w-5 h-5 mt-0.5 text-primary shrink-0" />
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {text}
            </p>
          </div>
        </div>
      ))}
    </div>
  </Section>
);

// ─── Closing ─────────────────────────────────────────────────────────────────

const CTA = () => (
  <Section>
    <div className="rounded-3xl bg-primary text-primary-foreground px-6 py-14 sm:py-16 text-center">
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
        Ready to put the paper away?
      </h2>
      <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
        Free to use, with no credit card. Most shops are set up in under two
        minutes.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          size="lg"
          variant="secondary"
          className="h-12 px-7 text-base gap-2"
          asChild
        >
          <Link href="/register">
            Create a free account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="h-12 px-7 text-base gap-2 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          asChild
        >
          <Link href={DEMO_BUSINESS_PATH}>
            <Store className="w-4 h-4" />
            View a demo store
          </Link>
        </Button>
      </div>
    </div>
  </Section>
);

// `qrcode` is only needed down here, so it loads on demand.
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
    <section className="pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card border rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1 min-w-0 space-y-4 text-center sm:text-left">
            <div className="flex justify-center sm:justify-start">
              <IconBadge icon={Heart} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Vyaapaar is free to use
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              If it's saving you time, you can chip in with UPI.{" "}
              <span className="font-semibold text-foreground">
                {fmtINR(SUPPORT_UPI.defaultAmount)}
              </span>{" "}
              is pre-filled and you can change it to whatever you like.
            </p>
            {/* A phone can't scan its own screen, so small screens get a tap-to-pay link. */}
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
            <UpiQrCode link={SUPPORT_UPI_LINK} size={208} />
            <p className="text-sm text-muted-foreground text-center max-w-52">
              Scan with GPay, PhonePe, Paytm or any UPI app
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Nav + footer ────────────────────────────────────────────────────────────

const Nav = () => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const close = () => setOpen(false);

  const cta = user ? (
    <Button size="sm" className="gap-1.5" asChild>
      <Link href="/catalog" onClick={close}>
        Go to Catalog
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </Button>
  ) : (
    <>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/login" onClick={close}>
          Sign in
        </Link>
      </Button>
      <Button size="sm" className="gap-1.5" asChild>
        <Link href="/register" onClick={close}>
          Get started free
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </Button>
    </>
  );

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Logo />
          <div className="hidden sm:flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <a href="#features">Features</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={DEMO_BUSINESS_PATH}>Live demo</Link>
            </Button>
            <span className="w-px h-5 bg-border mx-2" aria-hidden />
            {cta}
          </div>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            className="sm:hidden p-2 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {open && (
          <div className="sm:hidden border-t py-3 pb-4 flex flex-col gap-2 [&>*]:w-full">
            {cta}
          </div>
        )}
      </div>
    </nav>
  );
};

const Footer = () => (
  <footer className="border-t py-10">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-start justify-between gap-8">
      <div className="max-w-xs space-y-3">
        <Logo className="justify-start" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Catalog, contacts and ledger for growing Indian businesses.
        </p>
      </div>
      <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
        {[
          ["Get started", "/register"],
          ["Sign in", "/login"],
          ["Live demo", DEMO_BUSINESS_PATH],
          ["Marketplace", "/marketplace"],
        ].map(([label, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-6 border-t flex flex-col sm:flex-row justify-between gap-2 text-sm text-muted-foreground">
      <p>© {new Date().getFullYear()} Vyaapaar. Made with ❤️ in India.</p>
      <p>Free forever · No credit card · No ads</p>
    </div>
  </footer>
);

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Modules />
      <Spotlights />
      <Details />
      <CTA />
      <SupportSection />
      <Footer />
    </div>
  );
}
