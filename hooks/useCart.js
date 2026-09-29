"use client";

/**
 * hooks/useCart.js
 *
 * A lightweight, localStorage-backed cart for the public marketplace pages
 * — (public)/marketplace and (public)/business/[name]. This is a
 * pre-purchase "build a list, then message the vendor" cart, not a
 * transaction, so it's deliberately NOT wired into Supabase, RLS, or the
 * offline sync queue in lib/offlineQueue.js. It follows that same file's
 * localStorage + window-event pattern instead, so every component calling
 * useCart() anywhere on the page stays in sync without a React Context
 * provider having to wrap the app.
 *
 * Cart shape (localStorage key "marketplaceCart"):
 * {
 *   [businessId]: {
 *     businessId, businessName, businessPhone, businessAddress,
 *     items: [{ key, name, price, unit, qty }],
 *     updatedAt,
 *   },
 *   ...
 * }
 *
 * `key` is the item's catalog path in the one format both public pages use
 * (lib/utils/catalogPath.js): the business page passes its own render path,
 * the marketplace search passes flattenPriceTree's key, and they are the same
 * string. Carts saved before that was true — business-page keys joined with
 * "." and marketplace keys joined with " › " — are upgraded by
 * lib/utils/cartKeys.js every time the cart is read, and reconcileVendorCart
 * below finishes the job for names the old "." join made ambiguous.
 */

import { useState, useEffect, useCallback } from "react";
import {
  normalizeCart,
  buildLegacyCartKeyMap,
  remapCartLineKeys,
} from "@/lib/utils/cartKeys";

const CART_KEY = "marketplaceCart";
const CART_EVENT = "marketplaceCartChanged";

const readRawCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Every read goes through normalizeCart, so a cart saved under either of the
// older key formats is upgraded the moment anything looks at it — including
// one written by another tab that is still running the old code.
const readCart = () => normalizeCart(readRawCart()).cart;

const writeCart = (cart) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event(CART_EVENT));
  } catch {
    // Storage can fail (quota, private browsing) — the in-memory state
    // from the calling component still updates via its own setState, the
    // cart just won't survive a refresh. Not worth surfacing as an error.
  }
};

