"use client";

/**
 * hooks/useAnalytics.js
 *
 * Composition hook for the /analytics page: wires together the one new
 * data source it needs (useAllTransactions) with the catalog data that
 * already exists (usePriceList — the same hook the catalog page and both
 * transaction modals already call, each getting their own independent
 * fetch, so this is one more instance of an existing pattern rather than
 * a new one). Keeps the day/week/month toggle, and memoizes every derived
 * chart shape so switching granularity doesn't recompute anything that
 * didn't actually change.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { usePriceList } from "@/hooks/usePriceList";
import {
  buildPeriods,
  bucketSalesAndPurchases,
  computeTopItems,
  flattenCatalogForCosting,
  computeProfitMarginTrend,
  computeReceivablePayableTrend,
  computeCurrentSummary,
} from "@/lib/utils/analyticsUtils";
import { hasAnyRecordedCost } from "@/lib/utils/costSnapshot";

const GRANULARITY_KEY = "analyticsGranularity";

export const useAnalytics = () => {
  const {
    transactions,
    isHydrated: txHydrated,
    isDataLoading: txLoading,
    lastSyncedAt,
  } = useAllTransactions();

  const {
    priceData,
    isHydrated: priceHydrated,
    isDataLoading: priceLoading,
  } = usePriceList();

  const [granularity, setGranularityRaw] = useState("day");

  // Read the saved granularity once on mount — same "read localStorage in
  // an effect" shape as sortType in PriceListContainer/PeopleContainer,
  // rather than reading it during initial render (which would mismatch
  // between server and client render on first paint).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GRANULARITY_KEY);
      if (saved === "day" || saved === "week" || saved === "month") {
        setGranularityRaw(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const setGranularity = useCallback((value) => {
    setGranularityRaw(value);
    try {
      localStorage.setItem(GRANULARITY_KEY, value);
    } catch {
      // ignore storage errors, same as everywhere else in this app
    }
  }, []);

  const periods = useMemo(() => buildPeriods(granularity), [granularity]);

  const salesPurchases = useMemo(
    () => bucketSalesAndPurchases(transactions, periods),
    [transactions, periods],
  );

  const topItems = useMemo(() => computeTopItems(transactions), [transactions]);

  const catalogIndex = useMemo(
    () => flattenCatalogForCosting(priceData),
    [priceData],
  );

  const profitMarginTrend = useMemo(
    () => computeProfitMarginTrend(transactions, periods, catalogIndex),
    [transactions, periods, catalogIndex],
  );

  const receivablePayableTrend = useMemo(
    () => computeReceivablePayableTrend(transactions, periods),
    [transactions, periods],
  );

  const currentSummary = useMemo(
    () => computeCurrentSummary(transactions),
    [transactions],
  );

  // A cost price on a catalog item, or one recorded on a past sale (which
  // survives the item being deleted or its cost cleared since).
  const hasAnyCostData = useMemo(
    () =>
      Array.from(catalogIndex.values()).some((item) => (item.cost ?? 0) > 0) ||
      hasAnyRecordedCost(transactions),
    [catalogIndex, transactions],
  );

  return {
    granularity,
    setGranularity,
    salesPurchases,
    topItems,
    profitMarginTrend,
    receivablePayableTrend,
    currentSummary,
    hasAnyCostData,
    transactionCount: transactions.length,
    lastSyncedAt,
    isHydrated: txHydrated && priceHydrated,
    isDataLoading: txLoading || priceLoading,
  };
};
