"use client";

import { useState, useEffect } from "react";
import { usePriceList } from "@/hooks/usePriceList";
import { PriceListHeader } from "./PriceListHeader";
import { PriceListContent } from "./PriceListContent";
import { AddItemModal } from "./modals/AddItemModal";
import { EditItemModal } from "./modals/EditItemModal";
import { BulkEditModal } from "./modals/BulkEditModal";
import {
  filterData,
  addItem,
  editItem,
  deleteItem,
  sortData,
  editCategory,
  getItemAtPath,
} from "@/lib/utils/priceListUtils";
import {
  exportToText,
  importFromText,
  toTitleCase,
} from "@/lib/utils/dataTransform";
import { toast } from "sonner";
import { EditCategoryModal } from "./modals/EditCategoryModal";
import { CategoryDetailModal } from "./modals/CategoryDetailModal";
import { ItemDetailModal } from "./modals/ItemDetailModal";
import Loader from "../Loader";

// Helper function to get user-friendly error messages
const getErrorMessage = (error) => {
  if (!error) return "An error occurred";
  
  // User errors
  if (error.message === "NOT_AUTHENTICATED") {
    return "You must be logged in to save changes";
  }
  
  // Import/validation errors (user errors)
  if (error.message?.includes("format") || 
      error.message?.includes("invalid") ||
      error.message?.includes("Line")) {
    return error.message; // Show specific validation error
  }
  
  // Server/DB errors - generic message
  if (error.message?.includes("fetch") || 
      error.message?.includes("network") ||
      error.code?.startsWith("PGRST")) {
    return "Unable to connect to the server. Please check your internet connection";
  }
  
  // Default error
  return "Failed to save changes. Please try again";
};

