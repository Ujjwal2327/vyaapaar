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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  ArrowRight,
  User,
  Phone,
  MapPin,
  Briefcase,
  FileText,
  CheckCircle2,
  X,
} from "lucide-react";
import { getDuplicateExplanation } from "@/lib/utils/duplicateContactUtils";

/**
 * DuplicateContactsModal
 * 
 * Handles resolution of duplicate contacts detected during:
 * - Add single contact
 * - Bulk edit
 * - VCF import
 * - Contact picker import
 * 
 * Actions per duplicate:
 * - Merge: Combine data from both contacts
 * - Replace: Replace existing with new
 * - Skip: Don't add the new contact
 * 
 * Batch actions:
 * - Apply action to all duplicates at once
 * - Select/deselect all
 */
export const DuplicateContactsModal = ({
  open,
  onOpenChange,
  duplicates = [], // Array of { newContact, duplicates: [{ existingContact, score, reasons, matchType }] }
  onResolve, // (resolutions) => void - Array of { newContact, action: 'merge'|'replace'|'skip', targetContact }
}) => {
  // Resolution state for each duplicate
  // Key: index of duplicate in duplicates array
  // Value: { action: 'merge'|'replace'|'skip', targetIndex: number (if multiple existing matches) }
  const [resolutions, setResolutions] = useState({});
  
  // Selected duplicates for batch operations
  const [selectedDuplicates, setSelectedDuplicates] = useState(new Set());
  
  // Current duplicate being viewed in detail
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState(0);

  // Initialize resolutions when duplicates change
  useEffect(() => {
    if (duplicates.length > 0) {
      const initialResolutions = {};
      duplicates.forEach((dup, index) => {
        // Default action: merge if high confidence, skip if low
        const bestMatch = dup.duplicates[0];
        const defaultAction = bestMatch.matchType === 'exact' ? 'skip' : 
                            bestMatch.matchType === 'high' ? 'merge' : 'skip';
        
        initialResolutions[index] = {
          action: defaultAction,
          targetIndex: 0 // Always use first (best) match by default
        };
      });
      setResolutions(initialResolutions);
      setCurrentDuplicateIndex(0);
      setSelectedDuplicates(new Set());
    }
  }, [duplicates]);

  if (!duplicates || duplicates.length === 0) return null;

  const currentDuplicate = duplicates[currentDuplicateIndex];
  const currentResolution = resolutions[currentDuplicateIndex] || { action: 'skip', targetIndex: 0 };
  const selectedExistingContact = currentDuplicate.duplicates[currentResolution.targetIndex]?.existingContact;

  const handleSetAction = (index, action) => {
    setResolutions(prev => ({
      ...prev,
      [index]: { ...prev[index], action }
    }));
  };

  const handleSetTargetIndex = (index, targetIndex) => {
    setResolutions(prev => ({
      ...prev,
      [index]: { ...prev[index], targetIndex }
    }));
  };

  const handleToggleSelect = (index) => {
    setSelectedDuplicates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedDuplicates(new Set(duplicates.map((_, i) => i)));
  };

  const handleDeselectAll = () => {
    setSelectedDuplicates(new Set());
  };

  const handleBatchAction = (action) => {
    const newResolutions = { ...resolutions };
    selectedDuplicates.forEach(index => {
      newResolutions[index] = { ...newResolutions[index], action };
    });
    setResolutions(newResolutions);
  };

  const handleResolve = () => {
    // Build resolution array
    const resolutionArray = duplicates.map((dup, index) => {
      const resolution = resolutions[index];
      const targetContact = dup.duplicates[resolution.targetIndex]?.existingContact;
      
      return {
        newContact: dup.newContact,
        action: resolution.action,
        targetContact: targetContact,
        existingContactId: targetContact?.id
      };
    });

    onResolve(resolutionArray);
  };

  const getActionBadgeVariant = (action) => {
    switch (action) {
      case 'merge': return 'default';
      case 'replace': return 'destructive';
      case 'skip': return 'secondary';
      default: return 'outline';
    }
  };

  const getMatchTypeBadge = (matchType) => {
    switch (matchType) {
      case 'exact':
        return <Badge className="bg-red-500">Exact Duplicate</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High Confidence</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium Confidence</Badge>;
      case 'low':
        return <Badge variant="outline">Low Confidence</Badge>;
      default:
        return null;
    }
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const ContactPreview = ({ contact, label }) => (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        <Avatar className="w-12 h-12">
          <AvatarImage src={contact.photo || null} />
          <AvatarFallback className="bg-primary/10">
            {contact.name ? getInitials(contact.name) : <User className="w-6 h-6" />}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-lg">{contact.name}</p>
        </div>
      </div>

      {contact.phones && contact.phones.filter(p => p).length > 0 && (
        <div className="flex items-start gap-2 text-sm">
          <Phone className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <div>
            {contact.phones.filter(p => p).map((phone, i) => (
              <div key={i}>{phone}</div>
            ))}
          </div>
        </div>
      )}

      {contact.address && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <span>{contact.address}</span>
        </div>
      )}

      {contact.specialty && (
        <div className="flex items-start gap-2 text-sm">
          <Briefcase className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <span>{contact.specialty}</span>
        </div>
      )}

      {contact.notes && (
        <div className="flex items-start gap-2 text-sm">
          <FileText className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <span className="line-clamp-2">{contact.notes}</span>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Potential Duplicates Found
          </DialogTitle>
          <DialogDescription>
            Found {duplicates.length} contact{duplicates.length !== 1 ? 's' : ''} that may already exist.
            Choose how to handle each duplicate.
          </DialogDescription>
        </DialogHeader>

        {/* Summary & Batch Actions */}
        <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedDuplicates.size === duplicates.length}
                onCheckedChange={(checked) => {
                  if (checked) handleSelectAll();
                  else handleDeselectAll();
                }}
              />
              <span className="text-sm font-medium">
                {selectedDuplicates.size > 0
                  ? `${selectedDuplicates.size} selected`
                  : 'Select all'}
              </span>
            </div>

            {selectedDuplicates.size > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleBatchAction('merge')}
                >
                  Merge Selected
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBatchAction('replace')}
                >
                  Replace Selected
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBatchAction('skip')}
                >
                  Skip Selected
                </Button>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex gap-3 text-xs">
            <span>
              Merge: {Object.values(resolutions).filter(r => r.action === 'merge').length}
            </span>
            <span>
              Replace: {Object.values(resolutions).filter(r => r.action === 'replace').length}
            </span>
            <span>
              Skip: {Object.values(resolutions).filter(r => r.action === 'skip').length}
            </span>
          </div>
        </div>

        <Separator />

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Left sidebar - List of duplicates */}
          <div className="w-64 border-r pr-4">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {duplicates.map((dup, index) => {
                  const resolution = resolutions[index] || { action: 'skip', targetIndex: 0 };
                  const bestMatch = dup.duplicates[0];
                  
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        currentDuplicateIndex === index
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setCurrentDuplicateIndex(index)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Checkbox
                          checked={selectedDuplicates.has(index)}
                          onCheckedChange={() => handleToggleSelect(index)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Badge variant={getActionBadgeVariant(resolution.action)} className="text-xs">
                          {resolution.action}
                        </Badge>
                      </div>
                      
                      <p className="font-medium text-sm truncate">{dup.newContact.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dup.duplicates.length} possible match{dup.duplicates.length !== 1 ? 'es' : ''}
                      </p>
                      {getMatchTypeBadge(bestMatch.matchType)}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right side - Detail view */}
          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-4">
              {/* Navigation */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Contact {currentDuplicateIndex + 1} of {duplicates.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentDuplicateIndex(Math.max(0, currentDuplicateIndex - 1))}
                    disabled={currentDuplicateIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentDuplicateIndex(Math.min(duplicates.length - 1, currentDuplicateIndex + 1))}
                    disabled={currentDuplicateIndex === duplicates.length - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>

              {/* Match confidence */}
              <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-sm">
                  {getDuplicateExplanation(currentDuplicate.duplicates[currentResolution.targetIndex])}
                </p>
              </div>

              {/* Comparison */}
              <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-start">
                <ContactPreview contact={currentDuplicate.newContact} label="New Contact" />
                
                <div className="flex flex-col items-center justify-center pt-12">
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                </div>

                <ContactPreview contact={selectedExistingContact} label="Existing Contact" />
              </div>

              {/* Action selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Choose Action</Label>
                
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={currentResolution.action === 'merge' ? 'default' : 'outline'}
                    className="h-auto flex-col gap-2 py-4"
                    onClick={() => handleSetAction(currentDuplicateIndex, 'merge')}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <div className="text-center">
                      <div className="font-semibold">Merge</div>
                      <div className="text-xs font-normal">Combine both contacts</div>
                    </div>
                  </Button>

                  <Button
                    variant={currentResolution.action === 'replace' ? 'default' : 'outline'}
                    className="h-auto flex-col gap-2 py-4"
                    onClick={() => handleSetAction(currentDuplicateIndex, 'replace')}
                  >
                    <ArrowRight className="w-5 h-5" />
                    <div className="text-center">
                      <div className="font-semibold">Replace</div>
                      <div className="text-xs font-normal">Use new, discard old</div>
                    </div>
                  </Button>

                  <Button
                    variant={currentResolution.action === 'skip' ? 'default' : 'outline'}
                    className="h-auto flex-col gap-2 py-4"
                    onClick={() => handleSetAction(currentDuplicateIndex, 'skip')}
                  >
                    <X className="w-5 h-5" />
                    <div className="text-center">
                      <div className="font-semibold">Skip</div>
                      <div className="text-xs font-normal">Keep existing only</div>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Multiple matches selector */}
              {currentDuplicate.duplicates.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-sm">
                    Multiple possible matches found. Select which one to use:
                  </Label>
                  <div className="space-y-2">
                    {currentDuplicate.duplicates.map((match, idx) => (
                      <div
                        key={idx}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          currentResolution.targetIndex === idx
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleSetTargetIndex(currentDuplicateIndex, idx)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{match.existingContact.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {Math.round(match.score * 100)}% match
                            </p>
                          </div>
                          {getMatchTypeBadge(match.matchType)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <Separator />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleResolve} className="flex-1">
            Apply Resolutions ({duplicates.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};