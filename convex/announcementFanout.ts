import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { queueAnnouncementEmail } from "./notificationEvents";
/** Emails an announcement to the group's active, approved members, a bounded page at a time; each outbox record is idempotent. */
export const process = internalMutation({
 args:{announcementId:v.id("announcements"),cursor:v.union(v.string(),v.null())},returns:v.null(),
 handler:async(ctx,{announcementId,cursor})=>{
  const announcement=await ctx.db.get("announcements",announcementId);if(!announcement)return null;
  const page=await ctx.db.query("memberships").withIndex("by_church",q=>q.eq("churchId",announcement.churchId)).paginate({cursor,numItems:40});
  for(const member of page.page){
   // People who joined after it was posted see it on the home page instead.
   if(!member.active||!member.approved||member.removedAt||member._creationTime>announcement.createdAt)continue;
   await queueAnnouncementEmail(ctx,announcementId,member._id);
  }
  if(!page.isDone)await ctx.scheduler.runAfter(0,internal.announcementFanout.process,{announcementId,cursor:page.continueCursor});
  return null;
 }});
