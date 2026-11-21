import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, httpAction, internalQuery, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internalMutation, mutation } from "./functions";
import type { Doc, Id } from "./_generated/dataModel";
import { neighborAccess, neighborRecord, openedBy, opening } from "./access";

/**
 * Uploaded files, as ServWare keeps them: a conference's own (minutes, forms) in Your files, and one neighbor's
 * (a lease, a utility bill) on that neighbor's record. Coordinators and owners only, through the same gate as
 * every neighbor record. The bytes live in Convex file storage; a row here names them. Removing a row removes
 * the bytes, and so do removing a neighbor (neighbors.remove) and closing the conference (closing.ts).
 * The bytes are never handed out by a lasting storage address: each file is read through the HTTP route
 * /files/<id> (convex/http.ts), which checks the caller's own sign-in and access on every request, so a copied
 * link opens nothing for anyone without access. Bytes that never got a row (a refused or abandoned upload) are
 * swept daily (crons.ts). Each refusal says exactly what was wrong (refusals-es.ts says it in Spanish);
 * the screen checks size, kind and the count first and says those in its own words.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Enough for years of minutes; it keeps every list one bounded read. The screen checks it first (uploaded-files.tsx). */
const MOST = 300;
export const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
const byExtension: Record<string, (typeof ALLOWED_TYPES)[number]> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** The kind of a file, from what the browser said or, when it said nothing (HEIC often), from its name. Null when not allowed. */
export function allowedType(contentType: string | undefined, name: string) {
  const said = (contentType ?? "").toLowerCase().split(";")[0].trim();
  if ((ALLOWED_TYPES as readonly string[]).includes(said)) return said;
  if (said && said !== "application/octet-stream") return null;
  return byExtension[name.toLowerCase().split(".").pop() ?? ""] ?? null;
}

