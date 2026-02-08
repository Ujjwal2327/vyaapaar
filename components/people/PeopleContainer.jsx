"use client";

import { useState, useEffect } from "react";
import { usePeople } from "@/hooks/usePeople";
import { PeopleHeader } from "./PeopleHeader";
import { PeopleContent } from "./PeopleContent";
import { AddPersonModal } from "./modals/AddPersonModal";
import { EditPersonModal } from "./modals/EditPersonModal";
import { PersonDetailModal } from "./modals/PersonDetailModal";
import { BulkEditPeopleModal } from "./modals/BulkEditPeopleModal";
import { ExportPDFModal } from "./modals/ExportPDFModal";
import { ImportVCFModal } from "./modals/ImportVCFModal";
import { toast } from "sonner";
import Loader from "../Loader";

const DEFAULT_CATEGORIES = [
  { id: "customer", label: "Customer", isDefault: true },
  { id: "supplier", label: "Supplier", isDefault: true },
  { id: "helper", label: "Helper", isDefault: true },
  { id: "other", label: "Other", isDefault: true },
];

export const PeopleContainer = () => {
  const {
    peopleData,
    savePeopleData,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    editMode,
    setEditMode,
    isHydrated,
    isDataLoading,
    categories,
    saveCategories,
  } = usePeople();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showExportPDFModal, setShowExportPDFModal] = useState(false);
  const [showImportVCFModal, setShowImportVCFModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [viewingPerson, setViewingPerson] = useState(null);
  const [sortType, setSortType] = useState("name-asc");
  const [availableCategories, setAvailableCategories] = useState(categories || DEFAULT_CATEGORIES);

  // Sync categories from hook
  useEffect(() => {
    if (categories) {
      setAvailableCategories(categories);
    }
  }, [categories]);

  // Load sortType from localStorage on mount
  useEffect(() => {
    const savedSortType = localStorage.getItem("peopleSortType");
    if (savedSortType) {
      setSortType(savedSortType);
    }
  }, []);

  const handleSortChange = (newSortType) => {
    setSortType(newSortType);
    localStorage.setItem("peopleSortType", newSortType);
  };

  // Prevent hydration mismatch and show loading during DB fetch
  if (!isHydrated || isDataLoading) return <Loader content="Loading contacts..." />;

  const handleAddPerson = () => {
    setShowAddModal(true);
  };

  const handleAdd = async (formData) => {
    const newData = [...peopleData, { id: Date.now().toString(), ...formData }];
    try {
      await savePeopleData(newData);
      setShowAddModal(false);
    } catch (error) {
      // Modal stays open on error so user doesn't lose their data
      console.error("Failed to add contact:", error);
    toast.error("Failed to add contact", {
      description: "Please check your connection and try again",
    });
    }
  };

  const handleEditPerson = (person) => {
    setEditingPerson(person);
    setShowEditModal(true);
  };

  const handleEdit = async (formData) => {
    if (!editingPerson) return;

    const newData = peopleData.map((person) =>
      person.id === editingPerson.id ? { ...person, ...formData } : person
    );

    try {
      await savePeopleData(newData);
      setShowEditModal(false);
      setEditingPerson(null);
    } catch (error) {
      // Modal stays open on error so user doesn't lose their changes
      console.error("Failed to edit contact:", error);
    toast.error("Failed to edit contact", {
      description: "Please check your connection and try again",
    });
    }
  };

  const handleDelete = async (personId) => {
    toast.warning("Are you sure you want to delete this contact?", {
      action: {
        label: "Delete",
        onClick: async () => {
          const newData = peopleData.filter((person) => person.id !== personId);
          await savePeopleData(newData);
        },
      },
      duration: 5000,
    });
  };

  const handleViewDetails = (person) => {
    setViewingPerson(person);
    setShowDetailModal(true);
  };

  const handleCategoriesUpdate = async (newCategories, fromCategoryId, toCategoryId) => {
    // Update categories
    setAvailableCategories(newCategories);
    await saveCategories(newCategories);

    // If merging, update people data
    if (fromCategoryId && toCategoryId) {
      const updatedPeople = peopleData.map((person) =>
        person.category === fromCategoryId
          ? { ...person, category: toCategoryId }
          : person
      );
      await savePeopleData(updatedPeople);
    }
  };

  const handleBulkEdit = () => {
    setShowBulkModal(true);
  };

  const handleExportPDF = () => {
    setShowExportPDFModal(true);
  };

  const handleImportVCF = () => {
    setShowImportVCFModal(true);
  };

  const handleBulkSave = async (newPeopleData) => {
    try {
      await savePeopleData(newPeopleData);
      setShowBulkModal(false);
      toast.success("Contacts updated successfully");
    } catch (error) {
      console.error("Bulk save error:", error);
      toast.error("Failed to save contacts", {
        description: error.message || "Please try again",
      });
      // Modal stays open on error
    }
  };

  const handleVCFImport = async (importedContacts) => {
    try {
      // Merge imported contacts with existing data
      const newData = [...peopleData, ...importedContacts];
      await savePeopleData(newData);
      
      toast.success(`Imported ${importedContacts.length} contact(s) successfully`, {
        description: `Added to ${availableCategories.find(c => c.id === importedContacts[0].category)?.label || 'category'}`,
      });
    } catch (error) {
      console.error("Import save error:", error);
      toast.error("Failed to save imported contacts", {
        description: error.message || "Please try again",
      });
    }
  };

  // Filter and sort data
  const filteredData = peopleData.filter((person) => {
    const matchesSearch =
      !searchTerm ||
      person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      // Search in phones array (new multi-phone support)
      (person.phones && person.phones.some(p => p?.toLowerCase().includes(searchTerm.toLowerCase()))) ||
      person.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !categoryFilter || person.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    switch (sortType) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "category":
        return a.category.localeCompare(b.category);
      default:
        return 0;
    }
  });

  return (
    <>
      <PeopleHeader
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        editMode={editMode}
        setEditMode={setEditMode}
        onAddPerson={handleAddPerson}
        onBulkEdit={handleBulkEdit}
        onExportPDF={handleExportPDF}
        onImportVCF={handleImportVCF}
        sortType={sortType}
        onSortChange={handleSortChange}
        totalCount={peopleData.length}
        filteredCount={sortedData.length}
        peopleData={peopleData}
        onCategoriesUpdate={handleCategoriesUpdate}
        availableCategories={availableCategories}
      />

      <PeopleContent
        data={sortedData}
        editMode={editMode}
        onEdit={handleEditPerson}
        onDelete={handleDelete}
        onViewDetails={handleViewDetails}
        availableCategories={availableCategories}
      />

      <AddPersonModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onAdd={handleAdd}
        availableCategories={availableCategories}
      />

      <EditPersonModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        editingPerson={editingPerson}
        onSave={handleEdit}
        availableCategories={availableCategories}
      />

      <PersonDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        person={viewingPerson}
        availableCategories={availableCategories}
      />

      <BulkEditPeopleModal
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        peopleData={peopleData}
        categories={availableCategories}
        onSave={handleBulkSave}
      />

      <ExportPDFModal
        open={showExportPDFModal}
        onOpenChange={setShowExportPDFModal}
        peopleData={peopleData}
        availableCategories={availableCategories}
      />

      <ImportVCFModal
        open={showImportVCFModal}
        onOpenChange={setShowImportVCFModal}
        onImport={handleVCFImport}
        availableCategories={availableCategories}
      />
    </>
  );
};