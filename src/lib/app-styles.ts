import { preinit, preload } from "react-dom";

// A stylesheet carries its precedence; a script (`as: "script"`) is one of the chunks the workspace's segments draw.
type Style = { href: string; precedence: string; as?: undefined } | { href: string; as: "script"; precedence?: undefined };
let list: Promise<Style[]> | undefined;
/** The workspace's own stylesheets, as the build found them (scripts/app-styles.mts). None, quietly, where there is no list. */
const styles = () =>
  (list ??= fetch("/app-styles.json")
    .then((response) => (response.ok ? (response.json() as Promise<Style[]>) : []))
    .catch(() => []));

/** Fetched once the page is idle: in the cache, so a door's styles are only ever applied, never waited for. */
export function preloadAppStyles() {
  void styles().then((all) => all.forEach(({ href, as }) => preload(href, { as: as ?? "style" })));
}

/**
 * Put in place as a door is reached for (pointer, focus or touch): going in, React finds them already in the head and adds none,
 * so the page is not styled again inside the commit, in the frame the turn covers the window.
 */
export function warmAppStyles() {
  void styles().then((all) => all.forEach((each) => preinit(each.href, each.as === "script" ? { as: "script" } : { as: "style", precedence: each.precedence })));
}
