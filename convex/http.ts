import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { resend } from "./notifications";

const http = httpRouter();
http.route({ path: "/resend-webhook", method: "POST", handler: httpAction(async (ctx, request) => resend.handleResendEventWebhook(ctx, request)) });
export default http;
