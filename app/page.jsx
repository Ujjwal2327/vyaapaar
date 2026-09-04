import LandingPage from "@/components/LandingPage";

// A plain Server Component on purpose: "use client" components can't export
// `metadata`, and this canonical tag must point at "/" specifically — it
// would be wrong to set it in app/layout.tsx, since layout metadata is
// inherited by every route underneath it (catalog, contacts, business
// pages, ...), which would make all of them falsely claim the homepage as
// their canonical URL. All of the actual interactive content lives in
// components/LandingPage.jsx.
export const metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return <LandingPage />;
}
