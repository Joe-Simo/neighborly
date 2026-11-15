"use client";

import { useState, type FormEvent, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import Link from "next/link";
import {
  useSignInWithEmailPassword,
  useSignUpWithEmailPassword,
  useStartPasswordRecovery,
  useCompleteSignUpWithEmailPassword,
  useCompletePasswordRecovery,
} from "@convex-dev/auth/methods/email-password/react";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AccountError = {
  error: string;
  retryAfterMs?: number;
  minimumLength?: number;
  maximumLength?: number;
};
function errorMessage(error: AccountError): string {
  switch (error.error) {
    case "INVALID_EMAIL":
      return "That email address doesn’t look right.";
    case "EMAIL_TAKEN":
      return "This email already has an account. Try signing in.";
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      return "We couldn’t sign you in. Check your email and password, and make sure you’ve validated your email.";
    case "PASSWORD_TOO_SHORT":
      return `Use at least ${error.minimumLength ?? 8} characters for your password.`;
    case "PASSWORD_TOO_LONG":
      return `Use no more than ${error.maximumLength ?? 128} characters for your password.`;
    case "PASSWORD_TOO_COMMON":
      return "Choose a less common password.";
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Your password can’t start or end with a space.";
    case "RATE_LIMITED":
      return `Too many attempts. Try again in ${Math.ceil((error.retryAfterMs ?? 60000) / 1000)} seconds.`;
    case "MISSING_SECRET":
      return "Open this link in the same browser where you started. If needed, request a new link from this browser.";
    case "INVALID_CHALLENGE":
    case "INCORRECT_CODE":
      return "This link is expired or has already been used. Please request a new one.";
    default:
      return "We couldn’t complete that request. Please try again. If email delivery has not been configured, account validation and recovery are unavailable.";
  }
}

export type { LiveEntryIntent } from "@/lib/live-entry";
import {
  saveEntryContext,
  restoreEntryContext,
  entryDestination,
  type LiveEntryIntent,
} from "@/lib/live-entry";

export function LiveAuth({
  intent = "signin",
  invitationToken = "",
}: {
  intent?: LiveEntryIntent;
  invitationToken?: string;
}) {
  const emailConfigured = useQuery(api.workspace.emailConfiguration, {});
  const login = useSignInWithEmailPassword(api.auth);
  const register = useSignUpWithEmailPassword(api.auth);
  const recovery = useStartPasswordRecovery(api.auth);
  const [flow, setFlow] = useState<"signIn" | "signUp" | "reset">(
    intent === "start" || intent === "join" ? "signUp" : "signIn",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const pending = login.pending || register.pending || recovery.pending;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    saveEntryContext({ intent, invitationToken });
    try {
      if (flow === "signIn") {
        const result = await login.signIn({ email, password });
        if (result.status !== "complete")
          setError(errorMessage(result.userError));
      } else if (flow === "signUp") {
        const result = await register.signUp({ email, password });
        if (result.success)
          setNotice(
            `Validation requested for ${email}. Open the email link in this browser to finish creating your account.`,
          );
        else setError(errorMessage(result.userError));
      } else {
        const result = await recovery.startPasswordRecovery({ email });
        if (result.success)
          setNotice(
            `Recovery requested for ${result.sentTo}. Open the link in this browser to choose a new password.`,
          );
        else setError(errorMessage(result.userError));
      }
    } catch {
      setError("We couldn’t reach the account service. Please try again.");
    }
  }
  return (
    <div className="live-auth">
      <div className="live-auth-art" aria-hidden="true" />
      <Link href="/" className="live-back">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Neighborly
      </Link>
      <p className="live-kicker">Your team’s place</p>
      <h1>
        {flow === "signIn"
          ? "Welcome back."
          : flow === "signUp"
            ? intent === "start"
              ? "Bring your people together."
              : intent === "join"
                ? "A place with your people."
                : "Good work starts here."
            : "Find your way back."}
      </h1>
      <p className="live-deck">
        {flow === "signIn"
          ? "Sign in to see what’s coming up and where you’re needed."
          : flow === "signUp"
            ? intent === "start"
              ? "Create your account, then make a private place for your group."
              : intent === "join"
                ? "Create your account to join your group with an invitation."
                : "Create your account to start a group or accept an invitation."
            : "Request a secure link to reset your password."}
      </p>
      <div className="live-auth-tabs" role="group" aria-label="Account options">
        <Button
          variant={flow === "signIn" ? "default" : "ghost"}
          aria-pressed={flow === "signIn"}
          onClick={() => {
            setFlow("signIn");
            setError("");
            setNotice("");
            setShowPassword(false);
          }}
        >
          Sign in
        </Button>
        <Button
          variant={flow === "signUp" ? "default" : "ghost"}
          aria-pressed={flow === "signUp"}
          onClick={() => {
            setFlow("signUp");
            setError("");
            setNotice("");
            setShowPassword(false);
          }}
        >
          Create account
        </Button>
      </div>
      {flow !== "signIn" && emailConfigured === false && (
        <div className="live-note live-auth-availability" role="status">
          {flow === "reset"
            ? "Password recovery is currently unavailable. Try again later."
            : "Account creation is currently unavailable. Existing members can sign in."}
        </div>
      )}
      <form className="live-form" onSubmit={submit}>
        <label className="live-field">
          <span>Email</span>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={pending}
          />
        </label>
        {flow !== "reset" && (
          <label className="live-field">
            <span>Password</span>
            <div className="live-password-control">
              <Input
                aria-label="Password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete={
                  flow === "signIn" ? "current-password" : "new-password"
                }
                required
                minLength={8}
                maxLength={128}
                disabled={pending}
              />
              <Button
                type="button"
                variant="ghost"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={pending}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
            {flow === "signUp" && <small>Use at least 8 characters.</small>}
          </label>
        )}
        {error && (
          <div role="alert" className="live-error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="live-success">
            {notice}
          </div>
        )}
        <Button
          type="submit"
          disabled={pending || (flow !== "signIn" && !emailConfigured)}
        >
          {pending ? (
            <LoaderCircle size={17} aria-hidden="true" />
          ) : (
            <ArrowRight size={17} aria-hidden="true" />
          )}
          {pending
            ? "Please wait…"
            : flow === "signIn"
              ? "Sign in"
              : flow === "signUp"
                ? "Create account"
                : "Request reset link"}
        </Button>
        {flow === "signIn" && (
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setFlow("reset");
              setError("");
              setNotice("");
            }}
          >
            Forgot your password?
          </Button>
        )}
      </form>
      <p className="live-auth-foot">
        Your workspace is private. Joining a team does not accept any commitment
        on your behalf.
      </p>
    </div>
  );
}

