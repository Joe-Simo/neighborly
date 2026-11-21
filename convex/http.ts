import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { resend } from "./notifications";
import { feed } from "./calendar";
import { preflight, read } from "./files";
import { confirm, partnerFinish, partnerStart, remove, resendCode, submit } from "./intakeHttp";

const http = httpRouter();
http.route({ path: "/resend-webhook", method: "POST", handler: httpAction(async (ctx, request) => resend.handleResendEventWebhook(ctx, request)) });
// A member's private calendar feed: /calendar/<token>.ics. A wrong token gets a 404.
http.route({ pathPrefix: "/calendar/", method: "GET", handler: feed });
// An uploaded file, read with the caller's own sign-in on every request: /files/<id>. See files.ts.
http.route({ pathPrefix: "/files/", method: "GET", handler: read });
http.route({ pathPrefix: "/files/", method: "OPTIONS", handler: preflight });
// The public "Ask for help" form, called by the site's own server (src/app/help, src/app/ayuda), never by a browser.
http.route({ path: "/intake/submit", method: "POST", handler: submit });
http.route({ path: "/intake/confirm", method: "POST", handler: confirm });
http.route({ path: "/intake/resend", method: "POST", handler: resendCode });
http.route({ path: "/intake/remove", method: "POST", handler: remove });
http.route({ path: "/intake/partner/start", method: "POST", handler: partnerStart });
http.route({ path: "/intake/partner/finish", method: "POST", handler: partnerFinish });
export default http;
