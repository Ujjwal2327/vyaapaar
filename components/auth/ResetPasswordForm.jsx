"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from "lucide-react";
import Loader from "@/components/Loader";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validatingSession, setValidatingSession] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  // Validate that user came from reset link and handle hash errors
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if there's an error in the URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorCode = hashParams.get('error_code');
        const errorDescription = hashParams.get('error_description');
        
        if (errorCode) {
          // Handle specific error cases
          if (errorCode === 'otp_expired') {
            setSessionError("This password reset link has expired. Please request a new one.");
          } else {
            setSessionError(errorDescription || "Invalid reset link. Please request a new one.");
          }
          setValidatingSession(false);
          return;
        }

        // Check for valid session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        // If no session, redirect to forgot password page
        if (!session) {
          setSessionError("No valid session found. Please request a new password reset link.");
          setValidatingSession(false);
          return;
        }

        // Session is valid
        setValidatingSession(false);
      } catch (error) {
        console.error("Session validation error:", error);
        setSessionError("An error occurred. Please request a new password reset link.");
        setValidatingSession(false);
      }
    };

    checkSession();
  }, []);

  function validateForm() {
    if (!password || !confirmPassword) {
      return "Please fill in all fields";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error) {
      console.error("Password update error:", error);
      setError(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  if (validatingSession) {
    return <Loader content="Verifying reset link..." />;
  }

  // Show error if session is invalid
  if (sessionError) {
    return (
      <Card className="w-full max-w-sm">
        <Logo />
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <CardTitle>Reset Link Invalid</CardTitle>
          </div>
          <CardDescription>
            Unable to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive font-medium mb-2">
              {sessionError}
            </p>
            <p className="text-sm text-muted-foreground">
              Password reset links expire after 1 hour for security reasons.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => router.push("/forgot-password")}
          >
            Request New Reset Link
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/login")}
          >
            Back to Login
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm">
        <Logo />
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <CardTitle>Password Reset Successful!</CardTitle>
          </div>
          <CardDescription>
            Your password has been updated successfully
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-sm">
            <p className="text-green-800 dark:text-green-200">
              Redirecting you to login page...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <Logo />
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your new password below
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            {/* New Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
              <p className="font-semibold">Password requirements:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li className={password.length >= 6 ? "text-green-600 dark:text-green-400" : ""}>
                  At least 6 characters
                </li>
                <li className={password === confirmPassword && password ? "text-green-600 dark:text-green-400" : ""}>
                  Passwords match
                </li>
              </ul>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-destructive text-sm font-medium">{error}</p>
              </div>
            )}
          </div>
        </form>
      </CardContent>

      <CardFooter>
        <Button
          type="submit"
          className="w-full"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Resetting Password..." : "Reset Password"}
        </Button>
      </CardFooter>
    </Card>
  );
}