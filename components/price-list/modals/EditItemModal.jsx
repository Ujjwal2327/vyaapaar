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

  // 1. Sync data when the modal opens or editingItem changes
  useEffect(() => {
    // Check if editingItem exists and has item data
    if (editingItem && editingItem.data) {
      // Initialize formData with the item data and ensure 'notes' and 'name' are present
      setFormData(editingItem.data);
    } else if (!editingItem && formData !== null) {
      // Reset form data when the modal closes or editingItem is cleared
      setFormData(null);
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

  const handleSubmit = () => {
    if (!formData || !formData.name.trim()) return;
    onSave(formData);
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
              value={formData.name} // <-- This is the crucial field binding
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          {/* Sell Price */}
          <div className="space-y-2">
            <Label htmlFor="sell">Sell Price</Label>
            <Input
              id="sell"
              type="number"
              placeholder="Sell Price"
              value={formData.sell}
              onChange={(e) =>
                setFormData({ ...formData, sell: e.target.value })
              }
            />
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
              placeholder="Cost Price"
              value={formData.cost}
              onChange={(e) =>
                setFormData({ ...formData, cost: e.target.value })
              }
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
              value={formData.notes}
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
