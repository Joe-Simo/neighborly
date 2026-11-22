import type { Language, Terms } from "@/lib/words/sets";

/**
 * The uploaded files' words, kept with that component's own chunk rather than the shared words book, so no
 * room's first load carries them. Every sentence is written whole in each language.
 */
const en = (t: Terms) => ({
  title: "Your conference's files",
  deck: `Minutes, forms and anything else your ${t.group} keeps. Open to coordinators and owners only.`,
  neighborTitle: "Files",
  neighborDeck: "A lease, a utility bill or anything else kept with this record. Open to coordinators and owners only.",
  choose: "Add a file",
  help: "PDF, JPEG, PNG, HEIC, Word or Excel, up to 10 MB each.",
  empty: "No files yet.",
  loading: "Gathering the files",
  uploading: "Sending the file",
  added: "File added.",
  removed: "File removed.",
  remove: "Remove",
  removeSure: "Yes, remove it",
  keep: "Keep it",
  removeQuestion: "Remove this file for good? It cannot be brought back.",
  tooBig: "That file is larger than 10 MB. Choose a smaller one.",
  full: "Up to 300 files can be kept here. Remove one first.",
  wrongKind: "That kind of file cannot be kept. Choose a PDF, a picture, or a Word or Excel file.",
  failed: "The file could not be kept. Nothing changed; try again.",
  open: "Open",
  unread: "The file could not be opened. Try again in a moment.",
  by: "added by {name}",
});

const es = (t: Terms): ReturnType<typeof en> => ({
  title: "Los archivos de tu conferencia",
  deck: `Actas, formularios y cualquier otra cosa que tu ${t.group} guarde. Solo para coordinadores y responsables.`,
  neighborTitle: "Archivos",
  neighborDeck: "Un contrato de alquiler, una factura de servicios o cualquier otra cosa guardada con este registro. Solo para coordinadores y responsables.",
  choose: "Agregar un archivo",
  help: "PDF, JPEG, PNG, HEIC, Word o Excel, de hasta 10 MB cada uno.",
  empty: "Todavía no hay archivos.",
  loading: "Reuniendo los archivos",
  uploading: "Enviando el archivo",
  added: "Se agregó el archivo.",
  removed: "Se quitó el archivo.",
  remove: "Quitar",
  removeSure: "Sí, quitarlo",
  keep: "Dejarlo",
  removeQuestion: "¿Quitar este archivo para siempre? No se puede recuperar.",
  tooBig: "Ese archivo pesa más de 10 MB. Elige uno más pequeño.",
  full: "Aquí caben hasta 300 archivos. Quita uno primero.",
  wrongKind: "Ese tipo de archivo no se puede guardar. Elige un PDF, una foto, o un archivo de Word o Excel.",
  failed: "No se pudo guardar el archivo. Nada cambió; inténtalo otra vez.",
  open: "Abrir",
  unread: "No se pudo abrir el archivo. Inténtalo otra vez en un momento.",
  by: "agregado por {name}",
});

/** These words in the reader's language and the group's own terms. */
export const filesWords = (language: Language, t: Terms) => (language === "es" ? es : en)(t);
