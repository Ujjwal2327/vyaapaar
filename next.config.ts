import type { NextConfig } from "next";

// Content-Security-Policy is deliberately a moderate, allow-list policy
// rather than a strict nonce-based one: it still meaningfully restricts the
// page (no plugins/objects, no framing by other origins, network requests
// limited to same-origin + Supabase), while 'unsafe-inline' keeps it
// compatible with Next.js/Tailwind's inline styles and framework-injected
// scripts without extra wiring. 'unsafe-eval' is scoped to development
// only — Next's dev server (Fast Refresh) relies on eval(), production
// builds don't. For a stricter, nonce-based policy later, see
// https://nextjs.org/docs/app/guides/content-security-policy
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // REST + Realtime (websocket) calls to Supabase.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    // Stops the site being embedded in a frame/iframe on another origin
    // (mitigates clickjacking). CSP's frame-ancestors above reinforces this
    // for browsers that support it.
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    // Stops browsers from MIME-sniffing a response away from its declared
    // Content-Type, which attackers can otherwise abuse to run disguised
    // scripts.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Sends the full URL only on same-origin requests; cross-origin
    // requests get origin-only, so paths/query strings never leak over
    // plain HTTP or to third-party origins.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Matches every route — pages, API routes, and the static/JS/CSS
        // assets Next.js serves — so the whole site responds with these
        // headers, not just individual pages.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;