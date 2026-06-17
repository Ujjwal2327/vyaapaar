import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { photoCache } from "@/lib/utils/photoCache";

const DEFAULT_CATEGORIES = [
  { id: "customer", label: "Customer", isDefault: true },
  { id: "supplier", label: "Supplier", isDefault: true },
  { id: "helper", label: "Helper", isDefault: true },
  { id: "other", label: "Other", isDefault: true },
];

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
  // Track the last user ID so we can detect account switches within the same
  // tab session and force a fresh DB fetch for the new user.
  const prevUserIdRef = useRef(null);

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Convert a DB row into the contact shape the UI expects */
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

  /** Convert a UI contact into a DB row payload */
  const contactToRow = (contact) => {
    const photo = photoCache.get(contact.id) || null;

    // If id is not a valid UUID, generate a new one
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
      photo: photo,
      has_photo: !!photo,
    };
  };

  // ── localStorage helpers ───────────────────────────────────────────────────

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

  // ── initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    const loadData = async () => {
      const currentUserId = user?.id ?? null;

      // If the user changed since the last fetch (e.g. account switch in same
      // tab), reset the guard so we fetch fresh data for the new user instead
      // of serving the previous user's stale localStorage cache.
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

      if (!user) {
        loadFromLocal();
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }

      // Clear stale localStorage from old JSON-blob schema
      if (localStorage.getItem("contactsMigrated") !== "v2") {
        localStorage.removeItem("peopleData");
        localStorage.removeItem("peoplePhotos");
        localStorage.setItem("contactsMigrated", "v2");
      }

      try {
        // Load contacts from new table
        const { data: rows, error: contactsError } = await supabase
          .from("contacts")
          .select("*")
          .eq("user_id", user.id)
          .order("name");

        if (contactsError) throw contactsError;

        const contacts = (rows ?? []).map(rowToContact);

        // Cache any photos that came back from DB
        rows?.forEach((r) => {
          if (r.photo) photoCache.set(r.id, r.photo);
        });

        setPeopleData(contacts);
        saveToLocal(contacts);

        // Categories still live in public.people
        const { data: peopleRow, error: catError } = await supabase
          .from("people")
          .select("categories")
          .eq("user_id", user.id)
          .maybeSingle();

        if (catError) throw catError;

        const cats = peopleRow?.categories ?? DEFAULT_CATEGORIES;
        setCategories(cats);
        localStorage.setItem("peopleCategories", JSON.stringify(cats));
      } catch (error) {
        console.error("DB Load Error:", error);
        loadFromLocal();
      } finally {
        setIsDataLoading(false);
        setIsHydrated(true);
      }
    };

    loadData();
  }, [user, authLoading]);

  // ── savePeopleData ─────────────────────────────────────────────────────────
  // Receives the full intended contacts array.
  // Diffs against current state → upserts new/changed rows, deletes removed ones.

  const savePeopleData = async (newContacts) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const newIds = new Set(newContacts.map((c) => c.id));
    const toDelete = peopleData
      .filter((p) => !newIds.has(p.id))
      .map((p) => p.id);
    const rows = newContacts.map(contactToRow);

    try {
      if (rows.length > 0) {
        const { error } = await supabase
          .from("contacts")
          .upsert(rows, { onConflict: "id" });
        if (error) throw error;
      }

      if (toDelete.length > 0) {
        // Block deletion if any active (non-soft-deleted) transactions exist.
        // The transactions table has a FK to contacts with no ON DELETE CASCADE,
        // so we surface a clear, user-friendly error instead of a raw DB error.
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
          throw new Error(`CONTACT_HAS_TRANSACTIONS:${blockedNames}`);
        }

        // BUG FIX: Soft-deleted transactions still hold a FK reference to the
        // contact row. The active-transaction check above only excludes them,
        // so a subsequent DELETE would hit a FK violation from the DB.
        // Since soft-deleted transactions are already invisible to the user,
        // we permanently remove them here to clear the FK reference, then
        // safely delete the contact.
        const { error: txDeleteErr } = await supabase
          .from("transactions")
          .delete()
          .in("contact_id", toDelete)
          .eq("status", "deleted");

        if (txDeleteErr) throw txDeleteErr;

        const { error } = await supabase
          .from("contacts")
          .delete()
          .in("id", toDelete)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      // Update state — strip photo field, keep hasPhoto flag
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

      setPeopleData(stateContacts);
      saveToLocal(stateContacts);
    } catch (error) {
      console.error("Save Error:", error);
      throw error;
    }
  };

  // ── saveCategories — still writes to public.people ─────────────────────────

  const saveCategories = async (newCategories) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const { error } = await supabase
      .from("people")
      .upsert(
        { user_id: user.id, categories: newCategories },
        { onConflict: "user_id" },
      );

    if (error) throw error;

    localStorage.setItem("peopleCategories", JSON.stringify(newCategories));
    setCategories(newCategories);
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
