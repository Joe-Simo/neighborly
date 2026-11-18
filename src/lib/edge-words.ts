import type { Language } from "@/lib/words";

/** The words of the pages that stand outside every other page: not found, and a page that failed to open. */
export const edgeWords = {
  en: {
    home: "Kind Helps home", back: "Back to Kind Helps",
    lost: "This door isn’t here.", courtyard: "Back to the courtyard", lostTab: "Page not found — Kind Helps",
    failed: "This page didn’t open.", failedDeck: "Nothing is lost. Try again in a moment.", tryAgain: "Try again", failedTab: "This page didn’t open — Kind Helps",
  },
  es: {
    home: "Inicio de Kind Helps", back: "Volver a Kind Helps",
    lost: "Esta puerta no está aquí.", courtyard: "Volver al patio", lostTab: "Página no encontrada — Kind Helps",
    failed: "Esta página no se abrió.", failedDeck: "No se perdió nada. Inténtalo de nuevo en un momento.", tryAgain: "Intentar de nuevo", failedTab: "Esta página no se abrió — Kind Helps",
  },
} satisfies Record<Language, Record<string, string>>;
