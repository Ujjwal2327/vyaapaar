import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Falls back to a placeholder if NEXT_PUBLIC_SITE_URL isn't set in the
// deployment environment — set that env var to the real production domain
// so canonical links and Open Graph/Twitter preview images resolve to
// correct absolute URLs instead of this placeholder.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vyaapaar.app";

const description =
  "The modern way to manage inventory, prices, and business contacts. Track products, customers, suppliers—all in one place. No spreadsheets, no complexity.";

// "Vyaapaar" alone is 8 characters — far short of the ~30 character /
// ~200px guideline, leaving no room to communicate what the product does.
const title = "Vyaapaar – Catalog, Contacts & Ledger for Indian Businesses";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Vyaapaar",
  },
  description,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Vyaapaar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        suppressHydrationWarning={true}
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
          <Toaster richColors />
        </Providers>
      </body>
    </html>
  );
}
