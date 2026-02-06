"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardAction,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import Loader from "../Loader";

export default function LoginForm({ redirectTo = "/catalog" }) {
  const { signIn, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, router, redirectTo]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await signIn(email, password);

    setLoading(false);

    if (error) {
      setErr(error.message || "Invalid login");
      return;
    }

    router.replace(redirectTo);
  }

  if (authLoading) return <Loader/>

  return (
    <Card className="w-full max-w-sm">
      <Logo />
      <CardHeader>
        <CardTitle>Login to your account</CardTitle>

        <CardDescription>
          Enter your email and password to continue
        </CardDescription>

        <CardAction>
          <Button
            variant="link"
            onClick={() => router.push("/register")}
            className="px-0"
          >
            Sign Up
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit}>
          <div className="flex flex-col gap-6">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => router.push("/forgot-password")}
                  className="ml-auto text-sm underline-offset-4 hover:underline text-muted-foreground"
                >
                  Forgot your password?
                </button>
              </div>

              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {err && (
                <p className="text-red-600 text-sm font-medium mt-1">{err}</p>
              )}
            </div>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Button
          type="submit"
          className="w-full"
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </Button>
      </CardFooter>
    </Card>
  );
}
