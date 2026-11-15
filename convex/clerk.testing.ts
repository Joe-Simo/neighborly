import type { TestConvex } from "convex-test";
import type schema from "./schema";
import type { Id } from "./_generated/dataModel";

/**
 * For tests: `t`, signed in through Clerk as the person who owns this users row.
 * Pass `verified` false for someone whose email Clerk has not verified, and `email` when the address matters.
 * (Convex leaves files with two dots in the name out of a deploy.)
 */
export function signedIn(t: TestConvex<typeof schema>, userId: string, verified = true, email = `${userId}@example.org`) {
  const clerkId = `clerk|${userId}`;
  const who = t.withIdentity({ subject: clerkId, email, emailVerified: verified });
  let linked: Promise<void> | undefined;
  const link = () => (linked ??= t.run(async (ctx) => ctx.db.patch("users", userId as Id<"users">, { clerkId })));
  return new Proxy(who, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        await link();
        return value.apply(target, args);
      };
    },
  });
}
