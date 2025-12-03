import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DEFAULT_ACTIVE_UNITS, UNIT_CATEGORIES } from "@/lib/units-config"; // <-- Import UNIT_CATEGORIES

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

// Assuming you pass the item data via a prop like `initialData`
// and a function to save changes like `onSave`
export const EditItemModal = ({ open, onOpenChange, initialData, onSave }) => {
  const [activeUnits, setActiveUnits] = useState(DEFAULT_ACTIVE_UNITS);
  const [nestedActiveUnits, setNestedActiveUnits] = useState({}); // <-- State for nested units
  const [formData, setFormData] = useState(
    initialData || {
      name: "",
      sell: "",
      cost: "",
      sellUnit: "piece",
      costUnit: "piece",
    }
  );

  // Sync initialData with local state when modal opens or initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

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
    };

    loadActiveUnits();
  }, [open]);

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    onSave(formData); // Call the save function with the updated data
  };

  // Component to render the Select Content with nested units
  const UnitSelectContent = () => (
    <SelectContent>
      {Object.entries(nestedActiveUnits).map(([category, units]) => (
        // Simulating optgroup/SelectGroup using a div and header
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
              <UnitSelectContent /> {/* <-- Using nested content */}
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
              <UnitSelectContent /> {/* <-- Using nested content */}
            </Select>
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
