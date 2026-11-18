import { useSyncExternalStore } from "react";
import { languages, type Language } from "@/lib/words";

/** Every phrase of the sign-in sheet. English is the source; the other two follow its shape. */
const en = {
  back: "Back to Kind Helps",
  kicker: "Your team’s place",
  heading: {
    signIn: "Welcome back.",
    signUp: "Good work starts here.",
    start: "Bring your people together.",
    join: "A place with your people.",
    reset: "Find your way back.",
  },
  deck: {
    signIn: "Sign in to see what’s coming up and where you’re needed.",
    signUp: "Create your account to start a conference or accept an invitation.",
    start: "Create your account, then make a private place for your conference.",
    join: "Create your account to join your conference with an invitation.",
    reset: "We’ll email you a code to choose a new password.",
  },
  options: "Account options",
  signIn: "Sign in",
  create: "Create account",
  /** Read after a tab's own words, so the tab and the form's button are not two controls of one name. */
  tabHint: { signIn: "use an account you already have", create: "make a new account" },
  email: "Email",
  password: "Password",
  newPassword: "New password",
  show: "Show",
  hide: "Hide",
  showPassword: "Show password",
  hidePassword: "Hide password",
  passwordHint: "Use at least 8 characters.",
  wait: "Please wait…",
  emailCode: "Email me a code",
  forgot: "Forgot your password?",
  backToSignIn: "Back to sign in",
  sample: "Look around a sample conference",
  sampleOpening: "Opening the sample conference…",
  sampleResetting: "Setting the sample up fresh. One moment.",
  leaveSample: "Leave the sample",
  /** In the app, while the sheet waits to turn off the room it opens. */
  opening: "Opening…",
  sampleNote: "Made-up people. Whatever you change is cleared each night.",
  /** The same promise in a few words, for the smallest phones. */
  sampleNoteShort: "Made-up people, cleared nightly.",
  /** The quiet link to the privacy page, at the end of the language line. */
  privacy: "Privacy",
  /** The privacy page has an address in each language. */
  privacyPath: "/privacy",
  sampleFailed: "The sample conference did not open. Try again.",
  sampleBusy: "The sample conference is busy. Try again in a minute.",
  workspaceTab: "Your workspace · Kind Helps",
  foot: "Your workspace is private. Joining a team does not accept any commitment on your behalf.",
  differentEmail: "Use a different email",
  codeKicker: "One more step",
  codeHeading: "Check your email.",
  codeSent: "We sent a six-digit code to",
  codeFor: {
    signUp: "Enter it to finish creating your account.",
    reset: "Enter it to choose a new password.",
    signIn: "Enter it to finish signing in on this device.",
  },
  codeLabel: "Code from the email",
  codeHint: "It can take a minute to arrive. Look in spam if you don’t see it.",
  continue: "Continue",
  sendAgain: "Send a new code",
  sentAgain: "New code sent",
  onItsWay: "A new code is on its way.",
  freshKicker: "Almost there",
  freshHeading: "A fresh start.",
  freshDeck: "Choose a new password for",
  save: "Save and sign in",
  left: "You’re signed out.",
  badInvite: "This invitation is no longer good. Ask the person who invited you to send a new one.",
  language: "Language",
  errors: {
    email: "That email address doesn’t look right.",
    exists: "This email already has an account. Choose Sign in.",
    noAccount:
      "No account uses that email yet. Choose Create account. If you were here before, use the same email and your conferences will be waiting.",
    password: "That password doesn’t match. Try again, or choose Forgot your password.",
    short: "Use at least 8 characters for your password.",
    long: "Use no more than 72 characters for your password.",
    leakedSignIn:
      "This password has appeared in a data leak on another site. Choose Forgot your password to set a new one.",
    leaked: "That password has appeared in a data leak on another site. Please choose a different one.",
    common: "Choose a less common password.",
    code: "That code doesn’t match. Check the email and try again, or send a new code.",
    expired: "That code has expired. Send a new one.",
    tooMany: "Too many attempts. Wait a little while, then try again.",
    other: "That didn’t go through. Try again.",
  },
};
export type AuthWords = typeof en;
export type AuthError = keyof AuthWords["errors"];

