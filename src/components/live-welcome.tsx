"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { sayFailure } from "@/components/workspace/failure";
import Link from "next/link";
import { dateFormatter, words, type Language } from "@/lib/words";
import { EntrySheet } from "./entry-sheet";
import { useWaited } from "@/lib/use-waited";
import { useFocusBack } from "@/lib/use-focus-back";
import { authWords, entryLanguageNow, giveTabBack, useEntryLanguage } from "./live-auth-words";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveField } from "@/components/workspace/primitives";

/**
 * A time zone as a person says it: "Eastern Time, New York". The browser knows the zone's name
 * in the reader's language; the city is the last part of the zone's own id. Where the browser
 * has no names in that language, the city stands alone and no English is mixed in.
 */
function zoneLabel(language: Language, zone: string): string {
  const city = zone.slice(zone.lastIndexOf("/") + 1).replaceAll("_", " ");
  if (!Intl.DateTimeFormat.supportedLocalesOf(language).length) return city;
  try {
    const name = dateFormatter(language === "es" ? "es-US" : "en-US", { timeZone: zone, timeZoneName: "longGeneric" })
      .formatToParts(0)
      .find((part) => part.type === "timeZoneName")?.value;
    if (!name || name.startsWith("GMT")) return city;
    return `${name.charAt(0).toLocaleUpperCase(language)}${name.slice(1)}, ${city}`;
  } catch {
    return city;
  }
}

export function LiveWelcome({
  createChurch,
  joinChurch,
  signOut,
  initialToken = "",
  conference = "",
  initialMode = "create",
  badInvite = false,
}: {
  /** The invitation link that led here is no longer good; said once, above the choice. */
  badInvite?: boolean;
  createChurch: (value: {
    name: string;
    timeZone: string;
    displayName: string;
  }) => Promise<void>;
  joinChurch: (value: { token: string; displayName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  initialToken?: string;
  /** The conference the invitation link leads to, when the backend has said. Shown as words, never as a link. */
  conference?: string;
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
  const [error, setError] = useState("");
  /** Someone who came by an invitation link has nothing to copy: the code rides along unseen. It is shown if joining is refused, so another can be pasted. */
  const [codeShown, setCodeShown] = useState(!initialToken);
  // The tab names this page, in the reader's language, as the sign-in sheet does. Nobody is in a workspace yet.
  // Said in the device's answer, not `w`: while a fresh load wakes, `language` is still the server's English.
  useEffect(() => {
    const found = document.title, said = words(entryLanguageNow()).welcome.first;
    const mine = `${mode === "create" ? said.start : said.invited} · Kind Helps`;
    document.title = mine;
    return () => giveTabBack(found, mine);
  }, [mode, language]);
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  /** Every zone the device knows, the device's own among them, each named in words. */
  const zones = useMemo(() => {
    const known = Intl.supportedValuesOf("timeZone");
    return (known.includes(timeZone) ? known : [timeZone, ...known]).map((zone) => ({ zone, label: zoneLabel(language, zone) }));
  }, [language, timeZone]);
  const focus = useFocusBack();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    focus.note();
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
        sayFailure(book.notices, cause, mode === "create" ? w.notSaved : w.notSavedJoin),
      );
      if (mode === "join") setCodeShown(true);
    } finally {
      setPending(false);
      focus.back();
    }
  }
  const busy = pending || given;
  const waits = useWaited(pending);
  return (
    <EntrySheet
      page={mode}
      corner={given ? "given" : "rest"}
      foot={
        <Button variant="link" disabled={busy} onClick={() => void signOut()}>
          {book.shell.signOut}
        </Button>
      }
    >
      <Link href="/" className="live-wordmark">
        kind helps
      </Link>
      <p className="live-kicker">{mode === "create" ? w.createKicker : w.joinKicker}</p>
      <h1>{mode === "create" ? w.createTitle : w.joinTitle}</h1>
      <p className="live-deck">
        {mode === "create" ? w.createDeck : conference && !codeShown ? <>{w.joinNamedBefore} <strong>{conference}</strong>{w.joinNamedAfter}</> : w.joinDeck}
      </p>
      {badInvite && (
        <div className="live-error live-failure" role="alert">
          <p>{authWords[language].badInvite}</p>
        </div>
      )}
      {/* Someone who came by a link came to join: the sheet is the invitation's page alone. If joining is refused,
          both ways to begin are offered. */}
      {codeShown && (
        <ToggleGroup
          type="single"
          value={mode}
          disabled={busy}
          onValueChange={(value) => {
            if (value !== "create" && value !== "join") return;
            setMode(value);
            setError("");
          }}
          className="entry-tabs entry-halves"
          aria-label={w.choose}
        >
          <ToggleGroupItem value="create">{w.start}</ToggleGroupItem>
          <ToggleGroupItem value="join">{w.invited}</ToggleGroupItem>
        </ToggleGroup>
      )}
      <form className="live-form" onSubmit={submit} aria-busy={pending}>
        <LiveField label={w.yourName} said={{ needed: w.addName }}>
          <Input name="displayName" autoComplete="name" required maxLength={100} disabled={busy} />
        </LiveField>
        {mode === "create" ? (
          <>
            <LiveField label={w.conferenceName} said={{ needed: w.addConferenceName }}>
              <Input name="name" required maxLength={120} disabled={busy} />
            </LiveField>
            <LiveField label={w.timeZone} said={{ neededChoice: book.states.neededChoice }}>
              <NativeSelect name="timeZone" defaultValue={timeZone} disabled={busy} required>
                {zones.map(({ zone, label }) => (
                  <option key={zone} value={zone}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </LiveField>
            <p className="entry-note">
              {w.what} {w.note}
            </p>
          </>
        ) : !codeShown ? (
          <>
            <input type="hidden" name="token" value={initialToken} />
            <p className="entry-note">{w.fromLink}</p>
          </>
        ) : (
          <LiveField
            label={w.code}
            help={w.codeHelp}
            said={{ needed: w.addCode }}
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
          </div>
        )}
        <Button type="submit" disabled={busy}>
          {waits ? <i className="entry-waits" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          {waits ? (mode === "create" ? w.creating : w.joining) : mode === "create" ? w.create : w.join}
        </Button>
        <span className="sr-only" role="status">
          {waits ? (mode === "create" ? w.creating : w.joining) : ""}
        </span>
      </form>
    </EntrySheet>
  );
}
