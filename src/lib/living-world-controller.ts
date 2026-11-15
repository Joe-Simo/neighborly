import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { loadResourceBatch } from "./painted-world-loading";
import type { PaintedScene } from "./painted-world-controller";
import { getPaintedOpeningFraming, isPaintedPortrait } from "./painted-world-framing";
import { getLivingWorldFrame, type LivingWorldFrame, type WorldCover } from "./living-world-timeline";

type CameraFrame = { position: readonly number[]; target: readonly number[]; fov: number; verticalFov?: number };
type WorldManifest = { cameras: Record<string, CameraFrame> };
export type LivingWorldOptions = {
  /** Legacy review option; split room URLs own residency. */
  worldUrl?: string;
  roomUrls?: Partial<Record<"meal" | "visit" | "welcome", string>>;
  dracoDecoderPath?: string;
  transitionsUrl?: string;
  manifestUrl?: string;
  charactersUrl?: string;
  shareLoafUrl?: string;
  onReady?: () => void;
  onLoadingChange?: (loading: boolean) => void;
  onSceneChange?: (scene: PaintedScene) => void;
  onPhaseChange?: (phase: "idle" | "interacting" | "transitioning") => void;
  onError?: (error: unknown) => void;
  reducedMotion?: boolean;
};
const roomNames: Record<string, string> = { meal: "KitchenWorld", visit: "DoorstepWorld", welcome: "GatheringWorld", complete: "GatheringWorld" };
const cameraNames: Record<string, string> = { meal: "KitchenWide", visit: "DoorstepWide", welcome: "GatheringWide", complete: "GatheringWide" };
const fallbackCameras: Record<string, CameraFrame> = {
  KitchenWide: { position: [4.6, 3.2, 6.4], target: [-.15, 1.1, -.5], fov: 43.6 },
  KitchenClose: { position: [1.2, 1.55, 2.2], target: [.3, .88, .45], fov: 36.87 },
  DoorstepWide: { position: [4.4, 3.1, 6.1], target: [0, 1.25, -.7], fov: 42.74 },
  GatheringWide: { position: [5.2, 3.7, 6.8], target: [0, 1, 0], fov: 45.43 },
};

/** Reduced motion keeps one authored camera and endpoint poses for each scene. */
export function getLivingWorldMotionState(frame: LivingWorldFrame, reducedMotion: boolean) {
  return {
    cameraProgress: reducedMotion ? 0 : frame.sceneProgress,
    actionProgress: reducedMotion ? (frame.sceneProgress >= .5 ? 1 : 0) : frame.sceneProgress,
    cover: reducedMotion ? null : frame.cover,
  };
}

/** Keep the welcome camera between the two outward-opening door leaves. */
export function getLivingWorldWelcomePose(progress: number, portrait: boolean, reducedMotion: boolean) {
  const travel = reducedMotion ? 0 : T.MathUtils.clamp(progress, 0, 1);
  return {
    position: [portrait ? 0 : T.MathUtils.lerp(.6, .4, travel), T.MathUtils.lerp(2.2, 2.35, travel), T.MathUtils.lerp(portrait ? 7.6 : 7.3, portrait ? 7.6 : 5.8, travel)] as const,
    target: [0, portrait ? 1.2 : 1.1, -.3] as const,
    fov: portrait ? 54 : 48,
    doorAngle: T.MathUtils.lerp(1.05, 1.65, T.MathUtils.smoothstep(reducedMotion ? (progress >= .5 ? 1 : 0) : progress, .05, .65)),
  };
}

/** Current plus the next room in travel direction; opening uses only its own art. */
export function getLivingWorldResidentRooms(scene: PaintedScene, direction: number) {
  const sequence = ["opening", "meal", "visit", "welcome"] as const;
  const index = scene === "complete" ? 3 : sequence.indexOf(scene);
  return [sequence[index], sequence[index + (direction < 0 ? -1 : 1)]].filter((value): value is "meal" | "visit" | "welcome" => !!value && value !== "opening");
}

/** The visiting door swings into the room, away from the host and camera. */
export function getLivingWorldVisitDoorAngle(progress: number, authoredAngle: number) {
  return (Math.abs(authoredAngle) || Math.PI / 3) * T.MathUtils.smoothstep(progress, .12, .7);
}

