"use client";

/**
 * hooks/usePeople.js  — offline-first version (v3)
 *
 * v3 adds contacts.net_amount: a cached receivable-minus-payable figure
 * per contact (used by the Contacts page's balance filter/sort — see
 * components/people/PeopleContainer.jsx), plus createdAt so contacts can
 * be sorted oldest/newest. Neither is edited from here — they're kept in
 * sync by hooks/useTransactions.js (recomputeContactNetAmounts) and
 * hooks/useSyncManager.js whenever a contact's transactions change; this
 * file just needs to read them off the row and — critically — never
 * silently drop them on an ordinary contact edit (rename, phone change,
 * etc). See contactToRow and savePeopleData's stateContacts mapping below.
 *
 * v2 fix carried over: the FK-guard rollback used `peopleData` captured
 * by the closure at call time. If another save completed between the
 * optimistic write and the async DB check, the rollback restored a stale
 * snapshot. Fixed by keeping a ref (`peopleDataRef`) that always points
 * to the latest state value, so the rollback always restores whatever is
 * current at the moment it fires.
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { photoCache } from "@/lib/utils/photoCache";
import { enqueue, OP_TYPES } from "@/lib/offlineQueue";

const DEFAULT_CATEGORIES = [
  { id: "customer", label: "Customer", isDefault: true },
  { id: "supplier", label: "Supplier", isDefault: true },
  { id: "helper", label: "Helper", isDefault: true },
  { id: "other", label: "Other", isDefault: true },
];

// Fired whenever something OUTSIDE this hook's own savePeopleData patches
// the peopleData localStorage cache directly — currently just the
// net_amount updates in hooks/useTransactions.js and
// hooks/useSyncManager.js, which run from whichever contact's
// transactions page (or sync cycle) is active, not from a
// usePeople()-holding component. Same same-tab-event +
// cross-tab-storage-event pattern hooks/usePriceList.js already uses for
// its own cross-instance sync.
export const PEOPLE_DATA_UPDATED_EVENT = "peopleDataChanged";

/**
 * Patches just one contact's cached net_amount in the peopleData
 * localStorage cache (leaving every other field, and every other
 * contact, untouched), and notifies any mounted usePeople() instances to
 * pick it up. Exported so hooks/useTransactions.js and
 * hooks/useSyncManager.js — neither of which otherwise touches contact
 * data — can keep this one cached figure current without reaching into
 * usePeople's own internals.
 */
export const patchContactNetAmountInCache = (contactId, netAmount) => {
  try {
    const raw = localStorage.getItem("peopleData");
    if (!raw) return;
    const list = JSON.parse(raw);
    const next = list.map((p) =>
      p.id === contactId ? { ...p, netAmount } : p,
    );
    localStorage.setItem("peopleData", JSON.stringify(next));
    window.dispatchEvent(new Event(PEOPLE_DATA_UPDATED_EVENT));
  } catch {
    // best-effort cache, same as everywhere else in this app
  }
};

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

// ─── row ↔ contact converters ─────────────────────────────────────────────────

const rowToContact = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  phones: row.phones ?? [],
  address: row.address ?? "",
  specialty: row.specialty ?? "",
  notes: row.notes ?? "",
  upiId: row.upi_id ?? "",
  hasPhoto: row.has_photo ?? false,
  netAmount: row.net_amount ?? 0,
  createdAt: row.created_at ?? null,
});

// ─── hook ─────────────────────────────────────────────────────────────────────

