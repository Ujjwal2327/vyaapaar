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

export default function RegisterForm({ redirectTo = "/login" }) {
  const { signUp, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/pricelist");
    }
  }, [authLoading, user, router, redirectTo]);

  function validate() {
    if (!email) return "Email is required";
    // simple email check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email";
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password !== confirm) return "Passwords do not match";
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setSuccessMsg(null);

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      setErr(error.message || "Registration failed");
      return;
    }

    // Most Supabase setups send a confirmation email.
    setSuccessMsg("Account created. Please check your email to confirm.");
    // redirect to login after short delay so user sees message
    setTimeout(() => {
      router.replace(redirectTo);
    }, 900);
  }

  return (
    <Card className="w-full max-w-sm">
      <h2 className="text-center text-2xl font-bold">Vyaapaar</h2>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>

        <CardDescription>
          Enter your email and pick a password to create your account
        </CardDescription>

        <CardAction>
          <Button
            variant="link"
            onClick={() => router.push("/login")}
            className="px-0"
          >
            Sign In
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Confirm Password */}
            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {err && (
              <p className="text-red-600 text-sm font-medium mt-1">{err}</p>
            )}

            {successMsg && (
              <p className="text-green-600 text-sm font-medium mt-1">
                {successMsg}
              </p>
            )}
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
          {loading ? "Creating..." : "Create account"}
        </Button>
      </CardFooter>
    </Card>
  );
}
