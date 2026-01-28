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
} from "@/lib/utils/priceListUtils";
import {
  exportToText,
  importFromText,
  toTitleCase,
} from "@/lib/utils/dataTransform";
import { toast } from "sonner";
import { RenameCategoryModal } from "./modals/RenameCategoryModal";
import { ItemDetailModal } from "./modals/ItemDetailModal";

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

  // --- NEW STATE FOR CATEGORY RENAMING ---
  const [showRenameCategoryModal, setShowRenameCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
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

  const [showItemDetailModal, setShowItemDetailModal] = useState(false); // New state
  const [viewingItem, setViewingItem] = useState({ data: null, name: "" }); // New state

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
    // The last segment of the path is the item's name.
    // Example: path = "category1.category2.ItemName"
    const pathSegments = path.split(".");
    const itemName = pathSegments[pathSegments.length - 1];

    // The data for editing should include the name of the item.
    setEditingItem({
      path: path.substring(0, path.lastIndexOf(".")), // Path to the parent (category)
      data: {
        ...itemData,
        name: itemName, // Inject the name into the item data
      },
    });
    setShowEditModal(true);
  };

  // Edit Item Wrapper (OPTIMISTIC/BACKGROUND SAVE)
  const handleEdit = async (formData) => {
    if (!editingItem) return;

    // Store the original name before applying title case to the form data
    const originalItemName = editingItem.data.name;

    formData.name = toTitleCase(formData.name);

    // Pass parent path, original name (key), and new data for order preservation
    const newData = editItem(
      priceData,
      editingItem.path, // Path to parent category
      originalItemName, // Original name (key to find and delete)
      formData, // New item data (including potentially new name)
    );

    // 1. Close modal instantly
    setShowEditModal(false);
    setEditingItem(null);

    // 2. Push to DB in the background.
    savePriceData(newData);
  };

  // --- CATEGORY EDIT HANDLERS ---
  const handleEditCategory = (path, name) => {
    // Path is the full path to the category (e.g., "CatA.SubCatB")
    setEditingCategory({ path, name });
    setShowRenameCategoryModal(true);
  };

  const handleRenameCategory = async (newName) => {
    if (!editingCategory || !newName.trim()) return;

    const newNameTitleCase = toTitleCase(newName);

    // Assuming editCategory utility handles the actual replacement/renaming
    // and preserves the order of keys.
    const newData = editCategory(
      priceData,
      editingCategory.path, // Full path of the category to rename
      newNameTitleCase, // New name
    );

    // 1. Close modal instantly
    setShowRenameCategoryModal(false);
    setEditingCategory(null);

    // 2. Push to DB in the background.
    savePriceData(newData);
  };
  // ---------------------------------

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
        onEditCategory={handleEditCategory} // Passed down to PriceListContent
        onViewDetails={handleViewDetails} // <--- NEW PROP
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

      {/* Placeholder for Rename Category Modal - UNCOMMENT and implement when ready */}
      <RenameCategoryModal
        open={showRenameCategoryModal}
        onOpenChange={setShowRenameCategoryModal}
        initialName={editingCategory?.name || ""}
        onSave={handleRenameCategory}
      />

      {/* Item Detail Modal */}
      <ItemDetailModal
        open={showItemDetailModal}
        onOpenChange={setShowItemDetailModal}
        itemData={viewingItem.data}
        itemName={viewingItem.name}
      />
    </>
  );
};
