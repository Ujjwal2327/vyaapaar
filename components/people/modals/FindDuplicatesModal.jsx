import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  User,
  Phone,
  MapPin,
  Briefcase,
  FileText,
  Users2,
  Merge,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { findAllSharedPhoneNumbers } from "@/lib/utils/phoneValidation";
import {
  calculateDuplicateScore,
  mergeContacts,
  getDuplicateExplanation,
} from "@/lib/utils/duplicateContactUtils";

/**
 * FindDuplicatesModal
 *
 * Scans all contacts for potential duplicates and allows merging them.
 * Duplicates are identified by:
 * - Same phone numbers
 * - Similar names
 * - Other matching fields
 */
export const FindDuplicatesModal = ({
  open,
  onOpenChange,
  peopleData = [],
  onMerge, // (mergedContacts, contactsToDelete) => void
}) => {
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [mergeSelections, setMergeSelections] = useState({}); // groupIndex -> { keepContactId, mergeIntoContactId }
  const [isScanning, setIsScanning] = useState(false);

  // Scan for duplicates when modal opens
  useEffect(() => {
    if (open && peopleData.length > 0) {
      scanForDuplicates();
    } else if (!open) {
      // Reset state when modal closes
      setDuplicateGroups([]);
      setSelectedGroup(null);
      setMergeSelections({});
    }
  }, [open, peopleData]);

  const scanForDuplicates = () => {
    setIsScanning(true);

    try {
      // Find all contacts that share phone numbers
      const sharedPhones = findAllSharedPhoneNumbers(peopleData);

      // Create duplicate groups
      const groups = [];
      const processedContacts = new Set();

      // Group by shared phone numbers
      Object.entries(sharedPhones).forEach(([phone, contacts]) => {
        // Skip if all contacts already processed
        if (contacts.every((c) => processedContacts.has(c.id))) {
          return;
        }

        // Calculate duplicate scores for all pairs
        const contactsWithScores = contacts.map((contact) => {
          const otherContacts = contacts.filter((c) => c.id !== contact.id);
          const scores = otherContacts.map((other) =>
            calculateDuplicateScore(contact, other),
          );

          const avgScore =
            scores.length > 0
              ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
              : 0;

          return {
            contact,
            avgScore,
            scores: scores.map((score, idx) => ({
              ...score,
              otherContact: otherContacts[idx],
            })),
          };
        });

        // Sort by average score
        contactsWithScores.sort((a, b) => b.avgScore - a.avgScore);

        groups.push({
          id: `group-${groups.length}`,
          sharedPhone: phone,
          contacts: contactsWithScores.map((c) => c.contact),
          scores: contactsWithScores,
          matchType:
            contactsWithScores[0]?.avgScore >= 0.7
              ? "high"
              : contactsWithScores[0]?.avgScore >= 0.5
                ? "medium"
                : "low",
        });

        // Mark contacts as processed
        contacts.forEach((c) => processedContacts.add(c.id));
      });

      // Also find name-based duplicates (similar names, may not have same phone)
      const nameDuplicates = findNameBasedDuplicates(
        peopleData,
        processedContacts,
      );
      groups.push(...nameDuplicates);

      setDuplicateGroups(groups);

      // Auto-select first group
      if (groups.length > 0) {
        setSelectedGroup(0);

        // Initialize merge selections
        const initialSelections = {};
        groups.forEach((group, index) => {
          // Default: merge all into the first contact
          initialSelections[index] = {
            keepContactId: group.contacts[0].id,
            mergeIntoContactId: group.contacts[0].id,
          };
        });
        setMergeSelections(initialSelections);
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Find duplicates based on name similarity
  const findNameBasedDuplicates = (contacts, alreadyProcessed) => {
    const groups = [];
    const processed = new Set(alreadyProcessed);

    for (let i = 0; i < contacts.length; i++) {
      if (processed.has(contacts[i].id)) continue;

      const similar = [];
      for (let j = i + 1; j < contacts.length; j++) {
        if (processed.has(contacts[j].id)) continue;

        const score = calculateDuplicateScore(contacts[i], contacts[j]);

        // Only include if high similarity and not already in a phone-based group
        if (score.score >= 0.7) {
          if (similar.length === 0) {
            similar.push(contacts[i]);
          }
          similar.push(contacts[j]);
          processed.add(contacts[j].id);
        }
      }

      if (similar.length > 1) {
        const scores = similar.map((contact) => {
          const otherContacts = similar.filter((c) => c.id !== contact.id);
          const contactScores = otherContacts.map((other) =>
            calculateDuplicateScore(contact, other),
          );

          const avgScore =
            contactScores.reduce((sum, s) => sum + s.score, 0) /
            contactScores.length;

          return {
            contact,
            avgScore,
            scores: contactScores.map((score, idx) => ({
              ...score,
              otherContact: otherContacts[idx],
            })),
          };
        });

        scores.sort((a, b) => b.avgScore - a.avgScore);

        groups.push({
          id: `group-${groups.length}`,
          sharedPhone: null,
          contacts: scores.map((s) => s.contact),
          scores,
          matchType: scores[0].avgScore >= 0.8 ? "high" : "medium",
        });

        processed.add(contacts[i].id);
      }
    }

    return groups;
  };

  const handleMergeSelection = (groupIndex, keepContactId) => {
    setMergeSelections((prev) => ({
      ...prev,
      [groupIndex]: {
        keepContactId,
        mergeIntoContactId: keepContactId,
      },
    }));
  };

  const handleMergeAll = () => {
    const contactsToDelete = [];
    const mergedContacts = [];

    duplicateGroups.forEach((group, index) => {
      const selection = mergeSelections[index];
      if (!selection) return;

      const keepContact = group.contacts.find(
        (c) => c.id === selection.keepContactId,
      );
      const otherContacts = group.contacts.filter(
        (c) => c.id !== selection.keepContactId,
      );

      // Merge all other contacts into the keep contact
      let merged = { ...keepContact };
      otherContacts.forEach((contact) => {
        merged = mergeContacts(merged, contact, {
          preferNew: false, // Prefer existing (keep contact) data
          mergePhones: true,
          mergeNotes: true,
        });
        contactsToDelete.push(contact.id);
      });

      mergedContacts.push(merged);
    });

    onMerge(mergedContacts, contactsToDelete);
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getMatchTypeBadge = (matchType) => {
    switch (matchType) {
      case "high":
        return <Badge className="bg-orange-500 text-xs">High Confidence</Badge>;
      case "medium":
        return <Badge className="bg-blue-500 text-xs">Medium Confidence</Badge>;
      case "low":
        return (
          <Badge variant="outline" className="text-xs">
            Low Confidence
          </Badge>
        );
      default:
        return null;
    }
  };

  const ContactPreview = ({ contact, label, isSelected, onSelect }) => (
    <div
      className={`space-y-2 p-3 border rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary/10 border-primary"
          : "bg-muted/30 hover:bg-muted/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <Avatar className="w-10 h-10">
          <AvatarImage src={contact.photo || null} />
          <AvatarFallback className="bg-primary/10 text-xs">
            {contact.name ? (
              getInitials(contact.name)
            ) : (
              <User className="w-4 h-4" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-semibold truncate">{contact.name}</p>
        </div>
        {isSelected && (
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
        )}
      </div>

      {contact.phones && contact.phones.filter((p) => p).length > 0 && (
        <div className="flex items-start gap-2 text-xs">
          <Phone className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex flex-wrap gap-1">
            {contact.phones
              .filter((p) => p)
              .map((phone, i) => (
                <span key={i}>
                  {phone}
                  {i < contact.phones.filter((p) => p).length - 1 && ","}
                </span>
              ))}
          </div>
        </div>
      )}

      {contact.address && (
        <div className="flex items-start gap-2 text-xs">
          <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
          <span className="line-clamp-1">{contact.address}</span>
        </div>
      )}

      {contact.specialty && (
        <div className="flex items-start gap-2 text-xs">
          <Briefcase className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
          <span className="line-clamp-1">{contact.specialty}</span>
        </div>
      )}
    </div>
  );

  if (isScanning) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="w-12 h-12 text-primary animate-pulse mb-4" />
            <p className="text-lg font-semibold">Scanning for duplicates...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (duplicateGroups.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users2 className="w-5 h-5 text-green-500" />
              No Duplicates Found
            </DialogTitle>
            <DialogDescription>
              Great! No duplicate contacts were found. All contacts appear to be
              unique.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  const currentGroup = duplicateGroups[selectedGroup];
  const currentSelection = mergeSelections[selectedGroup];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Duplicate Contacts Found
          </DialogTitle>
          <DialogDescription className="text-sm">
            Found {duplicateGroups.length} group
            {duplicateGroups.length !== 1 ? "s" : ""} of potential duplicate
            contacts. Review and select which contact to keep in each group.
          </DialogDescription>
        </DialogHeader>

        {/* Group selector - mobile friendly */}
        <div className="flex items-center justify-between gap-2 py-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedGroup(Math.max(0, selectedGroup - 1))}
            disabled={selectedGroup === 0}
            className="shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 text-center">
            <p className="text-sm font-semibold">
              Group {selectedGroup + 1} of {duplicateGroups.length}
            </p>
            <span className="text-xs text-muted-foreground">
              {currentGroup.contacts.length} contacts
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSelectedGroup(
                Math.min(duplicateGroups.length - 1, selectedGroup + 1),
              )
            }
            disabled={selectedGroup === duplicateGroups.length - 1}
            className="shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Separator />

        {/* Main content */}
        <ScrollArea className="flex-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="space-y-3 pb-4">
            {/* Match info */}
            {currentGroup.sharedPhone && (
              <div className="p-3 rounded-lg border text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4" />
                  <p className="font-semibold">Shared Phone Number</p>
                </div>
                <p className="text-xs">
                  All these contacts share:{" "}
                  <span className="font-mono">{currentGroup.sharedPhone}</span>
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg border">
              <p className="font-semibold text-sm mb-1">Instructions</p>
              <p className="text-xs text-muted-foreground">
                Tap the contact you want to keep. Other contacts will be merged
                into it, combining their phone numbers, notes, and other
                information.
              </p>
            </div>

            {/* Contacts to merge */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Select contact to keep:</p>
              {currentGroup.contacts.map((contact, idx) => (
                <ContactPreview
                  key={contact.id}
                  contact={contact}
                  label={`Contact ${idx + 1}`}
                  isSelected={currentSelection?.keepContactId === contact.id}
                  onSelect={() =>
                    handleMergeSelection(selectedGroup, contact.id)
                  }
                />
              ))}
            </div>

            {/* Preview merged result */}
            {currentSelection && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Merge className="w-4 h-4 text-primary" />
                  <p className="font-semibold text-sm">Merged Result Preview</p>
                </div>

                <div className="p-3 rounded-lg border">
                  {(() => {
                    const keepContact = currentGroup.contacts.find(
                      (c) => c.id === currentSelection.keepContactId,
                    );
                    const otherContacts = currentGroup.contacts.filter(
                      (c) => c.id !== currentSelection.keepContactId,
                    );

                    let merged = { ...keepContact };
                    otherContacts.forEach((contact) => {
                      merged = mergeContacts(merged, contact, {
                        preferNew: false,
                        mergePhones: true,
                        mergeNotes: true,
                      });
                    });

                    return (
                      <div className="space-y-2">
                        <p className="font-semibold">{merged.name}</p>
                        {merged.phones &&
                          merged.phones.filter((p) => p).length > 0 && (
                            <div className="flex items-start gap-2 text-sm">
                              <Phone className="w-4 h-4 mt-0.5 shrink-0" />
                              <div className="flex flex-wrap gap-1">
                                {merged.phones
                                  .filter((p) => p)
                                  .map((phone, i) => (
                                    <span key={i} className="font-mono">
                                      {phone}
                                      {i <
                                        merged.phones.filter((p) => p).length -
                                          1 && ","}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        {merged.address && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{merged.address}</span>
                          </div>
                        )}
                        {merged.specialty && (
                          <div className="flex items-start gap-2 text-sm">
                            <Briefcase className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{merged.specialty}</span>
                          </div>
                        )}
                        {merged.notes && (
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                            <span className="line-clamp-3">{merged.notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <div className="flex flex-col sm:flex-row gap-2 pt-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleMergeAll}
            className="flex-1 order-1 sm:order-2"
          >
            <Merge className="w-4 h-4 mr-2" />
            Merge All ({duplicateGroups.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
