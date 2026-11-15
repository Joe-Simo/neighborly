"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { CalendarPlus, Check, Copy } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";

/** Each calendar app has its own way to follow an address; these open the right screen with it filled in. */
export function calendarLinks(address: string) {
  const webcal = address.replace(/^https?:/, "webcal:");
  return [
    { label: "Add to Apple Calendar", href: webcal },
    { label: "Add to Google Calendar", href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` },
    { label: "Add to Outlook", href: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(address)}` },
  ];
}

export function CalendarAddressView({ address, busy, error, onCreate }: { address: string | null; busy: boolean; error: string; onCreate: () => void }) {
  const [copied, setCopied] = useState(false);
  const [replacing, setReplacing] = useState(false);
  return (
    <section>
      <div className="live-section-head">
        <h2>On your own calendar</h2>
      </div>
      <p className="live-deck">
        Your shifts and home visits can appear in the calendar already on your phone. Set it up once and it stays up to date by itself.
      </p>
      {error && <div className="live-error" role="alert"><p>{error}</p></div>}
      {address ? (
        <>
          <div className="help-actions tools-after">
            {calendarLinks(address).map((link) => (
              <Button key={link.label} variant="outline" asChild>
                <a href={link.href} target="_blank" rel="noreferrer"><CalendarPlus size={18} aria-hidden="true" /> {link.label}</a>
              </Button>
            ))}
          </div>
          <div className="tools-address">
            <Input readOnly aria-label="Your private calendar address" value={address} onFocus={(event) => event.currentTarget.select()} />
            <Button
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(address).then(() => setCopied(true))}
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? "Copied" : "Copy address"}
            </Button>
          </div>
          <span className="sr-only" role="status">{copied ? "Address copied." : ""}</span>
          <p className="tools-small">
            This address is yours alone; anyone who has it can see when and where you serve. A home visit shows the time and the street, never a neighbor’s name or need. If it reaches the wrong hands, make a new one and the old one stops working.
          </p>
          <div className="help-actions tools-replace">
            <Button variant="ghost" disabled={busy} onClick={() => setReplacing(true)}>Make a new address</Button>
          </div>
          <Dialog open={replacing} onOpenChange={setReplacing}>
            <DialogContent className="live-dialog">
              <DialogHeader>
                <DialogTitle>Make a new address?</DialogTitle>
                <DialogDescription>
                  The old address stops working straight away. You will need to add the new one to your calendar again.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReplacing(false)}>Keep this address</Button>
                <Button disabled={busy} onClick={() => { setReplacing(false); setCopied(false); onCreate(); }}>Make a new address</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Button style={{ marginTop: 22 }} disabled={busy} onClick={onCreate}>
          <CalendarPlus size={16} aria-hidden="true" /> Get my calendar address
        </Button>
      )}
    </section>
  );
}

export function CalendarAddress() {
  const { data } = useWorkspace();
  const address = useQuery(api.calendar.address, { churchId: data.church.id });
  const create = useAction(api.calendar.createAddress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (address === undefined)
    return (
      <div className="help-skeleton" role="status" aria-label="Finding your calendar">
        <div><i /><span><b /><b /></span></div>
      </div>
    );
  return (
    <CalendarAddressView
      address={address}
      busy={busy}
      error={error}
      onCreate={() => {
        setBusy(true);
        setError("");
        void create({ churchId: data.church.id })
          .catch(() => setError("Your calendar address could not be made. Nothing has changed; check your connection, then try again."))
          .finally(() => setBusy(false));
      }}
    />
  );
}
