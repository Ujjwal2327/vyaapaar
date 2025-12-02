"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";

export default function LogoutBtn({ className = "" }) {
  const { signOut } = useAuth();
  const router = useRouter();

  async function handle() {
    await signOut();
    router.replace("/login");
  }

  return (
    <Button variant="ghost" onClick={handle} className={className}>
      Sign out
    </Button>
  );
}
