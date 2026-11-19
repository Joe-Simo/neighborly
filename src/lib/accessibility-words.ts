import type { Language } from "@/lib/words";
import type { PublicWords } from "@/lib/privacy-words";

/**
 * Every word of the accessibility page. Each figure is the one its test report gives (project files, Nov 19):
 * axe-pass/report.md, large-text-walk/table.md, sheet-walk/walk.md and forced-colors/. English is the source;
 * Spanish says the same, section for section.
 */
const en: PublicWords = {
  path: "/accessibility",
  title: "Accessibility",
  tab: "Accessibility · Kind Helps",
  description: "What was tested in Kind Helps for people who use a screen reader, a keyboard, large text or forced colors, what the tests found, and what is still short.",
  preview: "What was tested in Kind Helps, what the tests found, and what is still short.",
  enter: "Enter Kind Helps",
  translated: null,
  sections: [
    { title: "What we aim for", blocks: ["Kind Helps is built to meet WCAG 2.2 at levels A and AA, in English and in Spanish. This page says what was tested on November 19, 2026, and what each test found. A test passing means what it checked passed on that day; it is not a promise that nothing is wrong."] },
    { title: "What was tested", blocks: [[
      ["Automated checks:", "axe-core 4.14 found no violations of WCAG 2.0, 2.1 or 2.2 A and AA on the 10 public pages (including sign-in and the page not found), on each of the 13 rooms of the app in English and Spanish, as an owner and as a member, and on the first sheet in each room, all at 390 and 1440 pixels wide. Lighthouse 12.6 scored 100 for accessibility on all 66 of its runs."],
      ["Large text:", "each room in English and Spanish at 200% zoom, at the largest iOS text size at 360 and 1440 pixels, and reflowed to 320 pixels: 104 checks. The first walk found faults in 7 rooms, which were fixed. After the fixes 97 pass clean and 7 show something we chose on purpose, listed under known limits."],
      ["Keyboard:", "52 sheets and dialogs, each at 360 and 1440 pixels: opened from the keyboard, focus kept inside, a single name for each, Escape closes it, and focus goes back to what opened it. All pass. Six of them had a calendar that read as a second dialog; that was fixed, then checked again."],
      ["Forced colors:", "the week, help line, neighbors, home visits, commitments and treasury, at 390 and 1440 pixels. Marks that showed meaning by color alone, such as a tick or a waiting ring, now keep their shape in the system's own colors."],
    ]] },
    { title: "Known limits", blocks: [[
      ["A written visit's notes", "show as one line ending in an ellipsis in the list, even at large text. The full notes open on the visit."],
      ["An email address", "may break onto a new line partway through at large text, and so may a hyphenated word such as thank-you. A person's name is never split."],
      ["Color contrast on art:", "where words sit near the painted paper art, axe cannot measure the contrast and asks for a person to look. Each of these was checked by eye; the words sit on solid paper."],
      ["Where we tested:", "the rooms were tested with the app's sample conference, using the same screens a signed-in member sees. We have not yet tested with every screen reader or with people who use one every day."],
    ]] },
  ],
  questions: {
    title: "Tell us what gets in your way",
    newTab: "(opens in a new tab)",
    before: "If something in Kind Helps is hard to reach, read or use, open an issue on the project’s public page: ",
    after: ". Say what you were trying to do and what you use, such as a screen reader or a zoom setting. Do not put personal details in a public issue.",
    independent: "Kind Helps is an independent project. It is not affiliated with or endorsed by the Society of St. Vincent de Paul.",
  },
};

const es: PublicWords = {
  path: "/accesibilidad",
  title: "Accesibilidad",
  tab: "Accesibilidad · Kind Helps",
  description: "Qué se probó en Kind Helps para quien usa un lector de pantalla, el teclado, letra grande o colores forzados, qué encontraron las pruebas y qué falta todavía.",
  preview: "Qué se probó en Kind Helps, qué encontraron las pruebas y qué falta todavía.",
  enter: "Entrar a Kind Helps",
  translated: ["Esta página es una traducción. Si algo difiere, vale la ", "página en inglés", "."],
  sections: [
    { title: "Lo que buscamos", blocks: ["Kind Helps está hecho para cumplir las WCAG 2.2 en los niveles A y AA, en inglés y en español. Esta página dice qué se probó el 19 de noviembre de 2026 y qué encontró cada prueba. Que una prueba pase quiere decir que lo que revisó pasó ese día; no es una promesa de que nada falla."] },
    { title: "Qué se probó", blocks: [[
      ["Revisiones automáticas:", "axe-core 4.14 no encontró fallos de las WCAG 2.0, 2.1 o 2.2 A y AA en las 10 páginas públicas (incluidas la de entrar y la de página no encontrada), en cada una de las 13 salas de la app en inglés y en español, como responsable y como miembro, ni en la primera hoja de cada sala, todo a 390 y 1440 píxeles de ancho. Lighthouse 12.6 dio 100 en accesibilidad en sus 66 pasadas."],
      ["Letra grande:", "cada sala en inglés y en español con zoom al 200 %, con el tamaño de letra más grande de iOS a 360 y 1440 píxeles, y reacomodada a 320 píxeles: 104 revisiones. La primera vuelta encontró fallos en 7 salas, que se corrigieron. Después de corregirlas, 97 pasan limpias y 7 muestran algo que elegimos a propósito, que se explica en los límites conocidos."],
      ["Teclado:", "52 hojas y diálogos, cada uno a 360 y 1440 píxeles: se abren con el teclado, el foco se queda dentro, cada uno tiene un solo nombre, Escape lo cierra y el foco vuelve a lo que lo abrió. Todos pasan. Seis tenían un calendario que se leía como un segundo diálogo; se corrigió y se volvió a revisar."],
      ["Colores forzados:", "la semana, la línea de ayuda, los vecinos, las visitas, los compromisos y la tesorería, a 390 y 1440 píxeles. Las marcas que daban su sentido solo con el color, como una palomita o un anillo de espera, ahora conservan su forma con los colores del sistema."],
    ]] },
    { title: "Límites conocidos", blocks: [[
      ["Las notas de una visita escrita", "se ven en la lista como una sola línea con puntos suspensivos, aun con letra grande. Las notas completas se abren en la visita."],
      ["Una dirección de correo", "puede partirse a mitad de línea con letra grande, y también una palabra con guion. El nombre de una persona nunca se parte."],
      ["Contraste sobre el arte:", "donde las palabras están cerca del arte de papel pintado, axe no puede medir el contraste y pide que una persona lo mire. Cada caso se revisó a ojo; las palabras están sobre papel liso."],
      ["Dónde probamos:", "las salas se probaron con la conferencia de ejemplo de la app, con las mismas pantallas que ve un miembro que entró. Todavía no hemos probado con todos los lectores de pantalla ni con personas que usan uno cada día."],
    ]] },
  ],
  questions: {
    title: "Dinos qué te estorba",
    newTab: "(se abre en una pestaña nueva)",
    before: "Si algo en Kind Helps es difícil de alcanzar, leer o usar, abre un reporte («issue») en la página pública del proyecto: ",
    after: ". Di qué intentabas hacer y qué usas, como un lector de pantalla o un ajuste de zoom. No pongas datos personales en un reporte público.",
    independent: "Kind Helps es un proyecto independiente. No está afiliado a la Sociedad de San Vicente de Paúl ni cuenta con su respaldo.",
  },
};

export const accessibilityWords: Record<Language, PublicWords> = { en, es };
