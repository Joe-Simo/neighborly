import { getAuthUserId } from "@convex-dev/auth/server";
import { components } from "./_generated/api";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** The signed-in account. Every workspace function starts here. */
export async function user(ctx: QueryCtx | MutationCtx) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new Error("Sign in required.");
  const email = await ctx.runQuery(components.authEmail.verifiedEmails.getPrimaryEmail, { userId: id });
  if (!email) throw new Error("A verified email is required.");
  return { id, email };
}
/** The caller's active membership in this group, or an error. */
export async function membership(ctx: QueryCtx | MutationCtx, church: Id<"churches">) {
  const account = await user(ctx);
  const member = await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", church).eq("userId", account.id)).unique();
  if (!member?.active) throw new Error("Workspace access required.");
  return member;
}
