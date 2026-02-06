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

  // --- STATE FOR CATEGORY EDITING ---
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  // ---------------------------------------

  // --- STATE FOR CATEGORY VIEWING ---
  const [showCategoryDetailModal, setShowCategoryDetailModal] = useState(false);
  const [viewingCategory, setViewingCategory] = useState({ name: "", notes: "" });
  // ---------------------------------------

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

  // Save sortType to localStorage whenever it changes
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
  if (!isHydrated || isDataLoading) return <Loader content="Loading catalog..."/>

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
    const newData = addItem(priceData, modalContext.path, modalType, formData);
    setShowAddModal(false);
    savePriceData(newData);
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

  // Edit Item Wrapper (OPTIMISTIC/BACKGROUND SAVE)
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

    setShowEditModal(false);
    setEditingItem(null);
    savePriceData(newData);
  };

  // --- CATEGORY EDIT HANDLERS ---
  const handleEditCategory = (path, name) => {
    // Get the category data to retrieve existing notes
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
      formData.notes, // Pass the notes to editCategory
    );

    setShowEditCategoryModal(false);
    setEditingCategory(null);
    savePriceData(newData);
  };
  // ---------------------------------

  // --- CATEGORY VIEW HANDLERS ---
  const handleViewCategoryDetails = (path, name) => {
    // Get the category data to retrieve notes
    const categoryData = getItemAtPath(priceData, path);
    const categoryNotes = categoryData?.notes || "";

    setViewingCategory({ name, notes: categoryNotes });
    setShowCategoryDetailModal(true);
  };
  // ---------------------------------

  // Delete Wrapper (OPTIMISTIC/BACKGROUND SAVE)
  const handleDelete = async (path, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    toast.warning("Are you sure you want to delete this item?", {
      action: {
        label: "Delete",
        onClick: () => {
          const newData = deleteItem(priceData, path);
          savePriceData(newData);
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
      setShowBulkModal(false);
      savePriceData(newData);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import Error", {
        description: "Data format is invalid. Please check the text.",
      });
    }
  };

  // Handler to view item details
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
        onViewCategoryDetails={handleViewCategoryDetails} // New prop
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

      {/* Edit Category Modal */}
      <EditCategoryModal
        open={showEditCategoryModal}
        onOpenChange={setShowEditCategoryModal}
        initialName={editingCategory?.name || ""}
        initialNotes={editingCategory?.notes || ""}
        onSave={handleSaveCategory}
      />

      {/* Category Detail Modal */}
      <CategoryDetailModal
        open={showCategoryDetailModal}
        onOpenChange={setShowCategoryDetailModal}
        categoryName={viewingCategory.name}
        categoryNotes={viewingCategory.notes}
      />

      {/* Item Detail Modal */}
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