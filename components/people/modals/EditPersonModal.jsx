import { useState, useEffect, useRef, useMemo } from "react";
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
import { Plus, X, Upload, User, Star, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toTitleCase } from "@/lib/utils/dataTransform";
import { sortCategories } from "@/lib/utils/categoryUtils";
import { checkInternalDuplicates, cleanAndDeduplicatePhones } from "@/lib/utils/phoneValidation";
import { validateAndCompressImage, getBase64Size } from "@/lib/utils/imageCompression";
import { photoCache } from "@/lib/utils/photoCache";

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

export const EditPersonModal = ({
  open,
  onOpenChange,
  editingPerson,
  onSave,
  availableCategories,
}) => {
  // Memoize sorted categories to prevent infinite loop
  const CATEGORIES = useMemo(() => {
    return sortCategories(availableCategories || [
      { id: "customer", label: "Customer" },
    ]);
  }, [availableCategories]);

  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [phoneErrors, setPhoneErrors] = useState([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoChanged, setPhotoChanged] = useState(false);

  useEffect(() => {
    if (editingPerson) {
      // Handle backward compatibility: convert single phone to array
      const phones = editingPerson.phones
        ? editingPerson.phones
        : editingPerson.phone
          ? [editingPerson.phone]
          : [""];

      // Load photo from cache
      const cachedPhoto = editingPerson.hasPhoto 
        ? photoCache.get(editingPerson.id) 
        : null;

      const currentFormData = {
        name: editingPerson.name || "",
        category: editingPerson.category || "customer",
        phones: phones.length > 0 ? phones : [""],
        address: editingPerson.address || "",
        specialty: editingPerson.specialty || "",
        photo: cachedPhoto || "",
        notes: editingPerson.notes || "",
      };
      setFormData(currentFormData);
      setInitialFormData(currentFormData);
      setPhotoPreview(cachedPhoto || "");
      
      // Initialize phone errors array
      setPhoneErrors(new Array(phones.length > 0 ? phones.length : 1).fill(null));
      setIsCompressing(false);
      setPhotoChanged(false);
    } else if (!editingPerson && formData !== null) {
      setFormData(null);
      setInitialFormData(null);
      setPhotoPreview("");
      setPhoneErrors([]);
      setIsCompressing(false);
      setPhotoChanged(false);
    }
  }, [editingPerson]);

  const handlePhoneChange = (index, value) => {
    const validation = cleanAndValidatePhone(value);
    
    setFormData(prev => {
      const newPhones = [...prev.phones];
      newPhones[index] = validation.cleaned;
      return { ...prev, phones: newPhones };
    });
    
    // Update validation errors
    setPhoneErrors(prev => {
      const newErrors = [...prev];
      newErrors[index] = validation.error;
      
      // Check for internal duplicates (within this form)
      if (validation.isValid && validation.cleaned.length === 10) {
        const newPhones = [...formData.phones];
        newPhones[index] = validation.cleaned;
        const internalCheck = checkInternalDuplicates(newPhones);
        if (internalCheck.hasDuplicates && internalCheck.duplicateNumbers.includes(validation.cleaned)) {
          newErrors[index] = "This number is already used in another field above";
        }
      }
      
      return newErrors;
    });
  };

  const addPhoneField = () => {
    setFormData(prev => ({ ...prev, phones: [...prev.phones, ""] }));
    setPhoneErrors(prev => [...prev, null]);
  };

  const removePhoneField = (index) => {
    if (formData.phones.length > 1) {
      setFormData(prev => ({
        ...prev,
        phones: prev.phones.filter((_, i) => i !== index)
      }));
      
      setPhoneErrors(prev => prev.filter((_, i) => i !== index));
    }
  };

  const makePrimary = (index) => {
    if (index === 0) return;
    
    setFormData(prev => {
      const newPhones = [...prev.phones];
      const primaryPhone = newPhones.splice(index, 1)[0];
      newPhones.unshift(primaryPhone);
      return { ...prev, phones: newPhones };
    });
    
    setPhoneErrors(prev => {
      const newErrors = [...prev];
      const primaryError = newErrors.splice(index, 1)[0];
      newErrors.unshift(primaryError);
      return newErrors;
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      alert("Photo size should be less than 5MB");
      return;
    }

    try {
      setIsCompressing(true);
      
      // Compress the image
      const { base64: compressedBase64, originalSize, compressedSize } = 
        await validateAndCompressImage(file);
      
      setFormData({ ...formData, photo: compressedBase64 });
      setPhotoPreview(compressedBase64);
      setPhotoChanged(true);
      
      // Show compression info in console
      console.log(`Image compressed: ${originalSize}KB → ${compressedSize}KB`);
      
    } catch (error) {
      console.error('Image compression error:', error);
      alert(error.message || "Failed to compress image. Please try another image.");
    } finally {
      setIsCompressing(false);
    }
  };

  const removePhoto = () => {
    setFormData({ ...formData, photo: "" });
    setPhotoPreview("");
    setPhotoChanged(true);
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
      notes: formData.notes.trim(),
      phones: cleanedAndDedupedPhones,
    };

    // Remove photo from the data being saved - it will be in cache
    const { photo, ...dataWithoutPhoto } = cleanedData;
    
    // Update photo cache if photo changed
    if (photoChanged) {
      if (photo && photo.trim()) {
        photoCache.set(editingPerson.id, photo.trim());
      } else {
        photoCache.remove(editingPerson.id);
      }
    }

    // Add hasPhoto flag
    const finalData = {
      ...dataWithoutPhoto,
      hasPhoto: !!(photo && photo.trim()),
    };

    onSave(finalData);
  };

  // Form validation
  const isFormValid = (() => {
    if (!formData || !initialFormData || isCompressing) return false;

    // Name is required
    if (!formData.name.trim()) return false;

    // Check for phone errors
    const hasAnyPhoneError = phoneErrors.some((error) => error !== null);
    if (hasAnyPhoneError) return false;

    // Check if anything changed
    const hasChanges =
      formData.name !== initialFormData.name ||
      formData.category !== initialFormData.category ||
      JSON.stringify(formData.phones) !== JSON.stringify(initialFormData.phones) ||
      formData.address !== initialFormData.address ||
      formData.specialty !== initialFormData.specialty ||
      photoChanged ||
      formData.notes !== initialFormData.notes;

    return hasChanges;
  })();

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
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
                disabled={isCompressing}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
              >
                <Upload className="w-4 h-4 mr-2" />
                {isCompressing ? "Compressing..." : formData.photo ? "Change Photo" : "Upload Photo"}
              </Button>
              {(photoPreview || formData.photo) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removePhoto}
                  disabled={isCompressing}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Upload a photo from your device (max 5MB, will be compressed)
            </p>
            {formData.photo && (
              <p className="text-xs text-muted-foreground">
                Size: {getBase64Size(formData.photo)}KB
              </p>
            )}
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
                First number is primary. Click ★ to make a number primary.
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
                      className={`${index === 0 ? "border-primary" : ""} ${phoneErrors[index] ? "border-destructive" : ""}`}
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
                  {/* Show validation errors */}
                  {phoneErrors[index] && (
                    <div className="flex items-start gap-1 text-xs text-destructive">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{phoneErrors[index]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Phone numbers must be exactly 10 digits. Spaces will be removed automatically.
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
              value={formData.notes || ""}
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
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};