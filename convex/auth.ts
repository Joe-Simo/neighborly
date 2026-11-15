import { components, internal } from "./_generated/api";
import { env } from "./_generated/server";
import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupEmailPassword } from "@convex-dev/auth/methods/email-password/server";
const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;
const site = env.SITE_URL ?? "http://localhost:3000";
export const { signUpWithEmailPassword, completeSignUpWithEmailPassword, signInWithEmailPassword, changePassword, startChangeEmail, completeChangeEmail, startPasswordRecovery, checkPasswordRecovery, completePasswordRecovery } = setupEmailPassword(auth, {
  component: components.authEmail,
  passwordComponent: components.authPassword,
  emailSender: { kind: "resend", sendEmail: components.resend.lib.sendEmail, apiKey: env.RESEND_API_KEY ?? "", from: env.SENDER_EMAIL ?? "" },
  urls: { signUp: `${site}/app/validate-email`, changeEmail: `${site}/app/confirm-email-change`, recovery: `${site}/app/reset-password` },
}).attachUserCallbacks({ createUser: internal.users.createUser });
