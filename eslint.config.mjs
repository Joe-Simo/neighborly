import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import esX from "eslint-plugin-es-x";

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
  {
    // Every write goes through convex/functions.ts, so the council rollups hear of it (convex/rollups.ts).
    files: ["convex/**/*.ts"],
    ignores: ["convex/functions.ts", "convex/**/*.test.ts", "convex/_generated/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "./_generated/server",
          importNames: ["mutation", "internalMutation"],
          message: "Import mutation and internalMutation from ./functions, so council rollups are kept fresh.",
        }],
      }],
    },
  },
  {
    // APIs Safari does not have. Calling one unguarded throws on iPhone and iPad (it crashed the home page once), so every use goes through
    // the one helper that falls back where they are missing.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/idle.ts", "src/lib/frame-or-task.ts", "src/lib/frame-or-task.test.ts"],
    rules: {
      "no-restricted-globals": ["error",
        { name: "requestIdleCallback", message: "Safari has no requestIdleCallback. Use whenIdle from @/lib/idle." },
        { name: "cancelIdleCallback", message: "Safari has no cancelIdleCallback. Use the stop function whenIdle from @/lib/idle returns." },
        { name: "scheduler", message: "Safari has no scheduler (postTask, yield). Add a guarded helper in src/lib first." },
      ],
      "no-restricted-properties": ["error",
        { object: "window", property: "requestIdleCallback", message: "Safari has no requestIdleCallback. Use whenIdle from @/lib/idle." },
        { object: "window", property: "cancelIdleCallback", message: "Safari has no cancelIdleCallback. Use the stop function whenIdle from @/lib/idle returns." },
        { object: "window", property: "scheduler", message: "Safari has no scheduler (postTask, yield). Add a guarded helper in src/lib first." },
        { object: "globalThis", property: "requestIdleCallback", message: "Safari has no requestIdleCallback. Use whenIdle from @/lib/idle." },
      ],
    },
  },
  {
    // A regex lookbehind is a syntax error in Safari before 16.4: the whole script fails to parse, not just the one line.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "es-x": esX },
    rules: { "es-x/no-regexp-lookbehind-assertions": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
    // Written by `cn build` (next.config.ts).
    "src/lib/cn-tables.ts",
    // Upstream Three.js decoder distribution, copied without modification.
    "public/assets/painted-world/draco/**",
    // Built by scripts/help-script.mts (the Ask for help pages' one script).
    "public/help-botid.js",
    // Built by scripts/service-worker.mts after next build.
    "public/serwist/**",
  ]),
]);

export default eslintConfig;
