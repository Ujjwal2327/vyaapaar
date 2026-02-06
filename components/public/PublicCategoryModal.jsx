import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FolderTree } from "lucide-react";

export const PublicCategoryModal = ({
  open,
  onOpenChange,
  categoryName,
  categoryNotes,
}) => {
  if (!categoryName) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-primary" />
            <DialogTitle className="text-2xl">{categoryName}</DialogTitle>
          </div>
          <DialogDescription>Category information.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Category Type */}
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Type</span>
            <span className="text-lg font-bold text-primary">Category</span>
          </div>

          {/* Notes Section */}
          {categoryNotes && categoryNotes.trim() && (
            <>
              <Separator />
              <div className="pt-2">
                <h4 className="font-semibold mb-2">Notes:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {categoryNotes}
                </p>
              </div>
            </>
          )}

          {/* Empty state for no notes */}
          {(!categoryNotes || !categoryNotes.trim()) && (
            <>
              <Separator />
              <div className="pt-2">
                <p className="text-sm text-muted-foreground italic">
                  No additional information available.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};