import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { membership } from "./access";
import { isSampleVisitor } from "./demo";

/**
 * Every visitor to the sample conference signs in as the same made-up owner, so a language saved on that record
 * would change the rooms for the next visitor. A visitor's language stays on their own device (see LanguageChooser).
 */
const shared = async (ctx: MutationCtx) => isSampleVisitor((await ctx.auth.getUserIdentity())?.subject);

/** A person chooses the language they read the app in. It changes their own membership and nothing else. */
export const choose = mutation({
  args: { churchId: v.id("churches"), language: v.union(v.literal("en"), v.literal("es"), v.literal("ht")) },
  returns: v.null(),
  handler: async (ctx, { churchId, language }) => {
    const member = await membership(ctx, churchId);
    if (await shared(ctx)) return null;
    if (member.language !== language) await ctx.db.patch("memberships", member._id, { language });
    return null;
  },
});

/**
 * Carries the language of the entry sheet into the workspace for a person who has never chosen one, so someone
 * who read the door in Spanish does not walk into English rooms. It never replaces a language already chosen.
 */
export const adopt = mutation({
  args: { churchId: v.id("churches"), language: v.union(v.literal("en"), v.literal("es"), v.literal("ht")) },
  returns: v.null(),
  handler: async (ctx, { churchId, language }) => {
    const member = await membership(ctx, churchId);
    if (await shared(ctx)) return null;
    if (member.language === undefined) await ctx.db.patch("memberships", member._id, { language });
    return null;
  },
});
