/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Store,
  ChevronDown,
  ChevronUp,
  Plus,
  ChevronsDownUp,
} from "lucide-react";
import {
  sortData,
  filterData,
  buildSearchIndex,
} from "@/lib/utils/priceListUtils";

// Helper function to create Google Maps link
const getGoogleMapsLink = (address) => {
  if (!address || !address.trim()) return null;
  const encodedAddress = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
};

// Collect all category paths from a data tree
const collectAllPaths = (obj, parentPath = "") => {
  const paths = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (key.startsWith("__")) return;
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    if (value.type === "category") {
      paths[currentPath] = true;
      if (value.children) {
        Object.assign(paths, collectAllPaths(value.children, currentPath));
      }
    }
  });
  return paths;
};

export default function PublicBusinessPage() {
  const params = useParams();
  const businessName = decodeURIComponent(params?.name || "");

  const [loading, setLoading] = useState(true);
  const [businessData, setBusinessData] = useState(null);
  const [priceData, setPriceData] = useState({});

  // Raw search term drives the input (stays responsive)
  const [searchTerm, setSearchTerm] = useState("");
  // Debounced term drives the actual filtering (doesn't hang)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    loadBusinessData();
  }, [businessName]);

  // Debounce: only update debouncedSearchTerm 200ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadBusinessData = async () => {
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, business_name, business_address, phone, email")
        .eq("business_name", businessName)
        .single();

      if (userError) throw userError;

      if (!userData) {
        setBusinessData(null);
        setLoading(false);
        return;
      }

      const { data: priceListData, error: priceError } = await supabase
        .from("price_lists")
        .select("data")
        .eq("user_id", userData.id)
        .single();

      if (priceError && priceError.code !== "PGRST116") throw priceError;

      setBusinessData(userData);
      const sortedData = sortData(priceListData?.data || {}, "alphabetical");
      setPriceData(sortedData);
    } catch (error) {
      console.error("Error loading business data:", error);
      setBusinessData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = useCallback((path) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  }, []);

  // Build search index once when priceData loads — same optimization as private catalog
  const searchIndex = useMemo(() => buildSearchIndex(priceData), [priceData]);

  // filteredData only recomputes when priceData or debouncedSearchTerm changes —
  // NOT when expandedCategories changes (which is what was causing the hang)
  const filteredData = useMemo(() => {
    return filterData(priceData, debouncedSearchTerm, searchIndex);
  }, [priceData, debouncedSearchTerm, searchIndex]);

  const expandAll = useCallback(() => {
    // Use filteredData when searching, priceData when not
    setExpandedCategories(collectAllPaths(filteredData));
  }, [filteredData]);

  const collapseAll = useCallback(() => {
    setExpandedCategories({});
  }, []);

  // Auto-expand when search results change
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      setExpandedCategories(collectAllPaths(filteredData));
    }
  }, [filteredData]); // filteredData already depends on debouncedSearchTerm

  if (loading) {
    return <Loader content="Loading business catalog..." />;
  }

  if (!businessData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Store className="w-16 h-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Business Not Found</h1>
          <p className="text-muted-foreground">
            The business "{businessName}" does not exist or is not available.
          </p>
        </div>
      </div>
    );
  }

  const hasAnyExpanded = Object.values(expandedCategories).some(
    (val) => val === true,
  );

  const mapsLink = getGoogleMapsLink(businessData.business_address);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto p-4">
          {/* Business Info */}
          <div className="mb-4">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shrink-0">
                <Store className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  {businessData.business_name}
                </h1>

                {businessData.business_address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    {mapsLink ? (
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline transition-colors flex items-center gap-1 group"
                      >
                        <span>{businessData.business_address}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <span>{businessData.business_address}</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {businessData.phone && (
                    <a
                      href={`tel:${businessData.phone}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{businessData.phone}</span>
                    </a>
                  )}
                  {businessData.email && (
                    <a
                      href={`mailto:${businessData.email}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{businessData.email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center items-center gap-2">
            <Button
              onClick={hasAnyExpanded ? collapseAll : expandAll}
              variant="outline"
              size="sm"
            >
              <ChevronsDownUp className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">
                {hasAnyExpanded ? "Collapse All" : "Expand All"}
              </span>
            </Button>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Catalog Content */}
      <main className="max-w-4xl mx-auto p-4">
        {Object.keys(filteredData).length > 0 ? (
          <CatalogContent
            data={filteredData}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
          />
        ) : (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              {searchTerm ? "No products found" : "No products available"}
            </p>
          </div>
        )}
      </main>

      <footer className="border-t mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="flex justify-center items-center gap-x-2">
            Powered by <Logo className="inline-flex" titleClassName="inline" />
          </p>
        </div>
      </footer>
    </div>
  );
}

// Memoized catalog content — only re-renders when data or expanded state changes
const CatalogContent = ({
  data,
  expandedCategories,
  onToggleCategory,
  parentPath = "",
  level = 0,
}) => {
  const renderItems = (items, currentParentPath, currentLevel) => {
    const entries = Object.entries(items);
    return entries.map(([key, value], index) => {
      if (key.startsWith("__")) return null;
      const currentPath = currentParentPath
        ? `${currentParentPath}.${key}`
        : key;
      const isExpanded = expandedCategories[currentPath];

      if (value.type === "category") {
        return (
          <div key={currentPath} className="mb-2">
            <Button
              onClick={() => onToggleCategory(currentPath)}
              className={`w-full justify-between ${
                currentLevel === 0
                  ? "text-xl font-bold"
                  : currentLevel === 1
                    ? "text-lg font-semibold"
                    : "text-base font-semibold"
              }`}
              variant="secondary"
            >
              <span>{key}</span>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>

            {isExpanded && value.children && (
              <div className="ml-1 mt-2 space-y-2 border-l-2 border-border pl-3">
                {renderItems(value.children, currentPath, currentLevel + 1)}
              </div>
            )}
          </div>
        );
      } else if (value.type === "item") {
        const retailSell =
          value.retailSell !== undefined ? value.retailSell : value.sell || 0;
        const sellUnit = value.sellUnit || "piece";

        return (
          <div
            key={currentPath}
            className={`rounded-lg px-1 py-2.5 flex justify-between items-center ${
              index === entries.length - 1 ? "" : "border-b"
            }`}
          >
            <span className="flex-1">{key}</span>
            <span className="font-semibold">
              ₹{retailSell}/{sellUnit}
            </span>
          </div>
        );
      }
      return null;
    });
  };

  return (
    <div className="space-y-2">
      {Object.keys(data).length > 0 ? (
        renderItems(data, parentPath, level)
      ) : (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No items found</p>
        </div>
      )}
    </div>
  );
};
