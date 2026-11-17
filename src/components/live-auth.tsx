"use client";

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { takeSampleTicket } from "@/lib/sample-ticket";
import { useWaited } from "@/lib/use-waited";
import { useFocusBack } from "@/lib/use-focus-back";
import Link from "next/link";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { words } from "@/lib/words";
import { LiveField } from "@/components/workspace/primitives";
import { carryTheCard } from "@/components/workspace/door";
import { authWords, tabInReadersLanguage, useEntryLanguage, useJustLeft, type AuthError } from "./live-auth-words";
import { EntrySheet } from "./entry-sheet";

export type LiveEntryIntent = "start" | "join" | "signin";
type Flow = "signIn" | "signUp" | "reset";
/** What the emailed code is for: finishing a new account, a first sign-in on this device, or a new password. */
type Step = "details" | "code" | "newPassword";

function errorKey(error: unknown, flow: Flow): AuthError {
  const code = isClerkAPIResponseError(error) ? error.errors[0]?.code : undefined;
  switch (code) {
    case "form_param_format_invalid":
    case "form_identifier_invalid":
      return "email";
    case "form_identifier_exists":
      return "exists";
    case "form_identifier_not_found":
    case "invitation_account_not_exists":
      return "noAccount";
    case "form_password_incorrect":
    case "strategy_for_user_invalid":
      return "password";
    case "form_password_length_too_short":
      return "short";
    case "form_password_length_too_long":
      return "long";
    case "form_password_pwned":
    case "form_password_compromised":
      return flow === "signIn" ? "leakedSignIn" : "leaked";
    case "form_password_not_strong_enough":
      return "common";
    case "form_code_incorrect":
      return "code";
    case "verification_expired":
      return "expired";
    case "verification_failed":
    case "too_many_requests":
    case "user_locked":
      return "tooMany";
    default:
      return "other";
  }
}

