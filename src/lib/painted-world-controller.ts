import * as T from "three";
import { createReliefPlayback, type ReliefOutcome } from "./relief-playback";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { getPaintedArtworkFrame, getPaintedImagePoint, getPaintedOpeningFraming, isPaintedPortrait } from "./painted-world-framing";
import { loadForCurrentRevision, loadResourceBatch } from "./painted-world-loading";
import { getPaintedTransitionInteraction, getPaintedSceneCut } from "./painted-world-transition";
import { getPaintedScrollState, type PaintedScrollState } from "./painted-world-scroll";

export type PaintedScene = "opening" | "meal" | "visit" | "welcome" | "complete";
export type PaintedPhase = "idle" | "interacting" | "transitioning";
export type PaintedLayer = {
  src: string;
  /** Fractional screen placement, measured from the upper left. */
  x?: number;
  y?: number;
  /** Width as a fraction of the visible artwork. */
  width?: number;
  depth?: number;
  /** Full-canvas layers remain UV-registered to the covered background. */
  fit?: "artwork";
};
export type PaintedAnchors = {
  bowlStart?: readonly [number, number];
  bowlTarget?: readonly [number, number];
  doorCenter?: readonly [number, number];
  bowlScale?: number;
  doorScale?: number;
};
export type PaintedSceneDefinition = {
  src?: string;
  mobileSrc?: string;
  completedSrc?: string;
  mobileCompletedSrc?: string;
  layers?: readonly PaintedLayer[];
  mobileLayers?: readonly PaintedLayer[];
  showBowl?: boolean;
  anchors?: { desktop?: PaintedAnchors; mobile?: PaintedAnchors };
};
export type PaintedWorldOptions = {
  mode?: "interaction" | "scroll";
  openingOnly?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onSceneChange?: (scene: PaintedScene) => void;
  onPhaseChange?: (phase: PaintedPhase) => void;
  reducedMotion?: boolean;
  layers?: Partial<Record<PaintedScene, readonly PaintedLayer[]>>;
  scenes?: Partial<Record<PaintedScene, PaintedSceneDefinition>>;
};

export const paintedSequence: readonly PaintedScene[] = ["opening", "meal", "visit", "welcome", "complete"];
export const nextPaintedScene = (scene: PaintedScene): PaintedScene => paintedSequence[Math.min(paintedSequence.indexOf(scene) + 1, paintedSequence.length - 1)];
const clamp = (value: number) => T.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const imageScene = (scene: PaintedScene) => scene === "complete" ? "welcome" : scene;
const imagePath = (scene: PaintedScene, portrait: boolean) => scene === "opening"
  ? portrait ? "/assets/living-relief-narrow.webp" : "/assets/living-relief-poster.webp"
  : `/assets/painted-world/${imageScene(scene)}${portrait ? "-mobile" : ""}.webp`;

