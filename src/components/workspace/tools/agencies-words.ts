import type { Language, Terms } from "@/lib/words/sets";

/**
 * The referral agencies list's words, kept with its own chunk rather than the shared words book, so no room's
 * first load carries them. Every sentence is written whole in each language.
 */
const en = (t: Terms) => ({
  title: "Agencies you refer to",
  deck: `The local places your ${t.group} sends neighbors to for help it does not give itself. The help line offers them by name when a request is decided.`,
  empty: "No agencies yet. Add the first one below, or name one on a request and it is kept here.",
  loading: "Gathering your agencies",
  name: "Name",
  phone: "Phone",
  helpsWith: "Helps with",
  add: "Add agency",
  save: "Save changes",
  cancel: "Cancel",
  edit: "Edit",
  remove: "Remove",
  removeSure: "Yes, remove it",
  keep: "Keep it",
  removeQuestion: "Take this agency off the list? Requests that named it keep the name.",
  added: "Agency added.",
  saved: "Agency saved.",
  removed: "Agency removed.",
  failed: "That could not be saved. Nothing changed; try again.",
  taken: "That agency is already on the list.",
});

const es = (t: Terms): ReturnType<typeof en> => ({
  title: "Agencias a las que refieres",
  deck: `Los lugares de tu zona a los que tu ${t.group} envía a los vecinos por la ayuda que no da por sí misma. La línea de ayuda los ofrece por nombre cuando se decide una solicitud.`,
  empty: "Todavía no hay agencias. Agrega la primera abajo, o nombra una en una solicitud y se guarda aquí.",
  loading: "Reuniendo tus agencias",
  name: "Nombre",
  phone: "Teléfono",
  helpsWith: "Ayuda con",
  add: "Agregar agencia",
  save: "Guardar cambios",
  cancel: "Cancelar",
  edit: "Editar",
  remove: "Quitar",
  removeSure: "Sí, quitarla",
  keep: "Dejarla",
  removeQuestion: "¿Quitar esta agencia de la lista? Las solicitudes que la nombraron conservan el nombre.",
  added: "Se agregó la agencia.",
  saved: "Se guardó la agencia.",
  removed: "Se quitó la agencia.",
  failed: "No se pudo guardar. Nada cambió; inténtalo otra vez.",
  taken: "Esa agencia ya está en la lista.",
});

/** These words in the reader's language and the group's own terms. */
export const agenciesWords = (language: Language, t: Terms) => (language === "es" ? es : en)(t);
