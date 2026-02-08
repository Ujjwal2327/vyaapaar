import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  FileDown,
  Grid,
  LayoutGrid,
  Loader2,
  RectangleHorizontal,
  RectangleVertical,
  Table,
  Table2,
} from "lucide-react";
import { generateContactsPDF } from "@/lib/utils/pdfGenerator";
import { sortCategories } from "@/lib/utils/categoryUtils";
import { toast } from "sonner";

export const ExportPDFModal = ({
  open,
  onOpenChange,
  peopleData,
  availableCategories,
}) => {
  const [layout, setLayout] = useState("grid"); // table, grid, bento
  const [orientation, setOrientation] = useState("portrait"); // portrait, landscape
  const [gridColumns, setGridColumns] = useState(2); // 2, 3, or 4 for grid
  const [bentoColumns, setBentoColumns] = useState(2); // 2, 3, or 4 for bento
  const [isGenerating, setIsGenerating] = useState(false);

  // Fields to include
  const [includeFields, setIncludeFields] = useState({
    photo: true,
    name: true,
    category: true,
    phones: true,
    address: true,
    specialty: true,
    notes: false,
  });

  // Categories to include (all by default)
  const [selectedCategories, setSelectedCategories] = useState(
    availableCategories.map((cat) => cat.id),
  );

  const sortedCategories = sortCategories(availableCategories);

  const toggleField = (field) => {
    setIncludeFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const toggleCategory = (categoryId) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const selectAllCategories = () => {
    setSelectedCategories(availableCategories.map((cat) => cat.id));
  };

  const deselectAllCategories = () => {
    setSelectedCategories([]);
  };

  const handleExport = async () => {
    if (selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }

    // Filter contacts by selected categories
    const filteredContacts = peopleData.filter((person) =>
      selectedCategories.includes(person.category),
    );

    if (filteredContacts.length === 0) {
      toast.error("No contacts found for selected categories");
      return;
    }

    // Sort contacts alphabetically by name
    const sortedContacts = [...filteredContacts].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    setIsGenerating(true);

    try {
      await generateContactsPDF({
        contacts: sortedContacts,
        categories: availableCategories,
        layout,
        orientation,
        includeFields,
        gridColumns,
        bentoColumns,
      });

      toast.success("PDF exported successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF", {
        description: error.message || "Please try again",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getContactCount = () => {
    return peopleData.filter((person) =>
      selectedCategories.includes(person.category),
    ).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Contacts to PDF</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Layout Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Layout Style</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={layout === "table" ? "default" : "outline"}
                  onClick={() => setLayout("table")}
                  className="flex-1 h-20 flex flex-col gap-2"
                >
                  <Table2 />
                  <span className="text-xs">Table</span>
                </Button>
                <Button
                  type="button"
                  variant={layout === "grid" ? "default" : "outline"}
                  onClick={() => setLayout("grid")}
                  className="flex-1 h-20 flex flex-col gap-2"
                >
                  <Grid />
                  <span className="text-xs">Grid</span>
                </Button>
                <Button
                  type="button"
                  variant={layout === "bento" ? "default" : "outline"}
                  onClick={() => setLayout("bento")}
                  className="flex-1 h-20 flex flex-col gap-2"
                >
                  <LayoutGrid />
                  <span className="text-xs">Bento</span>
                </Button>
              </div>
            </div>

            {/* Orientation Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Orientation</Label>
              <Select value={orientation} onValueChange={setOrientation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">
                    Portrait <RectangleVertical />
                  </SelectItem>
                  <SelectItem value="landscape">
                    Landscape <RectangleHorizontal />
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Columns Selection - Grid Layout */}
            {layout === "grid" && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Grid Columns</Label>
                <Select
                  value={gridColumns.toString()}
                  onValueChange={(val) => setGridColumns(parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Columns</SelectItem>
                    <SelectItem value="3">3 Columns</SelectItem>
                    <SelectItem value="4">4 Columns</SelectItem>
                  </SelectContent>
                </Select>
                
              </div>
            )}

            {/* Columns Selection - Bento Layout */}
            {layout === "bento" && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Bento Columns</Label>
                <Select
                  value={bentoColumns.toString()}
                  onValueChange={(val) => setBentoColumns(parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Columns</SelectItem>
                    <SelectItem value="3">3 Columns</SelectItem>
                    <SelectItem value="4">4 Columns</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Fields to Include */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Fields to Include
              </Label>
              <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                {[
                  { id: "photo", label: "Photo", disabled: false },
                  { id: "name", label: "Name", disabled: true },
                  { id: "category", label: "Category", disabled: false },
                  { id: "phones", label: "Phone Numbers", disabled: false },
                  { id: "address", label: "Address", disabled: false },
                  { id: "specialty", label: "Specialty/Role", disabled: false },
                  { id: "notes", label: "Notes", disabled: false },
                ].map((field) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={field.id}
                      checked={includeFields[field.id]}
                      onCheckedChange={() => toggleField(field.id)}
                      disabled={field.disabled}
                    />
                    <label
                      htmlFor={field.id}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {field.label}
                      {field.disabled && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (Required)
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories to Include */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Categories to Include
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllCategories}
                    className="h-7 text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={deselectAllCategories}
                    className="h-7 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-2 bg-muted/30 rounded-lg p-4 max-h-48 overflow-y-auto">
                {sortedCategories.map((category) => {
                  const count = peopleData.filter(
                    (p) => p.category === category.id,
                  ).length;
                  return (
                    <div
                      key={category.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`cat-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <label
                        htmlFor={`cat-${category.id}`}
                        className="text-sm cursor-pointer flex-1 flex items-center justify-between"
                      >
                        <span>{category.label}</span>
                        <span className="text-xs text-muted-foreground">
                          ({count})
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview Info */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm">
                <FileDown className="w-4 h-4 text-primary" />
                <span className="font-semibold">
                  {getContactCount()} contact(s) will be exported
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Layout: {layout.charAt(0).toUpperCase() + layout.slice(1)} •
                Orientation:{" "}
                {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            className="flex-1 gap-2"
            disabled={isGenerating || selectedCategories.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
