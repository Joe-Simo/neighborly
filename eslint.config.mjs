import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Clerk's own account screens let a person delete their account, and one account is shared by every
    // sample visitor. The app has its own screens; these must never be put on a page.
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@clerk/nextjs",
          importNames: ["UserProfile", "UserButton", "UserAvatar", "OrganizationProfile", "OrganizationSwitcher", "useUser", "useReverification"],
          message: "Clerk's account screens and the user object allow account deletion. Use the app's own screens.",
        }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
    // Upstream Three.js decoder distribution, copied without modification.
    "public/assets/painted-world/draco/**",
  ]),
]);

export default eslintConfig;
