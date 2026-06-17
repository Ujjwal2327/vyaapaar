/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useMemo } from "react";
import { usePeople } from "@/hooks/usePeople";
import { PeopleHeader } from "./PeopleHeader";
import { PeopleContent } from "./PeopleContent";
import { AddPersonModal } from "./modals/AddPersonModal";
import { EditPersonModal } from "./modals/EditPersonModal";
import { PersonDetailModal } from "./modals/PersonDetailModal";
import { BulkEditPeopleModal } from "./modals/BulkEditPeopleModal";
import { ExportPDFModal } from "./modals/ExportPDFModal";
import { ImportVCFModal } from "./modals/ImportVCFModal";
import { FindDuplicatesModal } from "./modals/FindDuplicatesModal";
import { toast } from "sonner";
import Loader from "../Loader";
import { areContactsIdentical } from "@/lib/utils/duplicateContactUtils";
import { photoCache } from "@/lib/utils/photoCache";

const DEFAULT_CATEGORIES = [
  { id: "customer", label: "Customer", isDefault: true },
  { id: "supplier", label: "Supplier", isDefault: true },
  { id: "helper", label: "Helper", isDefault: true },
  { id: "other", label: "Other", isDefault: true },
];

// Helper function to get user-friendly error messages
const getErrorMessage = (error) => {
  if (!error) return "An error occurred";

  // User errors (validation, etc.)
  if (error.message === "NOT_AUTHENTICATED") {
    return "You must be logged in to save changes";
  }

  // Contact has linked transactions — cannot delete
  if (error.message?.startsWith("CONTACT_HAS_TRANSACTIONS:")) {
    const names = error.message.split("CONTACT_HAS_TRANSACTIONS:")[1];
    return `Cannot delete "${names}" — this contact has existing transactions. Delete or reassign their transactions first.`;
  }

  // Server/DB errors - generic message
  if (
    error.message?.includes("fetch") ||
    error.message?.includes("network") ||
    error.code?.startsWith("PGRST")
  ) {
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
  const [showFindDuplicatesModal, setShowFindDuplicatesModal] = useState(false);

  const [editingPerson, setEditingPerson] = useState(null);
  const [viewingPerson, setViewingPerson] = useState(null);
  const [sortType, setSortType] = useState("name-asc");
  const [availableCategories, setAvailableCategories] = useState(
    categories || DEFAULT_CATEGORIES,
  );

  // Filter categories to only include those with contacts
  const categoriesWithContacts = useMemo(() => {
    return availableCategories.filter((cat) =>
      peopleData.some((person) => person.category === cat.id),
    );
  }, [availableCategories, peopleData]);

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
   * Check for exact duplicates and auto-skip them.
   *
   * For "add" / "import" actions: skip contacts that are exact duplicates of
   * existing contacts that are NOT being touched by this operation.
   *
   * For "bulkEdit" action: the incoming list IS the full intended replacement
   * for all contacts.  We must never silently drop contacts here, because
   * finalizeBulkEdit calls savePeopleData with the full list and any missing
   * ID will be deleted from the DB.  Instead we only warn about new contacts
   * (no existing ID) that are exact copies of a contact already in the list,
   * and let the rest through unchanged.
   */
  const checkAndHandleDuplicates = async (newContacts, action) => {
    // Ensure array
    const contactsArray = Array.isArray(newContacts)
      ? newContacts
      : [newContacts];

    if (action === "bulkEdit") {
      // For bulk edit we do NOT filter the list — doing so would permanently
      // delete any "skipped" contact from the DB.  We only check for new
      // entries (no pre-existing ID) that duplicate an already-present entry,
      // and warn without removing anything.
      const newEntries = contactsArray.filter((c) => {
        const isNew = !peopleData.some((p) => p.id === c.id);
        return isNew;
      });
      const existingEntries = contactsArray.filter((c) =>
        peopleData.some((p) => p.id === c.id),
      );

      const skipped = [];
      const toAdd = [];
      newEntries.forEach((contact) => {
        const isDupe = existingEntries.some((existing) =>
          areContactsIdentical(contact, existing),
        );
        if (isDupe) {
          skipped.push(contact);
        } else {
          toAdd.push(contact);
        }
      });

      if (skipped.length > 0) {
        const names = skipped.map((d) => d.name).join(", ");
        toast.info(`Skipped ${skipped.length} exact duplicate(s)`, {
          description:
            names.length > 50 ? `${names.substring(0, 50)}...` : names,
        });
      }

      // Save: existing contacts (always kept) + new non-duplicate contacts
      await finalizeBulkEdit([...existingEntries, ...toAdd]);
      return;
    }

    // "add" / "import": check against contacts NOT included in this operation
    const existingContactsToCheck = peopleData;

    const exactDuplicates = [];
    const uniqueContacts = [];

    contactsArray.forEach((contact) => {
      const isExactDuplicate = existingContactsToCheck.some((existing) =>
        areContactsIdentical(contact, existing),
      );

      if (isExactDuplicate) {
        exactDuplicates.push(contact);
      } else {
        uniqueContacts.push(contact);
      }
    });

    // Auto-skip exact duplicates
    if (exactDuplicates.length > 0) {
      const names = exactDuplicates.map((d) => d.name).join(", ");
      toast.info(`Skipped ${exactDuplicates.length} exact duplicate(s)`, {
        description: names.length > 50 ? `${names.substring(0, 50)}...` : names,
      });
    }

    // Process unique contacts
    if (uniqueContacts.length > 0) {
      await finalizeAddContacts(uniqueContacts);
    } else if (exactDuplicates.length === 0) {
      // No contacts at all
      toast.info("No contacts to add");
    }
  };

  /**
   * Finalize adding contacts (no duplicates)
   */
  const finalizeAddContacts = async (contacts) => {
    const newData = [...peopleData];

    contacts.forEach((contact) => {
      const id = contact.id || crypto.randomUUID(); // ← was Date.now().toString() + Math.random()...

      // BUG FIX: usePeople's contactToRow only ever reads the photo from
      // photoCache (it ignores any `photo` field on the contact object).
      // AddPersonModal / VCF import / device-contact import all attach the
      // uploaded photo as a `photo` field on the contact, which was
      // previously silently dropped because it never made it into the
      // cache. Persist it here, under the FINAL id, before savePeopleData
      // runs.
      if (contact.photo && contact.photo.trim()) {
        photoCache.set(id, contact.photo.trim());
      }

      newData.push({
        ...contact,
        id,
      });
    });

    const loadingToast = toast.loading("Adding contacts...");

    try {
      await savePeopleData(newData);
      toast.success(`${contacts.length} contact(s) added successfully`, {
        id: loadingToast,
      });
    } catch (error) {
      console.error("Failed to add contacts:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      throw error;
    }
  };

  /**
   * Finalize bulk edit (no duplicates)
   */
  const finalizeBulkEdit = async (contacts) => {
    const loadingToast = toast.loading("Saving contacts...");

    try {
      await savePeopleData(contacts);
      toast.success(`${contacts.length} contact(s) saved successfully`, {
        id: loadingToast,
      });
      setShowBulkModal(false);
    } catch (error) {
      console.error("Failed to save contacts:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
      throw error;
    }
  };

  /**
   * Handle merging duplicates from Find Duplicates feature
   */
  const handleFindDuplicatesMerge = async (
    mergedContacts,
    contactsToDeleteIds,
  ) => {
    const loadingToast = toast.loading("Merging duplicates...");

    try {
      // Remove deleted contacts and update merged ones
      let finalData = peopleData.filter(
        (p) => !contactsToDeleteIds.includes(p.id),
      );

      // Update merged contacts
      mergedContacts.forEach((merged) => {
        const index = finalData.findIndex((p) => p.id === merged.id);
        if (index !== -1) {
          finalData[index] = merged;
        }
      });

      await savePeopleData(finalData);

      // Remove cache entries for contacts that no longer exist so stale
      // photos don't linger in localStorage indefinitely.
      contactsToDeleteIds.forEach((id) => photoCache.remove(id));

      toast.success("Duplicates merged successfully", {
        description: `Merged ${mergedContacts.length} group(s), removed ${contactsToDeleteIds.length} duplicate(s)`,
        id: loadingToast,
      });

      setShowFindDuplicatesModal(false);
    } catch (error) {
      console.error("Failed to merge duplicates:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
    }
  };

  const handleAddPerson = () => {
    setShowAddModal(true);
  };

  const handleAdd = async (formData) => {
    setShowAddModal(false);
    // Check for duplicates before adding
    await checkAndHandleDuplicates([formData], "add");
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
      if (fromCategoryId && toCategoryId) {
        // Merge: remove the source category from the list before saving so the
        // DB reflects the post-merge state.  The SettingsModal passes the
        // full pre-merge list as newCategories so that it can do the contact
        // migration here, but we must save the pruned version to the DB.
        const prunedCategories = newCategories.filter(
          (cat) => cat.id !== fromCategoryId,
        );
        setAvailableCategories(prunedCategories);
        await saveCategories(prunedCategories);

        // Migrate contacts from the removed category to the target category
        const updatedPeople = peopleData.map((person) =>
          person.category === fromCategoryId
            ? { ...person, category: toCategoryId }
            : person,
        );
        await savePeopleData(updatedPeople);
      } else {
        // Non-merge update (rename, add, delete)
        setAvailableCategories(newCategories);
        await saveCategories(newCategories);
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

  const handleFindDuplicates = () => {
    setShowFindDuplicatesModal(true);
  };

  const handleBulkSave = async (newPeopleData) => {
    // Check for duplicates before saving
    await checkAndHandleDuplicates(newPeopleData, "bulkEdit");
  };

  const handleVCFImport = async (importedContacts) => {
    setShowImportVCFModal(false);
    // Check for duplicates before importing
    await checkAndHandleDuplicates(importedContacts, "import");
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

  // Find category for viewing person
  const viewingPersonCategory = viewingPerson
    ? availableCategories?.find((cat) => cat.id === viewingPerson.category)
    : null;

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
        onFindDuplicates={handleFindDuplicates}
        sortType={sortType}
        onSortChange={handleSortChange}
        totalCount={peopleData.length}
        filteredCount={sortedData.length}
        peopleData={peopleData}
        onCategoriesUpdate={handleCategoriesUpdate}
        availableCategories={availableCategories}
        categoriesWithContacts={categoriesWithContacts}
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
        category={viewingPersonCategory}
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
        availableCategories={categoriesWithContacts}
      />

      <ImportVCFModal
        open={showImportVCFModal}
        onOpenChange={setShowImportVCFModal}
        onImport={handleVCFImport}
        availableCategories={availableCategories}
      />

      <FindDuplicatesModal
        open={showFindDuplicatesModal}
        onOpenChange={setShowFindDuplicatesModal}
        peopleData={peopleData}
        onMerge={handleFindDuplicatesMerge}
      />
    </>
  );
};
