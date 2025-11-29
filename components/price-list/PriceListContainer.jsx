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

export const PriceListContainer = () => {
  const {
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

  // Don't render until hydrated to avoid hydration mismatch
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
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

  const handleAdd = (formData) => {
    formData.name = toTitleCase(formData.name);
    const newData = addItem(priceData, modalContext.path, modalType, formData);
    setPriceData(newData);
    setShowAddModal(false);
  };

  const handleEditItem = (path, itemData) => {
    setEditingItem({ path, data: itemData });
    setShowEditModal(true);
  };

  const handleEdit = (formData) => {
    if (!editingItem) return;
    formData.name = toTitleCase(formData.name);
    const newData = editItem(priceData, editingItem.path, formData);
    setPriceData(newData);
    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleDelete = (path, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!window.confirm("Are you sure you want to delete this item?")) return;

    const newData = deleteItem(priceData, path);
    setPriceData(newData);
  };

  const handleBulkEdit = () => {
    const text = exportToText(priceData);
    setBulkEditText(text);
    setShowBulkModal(true);
  };

  const handleBulkSave = (bulkText) => {
    try {
      const newData = importFromText(bulkText);
      setPriceData(newData);
      setShowBulkModal(false);
    } catch (error) {
      console.error("Import error:", error);
      alert("Error saving data. Please check the format.");
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
