"use client";

/**
 * app/(public)/marketplace/page.jsx
 *
 * Directory of every business that has opted in to marketplace listing,
 * plus a search box that looks across ALL of their catalogs at once —
 * unlike /business/[name], which only ever searches one shop.
 *
 * No login required, same as the existing single-business public page.
 * A vendor only shows up here if users.marketplace_opt_in = true, so
 * nobody's shop is pulled into a public directory they didn't ask to join
 * just because they once shared their /business/[name] link with a
 * customer. See docs/marketplace-schema.sql for the one-column migration
 * this page depends on, and UserProfile.jsx is the natural place to add
 * the toggle that flips it on.
 */

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import Logo from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MapPin,
  Phone,
  Store,
  Package,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { searchAcrossVendors } from "@/lib/utils/marketplaceUtils";
import { countItemsAndCategories } from "@/lib/utils/priceListStats";
import { MaterialCalculator } from "@/components/marketplace/MaterialCalculator";
import { QuantityStepper } from "@/components/marketplace/QuantityStepper";
import {
  CartDrawer,
  CartTriggerButton,
} from "@/components/marketplace/CartDrawer";
import { useCart } from "@/hooks/useCart";

export default function MarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [showCart, setShowCart] = useState(false);

  const { addItem, setItemQty, getQty, cart } = useCart();

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, business_name, business_address, phone, email")
        .eq("marketplace_opt_in", true)
        .not("business_name", "is", null);

      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        setVendors([]);
        return;
      }

      const ids = users.map((u) => u.id);
      const { data: priceLists, error: priceError } = await supabase
        .from("price_lists")
        .select("user_id, data")
        .in("user_id", ids);

      if (priceError) throw priceError;

      const priceByUser = Object.fromEntries(
        (priceLists ?? []).map((p) => [p.user_id, p.data ?? {}]),
      );

      setVendors(
        users.map((u) => ({
          id: u.id,
          businessName: u.business_name,
          businessAddress: u.business_address,
          phone: u.phone,
          priceData: priceByUser[u.id] ?? {},
        })),
      );
    } catch (error) {
      console.error("Error loading marketplace vendors:", error);
      toast.error("Couldn't load the marketplace", {
        description: "Check your connection and try again.",
      });
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const searchResults = useMemo(
    () =>
      debouncedSearchTerm.trim()
        ? searchAcrossVendors(
            vendors.map((v) => ({
              businessId: v.id,
              businessName: v.businessName,
              businessAddress: v.businessAddress,
              businessPhone: v.phone,
              priceData: v.priceData,
            })),
            debouncedSearchTerm,
          )
        : [],
    [vendors, debouncedSearchTerm],
  );

  const isSearching = debouncedSearchTerm.trim().length > 0;
  const resultVendorCount = useMemo(
    () => new Set(searchResults.map((r) => r.vendor.businessId)).size,
    [searchResults],
  );

  // The calculator is still additive ("add N more on top of whatever's
  // already there") — see hooks/useCart.js for why that's kept separate
  // from the plain stepper, which sets an absolute quantity instead.
  const handleAddFromCalculator = (vendorMeta, item, qty) => {
    addItem(vendorMeta, {
      key: item.key,
      name: item.name,
      price: item.retailSell,
      unit: item.sellUnit,
      qty,
    });
    toast.success(`Added ${qty} ${item.sellUnit} of ${item.name}`, {
      description: vendorMeta.businessName,
    });
  };

  if (loading) return <Loader content="Loading marketplace..." />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-5xl mx-auto p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Logo />
            <CartTriggerButton onClick={() => setShowCart(true)} />
          </div>

          <div>
            <h1 className="text-2xl font-bold">Marketplace</h1>
            <p className="text-sm text-muted-foreground">
              Search materials across every listed vendor, or browse a shop
              directly
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search products across all vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {isSearching ? (
          searchResults.length === 0 ? (
            <div className="bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">
                No products matching "{debouncedSearchTerm}"
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {searchResults.length} result
                {searchResults.length !== 1 ? "s" : ""} across{" "}
                {resultVendorCount} vendor
                {resultVendorCount !== 1 ? "s" : ""}
              </p>
              {searchResults.map((result) => {
                const itemForCart = {
                  key: result.key,
                  name: result.name,
                  price: result.retailSell,
                  unit: result.sellUnit,
                };
                const inCartQty = getQty(result.vendor.businessId, result.key);
                return (
                  <div
                    key={`${result.vendor.businessId}-${result.key}`}
                    className="bg-card rounded-xl border p-3"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold">{result.name}</p>
                        <Link
                          href={`/business/${encodeURIComponent(result.vendor.businessName)}`}
                          className="text-sm text-muted-foreground relative pl-4 block hover:text-primary transition-colors"
                        >
                          <Store className="w-3 h-3 absolute left-0 top-0.5" />
                          {result.vendor.businessName}
                        </Link>
                        {inCartQty > 0 && (
                          <p className="text-sm text-primary font-medium mt-1 flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3 shrink-0" />
                            {inCartQty} {result.sellUnit} in cart
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1.5">
                        <p className="font-bold whitespace-nowrap">
                          ₹{result.retailSell}/{result.sellUnit}
                        </p>
                        <QuantityStepper
                          qty={inCartQty}
                          unit={result.sellUnit}
                          onAdd={() =>
                            setItemQty(result.vendor, itemForCart, 1)
                          }
                          onChange={(qty) =>
                            setItemQty(result.vendor, itemForCart, qty)
                          }
                        />
                      </div>
                    </div>
                    <MaterialCalculator
                      item={{
                        name: result.name,
                        price: result.retailSell,
                        unit: result.sellUnit,
                      }}
                      onAddToCart={(qty) =>
                        handleAddFromCalculator(result.vendor, result, qty)
                      }
                    />
                  </div>
                );
              })}
            </div>
          )
        ) : vendors.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center space-y-2">
            <Store className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              No vendors are listed in the marketplace yet.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {vendors.map((v) => {
              const { itemCount } = countItemsAndCategories(v.priceData);
              const vendorCartCount = cart[v.id]?.items.length ?? 0;
              return (
                <Link
                  key={v.id}
                  href={`/business/${encodeURIComponent(v.businessName)}`}
                  className="bg-card rounded-xl border p-4 hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{v.businessName}</p>
                      {v.businessAddress && (
                        <p className="text-sm text-muted-foreground relative pl-4 mt-0.5">
                          <MapPin className="w-3 h-3 absolute left-0 top-0.5" />
                          {v.businessAddress}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <Badge variant="secondary" className="text-sm gap-1">
                          <Package className="w-3 h-3" />
                          {itemCount} items
                        </Badge>
                        {v.phone && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {v.phone}
                          </span>
                        )}
                        {vendorCartCount > 0 && (
                          <Badge className="text-sm gap-1 bg-primary/10 text-primary border-0">
                            <ShoppingCart className="w-3 h-3" />
                            {vendorCartCount} in cart
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <CartDrawer open={showCart} onOpenChange={setShowCart} />
    </div>
  );
}
