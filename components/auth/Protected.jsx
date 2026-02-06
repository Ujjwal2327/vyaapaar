"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import Loader from "../Loader";

export function Protected({ children, fallback = null }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) return fallback ?? <Loader />;
  if (!user) return null;
  return <>{children}</>;
}
