import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

const DEFAULT_CATEGORIES = [
  { id: "customer", label: "Customer", isDefault: true },
  { id: "supplier", label: "Supplier", isDefault: true },
  { id: "helper", label: "Helper", isDefault: true },
  { id: "other", label: "Other", isDefault: true },
];

export const usePeople = () => {
  const { user, loading: authLoading } = useAuth();

  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Data States
  const [peopleData, setPeopleData] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const hasFetchedDb = useRef(false);

  // Helper to load from local storage
  const loadFromLocal = () => {
    const saved = localStorage.getItem("peopleData");
    if (saved) {
      try {
        setPeopleData(JSON.parse(saved));
      } catch (e) {
        console.error("Local parse error", e);
        setPeopleData([]);
      }
    }

    // Load categories from localStorage
    const savedCategories = localStorage.getItem("peopleCategories");
    if (savedCategories) {
      try {
        setCategories(JSON.parse(savedCategories));
      } catch (e) {
        console.error("Categories parse error", e);
        setCategories(DEFAULT_CATEGORIES);
      }
    }
  };

  // Load data when auth finishes loading
  useEffect(() => {
    const loadData = async () => {
      if (hasFetchedDb.current) {
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }

      if (authLoading) return;

      setIsDataLoading(true);
      hasFetchedDb.current = true;

      if (!user) {
        console.warn("No user found. Loading local data.");
        loadFromLocal();
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("people")
          .select("data, categories")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          console.log("People data loaded from Supabase");
          
          // Load people data
          if (data.data) {
            setPeopleData(data.data);
            localStorage.setItem("peopleData", JSON.stringify(data.data));
          }
          
          // Load categories
          if (data.categories) {
            setCategories(data.categories);
            localStorage.setItem("peopleCategories", JSON.stringify(data.categories));
          } else {
            setCategories(DEFAULT_CATEGORIES);
            localStorage.setItem("peopleCategories", JSON.stringify(DEFAULT_CATEGORIES));
          }
        } else {
          console.log("No DB entry found. Initializing...");
          loadFromLocal();
        }
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

  // Save data to DB and local storage - NO TOAST LOGIC
  const savePeopleData = async (newData) => {
    if (!user) {
      throw new Error("NOT_AUTHENTICATED");
    }

    try {
      const { error } = await supabase.from("people").upsert(
        {
          user_id: user.id,
          data: newData,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        // Check for duplicate phone constraint violation
        if (error.code === "23505" || error.message?.includes("Duplicate phone")) {
          throw new Error("DUPLICATE_PHONE");
        }
        throw error;
      }

      localStorage.setItem("peopleData", JSON.stringify(newData));
      setPeopleData(newData);
    } catch (error) {
      console.error("Save Error:", error);
      throw error; // Re-throw for container to handle
    }
  };

  // Save categories to DB and local storage - NO TOAST LOGIC
  const saveCategories = async (newCategories) => {
    if (!user) {
      throw new Error("NOT_AUTHENTICATED");
    }

    try {
      const { error } = await supabase.from("people").upsert(
        {
          user_id: user.id,
          categories: newCategories,
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      localStorage.setItem("peopleCategories", JSON.stringify(newCategories));
      setCategories(newCategories);
    } catch (error) {
      console.error("Save Categories Error:", error);
      throw error; // Re-throw for container to handle
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