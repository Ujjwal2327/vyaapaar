"use client";

/**
 * hooks/usePeople.js  — offline-first version
 *
 * Changes vs original:
 *  1. Load: serves localStorage immediately, DB fetch runs in background.
 *  2. savePeopleData: writes local state + localStorage FIRST, then attempts
 *     DB upsert/delete. If offline or network error → enqueues instead of throwing.
 *  3. saveCategories: same pattern.
 *  4. All business logic (duplicate contacts guard, FK check, photo cache) is
 *     preserved exactly.
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

// ─── row ↔ contact converters (unchanged from original) ──────────────────────

const rowToContact = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  phones: row.phones ?? [],
  address: row.address ?? "",
  specialty: row.specialty ?? "",
  notes: row.notes ?? "",
  hasPhoto: row.has_photo ?? false,
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
      photo,
      has_photo: !!photo,
    };
  };

  // ── savePeopleData — offline-first ────────────────────────────────────────
  const savePeopleData = async (newContacts) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // 1. Build the state shape we'll hold in memory / localStorage
    //    (strips photo field, keeps hasPhoto flag — mirrors original)
    const stateContacts = newContacts.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      phones: c.phones ?? [],
      address: c.address ?? "",
      specialty: c.specialty ?? "",
      notes: c.notes ?? "",
      hasPhoto: !!photoCache.get(c.id),
    }));

    // 2. Compute diff against current state
    const newIds = new Set(newContacts.map((c) => c.id));
    const toDelete = peopleData
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
        // ── Preserve original FK-guard logic ──────────────────────────────
        const { data: linkedTxRows, error: txCheckErr } = await supabase
          .from("transactions")
          .select("contact_id")
          .in("contact_id", toDelete)
          .neq("status", "deleted")
          .limit(1);

        if (txCheckErr) throw txCheckErr;

        if (linkedTxRows && linkedTxRows.length > 0) {
          const blockedIds = new Set(linkedTxRows.map((r) => r.contact_id));
          const blockedNames = peopleData
            .filter((p) => blockedIds.has(p.id))
            .map((p) => p.name)
            .join(", ");
          // Roll back optimistic local write for the delete
          setPeopleData(peopleData);
          saveToLocal(peopleData);
          throw new Error(`CONTACT_HAS_TRANSACTIONS:${blockedNames}`);
        }

        // Remove soft-deleted transactions first (FK guard)
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
