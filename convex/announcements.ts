import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./functions";
import type { Id } from "./_generated/dataModel";
import { membership } from "./access";

/**
 * Changing what was said: its author or an owner may edit an announcement, take it off the page, and put it back
 * (the Undo). Only an owner may post, so the same owner gate stands here, opened also for the person who wrote it.
 * An email already sent is not recalled: removing takes it off the page only.
 */
const churchId = v.id("churches");
const id = v.id("announcements");

function required(value: string, max: number) {
  const result = value.trim();
  if (!result || result.length > max) throw new ConvexError("Enter a valid value.");
  return result;
}

async function changeable(ctx: MutationCtx, church: Id<"churches">, announcementId: Id<"announcements">) {
  const me = await membership(ctx, church);
  const row = await ctx.db.get("announcements", announcementId);
  if (!row || row.churchId !== church) throw new ConvexError("Announcement not found.");
  if (me.role !== "owner" && row.authorId !== me._id) throw new ConvexError("Owner access required.");
  return { me, row };
}

export const edit = mutation({
  args: { churchId, id, title: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { me, row } = await changeable(ctx, args.churchId, args.id);
    if (row.removedAt) throw new ConvexError("Announcement not found.");
    await ctx.db.patch("announcements", row._id, { title: required(args.title, 200), body: required(args.body, 5000), editedAt: Date.now() });
    await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: me.userId, action: "editAnnouncement", targetId: row._id, at: Date.now() });
    return null;
  },
});

export const remove = mutation({
  args: { churchId, id },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { me, row } = await changeable(ctx, args.churchId, args.id);
    if (row.removedAt) return null;
    await ctx.db.patch("announcements", row._id, { removedAt: Date.now() });
    await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: me.userId, action: "removeAnnouncement", targetId: row._id, at: Date.now() });
    return null;
  },
});

/** The Undo of remove: puts it back on the page as it was. */
export const restore = mutation({
  args: { churchId, id },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { me, row } = await changeable(ctx, args.churchId, args.id);
    if (!row.removedAt) return null;
    await ctx.db.patch("announcements", row._id, { removedAt: undefined });
    await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: me.userId, action: "restoreAnnouncement", targetId: row._id, at: Date.now() });
    return null;
  },
});