export function LiveAuth({
  intent = "signin",
  sampleEntry = false,
  enterSample = false,
  badInvite = false,
  behind = false,
  onSampleRefused,
}: {
  intent?: LiveEntryIntent;
  /** The invitation link that led here is unknown, used or run out: the sheet says so, and is plain sign-in. */
  badInvite?: boolean;
  /** Shows the way into the sample conference. Off unless the deployment has a visitor account. */
  sampleEntry?: boolean;
  /** Arrived by the home page's sample door: the sample opens once, without a second press. */
  enterSample?: boolean;
  /** The sample's first room is already drawn (first-look.tsx): the way in runs as ever, and the sheet is not drawn. */
  behind?: boolean;
  /** The sample did not open, or is rationed: whoever drew a room over this sheet takes it away, and the notice is read. */
  onSampleRefused?: () => void;
}) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [flow, setFlow] = useState<Flow>(intent === "start" || intent === "join" ? "signUp" : "signIn");
  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [language] = useEntryLanguage();
  const w = authWords[language];
  /** "Fill this in." is the workspace's own sentence, read from the same book so the two never differ. */
  const { needed } = words(language).states;
  const [error, setError] = useState<AuthError | "">("");
  const [notice, setNotice] = useState(false);
  /** The server has said yes: the sheet's corner turns green while the workspace opens. */
  const [given, setGiven] = useState(false);
  const cameFromSignOut = useJustLeft();
  const [leftRead, setLeftRead] = useState(false);
  const left = cameFromSignOut && !leftRead;
  const [pending, setPending] = useState(false);
  /** On the way into the sample conference. The form rests, but keeps its own words. */
  const [opening, setOpening] = useState(false);
  /** Shown under the sample link, where the person pressed, not in the form's own error place. */
  const [sampleError, setSampleError] = useState<"sampleFailed" | "sampleBusy" | "">("");
  const [showPassword, setShowPassword] = useState(false);
  /** After a new code goes out, the button rests for a while so nobody sends five by pressing it again. */
  const [resent, setResent] = useState(false);
  const resting = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(resting.current), []);
  // The tab of the browser, and what a screen reader says on arrival, name this page and not the workspace
  // behind it. When the sheet leaves, the title it found is put back, so the room that opens is named as before.
  const pageTitle = `${flow === "signUp" ? w.create : w.signIn} · Kind Helps`;
  useEffect(() => {
    if (behind) return;
    const found = document.title;
    document.title = pageTitle;
    return () => {
      document.title = tabInReadersLanguage(found);
    };
  }, [pageTitle, behind]);

  const focus = useFocusBack();

  function choose(next: Flow) {
    // Another page is written on the sheet, and the pressed control goes with the old one.
    focus.note();
    focus.back();
    setFlow(next);
    setResent(false);
    setStep("details");
    setError("");
    setNotice(false);
    setLeftRead(true);
    setSampleError("");
    setShowPassword(false);
  }

  /** Each step of Clerk's flow reports its own error; the first one stops the run and is shown. */
  async function run(steps: () => Promise<void>) {
    setError("");
    setSampleError("");
    setNotice(false);
    setLeftRead(true);
    focus.note();
    setPending(true);
    try {
      await steps();
    } catch (failure) {
      setError(errorKey(failure, flow));
    } finally {
      setPending(false);
      focus.back();
    }
  }
  async function done(result: Promise<{ error: unknown }>) {
    const { error: failure } = await result;
    if (failure) throw failure;
  }
  /** The last step of every way in. The corner goes green first; it rests again if the step fails. */
  async function finish(finalize: () => Promise<{ error: unknown }>) {
    setGiven(true);
    try {
      await done(finalize());
    } catch (failure) {
      setGiven(false);
      throw failure;
    }
  }

  /** After the password is accepted: either the person is in, or Clerk wants a code emailed to a new device. */
  async function afterSignIn() {
    if (signIn.status === "complete") return finish(() => signIn.finalize());
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
        await finish(() => signUp.finalize());
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
    setNotice(false);
    setSampleError("");
    setLeftRead(true);
    focus.note();
    setOpening(true);
    // Behind a first look nothing sweeps, so there is no sweep to hand the card to.
    if (!behind) carryTheCard();
    try {
      const response = await takeSampleTicket();
      if (response.status === 429) {
        carryTheCard(false);
        onSampleRefused?.();
        return setSampleError("sampleBusy");
      }
      if (!response.ok) throw new Error("No ticket.");
      const { ticket }: { ticket: string } = await response.json();
      await done(signIn.ticket({ ticket }));
      if (signIn.status !== "complete") throw new Error("Not complete.");
      await finish(() => signIn.finalize());
    } catch {
      carryTheCard(false);
      onSampleRefused?.();
      setSampleError("sampleFailed");
    } finally {
      setOpening(false);
      focus.back();
    }
  }

  const openSample = useEffectEvent(() => void lookAround());
  const sampleAsked = useRef(false);
  useEffect(() => {
    if (!enterSample || !sampleEntry || sampleAsked.current) return;
    sampleAsked.current = true;
    openSample();
  }, [enterSample, sampleEntry]);

  function sendAgain() {
    void run(async () => {
      await done(
        flow === "signUp"
          ? signUp.verifications.sendEmailCode()
          : flow === "reset"
            ? signIn.resetPasswordEmailCode.sendCode()
            : signIn.mfa.sendEmailCode(),
      );
      setNotice(true);
      setResent(true);
      clearTimeout(resting.current);
      resting.current = setTimeout(() => setResent(false), 30_000);
    });
  }

  const kind = flow === "signUp" && intent !== "signin" ? intent : flow;
  const busy = pending || opening || given;
  /** The shared failure notice's look. LiveFailure itself reads the workspace's words, and nobody is in a workspace yet. */
  const failure = (message: string) => (
    <div role="alert" className="live-error live-failure" ref={(notice) => notice?.scrollIntoView({ block: "nearest" })}>
      <p>{message}</p>
    </div>
  );
  const messages = (
    <>
      {error && failure(w.errors[error])}
      {notice && (
        <div role="status" className="live-success paper-rise">
          {w.onItsWay}
        </div>
      )}
    </>
  );
  // A wait is said once it has lasted: until then the button rests as it was pressed. Then one line, with the ochre
  // ring that marks waiting everywhere else. Nothing turns and nothing pulses.
  const waits = useWaited(pending);
  const sampleWaits = useWaited(opening);
  const submitIcon = waits ? <i className="entry-waits" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />;
  const passwordField = (label: string, autoComplete: "current-password" | "new-password") => (
    <LiveField
      label={label}
      help={autoComplete === "new-password" ? w.passwordHint : undefined}
      said={{ needed, neededCheck: w.errors.short }}
    >
      <div className="live-password-control">
        <Input
          aria-label={label}
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete={autoComplete}
          required
          minLength={8}
          maxLength={72}
          disabled={busy}
        />
        <Button
          type="button"
          variant="ghost"
          aria-label={showPassword ? w.hidePassword : w.showPassword}
          aria-pressed={showPassword}
          disabled={busy}
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? w.hide : w.show}
        </Button>
      </div>
    </LiveField>
  );

  const page =
    step === "code" ? (
      <>
        <Button variant="link" className="live-back" disabled={busy} onClick={() => choose(flow)}>
          <ArrowLeft size={16} aria-hidden="true" /> {w.differentEmail}
        </Button>
        <p className="live-kicker">{w.codeKicker}</p>
        <h1>{w.codeHeading}</h1>
        <p className="live-deck entry-deck-kept">
          {w.codeSent} <strong>{email}</strong>. <span>{w.codeFor[flow]}</span>
        </p>
        <form className="live-form" onSubmit={submitCode}>
          <LiveField label={w.codeLabel} help={w.codeHint} said={{ needed, neededCheck: w.errors.code }}>
            <Input
              className="live-auth-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={12}
              required
              autoFocus
              aria-invalid={error === "code" || error === "expired" || undefined}
              disabled={busy}
            />
          </LiveField>
          {messages}
          <Button type="submit" disabled={busy}>
            {submitIcon}
            {waits ? w.wait : flow === "signUp" ? w.create : w.continue}
          </Button>
          <Button type="button" variant="link" className="entry-quiet" disabled={busy || resent} onClick={sendAgain}>
            {resent ? w.sentAgain : w.sendAgain}
          </Button>
        </form>
      </>
    ) : step === "newPassword" ? (
      <>
        <p className="live-kicker">{w.freshKicker}</p>
        <h1>{w.freshHeading}</h1>
        <p className="live-deck entry-deck-kept">
          {w.freshDeck} <strong>{email}</strong>.
        </p>
        <form className="live-form" onSubmit={submitNewPassword}>
          {passwordField(w.newPassword, "new-password")}
          {messages}
          <Button type="submit" disabled={busy}>
            {submitIcon}
            {waits ? w.wait : w.save}
          </Button>
        </form>
      </>
    ) : (
      <>
        {flow === "reset" ? (
          <Button variant="link" className="live-back" disabled={busy} onClick={() => choose("signIn")}>
            <ArrowLeft size={16} aria-hidden="true" /> {w.backToSignIn}
          </Button>
        ) : (
          <Link href="/" className="live-back">
            <ArrowLeft size={16} aria-hidden="true" /> {w.back}
          </Link>
        )}
        <p className="live-kicker">{w.kicker}</p>
        <h1>{w.heading[kind]}</h1>
        <p className="live-deck">{w.deck[kind]}</p>
        {left && (
          <div role="status" className="live-success paper-rise">
            {w.left}
          </div>
        )}
        {badInvite && failure(w.badInvite)}
        {flow !== "reset" && (
          <div className="entry-tabs" role="group" aria-label={w.options} data-flow={flow}>
            <Button variant="ghost" aria-label={`${w.signIn}: ${w.tabHint.signIn}`} aria-pressed={flow === "signIn"} disabled={busy} onClick={() => choose("signIn")}>
              {w.signIn}
            </Button>
            <Button variant="ghost" aria-label={`${w.create}: ${w.tabHint.create}`} aria-pressed={flow === "signUp"} disabled={busy} onClick={() => choose("signUp")}>
              {w.create}
            </Button>
          </div>
        )}
        <form className="live-form" onSubmit={submitDetails}>
          <LiveField label={w.email} said={{ needed, neededCheck: w.errors.email }}>
            <Input
              type="email"
              name="email"
              autoComplete="email"
              defaultValue={email}
              required
              maxLength={254}
              disabled={busy}
            />
          </LiveField>
          {flow !== "reset" && (
            <div className="entry-pass">
              {passwordField(w.password, flow === "signIn" ? "current-password" : "new-password")}
              {flow === "signIn" && (
                <Button type="button" variant="link" className="entry-quiet" disabled={busy} onClick={() => choose("reset")}>
                  {w.forgot}
                </Button>
              )}
            </div>
          )}
          {/* Where Clerk draws its human check when it asks for one at sign-up: on the sheet, above the button it holds
              back, and not in a window of Clerk's own over the page. Empty, and no taller than nothing, when it asks for none. */}
          {flow === "signUp" && <div id="clerk-captcha" data-cl-language={language} data-cl-theme="light" data-cl-size="flexible" />}
          {messages}
          <Button type="submit" disabled={busy}>
            {submitIcon}
            {waits ? w.wait : flow === "signIn" ? w.signIn : flow === "signUp" ? w.create : w.emailCode}
          </Button>
        </form>
        {sampleEntry && flow !== "reset" && (
          <div className="entry-sample" data-opening={sampleWaits || undefined}>
            <Button type="button" variant="link" disabled={busy} onClick={() => void lookAround()}>
              {sampleWaits && <i className="entry-waits" aria-hidden="true" />}
              {sampleWaits ? w.sampleOpening : w.sample}
              {!sampleWaits && <ArrowRight size={16} aria-hidden="true" />}
            </Button>
            {sampleError && failure(w[sampleError])}
            <small>{w.sampleNote}</small>
            <small className="entry-sample-short">{w.sampleNoteShort}</small>
          </div>
        )}
        {flow === "signUp" && <p className="entry-foot">{w.foot}</p>}
      </>
    );

  if (behind) return null;
  return (
    <EntrySheet
      page={`${flow}:${step}`}
      corner={given ? "given" : step !== "details" ? "waits" : "rest"}
      foot={<Link href={w.privacyPath}>{w.privacy}</Link>}
    >
      {page}
    </EntrySheet>
  );
}
