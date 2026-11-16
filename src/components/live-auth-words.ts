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
  sampleNote: "Made-up people. Whatever you change is cleared each night.",
  /** The same promise in a few words, for the smallest phones. */
  sampleNoteShort: "Made-up people, cleared nightly.",
  /** The quiet link to the privacy page, at the end of the language line. */
  privacy: "Privacy",
  sampleFailed: "The sample conference did not open. Try again.",
  sampleBusy: "The sample conference is busy. Try again in a minute.",
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
    other: "We couldn’t complete that. Please try again.",
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
  sample: "Recorrer una conferencia de muestra",
  sampleOpening: "Abriendo la conferencia de muestra…",
  sampleNote: "Personas inventadas. Lo que cambies se borra cada noche.",
  /** The same promise in a few words, for the smallest phones. */
  sampleNoteShort: "Personas inventadas, se borra cada noche.",
  /** The quiet link to the privacy page, at the end of the language line. */
  privacy: "Privacidad",
  sampleFailed: "La conferencia de muestra no se abrió. Inténtalo de nuevo.",
  sampleBusy: "La conferencia de muestra está ocupada. Inténtalo en un minuto.",
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
  codeHint: "Puede tardar un minuto en llegar. Mira en correo no deseado si no lo ves.",
  continue: "Continuar",
  sendAgain: "Enviar un código nuevo",
  sentAgain: "Código nuevo enviado",
  onItsWay: "Un código nuevo va en camino.",
  freshKicker: "Ya casi",
  freshHeading: "Un nuevo comienzo.",
  freshDeck: "Elige una contraseña nueva para",
  save: "Guardar e iniciar sesión",
  left: "Cerraste tu sesión.",
  language: "Idioma",
  errors: {
    email: "Ese correo electrónico no parece correcto.",
    exists: "Este correo ya tiene una cuenta. Elige Iniciar sesión.",
    noAccount:
      "Ninguna cuenta usa ese correo todavía. Elige Crear cuenta. Si ya estuviste aquí, usa el mismo correo y tus conferencias te estarán esperando.",
    password: "Esa contraseña no coincide. Inténtalo de nuevo o elige ¿Olvidaste tu contraseña?",
    short: "Usa al menos 8 caracteres en tu contraseña.",
    long: "Usa como máximo 72 caracteres en tu contraseña.",
    leakedSignIn:
      "Esta contraseña apareció en una filtración de datos de otro sitio. Elige ¿Olvidaste tu contraseña? para poner una nueva.",
    leaked: "Esa contraseña apareció en una filtración de datos de otro sitio. Elige otra, por favor.",
    common: "Elige una contraseña menos común.",
    code: "Ese código no coincide. Revisa el correo e inténtalo de nuevo, o envía un código nuevo.",
    expired: "Ese código venció. Envía uno nuevo.",
    tooMany: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    other: "No pudimos completar eso. Inténtalo de nuevo.",
  },
};

