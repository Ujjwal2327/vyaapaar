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
  }, [open]);

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    // If bulk sell is empty, set it to retail sell
    const dataToSubmit = {
      ...formData,
      bulkSell: formData.bulkSell || formData.retailSell,
    };

    onAdd(dataToSubmit);

    // Resetting form data after submission
    setFormData({
      name: "",
      retailSell: "",
      bulkSell: "",
      cost: "",
      sellUnit: activeUnits[0] || "piece",
      costUnit: activeUnits[0] || "piece",
      notes: "",
    });
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
          <DialogTitle>
            Add {type === "category" ? "Category" : "Item"}
          </DialogTitle>
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

          {type === "item" && (
            <>
              <div className="flex gap-x-5">

              {/* Retail Sell Price */}
              <div className="space-y-2">
                <Label htmlFor="retailSell">Retail Sell Price</Label>
                <Input
                  id="retailSell"
                  type="number"
                  placeholder="Retail Sell Price"
                  value={formData.retailSell}
                  onChange={(e) =>
                    setFormData({ ...formData, retailSell: e.target.value })
                  }
                />
              </div>

              {/* Bulk Sell Price */}
              <div className="space-y-2">
                <Label htmlFor="bulkSell">
                  Bulk Sell Price{" "}
                  <span className="text-xs text-muted-foreground">
                    (Optional)
                  </span>
                </Label>
                <Input
                  id="bulkSell"
                  type="number"
                  placeholder="Bulk Sell Price"
                  value={formData.bulkSell}
                  onChange={(e) =>
                    setFormData({ ...formData, bulkSell: e.target.value })
                  }
                />
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
            </>
          )}

          <Button onClick={handleSubmit} className="w-full">
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};