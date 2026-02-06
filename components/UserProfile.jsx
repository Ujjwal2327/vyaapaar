"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Building2, Phone, Mail, MapPin } from "lucide-react";

export default function UserProfile() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    user_name: "",
    business_name: "",
    business_address: "",
    phone: "",
    email: "",
  });

  const [initialProfile, setInitialProfile] = useState(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          await createProfile();
          return;
        }
        throw error;
      }

      if (data) {
        const loadedProfile = {
          user_name: data.user_name || "",
          business_name: data.business_name || "",
          business_address: data.business_address || "",
          phone: data.phone || "",
          email: data.email || user.email || "",
        };

        setProfile(loadedProfile);
        setInitialProfile(loadedProfile);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.from("users").insert({
        id: user.id,
        email: user.email,
        user_name: user.email?.split("@")[0] || "",
      });

      if (error) throw error;

      await loadProfile();
    } catch (error) {
      console.error("Error creating profile:", error);
      toast.error("Failed to create profile");
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    if (!profile.user_name.trim()) {
      toast.error("Display name is required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({
          user_name: profile.user_name.trim(),
          business_name: profile.business_name?.trim() || null,
          business_address: profile.business_address?.trim() || null,
          phone: profile.phone?.trim() || null,
        })
        .eq("id", user.id);

      if (error) {
        if (error.code === "23505" && error.message.includes("business_name")) {
          toast.error("This business name is already taken");
          return;
        }
        throw error;
      }

      toast.success("Profile updated successfully");
      setInitialProfile(profile);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    initialProfile &&
    (
      profile.user_name?.trim() !== initialProfile.user_name ||
      profile.business_name?.trim() !== initialProfile.business_name ||
      profile.business_address?.trim() !== initialProfile.business_address ||
      profile.phone?.trim() !== initialProfile.phone
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 h-[596px]">
        <div className="animate-pulse text-muted-foreground">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-[16px] flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={profile.email}
          disabled
          className="bg-muted cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed
        </p>
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="user_name" className="text-[16px] flex items-center gap-2">
          <User className="w-4 h-4" />
          Display Name
        </Label>
        <Input
          id="user_name"
          value={profile.user_name}
          onChange={(e) =>
            setProfile({ ...profile, user_name: e.target.value })
          }
          placeholder="Your name"
          required
        />
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <Label htmlFor="business_name" className="text-[16px] flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Business Name
          <span className="text-xs text-muted-foreground ml-auto">
            Optional
          </span>
        </Label>
        <Input
          id="business_name"
          value={profile.business_name}
          onChange={(e) =>
            setProfile({ ...profile, business_name: e.target.value })
          }
          placeholder="Your business name"
        />
        <p className="text-xs text-muted-foreground">
          Must be unique if provided
        </p>
      </div>

      {/* Business Address */}
      <div className="space-y-2">
        <Label htmlFor="business_address" className="text-[16px] flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Business Address
          <span className="text-xs text-muted-foreground ml-auto">
            Optional
          </span>
        </Label>
        <Textarea
          id="business_address"
          value={profile.business_address}
          onChange={(e) =>
            setProfile({ ...profile, business_address: e.target.value })
          }
          placeholder="Street address, City, State, ZIP"
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Displayed on your public business page
        </p>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-[16px] flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Phone Number
          <span className="text-xs text-muted-foreground ml-auto">
            Optional
          </span>
        </Label>
        <Input
          id="phone"
          type="tel"
          value={profile.phone}
          onChange={(e) =>
            setProfile({ ...profile, phone: e.target.value })
          }
          placeholder="+1234567890"
        />
      </div>

      {/* Save Button */}
      <Button
        onClick={saveProfile}
        disabled={saving || !isDirty}
        className="w-full mt-4"
      >
        {saving ? "Saving..." : "Save Profile"}
      </Button>
    </div>
  );
}