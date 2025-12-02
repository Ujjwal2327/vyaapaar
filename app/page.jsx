"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/pricelist");
    }
  }, [user, loading, router]);

  // while checking session
  if (loading) return null;

  // if not logged in → show landing
  if (!user) {
    return (
      <main className="p-4">
        <h1>Welcome to Vyaapaar</h1>
        <p>Your landing page content here...</p>
        <a href="/login" className="underline text-blue-600">
          Login
        </a>
      </main>
    );
  }

  // If somehow reached here while logged in (should auto redirect)
  return null;
}
