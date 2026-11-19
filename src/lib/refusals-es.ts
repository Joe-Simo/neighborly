/**
 * The backend's other refusals, the ones it writes out in English where it throws them, in
 * Spanish. Keyed by the exact English sentence, so a key must change with the backend's own
 * words. A sentence with a dynamic part is matched by its pattern instead.
 */
export const serverRefusalsEs: Record<string, string> = {
  "A birth year looks wrong.": "Un año de nacimiento no parece correcto.",
  "A deposit cannot clear the bank before the day it was made.": "Un depósito no puede pasar por el banco antes del día en que se hizo.",
  "A gift cannot be deposited before the day it was received.": "Un donativo no se puede depositar antes del día en que se recibió.",
  "A home visit needs two people.": "Una visita domiciliaria necesita dos personas.",
  "A home visit to this neighbor is still planned. Cancel it first.": "Todavía hay una visita planeada a este vecino. Cancélala primero.",
  "A household needs at least one adult.": "Un hogar necesita al menos un adulto.",
  "A name is needed.": "Falta un nombre.",
  "A name or a phone number is needed.": "Falta un nombre o un teléfono.",
  "A request for this neighbor is still open. Decide it or close it first.": "Este vecino todavía tiene una petición abierta. Decídela o ciérrala primero.",
  "A reversal cannot be reversed. Record the entry again instead.": "Una anulación no se puede anular. Mejor anota el movimiento de nuevo.",
  "A statement cannot be dated in the future.": "Un estado de cuenta no puede tener fecha futura.",
  "A verified email is required.": "Se necesita un correo verificado.",
  "A visit for this request is already planned.": "Ya hay una visita planeada para esta petición.",
  "Add who is paid before approving. Payments go to the landlord, utility or store.":
    "Anota a quién se le paga antes de aprobar. Se le paga al dueño de la vivienda, a la compañía de servicios o a la tienda.",
  "Add who is to be paid to the request first.": "Primero anota en la petición a quién se le paga.",
  "An accepted invitation cannot be revoked.": "Una invitación aceptada ya no se puede anular.",
  "An amount must be zero or more.": "Un monto debe ser cero o más.",
  "An entry cannot be dated in the future.": "Un movimiento no puede tener fecha futura.",
  "An entry cannot clear the bank before the day it was made.": "Un movimiento no puede pasar por el banco antes del día en que se hizo.",
  "Call not found.": "No se encontró esa llamada.",
  "Choose a month.": "Elige un mes.",
  "Choose a time that is still to come.": "Elige una hora que todavía no haya pasado.",
  "Choose a year.": "Elige un año.",
  "Choose people from this group.": "Elige personas de este grupo.",
  "Choose the day.": "Elige el día.",
  "Choose the gifts that went to the bank.": "Elige los donativos que llevaste al banco.",
  "Choose the statement day.": "Elige la fecha del estado de cuenta.",
  "Choose two different people.": "Elige dos personas distintas.",
  "Choose which of the two is being replaced.": "Elige a cuál de los dos se reemplaza.",
  "Church owner access required.": "Esto lo puede hacer solo quien administra la parroquia.",
  "Contact the church coordinator to restore access.": "Pide al coordinador de la parroquia que te devuelva el acceso.",
  "Coordinator access required.": "Esto lo puede hacer solo un coordinador.",
  "Deposit not found.": "No se encontró ese depósito.",
  "Describe your team in up to 2,000 characters.": "Describe tu equipo en 2,000 caracteres o menos.",
  "Each account needs the name of who is paid.": "Cada cuenta necesita el nombre de a quién se le paga.",
  "Each line needs a name.": "Cada línea necesita un nombre.",
  "Each person needs a relationship, such as mother or son.": "Cada persona necesita un parentesco, como madre o hijo.",
  "Enter a valid email address.": "Escribe un correo válido.",
  "Enter a valid name.": "Escribe un nombre válido.",
  "Enter a valid time zone.": "Escribe una zona horaria válida.",
  "Enter a valid value.": "Escribe un valor válido.",
  "Enter an amount in dollars and cents, more than zero.": "Escribe un monto en dólares y centavos, mayor que cero.",
  "Enter how many vouchers, as a whole number.": "Escribe cuántos vales, en número entero.",
  "Enter the ending balance in dollars and cents.": "Escribe el saldo final en dólares y centavos.",
  "Enter the hours the visit took, such as 1.5.": "Escribe las horas que duró la visita, por ejemplo 1.5.",
  "Enter the miles driven, or 0.": "Escribe las millas manejadas, o 0.",
  "Entry not found.": "No se encontró ese movimiento.",
  "Every conference already has a kind with this name.": "Ya existe un tipo con este nombre para todas las conferencias.",
  "Give the kind a name with letters or numbers.": "Ponle al tipo un nombre con letras o números.",
  "Group not found.": "No se encontró ese grupo.",
  "Invitation is invalid or expired.": "Esta invitación no es válida o ya venció.",
  "Invitation not found.": "No se encontró esa invitación.",
  "Kind not found.": "No se encontró ese tipo.",
  "Meeting not found.": "No se encontró esa reunión.",
  "Member not found.": "No se encontró a ese miembro.",
  "Membership cannot be changed.": "Esta membresía no se puede cambiar.",
  "Name at most four places.": "Indica cuatro lugares como máximo.",
  "Name the language.": "Escribe el idioma.",
  "Neighbor records are open to coordinators and owners only.": "Los registros de los vecinos solo los ven coordinadores y responsables.",
  "Note not found.": "No se encontró esa nota.",
  "One of the two is no longer in the conference. Ask a second visitor first.":
    "Uno de los dos ya no está en la conferencia. Primero pide un segundo visitador.",
  "One of these gifts is already in a deposit.": "Uno de estos donativos ya está en un depósito.",
  "One of these gifts was taken back, so it cannot be deposited.": "Uno de estos donativos se anuló, así que no se puede depositar.",
  "Only a planned visit can be called off.": "Solo se puede cancelar una visita planeada.",
  "Only a planned visit can change its pair.": "Solo una visita planeada puede cambiar de pareja.",
  "Only a planned visit can change its time.": "Solo una visita planeada puede cambiar de hora.",
  "Only a voucher request names a voucher.": "Solo una petición de vale lleva un vale.",
  "Only an approved request can be paid.": "Solo se puede pagar una petición aprobada.",
  "Only an owner can close a conference.": "Solo un responsable puede cerrar una conferencia.",
  "Only an owner can remove a neighbor’s record.": "Solo un responsable puede borrar el registro de un vecino.",
  "Only an owner can take the records out.": "Solo un responsable puede sacar los registros.",
  "Only money that came in can be deposited.": "Solo se puede depositar dinero que entró.",
  "Only the owner can remove a person.": "Solo el responsable puede quitar a una persona.",
  "Owner access required.": "Esto lo puede hacer solo un responsable.",
  "Payments go to the landlord, utility or store, never to the neighbor. Change who is paid on the request first.":
    "Se le paga al dueño de la vivienda, a la compañía de servicios o a la tienda, nunca al vecino. Primero cambia en la petición a quién se le paga.",
  "Pending request not found.": "No se encontró esa petición en espera.",
  "Person must first accept team membership.": "Esa persona primero debe aceptar unirse al equipo.",
  "Person not found.": "No se encontró a esa persona.",
  "Please wait a minute before preparing another draft.": "Espera un minuto antes de preparar otro borrador.",
  "Record not found.": "No se encontró ese registro.",
  "Reload the page to see this room.": "Vuelve a cargar la página para ver esta sección.",
  "Request not found.": "No se encontró esa petición.",
  "Say why the count is going down.": "Di por qué baja el conteo.",
  "Say why this entry is being reversed.": "Di por qué se anula este movimiento.",
  "Sign in required.": "Primero inicia sesión.",
  "Sign in to prepare a team draft.": "Inicia sesión para preparar un borrador del equipo.",
  "Task access required.": "No tienes acceso a esta tarea.",
  "Team access required.": "No tienes acceso a este equipo.",
  "Team coordinator access required.": "Esto lo puede hacer solo quien coordina el equipo.",
  "Team not found.": "No se encontró ese equipo.",
  "That call belongs to another neighbor.": "Esa llamada es de otro vecino.",
  "The approved amount is needed.": "Falta el monto aprobado.",
  "The day should be a day of the month.": "El día debe ser un día del mes.",
  "The driver must be one of the two visitors.": "Quien maneja debe ser uno de los dos visitadores.",
  "The last day must be on or after the first day.": "El último día debe ser igual o posterior al primero.",
  "The owner cannot be removed.": "No se puede quitar al responsable.",
  "The person has not opted in or is not approved.": "Esa persona no se ha anotado o todavía no está aprobada.",
  "The person is not approved for this team.": "Esa persona no está aprobada para este equipo.",
  "The sample account can only look around the sample conference. Create your own account to start a conference.":
    "La cuenta de muestra solo puede recorrer la conferencia de muestra. Crea tu propia cuenta para empezar una conferencia.",
  "The sample conference cannot be closed. It is put back fresh every night.":
    "La conferencia de muestra no se puede cerrar. Cada noche vuelve a quedar como nueva.",
  "The sample conference cannot invite anyone. Create your own account to invite your people.":
    "La conferencia de muestra no puede invitar a nadie. Crea tu propia cuenta para invitar a tu gente.",
  "The statement and what has cleared do not agree yet, so it was not kept.":
    "El estado de cuenta y lo que ya pasó por el banco todavía no coinciden, así que no se guardó.",
  "The voucher shelf has too many lines to count in one pass. Tell us, and we will close out the earlier years.":
    "El estante de vales tiene demasiadas líneas para contarlas de una vez. Avísanos y cerraremos los años anteriores.",
  "This call has been worked on since. Change it from its record instead.": "Alguien ya avanzó con esta llamada. Cámbiala desde su registro.",
  "This call is not marked returned.": "Esta llamada no está marcada como devuelta.",
  "This call is not waiting for a callback.": "Esta llamada no está esperando que la devuelvan.",
  "This can no longer be undone here.": "Esto ya no se puede deshacer aquí.",
  "This conference has too many invitations to search at once. Please write to us.":
    "Esta conferencia tiene demasiadas invitaciones para buscarlas de una vez. Escríbenos, por favor.",
  "This deposit has cleared the bank. Take the cleared mark back first.": "Este depósito ya pasó por el banco. Primero quita esa marca.",
  "This entry has already been reversed.": "Este movimiento ya se anuló.",
  "This group is too large to check a file against. Invite people one at a time.":
    "Este grupo es demasiado grande para revisarlo contra un archivo. Invita a las personas una por una.",
  "This kind is no longer offered. Choose another.": "Este tipo ya no se ofrece. Elige otro.",
  "This ledger is too long to add up in one pass. Tell us, and we will close out the earlier years.":
    "Este libro es demasiado largo para sumarlo de una vez. Avísanos y cerraremos los años anteriores.",
  "This person has too many records to remove at once. Please write to us.":
    "Esta persona tiene demasiados registros para borrarlos de una vez. Escríbenos, por favor.",
  "This person is not in the conference.": "Esta persona no está en la conferencia.",
  "This request has already been decided.": "Esta petición ya se decidió.",
  "This request has too many ledger entries to add up.": "Esta petición tiene demasiados movimientos en el libro para sumarlos.",
  "This request is already finished.": "Esta petición ya está cerrada.",
  "This visit is already written up or was cancelled.": "Esta visita ya tiene sus notas o se canceló.",
  "This visit is no longer planned.": "Esta visita ya no está planeada.",
  "This visit is not called off.": "Esta visita no está cancelada.",
  "This year holds more records than one report can add up.": "Este año tiene más registros de los que un informe puede sumar.",
  "Too many records to open at once.": "Son demasiados registros para abrirlos de una vez.",
  "Type the conference’s name as it is written.": "Escribe el nombre de la conferencia tal como aparece.",
  "Type the neighbor’s name as it is written on the record.": "Escribe el nombre del vecino tal como aparece en el registro.",
  "Type the person’s name exactly to remove them.": "Escribe el nombre exacto de la persona para quitarla.",
  "Use the invitation flow to create a secure invitation.": "Usa la opción de invitar para crear una invitación segura.",
  "Visit not found.": "No se encontró esa visita.",
  "Workspace access required.": "No tienes acceso a este espacio.",
  "Workspace not found.": "No se encontró ese espacio.",
  "Write a few words about what you found.": "Escribe unas palabras sobre lo que encontraste.",
  "Write the note first.": "Primero escribe la nota.",
  "Year not found.": "No se encontró ese año.",
  "You already have a kind with this name.": "Ya tienes un tipo con este nombre.",
};

