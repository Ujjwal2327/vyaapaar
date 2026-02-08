import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileUp, Loader2, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { importVCFFile } from "@/lib/utils/vcfUtils";
import { sortCategories } from "@/lib/utils/categoryUtils";
import { toast } from "sonner";

export const ImportVCFModal = ({
  open,
  onOpenChange,
  onImport,
  availableCategories,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(
    availableCategories[0]?.id || "customer"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewContacts, setPreviewContacts] = useState(null);
  const fileInputRef = useRef(null);

  const sortedCategories = sortCategories(availableCategories);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.toLowerCase().endsWith(".vcf")) {
      toast.error("Invalid file type", {
        description: "Please select a .vcf file",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large", {
        description: "VCF file must be less than 10MB",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const contacts = await importVCFFile(file, selectedCategory);
      setPreviewContacts(contacts);
      toast.success(`Found ${contacts.length} contact(s)`, {
        description: "Review and confirm to import",
      });
    } catch (error) {
      console.error("VCF import error:", error);
      toast.error("Failed to parse VCF file", {
        description: error.message || "Please check the file format",
      });
      setPreviewContacts(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    if (!previewContacts || previewContacts.length === 0) {
      toast.error("No contacts to import");
      return;
    }

    onImport(previewContacts);
    handleClose();
  };

  const handleClose = () => {
    setPreviewContacts(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const handleCategoryChange = (newCategory) => {
    setSelectedCategory(newCategory);

    // Update category for all preview contacts
    if (previewContacts) {
      const updatedContacts = previewContacts.map((contact) => ({
        ...contact,
        category: newCategory,
      }));
      setPreviewContacts(updatedContacts);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Contacts from VCF</DialogTitle>
          <DialogDescription>
            Select a category and upload a .vcf (vCard) file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Import to Category</Label>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortedCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              All imported contacts will be added to this category
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>VCF File</Label>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".vcf"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isProcessing}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full h-24 border-dashed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Processing VCF file...
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mr-2" />
                    Choose VCF File
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports vCard format (.vcf). Max file size: 10MB
            </p>
          </div>

          {/* Preview */}
          {previewContacts && previewContacts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base">
                  Preview ({previewContacts.length} contact{previewContacts.length !== 1 ? "s" : ""})
                </Label>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Ready to import
                </div>
              </div>

              <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-2">
                  {previewContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="bg-background rounded-lg border p-3 space-y-1"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">{contact.name}</p>
                          {contact.phones && contact.phones.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {contact.phones.filter((p) => p).join(", ")}
                            </p>
                          )}
                        </div>
                        <Users className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                      {contact.address && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          📍 {contact.address}
                        </p>
                      )}
                      {contact.specialty && (
                        <p className="text-xs text-muted-foreground">
                          💼 {contact.specialty}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <p className="font-semibold mb-1">What gets imported:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Contact name (required)</li>
                  <li>Phone numbers (validated to 10 digits)</li>
                  <li>Address</li>
                  <li>Specialty/Job Title</li>
                  <li>Notes</li>
                  <li>Photo (if included in VCF)</li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Note: Contacts without names or valid phone numbers will be skipped
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            className="flex-1 gap-2"
            disabled={!previewContacts || previewContacts.length === 0 || isProcessing}
          >
            <FileUp className="w-4 h-4" />
            Import {previewContacts?.length || 0} Contact{previewContacts?.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};