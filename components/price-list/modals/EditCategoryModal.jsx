// components/modals/EditCategoryModal.jsx
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const EditCategoryModal = ({
  open,
  onOpenChange,
  initialName,
  initialNotes,
  onSave,
}) => {
  const [categoryName, setCategoryName] = useState(initialName || "");
  const [categoryNotes, setCategoryNotes] = useState(initialNotes || "");

  // Update state when the modal opens or initial values change
  useEffect(() => {
    setCategoryName(initialName || "");
    setCategoryNotes(initialNotes || "");
  }, [open, initialName, initialNotes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (categoryName.trim() === "") {
      // Prevent saving an empty name
      return;
    }
    // Pass the new name and notes up to the container
    onSave({
      name: categoryName.trim(),
      notes: categoryNotes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update the category name and add optional notes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="Enter category name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Category Notes */}
            <div className="space-y-2">
              <Label htmlFor="category-notes">
                Notes{" "}
                <span className="text-xs text-muted-foreground">
                  (Optional)
                </span>
              </Label>
              <Textarea
                id="category-notes"
                placeholder="Add any notes about this category..."
                value={categoryNotes}
                onChange={(e) => setCategoryNotes(e.target.value)}
                rows={4}
              />
            </div>
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