const file = v.object({
  id: v.id("files"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  uploadedBy: v.string(),
  createdAt: v.number(),
  /** The access-checked route that streams the file (see `read`); it needs the reader's own sign-in token. */
  url: v.string(),
});

async function rowsFor(ctx: QueryCtx, churchId: Id<"churches">, neighborId: Id<"neighbors"> | undefined) {
  return ctx.db.query("files").withIndex("by_church_neighbor", (q) => q.eq("churchId", churchId).eq("neighborId", neighborId)).order("desc").take(MOST);
}

/** Where a file is read: this deployment's HTTP route, with the record's opening line for a neighbor's file. */
function route(id: Id<"files">, opening?: Id<"auditEvents">) {
  const path = `/files/${id}${opening ? `?opening=${opening}` : ""}`;
  return `${process.env.CONVEX_SITE_URL ?? ""}${path}`;
}

async function shown(ctx: QueryCtx, rows: Doc<"files">[], opening?: Id<"auditEvents">) {
  return Promise.all(
    rows.map(async (row) => {
      const by = await ctx.db.get("memberships", row.uploadedBy);
      return { id: row._id, name: row.name, contentType: row.contentType, size: row.size, uploadedBy: by?.removedAt ? "" : (by?.name ?? ""), createdAt: row.createdAt, url: route(row._id, opening) };
    }),
  );
}

/** The gate for one place: the conference's own files, or one neighbor's record. */
async function gate(ctx: QueryCtx | MutationCtx, churchId: Id<"churches">, neighborId: Id<"neighbors"> | undefined) {
  return neighborId ? (await neighborRecord(ctx, churchId, neighborId)).member : neighborAccess(ctx, churchId);
}

/** A one-time address the browser sends the file's bytes to. */
export const uploadUrl = mutation({
  args: { churchId: v.id("churches"), neighborId: v.optional(v.id("neighbors")) },
  returns: v.string(),
  handler: async (ctx, { churchId, neighborId }) => {
    await gate(ctx, churchId, neighborId);
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Keeps an uploaded file under its name, once its size and kind are checked against what was stored. A refusal
 * after the gate is returned, not thrown, so the deletion of the refused bytes is kept (a throw would undo it,
 * and anything it scheduled); `save` then throws the sentence. A caller refused at the gate never had an upload
 * address, and bytes already kept by a row are never touched; anything else left over is swept daily.
 */
export const keep = internalMutation({
  args: { churchId: v.id("churches"), neighborId: v.optional(v.id("neighbors")), storageId: v.id("_storage"), name: v.string() },
  returns: v.union(v.object({ id: v.id("files") }), v.object({ refused: v.string() })),
  handler: async (ctx, { churchId, neighborId, storageId, name }) => {
    const member = await gate(ctx, churchId, neighborId);
    const stored = await ctx.db.system.get(storageId);
    if (!stored) throw new ConvexError("The upload was not found; try again.");
    if (await ctx.db.query("files").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first()) throw new ConvexError("That file is already kept.");
    const title = name.trim().slice(0, 200);
    const refuse = async (sentence: string) => {
      await ctx.storage.delete(storageId);
      return { refused: sentence };
    };
    if (!title) return refuse("A file needs a name.");
    if (stored.size > MAX_FILE_BYTES) return refuse("Files can be at most 10 MB.");
    const contentType = allowedType(stored.contentType, title);
    if (!contentType) return refuse("This kind of file cannot be kept. Use PDF, JPEG, PNG, HEIC, Word or Excel.");
    if ((await rowsFor(ctx, churchId, neighborId)).length >= MOST) return refuse("Up to 300 files can be kept here. Remove one first.");
    const id = await ctx.db.insert("files", { churchId, neighborId, storageId, name: title, contentType, size: stored.size, uploadedBy: member._id, createdAt: Date.now() });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "file.added", targetId: id, at: Date.now() });
    return { id };
  },
});

/** Keeps an uploaded file (see `keep`); a refused file's bytes are already gone when this throws. */
export const save = action({
  args: { churchId: v.id("churches"), neighborId: v.optional(v.id("neighbors")), storageId: v.id("_storage"), name: v.string() },
  returns: v.id("files"),
  handler: async (ctx, args): Promise<Id<"files">> => {
    const kept = await ctx.runMutation(internal.files.keep, args);
    if ("refused" in kept) throw new ConvexError(kept.refused);
    return kept.id;
  },
});

/** One file for the HTTP route: only for a caller who may open it now, and a neighbor's only with their own opening line. */
export const readable = internalQuery({
  args: { id: v.string(), opening: v.optional(v.string()) },
  returns: v.union(v.object({ storageId: v.id("_storage"), name: v.string(), contentType: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("files", args.id);
    const found = id ? await ctx.db.get("files", id) : null;
    if (!found) return null;
    const member = await gate(ctx, found.churchId, found.neighborId);
    if (found.neighborId) {
      const line = args.opening ? ctx.db.normalizeId("auditEvents", args.opening) : null;
      if (!line) return null;
      await openedBy(ctx, member, found.neighborId, line);
    }
    return { storageId: found.storageId, name: found.name, contentType: found.contentType };
  },
});

/** The browser reads with its own sign-in token (an Authorization header), from the app's own pages. */
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization", "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400", Vary: "Origin" };

/** GET /files/<id>[?opening=<line>]: streams the file to a signed-in caller allowed to open it, checked on every request. */
export const read = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const id = url.pathname.match(/^\/files\/([^/]+)$/)?.[1];
  const found = id ? await ctx.runQuery(internal.files.readable, { id, opening: url.searchParams.get("opening") ?? undefined }).catch(() => null) : null;
  const blob = found ? await ctx.storage.get(found.storageId) : null;
  // Nothing is said about why: a missing file, no sign-in and no access all look the same.
  if (!found || !blob) return new Response(null, { status: 404, headers: cors });
  return new Response(blob, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": found.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(found.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

/** The browser's check before it sends a token across origins. */
export const preflight = httpAction(async () => new Response(null, { status: 204, headers: cors }));

/**
 * A day after upload, bytes no row names are a refused or abandoned upload: they go. Run daily (crons.ts), a page
 * at a time, oldest first; each page schedules the next until it reaches bytes newer than a day.
 */
export const sweep = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.number(),
  handler: async (ctx, { cursor }): Promise<number> => {
    const before = Date.now() - 24 * 60 * 60 * 1000;
    const page = await ctx.db.system.query("_storage").order("asc").paginate({ numItems: 200, cursor: cursor ?? null });
    let dropped = 0;
    let young = false;
    for (const blob of page.page) {
      if (blob._creationTime >= before) {
        young = true;
        break;
      }
      if (await ctx.db.query("files").withIndex("by_storage", (q) => q.eq("storageId", blob._id)).first()) continue;
      await ctx.storage.delete(blob._id);
      dropped++;
    }
    if (!young && !page.isDone) await ctx.scheduler.runAfter(0, internal.files.sweep, { cursor: page.continueCursor });
    return dropped;
  },
});

/** The conference's own files, newest first, each with an address to open it. */
export const conference = query({
  args: { churchId: v.id("churches") },
  returns: v.array(file),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    return shown(ctx, await rowsFor(ctx, churchId, undefined));
  },
});

/** One neighbor's files, read only with the caller's own opening line for that record (as neighbors.record is). */
export const neighbor = query({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), opening },
  returns: v.array(file),
  handler: async (ctx, { churchId, neighborId, opening: line }) => {
    const { member } = await neighborRecord(ctx, churchId, neighborId);
    await openedBy(ctx, member, neighborId, line);
    return shown(ctx, await rowsFor(ctx, churchId, neighborId), line);
  },
});

/** Removes a file and its stored bytes for good, and writes who did it. */
export const remove = mutation({
  args: { churchId: v.id("churches"), id: v.id("files") },
  returns: v.null(),
  handler: async (ctx, { churchId, id }) => {
    await neighborAccess(ctx, churchId);
    const found = await ctx.db.get("files", id);
    if (!found || found.churchId !== churchId) throw new ConvexError("That file was not found.");
    const member = await gate(ctx, churchId, found.neighborId);
    await ctx.storage.delete(found.storageId);
    await ctx.db.delete("files", id);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "file.removed", targetId: id, at: Date.now() });
    return null;
  },
});

/** For neighbors.remove, after its own gate: every file on the record goes, bytes and all. */
export async function dropNeighborFiles(ctx: MutationCtx, churchId: Id<"churches">, neighborId: Id<"neighbors">) {
  const rows = await ctx.db.query("files").withIndex("by_church_neighbor", (q) => q.eq("churchId", churchId).eq("neighborId", neighborId)).collect();
  for (const row of rows) {
    await ctx.storage.delete(row.storageId);
    await ctx.db.delete("files", row._id);
  }
}
