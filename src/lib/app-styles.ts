import { preinit, preload } from "react-dom";

type Style = { href: string; precedence: string };
let list: Promise<Style[]> | undefined;
/** The workspace's own stylesheets, as the build found them (scripts/app-styles.mts). None, quietly, where there is no list. */
const styles = () =>
  (list ??= fetch("/app-styles.json")
    .then((response) => (response.ok ? (response.json() as Promise<Style[]>) : []))
    .catch(() => []));

/** Fetched once the page is idle: in the cache, so a door's styles are only ever applied, never waited for. */
export function preloadAppStyles() {
  void styles().then((all) => all.forEach(({ href }) => preload(href, { as: "style" })));
}

/**
 * Put in place as a door is reached for (pointer, focus or touch): going in, React finds them already in the head and adds none,
 * so the page is not styled again inside the commit, in the frame the turn covers the window.
 */
export function warmAppStyles() {
  void styles().then((all) => all.forEach(({ href, precedence }) => preinit(href, { as: "style", precedence })));
}
