import { getDepthEntryFrame } from "./depth-entry";
export type CourtyardDestination = 0 | 1 | 2;
export type CourtyardMotionOptions = { onDestination?: (destination: CourtyardDestination) => void; responseFocus?: boolean; scrollCare?: boolean; onScrollCare?: (states: readonly [boolean, boolean, boolean]) => void };

const destinations = [.86, 0, -.86] as const;
const clamp = (value: number) => Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
const variables = ["--scene-width", "--scene-height", "--scene-x", "--scene-y", "--fore-x", "--fore-y", "--scene-scale", "--care-zoom", "--table-chair", "--table-settings", "--garden-basket", "--garden-plants", "--hall-chairs", "--hall-flowers", "--harvest-transfer", "--harvest-placement", "--harvest-opacity"] as const;

export function getCourtyardCareFrame(elapsed: number) {
  const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  return { approach: ease(elapsed / 650), reveal: elapsed >= 650, zoom: elapsed < 1350 ? .06 * ease((elapsed - 650) / 700) : .06 * (1 - ease((elapsed - 1350) / 650)), complete: elapsed >= 2000 };
}

/** The chair arrives first; place settings follow before the camera settles. */
export function getTableActionFrame(elapsed: number) {
  const ease = (value: number) => { const t = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); return t * t * (3 - 2 * t); };
  return {
    approach: ease(elapsed / 650), reveal: elapsed >= 650,
    chair: ease((elapsed - 600) / 900), settings: ease((elapsed - 1400) / 1000),
    zoom: elapsed < 2400 ? .06 * ease((elapsed - 650) / 700) : .06 * (1 - ease((elapsed - 2400) / 800)),
    complete: elapsed >= 3200,
  };
}

export function getGardenActionFrame(elapsed: number) {
  const shared = getTableActionFrame(elapsed);
  const ease = (value: number) => { const t = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); return t * t * (3 - 2 * t); };
  return { ...shared, basket: ease((elapsed - 650) / 850), plants: ease((elapsed - 1400) / 1000) };
}

export function getHallActionFrame(elapsed: number) {
  const shared = getTableActionFrame(elapsed);
  const ease = (value: number) => { const t = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); return t * t * (3 - 2 * t); };
  return { ...shared, chairs: ease((elapsed - 650) / 950), flowers: ease((elapsed - 1500) / 900) };
}

export function getScrollCareFrame(progress: number, reduced = false) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const phase = (start: number, end: number) => Math.max(0, Math.min(1, (value - start) / (end - start)));
  const stages = [phase(.2, .31), phase(.48, .64), phase(.81, .93)] as const;
  const completed = [value >= .31, value >= .64, value >= .93] as const;
  const times = stages.map((stage, index) => reduced ? completed[index] ? 3200 : 0 : stage * 3200);
  return { garden: getGardenActionFrame(times[0]), table: getTableActionFrame(times[1]), hall: getHallActionFrame(times[2]), completed };
}

export function getHarvestTransfer(progress: number) {
  const value = Number.isFinite(progress) ? progress : 0;
  const transfer = Math.max(0, Math.min(1, (value - .32) / .13));
  return transfer * transfer * (3 - 2 * transfer);
}

export function getHarvestPlacement(progress: number, reduced = false): { position: 0 | 1; opacity: number } {
  const value = Number.isFinite(progress) ? progress : 0;
  if (reduced) return { position: value < .385 ? 0 : 1, opacity: 1 };
  const position = value < .39 ? 0 : 1;
  const ease = (t: number) => { const bounded = Math.max(0, Math.min(1, t)); return bounded * bounded * (3 - 2 * bounded); };
  const opacity = value <= .34 ? 1 : value < .375 ? 1 - ease((value - .34) / .035) : value <= .405 ? 0 : value < .45 ? ease((value - .405) / .045) : 1;
  return { position, opacity };
}

export function getJourneyDestination(progress: number): CourtyardDestination {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return value < .385 ? 0 : value < .73 ? 1 : 2;
}

export function getJourneyPosition(progress: number) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (value <= .32) return destinations[0];
  if (value < .45) return destinations[0] * (1 - ease((value - .32) / .13));
  if (value <= .66) return destinations[1];
  if (value < .8) return destinations[2] * ease((value - .66) / .14);
  if (value <= .9) return destinations[2];
  if (value === 1) return 0;
  return destinations[2] * (1 - ease((value - .9) / .1));
}

