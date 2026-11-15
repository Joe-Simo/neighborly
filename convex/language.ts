import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { membership } from "./access";

/** A person chooses the language they read the app in. It changes their own membership and nothing else. */
export const choose = mutation({
  args: { churchId: v.id("churches"), language: v.union(v.literal("en"), v.literal("es"), v.literal("ht")) },
  returns: v.null(),
  handler: async (ctx, { churchId, language }) => {
    const member = await membership(ctx, churchId);
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
    if (member.language === undefined) await ctx.db.patch("memberships", member._id, { language });
    return null;
  },
});
