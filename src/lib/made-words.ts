import type { Language } from "@/lib/words";

/** A paragraph, or a list whose items open with a few strong words; a list item may carry the colour it names. */
type MadeBlock = string | { lead: string; rest: string; tone?: "waiting" | "wrong" | "done" }[];

/** A section of the page; one may carry a picture from the painting's own working files, with what it shows. */
type MadeSection = { title: string; blocks: MadeBlock[]; figure?: { src: string; alt: string; caption: string };
  /** Four stills of the courtyard's sheets, from whole to drawn apart, in order (/assets/made/courtyard-apart-{1..4}-{640,1200}.webp). */
  stills?: { label: string; items: [string, string][] }; table?: "eval" | "frames" | "anatomy" | "process" | "trace" };

/** Every word of the page on how Kind Helps was made. English is the source; Spanish says the same, section for section. */
const en = {
  path: "/about/how-we-made-it",
  title: "How we made it",
  tab: "How we made it · Kind Helps",
  description: "How Kind Helps was made: the painting, the rules its paper keeps, how the assistant is held to a person’s say, and why it is free for every conference.",
  preview: "The painting, the paper’s rules, the assistant, and a promise: free for every conference.",
  enter: "Enter Kind Helps",
  translated: null as null | [string, string, string],
  courtyard: {
    label: "The courtyard painting, its paper sheets drawn apart, laid back together as the page scrolls",
    apart: "Six sheets cut along the painting’s own depth, and the people at the table on a seventh.",
    whole: "Laid together, they are the courtyard behind the doors.",
    hold: "Draw the sheets apart",
    hint: "Drag the courtyard up or down, or use the arrow keys, to draw its sheets apart.",
    /** Said by the slider: whole, part apart ({n} is the percent), and fully apart. Every step names the sheets, since all of them part together. */
    amount: ["Whole: all seven sheets laid together as one painting", "{n}% apart: sky, cloister, people, table, garden, floor and doorway, each on its own sheet", "All seven sheets apart, back to front: the sky, the tower and far cloister, the people, the table and its arcade, the garden bench, the floor, the doorway"] as [string, string, string],
  },
  /**
   * The checks this page rests on, each with where it is recorded. Only what has been run is here. {frames1440}, {frames390}, {right}, {cells},
   * {blank} and {wrong} are counted from the run files (made-frames.ts, made-proof.ts).
   */
  checked: {
    title: "How it was checked",
    items: [
      { lead: "No axe violations.", rest: "axe-core 4.14 (WCAG 2.2 A and AA) found none in the 13 rooms, in English and Spanish, as owner and as member, at 390 and 1440 pixels, nor on the 10 public pages, sign-in included.", source: "axe-core 4.14, rooms on build 7e3513e, public pages on build 7db60ae." },
      { lead: "By keyboard alone.", rest: "The core flow, from logging a call to recording a payment, walked with Tab, arrows, Enter and Esc in Chromium: 14 steps walked and passing after two fixes, and the step that records a yes checked in the code. The walk in Safari is still to come.", source: "Keyboard walk, Chromium at 1440, 19 November 2026." },
      { lead: "What a screen reader is told.", rest: "Each focus move and each spoken change recorded along the same flow: every done line said once, every refusal an alert, waiting always in words. One line said three times was fixed. VoiceOver was checked in the iPhone simulator. A walk on a real iPhone follows on November 24.", source: "Screen-reader recording, Chromium at 1440, 19 November 2026." },
      { lead: "In high contrast.", rest: "With Windows’ forced colors on, the marks, the months and the printed year draw in the system’s own colors, checked in six rooms at 390 and 1440.", source: "Forced-colors pass, 19 November 2026." },
    ],
  },
  anatomy: {
    caption: "The three heights, drawn apart",
    layers: [
      { name: "Sheet", rest: "laid over the room" },
      { name: "Card", rest: "stands on the page" },
      { name: "Slip", rest: "lies on the paper" },
    ],
    page: "The page",
    note: "Spacing enlarged; each shadow is the app’s own, from the relief tokens.",
  },
  process: {
    before: "Before",
    after: "After",
    pairs: [
      { key: "end", why: "On a phone, the last screen cut the closing off below its heading. Now the painting, its words and both ways in end whole together.", alt: ["The home page’s last screen on a phone: the painting and “Bring this to your people”, with the links below cut off at the edge.", "The same screen after the change: the painting, the heading and both links whole on one screen."] },
      { key: "words", why: "The display serif is tracked tight, and the space between words closed with it until “How we” read “Howwe”. A word space was given back to every heading.", alt: ["The page’s heading, How we made it, with the words nearly touching.", "The same heading with a clear space between each word."] },
      { key: "relief", why: "Each room had grown its own shadow, tone and edge. Every raised surface now takes one of three heights from one scale.", alt: ["The home page’s room cards on a cream tone with a brown edge.", "The same cards on the app’s one paper tone and edge, with its card shadow."] },
      { key: "slip", why: "A slip on A week had its own off-white and brown ink. It now lies on the paper as every slip in the app does.", alt: ["A day’s square on A week, in its own off-white with a brown shadow.", "The same square as a slip, in the paper tone with the slip shadow."] },
    ],
    source: "Source: the design reviews of 19 November 2026, each pair taken from the running site.",
  },
  trace: {
    steps: [
      { key: "picture", name: "The picture", why: "Written direction went to an image generator, and the author chose this one: a hand lifting the receiver, cut from paper.", alt: "A paper relief of a hand lifting a green telephone receiver over a plum ground, with an ochre cord." },
      { key: "slip", name: "The slip", why: "On the home page the same call becomes a slip: one name, one need, the ochre corner that means it is waiting.", alt: "A paper slip reading Rosa Fontaine, Behind on November rent, $450, with an ochre corner, laid on two more slips." },
      { key: "room", name: "The room", why: "In Help line the picture heads the room, and Rosa’s call waits as a drafted request until a person says yes.", alt: "The Help line room: the heading Every call, returned, the receiver picture, and Rosa Fontaine’s request for $450 waiting for a yes." },
    ],
    credit: "The picture was made with Codex's image generator, from written direction, and chosen by the author. Stills from the running site with the sample conference; every name is made up.",
  },
  frameStrip: {
    caption: "A scroll down this page on the Mac, frame by frame",
    widths: { "1440": "At 1440 pixels", "390": "At 390 pixels, processor slowed four times" },
    /** {n} frames, {over} of them late, {worst} the slowest in milliseconds. */
    summary: ["{n} frames, none over 33 ms. The slowest took {worst} ms, within the line.", "{n} frames, {over} over 33 ms. The slowest took {worst} ms."] as [string, string],
    line: "33 ms",
    /** {day}, {commit} and {machine} come from the recorder's file. */
    source: "Source: the Mac run of {day}, build {commit}, {machine}. Each mark is one frame, at the height of its time; its raw times are eval/frames/made-scroll.json in the code.",
  },
  evalTable: {
    caption: "The 12 held-out notes, field by field",
    head: ["Field", "Right", "Blank", "Wrong"] as [string, string, string, string],
    fields: { kind: "Kind of help", amount: "Amount", payeeKind: "Who is paid", signs: "Urgent signs" },
    source: "Source: measure run 7, 19 November 2026, model jev-1.14.0. Its raw output is eval/jev/run-7.json in the code.",
  },
  sections: [
    { title: "Why it exists", blocks: [
      "Kind Helps is for the volunteers of St. Vincent de Paul conferences: the people who answer the help line, visit homes and keep the books. Many conferences keep this work on paper, in spreadsheets or in ServWare. Kind Helps keeps it in one place, in English and Spanish, on a phone or at a desk.",
      [
        { lead: "A neighbor’s dignity.", rest: "Help is paid to the landlord, utility or store, never to the neighbor. Visits are made in pairs. A neighbor’s name, phone and address are taken out before a note reaches the assistant." },
        { lead: "A volunteer’s time.", rest: "A call note becomes a draft request, and the pair for a visit is suggested from who is free." },
        { lead: "Honest books.", rest: "Every gift and payment is recorded. A mistake is put right with a new entry, never erased." },
      ],
      "It is free because no conference should pay to help its neighbors.",
    ] },
    { title: "One painting, made\u00a0of\u00a0paper", blocks: [
      "Kind Helps is drawn as layered paper relief: cut sheets laid on one another, each with its own edge and its own shadow. The courtyard behind the doors, the hands passing the card and the four pictures of the story are one painting in that material.",
      "The painted artwork was made with Codex’s image generator from written direction, and chosen by the author. The page adds nothing to it. On the home page it moves by its own depth: the near stone and the far hills part around the table as you walk in, the light follows a sun that sets at dusk, and the people, each painted three times, turn from one of their paintings to the next. Around it, the paper moves.",
    ] },
    { title: "Cut along its own depth", blocks: [
      "The courtyard was painted whole. To let it move without painting anything new, it was cut along its own depth into six sheets, with the people at the table on a seventh. Every cut edge is the painting’s, so laid together the sheets are the painting again.",
    ], figure: { src: "/assets/made/courtyard-depth-1774.webp", alt: "The courtyard in shades of gray: the sky black, the far cloister dark, the paving and pillars nearly white.", caption: "The depth map: lighter is nearer." }, stills: { label: "The courtyard’s sheets, from whole to drawn apart", items: [
      ["Whole, as the doors open on it.", "The courtyard painting, whole, seen straight on."],
      ["Turned, still one sheet.", "The same painting turned a little to the side, still lying as one sheet."],
      ["Drawn apart.", "The sheets parting: the sky and far cloister behind, the floor in front, paper showing between the cut edges."],
      ["Seven sheets, each at its own depth.", "The seven sheets drawn fully apart, back to front: sky, tower and far cloister, people, table and arcade, garden bench, floor, doorway."],
    ] } },
    { title: "The rules the paper keeps", table: "anatomy", blocks: [
      "A ministry’s software is read by tired people at the end of a long day. So every screen follows a few rules that do not bend.",
      [
        { lead: "Ochre means waiting.", rest: "A call not yet returned, a request not yet decided, a room still opening.", tone: "waiting" },
        { lead: "Plum means something is wrong.", rest: "There is no red anywhere. A mistake is named plainly, with the way to put it right.", tone: "wrong" },
        { lead: "Green means done.", rest: "A visit written up, a bill paid, a call returned. The words say it too, in the past tense and naming the thing: “Request saved.”, “Record removed.”", tone: "done" },
      ],
      "Paper is the one material: things rise, fold and turn as a sheet would. Every raised surface takes one of three heights: a slip lies on the paper, a card stands on the page, and a sheet is laid over the room.",
    ] },
    { title: "Responsible AI, with Jev", table: "eval", blocks: [
      "The only AI in the app is Jev, a small model for structured decisions, reached through Typesafe from our server. It does four clerical checks, each on what fixed rules have already read:",
      [
        { lead: "A draft request.", rest: "On the draft made from a call note, it confirms the kind of help and the kind of payee." },
        { lead: "An urgent call.", rest: "It confirms or adds the signs that put a call first, with the reason shown." },
        { lead: "The year’s check.", rest: "It reads the few notes the check picks out before the report." },
        { lead: "A new team.", rest: "It confirms the name, how often, how many and when from the description." },
      ],
      "It does not write prose, and no request is saved without a person’s yes.",
      "A neighbor’s name, phone and address are taken out before anything is sent: everything passes first through one step of fixed rules, and on every draft “What the assistant saw” shows the note exactly as it left. Saving a request is not granting it: the conference decides on the help, and an owner or coordinator records the decision.",
      "On 12 made‑up call notes kept apart from the ones it was tuned on, it filled 42 of 48 fields correctly, left 6 blank and got none wrong. Twelve notes is a small set, and it will make mistakes, which is why a person checks every draft.",
    ] },
    { title: "In English and Spanish", blocks: [
      "Every screen a volunteer uses is in English and Spanish, and so are A week, the privacy and accessibility pages, and this one. The Spanish is its own fixed words, written for each screen, not translated by a machine as the page opens, so the same button always says the same thing.",
      "The founder approved the Spanish. Where a page is a translation it says so at the top, and the English governs.",
    ] },
    { title: "Drawn, judged, redrawn", table: "process", blocks: [
      "Every screen was drawn, then judged against the rules above, then drawn again. Here are four real pairs from this week’s reviews, each one change.",
    ] },
    { title: "From picture to room", table: "trace", blocks: [
      "One call, followed through the work: the picture that was chosen for it, the slip it became on the home page, and the room where a volunteer answers it.",
    ] },
    { title: "Measured, not guessed", table: "frames", blocks: [
      "The rule every change that moves something is held to: it is filmed on a Mac at desktop and phone widths, and it lands only when no frame runs over 33 milliseconds or, where a page already ran over, when it is no slower than before.",
      [
        { lead: "Under a second.", rest: "The sample conference opens in about 0.85 seconds at desk width and 1.1 on a phone, measured on our test machine." },
        { lead: "Three frames.", rest: "On the same machine, the first scroll is answered by the third frame, or within 60 pixels." },
        { lead: "Two seconds.", rest: "The iPhone app opens into its room in 1.6 to 2 seconds in the simulator." },
        { lead: "Not one frame over.", rest: "The courtyard that stands up on a first visit was filmed at 390 pixels with the processor slowed four times, and at 1440, in light and dark: 91 frames each time, none over 33 milliseconds, including the first run after the server had just started." },
        { lead: "With Reduce Motion too.", rest: "The same films are run again with Reduce Motion on. Then the courtyard is simply there." },
      ],
    ] },
    { title: "Made for everyone", blocks: [
      "Conference members are of every age, and many read with larger text or listen with a screen reader. So we check the screens with VoiceOver in the iPhone simulator, at the largest text size, by keyboard alone, and with Reduce Motion on. These are our own checks, not a certification.",
      "There is one focus ring, the same 4px corner on every control, drawn when you move by keyboard, and no color carries meaning on its own: waiting, wrong and done are always said in words too.",
      "On the iPhone the app follows Apple’s own ways: a long press on a row opens the system’s context menu with the same actions as the web.",
    ] },
    { title: "Free for every conference", blocks: [
      "Kind Helps is free for every conference, with no plans and no paid tiers. A conference can download all of its records at any time. The work is kept going by gifts alone, given through one quiet link at the foot of the public pages.",
    ] },
  ] as MadeSection[],
  colophon: {
    label: "Colophon",
    lines: [
      ["Type", "Newsreader and Source Sans 3"],
      ["Art", "made with Codex's image generator, from written direction, and chosen by the author"],
      ["Built with", "Claude Code"],
      ["Technologies", "Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Convex, Clerk, Three.js, Serwist (offline), fflate, and Capacitor (the iPhone and iPad app, with a WidgetKit widget). Tested with Bun and Vitest, and hosted on Vercel."],
    ] as [string, string][],
  },
  last: "Kind Helps is independent. It is not affiliated with or endorsed by the Society of St. Vincent de Paul. The code is open at github.com/Joe-Simo/neighborly.",
};