export const useCart = () => {
  const [cart, setCart] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Persist the upgrade once, so storage itself moves to the shared key
    // format instead of being re-translated on every read from now on.
    const { cart: upgraded, changed } = normalizeCart(readRawCart());
    if (changed) writeCart(upgraded);
    setCart(upgraded);
    setHydrated(true);
    const handler = () => setCart(readCart());
    window.addEventListener(CART_EVENT, handler);
    window.addEventListener("storage", handler); // keep tabs in sync too
    return () => {
      window.removeEventListener(CART_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Every mutator re-reads localStorage right before writing, rather than
  // trusting the `cart` value from React state — same defensive shape as
  // the phone-array bug fix in EditPersonModal.jsx, for the same reason:
  // two adds in quick succession (e.g. two "Add to cart" clicks) shouldn't
  // be able to race against a stale closure.

  const addItem = useCallback((vendor, item) => {
    const next = readCart();
    const businessId = vendor.businessId;
    const existing = next[businessId] ?? {
      businessId,
      businessName: vendor.businessName,
      businessPhone: vendor.businessPhone ?? "",
      businessAddress: vendor.businessAddress ?? "",
      items: [],
    };

    const idx = existing.items.findIndex((it) => it.key === item.key);
    const qtyToAdd = item.qty ?? 1;
    const items =
      idx === -1
        ? [...existing.items, { ...item, qty: qtyToAdd }]
        : existing.items.map((it, i) =>
            i === idx ? { ...it, qty: it.qty + qtyToAdd } : it,
          );

    next[businessId] = {
      ...existing,
      items,
      updatedAt: new Date().toISOString(),
    };
    writeCart(next);
  }, []);

  // setItemQty is an upsert: sets a line to an ABSOLUTE quantity, creating
  // the vendor entry and the line itself if neither exists yet, and
  // removing the line (or the whole vendor entry, if it was the last line)
  // once qty drops to 0. This is what the inline catalog stepper uses —
  // typing "50" or tapping - once both just mean "the number should now be
  // X", not "add one more" — and the cart dialog's own -/+/delete controls
  // use it too, so there's one source of truth for "set quantity" instead
  // of two similar-but-different functions.
  //
  // addItem() above stays separate on purpose: it's genuinely additive
  // ("add N more on top of whatever's already there"), which is what the
  // Material Calculator's "add computed quantity" button means — someone
  // may have already put a few of an item in the cart from browsing, then
  // used the calculator to work out they need some more for a specific
  // run, and adding should top up rather than overwrite.
  const setItemQty = useCallback((vendor, item, qty) => {
    const next = readCart();
    const businessId = vendor.businessId;
    const existing = next[businessId] ?? {
      businessId,
      businessName: vendor.businessName,
      businessPhone: vendor.businessPhone ?? "",
      businessAddress: vendor.businessAddress ?? "",
      items: [],
    };

    const idx = existing.items.findIndex((it) => it.key === item.key);

    if (qty <= 0) {
      const items = existing.items.filter((it) => it.key !== item.key);
      if (items.length === 0) delete next[businessId];
      else
        next[businessId] = {
          ...existing,
          items,
          updatedAt: new Date().toISOString(),
        };
    } else {
      const items =
        idx === -1
          ? [
              ...existing.items,
              {
                key: item.key,
                name: item.name,
                price: item.price,
                unit: item.unit,
                qty,
              },
            ]
          : existing.items.map((it, i) => (i === idx ? { ...it, qty } : it));
      next[businessId] = {
        ...existing,
        items,
        updatedAt: new Date().toISOString(),
      };
    }
    writeCart(next);
  }, []);

  const clearVendorCart = useCallback((businessId) => {
    const next = readCart();
    delete next[businessId];
    writeCart(next);
  }, []);

  // Finishes upgrading one vendor's saved lines once that vendor's catalog is
  // in hand. normalizeCart (above) already covers marketplace-style keys and
  // business-page keys for names without a ".", but an old business-page key
  // like 'Pipe.CPVC.1".Appolo Sdr 13.5' cannot be decoded on its own — only the
  // catalog says whether that dot is a separator or part of a name. Both
  // public pages call this as soon as their catalog has loaded.
  const reconcileVendorCart = useCallback((businessId, catalogTree) => {
    const next = readCart();
    const vendorCart = next[businessId];
    if (!vendorCart?.items?.length) return;

    const legacyKeys = buildLegacyCartKeyMap(catalogTree);
    if (legacyKeys.size === 0) return;

    const { items, changed } = remapCartLineKeys(vendorCart.items, legacyKeys);
    if (!changed) return;

    next[businessId] = { ...vendorCart, items };
    writeCart(next);
  }, []);

  // Live lookup for "is this item already in the cart, and how much" — so
  // a catalog row can show its own quantity without the customer having to
  // open the cart to check. Reads straight off the current `cart` state
  // (not localStorage directly), so it's reactive: it updates on every
  // render after any mutator runs, same as any other derived value here.
  const getQty = useCallback(
    (businessId, itemKey) =>
      cart[businessId]?.items.find((it) => it.key === itemKey)?.qty ?? 0,
    [cart],
  );

  const vendors = Object.values(cart);
  // Distinct line items across the whole cart — 1 item at qty 6 counts as
  // 1, not 6. This badge answers "how many different things are in my
  // cart", not "how many units total"; per-item quantity is shown right
  // on each catalog row via QuantityStepper instead.
  const distinctItemCount = vendors.reduce((sum, v) => sum + v.items.length, 0);

  return {
    cart,
    vendors,
    hydrated,
    distinctItemCount,
    addItem,
    setItemQty,
    clearVendorCart,
    reconcileVendorCart,
    getQty,
  };
};

/**
 * The one line every enquiry ends with, regardless of which path sends
 * it (plain text, or an image + short caption). Exported so cartShare.js
 * can reuse the exact same wording for the image caption instead of
 * keeping its own separate copy that could quietly drift out of sync.
 */
export const CONFIRM_AVAILABILITY_LINE =
  "Please confirm availability and best price. Thank you!";

/**
 * Builds a wa.me deep link pre-filled with an itemised enquiry for one
 * vendor's cart. This IS the "checkout" — there's no payment step. The
 * customer and vendor take it from there on WhatsApp: confirm stock,
 * negotiate price, arrange delivery — same as walking in or calling, just
 * with the list already written out for them.
 */
export const buildWhatsAppInquiryLink = (vendorCart) => {
  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n ?? 0);

  const lines = [
    `Hi ${vendorCart.businessName}, I'd like to enquire about:`,
    "",
    ...vendorCart.items.map((it, i) => {
      const qtyPart = `${it.qty}${it.unit ? ` ${it.unit}` : ""}`;
      const pricePart = it.price
        ? ` (₹${fmt(it.price)}/${it.unit || "unit"})`
        : "";
      return `${i + 1}. ${it.name} — Qty: ${qtyPart}${pricePart}`;
    }),
  ];

  const estimatedTotal = vendorCart.items.reduce(
    (sum, it) => sum + (parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0),
    0,
  );
  if (estimatedTotal > 0) {
    lines.push("", `Estimated total: ₹${fmt(estimatedTotal)}`);
  }
  lines.push("", CONFIRM_AVAILABILITY_LINE);

  const message = encodeURIComponent(lines.join("\n"));
  const digitsOnly = (vendorCart.businessPhone || "").replace(/\D/g, "");
  const phone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

  return `https://wa.me/${phone}?text=${message}`;
};
