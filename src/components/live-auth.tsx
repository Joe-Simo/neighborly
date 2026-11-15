"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./live-auth.css";

export type LiveEntryIntent = "start" | "join" | "signin";
type Flow = "signIn" | "signUp" | "reset";
/** What the emailed code is for: finishing a new account, a first sign-in on this device, or a new password. */
type Step = "details" | "code" | "newPassword";

function errorMessage(error: unknown, flow: Flow): string {
  const code = isClerkAPIResponseError(error) ? error.errors[0]?.code : undefined;
  switch (code) {
    case "form_param_format_invalid":
    case "form_identifier_invalid":
      return "That email address doesn’t look right.";
    case "form_identifier_exists":
      return "This email already has an account. Choose Sign in.";
    case "form_identifier_not_found":
    case "invitation_account_not_exists":
      return "No account uses that email yet. Choose Create account. If you were here before, use the same email and your groups will be waiting.";
    case "form_password_incorrect":
    case "strategy_for_user_invalid":
      return "That password doesn’t match. Try again, or choose Forgot your password.";
    case "form_password_length_too_short":
      return "Use at least 8 characters for your password.";
    case "form_password_length_too_long":
      return "Use no more than 72 characters for your password.";
    case "form_password_pwned":
    case "form_password_compromised":
      return flow === "signIn"
        ? "This password has appeared in a data leak on another site. Choose Forgot your password to set a new one."
        : "That password has appeared in a data leak on another site. Please choose a different one.";
    case "form_password_not_strong_enough":
      return "Choose a less common password.";
    case "form_code_incorrect":
      return "That code doesn’t match. Check the email and try again, or send a new code.";
    case "verification_expired":
      return "That code has expired. Send a new one.";
    case "verification_failed":
    case "too_many_requests":
    case "user_locked":
      return "Too many attempts. Wait a little while, then try again.";
    default:
      return "We couldn’t complete that. Please try again.";
  }
}

const headings: Record<Flow, string> = {
  signIn: "Welcome back.",
  signUp: "Good work starts here.",
  reset: "Find your way back.",
};

