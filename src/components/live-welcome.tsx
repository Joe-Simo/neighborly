"use client";

import { useState, type FormEvent } from "react";
import { readFailure } from "@/components/workspace/failure";
import Link from "next/link";
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
    } catch (cause) {
      setError(
        readFailure(cause, "We couldn’t save that. Please try again."),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="live-auth live-welcome">
      <div className="live-auth-art" aria-hidden="true" />
      <Link href="/" className="live-wordmark">
        kind helps
      </Link>
      <p className="live-kicker">
        {mode === "create" ? "A small beginning" : "An invitation to belong"}
      </p>
      <h1>{mode === "create" ? "Make room for your people." : "Your people are here."}</h1>
      <p className="live-deck">
        {mode === "create"
          ? "Give your group a private place to organize its people, plans and acts of care."
          : "Use your invitation to join your group. You’ll choose the commitments you accept."}
      </p>
      <ToggleGroup
        type="single"
        value={mode}
        disabled={pending}
        onValueChange={(value) => {
          if (value !== "create" && value !== "join") return;
          setMode(value);
          setError("");
        }}
        className="live-welcome-modes"
        aria-label="Choose how to begin"
      >
        <ToggleGroupItem value="create">Start a group</ToggleGroupItem>
        <ToggleGroupItem value="join">I have an invitation</ToggleGroupItem>
      </ToggleGroup>
      <form className="live-form" onSubmit={submit} aria-busy={pending}>
        <LiveField label="Your name">
          <Input
            name="displayName"
            autoComplete="name"
            required
            maxLength={100}
            disabled={pending}
          />
        </LiveField>
        {mode === "create" ? (
          <>
            <LiveField label="Group or organization name">
              <Input name="name" required maxLength={120} disabled={pending} />
            </LiveField>
            <LiveField
              label="Group time zone"
              help="Commitments and meeting times use this time zone."
            >
              <NativeSelect
                name="timeZone"
                defaultValue={timeZone}
                disabled={pending}
                required
              >
                {!zones.includes(timeZone) && (
                  <option value={timeZone}>{timeZone}</option>
                )}
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </option>
                ))}
              </NativeSelect>
            </LiveField>
            <div className="live-note">
              Only invited members can access your group. You can add teams and
              invite people after creating it.
            </div>
          </>
        ) : (
          <LiveField
            label="Invitation code"
            help="Use the code supplied by your coordinator. Joining does not accept a commitment."
          >
            <Input
              name="token"
              defaultValue={initialToken}
              required
              maxLength={500}
              autoComplete="off"
              disabled={pending}
            />
          </LiveField>
        )}
        {error && (
          <div className="live-error" role="alert">
            <p>{error}</p>
            <p className="live-error-recovery">Your entries are still here. Check the details and try again.</p>
          </div>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}{" "}
          {pending
            ? mode === "create" ? "Creating your group…" : "Joining your group…"
            : mode === "create"
              ? "Create group workspace"
              : "Join group"}
        </Button>
        <span className="sr-only" role="status">{pending ? mode === "create" ? "Creating your group." : "Joining your group." : ""}</span>
      </form>
      <Button
        variant="link"
        className="live-welcome-signout"
        disabled={pending}
        onClick={() => void signOut()}
      >
        Sign out
      </Button>
    </main>
  );
}
