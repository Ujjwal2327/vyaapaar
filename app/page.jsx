"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Search,
  TrendingUp,
  Users,
  Smartphone,
  ArrowRight,
  Check,
  Store,
  Globe,
  Share2,
  Sparkles,
  Zap,
  Shield,
  Clock,
  Star,
} from "lucide-react";
import Link from "next/link";
import Loader from "@/components/Loader";
import Logo from "@/components/Logo";

export default function LandingPageAlternative() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user && mounted) {
      router.replace("/catalog");
    }
  }, [user, loading, router, mounted]);

  if (!mounted || loading) return <Loader />;

  if (user) return null;

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo />
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push("/login")}>
                Sign In
              </Button>
              <Button
                onClick={() => router.push("/register")}
                className="gap-2"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Gradient Background */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-background to-primary/10 -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)] -z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(120,119,198,0.1),transparent_50%)] -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-8">
              <Badge variant="secondary" className="gap-2 px-4 py-2">
                <Sparkles className="w-4 h-4" />
                Trusted by 1000+ Businesses
              </Badge>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight">
                Your Business,
                <br />
                <span className="bg-linear-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                  Simplified
                </span>
              </h1>

              <p className="text-xl text-muted-foreground leading-relaxed">
                The modern way to manage inventory, prices, and share your
                catalog with customers. No spreadsheets, no complexity.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={() => router.push("/register")}
                  className="text-lg gap-2 h-14 px-8"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() =>
                    router.push("/business/Maheshwari Sanitary Store")
                  }
                  className="text-lg gap-2 h-14 px-8"
                >
                  <Globe className="w-5 h-5" />
                  View Demo Store
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-muted-foreground">Free forever</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-muted-foreground">No credit card</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-muted-foreground">Setup in 2 mins</span>
                </div>
              </div>
            </div>

            {/* Right Column - Featured Business Card */}
            <div className="relative">
              {/* Floating Card */}
              <div className="relative bg-card rounded-3xl border shadow-2xl p-8 hover:shadow-3xl transition-all duration-300 hover:scale-105">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-linear-to-r from-yellow-500 to-orange-500 text-white border-0 gap-1">
                    <Star className="w-3 h-3 fill-white" />
                    Featured
                  </Badge>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                    <Store className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">
                      Maheshwari Sanitary Store
                    </h3>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6 leading-relaxed">
                  See how we help local businesses like Maheshwari Sanitary
                  Store showcase their products online with a beautiful,
                  professional catalog that customers love.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Globe className="w-4 h-4 text-primary" />
                    </div>
                    <span>Public catalog accessible to all customers</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Search className="w-4 h-4 text-primary" />
                    </div>
                    <span>Smart search and instant product lookup</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-primary" />
                    </div>
                    <span>Mobile-friendly for customers on the go</span>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={() =>
                    router.push("/business/Maheshwari Sanitary Store")
                  }
                >
                  <Globe className="w-4 h-4" />
                  Explore Live Demo
                </Button>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-3xl -z-10" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted/30 border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">1000+</div>
              <div className="text-sm text-muted-foreground">
                Active Businesses
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">50K+</div>
              <div className="text-sm text-muted-foreground">
                Products Managed
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">2min</div>
              <div className="text-sm text-muted-foreground">Setup Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful tools designed specifically for small and medium
              businesses
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Cards */}
            {[
              {
                icon: Package,
                title: "Smart Inventory",
                description:
                  "Organize products in nested categories with support for multiple pricing tiers and units.",
                gradient: "from-blue-500 to-cyan-500",
              },
              {
                icon: Globe,
                title: "Public Catalog",
                description:
                  "Share your product catalog with a beautiful public link. No login required for customers.",
                gradient: "from-violet-500 to-purple-500",
              },
              {
                icon: Search,
                title: "Instant Search",
                description:
                  "Find any product in milliseconds with intelligent search and filtering.",
                gradient: "from-orange-500 to-red-500",
              },
              {
                icon: TrendingUp,
                title: "Profit Analytics",
                description:
                  "Track margins, compare retail vs bulk pricing, and optimize your strategy.",
                gradient: "from-green-500 to-emerald-500",
              },
              {
                icon: Zap,
                title: "Bulk Operations",
                description:
                  "Update hundreds of products at once with our powerful bulk edit mode.",
                gradient: "from-yellow-500 to-amber-500",
              },
              {
                icon: Shield,
                title: "Secure & Private",
                description:
                  "Your data is encrypted and backed up automatically. Control what customers see.",
                gradient: "from-pink-500 to-rose-500",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative bg-card border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-linear-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              Testimonials
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Loved by Business Owners
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card rounded-2xl p-6 border shadow-sm">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-yellow-500 text-yellow-500"
                  />
                ))}
              </div>
              <p className="text-muted-foreground mb-4">
                "Vyaapaar has completely transformed how I manage my store. The
                public catalog feature brings in new customers every day!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-primary/60" />
                <div>
                  <div className="font-semibold">Maheshwari Sanitary Store</div>
                  <div className="text-sm text-muted-foreground">
                    Hardware Business
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border shadow-sm">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-yellow-500 text-yellow-500"
                  />
                ))}
              </div>
              <p className="text-muted-foreground mb-4">
                "Simple, fast, and exactly what we needed. No more messy
                spreadsheets. Highly recommended for any retail business."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-cyan-500" />
                <div>
                  <div className="font-semibold">Rajesh Kumar</div>
                  <div className="text-sm text-muted-foreground">
                    Electronics Store
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border shadow-sm">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-yellow-500 text-yellow-500"
                  />
                ))}
              </div>
              <p className="text-muted-foreground mb-4">
                "The best investment for my business. Easy to use, beautiful
                design, and customers love the online catalog!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-500" />
                <div>
                  <div className="font-semibold">Priya Sharma</div>
                  <div className="text-sm text-muted-foreground">
                    Fashion Boutique
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary via-primary/90 to-primary/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-primary-foreground">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Start Your Free Trial Today
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of businesses already using Vyaapaar. No credit card
            required, cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => router.push("/register")}
              className="text-lg gap-2 h-14 px-8"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="primary"
              onClick={() => router.push("/business/Maheshwari Sanitary Store")}
              className="text-lg gap-2 h-14 px-8"
            >
              <Store className="w-5 h-5" />
              View Live Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Logo className="mb-4" />
              <p className="text-muted-foreground mb-4 max-w-sm">
                Modern inventory and price list management for growing
                businesses. Built with ❤️ for small business owners.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/register"
                    className="hover:text-foreground transition-colors"
                  >
                    Get Started
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="hover:text-foreground transition-colors"
                  >
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Featured Business</h4>
              <Link
                href="/business/Maheshwari Sanitary Store"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Store className="w-4 h-4" />
                Maheshwari Sanitary Store
              </Link>
            </div>
          </div>

          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>
              &copy; {new Date().getFullYear()} Vyaapaar. All rights reserved.
              Made with ❤️ in India.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
