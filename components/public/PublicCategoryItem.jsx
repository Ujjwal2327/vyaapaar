import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";

export const PublicCategoryItem = ({
  name,
  path,
  level,
  isExpanded,
  onToggle,
  onViewDetails,
  children,
}) => {
  // Double-tap detection state
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef(null);

  const handleCategoryClick = () => {
    setTapCount((prev) => prev + 1);

    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    // Set new timeout
    tapTimeoutRef.current = setTimeout(() => {
      if (tapCount + 1 === 1) {
        // Single tap - toggle expand/collapse
        onToggle();
      } else if (tapCount + 1 === 2) {
        // Double tap - view details
        onViewDetails();
      }
      setTapCount(0);
    }, 300); // 300ms window for double tap
  };

  return (
    <div className="mb-2">
      <Button
        onClick={handleCategoryClick}
        className={`w-full justify-between ${
          level === 0
            ? "text-xl font-bold"
            : level === 1
            ? "text-lg font-semibold"
            : "text-[1.1rem] font-semibold"
        }`}
        variant="secondary"
      >
        <span>{name}</span>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </Button>

      {isExpanded && (
        <div className="ml-1 mt-2 space-y-2 border-l-2 border-border pl-3">
          {children}
        </div>
      )}
    </div>
  );
};