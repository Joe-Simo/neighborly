import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { placeAddress } from "./geocode";

/**
 * Saves where a team helps, placing the church's address with the Census geocoder first. If the address is not found
 * (or the service is slow), the address's zip centre is used, and the settings say which (`placed`). Who may save is
 * checked by intake.saveSettings, which this calls as the signed-in person.
 */
export const saveArea = action({
  args: {
    churchId: v.id("churches"), enabled: v.boolean(), address: v.string(), miles: v.number(),
    weeklyLimit: v.optional(v.union(v.number(), v.null())), order: v.optional(v.union(v.number(), v.null())), holidays: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Who may save is checked before anything is looked up, so the geocoder is never a free lookup for anyone.
    await ctx.runQuery(api.intake.settings, { churchId: args.churchId });
    const at = await placeAddress(ctx, args.address);
    await ctx.runMutation(api.intake.saveSettings, { ...args, ...(at ? { at } : {}) });
    return null;
  },
});

const linkToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
async function linkHash(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`partner:${token}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export const hashPartnerLink = linkHash;

/** A new partner, and its link (shown once: only its hash is kept). */
export const createPartner = action({
  args: { churchId: v.id("churches"), name: v.string(), email: v.string(), language: v.optional(v.union(v.literal("en"), v.literal("es"))) },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const token = linkToken();
    await ctx.runMutation(internal.intakePartners.add, { ...args, linkHash: await linkHash(token) });
    return token;
  },
});
/** A fresh link for a partner; the old link and every signed-in device stop. */
export const newPartnerLink = action({
  args: { churchId: v.id("churches"), partnerId: v.id("webPartners") },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const token = linkToken();
    await ctx.runMutation(internal.intakePartners.relink, { ...args, linkHash: await linkHash(token) });
    return token;
  },
});
