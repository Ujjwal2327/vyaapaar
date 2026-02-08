"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Search,
  Plus,
  Edit2,
  Trash2,
  Users,
  AlertCircle,
  X,
  Package,
  FolderTree,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UNIT_CATEGORIES,
  DEFAULT_ACTIVE_UNITS,
  unitMatchesQuery,
} from "@/lib/units-config";
import { supabase } from "@/lib/supabase";
import UserProfile from "@/components/UserProfile";
import ShareBusinessLink from "@/components/ShareBusinessLink";
import { countItemsAndCategories } from "@/lib/utils/priceListStats";
import { sortCategories } from "@/lib/utils/categoryUtils";
import Accordion from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const DEFAULT_CONTACT_CATEGORIES = [
  { id: "customer", label: "Customer", isDefault: true },
  { id: "supplier", label: "Supplier", isDefault: true },
  { id: "helper", label: "Helper", isDefault: true },
  { id: "other", label: "Other", isDefault: true },
];

/**
 * Unified Settings Modal
 * Adapts content based on current page:
 * - /catalog: Shows catalog-specific settings (units, cost/profit toggle)
 * - /contacts: Shows people-specific settings (contact categories)
 * - Common: Profile, Business Link, Display Settings, Logout
 */
const SettingsModal = ({
  // Catalog-specific props
  sellPriceMode,
  toggleSellPriceMode,
  // People-specific props
  peopleData,
  onCategoriesUpdate,
}) => {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [isSaving, setIsSaving] = useState(false);

  // Catalog-specific states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUnits, setActiveUnits] = useState(DEFAULT_ACTIVE_UNITS);
  const [initialActiveUnits, setInitialActiveUnits] = useState(DEFAULT_ACTIVE_UNITS);
  const [showCostProfit, setShowCostProfit] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);

  // People-specific states
  const [contactCategories, setContactCategories] = useState(DEFAULT_CONTACT_CATEGORIES);
  const [initialContactCategories, setInitialContactCategories] = useState(DEFAULT_CONTACT_CATEGORIES);
  const [totalContacts, setTotalContacts] = useState(0);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  // Determine current page context
  const isCatalogPage = pathname?.includes("/catalog");
  const isPeoplePage = pathname?.includes("/contacts");

  // Load settings based on context
  useEffect(() => {
    const loadSettings = async () => {
      // Load common settings
      const savedFontSize = localStorage.getItem("fontSize") || "100";
      setFontSize(parseInt(savedFontSize));
      document.documentElement.style.fontSize = `${savedFontSize}%`;

      if (!user?.id) return;

      try {
        if (isCatalogPage) {
          await loadCatalogSettings();
        }

        if (isPeoplePage) {
          await loadPeopleSettings();
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    if (isOpen) {
      loadSettings();
    }
  }, [user, isOpen, isCatalogPage, isPeoplePage]);

  const loadCatalogSettings = async () => {
    // Show Cost/Profit setting
    const savedShowCostProfit = localStorage.getItem("showCostProfit");
    setShowCostProfit(savedShowCostProfit === "true");

    // Active units
    const { data, error } = await supabase
      .from("price_lists")
      .select("active_units, data")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      if (data.active_units) {
        setActiveUnits(data.active_units);
        setInitialActiveUnits(data.active_units);
        localStorage.setItem("activeUnits", JSON.stringify(data.active_units));
      }

      if (data.data) {
        const { itemCount, categoryCount } = countItemsAndCategories(data.data);
        setTotalItems(itemCount);
        setTotalCategories(categoryCount);
      }
    }
  };

  const loadPeopleSettings = async () => {
    const { data, error } = await supabase
      .from("people")
      .select("categories, data")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      if (data.categories) {
        setContactCategories(data.categories);
        setInitialContactCategories(data.categories);
      }
      if (data.data) {
        setTotalContacts(data.data.length);
      }
    }
  };

  const handleCloseDialog = async (open) => {
    if (!open && isOpen) {
      // Save changes on close
      if (isCatalogPage) {
        const unitsChanged =
          JSON.stringify(activeUnits) !== JSON.stringify(initialActiveUnits);
        if (unitsChanged) {
          await saveUnitsToDb();
        }
      }

      if (isPeoplePage) {
        const categoriesChanged =
          JSON.stringify(contactCategories) !==
          JSON.stringify(initialContactCategories);
        if (categoriesChanged) {
          await saveCategoriestoDb();
        }
      }
    }
    setIsOpen(open);
  };

  const saveUnitsToDb = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("price_lists")
        .update({ active_units: activeUnits })
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error saving active units:", error);
      toast.error("Failed to save units to database");
    } finally {
      setIsSaving(false);
    }
  };

  const saveCategoriestoDb = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("people")
        .update({ categories: contactCategories })
        .eq("user_id", user.id);

      if (error) throw error;

      if (onCategoriesUpdate) {
        onCategoriesUpdate(contactCategories);
      }
    } catch (error) {
      console.error("Error saving categories:", error);
      toast.error("Failed to save categories to database");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFontSizeChange = (value) => {
    const newSize = value[0];
    setFontSize(newSize);
    localStorage.setItem("fontSize", newSize.toString());
    document.documentElement.style.fontSize = `${newSize}%`;
  };

  const resetSettings = () => {
    setTheme("system");
    setFontSize(100);
    localStorage.setItem("fontSize", "100");
    document.documentElement.style.fontSize = "100%";
    
    if (isCatalogPage) {
      setShowCostProfit(false);
      localStorage.setItem("showCostProfit", "false");
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
    setIsOpen(false);
  };

  // Catalog-specific handlers
  const toggleUnit = (unitName) => {
    setActiveUnits((prev) => {
      const newUnits = prev.includes(unitName)
        ? prev.filter((u) => u !== unitName)
        : [...prev, unitName];
      localStorage.setItem("activeUnits", JSON.stringify(newUnits));
      return newUnits;
    });
  };

  const toggleShowCostProfit = (checked) => {
    setShowCostProfit(checked);
    localStorage.setItem("showCostProfit", checked.toString());
  };

  const getFilteredCategories = () => {
    if (!searchQuery.trim()) return UNIT_CATEGORIES;

    const filtered = {};
    Object.entries(UNIT_CATEGORIES).forEach(([category, units]) => {
      const matchedUnits = units.filter((unit) =>
        unitMatchesQuery(unit, searchQuery)
      );
      if (matchedUnits.length > 0) {
        filtered[category] = matchedUnits;
      }
    });
    return filtered;
  };

  // People-specific handlers
  const getCategoryCount = (categoryId) => {
    return peopleData?.filter((person) => person.category === categoryId).length || 0;
  };

  const handleAddCategory = () => {
    if (!newCategoryLabel.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }

    const exists = contactCategories.some(
      (cat) => cat.label.toLowerCase() === newCategoryLabel.toLowerCase()
    );
    if (exists) {
      toast.error("A category with this name already exists");
      return;
    }

    const newCategory = {
      id: newCategoryLabel.toLowerCase().replace(/\s+/g, "_"),
      label: newCategoryLabel.trim(),
      isDefault: false,
    };

    setContactCategories([...contactCategories, newCategory]);
    setNewCategoryLabel("");
    toast.success("Category added");
  };

  const handleEditCategory = (categoryId) => {
    const category = contactCategories.find((cat) => cat.id === categoryId);
    if (category) {
      setEditingCategoryId(categoryId);
      setEditingCategoryLabel(category.label);
    }
  };

  const handleSaveEdit = () => {
    if (!editingCategoryLabel.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }

    const exists = contactCategories.some(
      (cat) =>
        cat.id !== editingCategoryId &&
        cat.label.toLowerCase() === editingCategoryLabel.toLowerCase()
    );
    if (exists) {
      toast.error("A category with this name already exists");
      return;
    }

    setContactCategories(
      contactCategories.map((cat) =>
        cat.id === editingCategoryId
          ? { ...cat, label: editingCategoryLabel.trim() }
          : cat
      )
    );
    setEditingCategoryId(null);
    setEditingCategoryLabel("");
    toast.success("Category updated");
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingCategoryLabel("");
  };

  const handleDeleteCategory = (categoryId) => {
    const count = getCategoryCount(categoryId);
    if (count > 0) {
      toast.error(`Cannot delete category with ${count} contact(s)`, {
        description: "Please move or delete contacts first, or merge with another category.",
      });
      return;
    }

    setContactCategories(contactCategories.filter((cat) => cat.id !== categoryId));
    toast.success("Category deleted");
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
        onClick: () => {
          if (onCategoriesUpdate) {
            onCategoriesUpdate(contactCategories, fromCategoryId, toCategoryId);
          }

          setContactCategories(
            contactCategories.filter((cat) => cat.id !== fromCategoryId)
          );
          toast.success("Categories merged successfully");
        },
      },
      duration: 10000,
    });
  };

  const filteredUnitCategories = getFilteredCategories();

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription>
            Customize your experience and manage your {isCatalogPage ? "catalog" : isPeoplePage ? "contacts" : "application"}
          </DialogDescription>
        </DialogHeader>

        {/* Stats Section */}
        {(isCatalogPage || isPeoplePage) && (
          <div className="grid grid-cols-2 gap-3 pb-2">
            {isCatalogPage && (
              <>
                <div className="flex items-center gap-3 p-3 bg-linear-to-br from-primary/10 to-primary/5 rounded-lg border">
                  <Package className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{totalItems}</p>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-linear-to-br from-secondary/10 to-secondary/5 rounded-lg border">
                  <FolderTree className="w-8 h-8 text-secondary-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{totalCategories}</p>
                    <p className="text-sm text-muted-foreground">Categories</p>
                  </div>
                </div>
              </>
            )}
            {isPeoplePage && (
              <>
                <div className="flex items-center gap-3 p-3 bg-linear-to-br from-primary/10 to-primary/5 rounded-lg border">
                  <Users className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{totalContacts}</p>
                    <p className="text-sm text-muted-foreground">Total Contacts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-linear-to-br from-secondary/10 to-secondary/5 rounded-lg border">
                  <Users className="w-8 h-8 text-secondary-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{contactCategories.length}</p>
                    <p className="text-sm text-muted-foreground">Categories</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <ScrollArea className="flex-1 max-h-[calc(90vh-200px)]">
          <div className="space-y-3">
            {/* User Profile Accordion */}
            <Accordion title="User Profile" defaultOpen={false}>
              <UserProfile />
            </Accordion>

            {/* Share Business Link Accordion */}
            <Accordion title="Share Your Business" defaultOpen={false}>
              <ShareBusinessLink />
            </Accordion>

            {/* Display Settings Accordion */}
            <Accordion title="Display Settings">
              <div className="space-y-5">
                {/* Theme Toggle */}
                <div className="space-y-2">
                  <Label className="text-[16px]">Theme</Label>
                  <Button
                    onClick={() => {
                      theme === "light" ? setTheme("dark") : setTheme("light");
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    {theme === "light" ? (
                      <span className="flex gap-2 items-center">
                        <Sun className="h-4 w-4" />
                        <span>Light Theme</span>
                      </span>
                    ) : theme === "dark" ? (
                      <span className="flex gap-2 items-center">
                        <Moon className="h-4 w-4" />
                        <span>Dark Theme</span>
                      </span>
                    ) : (
                      <span className="flex gap-2 items-center">
                        <Monitor className="h-4 w-4" />
                        <span>System Theme</span>
                      </span>
                    )}
                  </Button>
                </div>

                {/* Font Size Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[16px]">Font Size</Label>
                    <span className="text-xs text-muted-foreground">
                      {fontSize}%
                    </span>
                  </div>

                  <Slider
                    value={[fontSize]}
                    onValueChange={handleFontSizeChange}
                    min={75}
                    max={150}
                    step={5}
                    className="w-full"
                  />

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Small</span>
                    <span>Large</span>
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-center font-medium text-sm">
                      Preview Text
                    </p>
                    <p className="text-center text-xs text-muted-foreground mt-1">
                      The quick brown fox jumps over the lazy dog
                    </p>
                  </div>
                </div>

                {/* Show Cost/Profit Toggle - Only for Catalog */}
                {isCatalogPage && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-[16px]">
                        Show Cost Prices & Profits
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Enable cycling between Sell, Cost, and Profit views
                      </p>
                    </div>
                    <Switch
                      checked={showCostProfit}
                      onCheckedChange={toggleShowCostProfit}
                    />
                  </div>
                )}

                <Button
                  onClick={resetSettings}
                  variant="secondary"
                  className="w-full mt-2"
                  size="sm"
                >
                  Reset Display Settings
                </Button>
              </div>
            </Accordion>

            {/* Active Units - Only for Catalog */}
            {isCatalogPage && (
              <Accordion
                title="Active Units"
                badge={`${activeUnits.length} selected`}
              >
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search units (e.g., 'kg', 'meter', 'ft')..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Units by Category */}
                  <div className="space-y-4 max-h-80 overflow-y-auto no-scrollbar border rounded-lg p-3 pt-0">
                    {Object.keys(filteredUnitCategories).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No units found
                      </p>
                    ) : (
                      Object.entries(filteredUnitCategories).map(
                        ([category, units]) => (
                          <div key={category} className="space-y-2">
                            <h4 className="font-semibold text-sm uppercase text-muted-foreground sticky top-0 bg-background py-2">
                              {category}
                            </h4>
                            <div className="space-y-1">
                              {units.map((unit) => (
                                <div
                                  key={unit.name}
                                  className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors"
                                >
                                  <Checkbox
                                    id={unit.name}
                                    checked={activeUnits.includes(unit.name)}
                                    onCheckedChange={() => toggleUnit(unit.name)}
                                  />
                                  <label
                                    htmlFor={unit.name}
                                    className="text-sm cursor-pointer capitalize flex-1"
                                  >
                                    {unit.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              </Accordion>
            )}

            {/* Contact Categories - Only for People */}
            {isPeoplePage && (
              <Accordion
                title="Contact Categories"
                badge={`${contactCategories.length} categories`}
              >
                <div className="space-y-4">
                  {/* Add New Category */}
                  <div className="space-y-2">
                    <Label className="text-[16px]">Add New Category</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Category name (e.g., Electrician)"
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleAddCategory();
                          }
                        }}
                      />
                      <Button onClick={handleAddCategory} size="icon">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Existing Categories - Improved UI */}
                  <div className="space-y-2">
                    <Label className="text-[16px]">Existing Categories</Label>
                    <div className="space-y-2">
                      {sortCategories(contactCategories).map((category) => {
                        const count = getCategoryCount(category.id);
                        const isEditing = editingCategoryId === category.id;

                        return (
                          <div
                            key={category.id}
                            className={`group relative rounded-lg border transition-all ${
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
                                        categories={contactCategories}
                                        onMerge={handleMergeCategory}
                                      />
                                    ) : (
                                      <Button
                                        onClick={() =>
                                          handleDeleteCategory(category.id)
                                        }
                                        size="sm"
                                        variant="ghost"
                                        disabled={category.isDefault}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
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

                  <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2">
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
              </Accordion>
            )}

            <Separator className="my-4" />

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
            >
              Logout
            </Button>
          </div>
        </ScrollArea>

        {isSaving && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
            <div className="bg-card p-4 rounded-lg shadow-lg border">
              <p className="text-sm font-medium">Saving changes...</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Merge Category Button Component
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
        <Button onClick={handleMerge} size="sm" variant="default" className="h-8 px-2">
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
      className="h-8 text-xs gap-1"
    >
      Merge
      <ChevronRight className="w-3 h-3" />
    </Button>
  );
};

export default SettingsModal;