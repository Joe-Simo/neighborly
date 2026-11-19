import type { Language } from "@/lib/words";

/** A paragraph, or a list whose items open with a few strong words. */
type Block = string | [lead: string, rest: string][];

/** Every word of the privacy page. English is the source; Spanish says the same, section for section. */
const en = {
  path: "/privacy",
  title: "Privacy",
  tab: "Privacy — Kind Helps",
  description: "What a conference keeps in Kind Helps, who can see it, what the assistant is sent, and how a record, a person or a whole conference is removed.",
  preview: "What a conference keeps in Kind Helps, who can see it, and how it is removed.",
  enter: "Enter Kind Helps",
  /** Under the title of a page that is a translation: [before the link, the link to the English page, after it]. English has none. */
  translated: null as null | [string, string, string],
  sections: [
    { title: "Your records belong to your conference", blocks: ["Kind Helps is free software for a conference to keep its own work in one place. What a conference writes here belongs to the conference, not to us."] },
    { title: "What a conference keeps here", blocks: [[
      ["Its members:", "name, email, role, teams, availability, time off, commitments, tasks, meetings and announcements."],
      ["The neighbors it helps:", "name, phone, email, address, how many adults and children, language and notes. If the conference chooses to record them: who lives in the household by relationship and birth year (no names, no birth dates), monthly income and expenses, and landlord or utility account details."],
      ["Its work:", "calls to the help line, requests for help and home visits."],
      ["Its money:", "the ledger, deposits, who is paid, vouchers and bank statement balances."],
    ]] },
    { title: "Who can see it", blocks: [
      "Only people signed in to that conference. Neighbors’ records, calls, requests, visits and the ledger open to the conference’s owner and coordinators only. Other members see their own commitments and teams, and for a visit they are asked to make, its time, its street and the other visitor’s name. One conference cannot see another’s records.",
      "Opening a neighbor’s record is written in the conference’s own log, with who and when. So is each request to see a full account number, and each download of the conference’s records. A list or search of neighbors shows each household’s name, street, size, when it was last helped, and any open request or planned visit, and is not logged. Phone numbers, email, notes, household members, money and accounts reach the screen only when a record is opened.",
    ] },
    { title: "Signing in and where records are held", blocks: ["Sign-in is handled by Clerk, which keeps your email address and your sign-in. The conference’s records are held in a Convex database. The site is served by Vercel. Each of these companies has its own privacy terms, which apply to what it holds."] },
    { title: "The assistant", blocks: [
      "The assistant reads a call note, the notes on requests and visits when the year is checked, and the words a person types to name a new team, and answers set questions about them: what kind of help is asked for, whether a call is urgent, whether a record looks finished. It does not write text. A person approves every draft before a request is saved. A call it puts first shows why, and anyone on the help line can move it back.",
      "Everything sent to the assistant first passes through one step that takes out names, phone numbers, email addresses and street addresses. On any draft, “What the assistant saw” shows the note exactly as it was sent. The assistant is Jev, run by Typesafe.",
      "That step works by fixed rules, so an unusual spelling could slip through. Write in a note only what the conference would be content to have read.",
    ] },
    { title: "What we do not do", blocks: [
      "No advertising. We do not sell or share records. The site loads no analytics or tracking scripts. The only outside services it uses are the ones named on this page.",
      "So that it can open without a connection, the app keeps its own pages, pictures and fonts on your device. It does not keep your conference’s records there.",
    ] },
    { title: "The sample conference", blocks: ["“Look around a sample conference” opens a conference of made-up people with made-up phone numbers. It is rebuilt every night, and anything typed into it is thrown away then."] },
    { title: "Removing a record, a person or a whole conference", blocks: [
      "Ask the owner of your conference first. The records are theirs, and only an owner can remove them. Each removal asks the owner to type the name, and it cannot be undone.",
      [
        ["A neighbor’s record.", "The record is erased, and the name and details are taken out of that household’s calls, requests, visits and ledger lines. The year’s totals stay as they were, with no name."],
        ["A person in the conference.", "Their name, email, language, teams, availability, time off and the link to their sign-in are erased. The visits and hours they gave still count in the year, signed “A former member”."],
        ["A whole conference.", "The owner is offered a download of the records first. Then everything the conference kept here is removed."],
      ],
      "One limit, said plainly: a name someone typed by hand somewhere else, such as in a note on another record, a task or an announcement, is not searched for. The owner should look for those and change them.",
      "Your sign-in itself is held by Clerk. Removing a person here removes their place in the conference, not their Clerk account.",
    ] },
  ] satisfies { title: string; blocks: Block[] }[],
  questions: {
    title: "Questions",
    /** Said only to a screen reader, after the address. */
    newTab: "(opens in a new tab)",
    /** The project's address stands between these two. */
    before: "For the software itself, or if you cannot reach an owner, open an issue on the project’s public page: ",
    after: ". Do not put personal details in a public issue.",
    independent: "Kind Helps is an independent project. It is not affiliated with or endorsed by the Society of St. Vincent de Paul.",
  },
};

