import type { Terms } from "../sets";
import { counter } from "../numbers";
const enN = counter("en");
const esN = counter("es");

/**
 * The help line's sheets: log a call, write a request, decide, add a neighbor.
 * Every sentence is written whole in each language: a line, a line counted by a number, or a line with named
 * places (`{name}`) filled by `fill` (../fill.ts). Nothing is joined from pieces on the screen.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- every room's table is given the place; no line here names it
export const en = (t: Terms, place: string) => ({
  /** Logging a call, and saying what came of calling back. */
  call: {
    name: "Name",
    phone: "Phone",
    said: "What they said",
    next: "Next step",
    callBack: "Call them back",
    nothing: "Nothing more to do",
    save: "Save call",
    saveAndDraft: "Save and draft a request",
    outcome: "What came of it",
    outcomeHelp: `For example: ${t.visit} planned for Thursday, or referred to 211.`,
    markReturned: "Mark returned",
  },
  /** Writing a request, or changing one that is still open. */
  request: {
    kind: "Kind of help",
    howMany: "How many",
    amount: "Amount asked, in dollars",
    amountNeeded: "Enter the amount in dollars, such as 450.",
    voucherFor: "Voucher for",
    /** One line of the shelf's list; `{item}` is the shelf's own name for the voucher. */
    onShelf: (count: number): string => (count > 0 ? `{item}, ${enN(count)} on hand` : "{item}, none on hand"),
    somethingElse: "Something else",
    nameVoucher: "Name the voucher",
    nameVoucherHelp: "The treasurer adds it to the shelf when vouchers arrive.",
    need: "What they need",
    shelfNote: "Vouchers come off the shelf when the request is approved. Nobody is paid.",
    payee: "Who is paid",
    payees: { landlord: "Landlord", utility: "Utility company", vendor: "Store or other business" },
    payeeName: "Their name",
    payeeNote: `Payments go to the landlord, utility or store, never to the ${t.neighbor}.`,
    saveChanges: "Save changes",
    saveDraft: "Save this request",
    save: "Save request",
  },
  /** Approving or declining a request. */
  decide: {
    give: "How many to give",
    /** `{item}` is the shelf's name for the voucher, as it was asked for. */
    askedVouchers: (count: number): string => (count === 1 ? "They asked for 1 {item} voucher." : `They asked for ${enN(count)} {item} vouchers.`),
    shelfHas: (count: number): string => (count > 0 ? `The shelf has ${enN(count)} on hand.` : "The shelf has none on hand."),
    notOnShelf: "It is not on the shelf yet.",
    amount: "Amount to approve, in dollars",
    asked: "They asked for {amount}.",
    askedPaidTo: "They asked for {amount}, paid to {name}.",
    amountNeeded: "Enter the amount to approve, in dollars.",
    tooManyPlaces: "Name at most four places.",
    note: "Note on the decision (optional)",
    why: "Why it was declined",
    referred: "Also referred to",
    places: "Places we refer people to",
    elsewhere: "Somewhere else",
    elsewhereHelp: "A place not listed. It is offered here next time.",
    where: "Where",
    whereHelp: "Such as 211 or the county rent program. It is offered here next time.",
    approve: "Approve this request",
    decline: "Decline this request",
  },
  /** Ending a request that will go no further. */
  close: {
    whyBack: "Why it is being taken back",
    why: "Why it is being closed",
    /** `{item}` is the shelf's name for the voucher. */
    goesBack: (count: number): string =>
      count === 1 ? "1 {item} voucher goes back on the shelf. No money has moved." : `${enN(count)} {item} vouchers go back on the shelf. No money has moved.`,
    nothingGiven: "Nothing was given. No money has moved.",
    partPaid: "{paid} of {approved} was paid and stays in the ledger. The rest is not paid.",
    noMoney: "No money has moved.",
    takeBack: "Take back this voucher",
    close: "Close this request",
  },
  /** Adding a neighbor, or changing one. */
  neighbor: {
    name: "Name",
    phone: "Phone",
    address: "Address",
    adults: "Adults at home",
    children: "Children at home",
    speaks: "Speaks",
    languages: { en: "English", es: "Spanish", other: "Another language" },
    language: "Language",
    email: "Email",
    notes: "Good to know",
    notesHelp: "Best time to call, who lives at home, anything the next visitor should know.",
    alert: "Alert",
    alertHelp: "One line shown at the top of the record, such as “Call before visiting.” Leave empty for none.",
    /** Someone already on file has the same phone number, or the same name. */
    onFile: { phone: "{name} is already on file with this phone number.", name: "{name} is already on file with this name." },
    /** What to do about it: `use` where that record can be chosen here, `open` where it can only be opened. */
    recovery: {
      use: {
        phone: `Use that record, or change the number. What you typed is still here. If this is someone else, save as a new ${t.neighbor}.`,
        name: `Use that record, or change the name. What you typed is still here. If this is someone else, save as a new ${t.neighbor}.`,
      },
      open: {
        phone: `Open the record, or change the number. What you typed is still here. If this is someone else, save as a new ${t.neighbor}.`,
        name: `Open the record, or change the name. What you typed is still here. If this is someone else, save as a new ${t.neighbor}.`,
      },
    },
    openRecord: "Open record",
    saveChanges: "Save changes",
    saveNew: `Save as a new ${t.neighbor}`,
    add: `Add ${t.neighbor}`,
  },
  /** The box where a name is typed to confirm an act that cannot be undone; the name itself follows the line. */
  confirm: { noMatch: "That does not match. The name is" },
  /** Removing a neighbor's record for good. */
  remove: {
    goes: "What goes",
    goesDetail: `The name, address, phones, household, money, accounts and notes, and every word of its calls, requests and ${t.visits}.`,
    stays: "What stays",
    staysDetail:
      "The money, the dates and the counts, so the year’s totals do not change. Nothing left says who they were. Their name written by hand somewhere else, such as a note on another record, a task or an announcement, is not searched for.",
    type: (name: string): string => `Type ${name} to remove the record`,
    final: "This cannot be undone.",
    kept: "Nothing was removed.",
    remove: "Remove this record",
  },
});

