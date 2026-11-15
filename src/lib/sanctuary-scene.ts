import * as T from "three";
import { createSanctuaryCanopy } from "./sanctuary-canopy";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

type SanctuaryOptions = {
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onOffer?: () => void;
  reducedMotion?: boolean;
};

/** A continuous, visitor-led space. The original painting is the sanctuary's far wall. */
export function createSanctuaryScene(host: HTMLElement, options: SanctuaryOptions = {}) {
  const renderer = new T.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.VSMShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.touchAction = "none";
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color("#263b35");
  scene.fog = new T.FogExp2("#3c493d", 0.012);
  const camera = new T.PerspectiveCamera(43, 1, 0.1, 160);
  const pmrem = new T.PMREMGenerator(renderer);
  const environmentRoom = new RoomEnvironment();
  const environment = pmrem.fromScene(environmentRoom, 0.06);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.38;
  environmentRoom.dispose();
  pmrem.dispose();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.28, 0.65, 1.15);
  composer.addPass(bloom);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);
  const materials = new Set<T.Material>();
  const geometries = new Set<T.BufferGeometry>();
  const textures = new Set<T.Texture>();
  const disposable = <G extends T.BufferGeometry>(geometry: G): G => { geometries.add(geometry); return geometry; };
  const material = (color: string, roughness = 0.8) => {
    const value = new T.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
    materials.add(value);
    return value;
  };
  const stone = material("#b9aa87", 0.64);
  const pale = material("#d8c9a8", 0.65);
  const sage = material("#344b40", 0.73);
  const lavender = material("#54475c", 0.74);
  const bronze = material("#a88c50", 0.46);
  bronze.metalness = 0.7;
  const grain = new Uint8Array(128 * 128 * 4);
  for (let index = 0; index < 128 * 128; index++) {
    const x = index % 128;
    const y = Math.floor(index / 128);
    const v = 232 + ((x * 17 + y * 23 + x * y * 3) % 24);
    grain.set([v, v, v, 255], index * 4);
  }
  const grainTexture = new T.DataTexture(grain, 128, 128);
  grainTexture.wrapS = grainTexture.wrapT = T.RepeatWrapping;
  grainTexture.repeat.set(4, 4);
  grainTexture.needsUpdate = true;
  textures.add(grainTexture);
  for (const value of [stone, pale, sage, lavender]) {
    value.bumpMap = grainTexture;
    value.bumpScale = 0.018;
  }

  const addMesh = (geometry: T.BufferGeometry, surface: T.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(geometry, surface);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const floor = addMesh(disposable(new T.PlaneGeometry(80, 120)), material("#c9c2ab", 0.54), 0, -0.035, -8);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;

  // A continuous plaster canopy makes the architecture a room, rather than a wire tunnel.
  const ribs = new T.Group();
  scene.add(ribs);
  const profilePoint = (angle: number, z: number) => new T.Vector3(
    Math.cos(angle) * 6.58,
    2.62 + Math.sin(angle) * 7.45 + Math.sin((z + 25) * Math.PI / 3.5) * 0.11 * Math.sin(angle),
    z,
  );
  for (const side of [0, 1]) {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const segments = 64;
    const depthSegments = 100;
    const angleStart = side === 0 ? 0 : Math.PI / 2 + 0.027;
    const angleEnd = side === 0 ? Math.PI / 2 - 0.027 : Math.PI;
    for (let j = 0; j <= depthSegments; j++) {
      const z = 16 - j / depthSegments * 44;
      for (let i = 0; i <= segments; i++) {
        const a = T.MathUtils.lerp(angleStart, angleEnd, i / segments);
        const point = profilePoint(a, z);
        positions.push(point.x, point.y, point.z);
        uvs.push(i / segments * 4, j / depthSegments * 16);
        if (i < segments && j < depthSegments) {
          const n = j * (segments + 1) + i;
          indices.push(n, n + 1, n + segments + 1, n + 1, n + segments + 2, n + segments + 1);
        }
      }
    }
    const geometry = disposable(new T.BufferGeometry());
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const vaultMaterial = pale.clone();
    vaultMaterial.side = T.DoubleSide;
    materials.add(vaultMaterial);
    const vault = addMesh(geometry, vaultMaterial, 0, 0, 0);
    vault.castShadow = false;
  }
  for (let index = 0; index < 12; index++) {
    const z = 13 - index * 3.5;
    const points = Array.from({ length: 65 }, (_, n) => profilePoint(n / 64 * Math.PI, z));
    const geometry = disposable(new T.TubeGeometry(new T.CatmullRomCurve3(points), 80, 0.105, 10, false));
    const rib = new T.Mesh(geometry, stone);
    rib.castShadow = true;
    rib.receiveShadow = true;
    ribs.add(rib);
    // A narrow bronze edge follows the vault seam, not a second floating arch.
    const seamPoints = points.map((point) => point.clone().add(new T.Vector3(0, -0.08, 0.08)));
    const seam = new T.Mesh(disposable(new T.TubeGeometry(new T.CatmullRomCurve3(seamPoints), 80, 0.018, 6, false)), bronze);
    ribs.add(seam);
    for (const sign of [-1, 1]) {
      const column = addMesh(disposable(new T.CylinderGeometry(0.2, 0.24, 2.6, 24)), stone, sign * 6.57, 1.3, z);
      column.scale.z = 1.5;
      const base = addMesh(disposable(new T.CylinderGeometry(0.33, 0.38, 0.16, 32)), bronze, sign * 6.57, 0.08, z);
      base.scale.z = 1.3;
    }
  }
  const wallMaterial = sage.clone();
  wallMaterial.side = T.DoubleSide;
  materials.add(wallMaterial);
  for (const side of [-1, 1]) {
    const wall = addMesh(disposable(new T.PlaneGeometry(46, 4)), side < 0 ? wallMaterial : lavender, side * 6.72, 2, -6);
    wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.castShadow = false;
    const plinth = addMesh(disposable(new T.BoxGeometry(0.26, 0.26, 46)), stone, side * 6.5, 0.13, -6);
    plinth.castShadow = false;
    const border = addMesh(disposable(new T.BoxGeometry(0.025, 0.012, 45)), bronze, side * 4.85, 0.006, -7);
    border.castShadow = false;
  }

  const skylightGeometry = disposable(new T.PlaneGeometry(1.2, 46));
  const skyMaterial = new T.MeshBasicMaterial({ color: "#fff0c4", side: T.DoubleSide });
  materials.add(skyMaterial);
  const skylight = addMesh(skylightGeometry, skyMaterial, 0, 10.35, -7);
  skylight.rotation.x = Math.PI / 2;
  skylight.castShadow = false;

  // The mural stays pixel-faithful. No displacement or regeneration touches the people.
  const muralMaterial = new T.MeshBasicMaterial({ color: "#e9dfc8", toneMapped: false });
  materials.add(muralMaterial);
  const mural = addMesh(disposable(new T.PlaneGeometry(14.4, 10.24)), muralMaterial, 0, 5.12, -27.3);
  mural.castShadow = false;
  const frameGeometry = disposable(new T.BoxGeometry(14.6, 10.44, 0.18));
  addMesh(frameGeometry, bronze, 0, 5.12, -27.44);

  scene.add(new T.HemisphereLight("#dae4df", "#3c352b", 0.55));
  const sun = new T.DirectionalLight("#ffe0a6", 2.5);
  sun.position.set(-7, 13, 7);
  sun.target.position.set(2, 0, -7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 8;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 70;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const warmth = new T.PointLight("#ffd793", 17, 26, 2);
  warmth.position.set(0, 6.5, -8);
  scene.add(warmth);

  const beamMaterial = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { color: { value: new T.Color("#ffe8ad") }, amount: { value: 0.052 } },
    vertexShader: "varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "varying vec2 vUv; uniform vec3 color; uniform float amount; void main(){float edge=pow(sin(vUv.x*3.14159265),2.0); float fade=pow(1.0-vUv.y,0.65)*smoothstep(0.0,0.09,vUv.y); gl_FragColor=vec4(color,edge*fade*amount);}",
  });
  materials.add(beamMaterial);
  const beamGeometry = disposable(new T.PlaneGeometry(1.6, 13));
  const beams = new T.Group();
  for (let index = 0; index < 7; index++) {
    const beam = new T.Mesh(beamGeometry, beamMaterial);
    beam.position.set(-2.8, 5.8, 8 - index * 5);
    beam.rotation.z = -0.43;
    beams.add(beam);
  }
  scene.add(beams);

  // A circular gathering: gently curved benches and a continuous inlaid line.
  const gathering = new T.Group();
  gathering.position.z = -5;
  scene.add(gathering);
  const ringGeometry = disposable(new T.TorusGeometry(3.8, 0.018, 8, 128));
  const ringMaterial = bronze.clone();
  ringMaterial.emissive.set("#edc879");
  materials.add(ringMaterial);
  const ring = new T.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.015;
  gathering.add(ring);
  const benchGeometry = (inner: number, outer: number, thickness: number) => {
    const shape = new T.Shape();
    const span = Math.PI / 4.7;
    shape.absarc(0, 0, outer, -span / 2, span / 2, false);
    shape.absarc(0, 0, inner, span / 2, -span / 2, true);
    shape.closePath();
    const geometry = disposable(new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 3, curveSegments: 30 }));
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  };
  const seatGeometry = benchGeometry(4.12, 4.65, 0.13);
  const supportGeometry = benchGeometry(4.24, 4.51, 0.37);
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3 + Math.PI / 6;
    const seat = new T.Mesh(seatGeometry, index % 2 ? lavender : sage);
    seat.rotation.y = angle;
    seat.position.y = 0.38;
    seat.castShadow = seat.receiveShadow = true;
    const support = new T.Mesh(supportGeometry, stone);
    support.rotation.y = angle;
    support.position.y = 0.02;
    support.castShadow = support.receiveShadow = true;
    gathering.add(seat, support);
  }
  const glowMaterial = new T.MeshBasicMaterial({ color: "#fff1bd", transparent: true, opacity: 0.1, depthWrite: false });
  materials.add(glowMaterial);
  const luminous = new T.MeshStandardMaterial({ color: "#d3b976", emissive: "#ffd477", emissiveIntensity: 0.05, roughness: 0.35, metalness: 0.3 });
  materials.add(luminous);
  const lampGeometry = disposable(new T.SphereGeometry(0.047, 12, 8));
  const haloGeometry = disposable(new T.PlaneGeometry(0.6, 0.6));
  const haloTextureData = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
    const a = Math.pow(Math.max(0, 1 - d), 3) * 255;
    haloTextureData.set([255, 242, 195, a], (y * 64 + x) * 4);
  }
  const haloTexture = new T.DataTexture(haloTextureData, 64, 64);
  haloTexture.needsUpdate = true;
  textures.add(haloTexture);
  glowMaterial.map = haloTexture;
  const lamps: Array<{ lamp: T.Mesh; halo: T.Mesh; material: T.MeshBasicMaterial; threshold: number }> = [];
  for (let index = 0; index < 40; index++) {
    const angle = index / 40 * Math.PI * 2;
    const lamp = new T.Mesh(lampGeometry, luminous);
    lamp.position.set(Math.sin(angle) * 3.8, 0.075, Math.cos(angle) * 3.8);
    const haloSurface = glowMaterial.clone();
    materials.add(haloSurface);
    const halo = new T.Mesh(haloGeometry, haloSurface);
    halo.position.copy(lamp.position);
    halo.position.y += 0.04;
    gathering.add(lamp, halo);
    lamps.push({ lamp, halo, material: haloSurface, threshold: index / 40 });
  }

  const canopy = createSanctuaryCanopy();
  scene.add(canopy.group);

  // The same folded invitation travels into the room and becomes one open place.
  const invitationGeometry = disposable(new T.PlaneGeometry(1, 1, 32, 16));
  const invitationSource = invitationGeometry.attributes.position.array.slice();
  const invitationCanvas = document.createElement("canvas");
  invitationCanvas.width = 512;
  invitationCanvas.height = 320;
  const ink = invitationCanvas.getContext("2d");
  if (ink) {
    ink.fillStyle = "#f5ecd7";
    ink.fillRect(0, 0, 512, 320);
    for (let n = 0; n < 15000; n++) {
      const x = (n * 37) % 512;
      const y = (n * 61 + n % 23) % 320;
      ink.fillStyle = n % 2 ? "#d6ccb519" : "#ffffff33";
      ink.fillRect(x, y, 1, 2);
    }
    ink.fillStyle = "#b29957";
    ink.fillRect(72, 105, 34, 34);
    ink.fillStyle = "#686952";
    ink.fillRect(133, 109, 232, 8);
    ink.fillRect(133, 132, 167, 7);
    ink.fillRect(133, 171, 205, 4);
    ink.fillRect(133, 188, 185, 4);
  }
  const invitationTexture = new T.CanvasTexture(invitationCanvas);
  invitationTexture.colorSpace = T.SRGBColorSpace;
  invitationTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  textures.add(invitationTexture);
  const invitationMaterial = new T.MeshStandardMaterial({ color: "#ffffff", map: invitationTexture, roughness: 0.92, side: T.DoubleSide, emissive: "#f5d89a", emissiveIntensity: 0.02 });
  materials.add(invitationMaterial);
  const invitation = new T.Mesh(invitationGeometry, invitationMaterial);
  invitation.castShadow = true;
  invitation.receiveShadow = true;
  scene.add(invitation);
  const connections = new T.Group();
  connections.position.z = -5;
  scene.add(connections);
  const pathMaterial = new T.LineBasicMaterial({ color: "#f7d68b", transparent: true, opacity: 0 });
  materials.add(pathMaterial);
  const paths: Array<{ geometry: T.BufferGeometry; threshold: number }> = [];
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2;
    const points: T.Vector3[] = [];
    for (let step = 0; step <= 48; step++) {
      const t = step / 48;
      const radius = 0.8 + t * 3;
      const turn = angle + Math.sin(Math.PI * t) * 0.18;
      points.push(new T.Vector3(Math.sin(turn) * radius, 0.03, Math.cos(turn) * radius));
    }
    const geometry = disposable(new T.BufferGeometry().setFromPoints(points));
    geometry.setDrawRange(0, 0);
    connections.add(new T.Line(geometry, pathMaterial));
    paths.push({ geometry, threshold: index / 18 });
  }

  const reduceMedia = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = options.reducedMotion ?? reduceMedia.matches;
  let disposed = false;
  let inView = true;
  let frame = 0;
  let lastTime = 0;
  let progress = 0;
  let progressTarget = 0;
  let care = 0;
  let careTarget = 0;
  let ready = false;
  let textureReady = false;
  const pointer = new T.Vector2();
  const pointerTarget = new T.Vector2();
  const look = new T.Vector3();
  const raycaster = new T.Raycaster();
  const dragPlane = new T.Plane();
  const dragStart = new T.Vector3();
  const dragPoint = new T.Vector3();
  const dragOffset = new T.Vector3();
  const dragPointerStart = new T.Vector2();
  const dragPointer = new T.Vector2();
  const targetPosition = new T.Vector3(0, 0.06, -5);
  let dragging = false;
  let dropReady = false;
  let dragPointerId: number | undefined;

  const clamp = (value: number) => T.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
  const render = (time: number) => {
    frame = 0;
    if (disposed || !inView || document.hidden) return;
    if (!dragging) dragOffset.multiplyScalar(0.82);
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    const lerp = reduce ? 1 : 1 - Math.exp(-2.6 * dt);
    progress += (progressTarget - progress) * lerp;
    care += (careTarget - care) * (reduce ? 1 : 1 - Math.exp(-1.3 * dt));
    pointer.lerp(pointerTarget, reduce ? 1 : 1 - Math.exp(-3.5 * dt));
    if (Math.abs(progressTarget - progress) < 0.0001) progress = progressTarget;
    if (Math.abs(careTarget - care) < 0.0001) care = careTarget;
    const travel = progress * progress * (3 - 2 * progress);
    const portrait = camera.aspect < 0.85;
    camera.position.set(pointer.x * travel * 0.6, T.MathUtils.lerp(5.2, 4.9, travel) + pointer.y * travel * 0.16, T.MathUtils.lerp(-16.5, (portrait ? 29 : 22) - care * 6, travel));
    look.set(pointer.x * travel * 0.2, T.MathUtils.lerp(5.2, 4.6, travel), -27 + travel * 15);
    camera.lookAt(look);
    sun.position.x = -7 + pointer.x * 3;
    sun.position.z = 7 + pointer.y * 2;
    invitation.position.set(0, T.MathUtils.lerp(3.5, 1.2, travel) * (1 - care) + 0.05 * care, T.MathUtils.lerp(-23, -5, travel));
    invitation.position.add(dragOffset);
    ringMaterial.emissiveIntensity = dropReady ? 1.8 : progress > 0.3 && care < 0.1 ? 0.35 : 0.05;
    invitation.rotation.set(T.MathUtils.lerp(-0.13, -Math.PI / 2, care), 0, (1 - travel) * -0.08);
    const sheetPositions = invitationGeometry.attributes.position;
    for (let index = 0; index < sheetPositions.count; index++) {
      const x = invitationSource[index * 3];
      const y = invitationSource[index * 3 + 1];
      const angle = (1 - care) * 0.22;
      const wing = Math.max(0, Math.abs(x) - 1 / 6);
      const foldedX = Math.sign(x) * (Math.min(Math.abs(x), 1 / 6) + wing * Math.cos(angle));
      const u = x * 2;
      const v = y * 2;
      const circleX = u * Math.sqrt(1 - v * v / 2);
      const circleY = v * Math.sqrt(1 - u * u / 2);
      sheetPositions.setXYZ(index, T.MathUtils.lerp(foldedX * 2.6, circleX * 0.9, care), T.MathUtils.lerp(y * 1.3, circleY * 0.9, care), wing * Math.sin(angle) * 2.6);
    }
    sheetPositions.needsUpdate = true;
    invitationGeometry.computeVertexNormals();
    invitationMaterial.emissiveIntensity = 0.06 + care * 1.4;
    pathMaterial.opacity = care * 0.7;
    for (const path of paths) path.geometry.setDrawRange(0, Math.round(clamp((care - path.threshold * 0.6) / 0.4) * 49));
    canopy.setOpen(care);
    warmth.position.y = 6.4;
    warmth.intensity = 17 + care * 32;
    luminous.emissiveIntensity = 0.05 + care * 3.5;
    for (const lamp of lamps) {
      const lit = clamp((care - lamp.threshold * 0.75) / 0.24);
      lamp.material.opacity = lit * 0.85;
      lamp.halo.quaternion.copy(camera.quaternion);
      lamp.lamp.scale.setScalar(1 + lit * 0.2);
    }
    beamMaterial.uniforms.amount.value = 0.045 + care * 0.025;
    composer.render();
    if (!ready && textureReady) { ready = true; options.onReady?.(); }
    if (progress !== progressTarget || care !== careTarget || pointer.distanceToSquared(pointerTarget) > 0.00001 || dragging || dragOffset.lengthSq() > 0.00001) frame = requestAnimationFrame(render);
  };
  const wake = () => { if (!disposed && !frame && inView && !document.hidden) { lastTime = 0; frame = requestAnimationFrame(render); } };
  const resize = () => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    wake();
  };
  const pointerNdc = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    return new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
  };
  const pointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || progressTarget < 0.25 || careTarget > 0.05) return;
    const ndc = pointerNdc(event);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.intersectObject(invitation).length) return;
    dragging = true;
    dropReady = false;
    dragPointerId = event.pointerId;
    dragPointerStart.copy(ndc);
    dragPointer.copy(ndc);
    dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()), invitation.position);
    raycaster.ray.intersectPlane(dragPlane, dragStart);
    host.setPointerCapture(event.pointerId);
    event.preventDefault();
    wake();
  };
  const endDrag = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== dragPointerId) return;
    const accepted = event.type !== "pointercancel" && dropReady && dragPointer.distanceTo(dragPointerStart) > 0.05;
    dragging = false;
    dropReady = false;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    dragPointerId = undefined;
    if (accepted) options.onOffer?.();
    wake();
  };
  const onPointer = (event: PointerEvent) => {
    if (dragging) {
      dragPointer.copy(pointerNdc(event));
      raycaster.setFromCamera(dragPointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) dragOffset.copy(dragPoint).sub(dragStart);
      const target = targetPosition.clone().project(camera);
      dropReady = dragPointer.distanceTo(new T.Vector2(target.x, target.y)) < 0.48;
      wake();
      event.preventDefault();
      return;
    }
    if (reduce || !event.isPrimary) return;
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointerTarget.set(clamp((event.clientX - bounds.left) / bounds.width) * 2 - 1, 1 - clamp((event.clientY - bounds.top) / bounds.height) * 2);
    wake();
  };
  const resetPointer = () => { pointerTarget.set(0, 0); wake(); };
  const visibility = () => { if (!document.hidden) wake(); };
  const motionChange = () => { reduce = options.reducedMotion ?? reduceMedia.matches; pointerTarget.set(0, 0); wake(); };
  const contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; options.onError?.(new Error("The artwork renderer lost its context.")); };
  const contextRestored = () => { resize(); wake(); };
  host.addEventListener("pointermove", onPointer, { passive: false });
  host.addEventListener("pointerdown", pointerDown);
  host.addEventListener("pointerup", endDrag);
  host.addEventListener("pointercancel", endDrag);
  host.addEventListener("pointerleave", resetPointer);
  host.addEventListener("pointercancel", resetPointer);
  host.addEventListener("pointerup", resetPointer);
  document.addEventListener("visibilitychange", visibility);
  reduceMedia.addEventListener("change", motionChange);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) wake(); });
  intersection.observe(host);
  new T.TextureLoader().load("/assets/living-relief-poster.webp", (texture) => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.add(texture);
    muralMaterial.map = texture;
    muralMaterial.color.set("#ffffff");
    muralMaterial.needsUpdate = true;
    textureReady = true;
    wake();
  }, undefined, (error) => { if (!disposed) options.onError?.(error); });
  resize();
  return {
    setProgress(value: number) { progressTarget = clamp(value); wake(); },
    setCare(value: number) { careTarget = clamp(value); wake(); },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      if (dragPointerId !== undefined && host.hasPointerCapture(dragPointerId)) host.releasePointerCapture(dragPointerId);
      resizeObserver.disconnect();
      intersection.disconnect();
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerdown", pointerDown);
      host.removeEventListener("pointerup", endDrag);
      host.removeEventListener("pointercancel", endDrag);
      host.removeEventListener("pointerleave", resetPointer);
      host.removeEventListener("pointercancel", resetPointer);
      host.removeEventListener("pointerup", resetPointer);
      document.removeEventListener("visibilitychange", visibility);
      reduceMedia.removeEventListener("change", motionChange);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      canopy.dispose();
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      textures.forEach((value) => value.dispose());
      sun.shadow.map?.dispose();
      environment.dispose();
      bloom.dispose();
      outputPass.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
