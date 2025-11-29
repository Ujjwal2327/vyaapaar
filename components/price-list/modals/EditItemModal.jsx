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

const UNIT_OPTIONS = ["piece", "meter", "kg", "liter", "box", "set", "bag"];

export const EditItemModal = ({ open, onOpenChange, editingItem, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    sell: "",
    cost: "",
    sellUnit: "piece",
    costUnit: "piece",
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.path.split(".").pop(),
        sell: editingItem.data.sell || 0,
        cost: editingItem.data.cost || 0,
        sellUnit: editingItem.data.sellUnit || "piece",
        costUnit:
          editingItem.data.costUnit || editingItem.data.sellUnit || "piece",
      });
    }
  }, [editingItem]);

  const handleSubmit = () => {
    if (!formData.name) return;
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              placeholder="Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-sell">Sell Price</Label>
            <Input
              id="edit-sell"
              type="number"
              placeholder="Sell Price"
              value={formData.sell}
              onChange={(e) =>
                setFormData({ ...formData, sell: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-sellUnit">Sell Unit</Label>
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
              <SelectTrigger id="edit-sellUnit">
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
            <Label htmlFor="edit-cost">Cost Price</Label>
            <Input
              id="edit-cost"
              type="number"
              placeholder="Cost Price"
              value={formData.cost}
              onChange={(e) =>
                setFormData({ ...formData, cost: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-costUnit">Cost Unit</Label>
            <Select
              value={formData.costUnit}
              onValueChange={(value) =>
                setFormData({ ...formData, costUnit: value })
              }
            >
              <SelectTrigger id="edit-costUnit">
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

          <Button onClick={handleSubmit} className="w-full">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
