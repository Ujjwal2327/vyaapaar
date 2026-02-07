import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

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
  const loadFromLocal = (warningMessage = null) => {
    const saved = localStorage.getItem("peopleData");
    if (saved) {
      try {
        setPeopleData(JSON.parse(saved));
        if (warningMessage) {
          toast.warning(warningMessage, {
            description: "Data loaded from local cache.",
            duration: 5000,
          });
        }
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
        loadFromLocal("You are currently working offline.");
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
        loadFromLocal("Unable to connect to database. Loaded local copy.");
      } finally {
        setIsDataLoading(false);
        setIsHydrated(true);
      }
    };

    loadData();
  }, [user, authLoading]);

  // Save data to DB and local storage
  const savePeopleData = async (newData) => {
    const toastId = toast.loading("Syncing changes...");

    if (!user) {
      toast.dismiss(toastId);
      toast.error("You must be logged in to save changes.");
      return;
    }

    try {
      const { error } = await supabase.from("people").upsert(
        {
          user_id: user.id,
          data: newData,
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      localStorage.setItem("peopleData", JSON.stringify(newData));
      setPeopleData(newData);

      toast.success("Saved successfully", { id: toastId });
    } catch (error) {
      console.error("Save Error:", error);
      toast.error("Failed to save changes", {
        id: toastId,
        description: "Please check your internet connection.",
      });
    }
  };

  // Save categories to DB and local storage
  const saveCategories = async (newCategories) => {
    if (!user) {
      toast.error("You must be logged in to save changes.");
      return;
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
      toast.error("Failed to save categories", {
        description: "Please check your internet connection.",
      });
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