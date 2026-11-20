import { createSerwistRoute } from "@serwist/turbopack";

const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    // Only what the offline page needs. The painted artwork and every
    // signed-in page stay on the network, so nothing private is kept on a
    // shared phone or tablet.
    globPatterns: [".next/static/**/*.{js,css}", "public/fonts/*.woff2", "public/assets/living-relief-poster.webp", "public/assets/living-relief-poster-gl.webp"],
    additionalPrecacheEntries: [{ url: "/offline", revision }],
  });
