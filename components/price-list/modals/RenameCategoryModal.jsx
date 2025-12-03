// components/modals/RenameCategoryModal.jsx
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const RenameCategoryModal = ({
  open,
  onOpenChange,
  initialName,
  onSave,
}) => {
  const [categoryName, setCategoryName] = useState(initialName || "");

  // Update state when the modal opens or initialName changes
  useEffect(() => {
    setCategoryName(initialName || "");
  }, [open, initialName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (categoryName.trim() === "") {
      // Prevent saving an empty name
      return;
    }
    // Pass the new name up to the container
    onSave(categoryName.trim());
    // The container component handles closing the modal via onSave's success logic
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Category</DialogTitle>
          <DialogDescription>
            Change the name of the category. This will update its key.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <Input
              id="category-name"
              placeholder="Enter new category name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="col-span-4"
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={categoryName.trim() === ""}>
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
