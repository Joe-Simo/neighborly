import { areaTitles, areaTitlesEs, liveAreas } from "@/components/workspace/areas";
import { words } from "@/lib/words";

/**
 * The tab of each page whose <title> React is not given (the app's and the offline page's), by address, in each
 * language: each room's, the workspace's, and the offline page's.
 */
export const tabs: Record<string, [en: string, es: string]> = Object.fromEntries([
  ...liveAreas.map((area) => [`/app/${area}`, [`${areaTitles[area]} · Kind Helps`, `${areaTitlesEs[area]} · Kind Helps`]]),
  // `workspaceTab` in live-auth-words.ts, a client module (a test holds them the same).
  ["/app", ["Your workspace · Kind Helps", "Tu espacio · Kind Helps"]],
  ["/offline", [words("en").states.offlinePageTab, words("es").states.offlinePageTab]],
]);

/**
 * Run from the root layout's head right after first-language.ts has set the page's language, before anything is
 * drawn: the tab is named in the reader's language from the first paint. After that the app names it
 * (live-frame.tsx, live-auth.tsx, live-welcome.tsx, shell.tsx). Written into the page, not into a script bundle,
 * so no page's scripts grow by it.
 */
export const firstTab = `(function(){try{var t=${JSON.stringify(tabs)}[location.pathname.replace(/\\/$/,"")];if(t)document.title=t[document.documentElement.lang==="es"?1:0]}catch(e){}})()`;
