import type { Language } from "./sets";

/**
 * The sample conference's own names, titles and places, as its seed types them (convex/sampleData.ts), in Spanish.
 * A Spanish reader of the sample meets them in their language; a real conference's typed words are never touched,
 * and nothing here is read from or written to the database: the seed's exact English is the key, on the screen only.
 * People's names, businesses and agencies are proper names and stay. Notes, descriptions and what a caller said
 * stay as typed.
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
};

/** A title the seed writes around a person's name: the words are put in Spanish, the name is kept whole. */
const withName: readonly (readonly [string, string])[] = [["Home visit with ", "Visita domiciliaria con "]];

/** The seed's exact English names, for the test that holds this table to the seed. */
export const sampleNames = Object.keys(es);

const asTyped = (typed: string) => typed;
const inSpanish = (typed: string) => {
  const known = es[typed];
  if (known) return known;
  const around = withName.find(([start]) => typed.startsWith(start));
  return around ? around[1] + typed.slice(around[0].length) : typed;
};

/**
 * How one of the sample's names is said to this reader. Anything that is not the sample, not Spanish, or not one of
 * the seed's own names comes back as it was typed. The same function each time, so nothing that names it runs again.
 */
export const sampleSayer = (sample: boolean, language: Language) => (sample && language === "es" ? inSpanish : asTyped);
