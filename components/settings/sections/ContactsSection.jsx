"use client";

/**
 * components/settings/sections/ContactsSection.jsx
 *
 * The old modal's "Contact Categories" accordion, now saving each action
 * (add/rename/delete/merge) immediately instead of batching everything
 * until the dialog closed — a page has no "close" moment to hook a batch
 * save onto, and each of these is already a deliberate, single-purpose
 * button press, so nothing is lost by committing it right away.
 */

import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  Users,
  FolderTree,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sortCategories } from "@/lib/utils/categoryUtils";
import { toTitleCase } from "@/lib/utils/dataTransform";
import { toast } from "sonner";
import {
  SettingsSectionCard,
  SettingsStatCard,
} from "@/components/settings/SettingsUI";

const MergeCategoryButton = ({ category, categories, onMerge }) => {
  const [showMergeSelect, setShowMergeSelect] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const otherCategories = categories.filter((cat) => cat.id !== category.id);

  const handleMerge = () => {
    if (!targetCategoryId) {
      toast.error("Please select a target category");
      return;
    }
    onMerge(category.id, targetCategoryId);
    setShowMergeSelect(false);
    setTargetCategoryId("");
  };

  if (showMergeSelect) {
    return (
      <div className="flex gap-2">
        <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue placeholder="Merge to..." />
          </SelectTrigger>
          <SelectContent>
            {otherCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleMerge}
          size="sm"
          variant="default"
          className="h-8 px-2"
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => {
            setShowMergeSelect(false);
            setTargetCategoryId("");
          }}
          size="sm"
          variant="ghost"
          className="h-8 px-2"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setShowMergeSelect(true)}
      size="sm"
      variant="outline"
      className="h-8 text-sm gap-1"
    >
      Merge
      <ChevronRight className="w-3 h-3" />
    </Button>
  );
};

export const ContactsSection = ({
  peopleData,
  categories,
  saveCategories,
  savePeopleData,
}) => {
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const getCategoryCount = (categoryId) =>
    peopleData?.filter((p) => p.category === categoryId).length || 0;

  const totalContacts = peopleData?.length ?? 0;
  const categoriesWithContacts = categories.filter(
    (cat) => getCategoryCount(cat.id) > 0,
  ).length;

  const persistCategories = async (next, { loading, success }) => {
    const loadingToast = toast.loading(loading);
    try {
      await saveCategories(next);
      toast.success(success, { id: loadingToast });
    } catch (err) {
      console.error("Error saving categories:", err);
      toast.error("Failed to save categories", { id: loadingToast });
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryLabel.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }
    const exists = categories.some(
      (cat) => cat.label.toLowerCase() === newCategoryLabel.toLowerCase(),
    );
    if (exists) {
      toast.error("A category with this name already exists");
      return;
    }
    const newCategory = {
      id: newCategoryLabel.toLowerCase().replace(/\s+/g, "_"),
      label: toTitleCase(newCategoryLabel),
      isDefault: false,
    };
    persistCategories([...categories, newCategory], {
      loading: "Adding category...",
      success: "Category added",
    });
    setNewCategoryLabel("");
  };

  const handleEditCategory = (categoryId) => {
    const category = categories.find((cat) => cat.id === categoryId);
    if (category) {
      setEditingCategoryId(categoryId);
      setEditingCategoryLabel(toTitleCase(category.label));
    }
  };

  const handleSaveEdit = () => {
    if (!editingCategoryLabel.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }
    const exists = categories.some(
      (cat) =>
        cat.id !== editingCategoryId &&
        cat.label.toLowerCase() === editingCategoryLabel.toLowerCase(),
    );
    if (exists) {
      toast.error("A category with this name already exists");
      return;
    }
    const next = categories.map((cat) =>
      cat.id === editingCategoryId
        ? { ...cat, label: toTitleCase(editingCategoryLabel) }
        : cat,
    );
    persistCategories(next, {
      loading: "Updating category...",
      success: "Category updated",
    });
    setEditingCategoryId(null);
    setEditingCategoryLabel("");
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingCategoryLabel("");
  };

  const handleDeleteCategory = (categoryId) => {
    const count = getCategoryCount(categoryId);
    if (count > 0) {
      toast.error(`Cannot delete category with ${count} contact(s)`, {
        description:
          "Please move or delete contacts first, or merge with another category.",
      });
      return;
    }
    persistCategories(
      categories.filter((cat) => cat.id !== categoryId),
      {
        loading: "Deleting category...",
        success: "Category deleted",
      },
    );
  };

  const handleMergeCategory = (fromCategoryId, toCategoryId) => {
    if (fromCategoryId === toCategoryId) {
      toast.error("Cannot merge a category with itself");
      return;
    }
    const count = getCategoryCount(fromCategoryId);

    toast.warning(`Merge ${count} contact(s) from this category?`, {
      action: {
        label: "Merge",
        onClick: async () => {
          const loadingToast = toast.loading("Merging categories...");
          try {
            const prunedCategories = categories.filter(
              (cat) => cat.id !== fromCategoryId,
            );
            await saveCategories(prunedCategories);

            const updatedPeople = peopleData.map((person) =>
              person.category === fromCategoryId
                ? { ...person, category: toCategoryId }
                : person,
            );
            await savePeopleData(updatedPeople);

            toast.success("Categories merged successfully", {
              id: loadingToast,
            });
          } catch (err) {
            console.error("Error merging categories:", err);
            toast.error("Failed to merge categories", { id: loadingToast });
          }
        },
      },
      duration: 10000,
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <SettingsStatCard
          icon={Users}
          label="Total Contacts"
          value={totalContacts}
        />
        <SettingsStatCard
          icon={FolderTree}
          label="Categories"
          value={categoriesWithContacts}
        />
      </div>

      <SettingsSectionCard
        icon={Tags}
        title="Contact Categories"
        description="Group contacts as customers, suppliers, helpers, or your own custom labels."
        action={
          <Badge variant="secondary">{categories.length} categories</Badge>
        }
      >
        <div className="space-y-4">
          {/* Add New Category */}
          <div className="space-y-2">
            <Label className="text-base">Add New Category</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Category name (e.g., Electrician)"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory();
                }}
              />
              <Button onClick={handleAddCategory} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Existing Categories */}
          <div className="space-y-2">
            <Label className="text-base">Existing Categories</Label>
            <div className="space-y-2">
              {sortCategories(categories).map((category) => {
                const count = getCategoryCount(category.id);
                const isEditing = editingCategoryId === category.id;

                return (
                  <div
                    key={category.id}
                    className={`rounded-lg border transition-all ${
                      isEditing
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="p-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingCategoryLabel}
                            onChange={(e) =>
                              setEditingCategoryLabel(e.target.value)
                            }
                            className="flex-1"
                            autoFocus
                          />
                          <Button
                            onClick={handleSaveEdit}
                            size="sm"
                            variant="default"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            size="sm"
                            variant="ghost"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="font-medium text-base">
                              {category.label}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {count}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => handleEditCategory(category.id)}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>

                            {count > 0 ? (
                              <MergeCategoryButton
                                category={category}
                                categories={categories}
                                onMerge={handleMergeCategory}
                              />
                            ) : (
                              !category.isDefault && (
                                <Button
                                  onClick={() =>
                                    handleDeleteCategory(category.id)
                                  }
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Category Rules:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Categories with contacts cannot be deleted</li>
                  <li>
                    Use merge to move contacts to another category before
                    deleting
                  </li>
                  <li>Default categories can be renamed but not deleted</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
};
