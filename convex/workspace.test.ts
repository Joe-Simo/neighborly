import { refusals } from "../src/lib/refusals";
/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
const modules=import.meta.glob(["./**/*.ts","!./**/*.test.ts"]);
async function setup(){
 const t=convexTest(schema,modules);const emails=new Map<string,string>();
 const ids=await t.run(async ctx=>{
  const owner=await ctx.db.insert("users",{}), coord=await ctx.db.insert("users",{}), vol=await ctx.db.insert("users",{}), outsider=await ctx.db.insert("users",{});
  const church=await ctx.db.insert("churches",{name:"A",timeZone:"America/New_York"}),other=await ctx.db.insert("churches",{name:"B",timeZone:"UTC"});
  const add=async(userId:typeof owner, role:"owner"|"coordinator"|"member")=>ctx.db.insert("memberships",{churchId:church,userId,name:role,email:`${role}@example.org`,role,active:true,approved:true,coverOptIn:true});
  const ownerMember=await add(owner,"owner"), coordMember=await add(coord,"coordinator"), volunteer=await add(vol,"member");
  const team=await ctx.db.insert("teams",{churchId:church,name:"Welcome",description:""}),hidden=await ctx.db.insert("teams",{churchId:church,name:"Private",description:""});
  for(const [memberId,teamRole] of [[coordMember,"coordinator"],[volunteer,"member"]] as const)await ctx.db.insert("teamMembers",{churchId:church,teamId:team,memberId,teamRole,approved:true,status:"active"});
  await ctx.db.insert("availability",{churchId:church,memberId:volunteer,start:"2099-01-01",end:"2099-12-31"});
  const slot=await ctx.db.insert("commitments",{churchId:church,teamId:team,title:"Welcome",start:Date.parse("2099-11-22T14:30:00Z"),end:Date.parse("2099-11-22T16:00:00Z"),location:"Hall",preparation:"Guide",assigneeId:null,coordinatorId:coordMember,version:1});
  const secret=await ctx.db.insert("commitments",{churchId:church,teamId:hidden,title:"Private",start:Date.parse("2099-11-22T14:30:00Z"),end:Date.parse("2099-11-22T16:00:00Z"),location:"Hall",preparation:"Private",assigneeId:null,coordinatorId:ownerMember,version:1});
  return {owner,coord,vol,outsider,church,other,team,hidden,slot,secret,volunteer};
 });
 for(const id of [ids.owner,ids.coord,ids.vol,ids.outsider])emails.set(id,`${id}@example.org`);
 return {t,ids,as:(id:string)=>signedIn(t, id, emails.has(id))};
}
describe("workspace access and consent",()=>{
 test("leading a team never raises the church role, and a team's own coordinator still leads it",async()=>{
  const {t,ids,as}=await setup();
  await as(ids.owner).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"setTeamRole",teamId:ids.team,personId:ids.volunteer,role:"coordinator"}});
  expect((await t.run(ctx=>ctx.db.get("memberships",ids.volunteer)))?.role).toBe("member");
  expect(await as(ids.vol).query(api.access.canOpenNeighborRecords,{churchId:ids.church})).toBe(false);
  // A church member who coordinates the team asks for cover on it.
  const other=await t.run(async ctx=>{const m=await ctx.db.insert("memberships",{churchId:ids.church,userId:await ctx.db.insert("users",{}),name:"Other",email:"o@example.org",role:"member",active:true,approved:true,coverOptIn:true});await ctx.db.insert("teamMembers",{churchId:ids.church,teamId:ids.team,memberId:m,teamRole:"member",approved:true,status:"active"});await ctx.db.insert("availability",{churchId:ids.church,memberId:m,start:"2099-01-01",end:"2099-12-31"});return m;});
  await as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:other,expectedVersion:1}});
 });
 test("request pages carry authorized context independently of assigned commitments and pagination",async()=>{
  const {t,ids,as}=await setup();
  await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}});
  const own=await as(ids.vol).query(api.pages.commitmentsPage,{churchId:ids.church,scope:"mine",paginationOpts:{numItems:10,cursor:null}});
  expect(own.page).toHaveLength(0);
  // A request to a currently inaccessible team must not disclose its commitment.
  await t.run(async ctx=>{await ctx.db.insert("requests",{churchId:ids.church,commitmentId:ids.secret,recipientId:ids.volunteer,commitmentVersion:1,status:"pending"});});
  let cursor:string|null=null;
  const contexts: Array<{commitmentId:string;commitment:{title:string;preparation:string}|null}>=[];
  for(let pageNumber=0;pageNumber<2;pageNumber++){
   const page: FunctionReturnType<typeof api.pages.requestsPage>=await as(ids.vol).query(api.pages.requestsPage,{churchId:ids.church,paginationOpts:{numItems:1,cursor}});
   contexts.push(...page.page);cursor=page.continueCursor;
  }
  expect(contexts.find(row=>row.commitmentId===ids.slot)?.commitment).toMatchObject({title:"Welcome",location:"Hall",preparation:""});
  expect(contexts.find(row=>row.commitmentId===ids.secret)?.commitment).toBeNull();
  const coordinator=await as(ids.coord).query(api.pages.requestsPage,{churchId:ids.church,paginationOpts:{numItems:10,cursor:null}});
  expect(coordinator.page.map(row=>row.commitmentId)).toEqual([ids.slot]);
  expect(coordinator.page[0].commitment?.preparation).toBe("Guide");
  await expect(as(ids.outsider).query(api.pages.requestsPage,{churchId:ids.church,paginationOpts:{numItems:10,cursor:null}})).rejects.toThrow("Workspace access");
  // Asked with no conference named, the first lists answer for the caller's own conference, with the same gates.
  expect(await as(ids.coord).query(api.pages.requestsPage,{paginationOpts:{numItems:10,cursor:null}})).toEqual(coordinator);
  expect((await as(ids.vol).query(api.pages.announcementsPage,{paginationOpts:{numItems:10,cursor:null}})).page).toEqual((await as(ids.vol).query(api.pages.announcementsPage,{churchId:ids.church,paginationOpts:{numItems:10,cursor:null}})).page);
  await expect(as(ids.outsider).query(api.pages.requestsPage,{paginationOpts:{numItems:10,cursor:null}})).rejects.toThrow("Workspace access");
 });
 test("rejects another church and hides teams outside a coordinator's scope",async()=>{
  const {ids,as}=await setup();
  await expect(as(ids.outsider).query(api.workspace.dashboard,{churchId:ids.church})).rejects.toThrow("Workspace access");
  const data=await as(ids.coord).query(api.workspace.dashboard,{churchId:ids.church});
  expect(data.teams.map(t=>t.id)).toEqual([ids.team]);expect(data.commitments.map(c=>c.id)).toEqual([ids.slot]);
  await expect(as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.secret,recipientId:ids.volunteer,expectedVersion:1}})).rejects.toThrow("Team coordinator access");
 });
 test("only the intended eligible volunteer can accept, and stale review cannot release",async()=>{
  const {t,ids,as}=await setup();
  await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}});
  const request=await t.run(async ctx=>(await ctx.db.query("requests").withIndex("by_commitment",q=>q.eq("commitmentId",ids.slot)).unique())!);
  await expect(as(ids.owner).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"respondCover",requestId:request._id,accept:true}})).rejects.toThrow("Request unavailable");
  await as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"respondCover",requestId:request._id,accept:true}});
  await expect(as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"release",commitmentId:ids.slot,expectedVersion:1}})).rejects.toThrow("changed");
  const row=await t.run(ctx=>ctx.db.get("commitments",ids.slot));expect(row?.assigneeId).toBe(ids.volunteer);
 });
 test("time off rejects a stale preview and preserves membership",async()=>{
  const {t,ids,as}=await setup();await t.run(ctx=>ctx.db.patch("commitments",ids.slot,{assigneeId:ids.volunteer,version:2}));
  const args={churchId:ids.church,start:"2099-11-22",end:"2099-11-22"};const preview=await as(ids.vol).query(api.workspace.previewTimeOff,args);expect(preview).toHaveLength(1);
  await t.run(ctx=>ctx.db.patch("commitments",ids.slot,{version:3}));
  await expect(as(ids.vol).mutation(api.workspace.confirmTimeOff,{...args,note:"",reviewed:preview.map(({id,version})=>({id,version}))})).rejects.toThrow("changed");
  const state=await t.run(async ctx=>({slot:await ctx.db.get("commitments",ids.slot),member:await ctx.db.get("memberships",ids.volunteer)}));expect(state.slot?.assigneeId).toBe(ids.volunteer);expect(state.member?.active).toBe(true);
 });
 test("new time off blocks a pending cover acceptance until coordinator withdraws",async()=>{
  const {t,ids,as}=await setup();
  await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}});
  const req=await t.run(async ctx=>(await ctx.db.query("requests").withIndex("by_commitment",q=>q.eq("commitmentId",ids.slot)).unique())!);
  await as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"addTimeOff",start:"2099-11-22",end:"2099-11-22",note:""}});
  await expect(as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"respondCover",requestId:req._id,accept:true}})).rejects.toThrow("time off");
  await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"withdrawCover",requestId:req._id}});
  expect((await t.run(ctx=>ctx.db.get("requests",req._id)))?.status).toBe("withdrawn");
 });
 test("confirming reviewed time off releases only the selected dates",async()=>{
  const {t,ids,as}=await setup();await t.run(async ctx=>{await ctx.db.patch("commitments",ids.slot,{assigneeId:ids.volunteer,version:2});await ctx.db.patch("commitments",ids.secret,{assigneeId:ids.volunteer,start:Date.parse("2099-11-29T14:30:00Z"),end:Date.parse("2099-11-29T16:00:00Z")});});
  const args={churchId:ids.church,start:"2099-11-22",end:"2099-11-22"};const review=await as(ids.vol).query(api.workspace.previewTimeOff,args);
  await as(ids.vol).mutation(api.workspace.confirmTimeOff,{...args,note:"",reviewed:review.map(({id,version})=>({id,version}))});
  const row=await t.run(ctx=>ctx.db.get("commitments",ids.slot));expect(row?.assigneeId).toBeNull();expect(row?.version).toBe(3);expect((await t.run(ctx=>ctx.db.get("commitments",ids.secret)))?.assigneeId).toBe(ids.volunteer);
 });

 test("opting out withdraws a pending request without assigning the date",async()=>{
  const {t,ids,as}=await setup();await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}});
  const req=await t.run(async ctx=>(await ctx.db.query("requests").withIndex("by_commitment",q=>q.eq("commitmentId",ids.slot)).unique())!);
  await as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"setCoverOptIn",optedIn:false}});
  expect((await t.run(ctx=>ctx.db.get("requests",req._id)))?.status).toBe("withdrawn");
  expect((await t.run(ctx=>ctx.db.get("commitments",ids.slot)))?.assigneeId).toBeNull();
 });

 test("a pending request can be accepted only once",async()=>{
  const {t,ids,as}=await setup();await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}});
  const req=await t.run(async ctx=>(await ctx.db.query("requests").withIndex("by_commitment",q=>q.eq("commitmentId",ids.slot)).unique())!);
  const args={churchId:ids.church,command:{type:"respondCover" as const,requestId:req._id,accept:true}};
  await as(ids.vol).mutation(api.workspace.execute,args);
  await expect(as(ids.vol).mutation(api.workspace.execute,args)).rejects.toThrow("Request unavailable");
  expect((await t.run(ctx=>ctx.db.get("commitments",ids.slot)))?.version).toBe(2);
 });

 test("cover requires explicit availability and team approval",async()=>{
  const {t,ids,as}=await setup();
  const records=await t.run(async ctx=>({availability:(await ctx.db.query("availability").withIndex("by_member",q=>q.eq("memberId",ids.volunteer)).unique())!,teamMember:(await ctx.db.query("teamMembers").withIndex("by_team_member",q=>q.eq("teamId",ids.team).eq("memberId",ids.volunteer)).unique())!}));
  await t.run(ctx=>ctx.db.delete("availability",records.availability._id));
  const args={churchId:ids.church,command:{type:"requestCover" as const,commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}};
  await expect(as(ids.coord).mutation(api.workspace.execute,args)).rejects.toThrow("has not said they are free that day");
  await as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"addAvailability",start:"2099-11-22",end:"2099-11-22"}});
  await t.run(ctx=>ctx.db.patch("teamMembers",records.teamMember._id,{approved:false}));
  await expect(as(ids.coord).mutation(api.workspace.execute,args)).rejects.toThrow("not approved for this team");
 });

 test("meeting replies belong to invitees and do not complete tasks",async()=>{
  const {t,ids,as}=await setup();
  await as(ids.owner).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"createTask",title:"Signs",dueAt:"",assigneeId:ids.volunteer}});
  await as(ids.owner).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"createMeeting",title:"Check in",start:"2099-11-23T09:00",end:"2099-11-23T10:00",location:"Hall"}});
  const state=await t.run(async ctx=>({task:(await ctx.db.query("tasks").withIndex("by_church",q=>q.eq("churchId",ids.church)).unique())!,meeting:(await ctx.db.query("meetings").withIndex("by_church",q=>q.eq("churchId",ids.church)).unique())!}));
  await t.mutation(internal.meetingFanout.process,{meetingId:state.meeting._id,cursor:null});
  await expect(as(ids.outsider).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"respondMeeting",meetingId:state.meeting._id,response:"accepted"}})).rejects.toThrow("Workspace access");
  await as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"respondMeeting",meetingId:state.meeting._id,response:"accepted"}});
  expect((await t.run(ctx=>ctx.db.get("tasks",state.task._id)))?.complete).toBe(false);
 });

 test("revoked access blocks both reads and mutations",async()=>{
  const {ids,as}=await setup();await as(ids.owner).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"setMembership",personId:ids.volunteer,active:false,role:"member"}});
  await expect(as(ids.vol).query(api.workspace.dashboard,{churchId:ids.church})).rejects.toThrow("Workspace access");
  await expect(as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"setCoverOptIn",optedIn:true}})).rejects.toThrow("Workspace access");
 });

 test("simultaneous acceptance attempts produce one winner",async()=>{
  const {t,ids,as}=await setup();await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}});
  const req=await t.run(async ctx=>(await ctx.db.query("requests").withIndex("by_commitment",q=>q.eq("commitmentId",ids.slot)).unique())!);
  const args={churchId:ids.church,command:{type:"respondCover" as const,requestId:req._id,accept:true}};
  const results=await Promise.allSettled([as(ids.vol).mutation(api.workspace.execute,args),as(ids.vol).mutation(api.workspace.execute,args)]);
  expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
  expect((await t.run(ctx=>ctx.db.get("commitments",ids.slot)))?.version).toBe(2);
 });

 test("paginates more than 200 commitments without hiding later pages",async()=>{
  const {t,ids,as}=await setup();
  await t.run(async ctx=>{const source=(await ctx.db.get("commitments",ids.slot))!;for(let i=0;i<260;i++)await ctx.db.insert("commitments",{churchId:source.churchId,teamId:source.teamId,title:`Slot ${i}`,start:source.start+i*10000000,end:source.end+i*10000000,location:source.location,preparation:source.preparation,assigneeId:null,coordinatorId:source.coordinatorId,version:1});});
  const dashboard=await as(ids.coord).query(api.workspace.dashboard,{churchId:ids.church});expect(dashboard.truncated).toContain("commitments");
  let cursor:string|null=null;let count=0;let done=false;
  while(!done){const page:FunctionReturnType<typeof api.pages.commitmentsPage>=await as(ids.coord).query(api.pages.commitmentsPage,{churchId:ids.church,scope:"all",paginationOpts:{numItems:40,cursor}});count+=page.page.length;cursor=page.continueCursor;done=page.isDone;}
  expect(count).toBe(261);
 });

 test("meeting invitations fan out across more than 200 members",async()=>{
  vi.useFakeTimers();
  try {
   const {t,ids,as}=await setup();
   await t.run(async ctx=>{for(let i=0;i<205;i++){const userId=await ctx.db.insert("users",{});await ctx.db.insert("memberships",{churchId:ids.church,userId,name:`Member ${i}`,email:`member${i}@example.org`,role:"member",active:true,approved:false,coverOptIn:false});}});
   vi.advanceTimersByTime(1000); // the meeting is called after these members joined
   await as(ids.owner).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"createMeeting",title:"Gathering",start:"2099-11-23T09:00",end:"2099-11-23T10:00",location:"Hall"}});
   await t.finishAllScheduledFunctions(vi.runAllTimers);
   const result=await t.run(async ctx=>{const meeting=(await ctx.db.query("meetings").withIndex("by_church",q=>q.eq("churchId",ids.church)).unique())!;const invitees=await ctx.db.query("meetingInvitees").withIndex("by_meeting_member",q=>q.eq("meetingId",meeting._id)).collect();return {status:meeting.fanoutStatus,count:invitees.length};});
   expect(result).toEqual({status:"complete",count:208});
  } finally {vi.useRealTimers();}
 });

 test("revising an accepted commitment preserves history and requires a new acceptance",async()=>{
  const {t,ids,as}=await setup();await t.run(ctx=>ctx.db.patch("commitments",ids.slot,{assigneeId:ids.volunteer,version:2}));
  const command={type:"reviseCommitment" as const,commitmentId:ids.slot,expectedVersion:2,title:"Welcome updated",start:"2099-11-22T09:30",end:"2099-11-22T11:00",location:"New entrance",preparation:"Updated guide"};
  await expect(as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command})).rejects.toThrow("Team coordinator access");
  await expect(as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{...command,expectedVersion:1}})).rejects.toThrow("changed");
  await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command});
  const state=await t.run(async ctx=>({slot:await ctx.db.get("commitments",ids.slot),history:await ctx.db.query("commitmentHistory").withIndex("by_commitment",q=>q.eq("commitmentId",ids.slot)).collect()}));
  expect(state.slot).toMatchObject({assigneeId:null,version:3,location:"New entrance"});expect(state.history).toHaveLength(1);expect(state.history[0]).toMatchObject({action:"revised",assigneeId:ids.volunteer,version:2});
 });
 test("cancelling withdraws a pending request and keeps a visible cancelled record",async()=>{
  const {t,ids,as}=await setup();await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}});
  const req=await t.run(async ctx=>(await ctx.db.query("requests").withIndex("by_commitment",q=>q.eq("commitmentId",ids.slot)).unique())!);
  await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"cancelCommitment",commitmentId:ids.slot,expectedVersion:1}});
  expect((await t.run(ctx=>ctx.db.get("requests",req._id)))?.status).toBe("withdrawn");
  const data=await as(ids.coord).query(api.workspace.dashboard,{churchId:ids.church});expect(data.commitments.find(c=>c.id===ids.slot)?.status).toBe("cancelled");
  await expect(as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"respondCover",requestId:req._id,accept:true}})).rejects.toThrow("unavailable");
 });
 test("an unchanged edit preserves acceptance",async()=>{
  const {t,ids,as}=await setup();await t.run(ctx=>ctx.db.patch("commitments",ids.slot,{assigneeId:ids.volunteer,version:2}));const slot=(await t.run(ctx=>ctx.db.get("commitments",ids.slot)))!;
  await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"reviseCommitment",commitmentId:slot._id,expectedVersion:2,title:slot.title,start:new Date(slot.start).toISOString(),end:new Date(slot.end).toISOString(),location:slot.location,preparation:slot.preparation}});
  expect(await t.run(ctx=>ctx.db.get("commitments",slot._id))).toMatchObject({assigneeId:ids.volunteer,version:2});
 });

 test("a revised accepted cover is marked superseded",async()=>{
  const {t,ids,as}=await setup();await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"requestCover",commitmentId:ids.slot,recipientId:ids.volunteer,expectedVersion:1}});
  const req=(await t.run(ctx=>ctx.db.query("requests").withIndex("by_commitment",q=>q.eq("commitmentId",ids.slot)).unique()))!;
  await as(ids.vol).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"respondCover",requestId:req._id,accept:true}});
  await as(ids.coord).mutation(api.workspace.execute,{churchId:ids.church,command:{type:"reviseCommitment",commitmentId:ids.slot,expectedVersion:2,title:"New role",start:"2099-11-22T09:30",end:"2099-11-22T11:00",location:"Hall",preparation:"Guide"}});
  expect((await t.run(ctx=>ctx.db.get("requests",req._id)))?.status).toBe("superseded");
 });

});

