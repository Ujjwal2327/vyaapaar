import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Copy, WrapText } from "lucide-react";
import { sortCategories } from "@/lib/utils/categoryUtils";
import Accordion from "@/components/ui/accordion";
import { toTitleCase } from "@/lib/utils/dataTransform";
import { Badge } from "@/components/ui/badge";
import { batchCheckDuplicatePhones } from "@/lib/utils/phoneValidation";

// Phone validation function - validates and cleans phone numbers
const validatePhone = (phone) => {
  if (!phone || !phone.trim()) return null; // Empty is ok
  const cleaned = phone.trim().replace(/\s+/g, ""); // Remove spaces

  // Check if it's exactly 10 digits
  if (/^\d{10}$/.test(cleaned)) {
    return cleaned;
  }

  return null; // Invalid
};

// Export to category-separated format
export const exportPeopleToCategoryFormat = (peopleData, categories) => {
  const categoryData = {};

  // Initialize all categories with empty arrays (ensures all categories appear)
  categories.forEach((cat) => {
    categoryData[cat.id] = {
      label: cat.label,
      people: [],
    };
  });

  // Group people by category
  peopleData.forEach((person) => {
    const category = person.category || "other";
    if (categoryData[category]) {
      categoryData[category].people.push(person);
    }
  });

  return categoryData;
};

// Convert category data to text for a specific category
const categoryToText = (people) => {
  if (!people || people.length === 0) return "";

  let text = "";
  people.forEach((person) => {
    const name = person.name;

    // Handle phones array
    const phones =
      person.phones && person.phones.length > 0
        ? person.phones.filter((p) => p && p.trim()).join(" / ")
        : person.phone || "";

    const address = person.address || "";

    // Format: name | phones | address
    text += `${name}`;
    if (phones) {
      text += ` | ${phones}`;
    }
    if (address) {
      text += ` | ${address}`;
    }
    text += "\n";
  });

  return text;
};

// Format text with aligned columns
const formatCategoryText = (text) => {
  if (!text || !text.trim()) return text;

  const lines = text.split("\n").filter((line) => line.trim());
  const items = [];

  // Parse all items
  lines.forEach((line) => {
    const separator = line.includes("|") ? "|" : ",";
    const parts = line
      .split(separator)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length > 0) {
      items.push({
        name: parts[0] || "",
        phones: parts[1] || "",
        address: parts[2] || "",
      });
    }
  });

  if (items.length === 0) return text;

  // Calculate max lengths
  const maxNameLen = Math.max(...items.map((i) => i.name.length), 10) + 1;
  const maxPhonesLen = Math.max(...items.map((i) => i.phones.length), 10) + 1;

  // Format with alignment
  let formatted = "";
  items.forEach((item) => {
    const name = item.name.padEnd(maxNameLen);
    const phones = item.phones.padEnd(maxPhonesLen);
    const address = item.address;

    formatted += `${name}| ${phones}`;
    if (address) {
      formatted += ` | ${address}`;
    }
    formatted += "\n";
  });

  return formatted;
};

// Parse text to people array for a specific category
// MODIFIED: Now preserves existing person data (specialty, notes, photo, id)
// AND checks for duplicate phone numbers
const textToPeople = (text, categoryId, existingPeopleData) => {
  if (!text || !text.trim()) return [];

  const lines = text.split("\n").filter((line) => line.trim());
  const people = [];
  const errors = [];

  // Create a map of existing people by name for quick lookup
  const existingPeopleMap = new Map();
  existingPeopleData.forEach((person) => {
    if (person.category === categoryId) {
      existingPeopleMap.set(person.name.toLowerCase(), person);
    }
  });

  // Track phone numbers within this batch for internal duplicate checking
  const phonesInBatch = new Map(); // phone -> person name

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;

    // Parse the person entry
    const separator = trimmed.includes("|") ? "|" : ",";
    const parts = trimmed
      .split(separator)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length === 0) return;

    const name = toTitleCase(parts[0].trim());
    if (!name) {
      errors.push(`Line ${lineNumber}: Contact has no name`);
      return;
    }

    // Parse phones (part 1 - can be multiple separated by /)
    const phonesPart = parts[1] || "";
    const rawPhones = phonesPart
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);

    // Validate all phones
    const validatedPhones = [];
    const invalidPhones = [];

    rawPhones.forEach((phone) => {
      const validated = validatePhone(phone);
      if (validated) {
        validatedPhones.push(validated);
      } else if (phone.trim()) {
        invalidPhones.push(phone);
      }
    });

    // If there are invalid phones, report them
    if (invalidPhones.length > 0) {
      errors.push(
        `Line ${lineNumber}: "${name}" has invalid phone(s): ${invalidPhones.join(", ")} (must be 10 digits)`,
      );
      return;
    }

    // Check for duplicate phones within this batch
    for (const phone of validatedPhones) {
      if (phonesInBatch.has(phone)) {
        const existingName = phonesInBatch.get(phone);
        if (existingName.toLowerCase() !== name.toLowerCase()) {
          errors.push(
            `Line ${lineNumber}: Phone number ${phone} is already assigned to "${existingName}" in this batch`,
          );
          return;
        }
      }
    }

    // Everything from part 2 onwards is address
    const addressPart = parts.slice(2).join(", ").trim();

    // Check if this person already exists
    const existingPerson = existingPeopleMap.get(name.toLowerCase());

    // Create person object - preserve existing data if person exists
    const person = {
      id:
        existingPerson?.id ||
        Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name,
      category: categoryId,
      phones: validatedPhones.length > 0 ? validatedPhones : [""],
      address: addressPart || "",
      // PRESERVE THESE FIELDS from existing person
      specialty: existingPerson?.specialty || "",
      notes: existingPerson?.notes || "",
      photo: existingPerson?.photo || null,
    };

    // Add phones to batch tracking
    validatedPhones.forEach((phone) => {
      phonesInBatch.set(phone, name);
    });

    people.push(person);
  });

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return people;
};

