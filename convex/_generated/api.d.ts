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
import type * as assistance from "../assistance.js";
import type * as auth from "../auth.js";
import type * as calendar from "../calendar.js";
import type * as drafts from "../drafts.js";
import type * as http from "../http.js";
import type * as importExport from "../importExport.js";
import type * as invitations from "../invitations.js";
import type * as language from "../language.js";
import type * as meetingFanout from "../meetingFanout.js";
import type * as neighbors from "../neighbors.js";
import type * as notificationEvents from "../notificationEvents.js";
import type * as notifications from "../notifications.js";
import type * as pages from "../pages.js";
import type * as reports from "../reports.js";
import type * as sampleData from "../sampleData.js";
import type * as treasury from "../treasury.js";
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
  assistance: typeof assistance;
  auth: typeof auth;
  calendar: typeof calendar;
  drafts: typeof drafts;
  http: typeof http;
  importExport: typeof importExport;
  invitations: typeof invitations;
  language: typeof language;
  meetingFanout: typeof meetingFanout;
  neighbors: typeof neighbors;
  notificationEvents: typeof notificationEvents;
  notifications: typeof notifications;
  pages: typeof pages;
  reports: typeof reports;
  sampleData: typeof sampleData;
  treasury: typeof treasury;
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
};
