export const liveAreas = [
  "week",
  "team",
  "people",
  "commitments",
  "mine",
  "time-off",
  "tasks",
  "help-line",
  "neighbors",
  "treasury",
  "reports",
  "visits",
  "tools",
] as const;
export type LiveArea = (typeof liveAreas)[number];

/** The room's name as the browser tab shows it. The same words as the menu. */
export const areaTitles: Record<LiveArea, string> = {
  week: "This week",
  team: "Teams",
  people: "People",
  commitments: "Commitments",
  mine: "My commitments",
  "time-off": "Time off",
  tasks: "Tasks & meetings",
  "help-line": "Help line",
  neighbors: "Neighbors",
  treasury: "Treasury",
  reports: "Reports",
  visits: "Home visits",
  tools: "Your files",
};

/**
 * The same tabs in Spanish, the menu's words (words/es.ts; a test holds them the same), so a Spanish reader's tab
 * is never named in English while the Spanish book is still on its way.
 */
export const areaTitlesEs: Record<LiveArea, string> = {
  week: "Esta semana",
  team: "Equipos",
  people: "Personas",
  commitments: "Compromisos",
  mine: "Mis compromisos",
  "time-off": "Días libres",
  tasks: "Tareas y reuniones",
  "help-line": "Línea de ayuda",
  neighbors: "Vecinos",
  treasury: "Tesorería",
  reports: "Informes",
  visits: "Visitas a casa",
  tools: "Tus archivos",
};
