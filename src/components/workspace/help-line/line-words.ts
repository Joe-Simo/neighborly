import type { Language } from "@/lib/words";
import { counter } from "@/lib/words/numbers";

const enN = counter("en");
const esN = counter("es");

/**
 * The help line's call list and assistant lines, in EN and ES. Kept here, imported only by help-line.tsx, so they load with this room
 * and not with every room's words. Each sentence is whole in each language.
 */
const books = {
  en: {
    /** The calls to return, and the calls returned this week. */
    calls: {
      toCallBack: "To call back",
      messages: (count: number) => (count === 1 ? "1 message" : `${enN(count)} messages`),
      /** Said to a screen reader after the waiting count, whose slip sits beside the heading: "5 to call back". */
      messagesNoun: (count: number): string => (count === 1 ? "to call back" : "to call back"),
      oldestDays: (count: number) => (count === 1 ? "oldest waiting 1 day" : `oldest waiting ${enN(count)} days`),
      oldestHours: (count: number) => (count === 1 ? "oldest waiting 1 hour" : `oldest waiting ${enN(count)} hours`),
      oldestUnderHour: "oldest waiting under an hour",
      putFirstBy: (name: string) => `Put first by ${name}`,
      notUrgentBy: (name: string) => `Marked not urgent by ${name}`,
      callingBack: (name: string) => `${name} is calling back`,
      drafting: "Drafting…",
      draft: "Draft a request",
      markReturned: "Mark returned",
      markReturnedFor: (name: string) => `Mark returned: ${name}`,
      quietTitle: "No one is waiting for a call back.",
      /** No call waiting and none returned: one line; the head carries "Log a call". */
      noneTitle: "No calls yet.",
      returnedThisWeek: "Returned this week",
      count: (count: number) => (count === 1 ? "1 call" : `${enN(count)} calls`),
      returned: "Returned",
      returnedBy: (name: string) => `Returned by ${name}`,
    },
    /** Said before the Spanish line when it is the assistant's reading, not the record's: the mark is only seen. */
    spanishRead: "The assistant read this in the call note:",
    /** Under a call whose caller needs Spanish: the team members who speak it, as a list, and "many" when more than one. */
    spanish: (names: string, many: boolean) => (names ? `Speaks Spanish. ${names} speak${many ? "" : "s"} Spanish.` : "Speaks Spanish."),
    /** Under a returned call: the one next step the assistant read in its outcome. A person decides; nothing follows from it. */
    nextStep: {
      resolved: "From the outcome, the assistant suggests: nothing more.",
      request: "From the outcome, the assistant suggests: start a request.",
      refer: "From the outcome, the assistant suggests: refer elsewhere.",
      callAgain: "From the outcome, the assistant suggests: call back later.",
    },
    /** The request suggestion when a request can be started from it: the lead in muted ink, the step itself the link. */
    nextStepLead: "From the outcome, the assistant suggests:",
    nextStepRequest: "start a request",
  },
  es: {
    calls: {
      toCallBack: "Llamadas por devolver",
      messages: (count: number) => (count === 0 ? "Ningún mensaje" : count === 1 ? "1 mensaje" : `${esN(count)} mensajes`),
      messagesNoun: () => "por devolver",
      oldestDays: (count: number) => (count === 1 ? "la más antigua lleva 1 día esperando" : `la más antigua lleva ${esN(count)} días esperando`),
      oldestHours: (count: number) => (count === 1 ? "la más antigua lleva 1 hora esperando" : `la más antigua lleva ${esN(count)} horas esperando`),
      oldestUnderHour: "la más antigua lleva menos de una hora esperando",
      putFirstBy: (name: string) => `${name} la puso primero`,
      notUrgentBy: (name: string) => `${name} la marcó como no urgente`,
      callingBack: (name: string) => `${name} devuelve la llamada`,
      drafting: "Preparando el borrador…",
      draft: "Preparar borrador",
      markReturned: "Marcar como devuelta",
      markReturnedFor: (name: string) => `Marcar como devuelta: ${name}`,
      quietTitle: "Nadie espera que le devuelvan la llamada.",
      noneTitle: "Todavía no hay llamadas.",
      returnedThisWeek: "Devueltas esta semana",
      count: (count: number) => (count === 1 ? "1 llamada" : `${esN(count)} llamadas`),
      returned: "Devuelta",
      returnedBy: (name: string) => `Devuelta por ${name}`,
    },
    spanishRead: "El asistente lo leyó en la nota de la llamada:",
    spanish: (names: string, many: boolean) => (names ? `Habla español. ${names} habla${many ? "n" : ""} español.` : "Habla español."),
    nextStep: {
      resolved: "Por el resultado, el asistente sugiere: nada más.",
      request: "Por el resultado, el asistente sugiere: empezar una petición.",
      refer: "Por el resultado, el asistente sugiere: derivar a otro lugar.",
      callAgain: "Por el resultado, el asistente sugiere: llamar más tarde.",
    },
    nextStepLead: "Por el resultado, el asistente sugiere:",
    nextStepRequest: "empezar una petición",
  },
} satisfies Record<Language, unknown>;

export const lineWords = (language: Language) => books[language];
