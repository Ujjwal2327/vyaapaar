import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DEFAULT_ACTIVE_UNITS, UNIT_CATEGORIES } from "@/lib/units-config";

// Helper function to create the nested structure of active units
const getNestedActiveUnits = (activeUnits) => {
  const nestedUnits = {};

  // Iterate through all categories
  Object.entries(UNIT_CATEGORIES).forEach(([category, units]) => {
    const activeUnitsInCategory = units.filter((unit) =>
      activeUnits.includes(unit.name)
    );

    if (activeUnitsInCategory.length > 0) {
      // Store the unit names for the selected category
      nestedUnits[category] = activeUnitsInCategory.map((unit) => unit.name);
    }
  });

  return nestedUnits;
};

export const AddItemModal = ({ open, onOpenChange, type, onAdd }) => {
  const [activeUnits, setActiveUnits] = useState(DEFAULT_ACTIVE_UNITS);
  // Store the nested units structure for rendering the select fields
  const [nestedActiveUnits, setNestedActiveUnits] = useState({});

  const [formData, setFormData] = useState({
    name: "",
    retailSell: "",
    bulkSell: "",
    cost: "",
    sellUnit: "piece",
    costUnit: "piece",
    notes: "",
  });

  // Store the discount percentage (retailSell - bulkSell) / retailSell * 100
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState(0);

  useEffect(() => {
    // Load active units from localStorage
    const loadActiveUnits = () => {
      const localUnits = localStorage.getItem("activeUnits");
      let units = DEFAULT_ACTIVE_UNITS;

      if (localUnits) {
        units = JSON.parse(localUnits);
        setActiveUnits(units);
      }

      // Calculate and set the nested structure
      setNestedActiveUnits(getNestedActiveUnits(units));

      // Set default units to first available unit if the current one is not active
      if (units.length > 0 && !units.includes(formData.sellUnit)) {
        setFormData((prev) => ({
          ...prev,
          sellUnit: units[0],
          costUnit: units[0],
        }));
      }
    };

    loadActiveUnits();

    // Reset form when modal closes
    if (!open) {
      setFormData({
        name: "",
        retailSell: "",
        bulkSell: "",
        cost: "",
        sellUnit: activeUnits[0] || "piece",
        costUnit: activeUnits[0] || "piece",
        notes: "",
      });
      setBulkDiscountPercent(0);
    }
  }, [open]);

  // Handle retail sell price change - auto-update bulk price based on discount %
  const handleRetailSellChange = (value) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    
    setFormData((prev) => {
      // If bulk is empty, it will auto-populate on submit
      // If bulk discount % exists, calculate new bulk price
      const newBulkSell = bulkDiscountPercent > 0 
        ? numValue * (1 - bulkDiscountPercent / 100)
        : "";

      return {
        ...prev,
        retailSell: value,
        bulkSell: newBulkSell ? newBulkSell.toFixed(2) : "",
      };
    });
  };

  // Handle bulk sell price change - calculate and store discount %
  const handleBulkSellChange = (value) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    
    setFormData((prev) => {
      const retailNum = parseFloat(prev.retailSell) || 0;
      
      // Calculate discount percentage if retail price exists
      if (retailNum > 0 && numValue < retailNum) {
        const discount = ((retailNum - numValue) / retailNum) * 100;
        setBulkDiscountPercent(discount);
      } else {
        setBulkDiscountPercent(0);
      }

      return {
        ...prev,
        bulkSell: value,
      };
    });
  };

  // Handle cost price change - enforce minimum 0
  const handleCostChange = (value) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    setFormData((prev) => ({
      ...prev,
      cost: value,
    }));
  };

  const handleSubmit = () => {
    if (!isFormValid) return;

    // Ensure all prices are >= 0
    const retailSell = Math.max(0, parseFloat(formData.retailSell) || 0);
    const bulkSell = formData.bulkSell 
      ? Math.max(0, parseFloat(formData.bulkSell))
      : retailSell; // If bulk is empty, default to retail
    const cost = Math.max(0, parseFloat(formData.cost) || 0);

    const dataToSubmit = {
      ...formData,
      retailSell,
      bulkSell,
      cost,
      bulkDiscountPercent, // Store the discount % for future edits
    };

    onAdd(dataToSubmit);

    // Reset form data after submission
    setFormData({
      name: "",
      retailSell: "",
      bulkSell: "",
      cost: "",
      sellUnit: activeUnits[0] || "piece",
      costUnit: activeUnits[0] || "piece",
      notes: "",
    });
    setBulkDiscountPercent(0);
  };

  // Validation logic
  const isFormValid = (() => {
    // Name is always required
    if (!formData.name.trim()) return false;

    // For items, retail sell price is required
    if (type === "item" && !formData.retailSell) return false;

    // All mandatory fields are filled
    return true;
  })();

  // Component to render the Select Content with nested units
  const UnitSelectContent = () => (
    <SelectContent>
      {Object.entries(nestedActiveUnits).map(([category, units]) => (
        <div key={category} className="py-1">
          <h4 className="px-2 py-1.5 text-sm font-semibold text-muted-foreground uppercase">
            {category}
          </h4>
          {units.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {unit.charAt(0).toUpperCase() + unit.slice(1)}
            </SelectItem>
          ))}
        </div>
      ))}
    </SelectContent>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add {type === "category" ? "Category" : "Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name*</Label>
            <Input
              id="name"
              placeholder="Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          {type === "category" && (
            <>
              {/* Category Notes */}
              <div className="space-y-2">
                <Label htmlFor="category-notes">
                  Notes
                </Label>
                <Textarea
                  id="category-notes"
                  placeholder="Add any notes about this category..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={4}
                />
              </div>
            </>
          )}

          {type === "item" && (
            <>
              <div className="flex gap-x-5">
                {/* Retail Sell Price */}
                <div className="space-y-2 flex-1">
                  <Label htmlFor="retailSell">Retail Sell Price*</Label>
                  <Input
                    id="retailSell"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Retail Sell Price"
                    value={formData.retailSell}
                    onChange={(e) => handleRetailSellChange(e.target.value)}
                  />
                </div>

                {/* Bulk Sell Price */}
                <div className="space-y-2 flex-1">
                  <Label htmlFor="bulkSell">
                    Bulk Sell Price
                  </Label>
                  <Input
                    id="bulkSell"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Bulk Sell Price"
                    value={formData.bulkSell}
                    onChange={(e) => handleBulkSellChange(e.target.value)}
                  />
                  {bulkDiscountPercent > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {bulkDiscountPercent.toFixed(1)}% discount
                    </p>
                  )}
                </div>
              </div>

              {/* Sell Unit - Using the new nested structure */}
              <div className="space-y-2">
                <Label htmlFor="sellUnit">Sell Unit</Label>
                <Select
                  value={formData.sellUnit}
                  onValueChange={(value) => {
                    setFormData({
                      ...formData,
                      sellUnit: value,
                      costUnit: formData.costUnit || value,
                    });
                  }}
                >
                  <SelectTrigger id="sellUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <UnitSelectContent />
                </Select>
              </div>

              {/* Cost Price */}
              <div className="space-y-2">
                <Label htmlFor="cost">Cost Price</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cost Price"
                  value={formData.cost}
                  onChange={(e) => handleCostChange(e.target.value)}
                />
              </div>

              {/* Cost Unit - Using the new nested structure */}
              <div className="space-y-2">
                <Label htmlFor="costUnit">Cost Unit</Label>
                <Select
                  value={formData.costUnit}
                  onValueChange={(value) =>
                    setFormData({ ...formData, costUnit: value })
                  }
                >
                  <SelectTrigger id="costUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <UnitSelectContent />
                </Select>
              </div>

              {/* Notes/Textarea */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any specific details, supplier info, or remarks..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </>
          )}

          <Button 
            onClick={handleSubmit} 
            className="w-full"
            disabled={!isFormValid}
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};