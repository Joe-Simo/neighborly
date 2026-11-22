"use client";

import { useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveField } from "@/components/workspace/primitives";
import { LiveFailure } from "@/components/workspace/states";
import { sayFailure } from "@/components/workspace/failure";
import { useWorkspace } from "@/components/workspace/context";

/**
 * Editing or taking off one announcement, for its author or an owner. Its own chunk, words and all, so the week's
 * first load does not carry it. Removing asks first, says plainly that an email already sent stays sent, and leaves
 * an Undo on the saved line that puts it back.
 */
const en = {
  title: "Edit announcement",
  save: "Save changes",
  saving: "Saving…",
  saved: "Announcement saved.",
  remove: "Remove announcement",
  removeQuestion: "Take this announcement off the home page? If it was emailed, that email has already gone out and cannot be called back.",
  removeSure: "Yes, remove it",
  keep: "Keep it",
  removed: "Announcement removed.",
  putBack: "Announcement put back.",
  failed: "That could not be saved. Nothing changed; try again.",
};
const es: typeof en = {
  title: "Editar el anuncio",
  save: "Guardar cambios",
  saving: "Guardando…",
  saved: "Anuncio guardado.",
  remove: "Quitar el anuncio",
  removeQuestion: "¿Quitar este anuncio de la página de inicio? Si se envió por correo, ese correo ya salió y no se puede recuperar.",
  removeSure: "Sí, quitarlo",
  keep: "Dejarlo",
  removed: "Anuncio quitado.",
  putBack: "El anuncio volvió a su lugar.",
  failed: "No se pudo guardar. Nada cambió; inténtalo de nuevo.",
};

export default function AnnouncementChange({
  item,
  onClose,
}: {
  item: { id: Id<"announcements">; title: string; body: string };
  onClose: () => void;
}) {
  const { data, words, offerUndo } = useWorkspace();
  const text = words.locale === "es" ? es : en;
  const form = words.actions.announcementForm;
  const churchId = data.church.id;
  const edit = useMutation(api.announcements.edit);
  const remove = useMutation(api.announcements.remove);
  const restore = useMutation(api.announcements.restore);
  const [busy, setBusy] = useState(false);
  // A second press before busy has drawn sends nothing, as in the shell's perform.
  const working = useRef(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const run = async (work: () => Promise<unknown>) => {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      return true;
    } catch (problem) {
      setError(sayFailure(words.notices, problem, text.failed));
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const ok = await run(() => edit({ churchId, id: item.id, title: String(fields.get("title") ?? ""), body: String(fields.get("body") ?? "") }));
    if (ok) {
      offerUndo(text.saved, { run: () => edit({ churchId, id: item.id, title: item.title, body: item.body }), said: text.saved });
      onClose();
    }
  };

  const takeOff = async () => {
    if (!(await run(() => remove({ churchId, id: item.id })))) return;
    offerUndo(text.removed, { run: () => restore({ churchId, id: item.id }), said: text.putBack });
    onClose();
  };

  return (
    <LiveDialog title={text.title} onClose={onClose}>
      <form className="live-form" onSubmit={save}>
        <LiveField label={form.title}>
          <Input name="title" required maxLength={180} defaultValue={item.title} />
        </LiveField>
        <LiveField label={form.message}>
          <Textarea name="body" required rows={5} maxLength={5000} defaultValue={item.body} />
        </LiveField>
        {error && <LiveFailure message={error} />}
        <div className="live-form-actions">
          <Button type="submit" disabled={busy}>{busy ? text.saving : text.save}</Button>
        </div>
      </form>
      {asking ? (
        <div className="live-form" role="group" aria-label={text.remove}>
          <p>{text.removeQuestion}</p>
          <div className="live-form-actions">
            <Button variant="outline" disabled={busy} onClick={() => setAsking(false)}>{text.keep}</Button>
            <Button variant="outline" disabled={busy} onClick={() => void takeOff()}>{text.removeSure}</Button>
          </div>
        </div>
      ) : (
        <p>
          <Button variant="outline" disabled={busy} onClick={() => setAsking(true)}>{text.remove}</Button>
        </p>
      )}
    </LiveDialog>
  );
}
