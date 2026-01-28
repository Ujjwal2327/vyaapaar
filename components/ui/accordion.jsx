import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Accordion({
  title,
  children,
  defaultOpen = false,
  badge = null,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden text-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          {badge && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && <div className="p-4 pt-0 space-y-4">{children}</div>}
    </div>
  );
}
