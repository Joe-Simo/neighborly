import type { Language } from "@/lib/words";

/**
 * The month check's words, in EN and ES. Kept here, imported only by the treasury's month check, so they load with
 * this room and not with every room's words. Each sentence is whole in each language.
 */
const books = {
  en: {
    check: "Check this month",
    checking: "Checking…",
    clear: "Nothing to look at this month.",
    found: (count: number) => (count === 1 ? "1 line to look at" : `${count} lines to look at`),
    unread: "The memos were not read this time. The other checks stand.",
    kinds: {
      double: "Maybe entered twice: same payee, amount and direction within a week",
      overApproved: "Paid more than the request's approved amount",
      noCategory: "No category",
      noPayee: "No payee",
      offCategory: "The assistant read the memo as spending outside its category",
    },
    failed: "The check could not run. Try again in a minute.",
  },
  es: {
    check: "Revisar este mes",
    checking: "Revisando…",
    clear: "Nada que revisar este mes.",
    found: (count: number) => (count === 1 ? "1 línea para revisar" : `${count} líneas para revisar`),
    unread: "Esta vez no se leyeron las notas. Las demás revisiones siguen en pie.",
    kinds: {
      double: "Quizá anotado dos veces: mismo beneficiario, monto y sentido en una semana",
      overApproved: "Se pagó más de lo aprobado en la petición",
      noCategory: "Sin categoría",
      noPayee: "Sin beneficiario",
      offCategory: "El asistente leyó la nota como un gasto fuera de su categoría",
    },
    failed: "No se pudo revisar. Inténtalo de nuevo en un minuto.",
  },
} satisfies Record<Language, unknown>;

export const checkWords = (language: Language) => books[language];
