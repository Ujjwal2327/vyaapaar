import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, MapPin, Briefcase, User, Mail, Star } from "lucide-react";

const CATEGORY_COLORS = {
  plumber: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  helper: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  transporter:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  customer:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  supplier: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const CATEGORY_LABELS = {
  plumber: "Plumber",
  helper: "Helper",
  transporter: "Transporter",
  customer: "Customer",
  supplier: "Supplier",
  other: "Other",
};

export const PersonDetailModal = ({
  open,
  onOpenChange,
  person,
  availableCategories,
}) => {
  if (!person) return null;

  // Find category label from available categories
  const category = availableCategories?.find(
    (cat) => cat.id === person.category,
  );
  const categoryLabel =
    category?.label || CATEGORY_LABELS[person.category] || person.category;
  const categoryColor =
    CATEGORY_COLORS[person.category] || CATEGORY_COLORS.other;

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle backward compatibility: convert old single phone to array
  const phones = person.phones
    ? person.phones.filter((p) => p && p.trim())
    : person.phone
      ? [person.phone]
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-2">
            <Avatar className="w-20 h-20">
              <AvatarImage src={person.photo || null} alt={person.name} />
              <AvatarFallback className="bg-primary/10 text-2xl">
                {getInitials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 flex flex-col items-start">
              <DialogTitle className="text-2xl mb-1 truncate">{person.name}</DialogTitle>
              <Badge className={`${categoryColor} border-0`}>
                {categoryLabel}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Phone Numbers */}
          {phones.length > 0 && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  Phone Number{phones.length > 1 ? "s" : ""}
                </h4>
                <div className="space-y-1">
                  {phones.map((phone, index) => (
                    <a
                      key={index}
                      href={`tel:${phone}`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors block"
                    >
                      {phone}
                      {index === 0 && phones.length > 1 && (
                        <Star
                          className="w-3 h-3 fill-yellow-500 text-yellow-500 inline ml-2"
                          title="Primary"
                        />
                      )}
                      {phones.length > 1 && index !== 0 && (
                        <span className="text-xs ml-2 opacity-60">
                          #{index + 1}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Address */}
          {person.address && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">Address</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {person.address}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Specialty */}
          {person.specialty && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">Specialty / Role</h4>
                  <p className="text-sm text-muted-foreground">
                    {person.specialty}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {person.notes && person.notes.trim() && (
            <>
              <Separator />
              <div className="pt-2">
                <h4 className="font-semibold mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {person.notes}
                </p>
              </div>
            </>
          )}

          {/* Empty state for no additional info */}
          {phones.length === 0 &&
            !person.specialty &&
            !person.address &&
            (!person.notes || !person.notes.trim()) && (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground italic">
                  No additional information available
                </p>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
