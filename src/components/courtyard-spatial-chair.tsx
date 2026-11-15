"use client";

import type { Object3D, Texture, BufferGeometry, Material } from "three";
import { useEffect, useRef } from "react";
import { architectureUv, dominantFaceProjection } from "@/lib/architecture-uv";

export function CourtyardSpatialChair() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const surface = host.current;
    const stage = surface?.closest<HTMLElement>(".threshold-experience");
    if (!surface || !stage) return;
    let disposed = false;
    let cleanup = () => {};
    void Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js")]).then(async ([T, { GLTFLoader }]) => {
      if (disposed) return;
      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setClearColor(0, 0); renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.domElement.style.visibility = "hidden";
      surface.appendChild(renderer.domElement);
      const scene = new T.Scene(); const camera = new T.OrthographicCamera(-1, 1, .5, -.5, .01, 20);
      camera.position.z = 5;
      const chair = new T.Group(); scene.add(chair);
      scene.add(new T.HemisphereLight("#fff8e8", "#76664f", 2));
      const sun = new T.DirectionalLight("#ffe9c3", 3);
      sun.castShadow = true; sun.shadow.mapSize.set(512, 512); scene.add(sun, sun.target);
      const contactGround = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), new T.ShadowMaterial({ opacity: .15, depthWrite: false }));
      contactGround.receiveShadow = true; contactGround.rotation.x = -Math.PI / 2 + .32; scene.add(contactGround);
      const manager = new T.LoadingManager();
      const resources = new Set<Object3D>();
      const textures = new Set<Texture>();
      const retired = new Set<BufferGeometry>();
      const oldMaterials = new Set<Material>();
      let rendererWidth = 0; let rendererHeight = 0;
      let frame = 0; let visible = true; let loaded = false; let lost = false; let cleaned = false;
      const render = () => {
        frame = 0;
        if (disposed || cleaned || !visible || lost || document.hidden || !loaded) return;
        const styles = getComputedStyle(stage);
        const rect = stage.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const number = (name: string, fallback: number) => { const value = Number.parseFloat(styles.getPropertyValue(name)); return Number.isFinite(value) ? value : fallback; };
        const width = number("--scene-width", rect.width); const height = number("--scene-height", rect.height);
        const x = number("--scene-x", 0); const y = number("--scene-y", 0);
        const progress = Math.max(0, Math.min(1, number("--table-chair", 0)));
        chair.visible = progress > 0;
        surface.style.opacity = String(progress);
        surface.style.filter = stage.dataset.evening === "true" ? "brightness(.58) saturate(.46)" : "saturate(.6)";
        camera.left = -rect.width / 2; camera.right = rect.width / 2; camera.top = rect.height / 2; camera.bottom = -rect.height / 2;
        camera.far = Math.max(width, height) * 5; camera.position.z = Math.max(width, height) * 2; camera.updateProjectionMatrix();
        // Ground contact matches the approved chair's lower edge in the original 2:1 plate.
        chair.scale.setScalar(height * .14 / 1.122);
        const portraitOffset = rect.width < rect.height ? Math.max(0, Math.min(1, (height - rect.width / 2) / Math.max(1, rect.height - rect.width / 2))) : 0;
        const anchorX = .418 + .027 * portraitOffset;
        chair.position.set((anchorX - .5) * width + x - progress * width * .014, (.5 - .695) * height - y - progress * height * .008, 0);
        chair.rotation.set(.32, -.85 + progress * .1, 0);
        contactGround.visible = chair.visible;
        contactGround.scale.copy(chair.scale);
        contactGround.position.copy(chair.position); contactGround.position.y -= .001 * chair.scale.y;
        const extent = chair.scale.y;
        sun.position.copy(chair.position).add(new T.Vector3(-2, 4, 3).multiplyScalar(extent));
        sun.target.position.copy(chair.position);
        sun.shadow.camera.left = -extent; sun.shadow.camera.right = extent;
        sun.shadow.camera.top = extent * 1.5; sun.shadow.camera.bottom = -extent;
        sun.shadow.camera.near = Math.max(.01, extent * .1); sun.shadow.camera.far = extent * 10;
        sun.shadow.normalBias = extent * .003; sun.shadow.camera.updateProjectionMatrix();
        const zoom = 1 + number("--care-zoom", 0);
        scene.scale.setScalar(zoom);
        if (rendererWidth !== rect.width || rendererHeight !== rect.height) { rendererWidth = rect.width; rendererHeight = rect.height; renderer.setSize(rect.width, rect.height, false); }
        try { renderer.render(scene, camera); }
        catch { cleanup(); return; }
        if (renderer.getContext().isContextLost()) return;
        renderer.domElement.style.visibility = "visible";
        stage.dataset.spatialChairReady = "true";
      };
      const wake = () => { if (!frame && !disposed && !cleaned && visible && !lost && !document.hidden) frame = requestAnimationFrame(render); };
      const mutation = new MutationObserver(wake); mutation.observe(stage, { attributes: true, attributeFilter: ["style", "data-evening", "data-table-ready"] });
      const resize = new ResizeObserver(wake); resize.observe(stage);
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }); intersection.observe(stage);
      const visibility = () => wake(); document.addEventListener("visibilitychange", visibility);
      const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; renderer.domElement.style.visibility = "hidden"; delete stage.dataset.spatialChairReady; };
      const contextRestored = () => { lost = false; wake(); };
      renderer.domElement.addEventListener("webglcontextlost", contextLost); renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
      cleanup = () => {
        if (cleaned) return; cleaned = true; cancelAnimationFrame(frame); manager.abort();
        mutation.disconnect(); resize.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", visibility);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost); renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
        const geometries = new Set<BufferGeometry>(retired); const materials = new Set<Material>(oldMaterials);
        resources.forEach(root => root.traverse(object => { if (object instanceof T.Mesh) { geometries.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } }));
        geometries.add(contactGround.geometry); materials.add(contactGround.material);
        geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
        sun.shadow.map?.dispose();
        renderer.dispose(); renderer.domElement.remove(); delete stage.dataset.spatialChairReady;
      };
      const model = await new GLTFLoader(manager).loadAsync("/assets/threshold/courtyard-chair.glb");
      if (disposed || cleaned) {
        const geometries = new Set<BufferGeometry>(); const materials = new Set<Material>();
        model.scene.traverse(object => { if (object instanceof T.Mesh) { geometries.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } });
        geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); return;
      }
      resources.add(model.scene);
      chair.add(model.scene);
      const oak = await new T.TextureLoader(manager).loadAsync("/assets/threshold/painted-oak.webp");
      if (disposed || cleaned) { oak.dispose(); return; }
      textures.add(oak); oak.colorSpace = T.SRGBColorSpace; oak.wrapS = oak.wrapT = T.RepeatWrapping;
      const material = new T.MeshStandardMaterial({ map: oak, color: "#bdc8c8", roughness: 1 });
      // Own the replacement even if conversion throws before its first assignment.
      oldMaterials.add(material);
      model.scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        retired.add(object.geometry); object.geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        for (const m of Array.isArray(object.material) ? object.material : [object.material]) oldMaterials.add(m);
        object.material = material; object.castShadow = true; object.receiveShadow = true;
        const positions = object.geometry.getAttribute("position"); const uv = new T.BufferAttribute(new Float32Array(positions.count * 2), 2);
        const point = (i: number): [number, number, number] => [positions.getX(i), positions.getY(i), positions.getZ(i)];
        for (let i = 0; i < positions.count; i += 3) {
          const projection = dominantFaceProjection(point(i), point(i + 1), point(i + 2));
          for (let j = i; j < i + 3; j++) { const [u, v] = architectureUv(point(j), projection); uv.setXY(j, u * 4, v * 4); }
        }
        object.geometry.setAttribute("uv", uv);
      });
      loaded = true; wake();
    }).catch(() => cleanup());
    return () => { disposed = true; cleanup(); };
  }, []);
  return <div ref={host} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />;
}
