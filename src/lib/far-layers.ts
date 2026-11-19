/**
 * The home page's large painted layers (each a masked picture, drawn by Safari into a layer of its own at the screen's full pixel density)
 * are not drawn while they are more than two windows from the reader: an iPhone counts every one of those layers against the tab, and kills
 * the tab when they add up. They keep their place in the layout, so nothing moves, and they are drawn again well before they come into sight.
 * Only decorative, hidden-from-assistive-technology layers are given to this; nothing that holds a link or a button.
 */
export function releaseFarLayers(root: ParentNode, selector: string): () => void {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.toggleAttribute("data-far", !entry.isIntersecting);
  }, { rootMargin: "200% 0px" });
  root.querySelectorAll(selector).forEach(layer => observer.observe(layer));
  return () => { observer.disconnect(); root.querySelectorAll("[data-far]").forEach(layer => layer.removeAttribute("data-far")); };
}
