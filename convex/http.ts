import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { resend } from "./notifications";
import { feed } from "./calendar";

const http = httpRouter();
http.route({ path: "/resend-webhook", method: "POST", handler: httpAction(async (ctx, request) => resend.handleResendEventWebhook(ctx, request)) });
// A member's private calendar feed: /calendar/<token>.ics. A wrong token gets a 404.
http.route({ pathPrefix: "/calendar/", method: "GET", handler: feed });
export default http;
