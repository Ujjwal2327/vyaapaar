"use client";

/**
 * hooks/useAllTransactions.js
 *
 * Every other read of the transactions table in this app goes through
 * hooks/useTransactions.js, which is deliberately scoped to one contact
 * (or the "unassigned" bucket) at a time — see NO_CONTACT there. That's
 * the right shape for a contact's own ledger page, but it means there is
 * no existing client-side dataset anywhere that already has the FULL
 * picture: sales/purchases trends, top items, and receivable/payable all
 * need to see every transaction, not just whichever contacts happen to
 * have been visited and cached locally on this device.
 *
 * So this hook adds the one new query the analytics page genuinely needs
 * — kept as light as it can be:
 *   - only the columns the charts actually use (no note, edit history, or
 *     linked-contact bookkeeping)
 *   - deleted transactions excluded server-side
 *   - paginated in batches of 1000, because PostgREST caps a single
 *     response at that many rows by default. A shop with a couple of
 *     years of daily sales can easily pass that, and silently dropping
 *     the older transactions from a reports page would be worse than the
 *     extra round trips.
 *
 * Read-only, so — unlike useTransactions.js — there's no offline write
 * queue involved here. It follows the same cache-then-fetch shape as
 * useBusinessProfile.js: serve whatever's cached in localStorage
 * instantly, then refresh from the server in the background when online.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

const LOCAL_KEY = "analyticsTransactionsCache";
const PAGE_SIZE = 1000;

const rowToTransaction = (row) => ({
  id: row.id,
  type: row.type,
  kind: row.kind,
  contactId: row.contact_id,
  itemsList: row.items_list ?? [],
  totalAmount: row.total_amount ?? 0,
  paidAmount: row.paid_amount ?? 0,
  paidAmountHistory: row.paid_amount_history ?? [],
  status: row.status ?? "pending",
  createdAt: row.created_at,
});

const fetchAllRows = async (userId) => {
  let rows = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, contact_id, type, kind, items_list, total_amount, paid_amount, paid_amount_history, status, created_at",
      )
      .eq("user_id", userId)
      .neq("status", "deleted")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    rows = rows.concat(data ?? []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
};

export const useAllTransactions = () => {
  const { user, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const hasFetched = useRef(false);
  const prevUserIdRef = useRef(null);

  const loadFromLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setTransactions(parsed.transactions ?? []);
      setLastSyncedAt(parsed.syncedAt ?? null);
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    const doLoad = async () => {
      const uid = user?.id ?? null;
      if (hasFetched.current && uid !== prevUserIdRef.current) {
        hasFetched.current = false;
        setTransactions([]);
        setLastSyncedAt(null);
      }
      prevUserIdRef.current = uid;

      if (hasFetched.current) {
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }
      if (authLoading) return;

      hasFetched.current = true;
      setIsDataLoading(true);

      // Step 1: serve from localStorage immediately, same as
      // usePriceList/usePeople/useBusinessProfile.
      loadFromLocal();
      setIsHydrated(true);

      if (!user || !navigator.onLine) {
        setIsDataLoading(false);
        return;
      }

      // Step 2: refresh from the server in the background.
      try {
        const rows = (await fetchAllRows(user.id)).map(rowToTransaction);
        const syncedAt = new Date().toISOString();
        setTransactions(rows);
        setLastSyncedAt(syncedAt);
        try {
          localStorage.setItem(
            LOCAL_KEY,
            JSON.stringify({ transactions: rows, syncedAt }),
          );
        } catch {
          // best-effort cache — a quota error here shouldn't break the page
        }
      } catch (err) {
        console.warn(
          "[useAllTransactions] fetch failed (offline?):",
          err.message,
        );
      } finally {
        setIsDataLoading(false);
      }
    };

    doLoad();

    const handleOnline = () => {
      hasFetched.current = false;
      doLoad();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user, authLoading, loadFromLocal]);

  return { transactions, isHydrated, isDataLoading, lastSyncedAt };
};