export const PriceListContainer = () => {
  const {
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
  } = usePriceList();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [showCategoryDetailModal, setShowCategoryDetailModal] = useState(false);
  const [viewingCategory, setViewingCategory] = useState({
    name: "",
    notes: "",
  });

  const [modalType, setModalType] = useState("");
  const [modalContext, setModalContext] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [bulkEditText, setBulkEditText] = useState("");
  const [sortType, setSortType] = useState("none");

  // Load sortType from localStorage on mount
  useEffect(() => {
    const savedSortType = localStorage.getItem("sortType");
    if (savedSortType) {
      setSortType(savedSortType);
    }
  }, []);

  const handleSortChange = (newSortType) => {
    setSortType(newSortType);
    localStorage.setItem("sortType", newSortType);
  };

  const filteredData = filterData(priceData, searchTerm);
  const sortedData = sortData(filteredData, sortType);

  const hasAnyExpanded = Object.values(expandedCategories).some(
    (val) => val === true,
  );

  const [showItemDetailModal, setShowItemDetailModal] = useState(false);
  const [viewingItem, setViewingItem] = useState({ data: null, name: "" });

  // Auto-expand when searching
  useEffect(() => {
    if (searchTerm && searchTerm.trim()) {
      expandAll(filteredData);
    }
  }, [searchTerm]);

  // Prevent hydration mismatch and show loading during DB fetch
  if (!isHydrated || isDataLoading)
    return <Loader content="Loading catalog..." />;

  const handleAddCategory = () => {
    setModalType("category");
    setModalContext({ path: "" });
    setShowAddModal(true);
  };

  const handleAddSubcategory = (path) => {
    setModalType("category");
    setModalContext({ path });
    setShowAddModal(true);
  };

  const handleAddItem = (path) => {
    setModalType("item");
    setModalContext({ path });
    setShowAddModal(true);
  };

  const handleAdd = async (formData) => {
    formData.name = toTitleCase(formData.name);
    const newData = addItem(priceData, modalContext.path, modalType, formData);
    
    const loadingToast = toast.loading(
      `Adding ${modalType === "category" ? "category" : "item"}...`
    );
    
    try {
      await savePriceData(newData);
      toast.success(
        `${modalType === "category" ? "Category" : "Item"} added successfully`,
        { id: loadingToast }
      );
      setShowAddModal(false);
    } catch (error) {
      console.error("Failed to add item:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      // Modal stays open on error
    }
  };

  const handleEditItem = (path, itemData) => {
    const pathSegments = path.split(".");
    const itemName = pathSegments[pathSegments.length - 1];

    setEditingItem({
      path: path.substring(0, path.lastIndexOf(".")),
      data: {
        ...itemData,
        name: itemName,
      },
    });
    setShowEditModal(true);
  };

  const handleEdit = async (formData) => {
    if (!editingItem) return;

    const originalItemName = editingItem.data.name;
    formData.name = toTitleCase(formData.name);

    const newData = editItem(
      priceData,
      editingItem.path,
      originalItemName,
      formData,
    );

    const loadingToast = toast.loading("Updating item...");
    
    try {
      await savePriceData(newData);
      toast.success("Item updated successfully", { id: loadingToast });
      setShowEditModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to edit item:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      // Modal stays open on error
    }
  };

  const handleEditCategory = (path, name) => {
    const categoryData = getItemAtPath(priceData, path);
    const existingNotes = categoryData?.notes || "";

    setEditingCategory({ path, name, notes: existingNotes });
    setShowEditCategoryModal(true);
  };

  const handleSaveCategory = async (formData) => {
    if (!editingCategory || !formData.name.trim()) return;

    const newNameTitleCase = toTitleCase(formData.name);

    const newData = editCategory(
      priceData,
      editingCategory.path,
      newNameTitleCase,
      formData.notes,
    );

    const loadingToast = toast.loading("Updating category...");
    
    try {
      await savePriceData(newData);
      toast.success("Category updated successfully", { id: loadingToast });
      setShowEditCategoryModal(false);
      setEditingCategory(null);
    } catch (error) {
      console.error("Failed to edit category:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      // Modal stays open on error
    }
  };

  const handleViewCategoryDetails = (path, name) => {
    const categoryData = getItemAtPath(priceData, path);
    const categoryNotes = categoryData?.notes || "";

    setViewingCategory({ name, notes: categoryNotes });
    setShowCategoryDetailModal(true);
  };

  const handleDelete = async (path, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    toast.warning("Are you sure you want to delete this item?", {
      action: {
        label: "Delete",
        onClick: async () => {
          const newData = deleteItem(priceData, path);
          const loadingToast = toast.loading("Deleting...");
          
          try {
            await savePriceData(newData);
            toast.success("Deleted successfully", { id: loadingToast });
          } catch (error) {
            console.error("Failed to delete:", error);
            toast.error(getErrorMessage(error), { id: loadingToast });
          }
        },
      },
      duration: 5000,
    });
  };

  const handleBulkEdit = () => {
    const text = exportToText(priceData);
    setBulkEditText(text);
    setShowBulkModal(true);
  };

  const handleBulkSave = async (bulkText) => {
    const loadingToast = toast.loading("Importing data...");
    
    try {
      const newData = importFromText(bulkText);
      await savePriceData(newData);
      toast.success("Data imported successfully", { id: loadingToast });
      setShowBulkModal(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      // Modal stays open on error
    }
  };

  const handleViewDetails = (itemName, itemData) => {
    setViewingItem({ data: itemData, name: itemName });
    setShowItemDetailModal(true);
  };

  return (
    <>
      <PriceListHeader
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        editMode={editMode}
        setEditMode={setEditMode}
        priceView={priceView}
        cyclePriceView={cyclePriceView}
        getPriceViewText={getPriceViewText}
        onBulkEdit={handleBulkEdit}
        onAddCategory={handleAddCategory}
        onExpandAll={() => expandAll(sortedData)}
        onCollapseAll={collapseAll}
        sortType={sortType}
        onSortChange={handleSortChange}
        hasAnyExpanded={hasAnyExpanded}
        sellPriceMode={sellPriceMode}
        toggleSellPriceMode={toggleSellPriceMode}
      />

      <PriceListContent
        data={sortedData}
        priceView={priceView}
        sellPriceMode={sellPriceMode}
        editMode={editMode}
        expandedCategories={expandedCategories}
        onToggleCategory={toggleCategory}
        onDelete={handleDelete}
        onEdit={handleEditItem}
        onAddSubcategory={handleAddSubcategory}
        onAddItem={handleAddItem}
        onEditCategory={handleEditCategory}
        onViewCategoryDetails={handleViewCategoryDetails}
        onViewDetails={handleViewDetails}
      />

      <AddItemModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        type={modalType}
        onAdd={handleAdd}
      />

      <EditItemModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        editingItem={editingItem}
        onSave={handleEdit}
      />

      <BulkEditModal
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        initialText={bulkEditText}
        onSave={handleBulkSave}
      />

      <EditCategoryModal
        open={showEditCategoryModal}
        onOpenChange={setShowEditCategoryModal}
        initialName={editingCategory?.name || ""}
        initialNotes={editingCategory?.notes || ""}
        onSave={handleSaveCategory}
      />

      <CategoryDetailModal
        open={showCategoryDetailModal}
        onOpenChange={setShowCategoryDetailModal}
        categoryName={viewingCategory.name}
        categoryNotes={viewingCategory.notes}
      />

      <ItemDetailModal
        open={showItemDetailModal}
        onOpenChange={setShowItemDetailModal}
        itemData={viewingItem.data}
        itemName={viewingItem.name}
        sellPriceMode={sellPriceMode}
      />
    </>
  );
};