export function LiveAuth({
  intent = "signin",
  sampleEntry = false,
}: {
  intent?: LiveEntryIntent;
  /** Shows the way into the sample conference. Off unless the deployment has a visitor account. */
  sampleEntry?: boolean;
}) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [flow, setFlow] = useState<Flow>(intent === "start" || intent === "join" ? "signUp" : "signIn");
  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  /** On the way into the sample conference. The form rests, but keeps its own words. */
  const [opening, setOpening] = useState(false);
  /** Shown under the sample link, where the person pressed, not in the form's own error place. */
  const [sampleError, setSampleError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  /** After a new code goes out, the button rests for a while so nobody sends five by pressing it again. */
  const [resent, setResent] = useState(false);
  const resting = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(resting.current), []);

  function choose(next: Flow) {
    setFlow(next);
    setResent(false);
    setStep("details");
    setError("");
    setNotice("");
    setSampleError("");
    setShowPassword(false);
  }

  /** Each step of Clerk's flow reports its own error; the first one stops the run and is shown. */
  async function run(steps: () => Promise<void>) {
    setError("");
    setSampleError("");
    setNotice("");
    setPending(true);
    try {
      await steps();
    } catch (failure) {
      setError(errorMessage(failure, flow));
    } finally {
      setPending(false);
    }
  }
  async function done(result: Promise<{ error: unknown }>) {
    const { error: failure } = await result;
    if (failure) throw failure;
  }

  /** After the password is accepted: either the person is in, or Clerk wants a code emailed to a new device. */
  async function afterSignIn() {
    if (signIn.status === "complete") return done(signIn.finalize());
    if (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") {
      await done(signIn.mfa.sendEmailCode());
      setStep("code");
      return;
    }
    if (signIn.status === "needs_new_password") {
      setStep("newPassword");
      return;
    }
    throw new Error("Sign-in could not be completed.");
  }

  function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emailAddress = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setEmail(emailAddress);
    void run(async () => {
      if (flow === "signIn") {
        await done(signIn.password({ emailAddress, password }));
        await afterSignIn();
      } else if (flow === "signUp") {
        await done(signUp.password({ emailAddress, password }));
        await done(signUp.verifications.sendEmailCode());
        setStep("code");
      } else {
        await done(signIn.create({ identifier: emailAddress }));
        await done(signIn.resetPasswordEmailCode.sendCode());
        setStep("code");
      }
    });
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\D/g, "");
    void run(async () => {
      if (flow === "signUp") {
        await done(signUp.verifications.verifyEmailCode({ code }));
        if (signUp.status !== "complete") throw new Error("Sign-up could not be completed.");
        await done(signUp.finalize());
      } else if (flow === "reset") {
        await done(signIn.resetPasswordEmailCode.verifyCode({ code }));
        setStep("newPassword");
      } else {
        await done(signIn.mfa.verifyEmailCode({ code }));
        await afterSignIn();
      }
    });
  }

  function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    void run(async () => {
      await done(signIn.resetPasswordEmailCode.submitPassword({ password }));
      await afterSignIn();
    });
  }

  /** The server hands over a one-minute ticket for the made-up visitor account; Clerk trades it for a session. */
  async function lookAround() {
    setError("");
    setNotice("");
    setSampleError("");
    setOpening(true);
    try {
      const response = await fetch("/app/look-around", { method: "POST" });
      if (response.status === 429) return setSampleError("The sample conference is busy. Try again in a minute.");
      if (!response.ok) throw new Error("No ticket.");
      const { ticket }: { ticket: string } = await response.json();
      await done(signIn.ticket({ ticket }));
      if (signIn.status !== "complete") throw new Error("Not complete.");
      await done(signIn.finalize());
    } catch {
      setSampleError("The sample conference did not open. Try again.");
    } finally {
      setOpening(false);
    }
  }

  function sendAgain() {
    void run(async () => {
      await done(
        flow === "signUp"
          ? signUp.verifications.sendEmailCode()
          : flow === "reset"
            ? signIn.resetPasswordEmailCode.sendCode()
            : signIn.mfa.sendEmailCode(),
      );
      setNotice("A new code is on its way.");
      setResent(true);
      clearTimeout(resting.current);
      resting.current = setTimeout(() => setResent(false), 30_000);
    });
  }

  const messages = (
    <>
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
    </>
  );
  const submitIcon = pending ? (
    <LoaderCircle size={17} aria-hidden="true" className="live-auth-spin" />
  ) : (
    <ArrowRight size={17} aria-hidden="true" />
  );
  const passwordField = (label: string, autoComplete: "current-password" | "new-password") => (
    <label className="live-field">
      <span>{label}</span>
      <div className="live-password-control">
        <Input
          aria-label={label}
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete={autoComplete}
          required
          minLength={8}
          maxLength={72}
          disabled={pending || opening}
        />
        <Button
          type="button"
          variant="ghost"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          disabled={pending || opening}
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? "Hide" : "Show"}
        </Button>
      </div>
      {autoComplete === "new-password" && <small>Use at least 8 characters.</small>}
    </label>
  );

  if (step === "code")
    return (
      <div className="live-auth">
        <div className="live-auth-art" aria-hidden="true" />
        <Button variant="link" className="live-back" onClick={() => choose(flow)}>
          <ArrowLeft size={16} aria-hidden="true" /> Use a different email
        </Button>
        <p className="live-kicker">One more step</p>
        <h1>Check your email.</h1>
        <p className="live-deck">
          We sent a six-digit code to <strong>{email}</strong>.{" "}
          {flow === "signUp"
            ? "Enter it to finish creating your account."
            : flow === "reset"
              ? "Enter it to choose a new password."
              : "Enter it to finish signing in on this device."}
        </p>
        <form className="live-form" onSubmit={submitCode}>
          <label className="live-field">
            <span>Code from the email</span>
            <Input
              className="live-auth-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={12}
              required
              autoFocus
              disabled={pending}
            />
            <small>It can take a minute to arrive. Look in spam if you don’t see it.</small>
          </label>
          {messages}
          <Button type="submit" disabled={pending}>
            {submitIcon}
            {pending ? "Please wait…" : flow === "signUp" ? "Create account" : "Continue"}
          </Button>
          <Button type="button" variant="link" disabled={pending || resent} onClick={sendAgain}>
            {resent ? "New code sent" : "Send a new code"}
          </Button>
        </form>
      </div>
    );

  if (step === "newPassword")
    return (
      <div className="live-auth">
        <div className="live-auth-art" aria-hidden="true" />
        <p className="live-kicker">Almost there</p>
        <h1>A fresh start.</h1>
        <p className="live-deck">Choose a new password for {email}.</p>
        <form className="live-form" onSubmit={submitNewPassword}>
          {passwordField("New password", "new-password")}
          {messages}
          <Button type="submit" disabled={pending}>
            {submitIcon}
            {pending ? "Please wait…" : "Save and sign in"}
          </Button>
        </form>
      </div>
    );

  return (
    <div className="live-auth">
      <div className="live-auth-art" aria-hidden="true" />
      <Link href="/" className="live-back">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Kind Helps
      </Link>
      <p className="live-kicker">Your team’s place</p>
      <h1>
        {flow === "signUp" && intent === "start"
          ? "Bring your people together."
          : flow === "signUp" && intent === "join"
            ? "A place with your people."
            : headings[flow]}
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
            : "We’ll email you a code to choose a new password."}
      </p>
      <div className="live-auth-tabs" role="group" aria-label="Account options">
        <Button
          variant={flow === "signIn" ? "default" : "ghost"}
          aria-pressed={flow === "signIn"}
          onClick={() => choose("signIn")}
        >
          Sign in
        </Button>
        <Button
          variant={flow === "signUp" ? "default" : "ghost"}
          aria-pressed={flow === "signUp"}
          onClick={() => choose("signUp")}
        >
          Create account
        </Button>
      </div>
      <form className="live-form" onSubmit={submitDetails}>
        <label className="live-field">
          <span>Email</span>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            defaultValue={email}
            required
            maxLength={254}
            disabled={pending || opening}
          />
        </label>
        {flow !== "reset" &&
          passwordField("Password", flow === "signIn" ? "current-password" : "new-password")}
        {messages}
        <Button type="submit" disabled={pending || opening}>
          {submitIcon}
          {pending
            ? "Please wait…"
            : flow === "signIn"
              ? "Sign in"
              : flow === "signUp"
                ? "Create account"
                : "Email me a code"}
        </Button>
        {flow === "signIn" && (
          <Button type="button" variant="link" disabled={opening} onClick={() => choose("reset")}>
            Forgot your password?
          </Button>
        )}
      </form>
      {sampleEntry && (
        <div className="live-auth-sample">
          <Button type="button" variant="link" disabled={pending || opening} onClick={() => void lookAround()}>
            {opening ? "Opening the sample conference…" : "Look around a sample conference"}
          </Button>
          {sampleError && (
            <div role="alert" className="live-error" ref={(alert) => alert?.scrollIntoView({ block: "nearest" })}>
              {sampleError}
            </div>
          )}
          <small>Made-up people. Whatever you change is cleared each night.</small>
        </div>
      )}
      <p className="live-auth-foot">
        Your workspace is private. Joining a team does not accept any commitment
        on your behalf.
      </p>
    </div>
  );
}
