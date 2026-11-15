import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

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
  async rewrites() {
    return convexSite
      ? [{ source: "/calendar/:path*", destination: `${convexSite}/calendar/:path*` }]
      : [];
  },
};

export default withSerwist(nextConfig);
