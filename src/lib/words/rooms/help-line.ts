import type { Terms } from "../sets";
import { counter } from "../numbers";
const enN = counter("en");
const esN = counter("es");

/**
 * The help line room: its head, the calls to return, the draft card and the assistant's foot.
 * Every sentence is written whole in each language: a line, a line counted by a number, or a line with named
 * places (`{name}`) filled by `fill` (../fill.ts). Nothing is joined from pieces on the screen.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const en = (t: Terms, place: string) => ({
  /** The room's one button in the page head, and the same words wherever a call is logged. */
  log: "Log a call",
  /** The green line that says what changed. */
  done: {
    savedToDecide: `Request saved. When the ${t.group} meets, record its yes on {name}’s record.`,
    savedOnRecord: "Request saved. It is waiting for a decision on {name}’s record.",
    openRecord: "Open the record",
    draft: "Draft a request",
    discarded: "Draft discarded. Nothing was saved.",
    callMatched: `Call saved, and added to the ${t.neighbor}’s record.`,
    callWaiting: "Call saved. It is waiting below until someone calls back.",
    /** A call that needs no call back: saved, and nothing waits. */
    callNoBack: "Call saved. No call back is needed.",
    returned: (name: string) => `Marked returned. ${name} has been called back.`,
    returnedUndone: (name: string) => `${name} put back on the call-back list.`,
    callTakenBack: "The call is off the call-back list.",
    neighborAdded: "Neighbor added. This call is now on their record.",
  },
  /** What went wrong, and what is still true. */
  refused: {
    discard: "The draft couldn’t be discarded. It is still here; try again.",
    /** `{reason}` is the refusal as the backend gave it. */
    stillOnSheet: "{reason} The draft is still on its sheet.",
    draft: "This request couldn’t be drafted. Nothing was saved.",
    stillHere: "The draft is still here. Choose Change to correct it.",
    writeYourself: "You can write the request yourself in the form.",
  },
  /** The sheets the room opens. */
  sheets: {
    join: {
      title: `Add a ${t.neighbor}`,
      deck: "This call and its request will be kept on their record.",
      saveAndRequest: `Save ${t.neighbor} and request`,
      saveAndContinue: `Save ${t.neighbor} and continue`,
      saveNewAndRequest: `Save as new ${t.neighbor} and request`,
      saveNewAndContinue: `Save as new ${t.neighbor} and continue`,
      useAndSave: `Use this ${t.neighbor} and save`,
      use: `Use this ${t.neighbor}`,
    },
    change: {
      title: "Change the draft",
      deck: (name: string) => `For ${name}. Nothing is saved until you save it here.`,
    },
    log: {
      deck: "Write down every call, even a wrong number.",
    },
    returned: {
      title: "Mark returned",
    },
    request: {
      title: "Add a request",
      deck: (name: string) => `For ${name}. Nothing is paid until it is approved.`,
    },
    neighbor: {
      title: `Add a ${t.neighbor}`,
      deck: "This call will be kept on their record.",
      undrafted: `Nothing could be drafted from this note. Add the ${t.neighbor}, then write the request yourself.`,
    },
  },
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
    addNeighbor: `Add as a ${t.neighbor}`,
    markReturned: "Mark returned",
    markReturnedFor: (name: string) => `Mark returned: ${name}`,
    quietTitle: "A quiet morning.",
    quiet: "No one is waiting for a call back. New messages from the help line will appear here.",
    /** No call waiting and none returned: the room has nothing to show, and the head carries "Log a call". */
    noneTitle: "No calls yet.",
    none: "A call that needs a call back waits here until someone returns it.",
    returnedThisWeek: "Returned this week",
    count: (count: number) => (count === 1 ? "1 call" : `${enN(count)} calls`),
    returned: "Returned",
    returnedBy: (name: string) => `Returned by ${name}`,
  },
  /** While the assistant reads a call note. */
  reading: {
    label: "The assistant",
    title: "Reading the note.",
    limits: "It fills in only what the note says, and leaves blank what it does not. Nothing is saved until you say so.",
  },
  /** The draft card's own lines that hold more than one value. */
  draft: {
    /** `{what}` is the kind of help, or "A request" when the note did not say. */
    amount: "{what}, {amount}",
    payee: "{what} to {payee}",
    amountPayee: "{what}, {amount} to {payee}",
    /** A draft with blanks, when it is not the only one waiting. */
    blanksWaiting: (count: number) => `A draft with blanks. ${enN(count)} waiting for your yes`,
  },
  /** The side column on a wide screen. */
  aside: {
    title: "On the line today",
    noOne: "No one on this shift yet",
    /** Calls no one has taken to call back. */
    untaken: "Not taken yet",
    none: "No one is set for the line today.",
    callingBack: "Calling back",
    calls: (count: number) => (count === 1 ? "1 call" : `${enN(count)} calls`),
  },
  /** What format.ts says of a household, a payee and a request. */
  format: {
    payees: { landlord: "Landlord", utility: "Utility company", vendor: "Store or other business" },
    languages: { en: "English", es: "Spanish", ht: "Haitian Creole", other: "Another language" },
    livesAlone: "Lives alone",
    householdOf: (count: number) => `Household of ${enN(count)}`,
    adults: (count: number) => (count === 1 ? "1 adult" : `${enN(count)} adults`),
    children: (count: number) => (count === 1 ? "1 child" : `${enN(count)} children`),
    adultsAndChildren: "{adults}, {children}",
    /** `{item}` is the shelf's own name for what the voucher gives, as it was typed. */
    vouchers: (count: number) => (count === 1 ? "1 {item} voucher" : `${enN(count)} {item} vouchers`),
    request: "{kind}, {amount}",
    requestTo: "{kind}, {amount} to {payee}",
    accounts: { landlord: "Landlord", utility: "Utility", other: "Other" },
  },
});