/** Spanish. Written without a native speaker's review; one is still owed. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- as above
export const es = (t: Terms, place: string): ReturnType<typeof en> => ({
  call: {
    name: "Nombre",
    phone: "Teléfono",
    said: "Lo que dijo",
    next: "Siguiente paso",
    callBack: "Devolverle la llamada",
    nothing: "No hay nada más que hacer",
    save: "Guardar llamada",
    saveAndDraft: "Guardar y preparar un borrador",
    outcome: "En qué quedó",
    outcomeHelp: `Por ejemplo: ${t.visit} planeada para el jueves, o se le refirió al 211.`,
    markReturned: "Marcar como devuelta",
  },
  request: {
    kind: "Tipo de ayuda",
    howMany: "Cuántos",
    amount: "Monto pedido, en dólares",
    amountNeeded: "Escribe el monto en dólares, por ejemplo 450.",
    voucherFor: "Vale para",
    onShelf: (count) => (count === 1 ? "{item}, queda 1" : count > 0 ? `{item}, quedan ${esN(count)}` : "{item}, no queda ninguno"),
    somethingElse: "Otra cosa",
    nameVoucher: "Ponle nombre al vale",
    nameVoucherHelp: "La tesorería lo agrega al estante cuando llegan los vales.",
    need: "Lo que necesita",
    shelfNote: "Los vales salen del estante cuando se aprueba la petición. No se le paga a nadie.",
    payee: "A quién se le paga",
    payees: { landlord: "Arrendador", utility: "Compañía de servicios", vendor: "Tienda u otro negocio" },
    payeeName: "Su nombre",
    payeeNote: `Los pagos van al dueño de la vivienda, a la compañía de servicios o a la tienda, nunca al ${t.neighbor}.`,
    saveChanges: "Guardar cambios",
    saveDraft: "Guardar esta petición",
    save: "Guardar petición",
  },
  decide: {
    give: "Cuántos dar",
    askedVouchers: (count) => (count === 1 ? "Pidió 1 vale de {item}." : `Pidió ${esN(count)} vales de {item}.`),
    shelfHas: (count) => (count === 1 ? "En el estante queda 1." : count > 0 ? `En el estante quedan ${esN(count)}.` : "En el estante no queda ninguno."),
    notOnShelf: "Todavía no está en el estante.",
    amount: "Monto que se aprueba, en dólares",
    asked: "Pidió {amount}.",
    askedPaidTo: "Pidió {amount}, que se pagan a {name}.",
    amountNeeded: "Escribe el monto que se aprueba, en dólares.",
    tooManyPlaces: "Indica cuatro lugares como máximo.",
    note: "Nota sobre la decisión (opcional)",
    why: "Por qué no se aprobó",
    referred: "También se le refirió a",
    places: "Lugares a los que referimos a las personas",
    elsewhere: "Otro lugar",
    elsewhereHelp: "Un lugar que no está en la lista. La próxima vez se ofrecerá aquí.",
    where: "A dónde",
    whereHelp: "Por ejemplo, el 211 o el programa de alquiler del condado. La próxima vez se ofrecerá aquí.",
    approve: "Aprobar esta petición",
    decline: "No aprobar esta petición",
  },
  close: {
    whyBack: "Por qué se retira",
    why: "Por qué se cierra",
    goesBack: (count) =>
      count === 1 ? "1 vale de {item} vuelve al estante. No se ha movido dinero." : `${esN(count)} vales de {item} vuelven al estante. No se ha movido dinero.`,
    nothingGiven: "No se entregó nada. No se ha movido dinero.",
    partPaid: "Se pagaron {paid} de {approved} y quedan en el libro. El resto no se paga.",
    noMoney: "No se ha movido dinero.",
    takeBack: "Retirar este vale",
    close: "Cerrar esta petición",
  },
  neighbor: {
    name: "Nombre",
    phone: "Teléfono",
    address: "Dirección",
    adults: "Adultos en casa",
    children: "Niños en casa",
    speaks: "Habla",
    languages: { en: "Inglés", es: "Español", other: "Otro idioma" },
    language: "Idioma",
    email: "Correo electrónico",
    notes: "Conviene saber",
    notesHelp: "La mejor hora para llamar, quién vive en casa, lo que deba saber quien haga la próxima visita.",
    alert: "Alerta",
    alertHelp: "Una línea que se muestra arriba en el registro, por ejemplo «Llamar antes de visitar». Déjala vacía si no hace falta.",
    onFile: { phone: "Ya hay un registro de {name} con este número de teléfono.", name: "Ya hay un registro de {name} con este nombre." },
    recovery: {
      use: {
        phone: `Usa ese registro o cambia el número. Lo que escribiste sigue aquí. Si es otra persona, crea un registro nuevo.`,
        name: `Usa ese registro o cambia el nombre. Lo que escribiste sigue aquí. Si es otra persona, crea un registro nuevo.`,
      },
      open: {
        phone: `Abre el registro o cambia el número. Lo que escribiste sigue aquí. Si es otra persona, crea un registro nuevo.`,
        name: `Abre el registro o cambia el nombre. Lo que escribiste sigue aquí. Si es otra persona, crea un registro nuevo.`,
      },
    },
    openRecord: "Abrir registro",
    saveChanges: "Guardar cambios",
    saveNew: "Crear un registro nuevo",
    add: `Agregar ${t.neighbor}`,
  },
  confirm: { noMatch: "No coincide. El nombre es" },
  remove: {
    goes: "Lo que se borra",
    goesDetail: `El nombre, la dirección, los teléfonos, el hogar, el dinero, las cuentas y las notas, y cada palabra de sus llamadas, peticiones y ${t.visits}.`,
    stays: "Lo que queda",
    staysDetail:
      "El dinero, las fechas y los conteos, para que los totales del año no cambien. Nada de lo que queda dice quién era. Su nombre escrito a mano en otro lugar, como una nota en otro registro, una tarea o un aviso, no se busca.",
    type: (name) => `Escribe ${name} para borrar el registro`,
    final: "Esto no se puede deshacer.",
    kept: "No se borró nada.",
    remove: "Borrar este registro",
  },
});
