import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel, Id } from "./_generated/dataModel";
import { internalMutation as plainInternalMutation, mutation as plainMutation } from "./_generated/server";
import { markDirty, rollupSources } from "./rollups";

/**
 * The mutation builders every write goes through. Each wraps the database so that a write to a table a
 * conference's year is counted from marks the council rollups of that conference stale (convex/rollups.ts),
 * whatever screen, import, sample load or job made it.
 */
const triggers = new Triggers<DataModel>();
for (const table of rollupSources) {
  triggers.register(table, async (ctx, change) => {
    const doc = change.newDoc ?? change.oldDoc;
    await markDirty({ ...ctx, db: ctx.innerDb }, "churchId" in doc ? doc.churchId : (change.id as Id<"churches">));
  });
}

export const mutation = customMutation(plainMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(plainInternalMutation, customCtx(triggers.wrapDB));