/** Shared clone resources and late loader arrivals must only be released once. */
export function createLivingWorldResourceDisposer() {
  const geometries = new WeakSet<T.BufferGeometry>();
  const materials = new WeakSet<T.Material>();
  const textures = new WeakSet<T.Texture>();
  const skeletons = new WeakSet<T.Skeleton>();
  const bitmaps = new WeakSet<ImageBitmap>();
  function texture(value: T.Texture) {
    if (textures.has(value)) return;
    textures.add(value);
    value.dispose();
    const data: unknown = value.source.data;
    if (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap && !bitmaps.has(data)) {
      bitmaps.add(data); data.close();
    }
  }
  return (model: T.Object3D) => model.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (!geometries.has(object.geometry)) { geometries.add(object.geometry); object.geometry.dispose(); }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (materials.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof T.Texture) texture(value);
      material.dispose();
    }
    if (object instanceof T.SkinnedMesh && !skeletons.has(object.skeleton)) {
      skeletons.add(object.skeleton);
      if (object.skeleton.boneTexture) texture(object.skeleton.boneTexture);
      object.skeleton.boneTexture = null;
      object.skeleton.dispose();
    }
  });
}

/** Real Blender rooms, props and foreground occluders. Never crossfades human scenes. */
export function createLivingWorldController(host: HTMLElement, options: LivingWorldOptions = {}) {
  let renderer: T.WebGLRenderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" }); }
  catch (error: unknown) { options.onError?.(error); throw error; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = "pan-y";
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const world = new T.Scene();
  world.background = new T.Color().setRGB(.62, .70, .72);
  RectAreaLightUniformsLib.init();
  const hero = new T.Scene();
  hero.background = new T.Color("#efe8d9");
  const overlay = new T.Scene();
  const camera = new T.PerspectiveCamera(43, 1, .03, 150);
  const heroCamera = new T.OrthographicCamera(-7.2, 7.2, 5.12, -5.12, .1, 100);
  heroCamera.position.z = 30;
  const overlayCamera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 200);
  overlayCamera.position.z = 80;
  for (const scene of [hero]) {
    scene.add(new T.HemisphereLight(scene === hero ? "#ffffff" : "#fff6e6", scene === hero ? "#b3aaa3" : "#7f725c", scene === hero ? 2 : 1.2));
    const light = new T.DirectionalLight(scene === hero ? "#fff0d4" : "#fff1d3", scene === hero ? 2 : 3.5);
    light.position.set(scene === hero ? -5 : -4, 8, scene === hero ? 12 : 8);
    light.castShadow = scene === world;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = light.shadow.camera.bottom = -8;
    light.shadow.camera.right = light.shadow.camera.top = 8;
    light.shadow.normalBias = .035;
    scene.add(light, light.target);
  }
  overlay.add(new T.HemisphereLight("#fff7e8", "#8d7b61", 2.1));
  const key = new T.DirectionalLight("#fff1da", 2.2);
  key.position.set(-4, 7, 12);
  overlay.add(key);
  const backingGeometry = new T.PlaneGeometry(1, 1);
  const backingMaterial = new T.MeshBasicMaterial({ color: "#e5d8bc", depthTest: false, depthWrite: false });
  const backing = new T.Mesh(backingGeometry, backingMaterial);
  backing.position.z = -20;
  overlay.add(backing);
  backing.visible = false;
  const manager = new T.LoadingManager();
  const decoder = new DRACOLoader(manager).setDecoderPath(options.dracoDecoderPath ?? "/assets/painted-world/draco/").setWorkerLimit(2);
  const loader = new GLTFLoader(manager).setDRACOLoader(decoder).setMeshoptDecoder(MeshoptDecoder);
  const manifestAbort = new AbortController();
  const disposeModel = createLivingWorldResourceDisposer();
  let pendingLoads = 0;
  let decoderDisposed = false;
  function releaseDecoder() {
    if (disposed && pendingLoads === 0 && !decoderDisposed) { decoderDisposed = true; decoder.dispose(); }
  }
  async function loadModel(source: string) {
    if (disposed) throw new DOMException("The scene was disposed.", "AbortError");
    pendingLoads++;
    try { return await loader.loadAsync(source); }
    finally { pendingLoads--; releaseDecoder(); }
  }
  const loaded: GLTF[] = [];
  const roomModels = new Map<string, GLTF>();
  const roomLoads = new Map<string, Promise<void>>();
  let castModel: GLTF | undefined;
  let bowlTemplate: T.Object3D | undefined;
  let loafTemplate: T.Object3D | undefined;
  let heroPromise: Promise<void> | undefined;
  let heroGltf: GLTF | undefined;
  let direction = 1;
  const actors: Array<{ room: string; identity: string; root: T.Object3D; base: T.Vector3; mixer: T.AnimationMixer; action?: T.AnimationAction; actionKind: "share" | "greet" | "carry" | "rest" }> = [];
  const rooms = new Map<string, T.Object3D>();
  const covers = new Map<Exclude<WorldCover, null>, { root: T.Group; scale: number }>();
  let heroModel: T.Group | undefined;
  let heroGuide: T.Object3D | undefined;
  const guidePosition = new T.Vector3();
  const guideScale = new T.Vector3();
  let worldPromise: Promise<void> | undefined;
  let worldReady = false;
  let ready = false;
  let loading = false;
  let disposed = false;
  let visible = true;
  let lost = false;
  let raf = 0;
  let width = 1;
  let height = 1;
  let targetProgress = 0;
  let directFrame: LivingWorldFrame | undefined;
  let transition: { start: number; from: number; to: number; resolve: () => void } | undefined;
  let motionOverride = options.reducedMotion;
  let shownFrame = getLivingWorldFrame(0);
  let reportedScene: PaintedScene = "opening";
  let cameras: Record<string, CameraFrame> = fallbackCameras;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = options.reducedMotion ?? media.matches;
  let mixer: T.AnimationMixer | undefined;
  let heroMixer: T.AnimationMixer | undefined;
  const pointer = new T.Vector2();
  const look = new T.Vector3();
  const fromPosition = new T.Vector3();
  const toPosition = new T.Vector3();
  const fromLook = new T.Vector3();
  const toLook = new T.Vector3();
  const bowlInitial = new T.Vector3();
  let bowlRig: T.Object3D | undefined;
  let doorHinge: T.Object3D | undefined;
  let welcomeLeft: T.Object3D | undefined;
  let welcomeRight: T.Object3D | undefined;
  let hingeInitial = 0;

  function setLoading(next: boolean) { if (loading !== next) { loading = next; options.onLoadingChange?.(next); } }
  function normaliseCover(model: T.Object3D, kind: Exclude<WorldCover, null>) {
    const root = new T.Group();
    const content = new T.Group();
    content.add(model);
    if (kind === "bowl") model.traverse(object => { if (/vegetable/i.test(object.name)) object.visible = false; });
    if (kind !== "door") content.rotation.x = Math.PI / 2;
    content.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(content);
    const center = box.getCenter(new T.Vector3());
    const size = box.getSize(new T.Vector3());
    content.position.sub(center);
    root.add(content);
    root.visible = false;
    overlay.add(root);
    covers.set(kind, { root, scale: Math.max((width / height) * 2.9 / Math.max(size.x, .001), 2.9 / Math.max(size.y, .001)) });
    root.userData.coverSize = size;
  }
  function reportFailure(error: unknown) {
    if (!disposed) { cancelTransition(); setLoading(false); options.onError?.(error); }
  }
  function currentRequest() { return directFrame ?? getLivingWorldFrame(targetProgress); }
  function wantedRoomNames() { return getLivingWorldResidentRooms(currentRequest().scene, direction).map(scene => roomNames[scene]); }
  function isFrameReady(frame: LivingWorldFrame) {
    if (frame.cover) {
      const next = frame.sourceScene === "opening" ? "meal" : frame.sourceScene === "meal" ? "visit" : "welcome";
      if (!worldReady || !rooms.has(roomNames[next])) return false;
    }
    return frame.scene === "opening" ? !!heroModel : rooms.has(roomNames[frame.scene]);
  }
  function refreshLoading() { setLoading(!isFrameReady(currentRequest())); }
  function releaseHero() {
    if (!heroGltf) return;
    heroMixer?.stopAllAction(); if (heroMixer) heroMixer.uncacheRoot(heroMixer.getRoot());
    heroModel?.removeFromParent(); disposeModel(heroGltf.scene);
    heroModel = undefined; heroGltf = undefined; heroMixer = undefined; heroGuide = undefined;
  }
  function requestHero() {
    if (heroModel || heroPromise || disposed) return;
    heroPromise = loadModel("/assets/living-relief.glb").then(gltf => {
      if (disposed || currentRequest().scene !== "opening") { disposeModel(gltf.scene); return; }
      heroGltf = gltf; heroModel = gltf.scene; heroMixer = new T.AnimationMixer(heroModel);
      const rest = gltf.animations.find(clip => clip.name === "rest");
      if (rest) { const action = heroMixer.clipAction(rest); action.play(); action.time = rest.duration; action.paused = true; heroMixer.update(0); }
      heroGuide = heroModel.getObjectByName("Guide");
      if (heroGuide) { guidePosition.copy(heroGuide.position); guideScale.copy(heroGuide.scale); }
      hero.add(heroModel); refreshLoading(); wake();
    }).catch(reportFailure).finally(() => { heroPromise = undefined; });
  }
  function releaseRoom(name: string) {
    const gltf = roomModels.get(name);
    if (!gltf) return;
    for (let i = actors.length - 1; i >= 0; i--) {
      const actor = actors[i]; if (actor.room !== name) continue;
      actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.root);
      actor.root.removeFromParent();
      // Geometry/materials belong to the shared cast, but every clone owns its skeleton.
      actor.root.traverse(object => { if (object instanceof T.SkinnedMesh) object.skeleton.dispose(); });
      actors.splice(i, 1);
    }
    gltf.scene.removeFromParent(); disposeModel(gltf.scene);
    roomModels.delete(name); rooms.delete(name);
    if (name === "KitchenWorld") bowlRig = undefined;
    if (name === "DoorstepWorld") doorHinge = undefined;
    if (name === "GatheringWorld") { welcomeLeft = undefined; welcomeRight = undefined; }
  }
  function trimRooms() {
    const keep = new Set(wantedRoomNames());
    if (shownFrame.scene !== "opening") keep.add(roomNames[shownFrame.scene]);
    for (const name of roomModels.keys()) if (!keep.has(name)) releaseRoom(name);
    if (shownFrame.scene !== "opening" && currentRequest().scene !== "opening") releaseHero();
  }
  function attachCast(roomName: string) {
    if (!castModel) return;
    const characterGltf = castModel;
        const cast = [
          ["KitchenWorld", "Woman", [-.75, 0, -.35], -.15],
          ["KitchenWorld", "Man", [1.25, 0, -.25], -.65],
          ["DoorstepWorld", "Woman", [-.85, 0, 1.2], 1.05],
          ["DoorstepWorld", "Man", [.3, 0, -.85], -1.8],
          ["GatheringWorld", "Woman", [-1.3, 0, -.6], .55],
          ["GatheringWorld", "Man", [1.05, 0, -.8], -.55],
          ["GatheringWorld", "Neighbor", [.1, 0, -1.4], .2],
        ] as const;
        for (const [room, identity, position, rotation] of cast) {
          if (room !== roomName) continue;
          const source = characterGltf.scene.getObjectByName(`${identity}Root`);
          const parent = rooms.get(room);
          if (!source || !parent) continue;
          const actor = cloneSkeleton(source);
          actor.position.set(position[0], position[1], position[2]); actor.rotation.y = rotation;
          actor.traverse(object => { if (object instanceof T.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
          parent.add(actor);
          const actorMixer = new T.AnimationMixer(actor);
          const preferred = room === "KitchenWorld" ? ["share", "carry", "rest"] as const : room === "DoorstepWorld" && identity === "Woman" ? ["carry", "rest"] as const : ["greet", "rest", "carry"] as const;
          const actionKind = preferred.find(kind => characterGltf.animations.some(clip => clip.name === `${identity} ${kind}`)) ?? "rest";
          const clip = characterGltf.animations.find(value => value.name === `${identity} ${actionKind}`);
          const action = clip ? actorMixer.clipAction(clip) : undefined;
          if (action) { action.play(); action.paused = true; }
          actors.push({ room, identity, root: actor, base: actor.position.clone(), mixer: actorMixer, action, actionKind });
          if (room === "KitchenWorld" && identity === "Man" && actionKind === "share" && loafTemplate) {
            const grip = actor.getObjectByName("ManShareGrip");
            if (grip) grip.add(loafTemplate.clone(true));
          }
          if (room === "DoorstepWorld" && identity === "Woman" && bowlTemplate) {
            const carried = bowlTemplate.clone(true);
            carried.position.set(0, 0, 0); carried.updateMatrixWorld(true);
            const bounds = new T.Box3().setFromObject(carried);
            const center = bounds.getCenter(new T.Vector3());
            const prop = new T.Group();
            carried.position.sub(center);
            prop.add(carried); prop.position.set(0, 1.19, .4); actor.add(prop);
          }
        }
      }

  function requestRoom(scene: "meal" | "visit" | "welcome") {
    const name = roomNames[scene];
    if (!worldReady || rooms.has(name) || roomLoads.has(name) || disposed) return;
    const url = options.roomUrls?.[scene] ?? `/assets/painted-world/rooms/${scene === "meal" ? "kitchen" : scene}.glb`;
    const pending = loadModel(url).then(gltf => {
      if (disposed || (!wantedRoomNames().includes(name) && roomNames[shownFrame.scene] !== name)) { disposeModel(gltf.scene); return; }
      const room = gltf.scene.getObjectByName(name);
      if (!room) { disposeModel(gltf.scene); throw new Error(`The Blender scene is missing ${name}.`); }
      roomModels.set(name, gltf); rooms.set(name, room); world.add(gltf.scene); lightRoom(room, name);
      room.traverse(object => { if (object instanceof T.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      if (scene === "meal") { bowlRig = room.getObjectByName("KitchenBowlRig"); if (bowlRig) bowlInitial.copy(bowlRig.position); }
      if (scene === "visit") { doorHinge = room.getObjectByName("VisitDoorHinge"); if (doorHinge) hingeInitial = doorHinge.rotation.y; }
      if (scene === "welcome") { welcomeLeft = room.getObjectByName("GatheringDoorLeftHinge"); welcomeRight = room.getObjectByName("GatheringDoorRightHinge"); }
      attachCast(name); if (transition) transition.start = performance.now(); refreshLoading(); trimRooms(); wake();
    }).catch(reportFailure).finally(() => { roomLoads.delete(name); });
    roomLoads.set(name, pending);
  }
  function prepareFrames() {
    if (currentRequest().scene === "opening") requestHero();
    if (!worldReady) return;
    for (const scene of getLivingWorldResidentRooms(currentRequest().scene, direction)) requestRoom(scene);
    refreshLoading();
  }
  function requestWorld() {
    if (worldPromise || worldReady || disposed) { prepareFrames(); return; }
    worldPromise = fetch(options.manifestUrl ?? "/assets/painted-world/rooms/manifest.json", { signal: manifestAbort.signal }).then(async response => {
      if (!response.ok) throw new Error("The authored camera manifest could not load.");
      const manifest = await response.json() as WorldManifest;
      if (disposed) throw new DOMException("The scene was disposed.", "AbortError");
      const models = await loadResourceBatch([options.transitionsUrl ?? "/assets/painted-world/transitions-community-v2.glb", options.charactersUrl ?? "/assets/painted-world/characters-story-final.glb", options.shareLoafUrl ?? "/assets/painted-world/share-loaf.glb?v=2"], loadModel, gltf => disposeModel(gltf.scene));
      return { models, manifest };
    }).then(({ models, manifest }) => {
      if (disposed) { models.forEach(model => disposeModel(model.scene)); return; }
      const [transitionGltf, characterGltf, loafGltf] = models; loaded.push(...models); castModel = characterGltf; loafTemplate = loafGltf.scene;
      cameras = Object.fromEntries(Object.entries({ ...fallbackCameras, ...manifest.cameras }).map(([name, frame]) => [name, { ...frame, fov: frame.verticalFov ?? T.MathUtils.radToDeg(2 * Math.atan(Math.tan(T.MathUtils.degToRad(frame.fov) / 2) / (1200 / 780))) }]));
      bowlTemplate = transitionGltf.scene.getObjectByName("ServingBowl");
      for (const [kind, name] of [["linen", "FoldedLinen"], ["bowl", "ServingBowl"], ["door", "DoorEdge"]] as const) {
        const object = transitionGltf.scene.getObjectByName(name);
        if (!object) throw new Error(`The Blender transitions are missing ${name}.`);
        object.removeFromParent(); normaliseCover(object, kind);
      }
      worldReady = true; prepareFrames(); wake();
    }).catch(reportFailure);
  }
  function lightRoom(room: T.Object3D, name: string) {
    room.add(new T.HemisphereLight(new T.Color().setRGB(.62, .70, .72), "#867457", .4));
    function area(position: [number, number, number], target: [number, number, number], power: number, size: number, cool = false) {
      const light = new T.RectAreaLight(new T.Color().setRGB(cool ? .65 : 1, cool ? .76 : .87, cool ? 1 : .65), 1, size, size);
      light.power = power;
      light.position.set(position[0], position[2], -position[1]);
      light.lookAt(target[0], target[2], -target[1]); room.add(light);
    }
    if (name === "DoorstepWorld") {
      area([-.6, 4.55, 3.8], [1.4, -2, .3], 1000, .36);
      area([-3, -2, 5], [.2, 1, 1], 1100, 4);
    } else {
      for (const x of [-1.7, 1.2]) area([x - 1, name === "KitchenWorld" ? 4.38 : 4.88, 3.8], [x + 1, -2, .3], 1000, .36);
      area([-2, -3, name === "KitchenWorld" ? 3.15 : 3.5], [0, 0, 1], 180, 5, true);
      area([3, 1, name === "KitchenWorld" ? 3.25 : 3.7], [0, 0, 1], 150, 3);
    }
  }
  function setCamera(frame: LivingWorldFrame) {
    const name = cameraNames[frame.scene] ?? "KitchenWide";
    const portrait = width / height < 1.1;
    const portraitName = frame.scene === "meal" ? "KitchenPortrait" : frame.scene === "visit" ? "DoorstepPortrait" : "GatheringPortrait";
    const base = (portrait ? cameras[portraitName] : undefined) ?? cameras[name] ?? fallbackCameras[name];
    const end: CameraFrame = frame.scene === "meal"
      ? { position: [3.8, 2.65, 5.4], target: [.0, 1.05, .1], fov: base.fov }
      : frame.scene === "visit"
        ? { position: [3.4, 2.5, 5.5], target: [-.1, 1.15, -.1], fov: base.fov }
        : { position: [3.7, 2.75, 6.0], target: [0, 1.05, -.35], fov: base.fov };
    const approach = getLivingWorldMotionState(frame, reduce).cameraProgress;
    fromPosition.fromArray(base.position); toPosition.fromArray(end.position);
    fromLook.fromArray(base.target); toLook.fromArray(end.target);
    camera.position.lerpVectors(fromPosition, toPosition, approach);
    look.lerpVectors(fromLook, toLook, approach);
    if (portrait) {
      // Compose people and their shared gesture inside the narrow viewport.
      if (cameras[portraitName]) { camera.position.fromArray(base.position); look.fromArray(base.target); }
      else { look.set(frame.scene === "visit" ? -.15 : 0, 1.12, 0); camera.position.set(frame.scene === "visit" ? 1.9 : 2.4, 2.65, frame.scene === "visit" ? 7.9 : 8.3); }
    }
    const welcome = frame.scene === "welcome" || frame.scene === "complete" ? getLivingWorldWelcomePose(frame.sceneProgress, portrait, reduce) : undefined;
    if (welcome) { camera.position.set(...welcome.position); look.set(...welcome.target); }
    if (!reduce) camera.position.x += pointer.x * .06;
    camera.fov = welcome?.fov ?? (portrait ? base.fov : T.MathUtils.lerp(base.fov, end.fov, approach));
    camera.lookAt(look); camera.updateProjectionMatrix();
  }
  function setHero(frame: LivingWorldFrame) {
    if (!heroModel) return;
    const span = isPaintedPortrait(width, height) ? 16.5 : 10;
    const worldWidth = span * width / height;
    const fit = getPaintedOpeningFraming(width, height, worldWidth, span);
    heroModel.scale.setScalar(fit.scale);
    heroModel.position.y = -fit.sourceHeight * fit.scale / 2;
    heroCamera.left = -worldWidth / 2; heroCamera.right = worldWidth / 2;
    heroCamera.top = span / 2; heroCamera.bottom = -span / 2; heroCamera.updateProjectionMatrix();
    heroModel.getObjectByName("BackgroundDesktop")?.traverse(object => { object.visible = !fit.mobile; });
    heroModel.getObjectByName("BackgroundMobile")?.traverse(object => { object.visible = fit.mobile && !fit.narrow; });
    heroModel.getObjectByName("BackgroundNarrow")?.traverse(object => { object.visible = fit.mobile && fit.narrow; });
    const rig = heroModel.getObjectByName("ReliefRig");
    if (rig) { rig.scale.setScalar(fit.mobile ? .54 : 1); rig.position.set(0, fit.mobile ? 4 : 0, 0); }
    if (heroGuide) {
      heroGuide.position.copy(guidePosition); heroGuide.scale.copy(guideScale);
      heroGuide.position.y += (reduce ? 0 : frame.actionProgress) * .10;
    }
  }
  function setCover(frame: LivingWorldFrame) {
    covers.forEach(value => { value.root.visible = false; });
    backing.visible = frame.fullyCovered && !reduce;
    if (!frame.cover || reduce) return;
    const cover = covers.get(frame.cover);
    if (!cover) return;
    cover.root.visible = true;
    const size = cover.root.userData.coverSize as T.Vector3;
    const scale = Math.max((width / height) * 2.9 / Math.max(size.x, .001), 2.9 / Math.max(size.y, .001));
    cover.root.scale.setScalar(scale);
    cover.root.position.x = frame.coverOffset * (width / height);
    cover.root.position.y = frame.cover === "bowl" ? .25 * Math.sin(Math.PI * frame.coverProgress) : 0;
    cover.root.rotation.z = frame.cover === "linen" ? -.06 * Math.sin(Math.PI * frame.coverProgress) : 0;
    backing.scale.set(width / height * 2.1, 2.1, 1);
    backingMaterial.color.set(frame.cover === "door" ? "#52664c" : frame.cover === "bowl" ? "#9f6e36" : "#e5d8bc");
  }
  function cancelTransition() {
    if (!transition) return;
    const resolve = transition.resolve; transition = undefined;
    resolve(); options.onPhaseChange?.("idle");
  }
  function choreograph(frame: LivingWorldFrame) {
    const progress = getLivingWorldMotionState(frame, reduce).actionProgress;
    if (bowlRig) {
      bowlRig.position.copy(bowlInitial);
      if (frame.scene === "meal") {
        const place = T.MathUtils.smoothstep(progress, .15, .78);
        bowlRig.position.lerpVectors(new T.Vector3(-.75, 1.19, .05), bowlInitial, place);
      }
    }
    if (doorHinge) doorHinge.rotation.y = frame.scene === "visit" ? getLivingWorldVisitDoorAngle(progress, hingeInitial) : hingeInitial;
    const welcome = getLivingWorldWelcomePose(progress, width / height < 1.1, reduce);
    if (welcomeLeft) welcomeLeft.rotation.y = -welcome.doorAngle;
    if (welcomeRight) welcomeRight.rotation.y = welcome.doorAngle;
    if (mixer) mixer.setTime(progress);
    for (const actor of actors) {
      if (actor.room !== roomNames[frame.scene]) continue;
      actor.root.position.copy(actor.base);
      let pose = actor.actionKind === "carry" ? .72 + progress * .25 : actor.actionKind === "rest" ? 1 : progress;
      if (frame.scene === "visit" && actor.identity === "Woman") actor.root.position.z -= .75 * T.MathUtils.smoothstep(progress, 0, .55);
      if (frame.scene === "visit" && actor.identity === "Man") actor.root.position.z += .45 * T.MathUtils.smoothstep(progress, .45, 1);
      if (actor.actionKind === "greet") pose = T.MathUtils.smoothstep(progress, .3, .9);
      if (actor.action) { actor.action.time = actor.action.getClip().duration * pose; actor.mixer.update(0); }
    }
  }
  function render() {
    raf = 0;
    if (disposed || !visible || lost || document.hidden) return;
    if (transition) {
      if (!isFrameReady(getLivingWorldFrame(transition.to))) { transition.start = performance.now(); requestWorld(); }
      else {
        const elapsed = reduce ? 1 : Math.min(1, (performance.now() - transition.start) / 950);
        targetProgress = T.MathUtils.lerp(transition.from, transition.to, elapsed);
        if (elapsed === 1) cancelTransition();
      }
    }
    const requested = currentRequest();
    if (targetProgress > .035 || requested.scene !== "opening") requestWorld();
    prepareFrames();
    const frame = isFrameReady(requested) ? requested : shownFrame;
    shownFrame = frame;
    if (reportedScene !== frame.scene) { reportedScene = frame.scene; options.onSceneChange?.(frame.scene); }
    if (frame.scene === "opening") { renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; setHero(frame); renderer.render(hero, heroCamera); }
    else if (worldReady) {
      renderer.toneMapping = T.AgXToneMapping; renderer.toneMappingExposure = 1;
      for (const [name, object] of rooms) object.visible = name === roomNames[frame.scene];
      setCamera(frame);
      choreograph(frame);
      renderer.render(world, camera);
    }
    setCover(frame);
    if (frame.cover && !reduce) { const autoClear = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(overlay, overlayCamera); renderer.autoClear = autoClear; }
    if (!ready && isFrameReady(frame)) { ready = true; options.onReady?.(); }
    if (targetProgress > .035 && !worldReady) requestWorld();
    trimRooms();
    if (transition && isFrameReady(getLivingWorldFrame(transition.to))) wake();
  }
  function wake() { if (!raf && !disposed && visible && !document.hidden && !lost) raf = requestAnimationFrame(render); }
  function resize() {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height || disposed) return;
    width = bounds.width; height = bounds.height;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    overlayCamera.left = -width / height; overlayCamera.right = width / height;
    overlayCamera.updateProjectionMatrix();
    renderer.setSize(width, height, false); wake();
  }
  const onPointer = (event: PointerEvent) => {
    if (!reduce && event.isPrimary) { const bounds = host.getBoundingClientRect(); pointer.x = (event.clientX - bounds.left) / bounds.width * 2 - 1; pointer.y = 1 - (event.clientY - bounds.top) / bounds.height * 2; wake(); }
  };
  const onVisibility = () => wake();
  const onMotion = () => { reduce = motionOverride ?? media.matches; wake(); };
  const onLost = (event: Event) => { event.preventDefault(); lost = true; cancelTransition(); directFrame = shownFrame; options.onError?.(new Error("The 3D renderer lost its context.")); };
  const onRestored = () => { lost = false; resize(); };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }); intersection.observe(host);
  host.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  media.addEventListener("change", onMotion);
  renderer.domElement.addEventListener("webglcontextlost", onLost);
  renderer.domElement.addEventListener("webglcontextrestored", onRestored);
  resize();
  requestHero();

  return {
    setStoryProgress(value: number) { cancelTransition(); directFrame = undefined; const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); if (next !== targetProgress) direction = next < targetProgress ? -1 : 1; targetProgress = next; wake(); },
    goToScene(scene: PaintedScene) {
      cancelTransition(); directFrame = undefined;
      const next = ["opening", "meal", "visit", "welcome", "complete"].indexOf(scene) * .22; direction = next < targetProgress ? -1 : 1; targetProgress = next;
      if (scene !== "opening") requestWorld();
      wake();
    },
    setInteractionProgress(value: number) {
      cancelTransition();
      const scene = directFrame?.scene ?? getLivingWorldFrame(targetProgress).scene;
      const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
      directFrame = { ...getLivingWorldFrame(targetProgress), scene, sourceScene: scene, sceneProgress: progress, actionProgress: progress, cover: null, fullyCovered: false };
      options.onPhaseChange?.(progress > 0 && progress < 1 ? "interacting" : "idle"); wake();
    },
    completeInteraction() {
      cancelTransition();
      const currentFrame = directFrame ?? getLivingWorldFrame(targetProgress);
      const index = ["opening", "meal", "visit", "welcome", "complete"].indexOf(currentFrame.scene);
      directFrame = undefined;
      if (index >= 4) return Promise.resolve();
      const from = index * .22 + .22 * (.1 + .52 * currentFrame.sceneProgress);
      direction = 1; targetProgress = from; requestWorld(); options.onPhaseChange?.("transitioning");
      return new Promise<void>(resolve => { transition = { start: performance.now(), from, to: (index + 1) * .22, resolve }; wake(); });
    },
    setReducedMotion(value: boolean) { motionOverride = value; reduce = value; wake(); },
    dispose() {
      if (disposed) return; disposed = true; cancelTransition(); cancelAnimationFrame(raf);
      manifestAbort.abort(); manager.abort(); releaseDecoder();
      resizeObserver.disconnect(); intersection.disconnect();
      host.removeEventListener("pointermove", onPointer); document.removeEventListener("visibilitychange", onVisibility); media.removeEventListener("change", onMotion);
      renderer.domElement.removeEventListener("webglcontextlost", onLost); renderer.domElement.removeEventListener("webglcontextrestored", onRestored);
      for (const name of [...roomModels.keys()]) releaseRoom(name);
      releaseHero();
      for (const animation of [mixer, ...actors.map(actor => actor.mixer)]) {
        if (animation) { animation.stopAllAction(); animation.uncacheRoot(animation.getRoot()); }
      }
      loaded.forEach(gltf => disposeModel(gltf.scene));
      covers.forEach(value => disposeModel(value.root));
      backingGeometry.dispose(); backingMaterial.dispose();
      for (const scene of [world, hero]) scene.traverse(object => { if (object instanceof T.DirectionalLight) object.shadow.map?.dispose(); });
      actors.length = 0; loaded.length = 0; roomLoads.clear(); rooms.clear(); covers.clear();
      castModel = undefined; bowlTemplate = undefined; loafTemplate = undefined;
      world.clear(); hero.clear(); overlay.clear();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
