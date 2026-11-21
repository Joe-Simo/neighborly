import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// 4 AM Eastern in winter, 5 AM in summer: after the last evening visitor, before the first morning one.
crons.daily("refresh the sample conference", { hourUTC: 9, minuteUTC: 0 }, internal.demo.nightly);
// What the assistant was sent is kept 30 days at most (aiReads.KEEP_DAYS).
crons.daily("drop what the assistant was sent, after 30 days", { hourUTC: 9, minuteUTC: 30 }, internal.aiReads.dropOld);
// Monday 11:00 UTC: 6 AM Eastern in winter, 7 AM in summer, before the week starts.
crons.weekly("the week for deciders, by email", { dayOfWeek: "monday", hourUTC: 11, minuteUTC: 0 }, internal.digest.monday);
// Uploaded bytes no file row names, a day on: a refused or abandoned upload (files.sweep).
crons.daily("drop uploads that were never kept, after a day", { hourUTC: 10, minuteUTC: 0 }, internal.files.sweep, {});
// A council's stored years still marked stale, in case a recompute was lost (convex/rollups.ts).
crons.hourly("add up council years left stale", { minuteUTC: 15 }, internal.councils.recomputeDirty, {});
// The web form: requests never confirmed are gone after 24 hours; spent rate counters after two days.
crons.hourly("drop unconfirmed web requests", { minuteUTC: 15 }, internal.intake.sweep);
export default crons;
