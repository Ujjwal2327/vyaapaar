import { Package } from "lucide-react";

export default function Loader({ content }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Package className="w-16 h-16 mx-auto text-primary animate-pulse" />
        <div className="animate-pulse text-muted-foreground">
          {content || "Loading..."}
        </div>
      </div>
    </div>
  );
}