/** The field names the backend puts in its "is needed / is too long / must be a …" refusals, in Spanish. */
export const fieldLabelsEs: Readonly<Record<string, string>> = {
  "A label": "Etiqueta",
  "A name": "Nombre",
  "A note": "Nota",
  "A phone number": "Teléfono",
  "A referral": "Referencia",
  "A relationship": "Parentesco",
  Adults: "Adultos",
  "An account number": "Número de cuenta",
  Children: "Niños",
  "The address": "Dirección",
  "The alert": "Alerta",
  "The amount": "Monto",
  "The approved amount": "Monto aprobado",
  "The email": "Correo electrónico",
  "The language": "Idioma",
  "The name": "Nombre",
  "The note": "Nota",
  "The outcome": "Resultado",
  "The phone number": "Teléfono",
  "The quote": "Cotización",
  "The referral": "Referencia",
  "The voucher": "Vale",
  "What they need": "Lo que necesita",
  "Who is paid": "A quién se paga",
};
/**
 * Refusals the backend words for its own checks (an identifier, a page of rows, a setting). A person can meet them only
 * on a stale page or a group not yet set up, so each is said in plain words in both languages: what happened, and what to do.
 */
export const serverRefusalsPlain: Record<string, { en: string; es: string }> = {
  "Page size exceeds 100.": { en: "That list couldn’t be read. Reload the page.", es: "No se pudo leer esa lista. Vuelve a cargar la página." },
  "Page size exceeds 25.": { en: "That list couldn’t be read. Reload the page.", es: "No se pudo leer esa lista. Vuelve a cargar la página." },
  "Page size exceeds 10.": { en: "That list couldn’t be read. Reload the page.", es: "No se pudo leer esa lista. Vuelve a cargar la página." },
  "Team memberships require pagination.": { en: "That team is too large to read at once. Reload the page.", es: "Ese equipo es demasiado grande para leerlo de una vez. Vuelve a cargar la página." },
  "Pending requests require a narrower lookup.": { en: "There are too many waiting requests to read at once. Reload the page.", es: "Hay demasiadas peticiones en espera para leerlas de una vez. Vuelve a cargar la página." },
  "Multiple pending requests require review.": { en: "More than one request is waiting for this. Reload the page and choose one.", es: "Hay más de una petición en espera para esto. Vuelve a cargar la página y elige una." },
  "Multiple accepted requests require review.": { en: "More than one person has said yes to this. Reload the page and check who is going.", es: "Más de una persona dijo que sí a esto. Vuelve a cargar la página y revisa quién va." },
  "Delivery record not found.": { en: "That message is no longer on file. Reload the page.", es: "Ese mensaje ya no está en el registro. Vuelve a cargar la página." },
  "Recipient not found.": { en: "That person is no longer on the list. Reload the page.", es: "Esa persona ya no está en la lista. Vuelve a cargar la página." },
  "Meeting recipient not found.": { en: "That person is no longer invited to the meeting. Reload the page.", es: "Esa persona ya no está invitada a la reunión. Vuelve a cargar la página." },
  "Unknown kind of help.": { en: "That kind of help is no longer on the list. Choose another.", es: "Ese tipo de ayuda ya no está en la lista. Elige otro." },
  "Request identifier already used.": { en: "This was already saved. Reload the page to see it.", es: "Esto ya se guardó. Vuelve a cargar la página para verlo." },
  "Invalid request identifier.": { en: "That couldn’t be saved. Reload the page and try again.", es: "No se pudo guardar. Vuelve a cargar la página e inténtalo de nuevo." },
  "Invalid batch identifier.": { en: "That couldn’t be saved. Reload the page and try again.", es: "No se pudo guardar. Vuelve a cargar la página e inténtalo de nuevo." },
  "Invalid calendar address.": { en: "That calendar address couldn’t be made. Try again.", es: "No se pudo crear la dirección del calendario. Inténtalo de nuevo." },
  "The calendar address is not available on this deployment.": { en: "Calendar addresses aren’t turned on for this group yet.", es: "Las direcciones de calendario todavía no están activadas para este grupo." },
  "Email delivery is not configured.": { en: "Email isn’t set up for this group yet, so nothing was sent.", es: "El correo todavía no está configurado para este grupo, así que no se envió nada." },
  "Invitations are not available until email delivery is configured.": { en: "Invitations go by email, and email isn’t set up for this group yet.", es: "Las invitaciones se envían por correo, y el correo todavía no está configurado para este grupo." },
  "Only a sample group can be cleared.": { en: "Only the sample group can be cleared. Your own records stay as they are.", es: "Solo se puede vaciar el grupo de muestra. Tus propios registros se quedan como están." },
  "A record fell outside the year it was read for.": { en: "The report couldn’t be made. Reload the page and try again.", es: "No se pudo preparar el informe. Vuelve a cargar la página e inténtalo de nuevo." },
  "A planned row was patched before it was planned.": { en: "The file couldn’t be brought in. Nothing was changed. Try again.", es: "No se pudo traer el archivo. No se cambió nada. Inténtalo de nuevo." },
  "The sample's rows name each other in a circle.": { en: "The sample couldn’t be set up. Nothing was changed. Try again.", es: "No se pudo preparar la muestra. No se cambió nada. Inténtalo de nuevo." },
};
/** A refusal for something no longer there ("Call not found."): the page is behind, so the next step is the same in each. */
export const notFound = /not found\.$/;
export const nextStep = { en: "Reload the page.", es: "Vuelve a cargar la página." };
const fieldEs = (label: string) => fieldLabelsEs[label] ?? label;

