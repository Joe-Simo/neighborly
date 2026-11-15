import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { queueMeetingInvitation } from "./notificationEvents";
/** Processes a bounded page; each invitation/outbox record is idempotent. */
export const process = internalMutation({
 args:{meetingId:v.id("meetings"),cursor:v.union(v.string(),v.null())},returns:v.null(),
 handler:async(ctx,{meetingId,cursor})=>{
  const meeting=await ctx.db.get("meetings",meetingId);if(!meeting||meeting.fanoutStatus!=="processing")return null;
  const page=await ctx.db.query("memberships").withIndex("by_church",q=>q.eq("churchId",meeting.churchId)).paginate({cursor,numItems:40});
  for(const member of page.page){
   if(!member.active||member._creationTime>meeting.cutoff)continue;
   const existing=await ctx.db.query("meetingInvitees").withIndex("by_meeting_member",q=>q.eq("meetingId",meetingId).eq("memberId",member._id)).unique();
   if(!existing)await ctx.db.insert("meetingInvitees",{churchId:meeting.churchId,meetingId,memberId:member._id});
   await queueMeetingInvitation(ctx,meetingId,member._id);
  }
  if(page.isDone)await ctx.db.patch("meetings",meetingId,{fanoutStatus:"complete"});
  else await ctx.scheduler.runAfter(0,internal.meetingFanout.process,{meetingId,cursor:page.continueCursor});
  return null;
 }});
