/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
"use client";

/**
 * app/(public)/business/[slug]/page.jsx  (v2 — replaces the old [name] route)
 *
 * v2: this used to be app/(public)/business/[name]/page.jsx, keyed directly
 * on business_name, and it fetched the business's row and its FULL
 * price_lists.data straight from the browser. That meant every visitor's
 * network tab (not just the UI) could see cost price, bulk price, and
 * stock levels — this page only ever rendered retailSell/sellUnit, but the
 * whole blob still went over the wire.
 *
 * Now:
 *  - The route key is a stable `public_slug` (falls back to an exact
 *    business_name match too, so links shared before this change keep
 *    working) instead of the business name, so renaming a business no
 *    longer breaks a link someone already has.
 *  - The one Supabase call is `get_public_business_catalog`, a
 *    SECURITY DEFINER function — `users` and `price_lists` are no longer
 *    selectable directly by anon at all, and the function itself only
 *    ever returns name + retail price + unit for each item, and only for
 *    accounts with catalog_public = true.
 *  - catalog_public is the new Settings → Share your business toggle;
 *    turning it off makes this function return null for that account's
 *    slug, same as a slug that was never registered — the "not found"
 *    state below covers both on purpose, so a stranger can't tell "doesn't
 *    exist" apart from "exists but was unpublished."
 *
 * See docs/migrations/2026-09-22-public-catalog-lockdown.sql for the
 * database side of this — that file, plus this one, are the whole change.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Store,
  ChevronDown,
  ChevronUp,
  Plus,
  ChevronsDownUp,
} from "lucide-react";
import {
  sortData,
  filterData,
  buildSearchIndex,
} from "@/lib/utils/priceListUtils";
import { appendPath } from "@/lib/utils/catalogPath";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { MaterialCalculator } from "@/components/marketplace/MaterialCalculator";
import { QuantityStepper } from "@/components/marketplace/QuantityStepper";
import {
  CartDrawer,
  CartTriggerButton,
} from "@/components/marketplace/CartDrawer";

// Tab title / meta description when the catalog isn't available. layout.jsx
// can't know that (it only sees the slug), so the effect below applies these.
const NOT_FOUND_TITLE = "Business Not Found";
const NOT_FOUND_DESC =
  "This catalog isn't available. The link may be out of date, or the owner may not be sharing it right now.";

// Helper function to create Google Maps link
const getGoogleMapsLink = (address) => {
  if (!address || !address.trim()) return null;
  const encodedAddress = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
};

// Collect all category paths from a data tree
const collectAllPaths = (obj, parentPath = "") => {
  const paths = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (key.startsWith("__")) return;
    const currentPath = appendPath(parentPath, key);
    if (value.type === "category") {
      paths[currentPath] = true;
      if (value.children) {
        Object.assign(paths, collectAllPaths(value.children, currentPath));
      }
    }
  });
  return paths;
};

export default function PublicBusinessPage() {
  const params = useParams();
  const slugParam = decodeURIComponent(params?.slug || "");

  const [loading, setLoading] = useState(true);
  const [businessData, setBusinessData] = useState(null);
  const [priceData, setPriceData] = useState({});

  // Raw search term drives the input (stays responsive)
  const [searchTerm, setSearchTerm] = useState("");
  // Debounced term drives the actual filtering (doesn't hang)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});

  // ── Marketplace cart — unaffected by this page's data-fetching rework. ──
  const { addItem, setItemQty, getQty, reconcileVendorCart } = useCart();
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    loadBusinessData();
  }, [slugParam]);

  // A cart saved before this page and the marketplace shared one key format
  // can hold keys that only this catalog can decode — see
  // lib/utils/cartKeys.js. Runs once the catalog has loaded.
  useEffect(() => {
    if (businessData?.id) reconcileVendorCart(businessData.id, priceData);
  }, [businessData, priceData, reconcileVendorCart]);

  // Debounce: only update debouncedSearchTerm 200ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Link-preview crawlers don't run JS, so they only see the slug-based tags
  // from layout.jsx. Once loading finishes with no business, correct the tab
  // title and meta tags for anyone actually viewing the page.
  useEffect(() => {
    if (loading || businessData) return;
    document.title = `${NOT_FOUND_TITLE} | Vyaapaar`;
    document
      .querySelectorAll(
        'meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]',
      )
      .forEach((el) => el.setAttribute("content", NOT_FOUND_DESC));
    document
      .querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]')
      .forEach((el) => el.setAttribute("content", NOT_FOUND_TITLE));
  }, [loading, businessData]);

  const loadBusinessData = async () => {
    setLoading(true);
    try {
      const attempt = () =>
        supabase.rpc("get_public_business_catalog", { p_slug: slugParam });

      let { data, error } = await attempt();

      // A freshly opened tab's very first request can occasionally come
      // back empty for reasons that have nothing to do with whether the
      // catalog is actually published — one quiet retry after a short
      // pause catches that, instead of showing "not found" for something
      // that resolves fine a beat later and making the person hit refresh
      // themselves to get the same effect.
      if (error || !data) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        ({ data, error } = await attempt());
      }

      if (error) throw error;

      if (!data) {
        setBusinessData(null);
        setLoading(false);
        return;
      }

      // Kept snake_case here (rather than the function's own camelCase
      // return shape) purely so every reference below — businessData.*,
      // vendorMeta — stays identical to the pre-rework version of this file.
      setBusinessData({
        id: data.id,
        business_name: data.businessName,
        business_address: data.businessAddress,
        phone: data.phone,
        email: data.email,
      });
      const sortedData = sortData(data.catalog || {}, "alphabetical");
      setPriceData(sortedData);
    } catch (error) {
      console.error("Error loading business data:", error);
      setBusinessData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = useCallback((path) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  }, []);

  // Build search index once when priceData loads — same optimization as private catalog
  const searchIndex = useMemo(() => buildSearchIndex(priceData), [priceData]);

  // filteredData only recomputes when priceData or debouncedSearchTerm changes —
  // NOT when expandedCategories changes (which is what was causing the hang)
  const filteredData = useMemo(() => {
    return filterData(priceData, debouncedSearchTerm, searchIndex);
  }, [priceData, debouncedSearchTerm, searchIndex]);

  const expandAll = useCallback(() => {
    // Use filteredData when searching, priceData when not
    setExpandedCategories(collectAllPaths(filteredData));
  }, [filteredData]);

  const collapseAll = useCallback(() => {
    setExpandedCategories({});
  }, []);

  // Auto-expand when search results change
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      setExpandedCategories(collectAllPaths(filteredData));
    }
  }, [filteredData]); // filteredData already depends on debouncedSearchTerm

  // ── Marketplace cart — vendorMeta is the shape useCart() expects.
  // handleSetQty (absolute) drives the inline stepper on every catalog
  // row; handleAddFromCalculator (additive) is only reachable through the
  // Material Calculator's own explicit action — see hooks/useCart.js for
  // why those stay two different functions instead of one. ──
  const vendorMeta = businessData
    ? {
        businessId: businessData.id,
        businessName: businessData.business_name,
        businessPhone: businessData.phone,
        businessAddress: businessData.business_address,
      }
    : null;

  const handleSetQty = (vendor, item, qty) => {
    setItemQty(vendor, item, qty);
  };

  const handleAddFromCalculator = (vendor, item, qty) => {
    addItem(vendor, {
      key: item.key,
      name: item.name,
      price: item.price,
      unit: item.unit,
      qty,
    });
    toast.success(`Added ${qty} ${item.unit} of ${item.name}`);
  };

  if (loading) {
    return <Loader content="Loading business catalog..." />;
  }

  if (!businessData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Store className="w-16 h-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">{NOT_FOUND_TITLE}</h1>
          <p className="text-muted-foreground">{NOT_FOUND_DESC}</p>
        </div>
      </div>
    );
  }

  const hasAnyExpanded = Object.values(expandedCategories).some(
    (val) => val === true,
  );

  const mapsLink = getGoogleMapsLink(businessData.business_address);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto p-4">
          {/* Business Info */}
          <div className="mb-4">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shrink-0">
                <Store className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  {businessData.business_name}
                </h1>

                {businessData.business_address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    {mapsLink ? (
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline transition-colors flex items-center gap-1 group"
                      >
                        <span>{businessData.business_address}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <span>{businessData.business_address}</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {businessData.phone && (
                    <a
                      href={`tel:${businessData.phone}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{businessData.phone}</span>
                    </a>
                  )}
                  {businessData.email && (
                    <a
                      href={`mailto:${businessData.email}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{businessData.email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center items-center gap-2">
            <Button
              onClick={hasAnyExpanded ? collapseAll : expandAll}
              variant="outline"
              size="sm"
            >
              <ChevronsDownUp className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">
                {hasAnyExpanded ? "Collapse All" : "Expand All"}
              </span>
            </Button>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              )}
            </div>

            {/* Inline, not floating — a fixed overlay button collided
                with where toast notifications appear. */}
            {vendorMeta && (
              <CartTriggerButton onClick={() => setShowCart(true)} />
            )}
          </div>
        </div>
      </header>

      {/* Catalog Content */}
      <main className="max-w-4xl mx-auto p-4">
        {Object.keys(filteredData).length > 0 ? (
          <CatalogContent
            data={filteredData}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
            vendor={vendorMeta}
            onSetQty={vendorMeta ? handleSetQty : undefined}
            onAddToCart={vendorMeta ? handleAddFromCalculator : undefined}
            getQty={getQty}
          />
        ) : (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              {searchTerm ? "No products found" : "No products available"}
            </p>
          </div>
        )}
      </main>

      <footer className="border-t mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="flex justify-center items-center gap-x-2">
            Powered by <Logo className="inline-flex" titleClassName="inline" />
          </p>
        </div>
      </footer>

      <CartDrawer open={showCart} onOpenChange={setShowCart} />
    </div>
  );
}

// Memoized catalog content — only re-renders when data or expanded state changes
const CatalogContent = ({
  data,
  expandedCategories,
  onToggleCategory,
  vendor,
  onSetQty,
  onAddToCart,
  getQty,
  parentPath = "",
  level = 0,
}) => {
  const renderItems = (items, currentParentPath, currentLevel) => {
    const entries = Object.entries(items);
    return entries.map(([key, value], index) => {
      if (key.startsWith("__")) return null;
      const currentPath = appendPath(currentParentPath, key);
      const isExpanded = expandedCategories[currentPath];

      if (value.type === "category") {
        return (
          <div key={currentPath} className="mb-2">
            <Button
              onClick={() => onToggleCategory(currentPath)}
              className={`w-full justify-between ${
                currentLevel === 0
                  ? "text-xl font-bold"
                  : currentLevel === 1
                    ? "text-lg font-semibold"
                    : "text-base font-semibold"
              }`}
              variant="secondary"
            >
              <span>{key}</span>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>

            {isExpanded && value.children && (
              <div className="ml-1 mt-2 space-y-2 border-l-2 border-border pl-3">
                {renderItems(value.children, currentPath, currentLevel + 1)}
              </div>
            )}
          </div>
        );
      } else if (value.type === "item") {
        const retailSell =
          value.retailSell !== undefined ? value.retailSell : value.sell || 0;
        const sellUnit = value.sellUnit || "piece";

        // currentPath (built with appendPath — lib/utils/catalogPath.js)
        // uniquely identifies this item within the vendor's tree, so it doubles
        // as the cart line's key. The marketplace search builds its keys with
        // the same joinPath, so an item is one cart line no matter which page
        // it was added from.
        const cartItemKey = currentPath;
        const itemForCart = {
          key: cartItemKey,
          name: key,
          price: retailSell,
          unit: sellUnit,
        };
        const inCartQty =
          getQty && vendor ? getQty(vendor.businessId, cartItemKey) : 0;

        return (
          <div
            key={currentPath}
            className={`rounded-lg px-1 py-2.5 ${
              index === entries.length - 1 ? "" : "border-b"
            }`}
          >
            <div className="flex justify-between items-center gap-2">
              <span className="flex-1 min-w-0">{key}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold whitespace-nowrap">
                  ₹{retailSell}/{sellUnit}
                </span>
                {onSetQty && (
                  <QuantityStepper
                    qty={inCartQty}
                    unit={sellUnit}
                    onAdd={() => onSetQty(vendor, itemForCart, 1)}
                    onChange={(qty) => onSetQty(vendor, itemForCart, qty)}
                  />
                )}
              </div>
            </div>
            {onAddToCart && (
              <MaterialCalculator
                item={{ name: key, price: retailSell, unit: sellUnit }}
                onAddToCart={(qty) => onAddToCart(vendor, itemForCart, qty)}
              />
            )}
          </div>
        );
      }
      return null;
    });
  };

  return (
    <div className="space-y-2">
      {Object.keys(data).length > 0 ? (
        renderItems(data, parentPath, level)
      ) : (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No items found</p>
        </div>
      )}
    </div>
  );
};
