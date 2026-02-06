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

export const EditItemModal = ({ open, onOpenChange, editingItem, onSave }) => {
  const [activeUnits, setActiveUnits] = useState(DEFAULT_ACTIVE_UNITS);
  const [nestedActiveUnits, setNestedActiveUnits] = useState({});
  // Initialize state as null/empty default for safe conditional rendering
  const [formData, setFormData] = useState(null);
  
  // Store the bulk discount percentage for real-time calculation
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState(0);

  // 1. Sync data when the modal opens or editingItem changes
  useEffect(() => {
    // Check if editingItem exists and has item data
    if (editingItem && editingItem.data) {
      // Handle backward compatibility: convert old 'sell' to 'retailSell'
      const itemData = editingItem.data;
      const retailSell = itemData.retailSell !== undefined ? itemData.retailSell : itemData.sell || 0;
      const bulkSell = itemData.bulkSell !== undefined ? itemData.bulkSell : retailSell;
      
      // Calculate existing discount percentage
      let existingDiscount = 0;
      if (retailSell > 0 && bulkSell < retailSell) {
        existingDiscount = ((retailSell - bulkSell) / retailSell) * 100;
      }
      // Use stored discount if available, otherwise calculate
      const discount = itemData.bulkDiscountPercent !== undefined 
        ? itemData.bulkDiscountPercent 
        : existingDiscount;
      
      setBulkDiscountPercent(discount);
      
      setFormData({
        ...itemData,
        retailSell,
        bulkSell,
      });
    } else if (!editingItem && formData !== null) {
      // Reset form data when the modal closes or editingItem is cleared
      setFormData(null);
      setBulkDiscountPercent(0);
    }
  }, [editingItem]);

  // 2. Load active units only once when open state changes
  useEffect(() => {
    const loadActiveUnits = () => {
      const localUnits = localStorage.getItem("activeUnits");
      let units = DEFAULT_ACTIVE_UNITS;

      if (localUnits) {
        units = JSON.parse(localUnits);
        setActiveUnits(units);
      }

      setNestedActiveUnits(getNestedActiveUnits(units));
    };

    loadActiveUnits();
  }, [open]);

  // Handle retail sell price change - auto-update bulk price based on discount %
  const handleRetailSellChange = (value) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    
    setFormData((prev) => {
      // Calculate new bulk price based on stored discount %
      const newBulkSell = bulkDiscountPercent > 0 
        ? numValue * (1 - bulkDiscountPercent / 100)
        : prev.bulkSell;

      return {
        ...prev,
        retailSell: value,
        bulkSell: typeof newBulkSell === 'number' ? newBulkSell.toFixed(2) : newBulkSell,
      };
    });
  };

  // Handle bulk sell price change - recalculate and store new discount %
  const handleBulkSellChange = (value) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    
    setFormData((prev) => {
      const retailNum = parseFloat(prev.retailSell) || 0;
      
      // Calculate new discount percentage
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
    if (!formData || !formData.name.trim()) return;
    
    // Ensure all prices are >= 0
    const retailSell = Math.max(0, parseFloat(formData.retailSell) || 0);
    const bulkSell = formData.bulkSell 
      ? Math.max(0, parseFloat(formData.bulkSell))
      : retailSell;
    const cost = Math.max(0, parseFloat(formData.cost) || 0);
    
    const dataToSubmit = {
      ...formData,
      retailSell,
      bulkSell,
      cost,
      bulkDiscountPercent, // Store the current discount % for future edits
    };
    
    onSave(dataToSubmit);
  };

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

  // Render nothing if item data hasn't been loaded yet
  if (!formData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="flex gap-x-5">
            {/* Retail Sell Price */}
            <div className="space-y-2 flex-1">
              <Label htmlFor="retailSell">Retail Sell Price</Label>
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
                Bulk Sell Price{" "}
                <span className="text-xs text-muted-foreground">
                  (Optional)
                </span>
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
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any specific details, supplier info, or remarks..."
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};