export const usePeople = () => {
  const { user, loading: authLoading } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [peopleData, setPeopleData] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const hasFetchedDb = useRef(false);
  const prevUserIdRef = useRef(null);

  // FIX #4: Always-current ref to peopleData so async callbacks (FK rollback)
  // never use a stale closure value.
  const peopleDataRef = useRef(peopleData);
  useEffect(() => {
    peopleDataRef.current = peopleData;
  }, [peopleData]);

  // Cross-instance sync: pick up peopleData writes made by code that
  // isn't this hook's own savePeopleData — currently just the net_amount
  // patches from hooks/useTransactions.js and hooks/useSyncManager.js.
  // The custom event covers same-tab writes (the native "storage" event
  // never fires in the tab that made the change); the "storage" listener
  // covers other tabs/devices sharing this browser profile.
  useEffect(() => {
    const refreshFromLocalCache = () => {
      try {
        const raw = localStorage.getItem("peopleData");
        if (raw) setPeopleData(JSON.parse(raw));
      } catch {}
    };
    const handleStorage = (e) => {
      if (e.key === "peopleData") refreshFromLocalCache();
    };
    window.addEventListener(PEOPLE_DATA_UPDATED_EVENT, refreshFromLocalCache);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(
        PEOPLE_DATA_UPDATED_EVENT,
        refreshFromLocalCache,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // ── localStorage helpers ─────────────────────────────────────────────────
  const loadFromLocal = () => {
    try {
      const raw = localStorage.getItem("peopleData");
      if (raw) setPeopleData(JSON.parse(raw));
    } catch {
      setPeopleData([]);
    }

    try {
      const raw = localStorage.getItem("peopleCategories");
      setCategories(raw ? JSON.parse(raw) : DEFAULT_CATEGORIES);
    } catch {
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const saveToLocal = (contacts, cats) => {
    localStorage.setItem("peopleData", JSON.stringify(contacts));
    if (cats) localStorage.setItem("peopleCategories", JSON.stringify(cats));
  };

  // ── initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      const currentUserId = user?.id ?? null;

      if (hasFetchedDb.current && currentUserId !== prevUserIdRef.current) {
        hasFetchedDb.current = false;
        setPeopleData([]);
        setCategories(DEFAULT_CATEGORIES);
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

      // Step 1: serve from localStorage immediately
      loadFromLocal();
      setIsHydrated(true);

      if (!user) {
        setIsDataLoading(false);
        return;
      }

      // Clear stale v1 format
      if (localStorage.getItem("contactsMigrated") !== "v2") {
        localStorage.removeItem("peopleData");
        localStorage.removeItem("peoplePhotos");
        localStorage.setItem("contactsMigrated", "v2");
        setPeopleData([]);
      }

      // Step 2: background DB fetch
      try {
        const { data: rows, error: contactsError } = await supabase
          .from("contacts")
          .select("*")
          .eq("user_id", user.id)
          .order("name");

        if (contactsError) throw contactsError;

        const contacts = (rows ?? []).map(rowToContact);
        rows?.forEach((r) => {
          if (r.photo) photoCache.set(r.id, r.photo);
        });

        setPeopleData(contacts);
        saveToLocal(contacts);

        const { data: peopleRow, error: catError } = await supabase
          .from("people")
          .select("categories")
          .eq("user_id", user.id)
          .maybeSingle();

        if (catError) throw catError;

        const cats = peopleRow?.categories ?? DEFAULT_CATEGORIES;
        setCategories(cats);
        localStorage.setItem("peopleCategories", JSON.stringify(cats));
      } catch (err) {
        console.warn("[usePeople] DB fetch failed (offline?):", err.message);
        // Already showing localStorage data — that's fine
      } finally {
        setIsDataLoading(false);
      }
    };

    loadData();
  }, [user, authLoading]);

  // ── contactToRow helper (needs user in scope) ────────────────────────────
  const contactToRow = (contact) => {
    const photo = photoCache.get(contact.id) || null;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const id = uuidRegex.test(contact.id) ? contact.id : crypto.randomUUID();
    return {
      id,
      user_id: user.id,
      name: contact.name,
      category: contact.category,
      phones: contact.phones ?? [],
      address: contact.address ?? "",
      specialty: contact.specialty ?? "",
      notes: contact.notes ?? "",
      upi_id: contact.upiId?.trim() || "",
      photo,
      has_photo: !!photo,
      // Never DERIVED here — this only ever carries forward whatever
      // net_amount the in-memory contact object already has (itself
      // sourced from the DB via rowToContact, or defaulted to 0 for a
      // brand-new contact). An ordinary rename/phone-change save must
      // never reset a contact's cached balance to 0 just because the
      // edit flow that built this object doesn't know or care about
      // balances — see savePeopleData's stateContacts mapping below for
      // the other half of that guarantee.
      net_amount: contact.netAmount ?? 0,
    };
  };

  // ── savePeopleData — offline-first ────────────────────────────────────────
  const savePeopleData = async (newContacts) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // 1. Build the state shape we'll hold in memory / localStorage
    const stateContacts = newContacts.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      phones: c.phones ?? [],
      address: c.address ?? "",
      specialty: c.specialty ?? "",
      notes: c.notes ?? "",
      upiId: c.upiId?.trim() || "",
      hasPhoto: !!photoCache.get(c.id),
      netAmount: c.netAmount ?? 0,
      createdAt: c.createdAt ?? null,
    }));

    // 2. Compute diff against current state
    const newIds = new Set(newContacts.map((c) => c.id));
    const toDelete = peopleDataRef.current
      .filter((p) => !newIds.has(p.id))
      .map((p) => p.id);
    const rows = newContacts.map((c) => contactToRow(c));

    // 3. Optimistic local write — UI updates instantly
    setPeopleData(stateContacts);
    saveToLocal(stateContacts);

    // 4. If offline, enqueue and return
    if (!navigator.onLine) {
      if (rows.length > 0) {
        enqueue(OP_TYPES.CONTACTS_UPSERT, { rows }, stateContacts, user.id);
      }
      if (toDelete.length > 0) {
        enqueue(
          OP_TYPES.CONTACTS_DELETE,
          { ids: toDelete },
          stateContacts,
          user.id,
        );
      }
      return;
    }

    // 5. Attempt DB write
    try {
      if (rows.length > 0) {
        const { error } = await supabase
          .from("contacts")
          .upsert(rows, { onConflict: "id" });
        if (error) throw error;
      }

      if (toDelete.length > 0) {
        // ── FK guard: block delete if live transactions exist ─────────────
        const { data: linkedTxRows, error: txCheckErr } = await supabase
          .from("transactions")
          .select("contact_id")
          .in("contact_id", toDelete)
          .neq("status", "deleted")
          .limit(1);

        if (txCheckErr) throw txCheckErr;

        if (linkedTxRows && linkedTxRows.length > 0) {
          const blockedIds = new Set(linkedTxRows.map((r) => r.contact_id));
          // FIX #4: Use the ref (always current) instead of the closure value
          // (`peopleData`) which may be stale if another save completed while
          // we were awaiting the DB check above.
          const currentPeopleData = peopleDataRef.current;
          const blockedNames = currentPeopleData
            .filter((p) => blockedIds.has(p.id))
            .map((p) => p.name)
            .join(", ");
          // Roll back to whatever the current state is (not the pre-call snapshot)
          setPeopleData(currentPeopleData);
          saveToLocal(currentPeopleData);
          throw new Error(`CONTACT_HAS_TRANSACTIONS:${blockedNames}`);
        }

        // Remove soft-deleted transactions first (FK cleanup)
        const { error: txDeleteErr } = await supabase
          .from("transactions")
          .delete()
          .in("contact_id", toDelete)
          .eq("status", "deleted");
        if (txDeleteErr) throw txDeleteErr;

        const { error: deleteErr } = await supabase
          .from("contacts")
          .delete()
          .in("id", toDelete)
          .eq("user_id", user.id);
        if (deleteErr) throw deleteErr;
      }
    } catch (err) {
      if (isNetworkError(err)) {
        // Network dropped — enqueue, keep local write as-is
        if (rows.length > 0) {
          enqueue(OP_TYPES.CONTACTS_UPSERT, { rows }, stateContacts, user.id);
        }
        if (toDelete.length > 0) {
          enqueue(
            OP_TYPES.CONTACTS_DELETE,
            { ids: toDelete },
            stateContacts,
            user.id,
          );
        }
        return;
      }
      throw err; // Real error (FK violation etc.) — bubble up
    }
  };

  // ── saveCategories — offline-first ────────────────────────────────────────
  const saveCategories = async (newCategories) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // Optimistic local write
    setCategories(newCategories);
    localStorage.setItem("peopleCategories", JSON.stringify(newCategories));

    if (!navigator.onLine) {
      enqueue(
        OP_TYPES.CATEGORIES_SAVE,
        { categories: newCategories },
        newCategories,
        user.id,
      );
      return;
    }

    try {
      const { error } = await supabase
        .from("people")
        .upsert(
          { user_id: user.id, categories: newCategories },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(
          OP_TYPES.CATEGORIES_SAVE,
          { categories: newCategories },
          newCategories,
          user.id,
        );
        return;
      }
      throw err;
    }
  };

  return {
    peopleData,
    savePeopleData,
    categories,
    saveCategories,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    editMode,
    setEditMode,
    isHydrated,
    isDataLoading,
  };
};