export function LiveValidateEmail({ code }: { code: string }) {
  const state = useCompleteSignUpWithEmailPassword(api.auth, {
    emailCode: code,
  });
  return (
    <div className="live-auth">
      <div className="live-auth-art" aria-hidden="true" />
      <h1>
        {state.status === "loading"
          ? "Validating your email…"
          : state.status === "complete"
            ? "You’re ready."
            : "Let’s try that again."}
      </h1>
      {state.status === "error" && (
        <p className="live-error" role="alert">
          {errorMessage(state.userError)}
        </p>
      )}
      {state.status === "complete" && (
        <p className="live-deck">
          Your email is validated and you’re signed in.
        </p>
      )}
      <Button asChild style={{ marginTop: 25 }}>
        <WorkspaceEntryLink>Open your workspace</WorkspaceEntryLink>
      </Button>
    </div>
  );
}

export function LiveResetPassword({ code }: { code: string }) {
  const state = useCompletePasswordRecovery(api.auth, { emailCode: code });
  const [error, setError] = useState("");
  if (state.status === "loading")
    return (
      <div className="live-auth">
        <div className="live-auth-art" aria-hidden="true" />
        <h1>Checking your link…</h1>
      </div>
    );
  if (state.status === "error")
    return (
      <div className="live-auth">
        <div className="live-auth-art" aria-hidden="true" />
        <h1>Let’s try that again.</h1>
        <p className="live-error">{errorMessage(state.userError)}</p>
        <Link className="live-link" href="/app">
          Return to sign in
        </Link>
      </div>
    );
  if (state.status === "complete")
    return (
      <div className="live-auth">
        <div className="live-auth-art" aria-hidden="true" />
        <h1>Password updated.</h1>
        <Button asChild>
          <WorkspaceEntryLink>Open your workspace</WorkspaceEntryLink>
        </Button>
      </div>
    );
  return (
    <div className="live-auth">
      <div className="live-auth-art" aria-hidden="true" />
      <h1>A fresh start.</h1>
      <form
        className="live-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const result = await state.completePasswordRecovery({
            newPassword: String(
              new FormData(event.currentTarget).get("password") ?? "",
            ),
          });
          if (result.status !== "complete")
            setError(errorMessage(result.userError));
        }}
      >
        <label className="live-field">
          <span>New password</span>
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            disabled={state.pending}
            required
            minLength={8}
            maxLength={128}
          />
        </label>
        {error && (
          <div role="alert" className="live-error">
            {error}
          </div>
        )}
        <Button type="submit" disabled={state.pending}>
          {state.pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}

function WorkspaceEntryLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  const router = useRouter();
  return (
    <Link
      {...props}
      href="/app"
      onClick={(event) => {
        const destination = entryDestination(restoreEntryContext());
        if (destination !== "/app") {
          event.preventDefault();
          router.push(destination);
        }
      }}
    >
      Open your workspace
    </Link>
  );
}
