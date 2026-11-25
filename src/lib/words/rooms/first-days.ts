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
    /** The room's own head while nothing has been made yet, for the owner and members alike, in place of "This week". */
    head: "Your first week",
    title: "Invite the people you serve with.",
    detail: "Once people join, their commitments and the ones still waiting for a yes show here.",
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
      mine: { lead: "See your part", rest: "What you have said yes to." },
      away: { lead: "Mark days away", rest: "So no one asks you while you are gone." },
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- every room's table is given the terms and the place; these sentences name neither
export const es = (t: Terms, place: string): ReturnType<typeof en> => ({
  week: {
    head: "Tu primera semana",
    title: "Invita a las personas con quienes sirves.",
    detail: "Cuando se unan personas, aquí verás sus compromisos y los que aún esperan un sí.",
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
      mine: { lead: "Mira tu parte", rest: "Lo que aceptaste." },
      away: { lead: "Marca tus días fuera", rest: "Así nadie te pide nada mientras no estás." },
    },
  },
});
