import { Edit2, Trash2, Phone, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LazyAvatar } from "@/components/ui/lazyAvatar";

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

export const PersonCard = ({
  person,
  editMode,
  onEdit,
  onDelete,
  onViewDetails,
  availableCategories,
}) => {
  const isClickable = !editMode;

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
    ? person.phones
    : person.phone
      ? [person.phone]
      : [];

  // Get primary phone (first non-empty phone)
  const primaryPhone = phones.find((p) => p && p.trim()) || null;

  return (
    <div
      className={`bg-card rounded-lg border p-4 ${
        isClickable
          ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          : ""
      }`}
      onClick={() => isClickable && onViewDetails(person)}
    >
      <div className="flex items-start gap-3">
        {/* Avatar with Lazy Loading */}
        <LazyAvatar 
          src={person.photo || null} 
          alt={person.name}
          fallback={getInitials(person.name)}
          className="w-12 h-12 shrink-0 bg-primary/10"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{person.name}</h3>
              <div className="flex flex-col sm:flex-row gap-x-10 gap-y-3 sm:items-center">
                <Badge className={`${categoryColor} border-0 text-xs`}>
                  {categoryLabel}
                </Badge>
                {primaryPhone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <a
                      href={`tel:${primaryPhone}`}
                      className="hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {primaryPhone}
                      {phones.filter((p) => p && p.trim()).length > 1 && (
                        <span className="text-xs ml-1">
                          (+{phones.filter((p) => p && p.trim()).length - 1}{" "}
                          more)
                        </span>
                      )}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {editMode && (
              <div className="flex gap-2 shrink-0">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(person);
                  }}
                  variant="ghost"
                  size="icon"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(person.id);
                  }}
                  variant="ghost"
                  size="icon"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Info Grid */}

          {person.address && (
            <div className="flex items-center gap-2 text-muted-foreground mt-2">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{person.address}</span>
            </div>
          )}

          {person.specialty && (
            <div className="flex items-center gap-2 text-muted-foreground mt-2">
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="truncate">{person.specialty}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};