import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase"; // Your existing client
import { useAuth } from "@/components/auth/AuthProvider"; // Your existing auth context
import { toast } from "sonner";
import { sortData } from "../lib/utils/priceListUtils";

// Helper function to recursively capture the object key order into an __orderKeys array
// This is crucial for persisting the user's order when saving to JSON/JSONB
const deepAddOrderKeys = (data) => {
  if (!data || typeof data !== "object") return data;

  const newData = {};

  Object.entries(data).forEach(([key, node]) => {
    if (node && node.type === "category" && node.children) {
      // Recursively process children first
      const sortedChildren = deepAddOrderKeys(node.children);

      // Capture the current, desired order of the child keys
      const orderKeys = Object.keys(sortedChildren);

      newData[key] = {
        ...node,
        children: sortedChildren,
        // Save the key order for persistence
        __orderKeys: orderKeys,
      };
    } else {
      // Item or non-recursive node
      newData[key] = node;
    }
  });

  return newData;
};

const defaultData = {
  Taps: {
    type: "category",
    children: {
      "Novex / MK": {
        type: "category",
        children: {
          "Angle valve": {
            type: "item",
            retailSell: 50,
            bulkSell: 45,
            cost: 40,
            sellUnit: "piece",
            costUnit: "piece",
          },
          "Bib cock": {
            type: "item",
            retailSell: 40,
            bulkSell: 40,
            cost: 32,
            sellUnit: "piece",
            costUnit: "piece",
          },
        },
      },
    },
  },
};

export const usePriceList = () => {
  const { user, loading: authLoading } = useAuth(); // UI States

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [sellPriceMode, setSellPriceMode] = useState("retail"); // "retail" or "bulk"
  const [priceView, setPriceView] = useState("sell"); // "sell", "cost", or "profit"
  const [editMode, setEditMode] = useState(false); // Data States

  const [priceData, setPriceData] = useState({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true); // Fix: Use a useRef to ensure the initial data fetch runs exactly once

  const hasFetchedDb = useRef(false); // Helper to load from local storage

  const loadFromLocal = (warningMessage = null) => {
    const saved = localStorage.getItem("priceListData");
    if (saved) {
      try {
        setPriceData(JSON.parse(saved));
        if (warningMessage) {
          toast.warning(warningMessage, {
            description: "Data loaded from local cache.",
            duration: 5000,
          });
        }
      } catch (e) {
        console.error("Local parse error", e);
        setPriceData({});
        // setPriceData(defaultData);
      }
    } 
    // else {
    //   setPriceData(defaultData);
    // }
  };

  // Load sellPriceMode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem("sellPriceMode");
    if (savedMode === "bulk" || savedMode === "retail") {
      setSellPriceMode(savedMode);
    }
  }, []);

  // 1. LOAD DATA: Triggered when Auth finishes loading
  useEffect(() => {
    const loadData = async () => {
      // Check ref value for single execution.
      if (hasFetchedDb.current) {
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      } // Wait for AuthProvider to finish checking session

      if (authLoading) return;

      setIsDataLoading(true); // Set ref to true immediately before execution

      hasFetchedDb.current = true;

      if (!user) {
        // Not logged in: Fallback to local
        console.warn("No user found. Loading local data.");
        loadFromLocal("You are currently working offline.");
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }

      try {
        // Fetch from Supabase
        const { data, error } = await supabase
          .from("price_lists")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data && data.data) {
          // DB Success: Sync to State AND LocalStorage
          console.log("Data loaded from Supabase");
          const sortedData = sortData(data.data, "none");
          setPriceData(sortedData);
          localStorage.setItem("priceListData", JSON.stringify(sortedData));
        } else {
          // New User (No DB data yet): Load local/default
          console.log("No DB entry found. Initializing...");
          loadFromLocal();
        }
      } catch (error) {
        // DB Failure (Offline/Error): Fallback to Local
        console.error("DB Load Error:", error);
        loadFromLocal("Unable to connect to database. Loaded local copy.");
      } finally {
        setIsDataLoading(false);
        setIsHydrated(true);
      }
    };

    loadData();
  }, [user, authLoading]);

  // Effect to reset priceView when showCostProfit setting changes
  useEffect(() => {
    const checkShowCostProfit = () => {
      const showCostProfit = localStorage.getItem("showCostProfit") === "true";
      if (!showCostProfit && priceView !== "sell") {
        setPriceView("sell");
      }
    };

    // Check on mount
    checkShowCostProfit();

    // Listen for storage changes (if user changes in another tab)
    window.addEventListener("storage", checkShowCostProfit);
    return () => window.removeEventListener("storage", checkShowCostProfit);
  }, [priceView]);

  // 2. SAVE DATA: DB -> Local -> State (Modified to preserve order)
  const savePriceData = async (newData) => {
    const toastId = toast.loading("Syncing changes...");

    if (!user) {
      toast.dismiss(toastId);
      toast.error("You must be logged in to save changes.");
      throw new Error("User not logged in");
    }

    try {
      // CAPTURE ORDER: Recursively capture the current visual order before saving
      const dataToSave = deepAddOrderKeys(newData); // Upsert to DB

      const { error } = await supabase.from("price_lists").upsert(
        {
          user_id: user.id,
          data: dataToSave, // Save the data with the explicit order keys
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      localStorage.setItem("priceListData", JSON.stringify(dataToSave));
      setPriceData(dataToSave);

      toast.success("Saved successfully", { id: toastId });
    } catch (error) {
      console.error("Save Error:", error);
      toast.error("Failed to save changes", {
        id: toastId,
        description: "Please check your internet connection.",
      });
      throw error; // Re-throw so calling code can handle it
    }
  };

  const toggleCategory = (path) => {
    setExpandedCategories((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const expandAll = (data) => {
    const allPaths = {};
    const collectPaths = (obj, parentPath = "") => {
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = parentPath ? `${parentPath}.${key}` : key;
        if (value.type === "category") {
          allPaths[currentPath] = true;
          if (value.children) collectPaths(value.children, currentPath);
        }
      });
    };
    collectPaths(data);
    setExpandedCategories(allPaths);
  };

  const collapseAll = () => setExpandedCategories({});

  // Toggle between retail and bulk mode
  const toggleSellPriceMode = () => {
    const newMode = sellPriceMode === "retail" ? "bulk" : "retail";
    setSellPriceMode(newMode);
    localStorage.setItem("sellPriceMode", newMode);
  };

  // Cycle through price views: Sell -> Cost -> Profit -> Sell
  const cyclePriceView = () => {
    const showCostProfit = localStorage.getItem("showCostProfit") === "true";

    if (!showCostProfit) {
      // If showCostProfit is disabled, keep it on "sell" only
      setPriceView("sell");
      return;
    }

    // Simplified cycling: sell → cost → profit → sell
    if (priceView === "sell") {
      setPriceView("cost");
    } else if (priceView === "cost") {
      setPriceView("profit");
    } else {
      setPriceView("sell");
    }
  };

  // Get text for price view button based on current mode
  const getPriceViewText = () => {
    if (priceView === "sell") return "Sell Price";
    if (priceView === "cost") return "Cost Price";
    if (priceView === "profit") return "Profit";
    return "Sell Price";
  };

  return {
    priceData,
    savePriceData,
    searchTerm,
    setSearchTerm,
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