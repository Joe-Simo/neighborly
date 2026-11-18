import type { Terms } from "../sets";

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
    savedToDecide: `Request saved. It waits for the ${t.group} to decide.`,
    savedOnRecord: "Request saved. It is waiting for a decision on {name}’s record.",
    openRecord: "Open the record",
    draft: "Draft a request",
    discarded: "Draft discarded. Nothing was saved.",
    callMatched: `Call saved, and added to the ${t.neighbor}’s record.`,
    callWaiting: "Call saved. It is waiting below until someone calls back.",
    returned: (name: string) => `Marked returned. ${name} has been called back.`,
    returnedUndone: (name: string) => `${name} is back on the call-back list.`,
    callTakenBack: "The call is off the list.",
    neighborAdded: "Neighbor added. This call is now on their record.",
  },
  /** What went wrong, and what is still true. */
  refused: {
    discard: "The draft couldn’t be discarded.",
    /** `{reason}` is the refusal as the backend gave it. */
    stillOnSheet: "{reason} The draft is still on its sheet.",
    draft: "The assistant couldn’t draft this request. Nothing was saved.",
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
      undrafted: `The assistant could not draft from this note. Add the ${t.neighbor}, then write the request yourself.`,
    },
  },
  /** The calls to return, and the calls returned this week. */
  calls: {
    toCallBack: "To call back",
    messages: (count: number) => (count === 1 ? "1 message" : `${count} messages`),
    oldestDays: (count: number) => (count === 1 ? "oldest waiting 1 day" : `oldest waiting ${count} days`),
    oldestHours: (count: number) => (count === 1 ? "oldest waiting 1 hour" : `oldest waiting ${count} hours`),
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
    noneTitle: "Calls are written down here.",
    none: "When someone calls the help line, log the call. It waits here until someone calls them back.",
    returnedThisWeek: "Returned this week",
    count: (count: number) => (count === 1 ? "1 call" : `${count} calls`),
    returned: "Returned",
    returnedBy: (name: string) => `Returned by ${name}`,
  },
  /** While the assistant reads a call note. */
  reading: {
    label: "The assistant is reading the note",
    title: "Reading what was written.",
    limits: "It fills in only what the note says, and leaves blank what it does not. Nothing is saved until you say so.",
  },
  /** The draft card's own lines that hold more than one value. */
  draft: {
    /** `{what}` is the kind of help, or "A request" when the note did not say. */
    amount: "{what}, {amount}",
    payee: "{what} to {payee}",
    amountPayee: "{what}, {amount} to {payee}",
    /** A draft with blanks, when it is not the only one waiting. */
    blanksWaiting: (count: number) => `A draft with blanks. ${count} waiting for your yes`,
  },
  /** The side column on a wide screen. */
  aside: {
    title: "On the line today",
    noOne: "No one yet",
    none: "No one is set for the line today.",
    callingBack: "Calling back",
    calls: (count: number) => (count === 1 ? "1 call" : `${count} calls`),
  },
  /** What format.ts says of a household, a payee and a request. */
  format: {
    payees: { landlord: "Landlord", utility: "Utility company", vendor: "Store or other business" },
    languages: { en: "English", es: "Spanish", ht: "Haitian Creole", other: "Another language" },
    livesAlone: "Lives alone",
    householdOf: (count: number) => `Household of ${count}`,
    adults: (count: number) => (count === 1 ? "1 adult" : `${count} adults`),
    children: (count: number) => (count === 1 ? "1 child" : `${count} children`),
    adultsAndChildren: "{adults}, {children}",
    /** `{item}` is the shelf's own name for what the voucher gives, as it was typed. */
    vouchers: (count: number) => (count === 1 ? "1 {item} voucher" : `${count} {item} vouchers`),
    request: "{kind}, {amount}",
    requestTo: "{kind}, {amount} to {payee}",
    accounts: { landlord: "Landlord", utility: "Utility", other: "Other" },
  },
});