export function getCandidateJourneyPosition(progress: number) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (value <= .9) return getJourneyPosition(value);
  if (value <= .95) return destinations[2];
  if (value === 1) return 0;
  const t = (value - .95) / .05;
  return destinations[2] * (1 - t * t * (3 - 2 * t));
}

export function getJourneyZoom(progress: number, portrait: boolean) {
  if (portrait) return 1;
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (value < .1) return 1 + .12 * ease(value / .1);
  if (value <= .32) return 1.12;
  if (value < .45) return 1.12 + .06 * ease((value - .32) / .13);
  if (value <= .66) return 1.18;
  if (value < .8) return 1.18 - .06 * ease((value - .66) / .14);
  if (value <= .9) return 1.12;
  return 1.12 - .12 * ease((value - .9) / .1);
}

export function getCourtyardLayout(width: number, height: number) {
  const sceneHeight = Math.max(height, width / 2) * 1.16;
  const sceneWidth = sceneHeight * 2;
  return { width: sceneWidth, height: sceneHeight, range: Math.max(0, (sceneWidth - width) / 2) };
}

/** Native vertical scroll remains available until a deliberate horizontal drag wins. */
export function createCourtyardMotion(host: HTMLElement, options: CourtyardMotionOptions = {}) {
  const previousVariables = new Map(variables.map(name => [name, host.style.getPropertyValue(name)]));
  const writtenVariables = new Map<string, string>();
  function setVariable(name: typeof variables[number], value: string) {
    if (writtenVariables.get(name) === value) return;
    writtenVariables.set(name, value);
    host.style.setProperty(name, value);
  }
  const previousVisible = host.getAttribute("data-courtyard-visible");
  const previousReduced = host.getAttribute("data-courtyard-reduced");
  const previousDragging = host.getAttribute("data-courtyard-dragging");
  const previousTouchAction = host.style.touchAction;
  const previousUserSelect = host.style.userSelect;
  host.style.touchAction = "pan-y";
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches;
  let opened = false;
  let disposed = false;
  let visible = true;
  let frame = 0;
  let lastTime = 0;
  let position = 0;
  let target = 0;
  let velocity = 0;
  let range = 1;
  let viewportWidth = 0;
  let viewportHeight = 0;
  let mode: "idle" | "drag" | "coast" | "focus" = "idle";
  let reported: CourtyardDestination = 1;
  let echoDestination: CourtyardDestination | null = null;
  let pointerId: number | null = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startPosition = 0;
  let lastX = 0;
  let lastPointerTime = 0;
  let zoom = 0;
  let targetZoom = 0;
  let overviewFraming = false;
  let invitationAccepted = false;
  let scrollCareStates: readonly [boolean, boolean, boolean] | undefined = [false, false, false];
  let journeyProgress: number | undefined;
  let depthEntryTravel: number | undefined;
  let tableChair = 0;
  let tableSettings = 0;
  let gardenBasket = 0;
  let gardenPlants = 0;
  let hallChairs = 0;
  let hallFlowers = 0;
  let returning: { destination: CourtyardDestination; start: number | null; from: number; secondaryFrom?: number; duration: number; onComplete?: () => void } | null = null;
  function cancelReturn() {
    const previous = returning; returning = null;
    if (previous?.onComplete) { settleObjects(previous.destination, 0); write(); if (!disposed) previous.onComplete(); }
  }
  function secondaryProgress(destination: CourtyardDestination) { return destination === 0 ? gardenPlants : destination === 1 ? tableSettings : hallChairs; }
  function setSecondaryProgress(destination: CourtyardDestination, value: number) {
    if (destination === 0) gardenPlants = value;
    else if (destination === 1) tableSettings = value;
    else hallChairs = value;
  }
  function primaryProgress(destination: CourtyardDestination) { return destination === 0 ? gardenBasket : destination === 1 ? tableChair : hallFlowers; }
  function setPrimaryProgress(destination: CourtyardDestination, value: number) {
    if (destination === 0) gardenBasket = value;
    else if (destination === 1) tableChair = value;
    else hallFlowers = value;
  }
  function settleObjects(destination: CourtyardDestination, value: number) {
    if (destination === 0) gardenBasket = gardenPlants = value;
    else if (destination === 1) tableChair = tableSettings = value;
    else hallChairs = hallFlowers = value;
  }
  let care: { destination: CourtyardDestination; start: number | null; from: number; to: number; revealed: boolean; chairFrom?: number; basketFrom?: number; hallFrom?: number; cameraOwned?: boolean; onReveal: () => void; onComplete: () => void } | null = null;
  function finishCare() {
    const active = care;
    if (!active) return;
    care = null;
    settleObjects(active.destination, 1);
    write();
    if (!active.revealed) active.onReveal();
    if (!disposed) active.onComplete();
  }
  function cancelCare() {
    const previous = care; care = null; zoom = targetZoom = 0;
    if (previous) {
      settleObjects(previous.destination, previous.revealed ? 1 : 0);
      write();
    }
    if (previous && !disposed) previous.onComplete();
  }

  function focusResponse(destination: CourtyardDestination) {
    if (!options.responseFocus || destination === 0) { zoom = targetZoom = 0; mode = "idle"; return; }
    const portrait = viewportWidth < viewportHeight;
    target = destination === 1 ? -.08 : -.9;
    // Portrait keeps the entire painted gesture and both faces within the crop.
    targetZoom = portrait ? 0 : destination === 1 ? .08 : .1;
    if (reduced) { position = target; zoom = targetZoom; mode = "idle"; }
    else mode = "focus";
  }
  function journeyPosition(progress: number) { return options.responseFocus ? getCandidateJourneyPosition(progress) : getJourneyPosition(progress); }
  function restoreResponseFraming() {
    if (!options.responseFocus) return;
    targetZoom = 0;
    target = journeyProgress === undefined ? destinations[reported] : journeyPosition(journeyProgress);
    if (reduced) { position = target; zoom = 0; mode = "idle"; }
    else mode = "focus";
  }

  function applyScrollCare(progress: number) {
    if (!options.scrollCare) return;
    const sampled = getScrollCareFrame(progress, reduced);
    gardenBasket = sampled.garden.basket; gardenPlants = sampled.garden.plants;
    tableChair = sampled.table.chair; tableSettings = sampled.table.settings;
    hallChairs = sampled.hall.chairs; hallFlowers = sampled.hall.flowers;
    if (!scrollCareStates || sampled.completed.some((value, index) => value !== scrollCareStates?.[index])) {
      scrollCareStates = sampled.completed; options.onScrollCare?.(sampled.completed);
    }
  }

  function activity() {
    host.dataset.courtyardVisible = String(opened && visible && !document.hidden);
    host.dataset.courtyardReduced = String(reduced);
    host.dataset.courtyardDragging = String(dragging);
  }
  function write() {
    const harvest = getHarvestPlacement(journeyProgress ?? 0, reduced);
    setVariable("--harvest-placement", String(harvest.position));
    setVariable("--harvest-opacity", harvest.opacity.toFixed(5));
    setVariable("--harvest-transfer", (reduced ? (journeyProgress ?? 0) >= .385 ? 1 : 0 : getHarvestTransfer(journeyProgress ?? 0)).toFixed(5));
    if (viewportWidth && viewportHeight) {
      const layout = getCourtyardLayout(viewportWidth, viewportHeight);
      const zoomProgress = reduced && journeyProgress !== undefined ? journeyProgress >= .95 ? 1 : [.2, .55, .85][getJourneyDestination(journeyProgress)] : journeyProgress;
      const entry = depthEntryTravel === undefined ? undefined : getDepthEntryFrame(depthEntryTravel, reduced);
      const candidateZoomProgress = options.responseFocus && !reduced && zoomProgress !== undefined && zoomProgress > .9 ? .9 + Math.max(0, zoomProgress - .95) * 2 : zoomProgress;
      const authoredScale = candidateZoomProgress === undefined ? 1 : getJourneyZoom(candidateZoomProgress, viewportWidth < viewportHeight);
      // The centered incoming plate exactly covers the viewport, like the Three projection.
      const scale = entry && !entry.arrived ? (1 + (authoredScale * 1.16 - 1) * entry.garden) / 1.16 : authoredScale;
      const portrait = viewportWidth < viewportHeight;
      const panoramaProgress = overviewFraming ? 1 : journeyProgress === undefined ? 0 : Math.max(0, Math.min(1, (journeyProgress - .95) / .05));
      const panorama = options.responseFocus && portrait ? reduced ? Number(panoramaProgress >= .5) : panoramaProgress * panoramaProgress * (3 - 2 * panoramaProgress) : 0;
      const containWidth = Math.min(viewportWidth, viewportHeight * 2);
      const sceneWidth = layout.width * scale * (1 - panorama) + containWidth * panorama;
      const sceneHeight = sceneWidth / 2;
      range = Math.max(0, (sceneWidth - viewportWidth) / 2);
      setVariable("--scene-width", `${sceneWidth.toFixed(2)}px`);
      setVariable("--scene-height", `${sceneHeight.toFixed(2)}px`);
    }
    setVariable("--care-zoom", zoom.toFixed(5));
    setVariable("--table-chair", tableChair.toFixed(5));
    setVariable("--table-settings", tableSettings.toFixed(5));
    setVariable("--garden-basket", gardenBasket.toFixed(5));
    setVariable("--garden-plants", gardenPlants.toFixed(5));
    setVariable("--hall-chairs", hallChairs.toFixed(5));
    setVariable("--hall-flowers", hallFlowers.toFixed(5));
    const responseOffset = invitationAccepted && reported === 1 && viewportWidth < viewportHeight && !overviewFraming
      ? Math.min(100, viewportWidth * .28, range * .3) * Math.max(0, 1 - Math.abs(position) / .3)
      : 0;
    const sceneX = Math.max(-range, Math.min(range, position * range * .95 + responseOffset));
    const foregroundX = Math.max(-range, Math.min(range, position * range * (reduced ? .95 : .98) + responseOffset));
    setVariable("--scene-x", `${sceneX.toFixed(2)}px`);
    setVariable("--scene-y", "0px");
    setVariable("--fore-x", `${foregroundX.toFixed(2)}px`);
    setVariable("--fore-y", "0px");
  }
  function reportDestination() {
    let closest: CourtyardDestination = 0;
    for (const index of [1, 2] as const) if (Math.abs(position - destinations[index]) < Math.abs(position - destinations[closest])) closest = index;
    if (closest !== reported) {
      reported = closest;
      if (options.onDestination) { echoDestination = closest; options.onDestination(closest); }
    }
  }
  function cancelPointer() {
    const captured = pointerId;
    pointerId = null; dragging = false; host.dataset.courtyardDragging = "false";
    host.style.userSelect = previousUserSelect;
    if (captured !== null && host.hasPointerCapture(captured)) host.releasePointerCapture(captured);
  }
  function stop() {
    cancelReturn(); cancelCare(); cancelPointer(); cancelAnimationFrame(frame); frame = 0;
    velocity = 0; mode = "idle"; lastTime = 0; target = position; echoDestination = null;
  }
  function draw(time: number) {
    frame = 0;
    if (disposed || !opened || !visible || document.hidden) return;
    const dt = lastTime ? Math.min(.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    if (returning) {
      const active = returning;
      if (active.start === null) active.start = time;
      const progress = Math.max(0, Math.min(1, (time - active.start) / active.duration));
      const eased = progress * progress * (3 - 2 * progress);
      setPrimaryProgress(active.destination, active.from * (1 - eased));
      if (active.secondaryFrom !== undefined) setSecondaryProgress(active.destination, active.secondaryFrom * (1 - eased));
      if (progress === 1) { returning = null; if (active.onComplete) restoreResponseFraming(); active.onComplete?.(); if (disposed) return; }
    } else if (care) {
      const active = care;
      if (active.start === null) active.start = time;
      const elapsed = time - active.start;
      const state = getTableActionFrame(elapsed);
      if (active.destination === 0) {
        const garden = getGardenActionFrame(elapsed); gardenBasket = (active.basketFrom ?? 0) + (1 - (active.basketFrom ?? 0)) * garden.basket; gardenPlants = garden.plants;
      } else if (active.destination === 1) { tableChair = (active.chairFrom ?? 0) + (1 - (active.chairFrom ?? 0)) * state.chair; tableSettings = state.settings; }
      else { const hall = getHallActionFrame(elapsed); hallChairs = hall.chairs; hallFlowers = (active.hallFrom ?? 0) + (1 - (active.hallFrom ?? 0)) * hall.flowers; }
      if (active.cameraOwned !== false) {
        position = active.from + (active.to - active.from) * state.approach;
        zoom = state.zoom;
      }
      if (state.reveal && !active.revealed) {
        active.revealed = true; active.onReveal();
        if (disposed) return;
      }
      if (care === active && state.complete) { care = null; if (active.cameraOwned !== false) focusResponse(active.destination); active.onComplete(); if (disposed) return; }
    } else if (mode === "focus") {
      zoom += (targetZoom - zoom) * (reduced ? 1 : 1 - Math.exp(-7 * dt));
      if (Math.abs(targetZoom - zoom) < .00003) zoom = targetZoom;
      position += (target - position) * (reduced ? 1 : 1 - Math.exp(-7 * dt));
      if (Math.abs(target - position) < .0003 && zoom === targetZoom) { position = target; mode = "idle"; }
    } else if (mode === "coast") {
      const next = position + velocity * dt;
      position = clamp(next);
      velocity *= Math.exp(-5.4 * dt);
      if (position !== next || Math.abs(velocity) < .012) { velocity = 0; mode = "idle"; }
    }
    write();
    if (returning || care || mode === "focus" || mode === "coast") wake();
    else if (mode === "idle") reportDestination();
  }
  function wake() {
    if (!frame && !disposed && opened && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function resize() {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height || disposed) return;
    cancelPointer(); if (mode === "drag") mode = "idle";
    viewportWidth = bounds.width;
    viewportHeight = bounds.height;
    setVariable("--scene-scale", "1");
    write(); wake();
  }
  function down(event: PointerEvent) {
    if (!opened || !visible || disposed || !event.isPrimary || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button,a,input,select,textarea,[role=button],[contenteditable=true],.threshold-portal")) return;
    stop(); pointerId = event.pointerId;
    startX = lastX = event.clientX; startY = event.clientY;
    startPosition = position; lastPointerTime = event.timeStamp;
  }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging) {
      if (Math.abs(dy) >= 8 && Math.abs(dy) >= Math.abs(dx) / 1.25) { cancelPointer(); return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
      dragging = true; host.dataset.courtyardDragging = "true"; mode = "drag"; host.setPointerCapture(event.pointerId); host.style.userSelect = "none";
    }
    if (event.cancelable) event.preventDefault();
    const elapsed = Math.max(8, Math.min(80, event.timeStamp - lastPointerTime));
    const sampledVelocity = ((event.clientX - lastX) / (Math.max(1, range) * .95)) / (elapsed / 1000);
    velocity = velocity * .45 + sampledVelocity * .55;
    position = clamp(startPosition + dx / (Math.max(1, range) * .95));
    lastX = event.clientX; lastPointerTime = event.timeStamp;
    wake();
  }
  function up(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    const wasDragging = dragging;
    cancelPointer();
    if (!wasDragging) return;
    if (event.timeStamp - lastPointerTime > 100) velocity = 0;
    mode = reduced || Math.abs(velocity) < .012 ? "idle" : "coast";
    lastTime = 0; wake();
  }
  function cancel(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    const wasDragging = dragging;
    stop();
    if (wasDragging) {
      target = destinations[reported];
      if (reduced || !opened || !visible || document.hidden) position = target;
      else { mode = "focus"; wake(); }
    }
    write();
  }
  function visibility() { activity(); if (document.hidden) { finishCare(); stop(); } else { lastTime = 0; write(); wake(); } }
  function motion() {
    reduced = media.matches; activity(); stop();
    if (disposed) return;
    if (journeyProgress !== undefined) {
      reported = getJourneyDestination(journeyProgress);
      const entry = depthEntryTravel === undefined ? undefined : getDepthEntryFrame(depthEntryTravel, reduced);
      position = target = entry && !entry.arrived ? destinations[0] * entry.garden : reduced ? journeyProgress >= .95 ? 0 : destinations[reported] : journeyPosition(journeyProgress);
    }
    write();
  }
  const observer = new ResizeObserver(resize); observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; activity(); if (!visible) { finishCare(); stop(); } else { lastTime = 0; write(); wake(); } });
  intersection.observe(host);
  host.addEventListener("pointerdown", down);
  host.addEventListener("pointermove", move, { passive: false });
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", cancel);
  host.addEventListener("lostpointercapture", cancel);
  document.addEventListener("visibilitychange", visibility);
  media.addEventListener("change", motion);
  activity(); resize();

  function completeCare(destination: CourtyardDestination, onReveal: () => void, onComplete: () => void) {
      scrollCareStates = undefined;
      if (destination !== 0 && destination !== 1 && destination !== 2) { onComplete(); return () => {}; }
      const firstFrom = destination === 0 ? gardenBasket : destination === 1 ? tableChair : hallFlowers;
      const currentPosition = position;
      stop();
      if (disposed) return () => {};
      reported = destination;
      if (destination === 0) { gardenBasket = firstFrom; gardenPlants = 0; }
      else if (destination === 1) { tableChair = firstFrom; tableSettings = 0; }
      else { hallFlowers = firstFrom; hallChairs = 0; }
      position = target = currentPosition;
      if (reduced) { settleObjects(destination, 1); focusResponse(destination); write(); onReveal(); if (!disposed) onComplete(); return () => {}; }
      if (!opened || !visible || document.hidden) { settleObjects(destination, 1); write(); onReveal(); if (!disposed) onComplete(); return () => {}; }
      const active = { destination, start: null, from: position, to: position, revealed: false, chairFrom: destination === 1 ? firstFrom : undefined, basketFrom: destination === 0 ? firstFrom : undefined, hallFrom: destination === 2 ? firstFrom : undefined, onReveal, onComplete };
      care = active; mode = "idle"; write(); wake();
      return () => { if (care === active) { cancelCare(); if (!disposed) write(); } };
    }
  function scrubCare(destination: CourtyardDestination, value: number) {
      scrollCareStates = undefined;
      if (destination !== 0 && destination !== 1 && destination !== 2) return;
      if (disposed) return;
      // Freeze the currently visible camera while the visitor places the object.
      const currentPosition = position;
      const currentZoom = zoom;
      cancelReturn(); cancelCare();
      if (disposed) return;
      cancelPointer(); cancelAnimationFrame(frame); frame = 0;
      position = target = currentPosition; zoom = targetZoom = currentZoom;
      velocity = 0; mode = "idle"; lastTime = 0;
      const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
      if (destination === 0) { gardenBasket = progress; gardenPlants = 0; }
      else if (destination === 1) { tableChair = progress; tableSettings = 0; }
      else { hallFlowers = progress; hallChairs = 0; }
      write();
    }

  return {
    setInvitationAccepted(value: boolean) {
      if (disposed || invitationAccepted === value) return;
      invitationAccepted = value;
      write();
    },
    setOpen(value: boolean) { if (disposed) return; opened = value; activity(); if (!value) stop(); else { lastTime = 0; write(); wake(); } },
    setDepthEntry(travel: number) {
      if (disposed) return;
      depthEntryTravel = travel;
      const entry = getDepthEntryFrame(travel, reduced);
      if (!entry.arrived) { position = target = destinations[0] * entry.garden; write(); }
    },
    setJourneyProgress(value: number) {
      if (disposed) return;
      const next = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      if (next === journeyProgress) return;
      journeyProgress = next; overviewFraming = false;
      // Scroll takes the camera, while a revealed care sequence can finish its object motion.
      if (care?.revealed && !options.scrollCare) {
        care.cameraOwned = false;
        cancelReturn(); cancelPointer(); velocity = 0; mode = "idle"; echoDestination = null;
      } else stop();
      if (disposed) return;
      zoom = targetZoom = 0;
      reported = getJourneyDestination(next);
      const entry = depthEntryTravel === undefined ? undefined : getDepthEntryFrame(depthEntryTravel, reduced);
      position = target = entry && !entry.arrived ? destinations[0] * entry.garden : reduced ? next >= .95 ? 0 : destinations[reported] : journeyPosition(next);
      applyScrollCare(next);
      if (!disposed) write();
    },
    setDestination(value: CourtyardDestination) {
      overviewFraming = false;
      if (disposed || (value !== 0 && value !== 1 && value !== 2)) return;
      // A React state echo must not turn a free pan into a second focus animation.
      if (echoDestination === value) { echoDestination = null; return; }
      if (care && value === reported) return;
      cancelReturn();
      if (disposed) return;
      cancelCare();
      if (disposed) return;
      zoom = targetZoom = 0;
      echoDestination = null; reported = value;
      cancelPointer(); velocity = 0; target = destinations[value]; lastTime = 0;
      if (reduced || !opened) { position = target; mode = "idle"; write(); }
      else { mode = "focus"; wake(); }
    },
    playCare(value: CourtyardDestination, onReveal: () => void, onComplete: () => void) {
      scrollCareStates = undefined;
      stop();
      if (disposed) return () => {};
      if (value !== 0 && value !== 1 && value !== 2) { onComplete(); return () => {}; }
      reported = value;
      if (reduced) { position = destinations[value]; settleObjects(value, 1); focusResponse(value); write(); onReveal(); if (!disposed) onComplete(); return () => {}; }
      if (!opened || !visible || document.hidden) { settleObjects(value, 1); write(); onReveal(); if (!disposed) onComplete(); return () => {}; }
      settleObjects(value, 0); write();
      const active = { destination: value, start: null, from: position, to: destinations[value], revealed: false, onReveal, onComplete };
      care = active; mode = "idle"; wake();
      return () => { if (care === active) { cancelCare(); if (!disposed) write(); } };
    },
    completeCare,
    scrubCare,
    completeTable(onReveal: () => void, onComplete: () => void) { return completeCare(1, onReveal, onComplete); },
    scrubTable(value: number) { scrubCare(1, value); },
    returnCare(value: CourtyardDestination) {
      if (disposed || (value !== 0 && value !== 1 && value !== 2)) return;
      const from = primaryProgress(value);
      const currentPosition = position;
      const currentZoom = zoom;
      stop();
      if (disposed) return;
      position = target = currentPosition; zoom = targetZoom = currentZoom;
      settleObjects(value, 0); setPrimaryProgress(value, from);
      if (reduced || !opened || !visible || document.hidden || from === 0) { setPrimaryProgress(value, 0); write(); return; }
      returning = { destination: value, start: null, from, duration: 250 }; write(); wake();
    },
    clearCare(value: CourtyardDestination, onComplete: () => void) {
      scrollCareStates = undefined;
      if (disposed) return () => {};
      if (value !== 0 && value !== 1 && value !== 2) { onComplete(); return () => {}; }
      stop();
      if (disposed) return () => {};
      const from = primaryProgress(value);
      const secondaryFrom = secondaryProgress(value);
      if (reduced || !opened || !visible || document.hidden) { settleObjects(value, 0); restoreResponseFraming(); write(); onComplete(); return () => {}; }
      const active = { destination: value, start: null, from, secondaryFrom, duration: 450, onComplete };
      returning = active; write(); wake();
      return () => { if (returning === active) cancelReturn(); };
    },
    resetCare(value: CourtyardDestination) {
      scrollCareStates = undefined;
      if (disposed || (value !== 0 && value !== 1 && value !== 2)) return;
      if (returning?.destination === value) cancelReturn();
      if (care?.destination === value) cancelCare();
      if (disposed) return;
      settleObjects(value, 0); restoreResponseFraming(); write(); wake();
    },
    showOverview() {
      if (disposed) return;
      overviewFraming = true;
      stop(); target = 0; targetZoom = 0;
      if (reduced || !opened) { position = target; zoom = targetZoom; write(); }
      else { mode = "focus"; wake(); }
    },
    dispose() {
      if (disposed) return; disposed = true; stop();
      observer.disconnect(); intersection.disconnect();
      host.removeEventListener("pointerdown", down); host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up); host.removeEventListener("pointercancel", cancel); host.removeEventListener("lostpointercapture", cancel);
      document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", motion);
      host.style.touchAction = previousTouchAction; host.style.userSelect = previousUserSelect;
      if (previousVisible === null) host.removeAttribute("data-courtyard-visible"); else host.setAttribute("data-courtyard-visible", previousVisible);
      if (previousReduced === null) host.removeAttribute("data-courtyard-reduced"); else host.setAttribute("data-courtyard-reduced", previousReduced);
      if (previousDragging === null) host.removeAttribute("data-courtyard-dragging"); else host.setAttribute("data-courtyard-dragging", previousDragging);
      for (const [name, value] of previousVariables) { if (value) host.style.setProperty(name, value); else host.style.removeProperty(name); }
    },
  };
}
