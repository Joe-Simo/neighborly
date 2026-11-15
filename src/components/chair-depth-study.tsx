"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { architectureUv, dominantFaceProjection } from "@/lib/architecture-uv";
import { stepChair } from "@/lib/chair-motion";
import { Button } from "@/components/ui/button";

export function ChairDepthStudy() {
  const host = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const wake = useRef<(() => void) | null>(null);
  const hitTest = useRef<((x: number, y: number) => boolean) | null>(null);
  const [pulled, setPulled] = useState(false);
  const [inCourtyard, setInCourtyard] = useState(true);
  const [reference, setReference] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const gesture = useRef<{ id: number; x: number; y: number; baseline: number; dragging: boolean; element: HTMLDivElement } | null>(null);
  const releaseGesture = (cancelled: boolean) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id);
    if (!active.dragging) return;
    progress.current = cancelled ? active.baseline : progress.current >= .5 ? 1 : 0;
    setPulled(progress.current >= .5); wake.current?.();
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (reference || !ready || failed || !event.isPrimary || event.button !== 0 || !hitTest.current?.(event.clientX, event.clientY)) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, baseline: progress.current, dragging: false, element: event.currentTarget };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active) { event.currentTarget.style.cursor = ready && !failed && hitTest.current?.(event.clientX, event.clientY) ? "grab" : "default"; return; }
    if (active.id !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (!active.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { gesture.current = null; return; }
      if (Math.abs(dx) <= 8 || Math.abs(dx) <= Math.abs(dy)) return;
      active.dragging = true; event.currentTarget.setPointerCapture(active.id);
    }
    if (event.cancelable) event.preventDefault();
    progress.current = Math.max(0, Math.min(1, active.baseline + dx / 120));
    wake.current?.();
  };

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js")]).then(async ([T, { GLTFLoader }]) => {
      if (disposed || !host.current) return;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
      host.current.appendChild(renderer.domElement);
      const scene = new T.Scene();
      const camera = inCourtyard ? new T.OrthographicCamera(-1, 1, .5, -.5, .01, 20) : new T.PerspectiveCamera(35, 1, .01, 20);
      if (inCourtyard) { camera.position.set(0, .1, 5); camera.lookAt(0, .1, 0); }
      else { camera.position.set(1.5, 1.25, 2.3); camera.lookAt(0, .5, 0); }
      scene.add(new T.HemisphereLight("#fff8e8", "#76664f", 2));
      const sun = new T.DirectionalLight("#ffe9c3", 3); sun.position.set(-2, 4, 3); sun.castShadow = true;
      sun.shadow.mapSize.set(512, 512); sun.shadow.camera.left = -1.5; sun.shadow.camera.right = 1.5;
      sun.shadow.camera.top = 1.5; sun.shadow.camera.bottom = -1.5; sun.shadow.normalBias = .015; scene.add(sun);
      const ground = new T.Mesh(new T.PlaneGeometry(6, 6), new T.ShadowMaterial({ opacity: .18 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -.005; ground.receiveShadow = true; scene.add(ground);
      const manager = new T.LoadingManager();
      const model = new T.Group();
      const raycaster = new T.Raycaster();
      const pointer = new T.Vector2();
      const testHit = (x: number, y: number) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        if (disposed || cleaned || !bounds.width || !bounds.height) return false;
        pointer.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2);
        camera.updateMatrixWorld(); model.updateMatrixWorld(true);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObject(model, true).length > 0;
      };
      hitTest.current = testHit;
      if (inCourtyard) { model.scale.set(.22, .15, .22); model.position.set(-.164, -.10, 0); model.rotation.x = .32; ground.position.y = -.105; ground.rotation.x = -Math.PI / 2 + .32; }
      const textures = new Set<import("three").Texture>();
      let frame = 0, current = 0, lastTime = 0;
      let contextLost = false;
      let assetsReady = false;
      let reportedReady = false;
      let cleaned = false;
      const retiredGeometries = new Set<import("three").BufferGeometry>();
      const retiredMaterials = new Set<import("three").Material>();
      const releasedGeometries = new WeakSet<import("three").BufferGeometry>();
      const releasedMaterials = new WeakSet<import("three").Material>();
      const releasedTextures = new WeakSet<import("three").Texture>();
      const releaseGeometry = (value: import("three").BufferGeometry) => { if (!releasedGeometries.has(value)) { releasedGeometries.add(value); value.dispose(); } };
      const releaseTexture = (value: import("three").Texture) => { if (!releasedTextures.has(value)) { releasedTextures.add(value); value.dispose(); if (typeof ImageBitmap !== "undefined" && value.source.data instanceof ImageBitmap) value.source.data.close(); } };
      const releaseMaterial = (value: import("three").Material) => { if (!releasedMaterials.has(value)) { releasedMaterials.add(value); for (const property of Object.values(value)) if (property instanceof T.Texture) releaseTexture(property); value.dispose(); } };
      const releaseModel = (root: import("three").Object3D) => root.traverse(object => { if (object instanceof T.Mesh) { releaseGeometry(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(releaseMaterial); } });
      const media = matchMedia("(prefers-reduced-motion: reduce)");
      const draw = (time: number) => {
        frame = 0;
        if (disposed || contextLost || document.hidden) return;
        const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
        lastTime = time;
        current = stepChair(current, progress.current, dt, media.matches);
        model.position.z = current * (inCourtyard ? .04 : .22);
        if (inCourtyard) model.position.y = -.10 - Math.tan(.32) * model.position.z;
        model.rotation.y = (inCourtyard ? -.85 : -.28) + current * .1;
        if (inCourtyard) model.position.x = -.164 - current * .04;
        renderer.render(scene, camera);
        if (assetsReady && !reportedReady && !renderer.getContext().isContextLost()) { reportedReady = true; setFailed(false); setReady(true); }
        if (current !== progress.current) requestDraw();
      };
      const requestDraw = () => { if (current === progress.current) lastTime = 0; if (!frame && !disposed && !cleaned && !contextLost && !document.hidden) frame = requestAnimationFrame(draw); };
      wake.current = requestDraw;
      const resize = new ResizeObserver(() => {
        if (!host.current) return;
        const { width, height } = host.current.getBoundingClientRect();
        renderer.setSize(width, height);
        if (camera instanceof T.PerspectiveCamera) camera.aspect = width / height;
        camera.updateProjectionMatrix(); requestDraw();
      });
      resize.observe(host.current);
      const visibility = () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; requestDraw(); };
      const onContextLost = (event: Event) => {
        event.preventDefault(); contextLost = true; reportedReady = false;
        cancelAnimationFrame(frame); frame = 0;
        releaseGesture(true); setReady(false); setFailed(true);
      };
      const onContextRestored = () => { contextLost = false; lastTime = 0; requestDraw(); };
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);
      renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
      document.addEventListener("visibilitychange", visibility); media.addEventListener("change", requestDraw);
      cleanup = () => {
        if (cleaned) return; cleaned = true;
        cancelAnimationFrame(frame); resize.disconnect(); manager.abort();
        if (wake.current === requestDraw) wake.current = null;
        if (hitTest.current === testHit) hitTest.current = null;
        document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", requestDraw);
        renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
        releaseModel(model); retiredGeometries.forEach(releaseGeometry); retiredMaterials.forEach(releaseMaterial);
        textures.forEach(releaseTexture); releaseGeometry(ground.geometry); releaseMaterial(ground.material);
        sun.shadow.map?.dispose(); renderer.dispose(); renderer.domElement.remove(); scene.clear();
      };
      const loaded = await new GLTFLoader(manager).loadAsync("/assets/threshold/courtyard-chair.glb");
      if (disposed || cleaned) { releaseModel(loaded.scene); return; }
      model.add(loaded.scene);
      scene.add(model);
      const oak = await new T.TextureLoader(manager).loadAsync("/assets/threshold/painted-oak.webp");
      if (disposed || cleaned) { releaseTexture(oak); return; }
      textures.add(oak);
      oak.colorSpace = T.SRGBColorSpace; oak.wrapS = oak.wrapT = T.RepeatWrapping;
      model.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        object.castShadow = true; object.receiveShadow = true;
        const source = object.geometry;
        object.geometry = source.index ? source.toNonIndexed() : source.clone(); retiredGeometries.add(source);
        const p = object.geometry.getAttribute("position");
        const uv = new T.BufferAttribute(new Float32Array(p.count * 2), 2);
        for (let i = 0; i < p.count; i += 3) {
          const point = (n: number): [number, number, number] => [p.getX(n), p.getY(n), p.getZ(n)];
          const projection = dominantFaceProjection(point(i), point(i + 1), point(i + 2));
          for (let j = i; j < i + 3; j++) { const value = architectureUv(point(j), projection); uv.setXY(j, value[0] * 4, value[1] * 4); }
        }
        object.geometry.setAttribute("uv", uv);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) retiredMaterials.add(material);
        object.material = new T.MeshStandardMaterial({ map: oak, roughness: 1, metalness: 0, color: "#d3cbb9" });
      });
      retiredGeometries.forEach(releaseGeometry); retiredMaterials.forEach(releaseMaterial);
      assetsReady = true; requestDraw();
    }).catch(() => { cleanup(); if (!disposed) { setReady(false); setFailed(true); } });
    return () => {
      disposed = true;
      const active = gesture.current; gesture.current = null;
      if (active?.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id);
      cleanup();
    };
  }, [inCourtyard, revision]);
  return <main style={{ minHeight: "100svh", background: "#eee7d7", color: "#293f32", padding: "32px 7%" }}>
    <a href="/depth-study">Back to the story</a>
    <h1 style={{ font: "48px Georgia, serif", margin: "30px 0 8px" }}>A place for one more.</h1>
    <p>Chair geometry study</p>
    <Button variant="outline" onClick={() => { releaseGesture(true); setReady(false); setFailed(false); setInCourtyard(value => !value); }}>{inCourtyard ? "Inspect the chair" : "See in the courtyard"}</Button>
    {inCourtyard && <Button variant="outline" aria-pressed={reference} onClick={() => { releaseGesture(true); setReference(value => !value); }}>{reference ? "Show 3D chair" : "Compare painted chair"}</Button>}
    <div className={inCourtyard && reference ? "chair-reference-visible" : undefined} style={{ position: "relative" }}>
    <style>{`.chair-reference-visible canvas{visibility:hidden}`}</style>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {inCourtyard && reference && <img src="/assets/threshold/table-chair.webp" alt="Approved painted chair reference" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", transform: "translate(5%, -3%) scale(.68)", transformOrigin: "37% 67%", pointerEvents: "none", zIndex: 1 }} />}
    <div ref={host} aria-hidden="true" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => { if (gesture.current?.id === event.pointerId) releaseGesture(false); }} onPointerCancel={event => { if (gesture.current?.id === event.pointerId) releaseGesture(true); }} onLostPointerCapture={event => { if (gesture.current?.id === event.pointerId) releaseGesture(true); }} style={inCourtyard ? { touchAction: "pan-y", cursor: "default", aspectRatio: "2 / 1", margin: "24px 0", background: "url(/assets/threshold/courtyard-community-v3.webp) center / 100% 100% no-repeat" } : { touchAction: "pan-y", cursor: "default", height: "65svh", minHeight: 300 }} />
    </div>
    {failed && <Button variant="outline" onClick={() => { releaseGesture(true); setReady(false); setFailed(false); setRevision(value => value + 1); }}>Retry the chair</Button>}
    <Button disabled={!ready || failed || (inCourtyard && reference)} onClick={() => { progress.current = pulled ? 0 : 1; setPulled(!pulled); wake.current?.(); }}>{failed ? "The chair could not load" : !ready ? "Preparing the chair…" : pulled ? "Return the chair" : "Pull out the chair"}</Button>
  </main>;
}
