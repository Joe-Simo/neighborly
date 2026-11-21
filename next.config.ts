import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withCn } from "cn/next";

// The backend's own web address. Calendar feeds live there, but people see them on this site's domain.
const convexSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // /about and /sobre are the parents of the two pages about Kind Helps; a reader who trims the address lands on how it was made.
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
export default withCn(withSerwist(nextConfig), { content: ["src/**/*.{ts,tsx}"], out: "src/lib/cn-tables.ts" });
