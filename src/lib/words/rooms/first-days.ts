import type { Terms } from "../sets";

/**
 * What the shared rooms say to a brand-new group: its owner alone, nothing made yet.
 * Each room says once what belongs in it. Every sentence is written whole in each language;
 * nothing is joined from pieces on the screen.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- every room's table is given the terms and the place; these sentences name neither
export const en = (t: Terms, place: string) => ({
  /** This week, in place of three figures at zero and two empty lists. The head carries its press, "Invite someone". */
  week: {
    title: "Your first week starts here.",
    detail: "What people take on and what is waiting for a yes will be kept here.",
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- every room's table is given the terms and the place; these sentences name neither
export const es = (t: Terms, place: string): ReturnType<typeof en> => ({
  week: {
    title: "Tu primera semana empieza aquí.",
    detail: "Aquí se guardará lo que cada persona tome a su cargo y lo que esté esperando un sí.",
  },
});
