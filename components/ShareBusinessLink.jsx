// components/ShareBusinessLink.jsx  (v2)
//
// v2: adds the publish/unpublish toggle (catalog_public) and switches the
// public link from the business name to the account's stable public_slug,
// so renaming the business no longer breaks a link someone already has.
// See docs/migrations/2026-09-22-public-catalog-lockdown.sql — the
// business_name/business_address select this file already did is
// unaffected by that migration's RLS changes (it's always been scoped to
// `.eq("id", user.id)`, i.e. the signed-in owner reading their own row).
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Share2, Copy, ExternalLink, Globe, EyeOff } from "lucide-react";

export default function ShareBusinessLink() {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [catalogPublic, setCatalogPublicRaw] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
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
        .select("business_name, business_address, public_slug, catalog_public")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data?.business_name) {
        setBusinessName(data.business_name);
        setBusinessAddress(data.business_address || "");
        setCatalogPublicRaw(data.catalog_public ?? true);
        if (data.public_slug) {
          setPublicUrl(
            `${window.location.origin}/business/${data.public_slug}`,
          );
        }
      }
    } catch (error) {
      console.error("Error loading business info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (checked) => {
    if (!user || isSavingVisibility) return;
    setIsSavingVisibility(true);
    // Optimistic, same "update UI first" pattern the rest of the app uses
    // for its other toggles.
    setCatalogPublicRaw(checked);
    const loadingToast = toast.loading(
      checked ? "Publishing catalog..." : "Unpublishing catalog...",
    );
    try {
      const { error } = await supabase
        .from("users")
        .update({ catalog_public: checked })
        .eq("id", user.id);
      if (error) throw error;

      toast.success(
        checked ? "Your catalog is public again" : "Catalog unpublished",
        {
          id: loadingToast,
          description: checked
            ? "Anyone with the link can view it."
            : "The link below won't work again until you turn this back on.",
        },
      );
    } catch (error) {
      console.error("Error updating catalog visibility:", error);
      setCatalogPublicRaw(!checked); // roll back the optimistic flip
      toast.error("Failed to update visibility", { id: loadingToast });
    } finally {
      setIsSavingVisibility(false);
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
      {/* Publish toggle — controls whether the link below (and this
          business's marketplace listing, if opted in) resolves at all.
          The slug itself never changes when this is off, so re-publishing
          later brings the exact same link back to life. */}
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {catalogPublic ? (
              <Globe className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {catalogPublic ? "Catalog is public" : "Catalog is unpublished"}
            </p>
            <p className="text-sm text-muted-foreground">
              {catalogPublic
                ? "Anyone with the link below can view and browse it."
                : "The link below is disabled until you turn this back on."}
            </p>
          </div>
        </div>
        <Switch
          checked={catalogPublic}
          onCheckedChange={handleToggleVisibility}
          disabled={isSavingVisibility}
          className="shrink-0"
        />
      </div>

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
          catalog. It stays the same even if you rename your business later.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2">
        <p className="font-semibold">What customers will see:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Your business name</li>
          {businessAddress && (
            <li>Your business address (clickable - opens in Google Maps)</li>
          )}
          <li>All categories and items</li>
          <li>
            Retail sell prices only (no bulk sell, cost or profit information)
          </li>
          <li>Contact information (phone & email if provided)</li>
        </ul>
      </div>
    </div>
  );
}
