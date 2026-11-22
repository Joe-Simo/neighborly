import { ConvexError, v } from "convex/values";
import { refusals } from "../src/lib/refusals";
import { parseScheduledTime, parseCalendarDate, overlapsTimeOff, expandWeeklySchedule } from "../src/lib/scheduling";
import { internal } from "./_generated/api";
import { accountEmailConfiguration } from "./notifications";
import { queueCoverRequest, cancelPendingNotification } from "./notificationEvents";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { mutation } from "./functions";
import { user, membership, firstMembership } from "./access";
import { isSampleVisitor } from "./demo";
import type { Id } from "./_generated/dataModel";
import { addName } from "./knownNames";

const churchId = v.id("churches");
const text = v.string();
const role = v.union(v.literal("member"), v.literal("coordinator"));
const command = v.union(
  v.object({ type: v.literal("createTeam"), name: text, description: text }),
  v.object({ type: v.literal("invite"), email: text, role }),
  v.object({ type: v.literal("createCommitment"), teamId: v.id("teams"), title: text, start: text, end: text, location: text, preparation: text, intervalWeeks: v.optional(v.number()), count: v.optional(v.number()) }),
  v.object({ type:v.literal("reviseCommitment"),commitmentId:v.id("commitments"),expectedVersion:v.number(),title:text,start:text,end:text,location:text,preparation:text }),
  v.object({ type:v.literal("cancelCommitment"),commitmentId:v.id("commitments"),expectedVersion:v.number() }),
  v.object({ type: v.literal("release"), commitmentId: v.id("commitments"), expectedVersion: v.number() }),
  v.object({ type: v.literal("requestCover"), commitmentId: v.id("commitments"), recipientId: v.id("memberships"), expectedVersion: v.number() }),
  v.object({ type: v.literal("respondCover"), requestId: v.id("requests"), accept: v.boolean() }),
  v.object({ type: v.literal("withdrawCover"), requestId: v.id("requests") }),
  v.object({ type: v.literal("addAvailability"), start: text, end: text }),
  v.object({ type: v.literal("removeAvailability"), availabilityId:v.id("availability") }),
  v.object({ type: v.literal("addTimeOff"), start: text, end: text, note: text }),
  v.object({ type: v.literal("removeTimeOff"), timeOffId: v.id("timeOff") }),
  v.object({ type: v.literal("createTask"), title: text, dueAt: text, assigneeId: v.union(v.id("memberships"), v.literal("")) }),
  v.object({ type: v.literal("setTaskComplete"), taskId: v.id("tasks"), complete: v.boolean() }),
  v.object({ type: v.literal("createMeeting"), title: text, start: text, end: text, location: text }),
  v.object({ type: v.literal("respondMeeting"), meetingId: v.id("meetings"), response: v.union(v.literal("accepted"),v.literal("declined")) }),
  v.object({ type: v.literal("createAnnouncement"), title: text, body: text, emailEveryone: v.optional(v.boolean()) }),
  v.object({ type: v.literal("setCoverOptIn"), optedIn: v.boolean() }),
  v.object({ type: v.literal("respondTeam"), teamId: v.id("teams"), accept: v.boolean() }),
  v.object({ type: v.literal("setApproval"), personId: v.id("memberships"), approved: v.boolean() }),
  v.object({ type: v.literal("setMembership"), personId:v.id("memberships"), active:v.boolean(), role:v.union(v.literal("coordinator"),v.literal("member")) }),
  v.object({ type: v.literal("setTeamApproval"), teamId:v.id("teams"), personId:v.id("memberships"), approved:v.boolean() }),
  v.object({ type: v.literal("setTeamRole"), teamId:v.id("teams"), personId:v.id("memberships"), role:v.union(v.literal("coordinator"),v.literal("member")) }),
  v.object({ type: v.literal("setTeamMember"), teamId: v.id("teams"), personId: v.id("memberships"), member: v.boolean() }),
);
function required(value: string, max = 200) {
  const result = value.trim();
  if (!result || result.length > max) throw new ConvexError("Enter a valid value.");
  return result;
}
function calendarDate(value: string, zone: string) {
  try { parseCalendarDate(value, zone); return true; } catch { return false; }
}
const viewerReturn = v.object({ churches: v.array(v.object({ id: churchId, name: text })), truncated:v.boolean() });
export const viewer = query({ args: {}, returns: viewerReturn, handler: async (ctx) => {
  const account = await user(ctx);
  const memberships = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", account.id)).take(101);
  const churches = await Promise.all(memberships.filter(m => m.active).map(m => ctx.db.get("churches",m.churchId)));
  return { churches: churches.filter(c => c !== null).map(c => ({ id: c._id, name: c.name })), truncated: memberships.length>100 };
} });
export const createChurch = mutation({ args: { name: text, timeZone: text, displayName: text }, returns: churchId, handler: async (ctx, args) => {
  const account = await user(ctx);
  if (isSampleVisitor((await ctx.auth.getUserIdentity())?.subject)) throw new ConvexError("The sample account can only look around the sample conference. Create your own account to start a conference.");
  const name = required(args.name); const displayName = required(args.displayName); const zone = required(args.timeZone);
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(0); } catch { throw new ConvexError("Enter a valid time zone."); }
  const id = await ctx.db.insert("churches", { name, timeZone: zone, wordSet: "vincentian" });
  await ctx.db.insert("memberships", { churchId:id,userId:account.id,name:displayName,email:account.email,role:"owner",active:true,approved:true,coverOptIn:false });
  await addName(ctx, id, displayName);
  await ctx.db.insert("auditEvents",{churchId:id,actorId:account.id,action:"church_created",at:Date.now()});
  return id;
} });
// Invitation acceptance is deliberately unavailable until verified email delivery and token handling are configured.
export const joinChurch = mutation({ args: { token: text, displayName: text }, returns: churchId, handler: async () => { throw new Error("Invitations are not available until email delivery is configured."); } });
const dashboardReturn = v.object({
  church: v.object({ id: churchId, name: text, timeZone: text, sample: v.boolean(), wordSet: v.union(v.literal("general"), v.literal("vincentian")) }),
  user: v.object({ id: v.id("memberships"), name: text, email: text, language: v.union(v.literal("en"), v.literal("es")), joinedAt: v.number() }), canCoordinate: v.boolean(), truncated:v.array(text),
  teams: v.array(v.object({ id:v.id("teams"), name:text, description:text, memberIds:v.array(v.id("memberships")), approvedMemberIds:v.array(v.id("memberships")), myInvitation:v.boolean(), canCoordinate:v.boolean(), memberRoles:v.array(v.object({personId:v.id("memberships"),role:v.union(v.literal("coordinator"),v.literal("member"))})) })),
  people: v.array(v.object({ id:v.id("memberships"), name:text, email:text, role:text, active:v.boolean(), approved:v.boolean(), coverOptIn:v.boolean() })),
  commitments: v.array(v.object({ id:v.id("commitments"), teamId:v.id("teams"),title:text,start:v.number(),end:v.number(),location:text,preparation:text,assigneeId:v.union(v.id("memberships"),v.null()),version:v.number(),status:text,coordinatorName:text })),
  requests: v.array(v.object({ id:v.id("requests"),commitmentId:v.id("commitments"),recipientId:v.id("memberships"),status:text })),
  availability:v.array(v.object({id:v.id("availability"),personId:v.id("memberships"),start:text,end:text})),
  timeOff:v.array(v.object({ id:v.id("timeOff"),personId:v.id("memberships"),start:text,end:text,note:text })),
  tasks:v.array(v.object({id:v.id("tasks"),title:text,dueAt:v.union(v.number(),v.null()),assigneeId:v.union(v.id("memberships"),v.null()),complete:v.boolean()})),
  meetings:v.array(v.object({id:v.id("meetings"),title:text,start:v.number(),end:v.number(),location:text,fanoutStatus:v.union(v.literal("processing"),v.literal("complete")),responsesLimitedToSelf:v.boolean(),responses:v.array(v.object({personId:v.id("memberships"),response:text}))})),
  announcements:v.array(v.object({id:v.id("announcements"),title:text,body:text,authorName:text,createdAt:v.number(),canChange:v.optional(v.boolean())})),
  invitations:v.array(v.object({id:v.id("invitations"),email:text,role:text,status:text,expiresAt:v.optional(v.number())})),
});
// Without a conference named, the first one the account belongs to: the sample door asks this way, so the room's
// question goes out with the sign-in check instead of after it. The same one memberships read either way.
export const dashboard = query({ args:{churchId:v.optional(churchId)},returns:dashboardReturn,handler:async(ctx,{churchId:named})=>{
  const me=named?await membership(ctx,named):await firstMembership(ctx); const args={churchId:me.churchId}; const church=await ctx.db.get("churches",args.churchId); if(!church) throw new ConvexError("Workspace not found.");
  const [members,teams,teamMembers,commitments,requests,availability,timeOff,tasks,meetings,announcements,invitations,myMeetingInvitations,ownRelations] = await Promise.all([
    ctx.db.query("memberships").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("teams").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("teamMembers").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("commitments").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("requests").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("availability").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("timeOff").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("tasks").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("meetings").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("announcements").withIndex("by_church_removed",q=>q.eq("churchId",args.churchId).eq("removedAt",undefined)).take(201),
    ctx.db.query("invitations").withIndex("by_church",q=>q.eq("churchId",args.churchId)).take(201),
    ctx.db.query("meetingInvitees").withIndex("by_member",q=>q.eq("memberId",me._id)).take(201),
    ctx.db.query("teamMembers").withIndex("by_member",q=>q.eq("memberId",me._id)).take(201),
  ]);
  const truncated = Object.entries({members,teams,teamMembers,commitments,requests,availability,timeOff,tasks,meetings,announcements,invitations,myMeetingInvitations,ownRelations}).filter(([,rows])=>rows.length>200).map(([key])=>key);
  const ownedTeamIds = ownRelations.filter(x => x.churchId === args.churchId && x.status === "active" && x.teamRole === "coordinator").map(x => x.teamId);
  const visibleTeamIds = me.role === "owner" ? teams.map(t => t._id) : ownRelations.filter(x=>x.churchId===args.churchId&&x.status==="active").map(x=>x.teamId);
  const coordinatedMembers=teamMembers.filter(x=>x.status==="active"&&ownedTeamIds.includes(x.teamId)).map(x=>x.memberId);
  const visibleMembers=teamMembers.filter(x=>x.status==="active"&&visibleTeamIds.includes(x.teamId)).map(x=>x.memberId);
  const canCoordinate=me.role==="owner"||ownedTeamIds.length>0; const name=(id:Id<"memberships">)=>members.find(m=>m._id===id)?.name ?? "A former member";
  const meetingSummaries=await Promise.all(meetings.filter(m=>me.role==="owner"||myMeetingInvitations.some(i=>i.meetingId===m._id)).map(async m=>{const response=await ctx.db.query("meetingResponses").withIndex("by_meeting_member",q=>q.eq("meetingId",m._id).eq("memberId",me._id)).unique();return {id:m._id,title:m.title,start:m.start,end:m.end,location:m.location,fanoutStatus:m.fanoutStatus,responsesLimitedToSelf:true,responses:response?[{personId:response.memberId,response:response.response}]:[]};}));
  return { church:{id:church._id,name:church.name,timeZone:church.timeZone,sample:church.sample===true,wordSet:church.wordSet??"general"},user:{id:me._id,name:me.name,email:me.email,language:me.language==="es"?"es" as const:"en" as const,joinedAt:me._creationTime},canCoordinate,truncated,
    teams:teams.filter(t=>visibleTeamIds.includes(t._id)||ownRelations.some(x=>x.teamId===t._id&&x.status==="invited")).map(t=>({id:t._id,name:t.name,description:t.description,memberIds:teamMembers.filter(x=>visibleTeamIds.includes(t._id)&&x.teamId===t._id&&x.status==="active").map(x=>x.memberId),approvedMemberIds:teamMembers.filter(x=>visibleTeamIds.includes(t._id)&&x.teamId===t._id&&x.status==="active"&&x.approved).map(x=>x.memberId),myInvitation:ownRelations.some(x=>x.teamId===t._id&&x.status==="invited"),canCoordinate:me.role==="owner"||ownedTeamIds.includes(t._id),memberRoles:teamMembers.filter(x=>visibleTeamIds.includes(t._id)&&x.teamId===t._id&&x.status==="active").map(x=>({personId:x.memberId,role:x.teamRole}))})),
    people:members.filter(m=>!m.removedAt&&(me.role==="owner"||(m.active&&(m._id===me._id||visibleMembers.includes(m._id))))).map(m=>({id:m._id,name:m.name,active:m.active,email:me.role==="owner"||coordinatedMembers.includes(m._id)||m._id===me._id?m.email:"",role:m.role,approved:m.approved,coverOptIn:me.role==="owner"||coordinatedMembers.includes(m._id)||m._id===me._id?m.coverOptIn:false})),
    commitments:commitments.filter(c=>visibleTeamIds.includes(c.teamId)).map(c=>({id:c._id,teamId:c.teamId,title:c.title,start:c.start,end:c.end,location:c.location,preparation:me.role==="owner"||ownedTeamIds.includes(c.teamId)||c.assigneeId===me._id?c.preparation:"",assigneeId:c.assigneeId,version:c.version,status:c.cancelled?"cancelled":c.assigneeId?"accepted":"open",coordinatorName:name(c.coordinatorId)})),
    requests:requests.filter(r=>r.recipientId===me._id||me.role==="owner"||commitments.some(c=>c._id===r.commitmentId&&ownedTeamIds.includes(c.teamId))).map(r=>({id:r._id,commitmentId:r.commitmentId,recipientId:r.recipientId,status:r.status})),
    availability:availability.filter(a=>me.role==="owner"||coordinatedMembers.includes(a.memberId)||a.memberId===me._id).map(a=>({id:a._id,personId:a.memberId,start:a.start,end:a.end})),
    timeOff:timeOff.filter(t=>me.role==="owner"||coordinatedMembers.includes(t.memberId)||t.memberId===me._id).map(t=>({id:t._id,personId:t.memberId,start:t.start,end:t.end,note:t.memberId===me._id?t.note:""})),
    tasks:tasks.map(t=>({id:t._id,title:t.title,dueAt:t.dueAt,assigneeId:t.assigneeId,complete:t.complete})),
    meetings:meetingSummaries,
    announcements:announcements.filter(a=>!a.removedAt).map(a=>({id:a._id,title:a.title,body:a.body,authorName:name(a.authorId),createdAt:a.createdAt,canChange:me.role==="owner"||a.authorId===me._id})),
    invitations:me.role==="owner"?invitations.map(i=>({id:i._id,email:i.email,role:i.role,status:i.status,expiresAt:i.expiresAt})):[],
  };
}});
export const execute = mutation({args:{churchId,command},returns:v.null(),handler:async(ctx,{churchId,command:c})=>{
 const me=await membership(ctx,churchId); const now=Date.now(); const settings=await ctx.db.get("churches",churchId);if(!settings)throw new ConvexError("Workspace not found.");
 // A team is led by its own coordinators, whatever their place in the group: leading a team never opens neighbor records.
 const authorizeTeam = async (id:Id<"teams">) => { if(me.role === "owner") return; const relation=await ctx.db.query("teamMembers").withIndex("by_team_member",q=>q.eq("teamId",id).eq("memberId",me._id)).unique(); if(relation?.status!=="active"||relation.teamRole!=="coordinator") throw new ConvexError("Team coordinator access required."); };
 // Asking someone is held to the dates they said they are free. Their own yes is that word, so it needs no date on file: only being away or busy stops it.
 const eligible = async (person: {_id:Id<"memberships">;name:string}, row: {start:number;end:number;_id:Id<"commitments">}, own=false) => {
   const parts=new Intl.DateTimeFormat("en",{timeZone:settings.timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(row.start);
   const part=(type:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===type)?.value;
   const startDay=`${part("year")}-${part("month")}-${part("day")}`;
   let available=own;
   if(!available)for await(const x of ctx.db.query("availability").withIndex("by_member_end",q=>q.eq("memberId",person._id).gte("end",startDay))){if(x.churchId===churchId&&parseCalendarDate(x.start,settings.timeZone).toMillis()<=row.start&&parseCalendarDate(x.end,settings.timeZone).plus({days:1}).toMillis()>=row.end){available=true;break;}}
   if(!available)throw new ConvexError(`${person.name} has not said they are free that day. Ask them to add the date under Time off, or ask someone else.`);
   for await(const x of ctx.db.query("timeOff").withIndex("by_member_end",q=>q.eq("memberId",person._id).gte("end",startDay)))if(x.churchId===churchId&&overlapsTimeOff(row.start,row.end,x.start,x.end,settings.timeZone))throw new ConvexError(own?refusals.away:`${person.name} is away that day. Ask someone else.`);
   for await(const x of ctx.db.query("commitments").withIndex("by_assignee_end",q=>q.eq("assigneeId",person._id).gt("end",row.start)))if(x._id!==row._id&&x.start<row.end)throw new ConvexError(own?refusals.busy:`${person.name} already has a commitment at that time. Ask someone else.`);
 };
 const withdrawPending = async (person:Id<"memberships">, teamId?:Id<"teams">) => {
   const pending=await ctx.db.query("requests").withIndex("by_recipient_status",q=>q.eq("recipientId",person).eq("status","pending")).take(201);
   if(pending.length>200)throw new Error("Pending requests require a narrower lookup.");
   for(const req of pending) { if(req.churchId!==churchId||req.status!=="pending")continue;const slot=await ctx.db.get("commitments",req.commitmentId);if(teamId&&slot?.teamId!==teamId)continue;await ctx.db.patch("requests",req._id,{status:"withdrawn"});await cancelPendingNotification(ctx,churchId,`cover:${req._id}`); }
 };
 const team = async (id:Id<"teams">)=>{const row=await ctx.db.get("teams",id);if(!row||row.churchId!==churchId)throw new ConvexError("Team not found.");return row;};
 const member = async (id:Id<"memberships">)=>{const row=await ctx.db.get("memberships",id);if(!row||row.churchId!==churchId||!row.active)throw new ConvexError("Person not found.");return row;};
 const commitment = async (id:Id<"commitments">)=>{const row=await ctx.db.get("commitments",id);if(!row||row.churchId!==churchId)throw new ConvexError(refusals.noCommitment);return row;};
 switch(c.type){
 case "createTeam": {if(me.role!=="owner")throw new ConvexError("Owner access required.");const id=await ctx.db.insert("teams",{churchId,name:required(c.name),description:c.description.trim().slice(0,2000)});await ctx.db.insert("teamMembers",{churchId,teamId:id,memberId:me._id,teamRole:"coordinator",approved:true,status:"active"});break;}
 case "invite": throw new ConvexError("Use the invitation flow to create a secure invitation.");
 case "createCommitment": {await team(c.teamId);await authorizeTeam(c.teamId);const occurrences=expandWeeklySchedule({start:c.start,end:c.end,timeZone:settings.timeZone,intervalWeeks:c.intervalWeeks,count:c.count});const seriesId=occurrences.length>1?await ctx.db.insert("series",{churchId,teamId:c.teamId,intervalWeeks:c.intervalWeeks??1,count:occurrences.length}):undefined;for(const occurrence of occurrences)await ctx.db.insert("commitments",{...(seriesId?{seriesId}:{}),churchId,teamId:c.teamId,title:required(c.title),start:occurrence.start,end:occurrence.end,location:required(c.location),preparation:c.preparation.trim().slice(0,5000),assigneeId:null,coordinatorId:me._id,version:1});break;}
 case "reviseCommitment":
 case "cancelCommitment": {
  const row=await commitment(c.commitmentId);await authorizeTeam(row.teamId);
  if(row.cancelled||row.version!==c.expectedVersion)throw new ConvexError(refusals.changed);
  const revision=c.type==="reviseCommitment"?{title:required(c.title),start:parseScheduledTime(c.start,settings.timeZone),end:parseScheduledTime(c.end,settings.timeZone),location:required(c.location),preparation:c.preparation.trim().slice(0,5000)}:null;
  if(revision&&revision.end<=revision.start)throw new ConvexError(refusals.endAfterStart);
  if(revision&&revision.title===row.title&&revision.start===row.start&&revision.end===row.end&&revision.location===row.location&&revision.preparation===row.preparation)break;
  const pending=await ctx.db.query("requests").withIndex("by_commitment_status",q=>q.eq("commitmentId",row._id).eq("status","pending")).take(2);
  if(pending.length>1)throw new Error("Multiple pending requests require review.");
  const accepted=await ctx.db.query("requests").withIndex("by_commitment_version_status",q=>q.eq("commitmentId",row._id).eq("commitmentVersion",row.version-1).eq("status","accepted")).take(2);
  if(accepted.length>1)throw new Error("Multiple accepted requests require review.");
  await ctx.db.insert("commitmentHistory",{churchId,commitmentId:row._id,actorId:me.userId,action:revision?"revised":"cancelled",version:row.version,title:row.title,start:row.start,end:row.end,location:row.location,preparation:row.preparation,assigneeId:row.assigneeId,at:now});
  for(const req of pending){await ctx.db.patch("requests",req._id,{status:"withdrawn"});await cancelPendingNotification(ctx,churchId,`cover:${req._id}`);}
  for(const req of accepted)await ctx.db.patch("requests",req._id,{status:"superseded"});
  await ctx.db.patch("commitments",row._id,{...(revision??{cancelled:true}),assigneeId:null,version:row.version+1});
  break;
 }
 case "release": {const row=await commitment(c.commitmentId);if(row.cancelled||row.assigneeId!==me._id)throw new ConvexError(refusals.onlyAccepter);if(row.version!==c.expectedVersion)throw new ConvexError(refusals.changed);await ctx.db.patch("commitments",row._id,{assigneeId:null,version:row.version+1});break;}
 case "requestCover": {const row=await commitment(c.commitmentId);await authorizeTeam(row.teamId);if(row.cancelled||row.assigneeId||row.version!==c.expectedVersion||row.start<=now)throw new ConvexError(refusals.changedOrStarted);const target=await member(c.recipientId);if(!target.approved||!target.coverOptIn)throw new ConvexError("The person has not opted in or is not approved.");await eligible(target,row);const tm=await ctx.db.query("teamMembers").withIndex("by_team_member",q=>q.eq("teamId",row.teamId).eq("memberId",target._id)).unique();if(tm?.status!=="active"||!tm.approved)throw new ConvexError("The person is not approved for this team.");const pending=await ctx.db.query("requests").withIndex("by_commitment_status",q=>q.eq("commitmentId",row._id).eq("status","pending")).take(1);if(pending.length)throw new ConvexError(refusals.pending);const requestId=await ctx.db.insert("requests",{churchId,commitmentId:row._id,recipientId:target._id,commitmentVersion:row.version,status:"pending"});await queueCoverRequest(ctx,requestId);break;}
 case "withdrawCover": {const req=await ctx.db.get("requests",c.requestId);if(!req||req.churchId!==churchId||req.status!=="pending")throw new ConvexError(refusals.unavailable);const row=await commitment(req.commitmentId);await authorizeTeam(row.teamId);await ctx.db.patch("requests",req._id,{status:"withdrawn"});await cancelPendingNotification(ctx,churchId,`cover:${req._id}`);break;}
 case "respondCover": {const req=await ctx.db.get("requests",c.requestId);if(!req||req.churchId!==churchId||req.recipientId!==me._id||req.status!=="pending")throw new ConvexError(refusals.unavailable);const row=await commitment(req.commitmentId);if(c.accept){if(row.cancelled||row.assigneeId||row.version!==req.commitmentVersion||row.start<=now)throw new ConvexError(refusals.askNew);const currentTeam=await ctx.db.query("teamMembers").withIndex("by_team_member",q=>q.eq("teamId",row.teamId).eq("memberId",me._id)).unique();if(!me.approved||!me.coverOptIn||(currentTeam?.status!=="active"||!currentTeam.approved))throw new ConvexError(refusals.notEligible);await eligible(me,row,true);}await ctx.db.patch("requests",req._id,{status:c.accept?"accepted":"declined"});await cancelPendingNotification(ctx,churchId,`cover:${req._id}`);if(c.accept)await ctx.db.patch("commitments",row._id,{assigneeId:me._id,version:row.version+1});break;}
 case "addAvailability": {if(!calendarDate(c.start,settings.timeZone)||!calendarDate(c.end,settings.timeZone)||c.end<c.start)throw new ConvexError(refusals.dateRange);await ctx.db.insert("availability",{churchId,memberId:me._id,start:c.start,end:c.end});break;}
 case "removeAvailability": {const row=await ctx.db.get("availability",c.availabilityId);if(!row||row.churchId!==churchId||row.memberId!==me._id)throw new ConvexError(refusals.noAvailability);await ctx.db.delete("availability",row._id);break;}
 case "addTimeOff": {if(!calendarDate(c.start,settings.timeZone)||!calendarDate(c.end,settings.timeZone)||c.end<c.start)throw new ConvexError(refusals.dateRange);if((await affectedTimeOff(ctx,churchId,me._id,c.start,c.end)).length)throw new ConvexError(refusals.reviewFirst);await ctx.db.insert("timeOff",{churchId,memberId:me._id,start:c.start,end:c.end,note:c.note.trim().slice(0,1000)});break;}
 case "removeTimeOff": {const row=await ctx.db.get("timeOff",c.timeOffId);if(!row||row.churchId!==churchId||row.memberId!==me._id)throw new ConvexError(refusals.noTimeOff);await ctx.db.delete("timeOff",row._id);break;}
 case "createTask": {if(me.role!=="owner")throw new ConvexError("Owner access required.");const assigneeId=c.assigneeId? (await member(c.assigneeId))._id:null;await ctx.db.insert("tasks",{churchId,title:required(c.title),dueAt:c.dueAt?parseScheduledTime(c.dueAt,settings.timeZone):null,assigneeId,complete:false});break;}
 case "setTaskComplete": {const row=await ctx.db.get("tasks",c.taskId);if(!row||row.churchId!==churchId||row.assigneeId!==me._id&&me.role!=="owner")throw new ConvexError("Task access required.");await ctx.db.patch("tasks",row._id,{complete:c.complete});break;}
 case "createMeeting": {if(me.role!=="owner")throw new ConvexError("Owner access required.");const start=parseScheduledTime(c.start,settings.timeZone),end=parseScheduledTime(c.end,settings.timeZone);if(end<=start)throw new ConvexError(refusals.endAfterStart);const meetingId=await ctx.db.insert("meetings",{churchId,title:required(c.title),start,end,location:required(c.location),fanoutStatus:"processing",cutoff:now});await ctx.scheduler.runAfter(0,internal.meetingFanout.process,{meetingId,cursor:null});break;}
 case "respondMeeting": {const meeting=await ctx.db.get("meetings",c.meetingId);if(!meeting||meeting.churchId!==churchId)throw new ConvexError(refusals.noMeetingInvitation);const invited=await ctx.db.query("meetingInvitees").withIndex("by_meeting_member",q=>q.eq("meetingId",meeting._id).eq("memberId",me._id)).unique();if(!invited)throw new ConvexError(refusals.noMeetingInvitation);const existing=await ctx.db.query("meetingResponses").withIndex("by_meeting_member",q=>q.eq("meetingId",meeting._id).eq("memberId",me._id)).unique();if(existing)await ctx.db.patch("meetingResponses",existing._id,{response:c.response});else await ctx.db.insert("meetingResponses",{churchId,meetingId:meeting._id,memberId:me._id,response:c.response});await cancelPendingNotification(ctx,churchId,`meeting:${meeting._id}:${me._id}`);break;}
 case "createAnnouncement": if(me.role!=="owner")throw new ConvexError("Owner access required.");{const announcementId=await ctx.db.insert("announcements",{churchId,title:required(c.title),body:required(c.body,5000),authorId:me._id,createdAt:now});if(c.emailEveryone)await ctx.scheduler.runAfter(0,internal.announcementFanout.process,{announcementId,cursor:null});break;}
 case "setTeamApproval": {await team(c.teamId);await authorizeTeam(c.teamId);const person=await member(c.personId);const relation=await ctx.db.query("teamMembers").withIndex("by_team_member",q=>q.eq("teamId",c.teamId).eq("memberId",person._id)).unique();if(!relation||relation.status!=="active")throw new ConvexError("Person must first accept team membership.");await ctx.db.patch("teamMembers",relation._id,{approved:c.approved});if(!c.approved)await withdrawPending(person._id,c.teamId);break;}
 case "setTeamRole": {if(me.role!=="owner")throw new ConvexError("Owner access required.");await team(c.teamId);const person=await member(c.personId);const relation=await ctx.db.query("teamMembers").withIndex("by_team_member",q=>q.eq("teamId",c.teamId).eq("memberId",person._id)).unique();if(!relation||relation.status!=="active")throw new ConvexError("Person must first accept team membership.");await ctx.db.patch("teamMembers",relation._id,{teamRole:c.role});break;}
 case "setMembership": {if(me.role!=="owner")throw new ConvexError("Owner access required.");const person=await ctx.db.get("memberships",c.personId);if(!person||person.churchId!==churchId||person.role==="owner"||person.removedAt)throw new ConvexError("Membership cannot be changed.");await ctx.db.patch("memberships",person._id,{active:c.active,role:c.role});if(!c.active)await withdrawPending(person._id);break;}
 case "setApproval": {if(me.role!=="owner")throw new ConvexError("Owner access required.");const person=await member(c.personId);await ctx.db.patch("memberships",person._id,{approved:c.approved});if(!c.approved)await withdrawPending(person._id);break;}
 case "setCoverOptIn": await ctx.db.patch("memberships",me._id,{coverOptIn:c.optedIn});if(!c.optedIn)await withdrawPending(me._id);break;
 case "respondTeam": {await team(c.teamId);const invitation=await ctx.db.query("teamMembers").withIndex("by_team_member",q=>q.eq("teamId",c.teamId).eq("memberId",me._id)).unique();if(!invitation||invitation.status!=="invited")throw new ConvexError(refusals.noTeamInvitation);if(c.accept)await ctx.db.patch("teamMembers",invitation._id,{status:"active"});else await ctx.db.delete("teamMembers",invitation._id);break;}
 case "setTeamMember": {await team(c.teamId);await authorizeTeam(c.teamId);const person=await member(c.personId);const existing=await ctx.db.query("teamMembers").withIndex("by_team_member",q=>q.eq("teamId",c.teamId).eq("memberId",person._id)).unique();if(c.member){if(!existing)await ctx.db.insert("teamMembers",{churchId,teamId:c.teamId,memberId:person._id,teamRole:"member",approved:false,status:"invited"});}else if(existing){await ctx.db.delete("teamMembers",existing._id);await withdrawPending(person._id,c.teamId);}break;}
 }
 await ctx.db.insert("auditEvents",{churchId,actorId:me.userId,action:c.type,...("commitmentId" in c?{commitmentId:c.commitmentId}:{}),at:now});
 return null;
}});
const reviewedCommitment = v.object({ id:v.id("commitments"), version:v.number() });
async function affectedTimeOff(ctx: QueryCtx | MutationCtx, church: Id<"churches">, memberId:Id<"memberships">, start:string, end:string) {
 const settings=await ctx.db.get("churches",church);if(!settings)throw new ConvexError("Workspace not found.");
 if(!calendarDate(start,settings.timeZone)||!calendarDate(end,settings.timeZone)||end<start)throw new ConvexError(refusals.dateRange);
 const from=parseCalendarDate(start,settings.timeZone).toMillis(), through=parseCalendarDate(end,settings.timeZone).plus({days:1}).toMillis();
 const affected: Array<import("./_generated/dataModel").Doc<"commitments">>=[];
 for await(const work of ctx.db.query("commitments").withIndex("by_assignee_end",q=>q.eq("assigneeId",memberId).gt("end",from)))if(work.churchId===church&&work.start<through)affected.push(work);
 return affected;
}
export const previewTimeOff=query({args:{churchId,start:text,end:text},returns:v.array(v.object({id:v.id("commitments"),title:text,start:v.number(),version:v.number()})),handler:async(ctx,args)=>{
 const me=await membership(ctx,args.churchId);return (await affectedTimeOff(ctx,args.churchId,me._id,args.start,args.end)).map(w=>({id:w._id,title:w.title,start:w.start,version:w.version}));
}});
export const confirmTimeOff=mutation({args:{churchId,start:text,end:text,note:text,reviewed:v.array(reviewedCommitment)},returns:v.id("timeOff"),handler:async(ctx,args)=>{
 const me=await membership(ctx,args.churchId);const affected=await affectedTimeOff(ctx,args.churchId,me._id,args.start,args.end);
 if(affected.length!==args.reviewed.length||affected.some(w=>!args.reviewed.some(r=>r.id===w._id&&r.version===w.version)))throw new ConvexError(refusals.datesChanged);
 for(const row of affected)await ctx.db.patch("commitments",row._id,{assigneeId:null,version:row.version+1});
 const id=await ctx.db.insert("timeOff",{churchId:args.churchId,memberId:me._id,start:args.start,end:args.end,note:args.note.trim().slice(0,1000)});
 await ctx.db.insert("auditEvents",{churchId:args.churchId,actorId:me.userId,action:"time_off_confirmed",targetId:id,at:Date.now()});return id;
}});

export const emailConfiguration = query({args:{},returns:v.boolean(),handler:async()=>accountEmailConfiguration() !== null});
export const retryMeetingFanout=mutation({args:{churchId,meetingId:v.id("meetings")},returns:v.null(),handler:async(ctx,args)=>{
 const me=await membership(ctx,args.churchId);if(me.role!=="owner")throw new ConvexError("Owner access required.");const meeting=await ctx.db.get("meetings",args.meetingId);if(!meeting||meeting.churchId!==args.churchId)throw new ConvexError("Meeting not found.");if(meeting.fanoutStatus==="processing")await ctx.scheduler.runAfter(0,internal.meetingFanout.process,{meetingId:meeting._id,cursor:null});return null;
}});