/** Spanish. The founder, who speaks Spanish, said on November 19, 2026 that it is fine as written. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const es = (t: Terms, place: string): ReturnType<typeof en> => ({
  log: "Anotar una llamada",
  done: {
    savedToDecide: `Petición guardada. Cuando tu ${t.group} se reúna, anota su sí en el registro de {name}.`,
    savedOnRecord: "Petición guardada. Espera una decisión en el registro de {name}.",
    openRecord: "Abrir el registro",
    draft: "Preparar borrador",
    discarded: "Borrador descartado. No se guardó nada.",
    callMatched: `Llamada guardada y agregada al registro del ${t.neighbor}.`,
    callWaiting: "Llamada guardada. Espera aquí abajo hasta que alguien devuelva la llamada.",
    callNoBack: "Llamada guardada. No hace falta devolverla.",
    returned: (name) => `Marcada como devuelta. Ya se le devolvió la llamada a ${name}.`,
    returnedUndone: (name) => `${name} vuelve a esperar que le devuelvan la llamada.`,
    callTakenBack: "La llamada salió de las llamadas por devolver.",
    neighborAdded: `Se agregó al ${t.neighbor}. Esta llamada ya está en su registro.`,
  },
  refused: {
    discard: "No se pudo descartar el borrador. Sigue aquí; inténtalo otra vez.",
    stillOnSheet: "{reason} El borrador sigue en su hoja.",
    draft: "No se pudo preparar el borrador de esta petición. No se guardó nada.",
    stillHere: "El borrador sigue aquí. Elige Cambiar para corregirlo.",
    writeYourself: "Puedes escribir la petición por tu cuenta en el formulario.",
  },
  sheets: {
    join: {
      title: `Agregar un ${t.neighbor}`,
      deck: "Esta llamada y su petición se guardarán en su registro.",
      saveAndRequest: `Guardar ${t.neighbor} y petición`,
      saveAndContinue: `Guardar ${t.neighbor} y continuar`,
      saveNewAndRequest: "Crear un registro nuevo y guardar la petición",
      saveNewAndContinue: "Crear un registro nuevo y continuar",
      useAndSave: `Usar este ${t.neighbor} y guardar`,
      use: `Usar este ${t.neighbor}`,
    },
    change: {
      title: "Cambiar el borrador",
      deck: (name) => `Para ${name}. No se guarda nada hasta que lo guardes aquí.`,
    },
    log: {
      deck: "Anota cada llamada, aunque sea un número equivocado.",
    },
    returned: {
      title: "Marcar como devuelta",
    },
    request: {
      title: "Agregar una petición",
      deck: (name) => `Para ${name}. No se paga nada hasta que se apruebe.`,
    },
    neighbor: {
      title: `Agregar un ${t.neighbor}`,
      deck: "Esta llamada se guardará en su registro.",
      undrafted: `No se pudo preparar un borrador con esta nota. Agrega al ${t.neighbor} y luego escribe la petición por tu cuenta.`,
    },
  },
  calls: {
    toCallBack: "Llamadas por devolver",
    messages: (count) => (count === 0 ? "Ningún mensaje" : count === 1 ? "1 mensaje" : `${esN(count)} mensajes`),
    messagesNoun: () => "por devolver",
    oldestDays: (count) => (count === 1 ? "el más antiguo lleva 1 día esperando" : `el más antiguo lleva ${esN(count)} días esperando`),
    oldestHours: (count) => (count === 1 ? "el más antiguo lleva 1 hora esperando" : `el más antiguo lleva ${esN(count)} horas esperando`),
    oldestUnderHour: "el más antiguo lleva menos de una hora esperando",
    putFirstBy: (name) => `${name} la puso primero`,
    notUrgentBy: (name) => `${name} la marcó como no urgente`,
    callingBack: (name) => `${name} devuelve la llamada`,
    drafting: "Preparando el borrador…",
    draft: "Preparar borrador",
    addNeighbor: "Agregar al registro",
    markReturned: "Marcar como devuelta",
    markReturnedFor: (name) => `Marcar como devuelta: ${name}`,
    quietTitle: "Una mañana tranquila.",
    quiet: "Nadie espera que le devuelvan la llamada. Los mensajes nuevos de la línea de ayuda aparecerán aquí.",
    noneTitle: "Todavía no hay llamadas.",
    none: "Una llamada que pide respuesta espera aquí hasta que alguien la devuelva.",
    returnedThisWeek: "Devueltas esta semana",
    count: (count) => (count === 1 ? "1 llamada" : `${esN(count)} llamadas`),
    returned: "Devuelta",
    returnedBy: (name) => `Devuelta por ${name}`,
  },
  reading: {
    label: "El asistente",
    title: "Leyendo la nota.",
    limits: "Llena solo lo que dice la nota y deja en blanco lo que no dice. No se guarda nada hasta que tú lo digas.",
  },
  draft: {
    amount: "{what}: {amount}",
    payee: "{what} a {payee}",
    amountPayee: "{what}, {amount} a {payee}",
    blanksWaiting: (count) => `Un borrador con espacios en blanco. ${esN(count)} esperan tu sí`,
  },
  aside: {
    title: "Hoy en la línea",
    noOne: "Nadie en este turno todavía",
    untaken: "Sin tomar todavía",
    none: "Hoy no hay nadie asignado a la línea.",
    callingBack: "Devuelven llamadas",
    calls: (count) => (count === 1 ? "1 llamada" : `${esN(count)} llamadas`),
  },
  format: {
    payees: { landlord: "Arrendador", utility: "Compañía de servicios", vendor: "Tienda u otro negocio" },
    languages: { en: "Inglés", es: "Español", ht: "Criollo haitiano", other: "Otro idioma" },
    livesAlone: "Vive sin compañía",
    householdOf: (count) => (count === 1 ? "Hogar de 1 persona" : `Hogar de ${esN(count)} personas`),
    adults: (count) => (count === 1 ? "1 adulto" : `${esN(count)} adultos`),
    children: (count) => (count === 1 ? "1 niño" : `${esN(count)} niños`),
    adultsAndChildren: "{adults} y {children}",
    vouchers: (count) => (count === 1 ? "1 vale de {item}" : `${esN(count)} vales de {item}`),
    request: "{kind}: {amount}",
    requestTo: "{kind}, {amount} a {payee}",
    accounts: { landlord: "Arrendador", utility: "Servicios", other: "Otro" },
  },
});