const es: typeof en = {
  path: "/privacidad",
  title: "Privacidad",
  tab: "Privacidad — Kind Helps",
  description: "Qué guarda una conferencia en Kind Helps, quién puede verlo, qué se le envía al asistente y cómo se elimina un registro, una persona o una conferencia entera.",
  preview: "Qué guarda una conferencia en Kind Helps, quién puede verlo y cómo se elimina.",
  enter: "Entrar a Kind Helps",
  translated: ["Esta página es una traducción. Si algo difiere, vale la ", "página en inglés", "."],
  sections: [
    { title: "Tus registros pertenecen a tu conferencia", blocks: ["Kind Helps es un programa gratuito para que una conferencia guarde su propio trabajo en un solo lugar. Lo que una conferencia escribe aquí pertenece a la conferencia, no a nosotros."] },
    { title: "Qué guarda aquí una conferencia", blocks: [[
      ["Sus miembros:", "nombre, correo electrónico, rol, equipos, disponibilidad, días libres, compromisos, tareas, reuniones y avisos."],
      ["Los vecinos a quienes ayuda:", "nombre, teléfono, correo electrónico, dirección, cuántos adultos y niños, idioma y notas. Si la conferencia decide anotarlos: quién vive en el hogar, por parentesco y año de nacimiento (sin nombres ni fechas de nacimiento), ingresos y gastos mensuales, y datos de la cuenta del dueño de la vivienda o de los servicios."],
      ["Su trabajo:", "llamadas a la línea de ayuda, peticiones de ayuda y visitas domiciliarias."],
      ["Su dinero:", "el libro, los depósitos, a quién se le paga, los vales y los saldos de los estados de cuenta del banco."],
    ]] },
    { title: "Quién puede verlo", blocks: [
      "Solo las personas que iniciaron sesión en esa conferencia. Los registros de los vecinos, las llamadas, las peticiones, las visitas y el libro se abren solo para el responsable y los coordinadores de la conferencia. Los demás miembros ven sus propios compromisos y equipos y, de una visita a la que se les pide ir, la hora, la calle y el nombre del otro visitador. Una conferencia no puede ver los registros de otra.",
      "Cada vez que se abre el registro de un vecino, queda escrito en la bitácora de la propia conferencia, con quién y cuándo. Lo mismo pasa con cada petición de ver un número de cuenta completo y con cada descarga de los registros de la conferencia. Una lista o búsqueda de vecinos muestra de cada hogar el nombre, la calle, el tamaño, cuándo recibió ayuda por última vez y cualquier petición abierta o visita planeada, y no se anota en la bitácora. Los teléfonos, el correo electrónico, las notas, los miembros del hogar, el dinero y las cuentas llegan a la pantalla solo cuando se abre un registro.",
    ] },
    { title: "El inicio de sesión y dónde se guardan los registros", blocks: ["Del inicio de sesión se encarga Clerk, que guarda tu correo electrónico y tu inicio de sesión. Los registros de la conferencia se guardan en una base de datos de Convex. El sitio lo sirve Vercel. Cada una de estas empresas tiene sus propios términos de privacidad, que se aplican a lo que guarda."] },
    { title: "El asistente", blocks: [
      "El asistente lee la nota de una llamada, las notas de las peticiones y las visitas cuando se revisa el año, y las palabras que alguien escribe para nombrar un equipo nuevo, y responde preguntas fijas sobre ellas: qué tipo de ayuda se pide, si una llamada es urgente, si un registro parece completo. No escribe texto. Una persona aprueba cada borrador antes de que se guarde una petición. Una llamada que pone primero muestra el motivo, y cualquiera de la línea de ayuda puede regresarla a su lugar.",
      "Todo lo que se le envía al asistente pasa primero por un paso que quita nombres, números de teléfono, correos electrónicos y direcciones. En cualquier borrador, «Lo que vio el asistente» muestra la nota exactamente como se envió. El asistente es Jev, operado por Typesafe.",
      "Ese paso funciona con reglas fijas, así que una forma poco común de escribir algo podría pasar sin que se quite. Escribe en una nota solo lo que a la conferencia no le importaría que se leyera.",
    ] },
    { title: "Lo que no hacemos", blocks: [
      "No hay publicidad. No vendemos ni compartimos registros. El sitio no carga programas de analítica ni de rastreo. Los únicos servicios externos que usa son los que se nombran en esta página.",
      "Para poder abrirse sin conexión, la aplicación guarda en tu dispositivo sus propias páginas, imágenes y tipos de letra. No guarda ahí los registros de tu conferencia.",
    ] },
    { title: "La conferencia de muestra", blocks: ["«Recorrer una muestra» abre una conferencia de personas inventadas con teléfonos inventados. Se vuelve a crear cada noche, y todo lo que se haya escrito en ella se descarta entonces."] },
    { title: "Eliminar un registro, una persona o una conferencia entera", blocks: [
      "Pregunta primero al responsable de tu conferencia. Los registros son de la conferencia, y solo un responsable puede eliminarlos. En cada eliminación se le pide al responsable que escriba el nombre, y no se puede deshacer.",
      [
        ["El registro de un vecino.", "El registro se borra, y el nombre y los datos se quitan de las llamadas, las peticiones, las visitas y las líneas del libro de ese hogar. Los totales del año quedan como estaban, sin nombre."],
        ["Una persona de la conferencia.", "Se borran su nombre, correo electrónico, idioma, equipos, disponibilidad, días libres y el vínculo con su inicio de sesión. Las visitas y las horas que dio siguen contando en el año, firmadas «A former member» (un miembro anterior)."],
        ["Una conferencia entera.", "Primero se le ofrece al responsable una descarga de los registros. Después se elimina todo lo que la conferencia guardó aquí."],
      ],
      "Un límite, dicho con claridad: un nombre que alguien escribió a mano en otro lugar, por ejemplo en una nota de otro registro, en una tarea o en un aviso, no se busca. El responsable debe buscarlos y cambiarlos.",
      "Tu inicio de sesión lo guarda Clerk. Eliminar aquí a una persona le quita su lugar en la conferencia, no su cuenta de Clerk.",
    ] },
  ],
  questions: {
    title: "Preguntas",
    newTab: "(se abre en una pestaña nueva)",
    before: "Sobre el programa en sí, o si no puedes comunicarte con un responsable, abre un reporte («issue») en la página pública del proyecto: ",
    after: ". No pongas datos personales en un reporte público.",
    independent: "Kind Helps es un proyecto independiente. No está afiliado a la Sociedad de San Vicente de Paúl ni cuenta con su respaldo.",
  },
};

export const privacyWords: Record<Language, typeof en> = { en, es };
