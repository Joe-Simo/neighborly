/**
 * Whether the person asks for less motion, kept as the answer last given. Asking `matchMedia(...).matches` anew
 * makes the browser work out the page's styles on the spot, which inside a room's first frame is the whole room.
 */
let query: MediaQueryList | undefined;
let less = false;
export function lessMotion() {
  if (!query) {
    query = matchMedia("(prefers-reduced-motion: reduce)");
    less = query.matches;
    query.addEventListener("change", (event) => void (less = event.matches));
  }
  return less;
}
