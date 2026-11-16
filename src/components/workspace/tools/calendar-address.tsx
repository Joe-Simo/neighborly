"use client";

import "./tools.css";
import { useState, useSyncExternalStore } from "react";
import { useAction } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { CalendarPlus, Check, Copy } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveFailure } from "@/components/workspace/states";
import { readFailure } from "@/components/workspace/failure";
import { useWorkspace } from "@/components/workspace/context";
import { LiveDialog } from "@/components/workspace/live-dialog";

type CalendarApp = "apple" | "google" | "outlook";
/** The calendar most likely already on this device: Apple's on an iPhone, iPad or Mac, Outlook on Windows, Google elsewhere. */
export function likelyCalendar(userAgent: string): CalendarApp {
  if (/iPhone|iPad|Macintosh/.test(userAgent)) return "apple";
  return /Windows/.test(userAgent) ? "outlook" : "google";
}
/** Each calendar app has its own way to follow an address; these open the right screen with it filled in, this device's own first. */
export function calendarLinks(address: string, first: CalendarApp) {
  const webcal = address.replace(/^https?:/, "webcal:");
  const links = [
    { app: "apple" as const, href: webcal },
    { app: "google" as const, href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` },
    { app: "outlook" as const, href: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(address)}` },
  ];
  return [...links.filter((link) => link.app === first), ...links.filter((link) => link.app !== first)];
}
const noChange = () => () => {};

export function CalendarAddressView({ address, busy, error, onCreate, titled = true }: { address: string | null; busy: boolean; error: string; onCreate: () => void; titled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const text = useWorkspace().words.calendar;
  const device = useSyncExternalStore(noChange, () => likelyCalendar(navigator.userAgent), () => "google" as const);
  return (
    <section>
      {titled && (
        <div className="live-section-head">
          <h2>{text.title}</h2>
        </div>
      )}
      <p className="live-deck">
        {text.deck}
      </p>
      {error && <LiveFailure message={error} kept="" />}
      {address ? (
        <div className="paper-rows">
          <div className="help-actions tools-after tools-calendars">
            {calendarLinks(address, device).map((link, index) => (
              <Button key={link.app} variant="outline" className={index === 0 ? "tools-first" : undefined} asChild>
                <a href={link.href} target="_blank" rel="noreferrer"><CalendarPlus size={18} aria-hidden="true" /> {text[link.app]}</a>
              </Button>
            ))}
          </div>
          <div className="tools-address paper-settle" key={address}>
            <Input readOnly aria-label={text.addressLabel} value={address} onFocus={(event) => event.currentTarget.select()} />
            <Button
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(address).then(() => setCopied(true))}
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? text.copied : text.copy}
            </Button>
          </div>
          <span className="sr-only" role="status">{copied ? text.copiedStatus : ""}</span>
          <p className="tools-small">
            {text.privacy}
          </p>
          <div className="help-actions tools-replace">
            <Button variant="outline" disabled={busy} onClick={() => setReplacing(true)}>{text.makeNew}</Button>
          </div>
          {replacing && (
            <LiveDialog title={text.makeNewTitle} description={text.makeNewDetail} onClose={() => setReplacing(false)}>
              <div className="live-form-actions">
                <Button disabled={busy} onClick={() => { setReplacing(false); setCopied(false); onCreate(); }}>{text.makeNew}</Button>
              </div>
            </LiveDialog>
          )}
        </div>
      ) : (
        <Button style={{ marginTop: 22 }} disabled={busy} onClick={onCreate}>
          <CalendarPlus size={16} aria-hidden="true" /> {text.get}
        </Button>
      )}
    </section>
  );
}

/** titled is false inside a dialog, where the dialog carries the heading. */
export function CalendarAddress({ titled = true }: { titled?: boolean }) {
  const { data, words } = useWorkspace();
  const address = useQuery(api.calendar.address, { churchId: data.church.id });
  const create = useAction(api.calendar.createAddress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (address === undefined)
    return (
      <div className="help-skeleton" role="status" aria-label={words.calendar.finding}>
        <div><i /><span><b /><b /></span></div>
      </div>
    );
  return (
    <CalendarAddressView
      // The site passes /calendar/ through to the feed, so the address a person sees and keeps is the site's own.
      address={address && `${window.location.origin}${new URL(address).pathname}`}
      titled={titled}
      busy={busy}
      error={error}
      onCreate={() => {
        setBusy(true);
        setError("");
        void create({ churchId: data.church.id })
          .catch((cause: unknown) => setError(readFailure(cause, words.calendar.failed, words.states.offlineSave)))
          .finally(() => setBusy(false));
      }}
    />
  );
}
