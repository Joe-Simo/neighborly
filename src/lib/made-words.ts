import type { Language } from "@/lib/words";

/** A paragraph, or a list whose items open with a few strong words; a list item may carry the colour it names. */
export type MadeBlock = string | { lead: string; rest: string; tone?: "waiting" | "wrong" | "done" }[];

/** A section of the page; one may carry a picture from the painting's own working files, with what it shows. */
export type MadeSection = { title: string; blocks: MadeBlock[]; figure?: { src: string; alt: string; caption: string } };

/** Every word of the page on how Kind Helps was made. English is the source; Spanish says the same, section for section. */
const en = {
  path: "/about/how-we-made-it",
  title: "How we made it",
  tab: "How we made it — Kind Helps",
  description: "How Kind Helps was made: the painting, the rules its paper keeps, how the assistant is held to a person’s say, and why it is free for every conference.",
  preview: "The painting, the paper’s rules, the assistant, and a promise: free for every conference.",
  enter: "Enter Kind Helps",
  translated: null as null | [string, string, string],
  courtyard: {
    label: "The courtyard painting, its paper sheets drawn apart, laid back together as the page scrolls",
    apart: "Six sheets cut along the painting’s own depth, and the people at the table on a seventh.",
    whole: "Laid together, they are the courtyard behind the doors.",
    hold: "Draw the sheets apart",
    hint: "Drag the courtyard up or down, or use the arrow keys, to draw its sheets apart.",
    /** Said by the slider: whole, part apart ({n} is the percent), and fully apart. */
    amount: ["Whole", "{n}% apart", "All seven sheets apart"] as [string, string, string],
  },
  sections: [
    { title: "Why it exists", blocks: [
      "Kind Helps is for the volunteers of St. Vincent de Paul conferences: the people who answer the help line, visit homes and keep the books. Many conferences keep this work on paper, in spreadsheets or in ServWare. Kind Helps keeps it in one place, in English and Spanish, on a phone or at a desk.",
      [
        { lead: "A neighbor’s dignity.", rest: "Help is paid to the landlord, utility or store, never to the neighbor. Visits are made in pairs. A family’s name, phone and address are taken out before a note reaches the assistant." },
        { lead: "A volunteer’s time.", rest: "A call note becomes a draft request, and the pair for a visit is suggested from who is free." },
        { lead: "Honest books.", rest: "Every gift and payment is recorded. A mistake is put right with a new entry, never erased." },
      ],
      "It is free because no conference should pay to help its neighbors.",
    ] },
    { title: "One painting, made of paper", blocks: [
      "Kind Helps is drawn as layered paper relief: cut sheets laid on one another, each with its own edge and its own shadow. The courtyard behind the doors, the hands passing the card and the four pictures of the story are one painting in that material.",
      "The painted artwork was made with an AI image tool from written direction, then chosen and edited by hand. The page never paints over it, recolors it or crops into it. What moves is the paper around it.",
    ] },
    { title: "Cut along its own depth", blocks: [
      "The courtyard was painted whole. To let it move without painting anything new, it was cut along its own depth into six sheets, with the people at the table on a seventh. Every cut edge is the painting’s, so laid together the sheets are the painting again.",
    ], figure: { src: "/assets/made/courtyard-depth-960.webp", alt: "The courtyard in shades of gray: the sky black, the far cloister dark, the paving and pillars nearly white.", caption: "The map the cut followed: the courtyard’s depth, far in dark and near in light." } },
    { title: "The rules the paper keeps", blocks: [
      "A ministry’s software is read by tired people at the end of a long day. So every screen follows a few rules that do not bend.",
      [
        { lead: "Ochre means waiting.", rest: "A call not yet returned, a request not yet decided, a room still opening.", tone: "waiting" },
        { lead: "Plum means something is wrong.", rest: "There is no red anywhere. A mistake is named plainly, with the way to put it right.", tone: "wrong" },
        { lead: "Green means done.", rest: "A visit written up, a bill paid, a call returned.", tone: "done" },
      ],
      "Nothing fades and nothing blurs. Paper does not dissolve: it is laid down, lifted, turned or folded, and every move on the page is one a sheet could make. A room is shown whole or not yet at all, so no one reads a half-drawn screen. Words are never smaller than 13 pixels in the app, and 15 on public pages like this one.",
      "No sheet is ever seen more than 60° off upright. Past that, a picture turns to a sliver and its words cannot be read, so a sheet that stands up starts from 60°.",
    ] },
    { title: "Responsible AI, with Jev", blocks: [
      "The only AI in the app is Jev, a small model for structured decisions, reached through Typesafe from our server. It does three clerical jobs: it drafts a request for help from a call note, puts urgent calls first with the reason shown, and checks the year’s records before the report. It does not write prose and it saves nothing by itself.",
      "A neighbor’s name, phone and address are never sent to it. Everything sent passes first through one step that takes them out, and on every draft “What the assistant saw” shows the note exactly as it left. A person reads every draft and decides. Saving a request is not granting it: the conference members who visit the home decide on the help.",
      "On 12 made-up call notes kept apart from the ones it was tuned on, it filled 42 of 48 fields correctly, left 6 blank and got none wrong. Twelve notes is a small set, and it will make mistakes, which is why a person checks every draft.",
    ] },
    { title: "In English and Spanish", blocks: [
      "Every screen a volunteer uses is in English and Spanish, and so are the privacy page and this one. The Spanish is its own fixed words, written for each screen, not translated by a machine as the page opens, so the same button always says the same thing.",
      "It was read and approved by the founder, who speaks Spanish. Where a page is a translation it says so at the top, and the English governs.",
    ] },
    { title: "Measured, not guessed", blocks: [
      "The rule every change is held to: it is filmed at eight widths, from a 360‑pixel phone to a 1920‑pixel screen, and it lands only when no frame of that film runs over 33 milliseconds.",
      [
        { lead: "Under a second.", rest: "The sample conference opens in about 0.85 seconds at desk width and 1.1 on a phone, measured on our test machine." },
        { lead: "Three frames.", rest: "On the same machine, the first scroll is answered by the third frame, or within 60 pixels." },
        { lead: "Two seconds.", rest: "The iPhone app opens into its room in 1.6 to 2 seconds in the simulator." },
        { lead: "Not one frame over.", rest: "The courtyard that stands up on a first visit was filmed at 390 pixels with the processor slowed four times, and at 1440, in light and dark: 91 frames each time, none over 33 milliseconds, including the first run after the server had just started." },
        { lead: "With Reduce Motion too.", rest: "The same films are run again with Reduce Motion on. Then the courtyard is simply there." },
      ],
    ] },
    { title: "Made for everyone", blocks: [
      "Conference members are of every age, and many read with larger text or listen with a screen reader. So we check the screens with VoiceOver in the iPhone simulator, at the largest text size, by keyboard alone, and with Reduce Motion on. These are our own checks, not a certification.",
      "Every button is at least 44 pixels to a finger and 40 to a mouse, there is one focus ring and it is always seen, and no color carries meaning on its own: waiting, wrong and done are always said in words too.",
      "On the iPhone the app follows Apple’s own ways: a long press on a row opens the system’s context menu with the same actions as the web.",
    ] },
    { title: "Free for every conference", blocks: [
      "Kind Helps is free for every conference, with no plans and no paid tiers. A conference can download all of its records at any time. The work is kept going by gifts alone, given through one quiet link at the foot of the public pages.",
    ] },
  ] as MadeSection[],
  last: "Kind Helps is independent. It is not affiliated with or endorsed by the Society of St. Vincent de Paul. The code is open at github.com/Joe-Simo/neighborly.",
};

