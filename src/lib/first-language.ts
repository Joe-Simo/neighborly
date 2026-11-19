/**
 * The reader's language, set on the page's root: the one chosen at the door, else the device's (the same answer as
 * deviceLanguage in live-auth-words.ts). It is also written into the page as a script, from its own text, so it
 * uses nothing outside itself.
 */
export function sayReadersLanguage() {
  try {
    const known = ["en", "es"];
    let chosen = null, language = null;
    try { chosen = localStorage.getItem("kind-helps:language"); } catch {}
    if (chosen && known.indexOf(chosen) > -1) language = chosen;
    const tags = navigator.languages || [];
    for (let i = 0; i < tags.length && !language; i++)
      for (let j = 0; j < known.length; j++)
        if (tags[i].toLowerCase().indexOf(known[j]) === 0) { language = known[j]; break; }
    document.documentElement.lang = language || "en";
  } catch {}
}
/**
 * For a page that can stand at any address (not found, the page error): it carries both languages and runs this
 * ahead of its words, so the reader's own is the one shown from the first paint.
 */
export const readersLanguage = `(${sayReadersLanguage})()`;
/**
 * Run from the root layout's head, before anything is drawn, so the app's pages already say their language on a
 * fresh load. The Spanish privacy and accessibility pages say Spanish. The other public pages are English and are left alone.
 * Arriving by a link inside the site runs no script, so there <PageLanguage /> or <ReaderLanguage /> gives the same
 * answer before the first paint.
 */
export const firstLanguage = `(function(){try{var p=location.pathname;if(/^\\/(privacidad|accesibilidad|sobre)(\\/|$)/.test(p)){document.documentElement.lang="es";return}if(/^\\/(app|offline)(\\/|$)/.test(p))${readersLanguage}}catch(e){}})()`;
