"use client";

import { EmptyLine } from "@/components/workspace/help-line/room";
import { useRef, useState, type ChangeEvent } from "react";
import { useAction, useMutation } from "convex/react";
import { FileText } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { useQuery } from "@/components/workspace/query";
import { LiveLoading } from "@/components/workspace/primitives";
import { LiveFailure } from "@/components/workspace/states";
import { sayFailure } from "@/components/workspace/failure";
import { fill } from "@/lib/words/fill";
import { filesWords } from "@/components/workspace/tools/files-words";

/** Kept in step with convex/files.ts, which checks again: this only saves a wasted upload, and says why in these words. */
const MAX_BYTES = 10 * 1024 * 1024;
const MOST = 300;

/**
 * This person's Convex sign-in token, from the Clerk session already running on the page (the same token every
 * Convex call carries). Read from the page's Clerk rather than imported, so this chunk stays small.
 */
const signInToken = async () =>
  ((globalThis as { Clerk?: { session?: { getToken: (options: { template: string }) => Promise<string | null> } | null } }).Clerk?.session?.getToken({ template: "convex" })) ?? null;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.docx,.xlsx,application/pdf,image/jpeg,image/png,image/heic,image/heif";
const KINDS = /\.(pdf|jpe?g|png|heic|heif|docx|xlsx)$/i;

type Place = { neighborId?: undefined; opening?: undefined } | { neighborId: Id<"neighbors">; opening: Id<"auditEvents"> };

/**
 * Uploaded files, as ServWare keeps them: with no neighbor, the conference's own (minutes, forms) in Your files;
 * with a neighbor and the record's opening line, the files on that record. Loaded lazily by both rooms.
 */
export default function UploadedFiles(place: Place) {
  const { data, words, format } = useWorkspace();
  const text = filesWords(words.locale, words.terms);
  const churchId = data.church.id;
  const conference = useQuery(api.files.conference, place.neighborId ? "skip" : { churchId });
  const own = useQuery(api.files.neighbor, place.neighborId ? { churchId, neighborId: place.neighborId, opening: place.opening } : "skip");
  const rows = place.neighborId ? own : conference;
  const uploadUrl = useMutation(api.files.uploadUrl);
  const save = useAction(api.files.save);
  const remove = useMutation(api.files.remove);
  const picker = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<Id<"files"> | null>(null);
  const [said, setSaid] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const headingId = place.neighborId ? "neighbor-files-name" : "conference-files-name";

  const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

  const chosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!picked) return;
    setSaid("");
    setError("");
    if (picked.size > MAX_BYTES) return setError(text.tooBig);
    if ((rows?.length ?? 0) >= MOST) return setError(text.full);
    if (!KINDS.test(picked.name)) return setError(text.wrongKind);
    setBusy(true);
    try {
      const address = await uploadUrl({ churchId, neighborId: place.neighborId });
      const sent = await fetch(address, { method: "POST", headers: picked.type ? { "Content-Type": picked.type } : {}, body: picked });
      if (!sent.ok) throw new Error("upload");
      const { storageId } = (await sent.json()) as { storageId: Id<"_storage"> };
      await save({ churchId, neighborId: place.neighborId, storageId, name: picked.name });
      setSaid(text.added);
    } catch (cause) {
      setError(sayFailure(words.notices, cause, text.failed));
    } finally {
      setBusy(false);
    }
  };

  /**
   * A file is read through the checked route with this person's own sign-in token, never a lasting link: the tab
   * opens at once (so no popup blocker stops it) and shows the bytes once they have come.
   */
  const open = async (url: string) => {
    const tab = window.open("", "_blank");
    setError("");
    try {
      const token = await signInToken();
      const got = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!got.ok) throw new Error("read");
      const address = URL.createObjectURL(await got.blob());
      if (tab) tab.location.href = address;
      else window.location.assign(address);
      setTimeout(() => URL.revokeObjectURL(address), 60_000);
    } catch {
      tab?.close();
      setError(text.unread);
    }
  };

  const drop = async (id: Id<"files">) => {
    setBusy(true);
    setSaid("");
    setError("");
    try {
      await remove({ churchId, id });
      setSaid(text.removed);
      setRemoving(null);
    } catch (cause) {
      setError(sayFailure(words.notices, cause, text.failed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={place.neighborId ? "live-section" : "tools-leaf"} aria-labelledby={headingId}>
      <h2 id={headingId}>
        {!place.neighborId && <FileText size={18} aria-hidden="true" />} {place.neighborId ? text.neighborTitle : text.title}
      </h2>
      <p className="tools-leaf-deck">{place.neighborId ? text.neighborDeck : text.deck}</p>
      {error && <LiveFailure message={error} kept="" />}
      <p className="tools-small" role="status">{busy && !removing ? text.uploading : said}</p>
      {rows === undefined ? (
        <LiveLoading label={text.loading} />
      ) : rows.length === 0 ? (
        <EmptyLine line={text.empty} />
      ) : (
        <ul className="tools-files paper-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="tools-file">
                <Button type="button" variant="link" className="tools-file-open" onClick={() => void open(row.url)}>{row.name}</Button>
                <span>
                  {format(row.createdAt, { year: "numeric" })} · {size(row.size)}
                  {row.uploadedBy && <> · {fill(text.by, { name: row.uploadedBy })}</>}
                </span>
              </div>
              {removing === row.id ? (
                <div className="help-actions">
                  <span className="tools-small">{text.removeQuestion}</span>
                  <Button variant="outline" disabled={busy} onClick={() => void drop(row.id)}>{text.removeSure}</Button>
                  <Button variant="ghost" onClick={() => setRemoving(null)}>{text.keep}</Button>
                </div>
              ) : (
                <div className="help-actions">
                  <Button variant="ghost" aria-label={`${text.remove}: ${row.name}`} onClick={() => setRemoving(row.id)}>{text.remove}</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="tools-file-pick help-actions">
        <input ref={picker} id={`${headingId}-pick`} type="file" accept={ACCEPT} onChange={(event) => void chosen(event)} disabled={busy} />
        <Button type="button" variant="outline" disabled={busy} onClick={() => picker.current?.click()}>{text.choose}</Button>
        <span className="tools-small">{text.help}</span>
      </div>
    </section>
  );
}
