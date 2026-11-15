import { getCourtyardLayout, getJourneyZoom } from "./courtyard-motion";

/** Cover the viewport with the source painting, then center its right-hand doorway. */
export function getHallTransitionFraming(width: number, height: number, sourceAspect: number, approach: number, reduced = false) {
  const imageHeight = Math.max(height, width / sourceAspect);
  const imageWidth = imageHeight * sourceAspect;
  const progress = Math.max(0, Math.min(1, Number.isFinite(approach) ? approach : 0));
  const doorwayX = imageWidth * .86;
  const doorwayScreenX = (width - imageWidth) / 2 + doorwayX;
  const scale = reduced ? 1 : 1 + progress;
  const desiredX = reduced ? 0 : (width / 2 - doorwayScreenX) * progress;
  const left = (width - imageWidth) / 2;
  const minimumX = width - left - doorwayX * (1 - scale) - imageWidth * scale;
  const maximumX = -left - doorwayX * (1 - scale);
  return {
    imageWidth, imageHeight, originX: doorwayX, originY: imageHeight / 2,
    scale,
    translateX: Math.max(minimumX, Math.min(maximumX, desiredX)),
  };
}

/** Match the preceding courtyard shot before approaching its right-hand door. */
export function getEmbeddedHallTransitionFraming(width: number, height: number, approach: number, reduced = false) {
  const base = getCourtyardLayout(width, height);
  const zoom = getJourneyZoom(.9, width < height);
  const imageWidth = base.width * zoom;
  const imageHeight = base.height * zoom;
  const progress = reduced ? 0 : Math.max(0, Math.min(1, Number.isFinite(approach) ? approach : 0));
  const originX = imageWidth * .86;
  const initialX = -.86 * ((imageWidth - width) / 2) * .95;
  const doorwayScreenX = (width - imageWidth) / 2 + originX;
  const targetX = width / 2 - doorwayScreenX;
  return {
    imageWidth, imageHeight, originX, originY: imageHeight / 2,
    scale: 1 + progress,
    translateX: initialX + (targetX - initialX) * progress,
  };
}
