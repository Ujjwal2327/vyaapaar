import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { sortData } from "../lib/utils/priceListUtils";

// Helper function to recursively capture the object key order into an __orderKeys array
const deepAddOrderKeys = (data) => {
  if (!data || typeof data !== "object") return data;

  const newData = {};

  Object.entries(data).forEach(([key, node]) => {
    if (node && node.type === "category" && node.children) {
      const sortedChildren = deepAddOrderKeys(node.children);
      const orderKeys = Object.keys(sortedChildren);

      newData[key] = {
        ...node,
        children: sortedChildren,
        __orderKeys: orderKeys,
      };
    } else {
      newData[key] = node;
    }
  });

  return newData;
};

export const usePriceList = () => {
  const { user, loading: authLoading } = useAuth();

  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [sellPriceMode, setSellPriceMode] = useState("retail");
  const [priceView, setPriceView] = useState("sell");
  const [editMode, setEditMode] = useState(false);

  // Data States
  const [priceData, setPriceData] = useState({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const hasFetchedDb = useRef(false);

  // Helper to load from local storage
  const loadFromLocal = () => {
    const saved = localStorage.getItem("priceListData");
    if (saved) {
      try {
        setPriceData(JSON.parse(saved));
      } catch (e) {
        console.error("Local parse error", e);
        setPriceData({});
      }
    }
  };

  // Load sellPriceMode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem("sellPriceMode");
    if (savedMode === "bulk" || savedMode === "retail") {
      setSellPriceMode(savedMode);
    }
  }, []);

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
          .from("price_lists")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data && data.data) {
          console.log("Data loaded from Supabase");
          const sortedData = sortData(data.data, "none");
          setPriceData(sortedData);
          localStorage.setItem("priceListData", JSON.stringify(sortedData));
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

  // Effect to reset priceView when showCostProfit setting changes
  useEffect(() => {
    const checkShowCostProfit = () => {
      const showCostProfit = localStorage.getItem("showCostProfit") === "true";
      if (!showCostProfit && priceView !== "sell") {
        setPriceView("sell");
      }
    };

    checkShowCostProfit();
    window.addEventListener("storage", checkShowCostProfit);
    return () => window.removeEventListener("storage", checkShowCostProfit);
  }, [priceView]);

  // Save data to DB and local storage - NO TOAST LOGIC
  const savePriceData = async (newData) => {
    if (!user) {
      throw new Error("NOT_AUTHENTICATED");
    }

    try {
      const dataToSave = deepAddOrderKeys(newData);

      const { error } = await supabase.from("price_lists").upsert(
        {
          user_id: user.id,
          data: dataToSave,
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      localStorage.setItem("priceListData", JSON.stringify(dataToSave));
      setPriceData(dataToSave);
    } catch (error) {
      console.error("Save Error:", error);
      throw error; // Re-throw for container to handle
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

  const toggleSellPriceMode = () => {
    const newMode = sellPriceMode === "retail" ? "bulk" : "retail";
    setSellPriceMode(newMode);
    localStorage.setItem("sellPriceMode", newMode);
  };

  const cyclePriceView = () => {
    const showCostProfit = localStorage.getItem("showCostProfit") === "true";

    if (!showCostProfit) {
      setPriceView("sell");
      return;
    }

    if (priceView === "sell") {
      setPriceView("cost");
    } else if (priceView === "cost") {
      setPriceView("profit");
    } else {
      setPriceView("sell");
    }
  };

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