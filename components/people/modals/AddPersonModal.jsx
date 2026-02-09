import { useState, useEffect, useRef } from "react";
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
import { Plus, X, Upload, Camera, User, Star, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toTitleCase } from "@/lib/utils/dataTransform";
import { sortCategories } from "@/lib/utils/categoryUtils";
import { checkDuplicatePhone, checkInternalDuplicates, cleanAndDeduplicatePhones } from "@/lib/utils/phoneValidation";

// Phone validation with real-time cleaning
const cleanAndValidatePhone = (phone) => {
  if (!phone) return { cleaned: "", isValid: true, error: null };
  
  // Remove all spaces in real-time
  const cleaned = phone.replace(/\s+/g, '');
  
  // Check if empty (valid)
  if (!cleaned) return { cleaned: "", isValid: true, error: null };
  
  // Check if it contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return { 
      cleaned, 
      isValid: false, 
      error: "Phone number must contain only digits" 
    };
  }
  
  // Check if it's exactly 10 digits
  if (cleaned.length !== 10) {
    return { 
      cleaned, 
      isValid: false, 
      error: `Phone number must be exactly 10 digits (currently ${cleaned.length})` 
    };
  }
  
  return { cleaned, isValid: true, error: null };
};

export const AddPersonModal = ({
  open,
  onOpenChange,
  onAdd,
  availableCategories,
  peopleData = [], // NEW: Pass all existing contacts for duplicate checking
}) => {
  // Sort categories alphabetically with "Other" at the end
  const CATEGORIES = sortCategories(availableCategories || [
    { id: "customer", label: "Customer" },
  ]);

  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    category: CATEGORIES[0]?.id || "customer",
    phones: [""], // Array of phone numbers
    address: "",
    specialty: "",
    photo: "", // Base64 or URL
    notes: "",
  });

  const [photoPreview, setPhotoPreview] = useState("");
  const [phoneErrors, setPhoneErrors] = useState([null]); // Array of validation error messages per phone
  const [phoneDuplicateErrors, setPhoneDuplicateErrors] = useState([null]); // Array of duplicate error messages per phone

  useEffect(() => {
    if (!open) {
      setFormData({
        name: "",
        category: CATEGORIES[0]?.id || "customer",
        phones: [""],
        address: "",
        specialty: "",
        photo: "",
        notes: "",
      });
      setPhotoPreview("");
      setPhoneErrors([null]);
      setPhoneDuplicateErrors([null]);
    }
  }, [open]);

  const handlePhoneChange = (index, value) => {
    const validation = cleanAndValidatePhone(value);
    
    const newPhones = [...formData.phones];
    newPhones[index] = validation.cleaned;
    setFormData({ ...formData, phones: newPhones });
    
    // Update validation errors
    const newErrors = [...phoneErrors];
    newErrors[index] = validation.error;
    setPhoneErrors(newErrors);

    // Check for duplicates across all contacts (only if valid 10-digit number)
    const newDuplicateErrors = [...phoneDuplicateErrors];
    if (validation.isValid && validation.cleaned.length === 10) {
      // Check against existing contacts
      const duplicateCheck = checkDuplicatePhone(
        validation.cleaned,
        peopleData,
        null // No exclusion for new contact
      );
      
      if (duplicateCheck.isDuplicate) {
        newDuplicateErrors[index] = `This number is already assigned to ${duplicateCheck.existingContact?.name}`;
      } else {
        // Check for internal duplicates (within this form)
        const internalCheck = checkInternalDuplicates(newPhones);
        if (internalCheck.hasDuplicates && internalCheck.duplicateNumbers.includes(validation.cleaned)) {
          newDuplicateErrors[index] = "This number is already used in another field above";
        } else {
          newDuplicateErrors[index] = null;
        }
      }
    } else {
      newDuplicateErrors[index] = null;
    }
    setPhoneDuplicateErrors(newDuplicateErrors);
  };

  const addPhoneField = () => {
    setFormData({ ...formData, phones: [...formData.phones, ""] });
    setPhoneErrors([...phoneErrors, null]);
    setPhoneDuplicateErrors([...phoneDuplicateErrors, null]);
  };

  const removePhoneField = (index) => {
    if (formData.phones.length > 1) {
      const newPhones = formData.phones.filter((_, i) => i !== index);
      setFormData({ ...formData, phones: newPhones });
      
      const newErrors = phoneErrors.filter((_, i) => i !== index);
      setPhoneErrors(newErrors);
      
      const newDuplicateErrors = phoneDuplicateErrors.filter((_, i) => i !== index);
      setPhoneDuplicateErrors(newDuplicateErrors);

      // Re-check internal duplicates for remaining phones
      setTimeout(() => {
        newPhones.forEach((phone, idx) => {
          if (phone && phone.trim()) {
            handlePhoneChange(idx, phone);
          }
        });
      }, 0);
    }
  };

  const makePrimary = (index) => {
    if (index === 0) return;
    const newPhones = [...formData.phones];
    const primaryPhone = newPhones.splice(index, 1)[0];
    newPhones.unshift(primaryPhone);
    setFormData({ ...formData, phones: newPhones });
    
    const newErrors = [...phoneErrors];
    const primaryError = newErrors.splice(index, 1)[0];
    newErrors.unshift(primaryError);
    setPhoneErrors(newErrors);

    const newDuplicateErrors = [...phoneDuplicateErrors];
    const primaryDuplicateError = newDuplicateErrors.splice(index, 1)[0];
    newDuplicateErrors.unshift(primaryDuplicateError);
    setPhoneDuplicateErrors(newDuplicateErrors);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Photo size should be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setFormData({ ...formData, photo: base64String });
      setPhotoPreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setFormData({ ...formData, photo: "" });
    setPhotoPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

const handleSubmit = () => {
  if (!isFormValid) return;

  // Clean and deduplicate phone numbers FIRST (removes spaces and duplicates)
  const cleanedAndDedupedPhones = cleanAndDeduplicatePhones(formData.phones);
  
  // Validate all phones one more time
  const allPhonesValid = cleanedAndDedupedPhones.every((phone) => {
    if (!phone.trim()) return true; // Empty is ok
    const validation = cleanAndValidatePhone(phone);
    return validation.isValid;
  });

  if (!allPhonesValid) {
    return; // Don't submit if any phone is invalid
  }

  const cleanedData = {
    ...formData,
    name: toTitleCase(formData.name.trim()),
    address: formData.address.trim(),
    specialty: formData.specialty.trim(),
    photo: formData.photo.trim() !== "" ? formData.photo.trim() : null,
    notes: formData.notes.trim(),
    phones: cleanedAndDedupedPhones, // Use cleaned and deduplicated phones
  };

  onAdd(cleanedData);
};

  // Form validation
  const hasAnyPhoneError = phoneErrors.some((error) => error !== null);
  const hasAnyDuplicateError = phoneDuplicateErrors.some((error) => error !== null);
  const hasValidPhones = formData.phones.some((phone) => {
    const validation = cleanAndValidatePhone(phone);
    return validation.cleaned && validation.isValid;
  });
  
  const isFormValid = formData.name.trim() !== "" && 
                      !hasAnyPhoneError && 
                      !hasAnyDuplicateError;

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Photo Upload Section */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="w-24 h-24">
              <AvatarImage
                src={photoPreview || formData.photo || null}
                alt={formData.name}
              />
              <AvatarFallback className="bg-primary/10 text-2xl">
                {formData.name ? (
                  getInitials(formData.name)
                ) : (
                  <User className="w-10 h-10" />
                )}
              </AvatarFallback>
            </Avatar>

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
              {(photoPreview || formData.photo) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removePhoto}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Upload a photo from your device (max 5MB)
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name*</Label>
            <Input
              id="name"
              placeholder="Full name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              autoFocus
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category*</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phone Numbers - Multiple with validation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Phone Numbers</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addPhoneField}
                className="h-8 px-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Number
              </Button>
            </div>
            {formData.phones.length > 1 && (
              <p className="text-xs text-muted-foreground">
                First number is primary. Click ⭐ to make a number primary.
              </p>
            )}
            <div className="space-y-2">
              {formData.phones.map((phone, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <Input
                      type="tel"
                      placeholder={`Phone ${index + 1}${index === 0 ? " (Primary)" : ""}`}
                      value={phone}
                      onChange={(e) => handlePhoneChange(index, e.target.value)}
                      className={`${index === 0 ? "border-primary" : ""} ${phoneErrors[index] || phoneDuplicateErrors[index] ? "border-destructive" : ""}`}
                    />
                    {formData.phones.length > 1 && (
                      <>
                        {index !== 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => makePrimary(index)}
                            title="Make primary"
                            className="shrink-0"
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        {index === 0 && (
                          <div className="w-10 h-10 flex items-center justify-center shrink-0">
                            <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePhoneField(index)}
                          className="shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  {/* Show validation errors first */}
                  {phoneErrors[index] && (
                    <div className="flex items-start gap-1 text-xs text-destructive">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{phoneErrors[index]}</span>
                    </div>
                  )}
                  {/* Show duplicate errors if no validation errors */}
                  {!phoneErrors[index] && phoneDuplicateErrors[index] && (
                    <div className="flex items-start gap-1 text-xs text-destructive">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{phoneDuplicateErrors[index]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Phone numbers must be exactly 10 digits and unique across all contacts. Spaces will be removed automatically.
            </p>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Full address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              rows={2}
            />
          </div>

          {/* Specialty */}
          <div className="space-y-2">
            <Label htmlFor="specialty">
              Specialty / Role
              <span className="text-xs text-muted-foreground ml-2">
                (e.g., Pipe fitting, General labor)
              </span>
            </Label>
            <Input
              id="specialty"
              placeholder="What they specialize in"
              value={formData.specialty}
              onChange={(e) =>
                setFormData({ ...formData, specialty: e.target.value })
              }
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information..."
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={4}
            />
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={!isFormValid}
          >
            Add Contact
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};