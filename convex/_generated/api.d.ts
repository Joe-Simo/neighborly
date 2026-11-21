/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as aiReads from "../aiReads.js";
import type * as announcementFanout from "../announcementFanout.js";
import type * as assistance from "../assistance.js";
import type * as calendar from "../calendar.js";
import type * as closing from "../closing.js";
import type * as counts from "../counts.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as digest from "../digest.js";
import type * as drafts from "../drafts.js";
import type * as duplicates from "../duplicates.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as importExport from "../importExport.js";
import type * as invitations from "../invitations.js";
import type * as knownNames from "../knownNames.js";
import type * as language from "../language.js";
import type * as meetingFanout from "../meetingFanout.js";
import type * as minutes from "../minutes.js";
import type * as nameKeys from "../nameKeys.js";
import type * as neighbors from "../neighbors.js";
import type * as notificationEvents from "../notificationEvents.js";
import type * as notifications from "../notifications.js";
import type * as pages from "../pages.js";
import type * as people from "../people.js";
import type * as quilt from "../quilt.js";
import type * as referralAgencies from "../referralAgencies.js";
import type * as reports from "../reports.js";
import type * as sampleData from "../sampleData.js";
import type * as spoken from "../spoken.js";
import type * as treasury from "../treasury.js";
import type * as undo from "../undo.js";
import type * as users from "../users.js";
import type * as visits from "../visits.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  aiReads: typeof aiReads;
  announcementFanout: typeof announcementFanout;
  assistance: typeof assistance;
  calendar: typeof calendar;
  closing: typeof closing;
  counts: typeof counts;
  crons: typeof crons;
  demo: typeof demo;
  digest: typeof digest;
  drafts: typeof drafts;
  duplicates: typeof duplicates;
  files: typeof files;
  http: typeof http;
  importExport: typeof importExport;
  invitations: typeof invitations;
  knownNames: typeof knownNames;
  language: typeof language;
  meetingFanout: typeof meetingFanout;
  minutes: typeof minutes;
  nameKeys: typeof nameKeys;
  neighbors: typeof neighbors;
  notificationEvents: typeof notificationEvents;
  notifications: typeof notifications;
  pages: typeof pages;
  people: typeof people;
  quilt: typeof quilt;
  referralAgencies: typeof referralAgencies;
  reports: typeof reports;
  sampleData: typeof sampleData;
  spoken: typeof spoken;
  treasury: typeof treasury;
  undo: typeof undo;
  users: typeof users;
  visits: typeof visits;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authEmail: import("@convex-dev/auth/components/email/_generated/component.js").ComponentApi<"authEmail">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
