import { keepTitle } from "./titles";
import type { Language } from "./sets";

/**
 * The sample conference's own names, titles and places, as its seed types them (convex/sampleData.ts), in Spanish.
 * A Spanish reader of the sample meets them in their language; a real conference's typed words are never touched,
 * and nothing here is read from or written to the database: the seed's exact English is the key, on the screen only.
 * People's names, businesses and agencies are proper names and stay. These are the seed's own lines; a call's notes,
 * what a caller said and a visit's findings stay as typed.
 */
const es: Readonly<Record<string, string>> = {
  // Teams
  "Help line": "Línea de ayuda",
  "Home visitors": "Visitadores a domicilio",
  Pantry: "Despensa",
  // Commitments and the meeting
  "Help line morning": "Línea de ayuda, mañana",
  "Help line afternoon": "Línea de ayuda, tarde",
  "Pantry morning": "Despensa, mañana",
  "Conference meeting": "Reunión de la conferencia",
  // Places
  "Parish office": "Oficina parroquial",
  "Parish hall": "Salón parroquial",
  "Parish hall, room 2": "Salón parroquial, sala 2",
  "Meet at the parish office": "Encuentro en la oficina parroquial",
  // Tasks and the announcement
  "Restock the food pantry shelf": "Reponer el estante de la despensa",
  "Bring the visit sheets to Tuesday's meeting": "Llevar las hojas de visita a la reunión del martes",
  "Send thank-you notes for the fall collection": "Enviar notas de agradecimiento por la colecta de otoño",
  "Winter coat drive starts next week": "La colecta de abrigos de invierno empieza la próxima semana",
  "Bring coats to the parish office. Home visitors, ask each family for sizes.":
    "Lleven los abrigos a la oficina parroquial. Visitadores a domicilio, pregunten a cada familia las tallas.",
  // What each team does
  "Answers the conference phone and returns calls the next morning.": "Atiende el teléfono de la conferencia y devuelve las llamadas a la mañana siguiente.",
  "Visits neighbors at home, always in pairs.": "Visita a los vecinos en su casa, siempre de dos en dos.",
  "Sorts donations and packs food bags on Saturday mornings.": "Ordena las donaciones y prepara las bolsas de comida los sábados por la mañana.",
  // Treasury: the conference's own kinds, the voucher shelf, and who they came from
  "Bake sale": "Venta de pasteles",
  "Bus tokens": "Fichas de autobús",
  "Furniture voucher": "Vale de muebles",
  "Clothing voucher": "Vale de ropa",
  "Conference thrift store": "Tienda de segunda mano de la conferencia",
  "Parish hall table": "Mesa del salón parroquial",
  "Spring bake sale after the 10 o'clock Mass": "Venta de pasteles de primavera después de la misa de las 10",
  "Forty tokens for the help line to hand out": "Cuarenta fichas para que la línea de ayuda las reparta",
  // Who lives in a household, as the sample seed says it
  "Head of household": "Cabeza de familia",
  Mother: "Madre",
  Father: "Padre",
  Grandmother: "Abuela",
  Husband: "Esposo",
  Wife: "Esposa",
  Sister: "Hermana",
  Brother: "Hermano",
  Aunt: "Tía",
  Son: "Hijo",
  Daughter: "Hija",
  Grandson: "Nieto",
  Granddaughter: "Nieta",
  // Treasury: what each request was for, in the one line the seed gives it
  "Behind on this month's rent after reduced hours": "Atraso en el alquiler de este mes por menos horas de trabajo",
  "Short on rent after a medical bill": "Falta para el alquiler después de una cuenta médica",
  "Needs help with a security deposit": "Necesita ayuda con un depósito de garantía",
  "Shut-off notice on the electric bill": "Aviso de corte en la cuenta de luz",
  "Past-due water bill": "Cuenta de agua vencida",
  "Gas bill before the cold weather": "Cuenta de gas antes del frío",
  "Groceries until the next paycheck": "Comida hasta el próximo pago",
  "Food for the week for a family with children": "Comida de la semana para una familia con niños",
  "Furniture voucher after a move": "Vale de muebles después de una mudanza",
  "Winter coats for the children": "Abrigos de invierno para los niños",
  "Prescription co-pay": "Copago de una receta",
  "Bus pass to get to a new job": "Pase de autobús para llegar a un trabajo nuevo",
  "One month's rent after reduced hours at work.": "Un mes de alquiler después de menos horas de trabajo.",
  "Electric bill with a shut-off notice.": "Cuenta de luz con aviso de corte.",
  // Treasury: the notes on money in and out, and where it came from
  "Balance carried forward": "Saldo del año anterior",
  "Shelf-stable food for the pantry": "Alimentos no perecederos para la despensa",
  "Annual solidarity contribution": "Contribución solidaria anual",
  "Paper, postage and phone line": "Papel, correo y línea telefónica",
  "Fifth-Sunday and poor-box collection": "Colecta del quinto domingo y del cepillo de los pobres",
  "Designated for rent and utilities": "Destinado a alquiler y servicios",
  "Pledges collected after the walk": "Promesas recogidas después de la caminata",
  "Left at the parish office": "Dejado en la oficina parroquial",
  "Carried to the bank after the collection was counted": "Llevado al banco después de contar la colecta",
  "From the conference thrift store": "De la tienda de segunda mano de la conferencia",
  "Anonymous gift": "un donativo anónimo",
  "Parish family": "una familia de la parroquia",
  // Time off
  "Away with family.": "Fuera con la familia.",
  "Walk pledges": "las promesas de la caminata",
};

/** A title the seed writes around a person's name: the words are put in Spanish, the name is kept whole. */
const withName: readonly (readonly [string, string])[] = [["Home visit with ", "Visita domiciliaria con "]];

/** The seed's exact English names, for the test that holds this table to the seed. */
export const sampleNames = Object.keys(es);

const asTyped = (typed: string) => typed;
const inSpanish = (typed: string) => {
  const known = es[typed];
  if (known) return known;
  // A call's note is the request's line with a full stop: the same line, said the same way everywhere.
  const line = typed.endsWith(".") ? es[typed.slice(0, -1)] : undefined;
  if (line) return `${line}.`;
  const around = withName.find(([start]) => typed.startsWith(start));
  return around ? around[1] + typed.slice(around[0].length) : typed;
};

/** The name the backend gives a removed member's visits and hours (convex/people.ts formerMember), as a Spanish reader is told it. */
const formerMember = { typed: "A former member", es: "Un miembro anterior" };
const formerInSpanish = (typed: string) => (typed === formerMember.typed ? formerMember.es : typed);
const allInSpanish = (typed: string) => formerInSpanish(inSpanish(typed));
// Every name said keeps a title such as "St." joined to it, so it never breaks after the title.
const titledAsTyped = (typed: string) => keepTitle(asTyped(typed));
const titledAllInSpanish = (typed: string) => keepTitle(allInSpanish(typed));
const titledFormerInSpanish = (typed: string) => keepTitle(formerInSpanish(typed));

/**
 * How a name the backend wrote is said to this reader. In Spanish a removed member is "Un miembro anterior" in any
 * conference; the sample's own names are said in Spanish too. Anything else comes back as typed. The same function
 * each time, so nothing that names it runs again.
 */
export const sampleSayer = (sample: boolean, language: Language) =>
  language !== "es" ? titledAsTyped : sample ? titledAllInSpanish : titledFormerInSpanish;
