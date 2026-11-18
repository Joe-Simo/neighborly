/**
 * A written-up visit, once its save has committed, is filed: the sheet folds in two along its middle (the lower
 * half folding up as bare paper, its fields gone from the first frame, like a turned page's back), the household's
 * manila file rises under it, and the folded sheet slides into the file, where it rests. Drawn on a copy above the
 * page, so the real sheet only steps aside; nothing fades. Under reduced motion it is not drawn.
 */
type Creased = { webkit?: { messageHandlers?: { kindHelpsFelt?: { postMessage: (felt: "creased") => void } } } };

function copyOf(sheet: HTMLElement) {
  const copy = sheet.cloneNode(true) as HTMLElement;
  const from = [sheet, ...sheet.querySelectorAll("*")];
  [copy, ...copy.querySelectorAll("*")].forEach((twin, index) => {
    const source = from[index];
    if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement || source instanceof HTMLSelectElement)
      (twin as typeof source).value = source.value;
    twin.removeAttribute("id");
  });
  return copy;
}

export async function fileAway(sheet: HTMLElement | null, household: string) {
  if (!sheet || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = sheet.getBoundingClientRect();
  const half = box.height / 2;
  // On a phone the sheet is as wide as the screen; folded, it draws in a little so its file fits inside the window.
  const scale = Math.min(1, (window.innerWidth - 40) / box.width);
  const stage = document.createElement("div");
  stage.setAttribute("aria-hidden", "true");
  stage.inert = true;
  stage.className = "file-away";
  Object.assign(stage.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  // The upper half keeps its heading; it is the copy, clipped at the fold.
  const top = document.createElement("div");
  top.className = "file-away-copy";
  top.style.height = `${box.height}px`;
  top.style.clipPath = "inset(0 0 50% 0)";
  const copy = copyOf(sheet);
  // Where the dialog is pinned to the window is undone on the copy, which sits in its frame.
  for (const [name, value] of [["position", "absolute"], ["inset", "0"], ["margin", "0"], ["translate", "none"], ["transform", "none"], ["animation", "none"], ["width", "100%"], ["max-width", "none"], ["height", "100%"], ["max-height", "none"], ["visibility", "visible"]])
    copy.style.setProperty(name, value, "important");
  top.append(copy);
  // The lower half is bare paper from the first frame, its back the same paper.
  const flap = document.createElement("div");
  flap.className = "file-away-flap";
  Object.assign(flap.style, { height: `${half}px`, top: `${half}px` });
  const folded = document.createElement("div");
  folded.className = "file-away-sheet";
  folded.append(top, flap);
  // The household's file: a manila pocket a little wider than the folded sheet, its name on the tab.
  const pocket = document.createElement("div");
  pocket.className = "file-away-pocket";
  const wide = box.width * scale + 16;
  Object.assign(pocket.style, { left: `${(box.width - wide) / 2}px`, width: `${wide}px`, top: `${half * 0.62}px`, height: `${half * 0.9}px` });
  const card = document.createElement("i");
  const below = `translateY(${window.innerHeight - box.top - half * 0.62 + 40}px)`;
  // Out of sight below the window until it rises.
  pocket.style.transform = below;
  const tab = document.createElement("span");
  tab.textContent = household;
  pocket.append(tab, card);
  stage.append(folded, pocket);
  document.body.append(stage);
  // A copy is drawn from its top: what the sheet had scrolled to is scrolled to again.
  const scrolled = [sheet, ...sheet.querySelectorAll("*")];
  [copy, ...copy.querySelectorAll("*")].forEach((twin, index) => { if (scrolled[index]?.scrollTop) twin.scrollTop = scrolled[index].scrollTop; });
  sheet.dataset.filed = "";
  // The shade stays on through the fold and the filing, and comes off with the file in one frame, unfaded.
  const shade = sheet.parentElement?.querySelector<HTMLElement>(':scope > [data-slot="dialog-overlay"]');
  shade?.style.setProperty("animation", "none", "important");
  shade?.style.setProperty("transition", "none", "important");
  sheet.style.setProperty("transition", "none", "important");
  sheet.style.setProperty("visibility", "hidden", "important");
  const ease = "cubic-bezier(0.3, 0.7, 0.2, 1)";
  const shrink = `scale(${scale})`;
  folded.animate([{ transform: "none" }, { transform: shrink }], { duration: 260, easing: ease, fill: "forwards" });
  await flap.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(180deg)" }], { duration: 260, easing: ease, fill: "forwards" }).finished;
  // In the iOS app the crease is felt once, as one light tap; the file rising and taking the sheet is not.
  (window as Creased).webkit?.messageHandlers?.kindHelpsFelt?.postMessage("creased");
  // The file rises once, under the sheet where it is.
  await pocket.animate([{ transform: below }, { transform: "none" }], { duration: 240, easing: ease, fill: "forwards" }).finished;
  // Into it, until only the sheet's top edge shows over the mouth; it rests there.
  folded.dataset.in = "";
  await folded.animate([{ transform: shrink }, { transform: `translateY(${half * 0.5}px) ${shrink}` }], { duration: 220, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" }).finished;
  await new Promise((rest) => setTimeout(rest, 120));
  stage.remove();
  shade?.style.setProperty("visibility", "hidden", "important");
}
