"use client";

/**
 * hooks/usePriceList.js  — offline-first version
 *
 * Changes vs original:
 *  1. savePriceData writes to localStorage + React state FIRST (optimistic),
 *     then attempts the DB write.
 *  2. If offline (or the DB write fails with a network-type error), the
 *     operation is enqueued in offlineQueue instead of throwing.
 *  3. Load path: always tries to serve from localStorage immediately so the
 *     user sees data with zero delay, then hydrates from DB in the background.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { sortData, buildSearchIndex } from "@/lib/utils/priceListUtils";
import { enqueue, OP_TYPES } from "@/lib/offlineQueue";

// ─── helpers (unchanged from original) ───────────────────────────────────────

const deepAddOrderKeys = (data) => {
  if (!data || typeof data !== "object") return data;
  const newData = {};
  Object.entries(data).forEach(([key, node]) => {
    if (node && node.type === "category" && node.children) {
      const sortedChildren = deepAddOrderKeys(node.children);
      newData[key] = {
        ...node,
        children: sortedChildren,
        __orderKeys: Object.keys(sortedChildren),
      };
    } else {
      newData[key] = node;
    }
  });
  return newData;
};

/** Returns true for errors that are clearly network/offline related */
const isNetworkError = (err) => {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  );
};

// ─── hook ─────────────────────────────────────────────────────────────────────

export const usePriceList = () => {
  const { user, loading: authLoading } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [sellPriceMode, setSellPriceMode] = useState("retail");
  const [priceView, setPriceView] = useState("sell");
  const [editMode, setEditMode] = useState(false);

  const [priceData, setPriceData] = useState({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const hasFetchedDb = useRef(false);
  const prevUserIdRef = useRef(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchIndex = useMemo(() => buildSearchIndex(priceData), [priceData]);

  // Load sellPriceMode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("sellPriceMode");
    if (savedMode === "bulk" || savedMode === "retail")
      setSellPriceMode(savedMode);
  }, []);

  // ── initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      const currentUserId = user?.id ?? null;

      if (hasFetchedDb.current && currentUserId !== prevUserIdRef.current) {
        hasFetchedDb.current = false;
        setPriceData({});
      }
      prevUserIdRef.current = currentUserId;

      if (hasFetchedDb.current) {
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }
      if (authLoading) return;

      setIsDataLoading(true);
      hasFetchedDb.current = true;

      // ── Step 1: serve from localStorage immediately (zero-delay) ──────────
      const local = localStorage.getItem("priceListData");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setPriceData(parsed);
          setIsHydrated(true); // UI is usable right away
        } catch {}
      }

      if (!user) {
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }

      // Clear stale v1 localStorage format if migrating
      if (localStorage.getItem("contactsMigrated") !== "v2") {
        localStorage.removeItem("peopleData");
        localStorage.removeItem("peoplePhotos");
        localStorage.setItem("contactsMigrated", "v2");
      }

      // ── Step 2: background DB fetch ───────────────────────────────────────
      try {
        const { data, error } = await supabase
          .from("price_lists")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.data) {
          const sorted = sortData(data.data, "none");
          setPriceData(sorted);
          localStorage.setItem("priceListData", JSON.stringify(sorted));
        }
      } catch (err) {
        // Network offline — already showing localStorage data, that's fine
        console.warn("[usePriceList] DB fetch failed (offline?):", err.message);
      } finally {
        setIsDataLoading(false);
        setIsHydrated(true);
      }
    };

    loadData();
  }, [user, authLoading]);

  // Reset priceView if showCostProfit is toggled off
  useEffect(() => {
    const check = () => {
      if (
        localStorage.getItem("showCostProfit") !== "true" &&
        priceView !== "sell"
      ) {
        setPriceView("sell");
      }
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [priceView]);

  // ── savePriceData — offline-first ─────────────────────────────────────────
  const savePriceData = useCallback(
    async (newData) => {
      if (!user) throw new Error("NOT_AUTHENTICATED");

      const dataToSave = deepAddOrderKeys(newData);

      // 1. Write to localStorage + React state IMMEDIATELY (optimistic)
      localStorage.setItem("priceListData", JSON.stringify(dataToSave));
      setPriceData(dataToSave);

      // 2. Attempt DB write
      if (!navigator.onLine) {
        // Offline — enqueue and return silently
        enqueue(
          OP_TYPES.PRICE_LIST_SAVE,
          { data: dataToSave },
          dataToSave,
          user.id,
        );
        return;
      }

      try {
        const { error } = await supabase
          .from("price_lists")
          .upsert(
            { user_id: user.id, data: dataToSave },
            { onConflict: "user_id" },
          );
        if (error) throw error;
      } catch (err) {
        if (isNetworkError(err)) {
          // Network dropped mid-flight — enqueue for retry
          enqueue(
            OP_TYPES.PRICE_LIST_SAVE,
            { data: dataToSave },
            dataToSave,
            user.id,
          );
          return; // Don't throw — user already sees the change locally
        }
        // Real DB error (e.g. auth) — still don't roll back the local write
        // but do re-throw so the container can show an error toast
        throw err;
      }
    },
    [user],
  );

  // ── UI helpers (unchanged) ────────────────────────────────────────────────
  const toggleCategory = useCallback((path) => {
    setExpandedCategories((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const expandAll = useCallback((data) => {
    const allPaths = {};
    const collect = (obj, parent = "") => {
      Object.entries(obj).forEach(([key, value]) => {
        if (key.startsWith("__")) return;
        const p = parent ? `${parent}.${key}` : key;
        if (value.type === "category") {
          allPaths[p] = true;
          if (value.children) collect(value.children, p);
        }
      });
    };
    collect(data);
    setExpandedCategories(allPaths);
  }, []);

  const collapseAll = useCallback(() => setExpandedCategories({}), []);

  const toggleSellPriceMode = useCallback(() => {
    setSellPriceMode((prev) => {
      const next = prev === "retail" ? "bulk" : "retail";
      localStorage.setItem("sellPriceMode", next);
      return next;
    });
  }, []);

  const cyclePriceView = useCallback(() => {
    const showCostProfit = localStorage.getItem("showCostProfit") === "true";
    if (!showCostProfit) {
      setPriceView("sell");
      return;
    }
    setPriceView((prev) => {
      if (prev === "sell") return "cost";
      if (prev === "cost") return "profit";
      return "sell";
    });
  }, []);

  const getPriceViewText = useCallback(() => {
    if (priceView === "sell") return "Sell Price";
    if (priceView === "cost") return "Cost Price";
    if (priceView === "profit") return "Profit";
    return "Sell Price";
  }, [priceView]);

  return {
    priceData,
    savePriceData,
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    searchIndex,
    expandedCategories,
    toggleCategory,
    expandAll,
    collapseAll,
    sellPriceMode,
    toggleSellPriceMode,
    priceView,
    cyclePriceView,
    getPriceViewText,
    editMode,
    setEditMode,
    isHydrated,
    isDataLoading,
  };
};
