/**
 * The window's size, read once on each resize rather than in a frame: reading innerWidth or innerHeight after a frame has written styles makes
 * the browser lay the page out again just to answer. A resize event always comes before the frame that follows it, so every frame sees the new size.
 */
export const viewport = { width: 0, height: 0 };
const measure = () => { viewport.width = innerWidth; viewport.height = innerHeight; };
if (typeof window !== "undefined") { measure(); addEventListener("resize", measure); }
