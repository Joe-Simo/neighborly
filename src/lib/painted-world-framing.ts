export function isPaintedPortrait(width: number, height: number) {
  return width <= 700 || (width <= 1000 && width / height < 0.9);
}

/** Keep the opening's original asset breakpoints independent of story-panel aspect ratios. */
export function getPaintedOpeningFraming(hostWidth: number, hostHeight: number, worldWidth: number, worldHeight: number) {
  const mobile = isPaintedPortrait(hostWidth, hostHeight);
  const narrow = hostWidth <= 420;
  const sourceWidth = mobile ? 7.8 : 14.4;
  const sourceHeight = mobile ? 16.88 : 10.24;
  // Portrait surfaces must show the whole authored opening, rather than a centre
  // slice of the tall painting with both faces outside the camera frustum.
  const fit = Math.min;
  return {
    mobile,
    narrow,
    sourceWidth,
    sourceHeight,
    scale: fit(worldWidth / sourceWidth, worldHeight / sourceHeight),
    poster: mobile
      ? narrow ? "/assets/living-relief-narrow.webp" : "/assets/living-relief-mobile.webp"
      : "/assets/living-relief-poster.webp",
  };
}

export function getPaintedLayerOffset(baseY: number, pointerY: number, depth: number, reducedMotion: boolean) {
  return baseY + (reducedMotion ? 0 : pointerY * depth * 0.008);
}

/** The dedicated art stage contains each complete painting at every viewport size. */
export function getPaintedArtworkFrame(worldWidth: number, worldHeight: number, imageAspect: number) {
  const contained = true;
  const width = Math.min(worldWidth, worldHeight * imageAspect);
  return { width, height: width / imageAspect, contained };
}

/** Normalized anchors belong to the painting, including its letterbox offset. */
export function getPaintedImagePoint(x: number, y: number, width: number, height: number, offsetX = 0, offsetY = 0) {
  return { x: offsetX + (x - 0.5) * width, y: offsetY + (0.5 - y) * height };
}
