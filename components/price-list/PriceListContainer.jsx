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
} from "@/lib/utils/priceListUtils";
import {
  exportToText,
  importFromText,
  toTitleCase,
} from "@/lib/utils/dataTransform";
import { toast } from "sonner"; // Import toast for the import error handling

export const PriceListContainer = () => {
  const {
    priceData,
    savePriceData, // The new DB-integrated save function
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
    isDataLoading, // Loading state from hook
    // We intentionally ignore setPriceData to force changes through savePriceData
  } = usePriceList();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [modalContext, setModalContext] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [bulkEditText, setBulkEditText] = useState("");
  const [sortType, setSortType] = useState("none");

  const filteredData = filterData(priceData, searchTerm);
  const sortedData =
    sortType !== "none" ? sortData(filteredData, sortType) : filteredData;

  const hasAnyExpanded = Object.values(expandedCategories).some(
    (val) => val === true
  );

  // Auto-expand when searching
  useEffect(() => {
    if (searchTerm && searchTerm.trim()) {
      expandAll(filteredData);
    }
  }, [searchTerm]);

  // Prevent hydration mismatch and show loading during DB fetch
  if (!isHydrated || isDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">
            Loading data...
          </div>
        </div>
      </div>
    );
  }

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

  // Add Item/Category Wrapper (OPTIMISTIC/BACKGROUND SAVE)
  const handleAdd = async (formData) => {
    formData.name = toTitleCase(formData.name);
    // 1. Calculate result locally
    const newData = addItem(priceData, modalContext.path, modalType, formData);

    // 2. IMPORTANT: We close the modal first for fast UX.
    setShowAddModal(false);

    // 3. Push to DB in the background. The hook handles state update on success.
    // NOTE: This call must NOT use await here if you want the modal to close instantly.
    savePriceData(newData);
  };

  const handleEditItem = (path, itemData) => {
    setEditingItem({ path, data: itemData });
    setShowEditModal(true);
  };

  // Edit Item Wrapper (OPTIMISTIC/BACKGROUND SAVE)
  const handleEdit = async (formData) => {
    if (!editingItem) return;
    formData.name = toTitleCase(formData.name);

    const newData = editItem(priceData, editingItem.path, formData);

    // 1. Close modal instantly
    setShowEditModal(false);
    setEditingItem(null);

    // 2. Push to DB in the background.
    savePriceData(newData);
  };

  // Delete Wrapper (OPTIMISTIC/BACKGROUND SAVE)
  const handleDelete = async (path, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Use toast confirmation instead of window.confirm for better integration
    toast.warning("Are you sure you want to delete this item?", {
      action: {
        label: "Delete",
        onClick: () => {
          const newData = deleteItem(priceData, path);
          savePriceData(newData); // Save in background after confirmation
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

  // Bulk Save Wrapper (OPTIMISTIC/BACKGROUND SAVE)
  const handleBulkSave = async (bulkText) => {
    try {
      const newData = importFromText(bulkText);

      // 1. Close modal instantly
      setShowBulkModal(false);

      // 2. Push to DB in the background.
      savePriceData(newData);
    } catch (error) {
      console.error("Import error:", error);
      // Use toast instead of alert for consistent UI
      toast.error("Import Error", {
        description: "Data format is invalid. Please check the text.",
      });
    }
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
        onSortChange={setSortType}
        hasAnyExpanded={hasAnyExpanded}
      />

      <PriceListContent
        data={sortedData}
        priceView={priceView}
        editMode={editMode}
        expandedCategories={expandedCategories}
        onToggleCategory={toggleCategory}
        onDelete={handleDelete}
        onEdit={handleEditItem}
        onAddSubcategory={handleAddSubcategory}
        onAddItem={handleAddItem}
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
    </>
  );
};
