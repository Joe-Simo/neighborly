import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// 4 AM Eastern in winter, 5 AM in summer: after the last evening visitor, before the first morning one.
crons.daily("refresh the sample conference", { hourUTC: 9, minuteUTC: 0 }, internal.demo.nightly);
export default crons;
