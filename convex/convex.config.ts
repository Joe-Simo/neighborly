import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config.js";
import authPassword from "@convex-dev/auth/components/password/convex.config.js";
import authEmail from "@convex-dev/auth/components/email/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp({ env: { RESEND_API_KEY: v.optional(v.string()), SENDER_EMAIL: v.optional(v.string()), SITE_URL: v.optional(v.string()), TYPESAFE_API_KEY: v.optional(v.string()) } });
app.use(auth);
app.use(authPassword);
app.use(authEmail);
app.use(resend);
app.use(rateLimiter);
export default app;
