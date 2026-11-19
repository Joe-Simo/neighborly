import type { Language } from "@/lib/words";
import { sampleYear } from "@/lib/sample-year";

// The figures are the sample's own (src/lib/sample-year.ts, held to the seed by convex/sampleYear.test.ts), never typed here.
// es-US writes numbers as en-US does, so one format serves both languages.
const whole = new Intl.NumberFormat("en-US").format;
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format;
const calls = whole(sampleYear.calls), visits = whole(sampleYear.visits);
const help = dollars(sampleYear.helpPaid / 100), weekHelp = dollars(sampleYear.weekHelp / 100);

/** One day of the week: when it is, what happened, and the room of the app it happened in. `picture` names the room's relief. */
type WeekDay = { day: string; title: string; copy: string[]; room: string; picture: "call" | "visit" | "help" | "year"; alt: string };

/** A made-up week at a made-up conference, told in four steps. English is the source; Spanish says the same, day for day. */
const en = {
  path: "/about/a-week",
  title: "A week at St.\u00a0Example",
  tab: "A week at St. Example · Kind Helps",
  description: "One made-up week at a made-up conference: a call to the help line, a visit in pairs, the write-up and the yes, and the year’s count.",
  preview: "A call, a visit, a yes, and the year. One made-up week, told in four steps.",
  enter: "Enter Kind Helps",
  translated: null as null | [string, string, string],
  lede: "St. Example is a made‑up parish, and everyone in this week is made up too. It is told around a request in the sample conference’s records; the days and times are only to tell it.",
  days: [
    { day: "Monday, 9:12 a.m.", picture: "call", room: "The help line", title: "A call comes in.", alt: "Two paper hands lifting a telephone receiver from its cradle, its cord curling across the sheet.",
      copy: ["A mother of two leaves a message: the power bill is past due and the shutoff notice says Friday. The member on the phone this week writes it down once, in her words.", "Because of the date, the call rises to the top in ochre, waiting. By 10:40 it is returned, and a visit is set for Wednesday."] },
    { day: "Wednesday, 6:30 p.m.", picture: "visit", room: "Visits in pairs", title: "Two members visit.", alt: "A paper hand knocking on a green door, the other open and waiting.",
      copy: ["Two members go to the home together, as they always do. They sit at the kitchen table and listen, about the bill and about the rest.", "Each member’s own week shows the visit, the street and the other member’s name. On their phone calendars it shows only the time and the street, never the neighbor’s name or need."] },
    { day: "Thursday, 8:05 p.m.", picture: "help", room: "The ledger", title: "The write-up, and the yes.", alt: "A paper hand passing an envelope, its flap open, into another’s open palm.",
      copy: [`One of the two writes up what they saw and what was asked. The conference meets that evening and says yes: ${weekHelp} toward the power bill.`, "The neighbor hears before Friday."] },
    { day: "And at the year’s end", picture: "year", room: "The yearly report", title: "It counts itself.", alt: "An open paper book with a ribbon marker, a hand resting flat on its page.",
      copy: [`Nobody adds the week up by hand. That call is one of ${calls} the sample conference took in its year, that visit one of ${visits}, and that ${weekHelp} part of ${help} in help.`, "When the year ends, the report is ready. The president checks the totals, then prints."] },
  ] as WeekDay[],
  last: "Every name, number and household in the sample is made up. Kind Helps is independent, and not affiliated with or endorsed by the Society of St. Vincent de Paul.",
  open: "Open the sample conference",
};

const es: typeof en = {
  path: "/sobre/una-semana",
  title: "Una semana en\u00a0San\u00a0Ejemplo",
  tab: "Una semana en San Ejemplo · Kind Helps",
  description: "Una semana inventada en una conferencia inventada: una llamada a la línea de ayuda, una visita en pareja, las notas y el sí, y las cifras del año.",
  preview: "Una llamada, una visita, un sí y el año. Una semana inventada, contada en cuatro pasos.",
  enter: "Entrar a Kind Helps",
  translated: null,
  lede: "San Ejemplo es una parroquia inventada, y todas las personas de esta semana también lo son. Se cuenta a partir de una petición de los registros de la conferencia de muestra; los días y las horas son solo para contarla.",
  days: [
    { day: "Lunes, 9:12 a. m.", picture: "call", room: "La línea de ayuda", title: "Entra una llamada.", alt: "Dos manos de papel que levantan el auricular de un teléfono, con el cable enroscado sobre la hoja.",
      copy: ["Una madre de dos hijos deja un mensaje: el recibo de la luz está vencido y el aviso de corte dice el viernes. El miembro que atiende el teléfono esta semana la anota una sola vez, con sus palabras.", "Por la fecha, la llamada pasa arriba en ocre, esperando. A las 10:40 ya se devolvió, y la visita queda para el miércoles."] },
    { day: "Miércoles, 6:30 p. m.", picture: "visit", room: "Visitas en pareja", title: "Dos miembros visitan.", alt: "Una mano de papel que llama a una puerta verde, y la otra abierta, esperando.",
      copy: ["Dos miembros van juntos a la casa, como siempre. Se sientan a la mesa de la cocina y escuchan: el recibo y todo lo demás.", "La semana de cada miembro muestra la visita, la calle y el nombre del otro miembro. En el calendario del teléfono solo aparecen la hora y la calle, nunca el nombre ni la necesidad de la persona."] },
    { day: "Jueves, 8:05 p. m.", picture: "help", room: "El libro de cuentas", title: "Las notas, y el sí.", alt: "Una mano de papel que pone un sobre, con la solapa abierta, en la palma abierta de otra.",
      copy: [`Uno de los dos escribe lo que vieron y lo que se pidió. La conferencia se reúne esa noche y dice que sí: ${weekHelp} para el recibo de la luz.`, "Antes del viernes, la noticia le llega a quien pidió la ayuda."] },
    { day: "Y al final del año", picture: "year", room: "El informe anual", title: "Se cuenta solo.", alt: "Un libro de papel abierto con una cinta de marcador y una mano apoyada sobre la página.",
      copy: [`Nadie suma la semana a mano. Esa llamada es una de las ${calls} que la conferencia de muestra recibió en su año, esa visita una de ${visits}, y esos ${weekHelp} parte de ${help} en ayuda.`, "Cuando termina el año, el informe está listo. El presidente revisa los totales y lo imprime."] },
  ],
  last: "Todos los nombres, números y hogares de la muestra son inventados. Kind Helps es independiente, y no tiene afiliación ni respaldo de la Sociedad de San Vicente de Paúl.",
  open: "Abrir la conferencia de muestra",
};

export const weekWords = { en, es } satisfies Record<Language, typeof en>;
