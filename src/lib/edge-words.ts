import type { Language } from "@/lib/words";

/** The words of the pages that stand outside every other page: not found, and a page that failed to open. */
export const edgeWords = {
  en: {
    home: "Kind Helps home", back: "Back to Kind Helps",
    lost: "This door isn’t here.", lostSlip: "No one at this address.", courtyard: "Back to the courtyard", lostTab: "Page not found · Kind Helps",
    lostAbout: "The address may be old or mistyped. Kind Helps is at kindhelps.com.",
    offlineAbout: "This device is offline, so this page couldn’t open. Try again once the connection returns.",
    failed: "This page didn’t open.", failedDeck: "What you saved is safe. Try again in a moment.", tryAgain: "Try again", failedTab: "This page didn’t open · Kind Helps",
  },
  es: {
    home: "Inicio de Kind Helps", back: "Volver a Kind Helps",
    lost: "Esta puerta no está aquí.", lostSlip: "No hay nadie en esta dirección.", courtyard: "Volver al patio", lostTab: "Página no encontrada · Kind Helps",
    lostAbout: "La dirección puede ser vieja o tener un error. Kind Helps está en kindhelps.com.",
    offlineAbout: "Este dispositivo no tiene conexión, así que esta página no se abrió. Inténtalo de nuevo cuando vuelva la conexión.",
    failed: "Esta página no se abrió.", failedDeck: "Lo que guardaste está a salvo. Inténtalo de nuevo en un momento.", tryAgain: "Intentar de nuevo", failedTab: "Esta página no se abrió · Kind Helps",
  },
} satisfies Record<Language, Record<string, string>>;
