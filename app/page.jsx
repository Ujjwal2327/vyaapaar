/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Star,
  FileDown,
  Upload,
  Receipt,
  CreditCard,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  BarChart3,
  Phone,
  MapPin,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import Loader from "@/components/Loader";
import Logo from "@/components/Logo";

// ─── Mini mock components for the hero visual ────────────────────────────────

const MockTransactionCard = ({
  type,
  amount,
  name,
  status,
  items,
  delay = "0s",
}) => (
  <div
    className="bg-card border rounded-xl p-3 shadow-sm text-xs"
    style={{ animationDelay: delay }}
  >
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
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700"
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
          type === "sale" ? "text-green-600" : "text-red-500"
        }`}
      >
        {type === "sale" ? "+" : "-"}₹{amount}
      </span>
    </div>
  </div>
);

const MockSummaryCard = ({ label, amount, color, icon: Icon }) => (
  <div className="bg-card border rounded-lg p-2.5 flex-1">
    <div className="flex items-center gap-1 mb-1">
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="text-[10px] text-muted-foreground font-medium">
        {label}
      </span>
    </div>
    <p className={`text-sm font-bold ${color}`}>₹{amount}</p>
  </div>
);

const MockPriceItem = ({ name, price, unit }) => (
  <div className="flex justify-between items-center py-1.5 border-b last:border-0 text-xs">
    <span className="text-foreground">{name}</span>
    <span className="font-semibold text-foreground">
      ₹{price}/{unit}
    </span>
  </div>
);

const MockContactCard = ({ name, phone, category, color }) => (
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
    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full shrink-0">
      {category}
    </span>
  </div>
);

// ─── Section: Hero ────────────────────────────────────────────────────────────

const HeroSection = ({ router }) => {
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
              books with one fast, free app. Catalog. Contacts. Khata — all in
              one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button
                size="lg"
                onClick={() => router.push("/register")}
                className="text-base gap-2 h-12 px-6"
              >
                Start for free
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  router.push("/business/Maheshwari Sanitary Store")
                }
                className="text-base gap-2 h-12 px-6"
              >
                <Globe className="w-4 h-4" />
                See live demo
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
              {[
                { id: "ledger", label: "Ledger" },
                { id: "catalog", label: "Catalog" },
                { id: "contacts", label: "Contacts" },
              ].map((tab) => (
                <button
                  key={tab.id}
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
            <div className="mt-14 lg:mt-0 w-72 sm:w-80 bg-card border-2 border-border rounded-3xl shadow-2xl overflow-hidden">
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
              <div className="p-3 space-y-2 min-h-[320px]">
                {activeTab === "ledger" && (
                  <>
                    <div className="flex gap-2 mb-3">
                      <MockSummaryCard
                        label="To Receive"
                        amount="12,400"
                        color="text-green-600"
                        icon={TrendingUp}
                      />
                      <MockSummaryCard
                        label="To Pay"
                        amount="4,200"
                        color="text-red-500"
                        icon={TrendingDown}
                      />
                      <MockSummaryCard
                        label="Net"
                        amount="+8,200"
                        color="text-primary"
                        icon={BarChart3}
                      />
                    </div>
                    <MockTransactionCard
                      type="sale"
                      amount="3,200"
                      name="Ramesh Kumar"
                      status="pending"
                      items="PVC Pipe 4″ × 20, Angle Valve × 5"
                    />
                    <MockTransactionCard
                      type="purchase"
                      amount="8,500"
                      name="Apollo Pipes"
                      status="paid"
                      items="CPVC 3/4″ Supreme × 50"
                    />
                    <MockTransactionCard
                      type="sale"
                      amount="1,100"
                      name="Mohan Plumber"
                      status="pending"
                      items="Bib Cock Vectus × 4"
                    />
                  </>
                )}

                {activeTab === "catalog" && (
                  <>
                    <div className="bg-secondary rounded-lg px-3 py-2 text-xs font-bold mb-1">
                      Taps
                    </div>
                    <div className="ml-3 border-l-2 border-border pl-3 space-y-0.5">
                      <div className="bg-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                        Vectus
                      </div>
                      <div className="ml-3 border-l-2 border-border pl-3">
                        <MockPriceItem name="Bib Cock" price="180" unit="pc" />
                        <MockPriceItem
                          name="Angle Valve"
                          price="95"
                          unit="pc"
                        />
                        <MockPriceItem name="Sink Cock" price="380" unit="pc" />
                      </div>
                    </div>
                    <div className="bg-secondary rounded-lg px-3 py-2 text-xs font-bold mt-2">
                      PVC Pipe
                    </div>
                    <div className="ml-3 border-l-2 border-border pl-3 space-y-0.5">
                      <div className="bg-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                        4″ Verdan
                      </div>
                      <div className="ml-3 border-l-2 border-border pl-3">
                        <MockPriceItem name="Lal Halka" price="45" unit="ft" />
                        <MockPriceItem name="Hari" price="50" unit="ft" />
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
                    <MockContactCard
                      name="Ramesh Kumar"
                      phone="9876543210"
                      category="Customer"
                      color="bg-orange-500"
                    />
                    <MockContactCard
                      name="Apollo Pipes Co."
                      phone="9123456789"
                      category="Supplier"
                      color="bg-pink-500"
                    />
                    <MockContactCard
                      name="Mohan Plumber"
                      phone="7900123456"
                      category="Helper"
                      color="bg-green-500"
                    />
                    <MockContactCard
                      name="Ravi Electrician"
                      phone="8800112233"
                      category="Helper"
                      color="bg-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -right-2 top-1/4 bg-green-500 text-white text-xs px-2.5 py-1.5 rounded-full shadow-lg font-medium hidden sm:flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Settled ₹8,200
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

const PainPointsSection = () => (
  <section className="py-12 border-y bg-muted/20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
        Replace the mess you're dealing with today
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { before: "📒 Paper price lists", after: "Digital catalog" },
          { before: "📱 WhatsApp for prices", after: "Shareable link" },
          { before: "📓 Paper khata book", after: "Auto-settle ledger" },
          { before: "📞 Saved-number chaos", after: "Organized contacts" },
        ].map(({ before, after }) => (
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

// ─── Section: Three Modules ───────────────────────────────────────────────────

const ModulesSection = ({ router }) => {
  const modules = [
    {
      icon: Package,
      gradient: "from-blue-500 to-cyan-500",
      title: "Product Catalog",
      tagline: "Your price list, always up to date",
      description:
        "Organize thousands of products in nested categories. Set retail and bulk prices. Share a beautiful public link with customers — no login needed.",
      features: [
        "Unlimited categories & subcategories",
        "Retail + bulk pricing per item",
        "Public shareable catalog link",
        "Instant search across everything",
        "Bulk edit in text format",
        "Cost price & profit tracking",
      ],
      demo: "/business/Maheshwari Sanitary Store",
      demoLabel: "View live catalog",
    },
    {
      icon: Receipt,
      gradient: "from-emerald-500 to-teal-500",
      title: "Transaction Ledger",
      tagline: "Khata book — reimagined",
      description:
        "Track every sale and purchase with full payment history. Auto-settle mutual dues in one tap. Net settle clears everything with a single payment.",
      features: [
        "Record sales and purchases with items",
        "Track paid, pending & advance amounts",
        "Auto-settle mutual transactions",
        "Net settle with one payment",
        "Full payment history per transaction",
        "Contact-wise balance summary",
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
        "Keep customers, suppliers, and workers in one place. Multiple phone numbers, addresses, notes. Import from your phone — export to PDF.",
      features: [
        "Custom categories (Customer, Supplier…)",
        "Multiple phone numbers per contact",
        "Photos, addresses & specialty notes",
        "Import from .vcf / device contacts",
        "Export to professional PDF",
        "Find & merge duplicate contacts",
      ],
      demo: null,
      demoLabel: null,
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Three modules, one app
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
            Everything your business needs
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Not three separate apps. One product that connects your prices, your
            people, and your payments.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.title}
                className="group relative bg-card border-2 border-transparent hover:border-primary/20 rounded-2xl p-7 transition-all duration-300 hover:shadow-lg"
              >
                {mod.badge && (
                  <div className="absolute -top-3 -right-3">
                    <Badge className="bg-emerald-500 text-white border-0 shadow-md">
                      {mod.badge}
                    </Badge>
                  </div>
                )}

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
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {mod.demo && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-6 w-full gap-2"
                    onClick={() => router.push(mod.demo)}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {mod.demoLabel}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── Section: How transactions work ──────────────────────────────────────────

const LedgerDemoSection = () => (
  <section className="py-20 bg-muted/20 border-y">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <Badge variant="secondary" className="mb-4">
          Transaction Ledger
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Your digital khata book
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Track every rupee owed and owing. Settle dues automatically — no
          calculator, no drama.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[
          {
            step: "1",
            title: "Add transactions",
            desc: "Record sales and purchases with itemized lists or as a plain financial amount. Attach a part-payment right away.",
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

// ─── Section: Feature Grid ────────────────────────────────────────────────────

const FeaturesSection = () => {
  const features = [
    {
      icon: Globe,
      title: "Public catalog link",
      desc: "Share a beautiful, searchable catalog page with customers. No app download required.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Search,
      title: "Instant search",
      desc: "Fuzzy-match search finds any product even with typos or partial names. Works on fractions too: type '3/4' or '0.75'.",
      gradient: "from-orange-500 to-red-500",
    },
    {
      icon: Zap,
      title: "Bulk text edit",
      desc: "Edit your entire price list as plain text. Paste from Excel, WhatsApp, or type freehand — just use pipes.",
      gradient: "from-yellow-500 to-amber-500",
    },
    {
      icon: FileDown,
      title: "PDF export",
      desc: "Export contacts to a professional PDF in table, grid, or bento layout — landscape or portrait.",
      gradient: "from-red-500 to-orange-500",
    },
    {
      icon: Upload,
      title: "Import contacts",
      desc: "Upload a .vcf file or select directly from your phone's contact list. Photos included.",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: TrendingUp,
      title: "Dual pricing",
      desc: "Set retail and bulk sell prices separately. Track cost price and profit margin per item.",
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      icon: Smartphone,
      title: "Mobile-first",
      desc: "Designed for use on any device. Your team can look up prices on a phone mid-job.",
      gradient: "from-cyan-500 to-blue-500",
    },
    {
      icon: BookOpen,
      title: "Notes everywhere",
      desc: "Add notes to categories, items, and contacts. Great for supplier terms, item specs, or anything else.",
      gradient: "from-purple-500 to-violet-500",
    },
    {
      icon: CreditCard,
      title: "Payment history",
      desc: "Every payment is logged with method, date, and note. Settlements are traced across linked transactions.",
      gradient: "from-violet-500 to-purple-500",
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4">
            Features
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Built for how you actually work
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Every feature comes from a real need — not a feature checklist.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group bg-card border rounded-xl p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div
                  className={`w-9 h-9 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}
                >
                  <Icon className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
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
};

