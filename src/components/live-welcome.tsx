"use client";

import { useState, type FormEvent } from "react";
import { readFailure } from "@/components/workspace/failure";
import Link from "next/link";
import { words } from "@/lib/words";
import { EntrySheet } from "./entry-sheet";
import { useEntryLanguage } from "./live-auth-words";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveField } from "@/components/workspace/primitives";

export function LiveWelcome({
  createChurch,
  joinChurch,
  signOut,
  initialToken = "",
  initialMode = "create",
}: {
  createChurch: (value: {
    name: string;
    timeZone: string;
    displayName: string;
  }) => Promise<void>;
  joinChurch: (value: { token: string; displayName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  initialToken?: string;
  initialMode?: "create" | "join";
}) {
  const [mode, setMode] = useState<"create" | "join">(
    initialToken ? "join" : initialMode,
  );
  const [pending, setPending] = useState(false);
  /** The conference is made or joined: the corner turns green while the workspace opens. */
  const [given, setGiven] = useState(false);
  const [language] = useEntryLanguage();
  const book = words(language);
  const w = book.welcome.first;
  const { needed } = book.states;
  const [error, setError] = useState("");
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const zones = Intl.supportedValuesOf("timeZone");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    try {
      if (mode === "create")
        await createChurch({
          name: value("name"),
          timeZone: value("timeZone"),
          displayName: value("displayName"),
        });
      else
        await joinChurch({
          token: value("token"),
          displayName: value("displayName"),
        });
      setGiven(true);
    } catch (cause) {
      setError(
        readFailure(cause, w.notSaved),
      );
    } finally {
      setPending(false);
    }
  }
  const busy = pending || given;
  return (
    <EntrySheet page={mode} corner={given ? "given" : "rest"}>
      <Link href="/" className="live-wordmark">
        kind helps
      </Link>
      <p className="live-kicker">{mode === "create" ? w.createKicker : w.joinKicker}</p>
      <h1>{mode === "create" ? w.createTitle : w.joinTitle}</h1>
      <p className="live-deck">
        {mode === "create" ? w.createDeck : w.joinDeck}
      </p>
      <ToggleGroup
        type="single"
        value={mode}
        disabled={busy}
        onValueChange={(value) => {
          if (value !== "create" && value !== "join") return;
          setMode(value);
          setError("");
        }}
        className="entry-tabs"
        aria-label={w.choose}
      >
        <ToggleGroupItem value="create">{w.start}</ToggleGroupItem>
        <ToggleGroupItem value="join">{w.invited}</ToggleGroupItem>
      </ToggleGroup>
      <form className="live-form" onSubmit={submit} aria-busy={pending}>
        <LiveField label={w.yourName} said={{ needed }}>
          <Input name="displayName" autoComplete="name" required maxLength={100} disabled={busy} />
        </LiveField>
        {mode === "create" ? (
          <>
            <LiveField label={w.conferenceName} said={{ needed }}>
              <Input name="name" required maxLength={120} disabled={busy} />
            </LiveField>
            <LiveField label={w.timeZone} help={w.timeZoneHelp} said={{ neededChoice: book.states.neededChoice }}>
              <NativeSelect name="timeZone" defaultValue={timeZone} disabled={busy} required>
                {!zones.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </option>
                ))}
              </NativeSelect>
            </LiveField>
            <p className="entry-note">
              {w.what} {w.note}
            </p>
          </>
        ) : (
          <LiveField
            label={w.code}
            help={w.codeHelp}
            said={{ needed }}
          >
            <Input name="token" defaultValue={initialToken} required maxLength={500} autoComplete="off" disabled={busy} />
          </LiveField>
        )}
        {error && (
          <div
            className="live-error live-failure"
            role="alert"
            ref={(notice) => notice?.scrollIntoView({ block: "nearest" })}
          >
            <p>{error}</p>
            <p className="live-error-recovery">{w.kept}</p>
          </div>
        )}
        <Button type="submit" disabled={busy}>
          {pending ? (
            <LoaderCircle size={17} aria-hidden="true" className="live-auth-spin" />
          ) : (
            <ArrowRight size={17} aria-hidden="true" />
          )}
          {pending ? (mode === "create" ? w.creating : w.joining) : mode === "create" ? w.create : w.join}
        </Button>
        <span className="sr-only" role="status">
          {pending ? (mode === "create" ? w.creating : w.joining) : ""}
        </span>
      </form>
      <Button variant="link" className="entry-quiet entry-leave" disabled={busy} onClick={() => void signOut()}>
        {book.shell.signOut}
      </Button>
    </EntrySheet>
  );
}