/**
 * Refusals the backend builds around a name or a number. Each pattern is the English sentence with
 * its dynamic part captured; the Spanish keeps that part as the backend said it.
 */
export const serverRefusalPatternsEs: ReadonlyArray<readonly [RegExp, (...parts: string[]) => string]> = [
  // "Ya hay un registro de…": the sentence marks no gender for the named person.
  [/^(.+) is already on file with this phone number\.$/, (name) => `Ya hay un registro de ${name} con este teléfono.`],
  [/^(.+) is already on file with this name\.$/, (name) => `Ya hay un registro de ${name} con este nombre.`],
  [/^(.+) is needed\.$/, (label) => `Falta: ${fieldEs(label)}.`],
  [/^(.+) is too long\.$/, (label) => `${fieldEs(label)}: el texto es demasiado largo.`],
  [/^(.+) must be a dollar amount\.$/, (label) => `${fieldEs(label)}: escribe un monto en dólares.`],
  [/^(.+) must be a whole number\.$/, (label) => `${fieldEs(label)}: escribe un número entero.`],
  [/^(.+) is away that day\.$/, (name) => `${name} no está disponible ese día.`],
  [/^(.+) is not an approved member yet\.$/, (name) => `A ${name} todavía no se le ha aprobado como miembro.`],
  [
    /^(.+) has not said they are free that day\. Ask them to add the date under Time off, or ask someone else\.$/,
    (name) => `${name} no ha dicho que esté libre ese día. Pídele que agregue la fecha en Días libres, o pídeselo a otra persona.`,
  ],
  [/^A conference can keep up to (\S+) kinds of its own\.$/, (count) => `Una conferencia puede tener hasta ${count} tipos propios.`],
  [
    /^A deposit holds up to (\S+) gifts\. Record the rest as a second deposit\.$/,
    (count) => `Un depósito lleva hasta ${count} donativos. Anota el resto como un segundo depósito.`,
  ],
  [/^A voucher can be taken back for (\S+) days after it was given\.$/, (count) => `Un vale se puede anular hasta ${count} días después de entregarlo.`],
  [/^Bring in up to (\S+) neighbors at a time\.$/, (count) => `Agrega hasta ${count} vecinos a la vez.`],
  [/^Bring in up to (\S+) payees at a time\.$/, (count) => `Agrega a tu lista de pagos hasta ${count} nombres a la vez.`],
  [/^Bring in up to (\S+) people at a time\.$/, (count) => `Agrega hasta ${count} personas a la vez.`],
  [/^Bring in up to (\S+) requests at a time\.$/, (count) => `Agrega hasta ${count} peticiones a la vez.`],
  [/^Enter how many vouchers, from 1 to (\S+)\.$/, (count) => `Escribe cuántos vales, de 1 a ${count}.`],
  [/^Keep the check number under (\S+) characters\.$/, (count) => `El número de cheque debe tener menos de ${count} caracteres.`],
  [/^Keep the name under (\S+) characters\.$/, (count) => `El nombre debe tener menos de ${count} caracteres.`],
  [/^Keep the note under (\S+) characters\.$/, (count) => `La nota debe tener menos de ${count} caracteres.`],
  [/^Keep the reason under (\S+) characters\.$/, (count) => `El motivo debe tener menos de ${count} caracteres.`],
];

/** The English sentence a refusal pattern was cut from, with its dynamic parts put back. */
export function sayLikeEnglish(pattern: RegExp, parts: string[]): string {
  let at = 0;
  return pattern.source
    .replace(/^\^|\$$/g, "")
    .replace(/\((?:\.\+|\\S\+)\)/g, () => parts[at++] ?? "")
    .replace(/\\(.)/g, "$1");
}