export const BulkEditPeopleModal = ({
  open,
  onOpenChange,
  peopleData,
  categories,
  onSave,
}) => {
  const [categoryTexts, setCategoryTexts] = useState({});
  const [initialCategoryTexts, setInitialCategoryTexts] = useState({});
  const [errors, setErrors] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const textareaRefs = useRef({});

  // Sort categories alphabetically with "Other" at the end
  const sortedCategories = sortCategories(categories);

  useEffect(() => {
    if (open && peopleData && categories) {
      const categoryData = exportPeopleToCategoryFormat(peopleData, categories);
      const texts = {};
      const expanded = {};

      sortedCategories.forEach((cat) => {
        texts[cat.id] = categoryToText(categoryData[cat.id].people);
        // Auto-expand categories that have data
        expanded[cat.id] = categoryData[cat.id].people.length > 0;
      });

      setCategoryTexts(texts);
      setInitialCategoryTexts(texts);
      setErrors({});
      setExpandedCategories(expanded);
    }
  }, [open, peopleData, categories]);

  const handleClose = () => {
    const hasChanges = Object.keys(categoryTexts).some(
      (catId) => categoryTexts[catId] !== initialCategoryTexts[catId],
    );

    if (
      hasChanges &&
      !window.confirm(
        "You have unsaved changes. Are you sure you want to close?",
      )
    ) {
      return;
    }
    onOpenChange(false);
  };

  const handleCategoryTextChange = (categoryId, value) => {
    setCategoryTexts((prev) => ({
      ...prev,
      [categoryId]: value,
    }));

    // Clear error for this category when user types
    if (errors[categoryId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[categoryId];
        return newErrors;
      });
    }
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // Toggle wrap/unwrap for ALL categories at once
  const toggleWrapAll = () => {
    Object.keys(textareaRefs.current).forEach((categoryId) => {
      const textarea = textareaRefs.current[categoryId];
      if (textarea) {
        const currentStyle = textarea.style.whiteSpace;
        textarea.style.whiteSpace = currentStyle === "pre" ? "pre-wrap" : "pre";
      }
    });
  };

  // Format text for ALL categories at once
  const handleFormatAll = () => {
    const newTexts = {};
    Object.keys(categoryTexts).forEach((categoryId) => {
      newTexts[categoryId] = formatCategoryText(
        categoryTexts[categoryId] || "",
      );
    });
    setCategoryTexts(newTexts);
  };

  const handleSave = () => {
    try {
      const allPeople = [];
      const newErrors = {};

      // First pass: Parse each category's text
      const parsedByCategory = {};
      sortedCategories.forEach((cat) => {
        try {
          // Pass existingPeopleData to preserve specialty/notes/photo
          const people = textToPeople(
            categoryTexts[cat.id] || "",
            cat.id,
            peopleData,
          );
          parsedByCategory[cat.id] = people;
        } catch (error) {
          newErrors[cat.id] = error.message;
        }
      });

      // If there are parsing errors, show them and don't continue
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        // Auto-expand categories with errors
        Object.keys(newErrors).forEach((catId) => {
          setExpandedCategories((prev) => ({ ...prev, [catId]: true }));
        });
        return;
      }

      // Second pass: Check for duplicate phone numbers across ALL categories
      const allParsedPeople = Object.values(parsedByCategory).flat();
      
      // Check against existing people (excluding those being replaced)
      const existingPeopleNotInBatch = peopleData.filter((existing) => {
        // Exclude if person is being updated (same category and name exists in parsed)
        const parsedInCategory = parsedByCategory[existing.category] || [];
        return !parsedInCategory.some(
          (parsed) => parsed.name.toLowerCase() === existing.name.toLowerCase()
        );
      });

      const duplicateCheck = batchCheckDuplicatePhones(
        allParsedPeople,
        existingPeopleNotInBatch
      );

      if (duplicateCheck.hasDuplicates) {
        // Group errors by category
        duplicateCheck.duplicates.forEach((dup) => {
          const errorMsg = `"${dup.personName}" has phone number ${dup.phone} which is already assigned to "${dup.existingContact.name}"`;
          
          if (!newErrors[dup.category]) {
            newErrors[dup.category] = errorMsg;
          } else {
            newErrors[dup.category] += "\n" + errorMsg;
          }
        });

        setErrors(newErrors);
        // Auto-expand categories with errors
        Object.keys(newErrors).forEach((catId) => {
          setExpandedCategories((prev) => ({ ...prev, [catId]: true }));
        });
        return;
      }

      // All validations passed, merge all people
      allParsedPeople.forEach((person) => {
        allPeople.push(person);
      });

      onSave(allPeople);
      onOpenChange(false);
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleCopy = (categoryId) => {
    navigator.clipboard.writeText(categoryTexts[categoryId] || "");
    alert("Category contacts copied to clipboard!");
  };

  const handleCopyAll = () => {
    const allText = sortedCategories
      .map((cat) => {
        const text = categoryTexts[cat.id] || "";
        if (!text.trim()) return "";
        return `${cat.label}\n${text}\n`;
      })
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(allText);
    alert("All contacts copied to clipboard!");
  };

  const hasChanges = Object.keys(categoryTexts).some(
    (catId) => categoryTexts[catId] !== initialCategoryTexts[catId],
  );

  // Count contacts per category
  const getCategoryCount = (categoryId) => {
    const text = categoryTexts[categoryId] || "";
    return text.split("\n").filter((line) => line.trim()).length;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Edit Contacts by Category</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
            <p className="font-semibold">Format Guide:</p>
            <p>
              • Each category has its own text area below (click to
              expand/collapse)
            </p>
            <p>
              • Format per line:{" "}
              <code>name | phone1 / phone2 / phone3 | address</code>
            </p>
            <p className="text-xs text-muted-foreground">
              (Phone numbers must be exactly 10 digits and unique across ALL contacts - spaces will be removed
              automatically)
            </p>
            <p className="text-xs text-muted-foreground">
              (You can use commas instead of pipes)
            </p>
            <p className="text-xs text-primary font-semibold">
              ℹ️ Only name, phones, and address are editable here. Specialty,
              notes, and photos are preserved automatically.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-primary hover:underline">
                Show Example
              </summary>
              <pre className="bg-background p-2 rounded mt-2 text-xs overflow-x-auto">
{`Ram Kumar | 9876543210 / 9123456789 | Main Street Colony
Shyam Singh | 9988776655 | Downtown area
ABC Hardware | 9191919191 | Near City Mall`}
              </pre>
            </details>
          </div>

          {/* Global Wrap/Unwrap and Format buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={toggleWrapAll} variant="outline" size="sm">
              <WrapText className="w-4 h-4 mr-2" />
              Wrap/Unwrap
            </Button>
            <Button onClick={handleFormatAll} variant="outline" size="sm">
              Format
            </Button>
          </div>

          <div className="space-y-3">
            {sortedCategories.map((cat) => {
              const count = getCategoryCount(cat.id);
              const isExpanded = expandedCategories[cat.id];
              const hasError = errors[cat.id];

              return (
                <div
                  key={cat.id}
                  className={`border rounded-lg ${hasError ? "border-destructive" : "border-border"}`}
                >
                  {/* Accordion Header */}
                  <Accordion
                    title={
                      <div className="flex-1 w-full flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-semibold">
                            {cat.label}
                          </span>

                          <Badge variant="secondary" className="text-xs m-0">
                            {count}
                          </Badge>
                          {count ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(cat.id);
                              }}
                              className="h-7 flex justify-center items-center rounded-md border px-1.5"
                            >
                              <Copy className="w-4 h-4" />
                            </span>
                          ) : (
                            ""
                          )}
                        </div>
                      </div>
                    }
                    defaultOpen={false}
                  >
                    <div className="pt-0 space-y-2">
                      <Textarea
                        ref={(el) => {
                          if (el) textareaRefs.current[cat.id] = el;
                        }}
                        value={categoryTexts[cat.id] || ""}
                        onChange={(e) =>
                          handleCategoryTextChange(cat.id, e.target.value)
                        }
                        className="font-mono text-sm max-h-[200px] resize-none"
                        style={{ whiteSpace: "pre", minHeight: "100px" }}
                        placeholder={`Add ${cat.label.toLowerCase()} contacts here...
Example:
Name | 9876543210 | Address
Another Person | 9988776655 / 9123456789 | Another Address`}
                      />

                      {hasError && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
                          <p className="font-semibold mb-1">
                            Errors in {cat.label}:
                          </p>
                          <pre className="text-xs whitespace-pre-wrap">
                            {errors[cat.id]}
                          </pre>
                        </div>
                      )}
                    </div>
                  </Accordion>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={!hasChanges}
          >
            Save All Changes
          </Button>
          <Button onClick={handleCopyAll} variant="outline">
            Copy All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};