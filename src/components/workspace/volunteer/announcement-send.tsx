"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField } from "@/components/workspace/primitives";

/**
 * Where a new announcement goes: the home page only, or by email too. Its own chunk, words and all, so the shell's
 * first load does not carry it; until it arrives the form posts on the home page only.
 */
const en = { send: "Where it goes", homeOnly: "Post on the home page", alsoEmail: "Also email everyone", sendNote: "Email goes to every active, approved member, in their own language." };
const es: typeof en = { send: "Adónde va", homeOnly: "Publicar en la página de inicio", alsoEmail: "Enviarlo también por correo a todos", sendNote: "El correo va a cada miembro activo y aprobado, en su propio idioma." };

export default function AnnouncementSend() {
  const form = useWorkspace().words.locale === "es" ? es : en;
  return (
    <LiveField label={form.send} help={form.sendNote}>
      <NativeSelect name="send" defaultValue="home">
        <option value="home">{form.homeOnly}</option>
        <option value="email">{form.alsoEmail}</option>
      </NativeSelect>
    </LiveField>
  );
}
