"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PublicPriceListHeader } from "@/components/public/PublicPriceListHeader";
import { PublicPriceListContent } from "@/components/public/PublicPriceListContent";
import { PublicItemModal } from "@/components/public/PublicItemModal";
import { PublicCategoryModal } from "@/components/public/PublicCategoryModal";
import { filterData, sortData } from "@/lib/utils/priceListUtils";
import { Package } from "lucide-react";
import Loader from "@/components/Loader";

export default function PublicBusinessPage() {
  const params = useParams();
  const businessName = params.name;

  const [priceData, setPriceData] = useState({});
  const [businessInfo, setBusinessInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [sortType, setSortType] = useState("none");

  // Modal States
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState({ data: null, name: "" });
  const [selectedCategory, setSelectedCategory] = useState({ name: "", notes: "" });

  useEffect(() => {
    loadBusinessData();
  }, [businessName]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user by business_name
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, user_name, business_name, phone")
        .eq("business_name", decodeURIComponent(businessName))
        .single();

      if (userError) {
        if (userError.code === "PGRST116") {
          setError("Business not found");
        } else {
          throw userError;
        }
        setLoading(false);
        return;
      }

      setBusinessInfo(userData);

      // Fetch price list data for this user
      const { data: priceListData, error: priceListError } = await supabase
        .from("price_lists")
        .select("data")
        .eq("user_id", userData.id)
        .single();

      if (priceListError) {
        if (priceListError.code === "PGRST116") {
          // No price list yet
          setPriceData({});
        } else {
          throw priceListError;
        }
      } else {
        setPriceData(priceListData.data || {});
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading business data:", err);
      setError("Failed to load business information");
      setLoading(false);
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

  const handleViewItem = (itemName, itemData) => {
    setSelectedItem({ data: itemData, name: itemName });
    setShowItemModal(true);
  };

  const handleViewCategory = (categoryName, categoryNotes) => {
    setSelectedCategory({ name: categoryName, notes: categoryNotes });
    setShowCategoryModal(true);
  };

  // Auto-expand when searching
  useEffect(() => {
    if (searchTerm && searchTerm.trim()) {
      expandAll(filteredData);
    }
  }, [searchTerm]);

  const filteredData = filterData(priceData, searchTerm);
  const sortedData = sortData(filteredData, sortType);
  const hasAnyExpanded = Object.values(expandedCategories).some(
    (val) => val === true
  );

  if (loading) {
    return <Loader content="Loading business information..."/>
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Package className="w-16 h-16 mx-auto text-destructive" />
          <div className="text-xl font-semibold text-destructive">{error}</div>
          <p className="text-muted-foreground">
            The business you're looking for doesn't exist or is not available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicPriceListHeader
        businessName={businessInfo?.business_name || "Business"}
        userName={businessInfo?.user_name}
        phone={businessInfo?.phone}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortType={sortType}
        onSortChange={setSortType}
        onExpandAll={() => expandAll(sortedData)}
        onCollapseAll={collapseAll}
        hasAnyExpanded={hasAnyExpanded}
      />

      <PublicPriceListContent
        data={sortedData}
        expandedCategories={expandedCategories}
        onToggleCategory={toggleCategory}
        onViewItem={handleViewItem}
        onViewCategory={handleViewCategory}
      />

      <PublicItemModal
        open={showItemModal}
        onOpenChange={setShowItemModal}
        itemName={selectedItem.name}
        itemData={selectedItem.data}
      />

      <PublicCategoryModal
        open={showCategoryModal}
        onOpenChange={setShowCategoryModal}
        categoryName={selectedCategory.name}
        categoryNotes={selectedCategory.notes}
      />
    </div>
  );
}