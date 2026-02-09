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
import { DuplicateContactsModal } from "./modals/DuplicateContactsModal";
import { toast } from "sonner";
import Loader from "../Loader";
import {
  batchFindDuplicates,
  findPotentialDuplicates,
  mergeContacts,
  areContactsIdentical,
} from "@/lib/utils/duplicateContactUtils";

const DEFAULT_CATEGORIES = [
  { id: "customer", label: "Customer", isDefault: true },
  { id: "supplier", label: "Supplier", isDefault: true },
  { id: "helper", label: "Helper", isDefault: true },
  { id: "other", label: "Other", isDefault: true },
];

// Helper function to get user-friendly error messages
const getErrorMessage = (error) => {
  if (!error) return "An error occurred";
  
  // User errors (validation, duplicates, etc.)
  if (error.message === "NOT_AUTHENTICATED") {
    return "You must be logged in to save changes";
  }
  
  if (error.message === "DUPLICATE_PHONE") {
    return "One or more phone numbers are already assigned to another contact";
  }
  
  if (error.message?.includes("Duplicate phone")) {
    return "Phone number already exists for another contact";
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
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  
  const [editingPerson, setEditingPerson] = useState(null);
  const [viewingPerson, setViewingPerson] = useState(null);
  const [sortType, setSortType] = useState("name-asc");
  const [availableCategories, setAvailableCategories] = useState(
    categories || DEFAULT_CATEGORIES,
  );

  // Duplicate detection state
  const [pendingContacts, setPendingContacts] = useState([]);
  const [duplicateData, setDuplicateData] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);

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
  if (!isHydrated || isDataLoading)
    return <Loader content="Loading contacts..." />;

  /**
   * Check for duplicates and handle accordingly
   * - Auto-skip exact duplicates
   * - Show modal for potential duplicates
   * - Add directly if no duplicates
   */
  const checkAndHandleDuplicates = async (newContacts, action) => {
    // Ensure array
    const contactsArray = Array.isArray(newContacts) ? newContacts : [newContacts];
    
    // Find duplicates (threshold: 0.5 = 50% match)
    const duplicates = batchFindDuplicates(contactsArray, peopleData, 0.5);
    
    // Categorize duplicates
    const exactDuplicates = [];
    const potentialDuplicates = [];
    const noDuplicates = [];
    
    contactsArray.forEach((contact, index) => {
      const dup = duplicates.find(d => d.index === index);
      
      if (!dup) {
        // No duplicates found
        noDuplicates.push(contact);
      } else if (dup.isExactDuplicate) {
        // Exact duplicate - skip automatically
        exactDuplicates.push({ contact, duplicate: dup });
      } else {
        // Potential duplicate - needs user decision
        potentialDuplicates.push({
          newContact: contact,
          duplicates: dup.duplicates
        });
      }
    });
    
    // Auto-skip exact duplicates
    if (exactDuplicates.length > 0) {
      const names = exactDuplicates.map(d => d.contact.name).join(', ');
      toast.info(`Skipped ${exactDuplicates.length} exact duplicate(s)`, {
        description: names.length > 50 ? `${names.substring(0, 50)}...` : names
      });
    }
    
    // Show modal for potential duplicates
    if (potentialDuplicates.length > 0) {
      setPendingContacts(noDuplicates);
      setDuplicateData(potentialDuplicates);
      setPendingAction(action);
      setShowDuplicateModal(true);
      return;
    }
    
    // No duplicates - add directly
    if (noDuplicates.length > 0) {
      await finalizeAddContacts(noDuplicates);
    } else if (exactDuplicates.length === 0) {
      // All were duplicates but handled - show message
      toast.info("No new contacts to add");
    }
  };

  /**
   * Finalize adding contacts (no duplicates)
   */
  const finalizeAddContacts = async (contacts) => {
    const newData = [...peopleData];
    
    contacts.forEach(contact => {
      newData.push({
        ...contact,
        id: contact.id || (Date.now().toString() + Math.random().toString(36).substr(2, 9))
      });
    });
    
    const loadingToast = toast.loading("Adding contacts...");
    
    try {
      await savePeopleData(newData);
      toast.success(`${contacts.length} contact(s) added successfully`, { id: loadingToast });
    } catch (error) {
      console.error("Failed to add contacts:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      throw error; // Re-throw to prevent modal from closing
    }
  };

  /**
   * Handle duplicate resolution from modal
   */
  const handleDuplicateResolution = async (resolutions) => {
    const contactsToAdd = [...pendingContacts]; // Non-duplicate contacts
    const contactsToUpdate = [];
    
    resolutions.forEach(resolution => {
      const { newContact, action, targetContact } = resolution;
      
      switch (action) {
        case 'merge':
          // Merge new contact into existing
          const merged = mergeContacts(targetContact, newContact, {
            preferNew: true,
            mergePhones: true,
            mergeNotes: true
          });
          contactsToUpdate.push(merged);
          break;
          
        case 'replace':
          // Replace existing with new (keep ID)
          contactsToUpdate.push({
            ...newContact,
            id: targetContact.id // Keep existing ID
          });
          break;
          
        case 'skip':
          // Do nothing - keep existing, don't add new
          break;
          
        default:
          console.warn('Unknown resolution action:', action);
      }
    });
    
    // Build final data array
    let finalData = [...peopleData];
    
    // Apply updates
    contactsToUpdate.forEach(updated => {
      const index = finalData.findIndex(p => p.id === updated.id);
      if (index !== -1) {
        finalData[index] = updated;
      }
    });
    
    // Add new contacts
    contactsToAdd.forEach(contact => {
      finalData.push({
        ...contact,
        id: contact.id || (Date.now().toString() + Math.random().toString(36).substr(2, 9))
      });
    });
    
    // Save to database
    const loadingToast = toast.loading("Saving contacts...");
    
    try {
      await savePeopleData(finalData);
      
      const addedCount = contactsToAdd.length;
      const mergedCount = resolutions.filter(r => r.action === 'merge').length;
      const replacedCount = resolutions.filter(r => r.action === 'replace').length;
      const skippedCount = resolutions.filter(r => r.action === 'skip').length;
      
      let message = [];
      if (addedCount > 0) message.push(`${addedCount} added`);
      if (mergedCount > 0) message.push(`${mergedCount} merged`);
      if (replacedCount > 0) message.push(`${replacedCount} replaced`);
      if (skippedCount > 0) message.push(`${skippedCount} skipped`);
      
      toast.success("Contacts saved successfully", {
        description: message.join(', '),
        id: loadingToast
      });
      
      setShowDuplicateModal(false);
      setPendingContacts([]);
      setDuplicateData([]);
      setPendingAction(null);
    } catch (error) {
      console.error("Failed to save contacts:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      // Modal stays open on error
    }
  };

  const handleAddPerson = () => {
    setShowAddModal(true);
  };

  const handleAdd = async (formData) => {
    setShowAddModal(false);
    // Check for duplicates before adding
    await checkAndHandleDuplicates([formData], 'add');
  };

  const handleEditPerson = (person) => {
    setEditingPerson(person);
    setShowEditModal(true);
  };

  const handleEdit = async (formData) => {
    if (!editingPerson) return;

    const newData = peopleData.map((person) =>
      person.id === editingPerson.id ? { ...person, ...formData } : person,
    );

    const loadingToast = toast.loading("Updating contact...");
    
    try {
      await savePeopleData(newData);
      toast.success("Contact updated successfully", { id: loadingToast });
      setShowEditModal(false);
      setEditingPerson(null);
    } catch (error) {
      console.error("Failed to edit contact:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      // Modal stays open on error
    }
  };

  const handleDelete = async (personId) => {
    toast.warning("Are you sure you want to delete this contact?", {
      action: {
        label: "Delete",
        onClick: async () => {
          const newData = peopleData.filter((person) => person.id !== personId);
          const loadingToast = toast.loading("Deleting contact...");
          
          try {
            await savePeopleData(newData);
            toast.success("Contact deleted successfully", { id: loadingToast });
          } catch (error) {
            console.error("Failed to delete contact:", error);
            toast.error(getErrorMessage(error), { id: loadingToast });
          }
        },
      },
      duration: 5000,
    });
  };

  const handleViewDetails = (person) => {
    setViewingPerson(person);
    setShowDetailModal(true);
  };

  const handleCategoriesUpdate = async (
    newCategories,
    fromCategoryId,
    toCategoryId,
  ) => {
    const loadingToast = toast.loading("Updating categories...");
    
    try {
      // Update categories
      setAvailableCategories(newCategories);
      await saveCategories(newCategories);

      // If merging, update people data
      if (fromCategoryId && toCategoryId) {
        const updatedPeople = peopleData.map((person) =>
          person.category === fromCategoryId
            ? { ...person, category: toCategoryId }
            : person,
        );
        await savePeopleData(updatedPeople);
      }
      
      toast.success("Categories updated successfully", { id: loadingToast });
    } catch (error) {
      console.error("Failed to update categories:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
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
    setShowBulkModal(false);
    // Check for duplicates before saving
    await checkAndHandleDuplicates(newPeopleData, 'bulkEdit');
  };

  const handleVCFImport = async (importedContacts) => {
    setShowImportVCFModal(false);
    // Check for duplicates before importing
    await checkAndHandleDuplicates(importedContacts, 'import');
  };

  // Filter and sort data
  const filteredData = peopleData.filter((person) => {
    const matchesSearch =
      !searchTerm ||
      person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (person.phones &&
        person.phones.some((p) =>
          p?.toLowerCase().includes(searchTerm.toLowerCase()),
        )) ||
      person.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      !categoryFilter || person.category === categoryFilter;

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
        peopleData={peopleData}
      />

      <EditPersonModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        editingPerson={editingPerson}
        onSave={handleEdit}
        availableCategories={availableCategories}
        peopleData={peopleData}
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

      <DuplicateContactsModal
        open={showDuplicateModal}
        onOpenChange={setShowDuplicateModal}
        duplicates={duplicateData}
        onResolve={handleDuplicateResolution}
      />
    </>
  );
};