test("asked from a time, commitments come soonest first and leave out what has ended", async () => {
  const { t, ids, as } = await setup();
  const hour = 3_600_000, from = Date.now();
  await t.run(async (ctx) => {
    const source = (await ctx.db.get("commitments", ids.slot))!;
    const { _id, _creationTime, ...slot } = source;
    void _id; void _creationTime;
    for (const [title, start] of [["Ended", from - 5 * hour], ["Later", from + 300 * hour], ["Soon", from + 2 * hour]] as const)
      await ctx.db.insert("commitments", { ...slot, title, start, end: start + hour, assigneeId: null });
  });
  const page = await as(ids.coord).query(api.pages.commitmentsPage, { churchId: ids.church, scope: "all", from, paginationOpts: { numItems: 30, cursor: null } });
  const titles = page.page.map((row) => row.title);
  expect(titles).not.toContain("Ended");
  expect(titles.indexOf("Soon")).toBeGreaterThanOrEqual(0);
  expect(titles.indexOf("Soon")).toBeLessThan(titles.indexOf("Later"));
  expect(page.page.map((row) => row.end)).toEqual([...page.page.map((row) => row.end)].sort((a, b) => a - b));
});

test("a person’s own yes needs no date on file, and only being away stops it", async () => {
  const { t, ids, as } = await setup();
  await as(ids.coord).mutation(api.workspace.execute, { churchId: ids.church, command: { type: "requestCover", commitmentId: ids.slot, recipientId: ids.volunteer, expectedVersion: 1 } });
  const { request, slot } = await t.run(async (ctx) => {
    for (const row of await ctx.db.query("availability").withIndex("by_member", (q) => q.eq("memberId", ids.volunteer)).collect()) await ctx.db.delete("availability", row._id);
    return { request: (await ctx.db.query("requests").withIndex("by_commitment", (q) => q.eq("commitmentId", ids.slot)).unique())!, slot: (await ctx.db.get("commitments", ids.slot))! };
  });
  const yes = { churchId: ids.church, command: { type: "respondCover" as const, requestId: request._id, accept: true } };
  const day = new Date(slot.start).toISOString().slice(0, 10);
  const away = await t.run((ctx) => ctx.db.insert("timeOff", { churchId: ids.church, memberId: ids.volunteer, start: day, end: day, note: "" }));
  await expect(as(ids.vol).mutation(api.workspace.execute, yes)).rejects.toThrow(refusals.away);
  await t.run((ctx) => ctx.db.delete("timeOff", away));
  await as(ids.vol).mutation(api.workspace.execute, yes);
  expect((await t.run((ctx) => ctx.db.get("commitments", ids.slot)))?.assigneeId).toBe(ids.volunteer);
});