const es: typeof en = {
  path: "/sobre/como-lo-hicimos",
  title: "Cómo lo hicimos",
  tab: "Cómo lo hicimos · Kind Helps",
  description: "Cómo se hizo Kind Helps: la pintura, las reglas de su papel, cómo el asistente queda sujeto a una persona, y por qué es gratis para toda conferencia.",
  preview: "La pintura, las reglas del papel, el asistente y una promesa: gratis para toda conferencia.",
  enter: "Entrar a Kind Helps",
  translated: ["Esta página es una traducción. Si algo difiere, vale la ", "página en inglés", "."],
  courtyard: {
    label: "La pintura del patio, con sus hojas de papel separadas, que se vuelven a juntar al bajar por la página",
    apart: "Seis hojas cortadas según la profundidad de la propia pintura, y las personas de la mesa en una séptima.",
    whole: "Juntas, son el patio que hay tras las puertas.",
    hold: "Separar las hojas",
    hint: "Arrastra el patio hacia arriba o hacia abajo, o usa las flechas, para separar sus hojas.",
    amount: ["Entero: las siete hojas juntas, una sola pintura", "Separadas al {n}%: cielo, claustro, personas, mesa, jardín, suelo y puerta, cada uno en su hoja", "Las siete hojas separadas, de atrás hacia adelante: el cielo, la torre y el claustro del fondo, las personas, la mesa y su arcada, el banco del jardín, el suelo, la puerta"],
  },
  checked: {
    title: "Cómo se comprobó",
    items: [
      { lead: "Ningún fallo de axe.", rest: "axe-core 4.14 (WCAG 2.2 A y AA) no encontró ninguno en las 13 secciones, en inglés y en español, como responsable y como miembro, a 390 y 1440 píxeles, ni en las 10 páginas públicas, incluida la de entrar.", source: "axe-core 4.14, secciones en la versión 7e3513e, páginas públicas en la versión 7db60ae." },
      { lead: "Solo con el teclado.", rest: "El recorrido principal, de anotar una llamada a registrar un pago, hecho con Tab, flechas, Intro y Esc en Chromium: 14 pasos recorridos y correctos tras dos arreglos, y el paso que registra un sí comprobado en el código. Falta el recorrido en Safari.", source: "Recorrido con teclado, Chromium a 1440, 19 de noviembre de 2026." },
      { lead: "Lo que oye un lector de pantalla.", rest: "Cada movimiento del foco y cada cambio anunciado, grabados en el mismo recorrido: cada línea de hecho se dice una vez, cada rechazo es una alerta y la espera siempre se dice con palabras. Se arregló una línea que se decía tres veces. VoiceOver se revisó en el simulador de iPhone. La prueba en un iPhone real será el 24 de noviembre.", source: "Grabación del lector de pantalla, Chromium a 1440, 19 de noviembre de 2026." },
      { lead: "En alto contraste.", rest: "Con los colores forzados de Windows, las marcas, los meses y el año impreso se dibujan con los colores del propio sistema, comprobado en seis secciones a 390 y 1440.", source: "Revisión de colores forzados, 19 de noviembre de 2026." },
    ],
  },
  anatomy: {
    caption: "Las tres alturas, separadas",
    layers: [
      { name: "Hoja", rest: "se pone sobre la sección" },
      { name: "Tarjeta", rest: "se alza sobre la página" },
      { name: "Papelito", rest: "se apoya en el papel" },
    ],
    page: "La página",
    note: "Separación ampliada; cada sombra es la de la aplicación, de los tokens de relieve.",
  },
  process: {
    before: "Antes",
    after: "Después",
    pairs: [
      { key: "end", why: "En el teléfono, la última pantalla cortaba el cierre debajo de su título. Ahora la pintura, sus palabras y las dos entradas terminan enteras juntas.", alt: ["La última pantalla de la portada en un teléfono: la pintura y “Bring this to your people” (en inglés), con los enlaces de abajo cortados en el borde.", "La misma pantalla después del cambio: la pintura, el título y los dos enlaces enteros en una sola pantalla."] },
      { key: "words", why: "La serif de los títulos va muy apretada, y el espacio entre palabras se cerró con ella hasta que “How we” se leía “Howwe”. Cada título recuperó su espacio entre palabras.", alt: ["El título de la página, How we made it (en inglés), con las palabras casi tocándose.", "El mismo título con un espacio claro entre cada palabra."] },
      { key: "relief", why: "Cada sección tenía su propia sombra, tono y borde. Ahora toda superficie que se levanta toma una de tres alturas de una sola escala.", alt: ["Las tarjetas de las secciones en la portada, en tono crema con borde marrón.", "Las mismas tarjetas en el único tono y borde de papel de la aplicación, con su sombra de tarjeta."] },
      { key: "slip", why: "Un papelito de Una semana tenía su propio blanco y tinta marrón. Ahora se apoya en el papel como todos los papelitos de la aplicación.", alt: ["El recuadro de un día en Una semana, en su propio blanco con sombra marrón.", "El mismo recuadro como papelito, en el tono del papel con la sombra de papelito."] },
    ],
    source: "Fuente: las revisiones de diseño del 19 de noviembre de 2026, cada par tomado del sitio en funcionamiento.",
  },
  trace: {
    steps: [
      { key: "picture", name: "La imagen", why: "Unas indicaciones escritas fueron a un generador de imágenes, y el autor eligió esta: una mano que levanta el auricular, recortada en papel.", alt: "Un relieve de papel de una mano que levanta un auricular verde sobre un fondo ciruela, con un cable ocre." },
      { key: "slip", name: "El papelito", why: "En la portada la misma llamada se vuelve un papelito: un nombre, una necesidad y la esquina ocre que dice que espera.", alt: "Un papelito que dice Rosa Fontaine, Behind on November rent, $450 (en inglés), con una esquina ocre, sobre otros dos papelitos." },
      { key: "room", name: "La sección", why: "En Línea de ayuda la imagen encabeza la sección, y la llamada de Rosa espera como una petición en borrador hasta que una persona dice que sí.", alt: "La sección Línea de ayuda: el título Every call, returned (en inglés), la imagen del auricular y la petición de 450 dólares de Rosa Fontaine esperando un sí." },
    ],
    credit: "La imagen se hizo con el generador de imágenes de Codex, a partir de indicaciones escritas, y la eligió el autor. Imágenes del sitio en funcionamiento con la conferencia de muestra; todos los nombres son inventados.",
  },
  frameStrip: {
    caption: "Un desplazamiento por esta página en la Mac, cuadro a cuadro",
    widths: { "1440": "A 1440 píxeles", "390": "A 390 píxeles, con el procesador cuatro veces más lento" },
    summary: ["{n} cuadros, ninguno de más de 33 ms. El más lento tardó {worst} ms, dentro del límite.", "{n} cuadros, {over} de más de 33 ms. El más lento tardó {worst} ms."],
    line: "33 ms",
    source: "Fuente: la medición en la Mac del {day}, versión {commit}, {machine}. Cada marca es un cuadro, a la altura de su tiempo; sus tiempos sin tocar están en eval/frames/made-scroll.json, en el código.",
  },
  evalTable: {
    caption: "Las 12 notas apartadas, campo por campo",
    head: ["Campo", "Bien", "En blanco", "Mal"],
    fields: { kind: "Tipo de ayuda", amount: "Monto", payeeKind: "A quién se paga", signs: "Señales de urgencia" },
    source: "Fuente: medición 7, 19 de noviembre de 2026, modelo jev-1.14.0. Su salida sin tocar está en eval/jev/run-7.json, en el código.",
  },
  sections: [
    { title: "Por qué existe", blocks: [
      "Kind Helps es para los voluntarios de las conferencias de San Vicente de Paúl: quienes atienden la línea de ayuda, visitan los hogares y llevan las cuentas. Muchas conferencias llevan este trabajo en papel, en hojas de cálculo o en ServWare. Kind Helps lo reúne en un solo lugar, en inglés y en español, en el teléfono o en el escritorio.",
      [
        { lead: "La dignidad del vecino.", rest: "La ayuda se paga al dueño de la vivienda, a la compañía de servicios o a la tienda, nunca al vecino. Las visitas se hacen de dos en dos. El nombre, el teléfono y la dirección de un vecino se quitan antes de que una nota llegue al asistente." },
        { lead: "El tiempo del voluntario.", rest: "La nota de una llamada se vuelve un borrador de petición, y la pareja para una visita se sugiere según quién está libre." },
        { lead: "Cuentas honradas.", rest: "Cada donativo y cada pago queda anotado. Un error se corrige con una anotación nueva, nunca se borra." },
      ],
      "Es gratis porque ninguna conferencia debería pagar por ayudar a sus vecinos.",
    ] },
    { title: "Una sola pintura, hecha de papel", blocks: [
      "Kind Helps está dibujado como relieve de papel en capas: hojas cortadas puestas unas sobre otras, cada una con su propio borde y su propia sombra. El patio tras las puertas, las manos que pasan la tarjeta y las cuatro imágenes de la historia son una sola pintura en ese material.",
      "La obra pintada se hizo con el generador de imágenes de Codex a partir de indicaciones escritas, y elegida por quien lo creó. La página no le añade nada. En la página de inicio se mueve según su propia profundidad: la piedra cercana y las colinas lejanas se separan alrededor de la mesa al entrar, la luz sigue a un sol que se pone al atardecer, y las personas, pintadas tres veces cada una, pasan de una de sus pinturas a la siguiente. Alrededor, se mueve el papel.",
    ] },
    { title: "Cortado según su propia profundidad", blocks: [
      "El patio se pintó entero. Para que pudiera moverse sin pintar nada nuevo, se cortó según su propia profundidad en seis hojas, con las personas de la mesa en una séptima. Cada borde cortado es de la pintura, así que juntas las hojas vuelven a ser la pintura.",
    ], figure: { src: "/assets/made/courtyard-depth-1774.webp", alt: "El patio en tonos de gris: el cielo negro, el claustro del fondo oscuro, el empedrado y los pilares casi blancos.", caption: "El mapa de profundidad: lo claro está más cerca." }, stills: { label: "Las hojas del patio, de enteras a separadas", items: [
      ["Entero, como lo muestran las puertas al abrirse.", "La pintura del patio, entera, vista de frente."],
      ["Girado, todavía una sola hoja.", "La misma pintura girada un poco hacia un lado, todavía como una sola hoja."],
      ["Separándose.", "Las hojas se separan: el cielo y el claustro del fondo detrás, el suelo delante, y el papel visible entre los bordes cortados."],
      ["Siete hojas, cada una a su profundidad.", "Las siete hojas del todo separadas, del fondo al frente: cielo, torre y claustro del fondo, personas, mesa y arcada, banco del jardín, suelo, portal."],
    ] } },
    { title: "Las reglas que guarda el papel", table: "anatomy", blocks: [
      "El programa de un ministerio lo leen personas cansadas al final de un día largo. Por eso cada pantalla sigue unas pocas reglas que no se doblan.",
      [
        { lead: "Ocre es esperar.", rest: "Una llamada aún sin devolver, una petición aún sin decidir, una sección que todavía se abre.", tone: "waiting" },
        { lead: "Ciruela es que algo está mal.", rest: "No hay rojo en ninguna parte. Un error se nombra con claridad, junto con la manera de corregirlo.", tone: "wrong" },
        { lead: "Verde es hecho.", rest: "Una visita con sus notas, un recibo pagado, una llamada devuelta. Las palabras también lo dicen, en pasado y nombrando la cosa: «Petición guardada.»", tone: "done" },
      ],
      "El papel es el único material: todo sube, se dobla y gira como lo haría una hoja. Cada superficie que se levanta tiene una de tres alturas: un papelito se apoya en el papel, una tarjeta se alza sobre la página y una hoja se pone sobre la sección.",
    ] },
    { title: "IA responsable, con Jev", table: "eval", blocks: [
      "La única IA de la aplicación es Jev, un modelo pequeño para decisiones estructuradas, al que se llega por Typesafe desde nuestro servidor. Hace cuatro comprobaciones de oficina, cada una sobre lo que unas reglas fijas ya leyeron:",
      [
        { lead: "Un borrador de petición.", rest: "En el borrador hecho con la nota de una llamada, confirma el tipo de ayuda y el tipo de destinatario del pago." },
        { lead: "Una llamada urgente.", rest: "Confirma o añade las señales que ponen primero una llamada, con el motivo a la vista." },
        { lead: "La revisión del año.", rest: "Lee las pocas notas que la revisión aparta antes del informe." },
        { lead: "Un equipo nuevo.", rest: "Confirma el nombre, cada cuánto, cuántas personas y a qué hora según la descripción." },
      ],
      "No escribe prosa, y ninguna petición se guarda sin el sí de una persona.",
      "El nombre, el teléfono y la dirección de un vecino se quitan antes de enviar nada: todo pasa antes por un paso de reglas fijas, y en cada borrador «Lo que vio el asistente» muestra la nota tal como salió. Guardar una petición no es concederla: la conferencia decide la ayuda, y el responsable o un coordinador anota la decisión.",
      "En 12 notas de llamada inventadas, apartadas de las que sirvieron para ajustarlo, llenó bien 42 de 48 campos, dejó 6 en blanco y no se equivocó en ninguno. Doce notas son pocas, y se equivocará alguna vez; por eso una persona revisa cada borrador.",
    ] },
    { title: "En inglés y en español", blocks: [
      "Cada pantalla del voluntariado está en inglés y en español, y también Una semana, las páginas de privacidad y de accesibilidad, y esta. El español son palabras fijas propias, escritas para cada pantalla, no traducidas por una máquina al abrir la página, así que el mismo botón siempre dice lo mismo.",
      "Quien fundó el proyecto aprobó el texto en español. Cuando una página es una traducción lo dice arriba, y vale la versión en inglés.",
    ] },
    { title: "Dibujado, juzgado, redibujado", table: "process", blocks: [
      "Cada pantalla se dibujó, se juzgó con las reglas de arriba y se volvió a dibujar. Estos son cuatro pares reales de las revisiones de esta semana, cada uno de un solo cambio.",
    ] },
    { title: "De la imagen a la sección", table: "trace", blocks: [
      "Una llamada, seguida por todo el trabajo: la imagen que se eligió para ella, el papelito que fue en la portada y la sección donde un voluntario la atiende.",
    ] },
    { title: "Medido, no supuesto", table: "frames", blocks: [
      "La regla que cumple cada cambio que mueve algo: se filma en una Mac en anchos de escritorio y de teléfono, y entra solo cuando ningún cuadro pasa de 33 milisegundos o, donde una página ya pasaba, cuando no va más lenta que antes.",
      [
        { lead: "Menos de un segundo.", rest: "La conferencia de muestra abre en unos 0.85 segundos en el ancho de escritorio y en 1.1 en un teléfono, medido en nuestra máquina de pruebas." },
        { lead: "Tres cuadros.", rest: "En la misma máquina, el primer desplazamiento responde antes del tercer cuadro, o dentro de 60 píxeles." },
        { lead: "Dos segundos.", rest: "La aplicación del iPhone abre su sección en 1.6 a 2 segundos en el simulador." },
        { lead: "Ni un cuadro de más.", rest: "El patio que se levanta en la primera visita se filmó a 390 píxeles con el procesador cuatro veces más lento, y a 1440, en claro y en oscuro: 91 cuadros cada vez, ninguno de más de 33 milisegundos, incluida la primera vez tras arrancar el servidor." },
        { lead: "También con Reducir movimiento.", rest: "Las mismas grabaciones se repiten con Reducir movimiento activado. Entonces el patio simplemente está ahí." },
      ],
    ] },
    { title: "Hecho para todos", blocks: [
      "Los miembros de una conferencia tienen todas las edades, y muchos leen con letra más grande o escuchan con un lector de pantalla. Por eso revisamos las pantallas con VoiceOver en el simulador del iPhone, con el tamaño de letra más grande, solo con el teclado y con Reducir movimiento activado. Son revisiones nuestras, no una certificación.",
      "Hay un solo anillo de foco, con la misma esquina de 4 px en cada control, que aparece al moverse con el teclado, y ningún color dice algo por sí solo: esperando, error y hecho siempre se dicen también con palabras.",
      "En el iPhone la aplicación sigue las costumbres de Apple: una pulsación larga sobre una fila abre el menú contextual del sistema con las mismas acciones que en la web.",
    ] },
    { title: "Gratis para toda conferencia", blocks: [
      "Kind Helps es gratis para toda conferencia, sin planes y sin niveles de pago. Una conferencia puede descargar todos sus registros cuando quiera. El trabajo se sostiene solo con donativos, dados por un enlace discreto al pie de las páginas públicas.",
    ] },
  ],
  colophon: {
    label: "Colofón",
    lines: [
      ["Letra", "Newsreader y Source Sans 3"],
      ["Arte", "hecho con el generador de imágenes de Codex, a partir de indicaciones escritas, y elegido por el autor"],
      ["Hecho con", "Claude Code"],
      ["Tecnologías", "Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Convex, Clerk, Three.js, Serwist (sin conexión), fflate y Capacitor (la aplicación de iPhone y iPad, con un widget de WidgetKit). Probado con Bun y Vitest, y alojado en Vercel."],
    ] as [string, string][],
  },
  last: "Kind Helps es independiente. No está afiliado a la Sociedad de San Vicente de Paúl ni cuenta con su respaldo. El código está abierto en github.com/Joe-Simo/neighborly.",
};

export const madeWords: Record<Language, typeof en> = { en, es };
