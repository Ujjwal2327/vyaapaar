import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatBulkText } from "@/lib/utils/dataTransform";

export const BulkEditModal = ({ open, onOpenChange, initialText, onSave }) => {
  const [bulkText, setBulkText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setBulkText(initialText);
    }
  }, [open, initialText]);

  const handleClose = () => {
    if (
      bulkText !== initialText &&
      !window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      )
    ) {
      return;
    }
    onOpenChange(false);
  };

  const handleSave = () => {
    onSave(bulkText);
    onOpenChange(false);
  };

  const handleFormat = () => {
    const formatted = formatBulkText(bulkText);
    setBulkText(formatted);
  };

  const toggleWrap = () => {
    if (textareaRef.current) {
      const currentStyle = textareaRef.current.style.whiteSpace;
      textareaRef.current.style.whiteSpace =
        currentStyle === "pre" ? "pre-wrap" : "pre";
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(bulkText);
    alert("Copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Edit</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
            <p className="font-semibold">Format Guide:</p>
            <p>• Categories: Just write the name</p>
            <p>• Subcategories: Add 2 spaces</p>
            <p>
              • Items: name | sell price | sell unit | cost price | cost unit
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer">Show Example</summary>
              <pre className="bg-background p-2 rounded mt-2 text-xs overflow-x-auto">
                {`Taps
  Novex
    Angle valve | 50 | piece | 40 | piece
    Bib cock | 40 | piece | 32 | piece`}
              </pre>
            </details>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={toggleWrap} variant="outline" size="sm">
              Wrap/Unwrap
            </Button>
            <Button onClick={handleFormat} variant="outline" size="sm">
              Format
            </Button>
          </div>

          <Textarea
            ref={textareaRef}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="font-mono text-sm resize-none"
            style={{ whiteSpace: "pre", minHeight: "400px" }}
            placeholder="Paste or edit your data here..."
          />
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            Save & Close
          </Button>
          <Button onClick={handleCopy} variant="outline">
            Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
