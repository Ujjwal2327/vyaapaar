"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/catalog",
      label: "Catalog",
      icon: Package,
    },
    {
      href: "/contacts",
      label: "Contacts",
      icon: Users,
    },
  ];

  return (
    <nav className="flex gap-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}
