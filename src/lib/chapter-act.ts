/**
 * A chapter's act: how far its picture and words have come in (--e) and how far its one movement has gone (--h, with --q = 1 - h).
 * The values are registered not to pass down (relief-journey.css) and are written only on the parts drawn with them, so a frame of
 * the scroll restyles those few parts, not every element of the chapter. At rest, and without script, the registered values stand at rest.
 */
const drawnWithAct = ".relief-words h2, .relief-words p, .relief-picture, .relief-layers>picture, .relief-shadow, .relief-piece";
const parts = new WeakMap<HTMLElement, HTMLElement[]>();
const written = new WeakMap<HTMLElement, string>();

/** Sets a chapter's act; a value equal to the last one written is not written again. */
export function setAct(panel: HTMLElement, e: string, h: string) {
  let drawn = parts.get(panel);
  if (!drawn) { drawn = [...panel.querySelectorAll<HTMLElement>(drawnWithAct)]; parts.set(panel, drawn); }
  if (written.get(panel) === `${e} ${h}`) return;
  written.set(panel, `${e} ${h}`);
  const q = (1 - Number(h)).toFixed(4);
  for (const part of drawn) { part.style.setProperty("--e", e); part.style.setProperty("--h", h); part.style.setProperty("--q", q); }
}