/** One renderer owns the continuous painted journey. No account state is read or changed. */
export function createPaintedWorldController(host: HTMLElement, options: PaintedWorldOptions = {}) {
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.touchAction = "pan-y";
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color("#efe8d9");
  const camera = new T.OrthographicCamera(-8, 8, 5, -5, 0.1, 80);
  camera.position.set(0, 0, 30);
  const materials = new Set<T.Material>();
  const geometries = new Set<T.BufferGeometry>();
  const ownGeometry = <G extends T.BufferGeometry>(value: G) => { geometries.add(value); return value; };
  const ownMaterial = <M extends T.Material>(value: M) => { materials.add(value); return value; };
  const pigment = (color: string) => ownMaterial(new T.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0, side: T.DoubleSide }));
  const ivory = pigment("#ece1c9");
  const darkSage = pigment("#465743");
  const gold = pigment("#bd9b51");
  const ink = pigment("#77715d");
  const hemisphere = new T.HemisphereLight("#ffffff", "#b3aaa3", 2);
  scene.add(hemisphere);
  const light = new T.DirectionalLight("#fff0d4", 2.2);
  light.position.set(-5, 8, 16);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = light.shadow.camera.bottom = -12;
  light.shadow.camera.right = light.shadow.camera.top = 12;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 50;
  light.shadow.normalBias = 0.02;
  scene.add(light);

  const planeGeometry = ownGeometry(new T.PlaneGeometry(1, 1));
  const sweepMaterial = ownMaterial(new T.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { left: { value: -.1 }, right: { value: -.1 }, pigment: { value: new T.Color("#e8deca") } },
    vertexShader: `varying vec2 paperUv; void main(){paperUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 paperUv;uniform float left;uniform float right;uniform vec3 pigment;
      void main(){float edge=paperUv.x+.025*sin(paperUv.y*5.)+.006*sin(paperUv.y*43.);
      if(edge<left||edge>right)discard;
      float grain=fract(sin(dot(floor(paperUv*1200.),vec2(12.9898,78.233)))*43758.5453);
      gl_FragColor=vec4(pigment*(.975+.025*grain),1.);
      #include <colorspace_fragment>
      }`,
  }));
  const sweep = new T.Mesh(planeGeometry, sweepMaterial);
  sweep.renderOrder = 10000; sweep.visible = false; sweep.position.z = 20; scene.add(sweep);
  function setSweep(progress: number, kind: PaintedScene) {
    const cut = getPaintedSceneCut(progress, reduce);
    sweep.visible = cut.coverVisible && kind !== "welcome" && kind !== "complete";
    sweepMaterial.uniforms.left.value = cut.left; sweepMaterial.uniforms.right.value = cut.right;
    sweepMaterial.uniforms.pigment.value.set(kind === "visit" ? "#78816a" : "#e8deca");
    sweep.scale.set(worldWidth, worldHeight, 1); sweep.position.x = camera.position.x; sweep.position.y = camera.position.y;
    return cut;
  }

  type Artwork = { group: T.Group; base: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>; completed?: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>; layers: Array<{ mesh: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>; definition: PaintedLayer }>; textures: T.Texture[]; portrait: boolean; src: string; contained: boolean; scene: PaintedScene };
  const artwork = new Map<PaintedScene, Artwork>();
  const pending = new Map<string, Promise<Artwork>>();
  const loader = new T.TextureLoader();
  let openingModel: T.Group | undefined;
  let openingLoaded = false;
  let openingGuide: T.Object3D | undefined;
  let openingAsset = "";
  let openingLoadRevision = 0;
  let openingMixer: T.AnimationMixer | undefined;
  let openingPlayback: ReturnType<typeof createReliefPlayback> | undefined;
  // True while the visitor's own hand is leading the card across.
  let handing = false;
  // The card's bone sits inside two holders, so the finished pass can lay it in the palm, turned to the hand, without touching its authored path.
  let cardSeat: T.Group | undefined;
  let cardLie: T.Group | undefined;
  let openingOutcome: ReliefOutcome = "rest";
  const openingRoot = new T.Group();
  scene.add(openingRoot);
  const openingGuidePosition = new T.Vector3();
  const seatShift = new T.Vector3();
  // Where the card comes to rest, measured from the end of its authored path: across, up, and its turn.
  const cardRest = [.8, .02, .2] as const;
  const openingGuideScale = new T.Vector3(1, 1, 1);
  const openingPickTargets: T.Object3D[] = [];
  const openingMaterials = new Map<T.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  function disposeOpening(model: T.Object3D) {
    model.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      const surfaces = Array.isArray(object.material) ? object.material : [object.material];
      for (const surface of surfaces) {
        for (const property of Object.values(surface)) if (property instanceof T.Texture) property.dispose();
        surface.dispose();
      }
    });
  }
  let current: PaintedScene = "opening";
  let phase: PaintedPhase = "idle";
  let disposed = false;
  let visible = true;
  let lost = false;
  let frame = 0;
  let lastTime = 0;
  let portrait = false;
  let worldHeight = 10;
  let worldWidth = 16;
  let interaction = 0;
  let interactionTarget = 0;
  let transitionTime = 0;
  let transitionInteractionStart = 0;
  let destination: PaintedScene | null = null;
  let transitionReady = false;
  let ready = false;
  let navigationEpoch = 0;
  const scrollMode = options.mode === "scroll";
  let scrollTarget = 0;
  const sampleScrollState = (value: number): PaintedScrollState => options.openingOnly
    ? { ...getPaintedScrollState(0), nextScene: null }
    : getPaintedScrollState(value);
  let scrollState: PaintedScrollState = sampleScrollState(0);
  let scrollEpoch = 0;
  let pendingScrollKey = "";
  let availableScrollKey = "";
  let reportedScrollScene: PaintedScene = "opening";
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = options.reducedMotion ?? media.matches;
  const pointer = new T.Vector2();
  const pointerTarget = new T.Vector2();
  const raycaster = new T.Raycaster();
  const dragPlane = new T.Plane(new T.Vector3(0, 0, 1), -3);
  const dragStart = new T.Vector3();
  const dragPoint = new T.Vector3();
  let pointerId: number | null = null;
  let down = new T.Vector2();
  let dragging = false;
  const props = new T.Group();
  scene.add(props);

  function mesh(geometry: T.BufferGeometry, surface: T.Material, parent: T.Object3D) {
    const value = new T.Mesh(geometry, surface);
    value.castShadow = true;
    value.receiveShadow = true;
    parent.add(value);
    return value;
  }
  const invitation = new T.Group();
  props.add(invitation);
  const sheetGeometry = ownGeometry(new T.PlaneGeometry(1.05, 0.76));
  for (const sign of [-1, 1]) {
    const wing = mesh(sheetGeometry, ivory, invitation);
    wing.position.x = sign * 0.49;
    wing.rotation.y = sign * 0.13;
  }
  const goldMark = mesh(ownGeometry(new T.PlaneGeometry(0.14, 0.14)), gold, invitation);
  goldMark.position.set(-0.5, 0.12, 0.025);
  for (let i = 0; i < 2; i++) {
    const line = mesh(ownGeometry(new T.PlaneGeometry(0.45 - i * 0.1, 0.035)), ink, invitation);
    line.position.set(-0.12, 0.12 - i * 0.12, 0.025);
  }
  const bowl = new T.Group();
  props.add(bowl);
  const bowlSurface = ownMaterial(new T.MeshBasicMaterial({ transparent: true, alphaTest: 0.005, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
  const bowlSprite = new T.Mesh(planeGeometry, bowlSurface);
  bowl.add(bowlSprite);
  bowl.visible = false;
  let bowlTexture: T.Texture | undefined;
  let bowlPromise: Promise<void> | undefined;
  function ensureBowl(): Promise<void> {
    if (bowlTexture) return Promise.resolve();
    if (bowlPromise) return bowlPromise;
    if (disposed) return Promise.reject(new Error("Painted scene was disposed."));
    bowlPromise = loadTexture("/assets/painted-world/bowl.webp").then((texture) => {
      if (disposed) { texture.dispose(); throw new Error("Painted scene was disposed."); }
      bowlTexture = texture;
      bowlSurface.map = texture;
      bowlSurface.needsUpdate = true;
      wake();
    }).finally(() => { bowlPromise = undefined; });
    return bowlPromise;
  }
  const bowlTarget = mesh(ownGeometry(new T.RingGeometry(0.65, 0.68, 64)), ownMaterial(new T.MeshBasicMaterial({ color: "#a28b61", transparent: true, opacity: 0.48, depthWrite: false, side: T.DoubleSide })), props);
  bowlTarget.rotation.x = 0.28;

  const doors = new T.Group();
  props.add(doors);
  const doorPivots: T.Group[] = [];
  const doorFaces: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>[] = [];
  const doorEdges: T.Mesh[] = [];
  const doorTextures: T.Texture[] = [];
  let doorLoaded = false;
  let doorPromise: Promise<void> | undefined;
  for (const side of [-1, 1]) {
    const pivot = new T.Group();
    doors.add(pivot);
    const edge = mesh(ownGeometry(new T.BoxGeometry(1, 1, 0.07)), darkSage, pivot);
    edge.position.x = -side * 1.25;
    const face = new T.Mesh(planeGeometry, ownMaterial(new T.MeshBasicMaterial({ transparent: true, alphaTest: 0.005, depthWrite: true, toneMapped: false, side: T.DoubleSide })));
    face.position.set(-side * 1.25, 0, 0.045);
    pivot.add(face);
    doorFaces.push(face);
    doorEdges.push(edge);
    doorPivots.push(pivot);
  }
  doors.visible = false;
  function ensureDoors(): Promise<void> {
    if (doorLoaded) return Promise.resolve();
    if (doorPromise) return doorPromise;
    if (disposed) return Promise.reject(new Error("Painted scene was disposed."));
    doorPromise = loadTexture("/assets/painted-world/door.webp").then((texture) => {
      if (disposed) { texture.dispose(); throw new Error("Painted scene was disposed."); }
      const mirrored = texture.clone();
      mirrored.wrapS = T.RepeatWrapping;
      mirrored.repeat.x = -1;
      mirrored.offset.x = 1;
      mirrored.needsUpdate = true;
      doorTextures.push(texture, mirrored);
      const image = texture.image as { width?: number; height?: number };
      const ratio = (image.width ?? 400) / (image.height ?? 1080);
      doorFaces.forEach((face, index) => {
        face.material.map = index === 0 ? mirrored : texture;
        face.material.needsUpdate = true;
        face.scale.set(2.5, 2.5 / ratio, 1);
        doorEdges[index].scale.set(2.5, 2.5 / ratio, 1);
      });
      doorLoaded = true;
      wake();
    }).finally(() => { doorPromise = undefined; });
    return doorPromise;
  }
  const shadow = mesh(planeGeometry, ownMaterial(new T.ShadowMaterial({ opacity: 0.16, transparent: true })), props);
  shadow.position.z = 0.15;
  shadow.scale.set(18, 18, 1);
  shadow.castShadow = false;

  function setPhase(value: PaintedPhase) {
    if (phase === value) return;
    phase = value;
    options.onPhaseChange?.(phase);
  }
  const screenPoint = (x: number, y: number, z = 3) => new T.Vector3((x - 0.5) * worldWidth, (0.5 - y) * worldHeight, z);
  const bowlFrom = new T.Vector3();
  const bowlTo = new T.Vector3();
  const imagePoint = (x: number, y: number, z = 3) => {
    const painting = artwork.get(current);
    if (!painting || current === "opening") return screenPoint(x, y, z);
    const point = getPaintedImagePoint(x, y, painting.base.scale.x, painting.base.scale.y, painting.base.position.x, painting.base.position.y);
    return new T.Vector3(point.x, point.y, z);
  };


  function fitArtwork(value: Artwork) {
    const source = value.base.material.map?.image as { width?: number; height?: number } | undefined;
    const ratio = (source?.width ?? (portrait ? 900 : 1600)) / (source?.height ?? (portrait ? 1600 : 1000));
    const openingFrame = getPaintedOpeningFraming(host.clientWidth, host.clientHeight, worldWidth, worldHeight, options.openingOnly);
    const fitted = getPaintedArtworkFrame(worldWidth, worldHeight, ratio);
    value.contained = value.scene !== "opening" && fitted.contained;
    const width = value.scene === "opening"
      ? openingFrame.sourceWidth * openingFrame.scale
      : fitted.width;
    value.base.scale.set(width, value.scene === "opening" ? openingFrame.sourceHeight * openingFrame.scale : width / ratio, 1);
    const portraitTabletOffset = portrait && host.clientWidth > 700 && value.scene !== "opening" && !value.contained ? -worldHeight * 0.045 : 0;
    value.base.position.y = value.scene === "opening" ? openingFrame.shiftY : portraitTabletOffset;
    value.completed?.scale.copy(value.base.scale);
    if (value.completed) value.completed.position.y = portraitTabletOffset;
    for (const layer of value.layers) {
      if (layer.definition.fit === "artwork") {
        layer.mesh.scale.copy(value.base.scale);
        layer.mesh.position.set(0, portraitTabletOffset, layer.definition.depth ?? 0.5);
        continue;
      }
      const image = layer.mesh.material.map?.image as { width?: number; height?: number } | undefined;
      const aspect = (image?.width ?? 1) / (image?.height ?? 1);
      const w = worldWidth * (layer.definition.width ?? 1);
      layer.mesh.scale.set(w, w / aspect, 1);
      layer.mesh.position.copy(screenPoint(layer.definition.x ?? 0.5, layer.definition.y ?? 0.5, layer.definition.depth ?? 0.5));
    }
  }
  function loadTexture(src: string) {
    return new Promise<T.Texture>((resolve, reject) => loader.load(src, (texture) => {
      if (disposed) { texture.dispose(); reject(new Error("Painted scene was disposed.")); return; }
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      resolve(texture);
    }, undefined, reject));
  }
  function releaseArtwork(value: Artwork) {
    scene.remove(value.group);
    value.base.material.dispose();
    value.completed?.material.dispose();
    value.layers.forEach((layer) => layer.mesh.material.dispose());
    value.textures.forEach((texture) => texture.dispose());
  }
  const definitionFor = (id: PaintedScene) => options.scenes?.[id] ?? (id === "complete" ? options.scenes?.welcome : undefined);
  const anchorsFor = () => {
    const anchors = definitionFor(current)?.anchors;
    return (portrait ? anchors?.mobile : anchors?.desktop) ?? {};
  };
  function artworkRequest(id: PaintedScene) {
    const requestedPortrait = portrait;
    const definition = definitionFor(id);
    const src = id === "opening"
      ? getPaintedOpeningFraming(host.clientWidth, host.clientHeight, worldWidth, worldHeight, options.openingOnly).poster
      : (requestedPortrait ? definition?.mobileSrc : definition?.src) ?? imagePath(id, requestedPortrait);
    const completedSrc = scrollMode ? undefined : requestedPortrait ? definition?.mobileCompletedSrc : definition?.completedSrc;
    const layerDefinitions = (requestedPortrait ? definition?.mobileLayers : definition?.layers) ?? options.layers?.[id] ?? [];
    const key = JSON.stringify([id, requestedPortrait, src, completedSrc, layerDefinitions]);
    return { requestedPortrait, src, completedSrc, layerDefinitions, key };
  }
  function ensureArtwork(id: PaintedScene): Promise<Artwork> {
    const { requestedPortrait, src, completedSrc, layerDefinitions, key } = artworkRequest(id);
    const existing = artwork.get(id);
    if (existing?.portrait === requestedPortrait && existing.src === src) return Promise.resolve(existing);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const sources = [src, ...layerDefinitions.map((layer) => layer.src), ...(completedSrc ? [completedSrc] : [])];
    const promise = loadResourceBatch(sources, loadTexture, (texture) => texture.dispose()).then((textures) => {
      const texture = textures[0];
      const layers = layerDefinitions.map((definition, index) => ({ definition, texture: textures[index + 1] }));
      const completedTexture = completedSrc ? textures[textures.length - 1] : null;
      const group = new T.Group();
      const baseMaterial = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
      const base = new T.Mesh(planeGeometry, baseMaterial);
      group.add(base);
      let completed: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial> | undefined;
      if (completedTexture) {
        completed = new T.Mesh(planeGeometry, new T.MeshBasicMaterial({ map: completedTexture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
        completed.position.z = 0.01;
        completed.renderOrder = 20;
        group.add(completed);
      }
      const paintedLayers = layers.map(({ definition: layerDefinition, texture: layerTexture }) => {
        const layerMaterial = new T.MeshBasicMaterial({ map: layerTexture, transparent: true, depthWrite: false, toneMapped: false });
        const layer = new T.Mesh(planeGeometry, layerMaterial);
        group.add(layer);
        return { mesh: layer, definition: layerDefinition };
      });
      const value: Artwork = { group, base, completed, layers: paintedLayers, textures: [texture, ...layers.map(({ texture: layerTexture }) => layerTexture), ...(completedTexture ? [completedTexture] : [])], portrait: requestedPortrait, src, contained: false, scene: id };
      if (disposed) { releaseArtwork(value); throw new Error("Painted scene was disposed."); }
      if (key !== artworkRequest(id).key) { releaseArtwork(value); return ensureArtwork(id); }
      const previous = artwork.get(id);
      if (previous) releaseArtwork(previous);
      artwork.set(id, value);
      group.visible = false;
      scene.add(group);
      fitArtwork(value);
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  function opacity(value: Artwork, amount: number, completion = 0) {
    value.group.visible = amount > 0;
    const completedBlend = value.completed && completion >= .96 ? 1 : 0;
    value.base.material.opacity = value.scene === "opening" && openingModel ? 0 : amount * (1 - completedBlend);
    if (value.completed) value.completed.material.opacity = amount * completedBlend;
    value.layers.forEach((layer) => { layer.mesh.material.opacity = amount * (1 - completedBlend); });
  }
  function prune() {
    const allowed = new Set([current, nextPaintedScene(current)]);
    if (destination) allowed.add(destination);
    for (const [key, value] of artwork) if (!allowed.has(key)) { releaseArtwork(value); artwork.delete(key); }
  }
  function setProps(progress: number) {
    const p = smooth(progress);
    const anchors = anchorsFor();
    const painting = artwork.get(current);
    const imageScale = painting?.contained ? painting.base.scale.x / worldWidth : 1;
    invitation.visible = current === "opening" && !openingModel && progress > 0;
    const bowlAllowed = definitionFor(current)?.showBowl ?? true;
    bowl.visible = Boolean(bowlTexture) && bowlAllowed && (current === "meal" || current === "visit");
    const bowlFade = current === "meal" && artwork.get(current)?.completed ? 1 - smooth((progress - 0.92) / 0.08) : 1;
    bowlSurface.opacity = bowlFade;
    if (bowlFade === 0) bowl.visible = false;
    doors.visible = !scrollMode && doorLoaded && (current === "visit" || current === "welcome");
    bowlTarget.visible = !scrollMode && current === "meal" && progress < 0.99;
    invitation.position.copy(screenPoint(portrait ? 0.48 : 0.46, portrait ? 0.73 : 0.85, 3 + p * 2));
    invitation.scale.setScalar(T.MathUtils.lerp(portrait ? 0.42 : 0.8, 4.4, p));
    invitation.rotation.set(p * -0.15, p * -0.28, (1 - p) * -0.08);
    const bowlStart = anchors.bowlStart ?? (portrait ? [0.76, 0.72] : [0.83, 0.88]);
    const bowlEnd = anchors.bowlTarget ?? (portrait ? [0.5, 0.64] : [0.64, 0.84]);
    bowlFrom.copy(imagePoint(bowlStart[0], bowlStart[1]));
    bowlTo.copy(imagePoint(bowlEnd[0], bowlEnd[1]));
    bowl.position.lerpVectors(bowlFrom, bowlTo, p);
    bowl.scale.setScalar((anchors.bowlScale ?? (portrait ? 0.75 : 1.1)) * imageScale);
    bowl.rotation.z = Math.sin(p * Math.PI) * 0.035;
    const bowlImage = bowlTexture?.image as { width?: number; height?: number } | undefined;
    const bowlAspect = (bowlImage?.width ?? 640) / (bowlImage?.height ?? 427);
    const bowlWidth = worldWidth * (portrait ? 150 : 196) / Math.max(1, host.clientWidth);
    bowlSprite.scale.set(bowlWidth, bowlWidth / bowlAspect, 1);
    bowlTarget.position.copy(bowlTo);
    bowlTarget.position.z = 0.4;
    bowlTarget.scale.setScalar(imageScale);
    if (current === "visit") {
      const visitBowl = anchors.bowlStart ?? [portrait ? 0.8 : 0.79, 0.84];
      bowl.position.copy(imagePoint(visitBowl[0], visitBowl[1], 3.1));
      bowl.scale.setScalar((anchors.bowlScale ?? (portrait ? 0.62 : 0.85)) * imageScale);
    }
    const doorCenter = anchors.doorCenter ?? [portrait ? 0.55 : 0.68, 0.52];
    doors.position.copy(imagePoint(doorCenter[0], doorCenter[1], 1.2));
    const doorScale = anchors.doorScale ?? (portrait ? 0.98 : 0.82);
    doors.scale.setScalar(doorScale * imageScale);
    doorPivots[0].position.x = -2.5;
    doorPivots[1].position.x = 2.5;
    doorPivots[0].rotation.y = -p * Math.PI * 0.52;
    doorPivots[1].rotation.y = p * Math.PI * 0.52;
    if (current === "visit") doorPivots[0].visible = false;
    else doorPivots[0].visible = true;
  }

  async function ensureSceneProps(id: PaintedScene) {
    const tasks: Promise<void>[] = [];
    if (id === "meal" || (id === "visit" && definitionFor(id)?.showBowl !== false)) tasks.push(ensureBowl());
    if (!scrollMode && (id === "visit" || id === "welcome")) tasks.push(ensureDoors());
    await Promise.all(tasks);
  }

  function ensureSceneReady(id: PaintedScene) {
    return loadForCurrentRevision(
      () => artworkRequest(id).key,
      () => Promise.all([ensureArtwork(id), ensureSceneProps(id)]),
      () => disposed,
    );
  }

  function scrollAssetKey(state: PaintedScrollState) {
    return JSON.stringify([artworkRequest(state.scene).key, state.nextScene ? artworkRequest(state.nextScene).key : null]);
  }
  function requestScrollFrame() {
    if (!scrollMode || disposed) return;
    const requested = sampleScrollState(scrollTarget);
    const key = scrollAssetKey(requested);
    if (key === availableScrollKey) {
      if (pendingScrollKey) {
        ++scrollEpoch;
        pendingScrollKey = "";
        options.onLoadingChange?.(false);
      }
      scrollState = requested;
      wake();
      return;
    }
    if (key === pendingScrollKey) return;
    const epoch = ++scrollEpoch;
    pendingScrollKey = key;
    options.onLoadingChange?.(true);
    const ids = requested.nextScene ? [requested.scene, requested.nextScene] : [requested.scene];
    void Promise.all(ids.map(ensureSceneReady)).then(() => {
      if (disposed) return;
      if (epoch !== scrollEpoch) {
        const latest = sampleScrollState(scrollTarget);
        const keep = new Set([scrollState.scene, scrollState.nextScene, latest.scene, latest.nextScene]);
        for (const [id, value] of artwork) if (!keep.has(id)) { releaseArtwork(value); artwork.delete(id); }
        return;
      }
      const latest = sampleScrollState(scrollTarget);
      pendingScrollKey = "";
      if (scrollAssetKey(latest) !== key) { requestScrollFrame(); return; }
      availableScrollKey = key;
      scrollState = latest;
      current = latest.scene;
      destination = latest.nextScene;
      const keep = new Set(ids);
      for (const [id, value] of artwork) if (!keep.has(id)) { releaseArtwork(value); artwork.delete(id); }
      options.onLoadingChange?.(false);
      wake();
    }).catch((error: unknown) => {
      if (disposed || epoch !== scrollEpoch) return;
      pendingScrollKey = "";
      options.onLoadingChange?.(false);
      options.onError?.(error);
    });
  }

  function commit(id: PaintedScene) {
    current = id;
    interaction = interactionTarget = 0;
    destination = null;
    transitionTime = 0;
    transitionInteractionStart = 0;
    transitionReady = false;
    setPhase("idle");
    options.onSceneChange?.(current);
    prune();
    if (current !== "complete") void ensureArtwork(nextPaintedScene(current)).catch(() => {});
    wake();
  }
  function draw(time: number) {
    frame = 0;
    if (disposed || lost || !visible || document.hidden) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    openingPlayback?.advance(dt);
    pointer.lerp(pointerTarget, reduce ? 1 : 1 - Math.exp(-7 * dt));
    if (pointer.distanceToSquared(pointerTarget) < 0.000001) pointer.copy(pointerTarget);
    if (scrollMode) {
      const incoming = getPaintedSceneCut(scrollState.dissolve, reduce).incoming;
      current = incoming ? scrollState.nextScene ?? scrollState.scene : scrollState.scene;
      destination = scrollState.nextScene;
      interaction = interactionTarget = incoming ? (current === "complete" ? 1 : 0) : reduce ? (scrollState.interaction >= 0.5 ? 1 : 0) : scrollState.interaction;
      setPhase(scrollState.phase);
      if (reportedScrollScene !== scrollState.captionScene) {
        reportedScrollScene = scrollState.captionScene;
        options.onSceneChange?.(reportedScrollScene);
      }
    }
    if (!scrollMode) {
      interaction += (interactionTarget - interaction) * (reduce ? 1 : 1 - Math.exp(-11 * dt));
      if (Math.abs(interactionTarget - interaction) < 0.0001) interaction = interactionTarget;
    }
    let openingOpacity = current === "opening" ? 1 : 0;
    for (const art of artwork.values()) opacity(art, art.scene === current ? 1 : 0, current === "complete" ? 1 : interaction);
    setProps(interaction);
    sweep.visible = false;
    for (const art of artwork.values()) {
      // Only the environment plate drifts; painted people retain their exact registration.
      art.base.position.x = !reduce && art.layers.length && art.scene !== "opening" ? pointer.x * worldWidth * .0015 : 0;
      for (const layer of art.layers) {
        if (layer.definition.fit === "artwork") layer.mesh.position.x = 0;
      }
    }
    if (scrollMode) {
      const cut = setSweep(scrollState.dissolve, scrollState.scene);
      const outgoing = artwork.get(scrollState.scene);
      const incoming = scrollState.nextScene ? artwork.get(scrollState.nextScene) : undefined;
      if (outgoing) opacity(outgoing, cut.outgoingOpacity, 0);
      if (incoming) opacity(incoming, cut.incomingOpacity, 0);
      openingOpacity = scrollState.scene === "opening" ? cut.outgoingOpacity : 0;
      props.visible = current !== "opening" && current !== "complete";
      props.scale.setScalar(1);
      camera.zoom = 1;
      const breath = reduce ? 0 : Math.sin(Math.PI * scrollState.localProgress);
      if (outgoing?.layers.length) outgoing.base.position.x += breath * worldWidth * .0015;
    } else if (phase === "transitioning" && destination && transitionReady) {
      transitionTime += dt;
      const duration = reduce ? 0.16 : current === "opening" ? 2.6 : current === "meal" ? 4.8 : 2.8;
      const progress = clamp(transitionTime / duration);
      interaction = interactionTarget = getPaintedTransitionInteraction(transitionInteractionStart, progress, current === "meal" ? 0.45 : 0.62);
      setProps(interaction);
      const dissolveStart = current === "meal" ? 0.8 : 0.55;
      const dissolve = smooth((progress - dissolveStart) / (1 - dissolveStart));
      const outgoing = artwork.get(current);
      const incoming = artwork.get(destination);
      const cut = setSweep(dissolve, current);
      if (current === "opening") openingOpacity = cut.outgoingOpacity;
      if (outgoing) opacity(outgoing, cut.outgoingOpacity, interaction);
      if (incoming) opacity(incoming, cut.incomingOpacity, destination === "complete" ? 1 : 0);
      props.scale.setScalar(1);
      props.visible = !cut.incoming;
      camera.zoom = 1;
      if (progress === 1) commit(destination);
    } else {
      camera.zoom = 1;
      props.scale.setScalar(1);
      props.visible = current !== "complete";
    }
    if (openingModel) {
      openingRoot.visible = openingOpacity > 0;
      const openingFrame = getPaintedOpeningFraming(host.clientWidth, host.clientHeight, worldWidth, worldHeight, options.openingOnly);
      const { sourceHeight, scale } = openingFrame;
      openingRoot.scale.setScalar(scale);
      openingRoot.position.y = openingFrame.shiftY;
      openingModel.position.y = -sourceHeight / 2;
      openingModel.getObjectByName("BackgroundDesktop")?.traverse((object) => { object.visible = !openingFrame.mobile; });
      openingModel.getObjectByName("BackgroundMobile")?.traverse((object) => { object.visible = openingFrame.mobile && !openingFrame.narrow; });
      openingModel.getObjectByName("BackgroundNarrow")?.traverse((object) => { object.visible = openingFrame.mobile && openingFrame.narrow; });
      const rig = openingModel.getObjectByName("ReliefRig");
      if (rig) { rig.scale.setScalar(openingFrame.mobile ? 0.62 : 1); rig.position.set(0, openingFrame.mobile ? 4.6 : 0, 0); }
      if (openingGuide && openingOutcome === "rest" && !handing) {
        const lift = smooth(interaction);
        openingGuide.position.copy(openingGuidePosition);
        openingGuide.position.y += (reduce ? 0 : lift) * .08;
        openingGuide.position.z += (reduce ? 0 : lift) * .03;
        openingGuide.scale.copy(openingGuideScale);
      }
      if (cardSeat && cardLie && openingGuide) {
        const arrived = smooth(Math.max(0, (openingPlayback?.passed() ?? 0) * 2.5 - 1.5));
        cardSeat.position.copy(openingGuide.position).add(seatShift.set(cardRest[0] * arrived, cardRest[1] * arrived, 0));
        cardSeat.rotation.z = cardRest[2] * arrived;
        cardLie.position.copy(openingGuide.position).negate();
      }
      openingModel.updateMatrixWorld(true);
      const fading = openingOpacity > 0 && openingOpacity < 1;
      for (const [surface, original] of openingMaterials) {
        const transparent = original.transparent || fading;
        if (surface.transparent !== transparent) { surface.transparent = transparent; surface.needsUpdate = true; }
        surface.depthWrite = fading ? false : original.depthWrite;
        surface.opacity = original.opacity * openingOpacity;
      }
    }
    hemisphere.intensity = current === "opening" ? 2 : 2.4;
    light.intensity = current === "opening" ? 2 : 2.2;
    light.position.z = current === "opening" ? 12 : 16;
    renderer.toneMappingExposure = current === "opening" ? 1.05 : 1.1;
    camera.position.x = reduce || current !== "opening" ? 0 : pointer.x * 0.045;
    camera.position.y = reduce || current !== "opening" ? 0 : pointer.y * 0.025;
    sweep.position.x = camera.position.x; sweep.position.y = camera.position.y;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    if (!ready && artwork.has(current) && openingLoaded) { ready = true; options.onReady?.(); }
    if ((!scrollMode && phase === "transitioning" && transitionReady) || interaction !== interactionTarget || !pointer.equals(pointerTarget) || openingPlayback?.isRunning()) wake();
  }
  function wake() {
    if (!frame && !disposed && !lost && visible && !document.hidden) { frame = requestAnimationFrame(draw); }
  }
  function completeInteraction() {
    if (scrollMode || disposed || phase === "transitioning" || current === "complete") return;
    const epoch = ++navigationEpoch;
    destination = nextPaintedScene(current);
    transitionTime = 0;
    transitionReady = false;
    transitionInteractionStart = interaction;
    interactionTarget = interaction;
    setPhase("transitioning");
    const requested = destination;
    void ensureSceneReady(requested).then(() => {
      if (disposed || epoch !== navigationEpoch || destination !== requested) return;
      transitionReady = true;
      wake();
    }).catch((error: unknown) => {
      if (disposed || epoch !== navigationEpoch || destination !== requested) return;
      destination = null;
      interactionTarget = 0;
      setPhase("idle");
      options.onError?.(error);
      wake();
    });
    wake();
  }
  function ndc(event: PointerEvent) {
    const rect = host.getBoundingClientRect();
    return new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
  }
  const hit = (point: T.Vector2) => {
    if (current === "meal" && !bowlTexture) return false;
    if ((current === "visit" || current === "welcome") && !doorLoaded) return false;
    raycaster.setFromCamera(point, camera);
    if (current === "opening" && openingModel) return raycaster.intersectObjects(openingPickTargets, true).length > 0;
    const target = current === "opening" ? invitation : current === "meal" ? bowl : doors;
    return raycaster.intersectObject(target, true).length > 0;
  };
  function onDown(event: PointerEvent) {
    if (scrollMode || !event.isPrimary || phase === "transitioning" || current === "complete" || !ready || !hit(ndc(event))) return;
    pointerId = event.pointerId;
    down = ndc(event);
    dragging = true;
    setPhase("interacting");
    raycaster.setFromCamera(down, camera);
    raycaster.ray.intersectPlane(dragPlane, dragStart);
    host.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function onMove(event: PointerEvent) {
    if (!event.isPrimary) return;
    const point = ndc(event);
    if (!reduce) pointerTarget.copy(point);
    if (dragging && pointerId === event.pointerId) {
      if (current === "meal") {
        raycaster.setFromCamera(point, camera);
        if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
          const travel = bowlTo.clone().sub(bowlFrom);
          interactionTarget = clamp(dragPoint.clone().sub(dragStart).dot(travel) / travel.lengthSq());
        }
      } else interactionTarget = clamp((Math.abs(point.x - down.x) + Math.abs(point.y - down.y)) * 1.5);
    }
    wake();
  }
  function onUp(event: PointerEvent) {
    if (!dragging || pointerId !== event.pointerId) return;
    const wasTap = ndc(event).distanceTo(down) < 0.035;
    const accepted = event.type !== "pointercancel" && (interactionTarget > 0.8 || wasTap);
    dragging = false;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    pointerId = null;
    if (accepted) completeInteraction();
    else { interactionTarget = 0; setPhase("idle"); wake(); }
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height || disposed) return;
    // A pointer's drag plane belongs to the old viewport. End the gesture before
    // changing that plane so rotation/address-bar resizing cannot accept it.
    if (dragging) {
      dragging = false;
      if (pointerId !== null && host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
      pointerId = null;
      interactionTarget = 0;
      if (phase === "interacting") setPhase("idle");
    }
    portrait = isPaintedPortrait(rect.width, rect.height);
    worldHeight = portrait ? 16.5 : 10;
    worldWidth = worldHeight * rect.width / rect.height;
    camera.left = -worldWidth / 2;
    camera.right = worldWidth / 2;
    camera.top = worldHeight / 2;
    camera.bottom = -worldHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
    if (openingAsset || openingLoaded) loadOpening();
    artwork.forEach(fitArtwork);
    if (scrollMode) {
      availableScrollKey = "";
      pendingScrollKey = "";
      requestScrollFrame();
      wake();
      return;
    }
    const resizedScene = current;
    const epoch = navigationEpoch;
    void ensureSceneReady(resizedScene).then(() => { if (!disposed && current === resizedScene) { prune(); wake(); } }).catch((error: unknown) => { if (!disposed && current === resizedScene && epoch === navigationEpoch) options.onError?.(error); });
    if (destination) {
      const resizedDestination = destination;
      transitionReady = false;
      void ensureSceneReady(resizedDestination).then(() => {
        if (!disposed && epoch === navigationEpoch && destination === resizedDestination) { transitionReady = true; wake(); }
      }).catch((error: unknown) => {
        if (!disposed && epoch === navigationEpoch && destination === resizedDestination) options.onError?.(error);
      });
    }
    wake();
  }
  function onVisibility() { lastTime = 0; if (!document.hidden) wake(); }
  function onReduce() { reduce = options.reducedMotion ?? media.matches; openingPlayback?.apply(openingOutcome, false, reduce); pointerTarget.set(0, 0); wake(); }
  function onLost(event: Event) { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; options.onError?.(new Error("The painted scene renderer was interrupted.")); }
  function onRestored() { lost = false; resize(); wake(); }
  const observer = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); });
  observer.observe(host);
  intersection.observe(host);
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove, { passive: true });
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);
  renderer.domElement.addEventListener("webglcontextlost", onLost);
  renderer.domElement.addEventListener("webglcontextrestored", onRestored);
  document.addEventListener("visibilitychange", onVisibility);
  media.addEventListener("change", onReduce);
  resize();
  function loadOpening() {
    const framing = getPaintedOpeningFraming(host.clientWidth, host.clientHeight, worldWidth, worldHeight, options.openingOnly);
    const asset = `/assets/living-relief-opening-${framing.mobile ? framing.narrow ? "narrow" : "mobile" : "desktop"}.glb`;
    if (asset === openingAsset) return;
    openingAsset = asset;
    const revision = ++openingLoadRevision;
    new GLTFLoader().load(asset, (gltf) => {
    if (disposed || revision !== openingLoadRevision) { disposeOpening(gltf.scene); return; }
    if (openingModel) { openingMixer?.stopAllAction(); openingMixer?.uncacheRoot(openingModel); openingRoot.remove(openingModel); disposeOpening(openingModel); openingMaterials.clear(); openingPickTargets.length = 0; }
    openingLoaded = true;
    openingModel = gltf.scene;
    openingMixer = new T.AnimationMixer(openingModel);
    openingPlayback = createReliefPlayback(openingMixer, gltf.animations);
    // Cache the authored rest transform before restoring a non-rest outcome.
    openingPlayback.apply("rest", true, true, true);
    openingGuide = openingModel.getObjectByName("Guide");
    if (openingGuide) { openingGuidePosition.copy(openingGuide.position); openingGuideScale.copy(openingGuide.scale); }
    if (openingGuide?.parent) {
      cardSeat = new T.Group();
      cardLie = new T.Group();
      cardSeat.add(cardLie);
      openingGuide.parent.add(cardSeat);
      cardLie.add(openingGuide);
    }
    openingPlayback.apply(openingOutcome, true, reduce, true);
    openingPlayback.apply(openingOutcome, false, reduce);
    openingModel.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      if (/^Role[ _]guide[ _]/.test(object.name)) openingPickTargets.push(object);
      for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!openingMaterials.has(surface)) openingMaterials.set(surface, { opacity: surface.opacity, transparent: surface.transparent, depthWrite: surface.depthWrite });
      }
    });
    openingRoot.add(openingModel);
    wake();
  }, undefined, () => {
    if (disposed || revision !== openingLoadRevision) return;
    // A model from another breakpoint cannot stand in for this composition.
    // Clear it so the matching poster is visible, and allow the next resize to retry.
    if (openingModel) {
      openingMixer?.stopAllAction();
      openingMixer?.uncacheRoot(openingModel);
      openingRoot.remove(openingModel);
      disposeOpening(openingModel);
    }
    openingModel = undefined;
    openingMixer = undefined;
    openingPlayback = undefined;
    openingGuide = undefined;
    cardSeat = cardLie = undefined;
    openingMaterials.clear();
    openingPickTargets.length = 0;
    openingAsset = "";
    openingLoaded = true;
    wake();
  });
  }
  loadOpening();

  return {
    setOpeningOutcome(value: ReliefOutcome) {
      if (disposed || openingOutcome === value) return;
      openingOutcome = value;
      handing = false;
      openingPlayback?.apply(value, false, reduce);
      wake();
    },
    /** The visitor leads the card from one hand to the other; `null` lets go and returns it to rest. */
    setHandoff(value: number | null) {
      if (disposed || openingOutcome !== "rest") return;
      handing = value !== null;
      if (value === null) openingPlayback?.apply("rest", false, reduce);
      else openingPlayback?.scrub("accepted", value);
      wake();
    },
    setStoryProgress(value: number) {
      if (!scrollMode || disposed) return;
      scrollTarget = clamp(value);
      requestScrollFrame();
    },
    goToScene(id: PaintedScene) {
      if (scrollMode || disposed || !paintedSequence.includes(id)) return;
      dragging = false;
      if (pointerId !== null && host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
      pointerId = null;
      destination = null;
      interactionTarget = interaction;
      const epoch = ++navigationEpoch;
      setPhase("transitioning");
      void ensureSceneReady(id).then(() => { if (!disposed && epoch === navigationEpoch) { commit(id); wake(); } }).catch((error: unknown) => { if (!disposed && epoch === navigationEpoch) { setPhase("idle"); options.onError?.(error); } });
    },
    setInteractionProgress(value: number) {
      if (disposed || phase === "transitioning" || current === "complete") return;
      interactionTarget = clamp(value);
      setPhase(interactionTarget > 0 ? "interacting" : "idle");
      wake();
    },
    completeInteraction,
    setReducedMotion(value: boolean) { reduce = value; openingPlayback?.apply(openingOutcome, false, reduce); pointerTarget.set(0, 0); wake(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      if (pointerId !== null && host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", onReduce);
      artwork.forEach(releaseArtwork);
      artwork.clear();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((surface) => surface.dispose());
      openingMixer?.stopAllAction();
      if (openingModel) { openingMixer?.uncacheRoot(openingModel); disposeOpening(openingModel); }
      bowlTexture?.dispose();
      doorTextures.forEach((texture) => texture.dispose());
      light.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
