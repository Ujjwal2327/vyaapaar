import { useState, useEffect } from "react";

const defaultData = {
  Taps: {
    type: "category",
    children: {
      "Novex / MK": {
        type: "category",
        children: {
          "Angle valve": {
            type: "item",
            sell: 50,
            cost: 40,
            sellUnit: "piece",
            costUnit: "piece",
          },
          "Bib cock": {
            type: "item",
            sell: 40,
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
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [priceView, setPriceView] = useState("sell");
  const [editMode, setEditMode] = useState(false);
  const [priceData, setPriceData] = useState(defaultData);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage only after hydration
  useEffect(() => {
    const saved = localStorage.getItem("priceListData");
    if (saved) {
      try {
        setPriceData(JSON.parse(saved));
      } catch (error) {
        console.error("Error loading price data:", error);
      }
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage whenever data changes (but only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("priceListData", JSON.stringify(priceData));
    }
  }, [priceData, isHydrated]);

  const toggleCategory = (path) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const expandAll = (data) => {
    const allPaths = {};

    const collectPaths = (obj, parentPath = "") => {
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = parentPath ? `${parentPath}.${key}` : key;
        if (value.type === "category") {
          allPaths[currentPath] = true;
          if (value.children) {
            collectPaths(value.children, currentPath);
          }
        }
      });
    };

    collectPaths(data);
    setExpandedCategories(allPaths);
  };

  const collapseAll = () => {
    setExpandedCategories({});
  };

  const cyclePriceView = () => {
    if (priceView === "sell") setPriceView("cost");
    else if (priceView === "cost") setPriceView("profit");
    else setPriceView("sell");
  };

  const getPriceViewText = () => {
    if (priceView === "sell") return "Showing: Sell Price";
    if (priceView === "cost") return "Showing: Cost Price";
    return "Showing: Profit";
  };

  return {
    priceData,
    setPriceData,
    searchTerm,
    setSearchTerm,
    expandedCategories,
    toggleCategory,
    expandAll,
    collapseAll,
    priceView,
    cyclePriceView,
    getPriceViewText,
    editMode,
    setEditMode,
    isHydrated,
  };
};
