import {
  Edit2,
  Trash2,
  Phone,
  MapPin,
  Briefcase,
  Receipt,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

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

// Same en-IN currency convention as TransactionCard.jsx / TransactionSummary.jsx —
// the sign is carried by icon + colour here, not by the string, so this always
// formats a magnitude.
const fmtNet = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(n ?? 0));

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

  const hasPhoto = person.hasPhoto;

  // Cached receivable-minus-payable figure, kept in sync by
  // hooks/useTransactions.js (see recomputeContactNetAmounts /
  // lib/utils/contactNetAmount.js) every time this contact's
  // transactions change. Positive = this contact owes the business
  // (receivable); negative = the business owes them (payable) — same
  // colour/icon language TransactionSummary.jsx already uses for the
  // same concept.
  const netAmount = person.netAmount ?? 0;
  const isReceivable = netAmount > 0.01;
  const isPayable = netAmount < -0.01;

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
        {/* Avatar */}
        <Avatar className="w-12 h-12 shrink-0">
          <AvatarFallback className="bg-primary/10">
            {getInitials(person.name)}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">
                {person.name}
                {hasPhoto && (
                  <span className="ml-2 text-xs text-muted-foreground">📷</span>
                )}
              </h3>
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

            <div className="flex items-center gap-1 shrink-0">
              {/* Net balance — always visible, replaces the old plain
                  "view transactions" icon button. Tapping it still opens
                  the transactions page; the amount itself is the
                  affordance now, coloured/iconed the same way
                  TransactionSummary.jsx marks receivable vs payable. */}
              <Link
                href={`/contacts/${person.id}/transactions`}
                onClick={(e) => e.stopPropagation()}
                title="View transactions"
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xl font-bold tabular-nums transition-colors hover:bg-muted ${
                  isReceivable
                    ? "text-green-600 dark:text-green-400"
                    : isPayable
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                }`}
              >
                {isReceivable ? (
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  isPayable && <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                )}
                {fmtNet(netAmount)}
              </Link>

              {editMode && (
                <>
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
                </>
              )}
            </div>
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
