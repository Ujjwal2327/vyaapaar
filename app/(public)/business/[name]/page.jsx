"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import Logo from "@/components/Logo";
import { Store, MapPin, Phone, Mail, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {PublicPriceListContent} from "@/components/public/PublicPriceListContent";
import {PublicItemModal} from "@/components/public/PublicItemModal";
import {PublicCategoryModal} from "@/components/public/PublicCategoryModal";
import { filterData, sortData } from "@/lib/utils/priceListUtils";

export default function PublicBusinessPage() {
  const params = useParams();
  const businessName = decodeURIComponent(params.name);

  const [loading, setLoading] = useState(true);
  const [businessData, setBusinessData] = useState(null);
  const [priceData, setPriceData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [error, setError] = useState(null);

  // Modal states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [viewingItem, setViewingItem] = useState({ data: null, name: "" });
  const [viewingCategory, setViewingCategory] = useState({ name: "", notes: "" });

  useEffect(() => {
    loadBusinessData();
  }, [businessName]);

  const loadBusinessData = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, get user info by business_name
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, business_name, business_address, phone, email")
        .eq("business_name", businessName)
        .single();

      if (userError) {
        if (userError.code === "PGRST116") {
          setError("Business not found");
        } else {
          throw userError;
        }
        return;
      }

      if (!userData) {
        setError("Business not found");
        return;
      }

      // Get price list data
      const { data: priceListData, error: priceError } = await supabase
        .from("price_lists")
        .select("data")
        .eq("user_id", userData.id)
        .single();

      if (priceError && priceError.code !== "PGRST116") {
        throw priceError;
      }

      setBusinessData(userData);
      setPriceData(priceListData?.data || {});
    } catch (err) {
      console.error("Error loading business data:", err);
      setError("Failed to load business information");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (path) => {
    setExpandedCategories((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleViewItem = (itemName, itemData) => {
    setViewingItem({ data: itemData, name: itemName });
    setShowItemModal(true);
  };

  const handleViewCategory = (categoryName, categoryNotes) => {
    setViewingCategory({ name: categoryName, notes: categoryNotes });
    setShowCategoryModal(true);
  };

  // Auto-expand when searching
  useEffect(() => {
    if (searchTerm && searchTerm.trim()) {
      const filtered = filterData(priceData, searchTerm);
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
      collectPaths(filtered);
      setExpandedCategories(allPaths);
    }
  }, [searchTerm, priceData]);

  if (loading) return <Loader content="Loading business information..." />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Store className="w-16 h-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">{error}</h1>
          <p className="text-muted-foreground">
            This business page is not available or doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const filteredData = filterData(priceData, searchTerm);
  const sortedData = sortData(filteredData, "none");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-4xl mx-auto p-4">
          {/* Business Info */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shrink-0">
              <Store className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold mb-1 wrap-break-word">
                {businessData.business_name}
              </h1>
              <div className="space-y-1 text-sm text-muted-foreground">
                {businessData.business_address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="wrap-break-word whitespace-pre-line">
                      {businessData.business_address}
                    </span>
                  </div>
                )}
                {businessData.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 shrink-0" />
                    <a
                      href={`tel:${businessData.phone}`}
                      className="hover:underline"
                    >
                      {businessData.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

         

          {/* Search Bar */}
          <div className="relative">
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

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {Object.keys(sortedData).length > 0 ? (
          <PublicPriceListContent
            data={sortedData}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
            onViewItem={handleViewItem}
            onViewCategory={handleViewCategory}
          />
        ) : (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              {searchTerm ? "No items found" : "No products available"}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <PublicItemModal
        open={showItemModal}
        onOpenChange={setShowItemModal}
        itemData={viewingItem.data}
        itemName={viewingItem.name}
      />

      <PublicCategoryModal
        open={showCategoryModal}
        onOpenChange={setShowCategoryModal}
        categoryName={viewingCategory.name}
        categoryNotes={viewingCategory.notes}
      />

      {/* Footer */}
      <footer className="mt-12 py-6 border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Logo className="mb-2" />
          <p className="text-sm text-muted-foreground">
            Powered by Vyaapaar - Modern catalog management
          </p>
        </div>
      </footer>
    </div>
  );
}