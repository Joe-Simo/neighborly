import * as T from "three";

export type PaperWorldScene = 0 | 1 | 2;
export type PaperWorldOptions = {
  onError?: (error: unknown) => void;
  onReady?: () => void;
  reducedMotion?: boolean;
};

/** A developable cylindrical fold preserves distances along the paper surface. */
export function getPaperFoldPoint(u: number, v: number, width: number, height: number, start: number, angle: number, elevation: number) {
  const flatX = (u - .5) * width;
  const distance = Math.max(0, u - start) * width;
  if (!distance) return { x: flatX, y: (v - .5) * height, z: elevation, nx: 0, nz: 1 };
  const radius = (1 - start) * width / Math.max(.01, angle);
  const theta = distance / radius;
  return {
    x: distance ? (start - .5) * width + radius * Math.sin(theta) : flatX,
    y: (v - .5) * height,
    z: elevation + radius * (1 - Math.cos(theta)),
    nx: -Math.sin(theta), nz: Math.cos(theta),
  };
}

export function createPaperWorldController(host: HTMLElement, options: PaperWorldOptions = {}) {
  let renderer: T.WebGLRenderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" }); }
  catch (error: unknown) { options.onError?.(error); throw error; }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor("#efe7d7", 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.touchAction = "pan-y";
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color("#efe7d7");
  const camera = new T.OrthographicCamera(-5, 5, 3, -3, .1, 50);
  camera.position.z = 12;
  const sheetGeometry = new T.PlaneGeometry(1, 1, 112, 64);
  for (const name of ["position", "normal"]) {
    const attribute = sheetGeometry.getAttribute(name);
    if (attribute instanceof T.BufferAttribute) attribute.setUsage(T.DynamicDrawUsage);
  }
  const frontMaterial = new T.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, side: T.FrontSide });
  const backMaterial = new T.MeshStandardMaterial({ color: "#d6c6a7", roughness: .98, metalness: 0, side: T.BackSide });
  const sheet = new T.Group();
  for (const material of [frontMaterial, backMaterial]) {
    const surface = new T.Mesh(sheetGeometry, material);
    surface.castShadow = true; surface.receiveShadow = true;
    // Bounds are recalculated after bending; no flat-plane culling at the turned edge.
    surface.frustumCulled = false;
    sheet.add(surface);
  }
  scene.add(sheet);
  const groundGeometry = new T.PlaneGeometry(40, 40);
  const groundMaterial = new T.MeshStandardMaterial({ color: "#eee5d4", roughness: 1 });
  const ground = new T.Mesh(groundGeometry, groundMaterial);
  ground.position.z = -.09; ground.receiveShadow = true; scene.add(ground);
  scene.add(new T.HemisphereLight("#fffaf2", "#c8bdab", 1));
  const light = new T.DirectionalLight("#fff8ec", 1.3);
  light.position.set(-3, 4, 9); light.target.position.set(.8, 0, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = -9; light.shadow.camera.right = 9;
  light.shadow.camera.top = 7; light.shadow.camera.bottom = -7;
  light.shadow.camera.near = .1; light.shadow.camera.far = 30;
  light.shadow.bias = -.0003; light.shadow.normalBias = .008; light.shadow.radius = 4;
  scene.add(light, light.target);

  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let motionOverride = options.reducedMotion;
  let reduced = motionOverride ?? media.matches;
  let disposed = false;
  let visible = true;
  let lost = false;
  let ready = false;
  let frame = 0;
  let last = 0;
  let width = 10;
  let height = 6;
  let selected: PaperWorldScene = 0;
  let scenePosition = 0;
  let progress = 0;
  let targetProgress = 0;
  const pointer = new T.Vector2();
  const pointerTarget = new T.Vector2();
  const gaze = new T.Vector3();
  let texture: T.Texture | undefined;
  let textureReady = false;
  let pulseStart: number | null = null;
  let pulseAmount = 0;

  function textureFraming() {
    if (!texture) return;
    const ratio = 1672 / 941;
    const aspect = width / height;
    // Cover without stretching the painted brushwork; favor the curled right side on phones.
    const repeatX = Math.min(1, aspect / ratio);
    const repeatY = Math.min(1, ratio / aspect);
    texture.repeat.set(repeatX, repeatY);
    texture.offset.set((1 - repeatX) * .68, (1 - repeatY) * .5);
  }
  function bend() {
    const starts = [.90, .84, .78] as const;
    const angles = [1.65, 1.9, 2.15] as const;
    const from = Math.min(1, Math.floor(scenePosition));
    const blend = scenePosition - from;
    const start = T.MathUtils.lerp(starts[from], starts[from + 1], blend);
    const angle = T.MathUtils.lerp(angles[from], angles[from + 1], blend) + (reduced ? 0 : pointer.y * .065) + pulseAmount * .65;
    const elevation = .035 + progress * .13 + pulseAmount * .28;
    const position = sheetGeometry.getAttribute("position");
    const uv = sheetGeometry.getAttribute("uv");
    for (let index = 0; index < position.count; index++) {
      const v = uv.getY(index);
      const corner = Math.pow(1 - v, 1.15);
      const rowStart = T.MathUtils.lerp(1.04, start, corner) - .1 * pulseAmount * corner;
      const rowAngle = Math.min(3, angle * (.55 + .45 * corner));
      const point = getPaperFoldPoint(uv.getX(index), v, width * 1.14, height * 1.12, rowStart, rowAngle, elevation);
      position.setXYZ(index, point.x, point.y, point.z);
    }
    position.needsUpdate = true;
    sheetGeometry.computeVertexNormals();
    sheetGeometry.computeBoundingSphere();
  }
  function draw(time: number) {
    frame = 0;
    if (disposed || lost || !visible || document.hidden || !textureReady) return;
    const dt = last ? Math.min(.05, (time - last) / 1000) : 1 / 60; last = time;
    if (pulseStart !== null) {
      const phase = Math.min(1, (time - pulseStart) / 2300);
      pulseAmount = Math.sin(Math.PI * phase);
      if (phase === 1) { pulseStart = null; pulseAmount = 0; }
    }
    const ease = reduced ? 1 : 1 - Math.exp(-7 * dt);
    scenePosition = T.MathUtils.lerp(scenePosition, selected, ease);
    progress = T.MathUtils.lerp(progress, targetProgress, ease);
    pointer.lerp(pointerTarget, ease);
    if (Math.abs(scenePosition - selected) < .0001) scenePosition = selected;
    if (Math.abs(progress - targetProgress) < .0001) progress = targetProgress;
    if (pointer.distanceToSquared(pointerTarget) < .000001) pointer.copy(pointerTarget);
    bend();
    camera.position.set(reduced ? 0 : pointer.x * .065, reduced ? 0 : pointer.y * .045 + pulseAmount * .15, 12);
    gaze.set(0, 0, .1); camera.lookAt(gaze);
    light.position.x = -3 + (reduced ? 0 : pointer.x * .55);
    light.position.y = 4 + (reduced ? 0 : pointer.y * .3);
    renderer.render(scene, camera);
    if (!ready) { ready = true; options.onReady?.(); }
    if (pulseStart !== null || scenePosition !== selected || progress !== targetProgress || !pointer.equals(pointerTarget)) wake();
  }
  function wake() { if (!frame && !disposed && !lost && visible && !document.hidden && textureReady) frame = requestAnimationFrame(draw); }
  function resize() {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height || disposed) return;
    height = 6; width = height * bounds.width / bounds.height;
    camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, bounds.width <= 700 ? 1.25 : 1.5, Math.sqrt(4_000_000 / (bounds.width * bounds.height))));
    renderer.setSize(bounds.width, bounds.height, false);
    textureFraming(); wake();
  }
  function cancelPulse() { pulseStart = null; pulseAmount = 0; }
  function visibility() { last = 0; if (document.hidden) cancelPulse(); wake(); }
  function motion() { reduced = motionOverride ?? media.matches; if (reduced) { cancelPulse(); pointer.set(0, 0); pointerTarget.set(0, 0); } wake(); }
  function contextLost(event: Event) {
    event.preventDefault(); lost = true; cancelPulse(); cancelAnimationFrame(frame); frame = 0;
    options.onError?.(new Error("The paper-world renderer lost its context."));
  }
  function contextRestored() { lost = false; last = 0; resize(); }
  const observer = new ResizeObserver(resize); observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; if (visible) wake(); else cancelPulse(); }); intersection.observe(host);
  document.addEventListener("visibilitychange", visibility); media.addEventListener("change", motion);
  renderer.domElement.addEventListener("webglcontextlost", contextLost); renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
  resize();
  new T.TextureLoader().load("/assets/paper-world/continuation.webp", loaded => {
    if (disposed) { loaded.dispose(); return; }
    texture = loaded; texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    frontMaterial.map = texture;
    frontMaterial.needsUpdate = true; textureReady = true;
    textureFraming(); wake();
  }, undefined, error => { if (!disposed) options.onError?.(error); });

  return {
    setScene(value: PaperWorldScene) { if (value === 0 || value === 1 || value === 2) { selected = value; wake(); } },
    setProgress(value: number) { targetProgress = T.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1); wake(); },
    setPointer(x: number, y: number) {
      if (reduced) return;
      pointerTarget.set(T.MathUtils.clamp(Number.isFinite(x) ? x : 0, -1, 1), T.MathUtils.clamp(Number.isFinite(y) ? y : 0, -1, 1)); wake();
    },
    releasePointer() { pointerTarget.set(0, 0); wake(); },
    setReducedMotion(value: boolean) { motionOverride = value; motion(); },
    pulse() { if (disposed || reduced || !visible || document.hidden || pulseStart !== null) return; pulseStart = performance.now(); wake(); },
    dispose() {
      if (disposed) return; disposed = true; cancelPulse(); cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", motion);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost); renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      sheetGeometry.dispose(); groundGeometry.dispose(); frontMaterial.dispose(); backMaterial.dispose(); groundMaterial.dispose(); texture?.dispose();
      light.shadow.map?.dispose(); scene.clear(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