const ht: AuthWords = {
  back: "Tounen nan Kind Helps",
  kicker: "Plas ekip ou a",
  heading: {
    signIn: "Byenveni ankò.",
    signUp: "Bon travay kòmanse isit la.",
    start: "Rasanble moun ou yo.",
    join: "Yon plas ak moun ou yo.",
    reset: "Jwenn chemen ou ankò.",
  },
  deck: {
    signIn: "Konekte pou wè sa k ap vini ak kote yo bezwen ou.",
    signUp: "Kreye kont ou pou kòmanse yon konferans oswa aksepte yon envitasyon.",
    start: "Kreye kont ou, epi fè yon plas prive pou konferans ou a.",
    join: "Kreye kont ou pou antre nan konferans ou a ak yon envitasyon.",
    reset: "N ap voye yon kòd ba ou pa imèl pou chwazi yon nouvo modpas.",
  },
  options: "Chwa pou kont",
  signIn: "Konekte",
  create: "Kreye kont",
  email: "Imèl",
  password: "Modpas",
  newPassword: "Nouvo modpas",
  show: "Montre",
  hide: "Kache",
  showPassword: "Montre modpas la",
  hidePassword: "Kache modpas la",
  passwordHint: "Sèvi ak omwen 8 karaktè.",
  wait: "Tanpri tann…",
  emailCode: "Voye yon kòd ban mwen",
  forgot: "Ou bliye modpas ou?",
  backToSignIn: "Tounen pou konekte",
  sample: "Vizite yon konferans egzanp",
  sampleOpening: "N ap louvri konferans egzanp lan…",
  sampleNote: "Moun envante. Tout sa ou chanje efase chak swa.",
  /** The same promise in a few words, for the smallest phones. */
  sampleNoteShort: "Moun envante, efase chak swa.",
  /** The quiet link to the privacy page, at the end of the language line. */
  privacy: "Vi prive",
  sampleFailed: "Konferans egzanp lan pa louvri. Eseye ankò.",
  sampleBusy: "Konferans egzanp lan okipe. Eseye ankò nan yon minit.",
  foot: "Espas ou a prive. Antre nan yon ekip pa aksepte okenn angajman nan non ou.",
  differentEmail: "Sèvi ak yon lòt imèl",
  codeKicker: "Yon etap ankò",
  codeHeading: "Gade imèl ou.",
  codeSent: "Nou voye yon kòd sis chif nan",
  codeFor: {
    signUp: "Ekri li pou fin kreye kont ou.",
    reset: "Ekri li pou chwazi yon nouvo modpas.",
    signIn: "Ekri li pou fin konekte sou aparèy sa a.",
  },
  codeLabel: "Kòd ki nan imèl la",
  codeHint: "Li ka pran yon minit pou rive. Gade nan espam si ou pa wè li.",
  continue: "Kontinye",
  sendAgain: "Voye yon nouvo kòd",
  sentAgain: "Nouvo kòd voye",
  onItsWay: "Yon nouvo kòd nan wout.",
  freshKicker: "Prèske fini",
  freshHeading: "Yon nouvo kòmansman.",
  freshDeck: "Chwazi yon nouvo modpas pou",
  save: "Anrejistre epi konekte",
  left: "Ou dekonekte.",
  language: "Lang",
  errors: {
    email: "Adrès imèl sa a pa sanble kòrèk.",
    exists: "Imèl sa a gen yon kont deja. Chwazi Konekte.",
    noAccount:
      "Poko gen kont ki sèvi ak imèl sa a. Chwazi Kreye kont. Si ou te la deja, sèvi ak menm imèl la epi konferans ou yo ap tann ou.",
    password: "Modpas sa a pa bon. Eseye ankò, oswa chwazi Ou bliye modpas ou?",
    short: "Sèvi ak omwen 8 karaktè pou modpas ou.",
    long: "Pa sèvi ak plis pase 72 karaktè pou modpas ou.",
    leakedSignIn:
      "Modpas sa a te parèt nan yon fuit done sou yon lòt sit. Chwazi Ou bliye modpas ou? pou mete yon nouvo.",
    leaked: "Modpas sa a te parèt nan yon fuit done sou yon lòt sit. Tanpri chwazi yon lòt.",
    common: "Chwazi yon modpas ki mwens komen.",
    code: "Kòd sa a pa bon. Gade imèl la epi eseye ankò, oswa voye yon nouvo kòd.",
    expired: "Kòd sa a ekspire. Voye yon nouvo.",
    tooMany: "Twòp esè. Tann yon ti moman, epi eseye ankò.",
    other: "Nou pa t kapab fini sa. Tanpri eseye ankò.",
  },
};

export const authWords: Record<Language, AuthWords> = { en, es, ht };

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

/** The sheet's language. The server writes English; the device's own answer takes over as the page wakes. */
export function useEntryLanguage(): [Language, (language: Language) => void] {
  const language = useSyncExternalStore(
    (watch) => {
      watchers.add(watch);
      return () => void watchers.delete(watch);
    },
    () => (chosenNow ??= deviceLanguage()),
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
