import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

export type SharedWindowSelection = 0 | 1 | 2;
export type SharedWindowOptions = {
  onError?: (error: unknown) => void;
  reducedMotion?: boolean;
};

/** A closed arch has vertical jambs and a true semicircular crown. */
export function createSharedWindowArch(width: number, height: number, inset = 0) {
  const radius = width / 2 - inset;
  const spring = height - width / 2;
  const shape = new T.Shape();
  shape.moveTo(-radius, inset);
  shape.lineTo(radius, inset);
  shape.lineTo(radius, spring);
  shape.absarc(0, spring, radius, 0, Math.PI, false);
  shape.lineTo(-radius, inset);
  shape.closePath();
  return shape;
}

/** Fit the entire triptych, including an open leaf, without stretching its geometry. */
export function getSharedWindowCameraDistance(aspect: number) {
  const vertical = T.MathUtils.degToRad(34) / 2;
  return Math.max(4.9, 2.05 / (Math.tan(vertical) * Math.max(.25, aspect)));
}

export function createSharedWindowController(host: HTMLElement, options: SharedWindowOptions = {}) {
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch (error: unknown) { options.onError?.(error); throw error; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.touchAction = "pan-y";
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, .1, 60);
  const target = new T.Vector3(0, 1.28, 0);
  const geometry = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const ownGeometry = <G extends T.BufferGeometry>(value: G) => { geometry.add(value); return value; };
  const ownMaterial = <M extends T.Material>(value: M) => { materials.add(value); return value; };
  const environment = new RoomEnvironment();
  const generator = new T.PMREMGenerator(renderer);
  const reflection = generator.fromScene(environment, .06);
  environment.dispose(); generator.dispose();
  scene.environment = reflection.texture;
  scene.environmentIntensity = .9;
  RectAreaLightUniformsLib.init();

  const bronze = ownMaterial(new T.MeshStandardMaterial({ color: "#71664e", metalness: .88, roughness: .27 }));
  const darkBronze = ownMaterial(new T.MeshStandardMaterial({ color: "#443f32", metalness: .72, roughness: .42 }));
  const stone = ownMaterial(new T.MeshStandardMaterial({ color: "#d6cebb", roughness: .8, metalness: 0 }));
  const plinth = new T.Mesh(ownGeometry(new RoundedBoxGeometry(4.04, .14, 1.85, 4, .055)), stone);
  plinth.position.set(0, -.1, .3); plinth.receiveShadow = true; scene.add(plinth);
  const shadow = new T.Mesh(ownGeometry(new T.PlaneGeometry(8, 6)), ownMaterial(new T.ShadowMaterial({ opacity: .16 })));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.175; shadow.receiveShadow = true; scene.add(shadow);

  const sun = new T.DirectionalLight("#fff1ce", 3.1);
  sun.position.set(-3, 5, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = .025;
  sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -3;
  scene.add(sun, sun.target, new T.HemisphereLight("#ecf1df", "#344937", .75));
  const ribbon = new T.RectAreaLight("#fff5dc", 4, 5, .6);
  ribbon.position.set(-1, 4, 2); ribbon.lookAt(0, 1.5, 0); scene.add(ribbon);

  const width = .98;
  const height = 2.8;
  const panelCenters = [-1.19, 0, 1.19] as const;
  const pigment = ["#91a08a", "#c5aa77", "#aaa0b8"] as const;
  const frameShape = createSharedWindowArch(width + .08, height + .04);
  frameShape.holes.push(new T.Path(createSharedWindowArch(width, height, .013).getPoints(56)));
  const frameGeometry = ownGeometry(new T.ExtrudeGeometry(frameShape, { depth: .06, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, steps: 1, curveSegments: 48 }));
  const glassGeometry = ownGeometry(new T.ExtrudeGeometry(createSharedWindowArch(width, height, .025), { depth: .037, bevelEnabled: true, bevelThickness: .008, bevelSize: .007, bevelSegments: 3, steps: 1, curveSegments: 48 }));
  const edgeShape = createSharedWindowArch(width, height, .007);
  edgeShape.holes.push(new T.Path(createSharedWindowArch(width, height, .029).getPoints(56)));
  const edgeGeometry = ownGeometry(new T.ExtrudeGeometry(edgeShape, { depth: .045, bevelEnabled: true, bevelThickness: .006, bevelSize: .005, bevelSegments: 2, curveSegments: 48 }));
  const panes = panelCenters.map((x, index) => {
    const fixed = new T.Mesh(frameGeometry, darkBronze);
    fixed.position.set(x, 0, -.26); fixed.castShadow = true; scene.add(fixed);
    const hinge = new T.Group(); hinge.position.set(x - width / 2, 0, -.19); scene.add(hinge);
    const glass = new T.Mesh(glassGeometry, ownMaterial(new T.MeshPhysicalMaterial({
      color: pigment[index], roughness: .12, metalness: 0, transmission: .91,
      thickness: .2, ior: 1.46, attenuationColor: pigment[index], attenuationDistance: 2.5,
      clearcoat: 1, clearcoatRoughness: .11, envMapIntensity: 1.2,
    })));
    glass.position.x = width / 2;
    const edge = new T.Mesh(edgeGeometry, bronze); edge.position.copy(glass.position); edge.castShadow = true;
    hinge.add(glass, edge);
    for (const y of [.3, 1.85]) {
      const pin = new T.Mesh(ownGeometry(new T.CylinderGeometry(.026, .026, .12, 12)), bronze);
      pin.position.set(0, y, .017); hinge.add(pin);
    }
    const latch = new T.Mesh(ownGeometry(new RoundedBoxGeometry(.024, .16, .036, 2, .008)), bronze);
    latch.position.set(width - .065, 1.1, .072); hinge.add(latch);
    // Filtered light is a local emitter aimed at the cream sill, not a glowing plane.
    const transmitted = new T.RectAreaLight(pigment[index], 1.35, .78, 2.2);
    transmitted.position.set(x, 1.35, -.1); transmitted.lookAt(x + .3, -.03, .95); scene.add(transmitted);
    return { hinge, transmitted, x };
  });

  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let motionOverride = options.reducedMotion;
  let reduce = motionOverride ?? media.matches;
  let selected: SharedWindowSelection | null = null;
  let disposed = false;
  let visible = true;
  let lost = false;
  let frame = 0;
  let last = 0;
  let distance = 6;
  const pointer = new T.Vector2();
  const pointerTarget = new T.Vector2();
  const lightTarget = new T.Vector3();

  function draw(time: number) {
    frame = 0;
    if (disposed || lost || !visible || document.hidden) return;
    const dt = last ? Math.min(.05, (time - last) / 1000) : 1 / 60; last = time;
    pointer.lerp(pointerTarget, reduce ? 1 : 1 - Math.exp(-8 * dt));
    if (pointer.distanceToSquared(pointerTarget) < .000001) pointer.copy(pointerTarget);
    let moving = !pointer.equals(pointerTarget);
    panes.forEach((pane, index) => {
      const angle = selected === index ? -.72 : 0;
      pane.hinge.rotation.y = reduce ? angle : T.MathUtils.damp(pane.hinge.rotation.y, angle, 7, dt);
      if (Math.abs(pane.hinge.rotation.y - angle) < .0002) pane.hinge.rotation.y = angle;
      else moving = true;
      pane.transmitted.intensity = 1.35 + .8 * Math.abs(pane.hinge.rotation.y) / .72;
      lightTarget.set(pane.x + .3 + pointer.x * .12, -.03, .95);
      pane.transmitted.lookAt(lightTarget);
    });
    camera.position.set(.85 + (reduce ? 0 : pointer.x * .18), 2.35 + (reduce ? 0 : pointer.y * .09), distance);
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (moving) wake();
  }
  function wake() { if (!frame && !disposed && visible && !lost && !document.hidden) frame = requestAnimationFrame(draw); }
  function resize() {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height || disposed) return;
    camera.aspect = bounds.width / bounds.height;
    distance = getSharedWindowCameraDistance(camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, bounds.width < 600 ? 1.25 : 1.5));
    renderer.setSize(bounds.width, bounds.height, false); wake();
  }
  function move(event: PointerEvent) {
    if (reduce || !event.isPrimary || event.pointerType === "touch") return;
    const bounds = host.getBoundingClientRect();
    pointerTarget.set(T.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1), T.MathUtils.clamp(1 - (event.clientY - bounds.top) / bounds.height * 2, -1, 1)); wake();
  }
  function leave() { pointerTarget.set(0, 0); wake(); }
  function visibility() { last = 0; wake(); }
  function motion() { reduce = motionOverride ?? media.matches; if (reduce) { pointer.set(0, 0); pointerTarget.set(0, 0); } wake(); }
  function contextLost(event: Event) { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; options.onError?.(new Error("The shared-window renderer lost its context.")); }
  function contextRestored() { lost = false; last = 0; resize(); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; if (visible) wake(); }); intersection.observe(host);
  host.addEventListener("pointermove", move, { passive: true }); host.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", visibility); media.addEventListener("change", motion);
  renderer.domElement.addEventListener("webglcontextlost", contextLost); renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
  resize();

  return {
    setSelected(index: SharedWindowSelection) { if (disposed || (index !== 0 && index !== 1 && index !== 2)) return; selected = index; wake(); },
    setReducedMotion(value: boolean) { motionOverride = value; motion(); },
    dispose() {
      if (disposed) return; disposed = true; cancelAnimationFrame(frame);
      resizeObserver.disconnect(); intersection.disconnect();
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", motion);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost); renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
      reflection.dispose(); sun.shadow.map?.dispose(); renderer.dispose(); renderer.domElement.remove(); scene.clear();
    },
  };
}
