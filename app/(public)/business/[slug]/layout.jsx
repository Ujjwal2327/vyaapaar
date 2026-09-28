/**
 * app/(public)/business/[slug]/layout.jsx
 *
 * Link-preview metadata for the public catalog page. It lives in a layout
 * (a server component) because page.jsx is "use client" and can't export
 * generateMetadata — and link-preview crawlers (WhatsApp, Slack, X, ...) don't
 * run JS, so the tags have to be in the server-rendered HTML.
 *
 * Everything is derived from the slug alone, e.g.
 *   /business/maheshwari-sanitary-store  ->  "Maheshwari Sanitary Store"
 * so there is no database call here. If the catalog turns out not to exist
 * (or isn't shared), page.jsx swaps in the "Business Not Found" title and
 * description in the browser after it loads.
 */

const decode = (value = "") => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// "maheshwari-sanitary-store" -> "Maheshwari Sanitary Store"
const slugToBusinessName = (slug) =>
  decode(slug)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const businessName = slugToBusinessName(slug);
  const description = `Browse ${businessName}'s catalog and prices on Vyaapaar.`;

  return {
    // plain string so the root title.template (e.g. "%s | Vyaapaar") applies
    title: businessName,
    description,
    openGraph: {
      title: businessName,
      description,
      type: "website",
      siteName: "Vyaapaar",
    },
    twitter: {
      card: "summary",
      title: businessName,
      description,
    },
  };
}

export default function BusinessSlugLayout({ children }) {
  return children;
}