/** Spanish. Written without a native speaker's review; one is still owed. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const es = (t: Terms, place: string): ReturnType<typeof en> => ({
  log: "Anotar una llamada",
  done: {
    savedToDecide: `Petición guardada. Espera a que tu ${t.group} decida.`,
    savedOnRecord: "Petición guardada. Espera una decisión en el registro de {name}.",
    openRecord: "Abrir el registro",
    draft: "Preparar un borrador de petición",
    discarded: "Borrador descartado. No se guardó nada.",
    callMatched: `Llamada guardada y agregada al registro del ${t.neighbor}.`,
    callWaiting: "Llamada guardada. Espera aquí abajo hasta que alguien devuelva la llamada.",
    returned: (name) => `Marcada como devuelta. Ya se le devolvió la llamada a ${name}.`,
    returnedUndone: (name) => `${name} vuelve a esperar que le devuelvan la llamada.`,
    callTakenBack: "La llamada se quitó de la lista.",
    neighborAdded: `Se agregó al ${t.neighbor}. Esta llamada ya está en su registro.`,
  },
  refused: {
    discard: "No se pudo descartar el borrador.",
    stillOnSheet: "{reason} El borrador sigue en su hoja.",
    draft: "El asistente no pudo preparar el borrador de esta petición. No se guardó nada.",
    stillHere: "El borrador sigue aquí. Elige Cambiar para corregirlo.",
    writeYourself: "Puedes escribir la petición por tu cuenta en el formulario.",
  },
  sheets: {
    join: {
      title: `Agregar un ${t.neighbor}`,
      deck: "Esta llamada y su petición se guardarán en su registro.",
      saveAndRequest: `Guardar ${t.neighbor} y petición`,
      saveAndContinue: `Guardar ${t.neighbor} y continuar`,
      saveNewAndRequest: `Guardar como ${t.neighbor} nuevo y guardar la petición`,
      saveNewAndContinue: `Guardar como ${t.neighbor} nuevo y continuar`,
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
      undrafted: `El asistente no pudo preparar un borrador con esta nota. Agrega al ${t.neighbor} y luego escribe la petición por tu cuenta.`,
    },
  },
  calls: {
    toCallBack: "Llamadas por devolver",
    messages: (count) => (count === 0 ? "Ningún mensaje" : count === 1 ? "1 mensaje" : `${count} mensajes`),
    oldestDays: (count) => (count === 1 ? "el más antiguo espera desde hace 1 día" : `el más antiguo espera desde hace ${count} días`),
    oldestHours: (count) => (count === 1 ? "el más antiguo espera desde hace 1 hora" : `el más antiguo espera desde hace ${count} horas`),
    oldestUnderHour: "el más antiguo espera desde hace menos de una hora",
    putFirstBy: (name) => `${name} la puso primero`,
    notUrgentBy: (name) => `${name} la marcó como no urgente`,
    callingBack: (name) => `${name} devuelve la llamada`,
    drafting: "Preparando el borrador…",
    draft: "Preparar un borrador de petición",
    addNeighbor: `Agregar como ${t.neighbor}`,
    markReturned: "Marcar como devuelta",
    markReturnedFor: (name) => `Marcar como devuelta: ${name}`,
    quietTitle: "Una mañana tranquila.",
    quiet: "Nadie espera que le devuelvan la llamada. Los mensajes nuevos de la línea de ayuda aparecerán aquí.",
    noneTitle: "Aquí se anotan las llamadas.",
    none: "Cuando alguien llame a la línea de ayuda, anota la llamada. Se queda aquí hasta que alguien la devuelva.",
    returnedThisWeek: "Devueltas esta semana",
    count: (count) => (count === 1 ? "1 llamada" : `${count} llamadas`),
    returned: "Devuelta",
    returnedBy: (name) => `Devuelta por ${name}`,
  },
  reading: {
    label: "El asistente está leyendo la nota",
    title: "Leyendo lo que se escribió.",
    limits: "Llena solo lo que dice la nota y deja en blanco lo que no dice. No se guarda nada hasta que tú lo digas.",
  },
  draft: {
    amount: "{what}: {amount}",
    payee: "{what} a {payee}",
    amountPayee: "{what}, {amount} a {payee}",
    blanksWaiting: (count) => `Un borrador con espacios en blanco. ${count} esperan tu sí`,
  },
  aside: {
    title: "Hoy en la línea",
    noOne: "Nadie todavía",
    none: "Hoy no hay nadie asignado a la línea.",
    callingBack: "Devuelven llamadas",
    calls: (count) => (count === 1 ? "1 llamada" : `${count} llamadas`),
  },
  format: {
    payees: { landlord: "Arrendador", utility: "Compañía de servicios", vendor: "Tienda u otro negocio" },
    languages: { en: "Inglés", es: "Español", ht: "Criollo haitiano", other: "Otro idioma" },
    livesAlone: "Vive sin compañía",
    householdOf: (count) => (count === 1 ? "Hogar de 1 persona" : `Hogar de ${count} personas`),
    adults: (count) => (count === 1 ? "1 adulto" : `${count} adultos`),
    children: (count) => (count === 1 ? "1 niño" : `${count} niños`),
    adultsAndChildren: "{adults} y {children}",
    vouchers: (count) => (count === 1 ? "1 vale de {item}" : `${count} vales de {item}`),
    request: "{kind}: {amount}",
    requestTo: "{kind}, {amount} a {payee}",
    accounts: { landlord: "Arrendador", utility: "Servicios", other: "Otro" },
  },
});