const es: typeof en = {
  path: "/sobre/como-lo-hicimos",
  title: "Cómo lo hicimos",
  tab: "Cómo lo hicimos — Kind Helps",
  description: "Cómo se hizo Kind Helps: la pintura, las reglas que guarda su papel, cómo el asistente queda sujeto a lo que decide una persona, y por qué es gratis para toda conferencia.",
  preview: "La pintura, las reglas del papel, el asistente y una promesa: gratis para toda conferencia.",
  enter: "Entrar a Kind Helps",
  translated: ["Esta página es una traducción. Si algo difiere, vale la ", "página en inglés", "."],
  courtyard: {
    label: "La pintura del patio, con sus hojas de papel separadas, que se vuelven a juntar al bajar por la página",
    apart: "Seis hojas cortadas según la profundidad de la propia pintura, y las personas de la mesa en una séptima.",
    whole: "Juntas, son el patio que hay tras las puertas.",
    hold: "Separar las hojas",
    hint: "Arrastra el patio hacia arriba o hacia abajo, o usa las flechas, para separar sus hojas.",
    amount: ["Entero", "Separadas al {n}%", "Las siete hojas separadas"],
  },
  sections: [
    { title: "Por qué existe", blocks: [
      "Kind Helps es para los voluntarios de las conferencias de San Vicente de Paúl: quienes atienden la línea de ayuda, visitan los hogares y llevan las cuentas. Muchas conferencias llevan este trabajo en papel, en hojas de cálculo o en ServWare. Kind Helps lo reúne en un solo lugar, en inglés y en español, en el teléfono o en el escritorio.",
      [
        { lead: "La dignidad del vecino.", rest: "La ayuda se paga al dueño de la vivienda, a la compañía de servicios o a la tienda, nunca al vecino. Las visitas se hacen de dos en dos. El nombre, el teléfono y la dirección de una familia se quitan antes de que una nota llegue al asistente." },
        { lead: "El tiempo del voluntario.", rest: "La nota de una llamada se vuelve un borrador de petición, y la pareja para una visita se sugiere según quién está libre." },
        { lead: "Cuentas honradas.", rest: "Cada donativo y cada pago queda anotado. Un error se corrige con una anotación nueva, nunca se borra." },
      ],
      "Es gratis porque ninguna conferencia debería pagar por ayudar a sus vecinos.",
    ] },
    { title: "Una sola pintura, hecha de papel", blocks: [
      "Kind Helps está dibujado como relieve de papel en capas: hojas cortadas puestas unas sobre otras, cada una con su propio borde y su propia sombra. El patio tras las puertas, las manos que pasan la tarjeta y las cuatro imágenes de la historia son una sola pintura en ese material.",
      "La obra pintada se hizo con una herramienta de imágenes con IA a partir de indicaciones escritas, y luego se eligió y se retocó a mano. La página nunca pinta encima, nunca le cambia el color ni la recorta. Lo que se mueve es el papel que la rodea.",
    ] },
    { title: "Cortado según su propia profundidad", blocks: [
      "El patio se pintó entero. Para que pudiera moverse sin pintar nada nuevo, se cortó según su propia profundidad en seis hojas, con las personas de la mesa en una séptima. Cada borde cortado es de la pintura, así que juntas las hojas vuelven a ser la pintura.",
    ], figure: { src: "/assets/made/courtyard-depth-960.webp", alt: "El patio en tonos de gris: el cielo negro, el claustro del fondo oscuro, el empedrado y los pilares casi blancos.", caption: "El mapa que siguió el corte: la profundidad del patio, lo lejano en oscuro y lo cercano en claro." } },
    { title: "Las reglas que guarda el papel", blocks: [
      "El programa de un ministerio lo leen personas cansadas al final de un día largo. Por eso cada pantalla sigue unas pocas reglas que no se doblan.",
      [
        { lead: "Ocre es esperar.", rest: "Una llamada aún sin devolver, una petición aún sin decidir, una sección que todavía se abre.", tone: "waiting" },
        { lead: "Ciruela es que algo está mal.", rest: "No hay rojo en ninguna parte. Un error se nombra con claridad, junto con la manera de corregirlo.", tone: "wrong" },
        { lead: "Verde es hecho.", rest: "Una visita con sus notas, una factura pagada, una llamada devuelta.", tone: "done" },
      ],
      "Nada se desvanece y nada se desenfoca. El papel no se disuelve: se pone, se levanta, se da vuelta o se dobla, y cada movimiento de la página es uno que una hoja podría hacer. Una sección se muestra entera o todavía no se muestra, para que nadie lea una pantalla a medio dibujar. Las letras nunca miden menos de 13 píxeles en la aplicación, ni menos de 15 en páginas públicas como esta.",
      "Ninguna hoja se ve nunca a más de 60° de estar derecha. Pasado eso, una imagen se vuelve una tira y sus palabras no se pueden leer, así que una hoja que se levanta empieza desde 60°.",
    ] },
    { title: "IA responsable, con Jev", blocks: [
      "La única IA de la aplicación es Jev, un modelo pequeño para decisiones estructuradas, al que se llega por Typesafe desde nuestro servidor. Hace tres tareas de oficina: redacta una petición de ayuda a partir de la nota de una llamada, pone primero las llamadas urgentes con el motivo a la vista y revisa los registros del año antes del informe. No escribe prosa y no guarda nada por sí solo.",
      "Nunca se le envían el nombre, el teléfono ni la dirección de un vecino. Todo lo que se envía pasa antes por un paso que los quita, y en cada borrador «Lo que vio el asistente» muestra la nota tal como salió. Una persona lee cada borrador y decide. Guardar una petición no es concederla: los miembros de la conferencia que visitan el hogar deciden la ayuda.",
      "En 12 notas de llamada inventadas, apartadas de las que sirvieron para ajustarlo, llenó bien 42 de 48 campos, dejó 6 en blanco y no se equivocó en ninguno. Doce notas son pocas, y se equivocará alguna vez; por eso una persona revisa cada borrador.",
    ] },
    { title: "En inglés y en español", blocks: [
      "Cada pantalla que usa un voluntario está en inglés y en español, y también la página de privacidad y esta. El español son palabras fijas propias, escritas para cada pantalla, no traducidas por una máquina al abrir la página, así que el mismo botón siempre dice lo mismo.",
      "Lo leyó y lo aprobó el fundador, que habla español. Cuando una página es una traducción lo dice arriba, y vale la versión en inglés.",
    ] },
    { title: "Medido, no supuesto", blocks: [
      "La regla que cumple cada cambio: se filma en ocho anchos, desde un teléfono de 360 píxeles hasta una pantalla de 1920, y entra solo cuando ningún cuadro de ese video pasa de 33 milisegundos.",
      [
        { lead: "Menos de un segundo.", rest: "La conferencia de muestra abre en unos 0.85 segundos en el ancho de escritorio y en 1.1 en un teléfono, medido en nuestra máquina de pruebas." },
        { lead: "Tres cuadros.", rest: "En la misma máquina, el primer desplazamiento responde antes del tercer cuadro, o dentro de 60 píxeles." },
        { lead: "Dos segundos.", rest: "La aplicación del iPhone abre su sección en 1.6 a 2 segundos en el simulador." },
        { lead: "Ni un cuadro de más.", rest: "El patio que se levanta en la primera visita se filmó a 390 píxeles con el procesador cuatro veces más lento, y a 1440, en claro y en oscuro: 91 cuadros cada vez, ninguno de más de 33 milisegundos, incluida la primera vez tras arrancar el servidor." },
        { lead: "También con Reducir movimiento.", rest: "Las mismas grabaciones se repiten con Reducir movimiento activado. Entonces el patio simplemente está ahí." },
      ],
    ] },
    { title: "Hecho para todos", blocks: [
      "Los miembros de una conferencia tienen todas las edades, y muchos leen con letra más grande o escuchan con un lector de pantalla. Por eso revisamos las pantallas con VoiceOver en el simulador del iPhone, con el tamaño de letra más grande, solo con el teclado y con Reducir movimiento activado. Son revisiones nuestras, no una certificación.",
      "Cada botón mide al menos 44 píxeles para un dedo y 40 para un ratón, hay un solo anillo de foco y siempre se ve, y ningún color dice algo por sí solo: esperando, error y hecho siempre se dicen también con palabras.",
      "En el iPhone la aplicación sigue las costumbres de Apple: una pulsación larga sobre una fila abre el menú contextual del sistema con las mismas acciones que en la web.",
    ] },
    { title: "Gratis para toda conferencia", blocks: [
      "Kind Helps es gratis para toda conferencia, sin planes y sin niveles de pago. Una conferencia puede descargar todos sus registros cuando quiera. El trabajo se sostiene solo con donativos, dados por un enlace discreto al pie de las páginas públicas.",
    ] },
  ],
  last: "Kind Helps es independiente. No está afiliado a la Sociedad de San Vicente de Paúl ni cuenta con su respaldo. El código está abierto en github.com/Joe-Simo/neighborly.",
};

export const madeWords: Record<Language, typeof en> = { en, es };
