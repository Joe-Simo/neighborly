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
  /** A new member's first week: three slips on This week, each leading to the real control. Shown once. */
  firstWeek: {
    title: "Your first week",
    putAway: "Put these slips away",
    done: "Done",
    leads: {
      call: { lead: "Take a call", rest: "Write down who called and what they need." },
      visit: { lead: "Plan a visit", rest: "Send two people to a household." },
      yes: { lead: "Say yes", rest: "Read a draft and give it your yes." },
    },
    members: {
      yes: { lead: "Say yes", rest: "Take on something coming up this week." },
      mine: { lead: "See your part", rest: "Everything you have taken on, in one place." },
      away: { lead: "Mark days away", rest: "So no one asks you while you are gone." },
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- every room's table is given the terms and the place; these sentences name neither
export const es = (t: Terms, place: string): ReturnType<typeof en> => ({
  week: {
    title: "Tu primera semana empieza aquí.",
    detail: "Aquí se guardará lo que cada persona tome a su cargo y lo que esté esperando un sí.",
  },
  firstWeek: {
    title: "Tu primera semana",
    putAway: "Guardar estas notas",
    done: "Hecho",
    leads: {
      call: { lead: "Atiende una llamada", rest: "Anota quién llamó y qué necesita." },
      visit: { lead: "Planea una visita", rest: "Envía a dos personas a un hogar." },
      yes: { lead: "Da tu sí", rest: "Lee un borrador y dale tu sí." },
    },
    members: {
      yes: { lead: "Da tu sí", rest: "Toma a tu cargo algo de esta semana." },
      mine: { lead: "Mira tu parte", rest: "Todo lo que tomaste a tu cargo, en un solo lugar." },
      away: { lead: "Marca tus días fuera", rest: "Así nadie te pide nada mientras no estás." },
    },
  },
});
