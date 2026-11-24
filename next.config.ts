import type { NextConfig } from "next";
import { withCn } from "cn/next";
import { withBotId } from "botid/next/config";

// The backend's own web address. Calendar feeds live there, but people see them on this site's domain.
const convexSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

/** Sent with every page and file. SAMEORIGIN, not DENY: BotID frames its own challenge on this origin. A private invitation link (?invite=) never leaves in a Referer to another site. */
export const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The site never asks for a camera, microphone, location, payment or USB, so no page or frame on it can.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // No plugins, no <base> rewriting every link, no framing by another site. Scripts are left to Clerk, BotID and Next.
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
  // Browsers keep to https on this site and its subdomains for two years.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  /* config options here */
  // This deploy's name, under which a tab's once-only reload after a failed code load is kept (src/lib/chunk-recovery.ts).
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now()) },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        // postcss-loader runs last, on what Tailwind wrote (scripts/viewport-fallback.cjs).
        loaders: [{ loader: "postcss-loader", options: { postcssOptions: { config: false, plugins: [`${process.cwd()}/scripts/viewport-fallback.cjs`] } } }, "@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // /about and /sobre are the parents of the two pages about Kind Helps; a reader who trims the address lands on how it was made.
  // The offline worker lives under /serwist/ but looks after the whole site, and a new deploy's worker is found on the next visit.
  async headers() {
    return [
      // No page is ever shown inside another site's frame (clickjacking), types are never guessed, and other sites
      // are told only this site's origin, never a page's address with its query.
      { source: "/:path*", headers: securityHeaders },
      { source: "/serwist/sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/" }, { key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
    ];
  },
  async redirects() {
    return [
      { source: "/about", destination: "/about/how-we-made-it", permanent: true },
      { source: "/sobre", destination: "/sobre/como-lo-hicimos", permanent: true },
    ];
  },
  async rewrites() {
    return convexSite
      ? [{ source: "/calendar/:path*", destination: `${convexSite}/calendar/:path*` }]
      : [];
  },
};

// The class-merging tables are fitted to src on every build and dev start (src/lib/utils.ts).
// BotID's own paths (its challenge script and proxy) are rewritten to Vercel; see src/lib/help-page/botid-client.ts.
export default withCn(withBotId(nextConfig), { content: ["src/**/*.{ts,tsx}"], out: "src/lib/cn-tables.ts" });
