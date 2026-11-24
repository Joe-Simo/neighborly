import { expect, test } from "bun:test";
import config, { securityHeaders } from "../../next.config";

test("every path is sent the security headers: no framing by other sites, no type guessing, no full-address referrer, no plugins, no device features, https only", async () => {
  const built = typeof config === "function" ? await config("phase-production-build", { defaultConfig: {} }) : config;
  const rules = (await built.headers?.()) ?? [];
  const all = rules.find((rule) => rule.source === "/:path*");
  expect(all?.headers).toEqual(securityHeaders);
  const sent = Object.fromEntries(securityHeaders.map(({ key, value }) => [key, value]));
  expect(sent["X-Frame-Options"]).toBe("SAMEORIGIN");
  expect(sent["X-Content-Type-Options"]).toBe("nosniff");
  expect(sent["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  expect(sent["Permissions-Policy"]).toContain("camera=()");
  expect(sent["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
  expect(sent["Content-Security-Policy"]).toContain("object-src 'none'");
  expect(sent["Strict-Transport-Security"]).toContain("max-age=63072000");
});
