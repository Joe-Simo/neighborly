"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import "./doorway-depth-study.css";
import { architectureUv, dominantFaceProjection, type Point3 } from "@/lib/architecture-uv";

export function DoorwayDepthStudy({ embedded = false, architecture = false }: { embedded?: boolean; architecture?: boolean }) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLElement>(null);
  const invitation = useRef<HTMLDivElement>(null);
  const input = useRef<((value: number) => void) | null>(null);
  const [opening, setOpening] = useState(0);
  const [status, setStatus] = useState("Loading the room…");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [nearby, setNearby] = useState(false);
  const [onscreen, setOnscreen] = useState(false);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) { const frame = requestAnimationFrame(() => setNearby(true)); return () => cancelAnimationFrame(frame); }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNearby(true); observer.disconnect(); }
    }, { rootMargin: "100% 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const stage = host.current?.parentElement;
    if (!stage) return;
    if (!("IntersectionObserver" in window)) { const frame = requestAnimationFrame(() => setOnscreen(true)); return () => cancelAnimationFrame(frame); }
    let previous: boolean | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      const active = entry.isIntersecting && entry.intersectionRect.height > 0;
      if (active === previous) return;
      previous = active;
      setOnscreen(active);
      if (!active) setReady(false);
    }, { rootMargin: "25% 0px 0px", threshold: .001 });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const enterCourtyard = (instant = false) => {
    const stageHeight = host.current?.getBoundingClientRect().height ?? 0;
    const continuation = embedded ? track.current?.closest(".depth-experience-candidate")?.querySelector<HTMLElement>(".threshold-journey") : null;
    if (continuation) {
      window.scrollTo({ top: continuation.getBoundingClientRect().top + scrollY + .6 * stageHeight, behavior: instant || matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    } else if (instant) router.push("/#your-community");
    else if (track.current) window.scrollTo({ top: track.current.getBoundingClientRect().top + scrollY + track.current.getBoundingClientRect().height - stageHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  useEffect(() => {
    if (!nearby || !onscreen) return;
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};
    void Promise.all([
      import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/utils/BufferGeometryUtils.js"),
    ]).then(async ([T, { GLTFLoader }, { mergeGeometries }]) => {
      if (disposed) return;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.AgXToneMapping;
      renderer.domElement.setAttribute("aria-hidden", "true"); element.appendChild(renderer.domElement);
      const scene = new T.Scene(); scene.background = new T.Color("#e9e1d2");
      const camera = new T.PerspectiveCamera(48, 1, .05, 60);
      const manager = new T.LoadingManager();
      const loader = new GLTFLoader(manager);
      const media = matchMedia("(prefers-reduced-motion: reduce)");
      let artworkLoaded = false; let readyReported = false;
      let target = 0; let actual = 0; let frame = 0; let last = 0; let visible = true; let lost = false;
      const extras = new T.Group(); scene.add(extras);
      const pendingTextures: InstanceType<typeof T.Texture>[] = [];
      const loaded: { left?: InstanceType<typeof T.Object3D>; right?: InstanceType<typeof T.Object3D>; model?: InstanceType<typeof T.Group> } = {};
      const projectedArtwork: { mesh?: InstanceType<typeof T.Mesh> } = {};
      const shadowLights: InstanceType<typeof T.DirectionalLight>[] = [];
      const retiredGeometry = new Set<InstanceType<typeof T.BufferGeometry>>();
      const releasedGeometry = new WeakSet<InstanceType<typeof T.BufferGeometry>>();
      const releasedMaterials = new WeakSet<InstanceType<typeof T.Material>>();
      const releasedTextures = new WeakSet<InstanceType<typeof T.Texture>>();
      const releasedBitmaps = new WeakSet<ImageBitmap>();
      const releaseTexture = (texture: InstanceType<typeof T.Texture>) => {
        if (releasedTextures.has(texture)) return;
        releasedTextures.add(texture); texture.dispose();
        const data: unknown = texture.source.data;
        if (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap && !releasedBitmaps.has(data)) { releasedBitmaps.add(data); data.close(); }
      };
      const release = (root: InstanceType<typeof T.Object3D>) => {
        const geometry = new Set<InstanceType<typeof T.BufferGeometry>>();
        const materials = new Set<InstanceType<typeof T.Material>>();
        const textures = new Set<InstanceType<typeof T.Texture>>();
        root.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          geometry.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
          }
        });
        geometry.forEach(value => { if (!releasedGeometry.has(value)) { releasedGeometry.add(value); value.dispose(); } });
        materials.forEach(value => { if (!releasedMaterials.has(value)) { releasedMaterials.add(value); value.dispose(); } });
        textures.forEach(releaseTexture);
      };
      function draw(time: number) {
        frame = 0;
        if (disposed || !visible || lost || document.hidden) return;
        const dt = last ? Math.min(.05, (time - last) / 1000) : 1 / 60; last = time;
        actual = media.matches ? target : T.MathUtils.damp(actual, target, 9, dt);
        if (Math.abs(actual - target) < .0002) actual = target;
        if (loaded.left) loaded.left.rotation.y = -1.65 * actual;
        if (loaded.right) loaded.right.rotation.y = 1.65 * actual;
        const approach = media.matches ? Number(actual >= .72) : T.MathUtils.smoothstep(actual, .45, 1);
        const halfFov = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
        const initialDistance = Math.max(5.4 / (.80 * 2 * halfFov), 4.2 / (.84 * 2 * halfFov * camera.aspect));
        const initialZ = 2.6 + initialDistance;
        camera.position.set(0, 2.7, T.MathUtils.lerp(initialZ, 2.1, approach));
        camera.lookAt(0, 2.7, -.5);
        // Preserve the painted composition while the near threshold supplies parallax.
        if (projectedArtwork.mesh) {
          const distance = camera.position.z + 2;
          const visibleHeight = 2 * distance * Math.tan(T.MathUtils.degToRad(camera.fov / 2));
          const visibleWidth = visibleHeight * camera.aspect;
          const scale = Math.max(visibleHeight / 8, visibleWidth / 16);
          projectedArtwork.mesh.scale.setScalar(scale);
          projectedArtwork.mesh.position.x = 0;
        }
        renderer.render(scene, camera);
        if (artworkLoaded && !readyReported) { readyReported = true; setReady(true); setFailed(false); }
        if (actual !== target) wake();
      }
      function wake() { if (!frame && !disposed && visible && !lost && !document.hidden) frame = requestAnimationFrame(draw); }
      function resize() {
        const bounds = element!.getBoundingClientRect(); if (!bounds.width || !bounds.height) return;
        camera.aspect = bounds.width / bounds.height; camera.fov = camera.aspect < 1 ? 60 : 48;
        camera.updateProjectionMatrix(); renderer.setSize(bounds.width, bounds.height, false); syncScroll(); wake();
      }
      const onVisibility = () => { last = 0; if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { syncScroll(); wake(); } };
      const onLost = (event: Event) => { event.preventDefault(); lost = true; readyReported = false; if (!disposed) { setFailed(true); setStatus("The 3D view is unavailable. Reload to try again."); } };
      const onRestored = () => { lost = false; readyReported = false; setStatus("Scroll to move through the doorway."); resize(); };
      const resizeObserver = new ResizeObserver(() => resize());
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; if (visible) wake(); }); intersection.observe(element);
      document.addEventListener("visibilitychange", onVisibility); media.addEventListener("change", onVisibility);
      renderer.domElement.addEventListener("webglcontextlost", onLost); renderer.domElement.addEventListener("webglcontextrestored", onRestored);
      input.current = value => { target = value; wake(); };
      let scrollFrame = 0;
      function syncScroll() {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          if (!track.current) return;
          const bounds = track.current.getBoundingClientRect();
          const distance = Math.max(1, bounds.height - element!.getBoundingClientRect().height);
          const travel = Math.max(1, embedded ? distance - element!.getBoundingClientRect().height : distance);
          target = Math.max(0, Math.min(1, -bounds.top / travel));
          setOpening(target);
          if (target > .34 && invitation.current?.contains(document.activeElement)) {
            const continuation = embedded ? track.current?.closest(".depth-experience-candidate")?.querySelector<HTMLElement>(".threshold-experience") : track.current;
            if (continuation && !continuation.inert) { if (!continuation.hasAttribute("tabindex")) continuation.tabIndex = -1; continuation.focus({ preventScroll: true }); }
          }
          wake();
        });
      }
      resizeObserver.observe(element);
      if (track.current) resizeObserver.observe(track.current);
      window.addEventListener("scroll", syncScroll, { passive: true });
      window.addEventListener("resize", syncScroll);
      syncScroll();
      let cleaned = false;
      cleanup = () => {
        if (cleaned) return; cleaned = true;
        cancelAnimationFrame(frame); cancelAnimationFrame(scrollFrame); window.removeEventListener("scroll", syncScroll); window.removeEventListener("resize", syncScroll); input.current = null; manager.abort();
        resizeObserver.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", onVisibility); media.removeEventListener("change", onVisibility);
        renderer.domElement.removeEventListener("webglcontextlost", onLost); renderer.domElement.removeEventListener("webglcontextrestored", onRestored);
        if (loaded.model) release(loaded.model); release(extras); retiredGeometry.forEach(value => { if (!releasedGeometry.has(value)) { releasedGeometry.add(value); value.dispose(); } }); pendingTextures.forEach(releaseTexture); shadowLights.forEach(light => light.shadow.map?.dispose()); renderer.dispose(); renderer.domElement.remove(); scene.clear();
      };
      resize();
      const gltf = await loader.loadAsync("/assets/threshold/doorway-shell.glb");
      if (disposed) { release(gltf.scene); return; }
      loaded.model = gltf.scene;
      const room = loaded.model.getObjectByName("GatheringWorld");
      if (!room) throw new Error("The study room is missing.");
      loaded.left = room.getObjectByName("GatheringDoorLeftHinge"); loaded.right = room.getObjectByName("GatheringDoorRightHinge");
      if (!loaded.left || !loaded.right) throw new Error("The authored door hinges are missing.");
      const retained = new T.Group();
      loaded.model.updateMatrixWorld(true);
      retained.attach(loaded.left); retained.attach(loaded.right);
      // Own retained geometry before any validation/traversal can throw.
      const originalModel = loaded.model;
      loaded.model = retained; scene.add(retained); release(originalModel);
      for (const [hinge, name] of [[loaded.left, "Church left sculpted oak leaf"], [loaded.right, "Church right sculpted oak leaf"]] as const) {
        const leaf = hinge.getObjectByName(name.replaceAll(" ", "_")) ?? hinge.getObjectByName(name);
        if (!(leaf instanceof T.Mesh)) throw new Error("The authored leaf is missing.");
        const removed = new T.Group();
        for (const child of [...hinge.children]) if (child !== leaf) removed.attach(child);
        release(removed);
      }
      const textureLoader = new T.TextureLoader(manager);
      const loadTexture = async (url: string) => {
        const texture = await textureLoader.loadAsync(url);
        if (disposed || cleaned) { releaseTexture(texture); throw new Error("Study disposed."); }
        texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        pendingTextures.push(texture); return texture;
      };
      const [doorTexture, courtyardTexture, plasterTexture] = await Promise.all([
        loadTexture("/assets/threshold/doors.webp"), loadTexture("/assets/threshold/courtyard-community-v3.webp"), loadTexture("/assets/paper-world/continuation.webp"),
      ]);
      if (disposed) return;
      for (const [hinge, name, offset] of [[loaded.left, "Church left sculpted oak leaf", 0], [loaded.right, "Church right sculpted oak leaf", .5]] as const) {
        const leaf = hinge.getObjectByName(name.replaceAll(" ", "_")) ?? hinge.getObjectByName(name);
        if (!(leaf instanceof T.Mesh)) continue;
        // Clone before replacing UVs: the GLB source is never modified.
        const sourceGeometry = leaf.geometry; leaf.geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone(); sourceGeometry.dispose();
        leaf.geometry.computeBoundingBox(); const box = leaf.geometry.boundingBox;
        if (!box) throw new Error("Leaf bounds are missing.");
        const positions = leaf.geometry.getAttribute("position");
        const uv = new T.BufferAttribute(new Float32Array(positions.count * 2), 2);
        for (let index = 0; index < positions.count; index++) {
          uv.setXY(index, offset + .5 * (positions.getX(index) - box.min.x) / (box.max.x - box.min.x), (positions.getY(index) - box.min.y) / (box.max.y - box.min.y));
        }
        leaf.geometry.setAttribute("uv", uv);
        for (const material of Array.isArray(leaf.material) ? leaf.material : [leaf.material]) material.dispose();
        leaf.geometry.clearGroups();
        const normals = leaf.geometry.getAttribute("normal");
        for (let triangle = 0; triangle < positions.count; triangle += 3) {
          const facing = Math.abs(normals.getZ(triangle) + normals.getZ(triangle + 1) + normals.getZ(triangle + 2)) / 3;
          const normalZ = (normals.getZ(triangle) + normals.getZ(triangle + 1) + normals.getZ(triangle + 2)) / 3;
          leaf.geometry.addGroup(triangle, 3, facing > .9 ? normalZ > 0 ? 0 : 2 : 1);
        }
        leaf.material = [
          new T.MeshBasicMaterial({ map: doorTexture, toneMapped: false }),
          new T.MeshBasicMaterial({ color: "#737e64", toneMapped: false }),
          new T.MeshBasicMaterial({ color: "#63715b", toneMapped: false }),
        ];
      }
      const wallShape = new T.Shape();
      wallShape.moveTo(-12, -4); wallShape.lineTo(12, -4); wallShape.lineTo(12, 10); wallShape.lineTo(-12, 10); wallShape.closePath();
      const opening = new T.Path();
      opening.moveTo(-2.08, -.02); opening.lineTo(-2.08, 2.65);
      for (let step = 0; step <= 64; step++) {
        const angle = Math.PI - Math.PI * step / 64;
        opening.lineTo(Math.cos(angle) * 2.08, 2.65 + Math.sin(angle) * .68);
      }
      opening.lineTo(2.08, -.02); opening.closePath(); wallShape.holes.push(opening);
      const wallGeometry = new T.ExtrudeGeometry(wallShape, { depth: .24, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 3, steps: 1 });
      const wallPositions = wallGeometry.getAttribute("position");
      const wallUvs = wallGeometry.getAttribute("uv");
      for (let index = 0; index < wallPositions.count; index++) wallUvs.setXY(index, (wallPositions.getX(index) + 12) / 24, (wallPositions.getY(index) + 4) / 14);
      plasterTexture.wrapS = plasterTexture.wrapT = T.ClampToEdgeWrapping;
      const wall = new T.Mesh(wallGeometry, new T.MeshBasicMaterial({ map: plasterTexture, toneMapped: false }));
      wall.scale.y = 1.6; wall.position.z = 2.68; extras.add(wall);
      const courtyard = new T.Mesh(new T.PlaneGeometry(16, 8), new T.MeshBasicMaterial({ map: courtyardTexture, toneMapped: false }));
      courtyard.position.set(0, 2.7, -2); projectedArtwork.mesh = courtyard; extras.add(courtyard);
      if (!embedded || architecture) {
        wall.visible = false;
        const stoneTexture = await loadTexture("/assets/threshold/painted-limestone.webp");
        stoneTexture.wrapS = stoneTexture.wrapT = T.RepeatWrapping;
        const architecture = await loader.loadAsync("/assets/threshold/architecture-shell.glb");
        if (disposed || cleaned) { release(architecture.scene); return; }
        // Register ownership before material/UV conversion, including partial failures.
        extras.add(architecture.scene);
        scene.add(new T.HemisphereLight("#fff6de", "#a58d70", 2.2));
        const architecturalLight = new T.DirectionalLight("#fff0cc", 2.4);
        architecturalLight.position.set(-4, 8, 8);
        architecturalLight.target.position.set(0, 2.4, 2.6);
        architecturalLight.castShadow = true;
        architecturalLight.shadow.mapSize.set(element.clientWidth < 700 ? 512 : 1024, element.clientWidth < 700 ? 512 : 1024);
        architecturalLight.shadow.camera.left = -4.6; architecturalLight.shadow.camera.right = 4.6;
        architecturalLight.shadow.camera.top = 5; architecturalLight.shadow.camera.bottom = -3.6;
        architecturalLight.shadow.camera.near = .5; architecturalLight.shadow.camera.far = 22;
        architecturalLight.shadow.bias = -.00015; architecturalLight.shadow.normalBias = .018;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
        shadowLights.push(architecturalLight); scene.add(architecturalLight, architecturalLight.target);
        for (const hinge of [loaded.left, loaded.right]) hinge?.traverse(object => { if (object instanceof T.Mesh) { object.castShadow = true; object.receiveShadow = false; } });
        const stoneMaterials = [
          new T.MeshStandardMaterial({ map: stoneTexture, color: "#ffffff", roughness: 1, metalness: 0 }),
          new T.MeshStandardMaterial({ map: stoneTexture, color: "#a5ad92", roughness: 1, metalness: 0 }),
        ];
        const batches: Parameters<typeof mergeGeometries>[0][] = [[], []];
        architecture.scene.updateMatrixWorld(true);
        architecture.scene.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          const sourceGeometry = object.geometry;
          const transformed = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
          transformed.applyMatrix4(object.matrixWorld);
          transformed.clearGroups();
          const position = transformed.getAttribute("position");
          const uv = new T.BufferAttribute(new Float32Array(position.count * 2), 2);
          const point = (index: number): Point3 => [position.getX(index), position.getY(index), position.getZ(index)];
          for (let triangle = 0; triangle < position.count; triangle += 3) {
            const vertices = [point(triangle), point(triangle + 1), point(triangle + 2)] as const;
            const projection = dominantFaceProjection(...vertices);
            vertices.forEach((vertex, corner) => {
              const [u, v] = architectureUv(vertex, projection);
              uv.setXY(triangle + corner, u, v);
            });
          }
          transformed.setAttribute("uv", uv);
          // Normalize optional source attributes before joining static surfaces.
          for (const name of Object.keys(transformed.attributes)) if (!["position", "normal", "uv"].includes(name)) transformed.deleteAttribute(name);
          batches[object.name.includes("jamb") ? 1 : 0].push(transformed);
          retiredGeometry.add(transformed);
        });
        const mergedRoot = new T.Group();
        mergedRoot.name = "Batched threshold architecture";
        extras.add(mergedRoot);
        batches.forEach((batch, index) => {
          if (!batch.length) { stoneMaterials[index].dispose(); return; }
          const merged = mergeGeometries(batch, false);
          if (!merged) throw new Error("Architecture geometry could not be batched.");
          const surface = new T.Mesh(merged, stoneMaterials[index]);
          surface.name = index === 0 ? "Cream limestone architecture" : "Sage limestone surround";
          surface.castShadow = true; surface.receiveShadow = true;
          mergedRoot.add(surface);
        });
        architecture.scene.removeFromParent(); release(architecture.scene);
        retiredGeometry.forEach(value => { if (!releasedGeometry.has(value)) { releasedGeometry.add(value); value.dispose(); } });

      }
      artworkLoaded = true; setStatus("Scroll to move through the doorway."); wake();
    }).catch((error: unknown) => { cleanup(); if (!disposed) { setFailed(true); setStatus(error instanceof Error ? error.message : "The 3D view could not load. Reload to try again."); } });
    return () => { disposed = true; cleanup(); };
  }, [embedded, nearby, onscreen, architecture]);

  return <div className={`doorway-depth-study${embedded ? " doorway-depth-embedded" : ""}`} data-ready={ready && onscreen} data-failed={failed} data-architecture={architecture || !embedded}>
    {!embedded && <header><Link href="/">Kind Helps</Link><p>Doorway depth study</p></header>}
    <section className="doorway-depth-track" ref={track} tabIndex={-1} aria-label="Scroll through the painted doorway">
      <div className="doorway-depth-stage">
        {(!ready || failed || !onscreen) && <Image className="doorway-depth-fallback" src="/assets/threshold/courtyard-community-v3.webp" fill sizes="100vw" alt="A painted church courtyard with a shared table and people welcoming one another." />}
        <div className="doorway-depth-canvas" ref={host} />
        <div ref={invitation} className="doorway-depth-invitation" style={{ opacity: failed ? 1 : Math.max(0, 1 - opening * 3), visibility: !failed && opening > .34 ? "hidden" : "visible" }}>
          <p>Good things begin with a welcome.</p><h1>There is room<br /><em>for you.</em></h1>
          <Button disabled={!ready && !failed} onClick={() => enterCourtyard(failed)}>{failed ? "Continue to Kind Helps" : ready ? "Open the door" : "Preparing the doorway…"}</Button>
        </div>
      </div>
    </section>
    {!embedded && <footer><label htmlFor="door-opening">Open the doors <output>{Math.round(opening * 100)}%</output></label>
      <input id="door-opening" type="range" min="0" max="1" step="0.01" value={opening} disabled={failed || !ready} onChange={event => { const value = Number(event.target.value); setOpening(value); input.current?.(value); if (track.current && host.current) window.scrollTo({ top: track.current.getBoundingClientRect().top + scrollY + (track.current.getBoundingClientRect().height - host.current.getBoundingClientRect().height) * value, behavior: "instant" }); }} />
      <p role="status">{status}</p><p>Environment geometry only. This study does not change the main experience.</p>
    </footer>}
  </div>;
}
