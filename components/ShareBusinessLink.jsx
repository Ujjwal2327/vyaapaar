// components/ShareBusinessLink.jsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Share2, Copy, ExternalLink } from "lucide-react";

export default function ShareBusinessLink() {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [publicUrl, setPublicUrl] = useState("");

  useEffect(() => {
    if (user) {
      loadBusinessInfo();
    }
  }, [user]);

  const loadBusinessInfo = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("business_name, business_address")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data?.business_name) {
        setBusinessName(data.business_name);
        setBusinessAddress(data.business_address || "");
        // Generate public URL
        const url = `${window.location.origin}/business/${encodeURIComponent(data.business_name)}`;
        setPublicUrl(url);
      }
    } catch (error) {
      console.error("Error loading business info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!publicUrl) {
      toast.error("No business name set", {
        description:
          "Please set your business name in the User Profile section first.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copied!", {
        description: "Share this link with your customers.",
      });
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenLink = () => {
    if (!publicUrl) {
      toast.error("No business name set");
      return;
    }
    window.open(publicUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!businessName) {
    return (
      <div className="py-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Set your business name in the User Profile section to get a shareable
          public link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[16px]" htmlFor="public-url">
          Your Public Link
        </Label>
        <div className="flex gap-2">
          <Input
            id="public-url"
            value={publicUrl}
            readOnly
            className="font-mono text-sm"
          />
          <Button onClick={handleCopyLink} variant="outline" size="icon">
            <Copy className="w-4 h-4" />
          </Button>
          <Button onClick={handleOpenLink} variant="outline" size="icon">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Share this link with your customers so they can view your product
          catalog.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2">
        <p className="font-semibold">What customers will see:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Your business name</li>
          {businessAddress && <li>Your business address</li>}
          <li>All categories and items</li>
          <li>Retail sell prices only (no bulk sell, cost or profit information)</li>
          <li>Item and category notes</li>
        </ul>
      </div>
    </div>
  );
}