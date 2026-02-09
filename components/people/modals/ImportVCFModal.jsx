import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Upload, Loader2, CheckCircle2, Users, Smartphone } from "lucide-react";
import { importVCFFile } from "@/lib/utils/vcfUtils";
import { sortCategories } from "@/lib/utils/categoryUtils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// Convert Contact Picker API results to app format
const convertContactPickerToVyaapaar = (contacts, categoryId) => {
  return contacts
    .filter((contact) => contact.name && contact.name[0])
    .map((contact) => {
      const name = contact.name[0] || "Unknown";

      // Clean phone numbers
      const phones = (contact.tel || [])
        .map((tel) => {
          const cleaned = tel.replace(/\D/g, "");
          if (cleaned.length > 10) {
            if (cleaned.startsWith("91") && cleaned.length === 12)
              return cleaned.substring(2);
            if (cleaned.startsWith("1") && cleaned.length === 11)
              return cleaned.substring(1);
            return cleaned.slice(-10);
          }
          return cleaned.length === 10 ? cleaned : null;
        })
        .filter(Boolean);

      // Deduplicate phone numbers - if same number appears multiple times, keep only one
      const uniquePhones = [...new Set(phones)];

      // Get address
      const address = (contact.address || [])
        .map((addr) => {
          if (typeof addr === "string") return addr;
          const parts = [
            addr.streetAddress,
            addr.city,
            addr.region,
            addr.postalCode,
            addr.country,
          ].filter(Boolean);
          return parts.join(", ");
        })
        .filter(Boolean)
        .join("; ");

      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        category: categoryId,
        phones: uniquePhones.length > 0 ? uniquePhones : [''],
        address: address || "",
        specialty: "",
        notes: "",
        photo: null,
      };
    });
};

export const ImportVCFModal = ({
  open,
  onOpenChange,
  onImport,
  availableCategories,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(
    availableCategories[0]?.id || "customer",
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewContacts, setPreviewContacts] = useState(null);
  const [contactPickerSupported, setContactPickerSupported] = useState(true);
  const fileInputRef = useRef(null);
  const sortedCategories = sortCategories(availableCategories);

  // Check Contact Picker API support
  useEffect(() => {
    setContactPickerSupported(
      "contacts" in navigator && "ContactsManager" in window,
    );
  }, []);

  // Import from device contacts
  const handleDeviceImport = async () => {
    if (!("contacts" in navigator)) {
      toast.error("Not supported on this browser", {
        description: "Use VCF file import instead",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const props = ["name", "tel", "address"];
      const opts = { multiple: true };

      const contacts = await navigator.contacts.select(props, opts);

      if (contacts.length === 0) {
        toast.info("No contacts selected");
        setIsProcessing(false);
        return;
      }

      const vyaapaarContacts = convertContactPickerToVyaapaar(
        contacts,
        selectedCategory,
      );
      setPreviewContacts(vyaapaarContacts);
      toast.success(`Found ${vyaapaarContacts.length} contact(s)`);
    } catch (error) {
      if (error.name === "AbortError") {
        toast.info("Import cancelled");
      } else {
        toast.error("Failed to import contacts", {
          description: error.message,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Import from VCF file
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".vcf")) {
      toast.error("Invalid file type", {
        description: "Please select a .vcf file",
      });
      return;
    }

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
      toast.success(`Found ${contacts.length} contact(s)`);
    } catch (error) {
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
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Import to Category</Label>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger>
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
          </div>

          {/* Import Methods */}
          {!previewContacts && (
            <div className="space-y-3">
              {/* Device Import */}
              {contactPickerSupported && (
                <Button
                  onClick={handleDeviceImport}
                  disabled={isProcessing}
                  variant="outline"
                  className="w-full h-20 border-2 border-dashed hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Smartphone className="w-6 h-6" />
                    <span className="font-semibold">
                      Select from Device Contacts
                    </span>
                  </div>
                </Button>
              )}

              {/* VCF File Import */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vcf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  variant="outline"
                  className="w-full h-20 border-2 border-dashed hover:border-primary hover:bg-primary/5"
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6" />
                      <span className="font-semibold">Upload VCF File</span>
                    </div>
                  )}
                </Button>
              </div>

              {/* Info */}
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-semibold mb-1">Supported formats:</p>
                <p>
                  • Select contacts directly from your device (mobile browsers)
                </p>
                <p>• Upload .vcf (vCard) files • Max 10MB</p>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewContacts && previewContacts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <Label className="text-base font-semibold">
                    Preview ({previewContacts.length} contact
                    {previewContacts.length !== 1 ? "s" : ""})
                  </Label>
                </div>
                <Button
                  onClick={() => setPreviewContacts(null)}
                  variant="ghost"
                  size="sm"
                >
                  Clear
                </Button>
              </div>

              <ScrollArea className="h-64 rounded-lg border">
                <div className="p-3 space-y-2">
                  {previewContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="rounded-lg border bg-card p-3 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{contact.name}</p>
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                      {contact.phones && contact.phones.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          📞 {contact.phones.filter((p) => p).join(", ")}
                        </p>
                      )}
                      {contact.address && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          📍 {contact.address}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          {previewContacts && (
            <Button
              onClick={handleImport}
              className="flex-1"
              disabled={
                !previewContacts || previewContacts.length === 0 || isProcessing
              }
            >
              Import {previewContacts?.length || 0} Contact
              {previewContacts?.length !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