const es: AuthWords = {
  back: "Volver a Kind Helps",
  kicker: "El lugar de tu equipo",
  heading: {
    signIn: "Qué gusto verte.",
    signUp: "El buen trabajo empieza aquí.",
    start: "Reúne a tu gente.",
    join: "Un lugar con tu gente.",
    reset: "Encuentra el camino de vuelta.",
  },
  deck: {
    signIn: "Inicia sesión para ver lo que viene y dónde te necesitan.",
    signUp: "Crea tu cuenta para empezar una conferencia o aceptar una invitación.",
    start: "Crea tu cuenta y luego un lugar privado para tu conferencia.",
    join: "Crea tu cuenta para unirte a tu conferencia con una invitación.",
    reset: "Te enviaremos un código por correo para elegir una contraseña nueva.",
  },
  options: "Opciones de cuenta",
  signIn: "Iniciar sesión",
  create: "Crear cuenta",
  /** Read after a tab's own words, so the tab and the form's button are not two controls of one name. */
  tabHint: { signIn: "usa una cuenta que ya tienes", create: "crea una cuenta nueva" },
  email: "Correo electrónico",
  password: "Contraseña",
  newPassword: "Contraseña nueva",
  show: "Ver",
  hide: "Ocultar",
  showPassword: "Ver la contraseña",
  hidePassword: "Ocultar la contraseña",
  passwordHint: "Usa al menos 8 caracteres.",
  wait: "Un momento…",
  emailCode: "Enviarme un código",
  forgot: "¿Olvidaste tu contraseña?",
  backToSignIn: "Volver a iniciar sesión",
  sample: "Recorrer una muestra",
  sampleOpening: "Abriendo la conferencia de muestra…",
  sampleResetting: "Estamos dejando la muestra como nueva. Un momento.",
  leaveSample: "Salir de la muestra",
  opening: "Abriendo…",
  sampleNote: "Personas inventadas. Lo que cambies se borra cada noche.",
  /** The same promise in a few words, for the smallest phones. */
  sampleNoteShort: "Todo inventado, se borra cada noche.",
  /** The quiet link to the privacy page, at the end of the language line. */
  privacy: "Privacidad",
  privacyPath: "/privacidad",
  sampleFailed: "La conferencia de muestra no se abrió. Inténtalo de nuevo.",
  sampleBusy: "La conferencia de muestra está ocupada. Inténtalo en un minuto.",
  workspaceTab: "Tu espacio · Kind Helps",
  foot: "Tu espacio es privado. Unirte a un equipo no acepta ningún compromiso en tu nombre.",
  differentEmail: "Usar otro correo",
  codeKicker: "Un paso más",
  codeHeading: "Revisa tu correo.",
  codeSent: "Enviamos un código de seis dígitos a",
  codeFor: {
    signUp: "Escríbelo para terminar de crear tu cuenta.",
    reset: "Escríbelo para elegir una contraseña nueva.",
    signIn: "Escríbelo para terminar de iniciar sesión en este dispositivo.",
  },
  codeLabel: "Código del correo",
  codeHint: "Puede tardar un minuto en llegar. Si no lo ves, mira en el correo no deseado.",
  continue: "Continuar",
  sendAgain: "Enviar un código nuevo",
  sentAgain: "Código nuevo enviado",
  onItsWay: "Un código nuevo va en camino.",
  freshKicker: "Ya casi",
  freshHeading: "Un nuevo comienzo.",
  freshDeck: "Elige una contraseña nueva para",
  save: "Guardar e iniciar sesión",
  left: "Cerraste tu sesión.",
  badInvite: "Esta invitación ya no es válida. Pídele a quien te invitó que te envíe una nueva.",
  language: "Idioma",
  errors: {
    email: "Ese correo electrónico no parece correcto.",
    exists: "Este correo ya tiene una cuenta. Elige «Iniciar sesión».",
    noAccount:
      "Ninguna cuenta usa ese correo todavía. Elige «Crear cuenta». Si ya estuviste aquí, usa el mismo correo y tus conferencias te estarán esperando.",
    password: "Esa contraseña no coincide. Inténtalo de nuevo o elige «¿Olvidaste tu contraseña?».",
    short: "Usa al menos 8 caracteres en tu contraseña.",
    long: "Usa como máximo 72 caracteres en tu contraseña.",
    leakedSignIn:
      "Esta contraseña apareció en una filtración de datos de otro sitio. Elige «¿Olvidaste tu contraseña?» para poner una nueva.",
    leaked: "Esa contraseña apareció en una filtración de datos de otro sitio. Elige otra, por favor.",
    common: "Elige una contraseña menos común.",
    code: "Ese código no coincide. Revisa el correo e inténtalo de nuevo, o envía un código nuevo.",
    expired: "Ese código venció. Envía uno nuevo.",
    tooMany: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    other: "No pudimos completar eso. Inténtalo de nuevo.",
  },
};

