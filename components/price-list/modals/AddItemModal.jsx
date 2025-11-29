import { useState } from "react";
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

const UNIT_OPTIONS = ["piece", "meter", "kg", "liter", "box", "set", "bag"];

export const AddItemModal = ({ open, onOpenChange, type, onAdd }) => {
  const [formData, setFormData] = useState({
    name: "",
    sell: "",
    cost: "",
    sellUnit: "piece",
    costUnit: "piece",
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    onAdd(formData);
    setFormData({
      name: "",
      sell: "",
      cost: "",
      sellUnit: "piece",
      costUnit: "piece",
    });
  };

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
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