// ─── Section: Public catalog highlight ───────────────────────────────────────

const PublicCatalogSection = ({ router }) => (
  <section className="py-20 border-y bg-muted/20">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div>
          <Badge variant="secondary" className="mb-4">
            Customer-facing catalog
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Share your prices without picking up the phone
          </h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Every business gets a public URL. Send it to customers on WhatsApp
            and they can search your full catalog instantly — no app, no login.
            Your address links to Google Maps. Your phone is tap-to-call.
          </p>
          <ul className="space-y-3 mb-6">
            {[
              "Instant search with typo tolerance",
              "Retail prices only — cost stays private",
              "Works on any mobile browser",
              "Updates automatically when you edit",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push("/business/Maheshwari Sanitary Store")}
          >
            <Globe className="w-4 h-4" />
            See a live example
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="bg-card border rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-base">Maheshwari Sanitary Store</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                Tappal Road Jewar
              </div>
            </div>
          </div>

          <div className="space-y-1 mb-4">
            <div className="bg-secondary rounded-lg px-3 py-2 text-sm font-bold">
              Taps
            </div>
            <div className="ml-3 border-l-2 border-border pl-3 space-y-0.5">
              <div className="bg-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
                Vectus
              </div>
              <div className="ml-3 border-l-2 border-border pl-3">
                <div className="flex justify-between py-1.5 text-xs border-b">
                  <span>Bib Cock</span>
                  <span className="font-semibold">₹180/piece</span>
                </div>
                <div className="flex justify-between py-1.5 text-xs border-b">
                  <span>Angle Valve</span>
                  <span className="font-semibold">₹95/piece</span>
                </div>
                <div className="flex justify-between py-1.5 text-xs">
                  <span>Sink Cock</span>
                  <span className="font-semibold">₹380/piece</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Phone className="w-3 h-3" />
            <span>7900831551 — tap to call</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ─── Section: CTA ─────────────────────────────────────────────────────────────

const CTASection = ({ router }) => (
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
          onClick={() => router.push("/register")}
          className="text-base gap-2 h-12 px-7 bg-white text-indigo-700 hover:bg-indigo-50 border-0 font-semibold shadow-lg"
        >
          Create free account
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => router.push("/business/Maheshwari Sanitary Store")}
          className="text-base gap-2 h-12 px-7 border-white/40 text-white hover:bg-white/15 hover:border-white/60"
        >
          <Store className="w-4 h-4" />
          View demo store
        </Button>
      </div>
    </div>
  </section>
);

// ─── Nav ──────────────────────────────────────────────────────────────────────

const Nav = ({ router }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Logo />

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/login")}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              onClick={() => router.push("/register")}
              className="gap-1.5"
            >
              Get started free
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
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
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                router.push("/login");
                setMobileOpen(false);
              }}
            >
              Sign in
            </Button>
            <Button
              className="w-full gap-2"
              onClick={() => {
                router.push("/register");
                setMobileOpen(false);
              }}
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────

const Footer = ({ router }) => (
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
                path: "/business/Maheshwari Sanitary Store",
              },
            ].map(({ label, path }) => (
              <li key={label}>
                <button
                  onClick={() => router.push(path)}
                  className="hover:text-foreground transition-colors text-left"
                >
                  {label}
                </button>
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
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user && mounted) {
      router.replace("/catalog");
    }
  }, [user, loading, router, mounted]);

  if (!mounted || loading) return <Loader />;
  if (user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Nav router={router} />
      <HeroSection router={router} />
      <PainPointsSection />
      <ModulesSection router={router} />
      <LedgerDemoSection />
      <FeaturesSection />
      <PublicCatalogSection router={router} />
      <CTASection router={router} />
      <Footer router={router} />
    </div>
  );
}
