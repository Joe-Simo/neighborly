import type { Language } from "@/lib/words";

/** The closing band and the foot, in each language. The home page is English; a public page of words closes in its own. */
export const endingWords = {
  en: {
    bring: ["Bring this to", "your people."], own: "Your own conference", start: "Start your conference", signIn: "Sign in",
    free: ["Free", " for every conference. Independent."], sample: "Sample conference", about: "About Kind Helps", privacy: "Privacy", privacyPath: "/privacy", access: "Accessibility", accessPath: "/accessibility", howMade: "How we made it", howMadePath: "/about/how-we-made-it",
    card: { for: "For", opening: "Opening…", look: "Look around a sample conference", madeUp: "Every person in the sample is made up.", who: "Who this card is for (optional)", stays: "Stays in this tab." },
  },
  es: {
    bring: ["Lleva esto a", "tu gente."], own: "Tu propia conferencia", start: "Empieza tu conferencia", signIn: "Iniciar sesión",
    free: ["Gratis", " para toda conferencia. Independiente."], sample: "Conferencia de muestra", about: "Acerca de Kind Helps", privacy: "Privacidad", privacyPath: "/privacidad", access: "Accesibilidad", accessPath: "/accesibilidad", howMade: "Cómo lo hicimos", howMadePath: "/sobre/como-lo-hicimos",
    card: { for: "Para", opening: "Abriendo…", look: "Recorrer una muestra", madeUp: "Todos en la muestra son inventados.", who: "Para quién es esta tarjeta (opcional)", stays: "Se queda en esta pestaña." },
  },
} satisfies Record<Language, unknown>;
export type CardWords = (typeof endingWords)[Language]["card"];
