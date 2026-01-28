import { Package } from "lucide-react";
import Link from "next/link";

export default function Logo({className}) {
  return (
    <Link href="/" className={`flex items-center justify-center gap-2 cursor-pointer ${className}`}>
      <Package className="h-8 w-8 text-primary" />
      <span className="text-2xl font-bold bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Vyaapaar
      </span>
    </Link>
  );
}
