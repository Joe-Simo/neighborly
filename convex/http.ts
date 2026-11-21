import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { resend } from "./notifications";
import { feed } from "./calendar";
import { preflight, read } from "./files";

const http = httpRouter();
http.route({ path: "/resend-webhook", method: "POST", handler: httpAction(async (ctx, request) => resend.handleResendEventWebhook(ctx, request)) });
// A member's private calendar feed: /calendar/<token>.ics. A wrong token gets a 404.
http.route({ pathPrefix: "/calendar/", method: "GET", handler: feed });
// An uploaded file, read with the caller's own sign-in on every request: /files/<id>. See files.ts.
http.route({ pathPrefix: "/files/", method: "GET", handler: read });
http.route({ pathPrefix: "/files/", method: "OPTIONS", handler: preflight });
export default http;