export const authWords: Record<Language, AuthWords> = { en, es };

const kept = "kind-helps:language";
/** A language pressed on the entry sheet in this visit, waiting to be carried into the workspace. */
const pressed = "kind-helps:language-pressed";
const watchers = new Set<() => void>();

/** Before anyone is signed in there is no saved language: use the one chosen here last, or the device's. */
function deviceLanguage(): Language {
  try {
    const chosen = window.localStorage.getItem(kept);
    const match = languages.find((language) => language === chosen);
    if (match) return match;
  } catch {
    // Storage can be closed in a private window; the device's language still answers.
  }
  for (const tag of window.navigator.languages ?? []) {
    const match = languages.find((language) => tag.toLowerCase().startsWith(language));
    if (match) return match;
  }
  return "en";
}
let chosenNow: Language | undefined;
/** The door's language as the device answers it now, for what must be right before the page has woken. */
export const entryLanguageNow = () => (chosenNow ??= deviceLanguage());

/** The sheet's language. The server writes English; the device's own answer takes over as the page wakes. */
export function useEntryLanguage(): [Language, (language: Language) => void] {
  const language = useSyncExternalStore(
    (watch) => {
      watchers.add(watch);
      return () => void watchers.delete(watch);
    },
    entryLanguageNow,
    () => "en" as Language,
  );
  return [
    language,
    (next) => {
      chosenNow = next;
      try {
        window.localStorage.setItem(kept, next);
      } catch {
        // The choice still holds for this visit.
      }
      try {
        window.sessionStorage.setItem(pressed, next);
      } catch {
        // Without it the workspace still takes this language when the person has none saved.
      }
      watchers.forEach((watch) => watch());
    },
  ];
}

/**
 * What the entry sheet spoke, for the workspace to carry on in. `pressed` is true when the person chose it there
 * in this visit, and reading it once clears that: a choice made at the door outranks an older saved one, while the
 * device's own language only fills in for a person who has never chosen.
 */
export function takeEntryLanguage(): { language: Language; pressed: boolean } {
  let chose: Language | undefined;
  try {
    const value = window.sessionStorage.getItem(pressed);
    chose = languages.find((language) => language === value);
    window.sessionStorage.removeItem(pressed);
  } catch {
    // Closed storage: the device's language still answers below.
  }
  return { language: chose ?? (chosenNow ??= deviceLanguage()), pressed: chose !== undefined };
}

/** Set by the workspace as someone signs out, so the sheet they land on can say so once. */
export const leftKey = "kind-helps:left";
let leftNow: boolean | undefined;
function readLeft(): boolean {
  try {
    const left = window.sessionStorage.getItem(leftKey) !== null;
    window.sessionStorage.removeItem(leftKey);
    return left;
  } catch {
    return false;
  }
}
const never = () => () => {};
/** True on the first sheet after a sign-out, and only there. */
export function useJustLeft(): boolean {
  return useSyncExternalStore(never, () => (leftNow ??= readLeft()), () => false);
}

/**
 * The server names the workspace's tab in English, the only language it knows. Given that title (in either
 * language) this answers it in the reader's own; any other title, a room's or a sheet's, is left as it is.
 */
export const tabInReadersLanguage = (title: string) =>
  languages.some((language) => authWords[language].workspaceTab === title) ? authWords[entryLanguageNow()].workspaceTab : title;
