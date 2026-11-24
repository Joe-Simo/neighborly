"use client";

import "./tools.css";
import { useState, useSyncExternalStore } from "react";
import { useAction } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { CalendarPlus, CircleCheck, Copy, Share } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveFailure } from "@/components/workspace/states";
import { sayFailure } from "@/components/workspace/failure";
import { useWorkspace } from "@/components/workspace/context";
import { LiveLoading } from "@/components/workspace/primitives";
import { LiveDialog } from "@/components/workspace/live-dialog";

type CalendarApp = "apple" | "google" | "outlook";
/** The calendar most likely already on this device: Apple's on an iPhone, iPad or Mac, Outlook on Windows, Google elsewhere. */
function likelyCalendar(userAgent: string): CalendarApp {
  if (/iPhone|iPad|Macintosh/.test(userAgent)) return "apple";
  return /Windows/.test(userAgent) ? "outlook" : "google";
}
/** Each calendar app has its own way to follow an address; these open the right screen with it filled in, this device's own first. */
function calendarLinks(address: string, first: CalendarApp) {
  const webcal = address.replace(/^https?:/, "webcal:");
  const links = [
    { app: "apple" as const, href: webcal },
    { app: "google" as const, href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` },
    { app: "outlook" as const, href: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(address)}` },
  ];
  return [...links.filter((link) => link.app === first), ...links.filter((link) => link.app !== first)];
}
const noChange = () => () => {};

function CalendarAddressView({ address, busy, error, renewed, onCreate, titled = true }: { address: string | null; busy: boolean; error: string; renewed: boolean; onCreate: () => void; titled?: boolean }) {
  const [copied, setCopied] = useState(false);
  // A copy the device refuses is said, with how to copy the address by hand (the field selects itself when tapped).
  const [copyFailed, setCopyFailed] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const text = useWorkspace().words.calendar;
  const device = useSyncExternalStore(noChange, () => likelyCalendar(navigator.userAgent), () => "google" as const);
  const sharing = useSyncExternalStore(noChange, () => document.documentElement.dataset.shell === "ios" && typeof navigator.share === "function", () => false);
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
          {/* A replaced address says so where the new one is: the old one in the person's calendar no longer works. */}
          {renewed && (
            <p className="live-success tools-renewed" role="status">
              <CircleCheck size={18} aria-hidden="true" className="text-[var(--paper-green)]" /> {text.made}
            </p>
          )}
          <div className="help-actions tools-after tools-calendars">
            {calendarLinks(address, device).map((link, index) => (
              <Button key={link.app} variant="outline" className={index === 0 ? "tools-first" : undefined} asChild>
                <a href={link.href} target="_blank" rel="noreferrer"><CalendarPlus size={18} aria-hidden="true" /> {text[link.app]}</a>
              </Button>
            ))}
          </div>
          <div className="tools-address paper-settle" key={address}>
            <Input readOnly aria-label={text.addressLabel} value={address} onFocus={(event) => event.currentTarget.select()} />
            {sharing ? (
              // In the iOS app the address goes out through the system's share sheet: Messages, Mail, AirDrop, Copy.
              <Button variant="outline" onClick={() => void navigator.share({ title: text.addressLabel, url: address }).catch(() => {})}>
                <Share size={16} aria-hidden="true" /> {text.share}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setCopyFailed(false);
                  void Promise.resolve()
                    .then(() => navigator.clipboard.writeText(address))
                    .then(() => setCopied(true))
                    .catch(() => {
                      setCopied(false);
                      setCopyFailed(true);
                    });
                }}
              >
                {copied ? <CircleCheck size={16} aria-hidden="true" className="text-[var(--paper-green)]" /> : <Copy size={16} aria-hidden="true" />} {copied ? text.copied : text.copy}
              </Button>
            )}
          </div>
          <span className="sr-only" role="status">{copied ? text.copiedStatus : ""}</span>
          {copyFailed && <LiveFailure message={text.copyFailed} kept="" />}
          <p className="tools-small">
            {text.privacy}
          </p>
          <div className="help-actions tools-replace">
            <Button variant="outline" disabled={busy} onClick={() => setReplacing(true)}>{text.makeNew}</Button>
          </div>
          {replacing && (
            <LiveDialog title={text.makeNewTitle} description={text.makeNewDetail} onClose={() => setReplacing(false)}>
              <div className="live-form-actions">
                <Button variant="outline" onClick={() => setReplacing(false)}>{text.keep}</Button>
                <Button disabled={busy} onClick={() => { setReplacing(false); setCopied(false); setCopyFailed(false); onCreate(); }}>{text.makeNew}</Button>
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
  const [renewed, setRenewed] = useState(false);
  if (address === undefined)
    return (
      <LiveLoading label={words.calendar.finding} />
    );
  return (
    <CalendarAddressView
      // The site passes /calendar/ through to the feed, so the address a person sees and keeps is the site's own.
      address={address && `${window.location.origin}${new URL(address).pathname}`}
      titled={titled}
      busy={busy}
      error={error}
      renewed={renewed}
      onCreate={() => {
        setBusy(true);
        setError("");
        setRenewed(false);
        const replacing = Boolean(address);
        void create({ churchId: data.church.id })
          .then(() => setRenewed(replacing))
          .catch((cause: unknown) => setError(sayFailure(words.notices,cause, words.calendar.failed, words.calendar.offline)))
          .finally(() => setBusy(false));
      }}
    />
  );
}
