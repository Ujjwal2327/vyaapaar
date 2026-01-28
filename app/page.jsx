"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Package,
  Search,
  FileText,
  ChevronRight,
  Menu,
  X,
  BarChart3,
  Settings,
  ArrowUpDown,
  ChevronsDownUp,
  IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/Logo"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: Search,
      title: "Smart Search & Sort",
      description:
        "Search for items by name, brand, or category. Handles typos and abbreviations (e.g., '1/2\"' finds '1/2 inch'). Sort by price, alphabetically, or keep your custom order.",
    },
    {
      icon: FileText,
      title: "Bulk Edit Mode",
      description:
        "Export your entire price list as plain text. Edit hundreds of items at once using any text editor. Import it back with a single click.",
    },
    {
      icon: IndianRupee,
      title: "Sell & Cost Prices",
      description:
        "Track both selling price and cost price for each item. Automatically calculates profit margins. Switch between views with one click.",
    },
    {
      icon: ChevronsDownUp,
      title: "Expand / Collapse Categories",
      description:
        "Organize items in nested categories. Expand all to see everything or collapse to navigate quickly. Your preferred state is remembered.",
    },
    {
      icon: Settings,
      title: "Customizable Units",
      description:
        "Choose from 50+ units across length, weight, volume, area, time, and count. Activate only the units you need. Add custom units for your business.",
    },
    {
      icon: BarChart3,
      title: "Quick Stats",
      description:
        "See total items, categories, and inventory value at a glance. Track which units are most used. No complex analytics—just what you need.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <Logo/>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                href="#features"
                className="text-sm hover:text-primary transition-colors"
              >
                Features
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started Free</Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-3 border-t">
              <Link
                href="#features"
                className="block text-sm hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link href="/login" className="block">
                <Button variant="ghost" size="sm" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link href="/register" className="block">
                <Button size="sm" className="w-full">
                  Get Started Free
                </Button>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              Price List Manager
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">That Actually Works</span>
            </h1>


            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              Manage your inventory with nested categories, smart search, bulk editing,
              and dual pricing. No learning curve, no clutter.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Free
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  See Features
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Free</Badge>
                <span>No credit card</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Cloud</Badge>
                <span>Auto-sync</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Mobile</Badge>
                <span>Works everywhere</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              Simple Features, Powerful Results
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage prices efficiently. Nothing you don't.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-2">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              Three Steps to Get Started
            </h2>
            <p className="text-muted-foreground">No tutorials needed</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="text-xl font-bold">Sign Up</h3>
              </div>
              <p className="text-muted-foreground ml-13">
                Create a free account. Takes 30 seconds.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="text-xl font-bold">Add Items</h3>
              </div>
              <p className="text-muted-foreground ml-13">
                Manually add products or paste from a spreadsheet using bulk edit.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="text-xl font-bold">You're Done</h3>
              </div>
              <p className="text-muted-foreground ml-13">
                Search, sort, update prices. Access from any device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start Managing Your Prices Today
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Free forever. No credit card required. Cancel anytime.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              variant="secondary"
              className="bg-background text-foreground hover:bg-background/90"
            >
              Create Free Account
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <Logo/>
            <p className="text-sm text-muted-foreground">
              © 2026 Vyaapaar. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}