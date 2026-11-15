"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { monumentalArtwork, type MonumentalArtwork } from "@/lib/monumental-artwork";
import "./monumental-stage.css";

export function MonumentalStage({ artwork = monumentalArtwork }: { artwork?: MonumentalArtwork }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const breakpoint = matchMedia("(max-width: 700px)");
    const update = () => { setMobile(breakpoint.matches); setReady(false); setFailed(false); };
    update();
    breakpoint.addEventListener("change", update);
    return () => breakpoint.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReduced(preference.matches); setReady(false); };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = host.current;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!element || reduced || saveData || matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("noWebGL")) return;
    let disposed = false;
    let clean = () => {};
    void Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/libs/meshopt_decoder.module.js")]).then(([T, { GLTFLoader }, meshopt]) => {
      if (disposed) return;
      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.6;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      element.appendChild(renderer.domElement);
      // Install disposal as soon as resources exist; later initialization may throw.
      clean = () => { renderer.dispose(); renderer.domElement.remove(); };
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
      const fill = new T.HemisphereLight(0xffffff, 0xb3aaa3, 2);
      scene.add(fill);
      const key = new T.DirectionalLight(0xfff6e5, 2);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.normalBias = 0.015;
      key.shadow.bias = -0.0002;
      key.shadow.radius = 4;
      scene.add(key, key.target);
      const center = new T.Vector3();
      const lightOrigin = new T.Vector3();
      let lightSpan = 1;
      const extent = new T.Vector3(1, 1, 1);
      const fullExtent = new T.Vector3(1, 1, 1);
      const fullCenter = new T.Vector3();
      const current = new T.Vector2();
      const target = new T.Vector2();
      let frame = 0;
      let previous = 0;
      let visible = true;
      let lost = false;
      let loaded = false;
      const disposeScene = (root: InstanceType<typeof T.Object3D>) => root.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          for (const value of Object.values(material)) if (value instanceof T.Texture) value.dispose();
          material.dispose();
        }
      });
      clean = () => { disposeScene(scene); renderer.dispose(); renderer.domElement.remove(); };
      const positionCamera = () => {
        const radius = Math.max(extent.x, extent.y, extent.z) * 3;
        const yaw = T.MathUtils.degToRad(current.x * artwork.yawDegrees);
        const pitch = T.MathUtils.degToRad((artwork.neutralPitchDegrees ?? 0) + current.y * artwork.pitchDegrees);
        camera.position.set(center.x + Math.sin(yaw) * radius, center.y + Math.sin(pitch) * radius, center.z + Math.cos(yaw) * Math.cos(pitch) * radius);
        camera.lookAt(center);
      };
      const draw = (time: number) => {
        frame = 0;
        if (disposed || lost || !visible || document.hidden) return;
        const dt = previous ? Math.min((time - previous) / 1000, 0.1) : 0;
        previous = time;
        current.lerp(target, 1 - Math.exp(-12 * dt));
        if (current.distanceToSquared(target) < 0.000001) current.copy(target);
        positionCamera();
        key.position.copy(lightOrigin);
        key.position.x += current.x * lightSpan * 0.14;
        key.position.y += current.y * lightSpan * 0.08;
        renderer.render(scene, camera);
        if (loaded) setReady(true);
        if (!current.equals(target)) frame = requestAnimationFrame(draw);
      };
      const wake = () => {
        if (!frame && !disposed && !lost && visible && !document.hidden) { previous = 0; frame = requestAnimationFrame(draw); }
      };
      const resize = () => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        if (!width || !height) return;
        const aspect = width / height;
        const span = mobile && artwork.mobileCamera ? artwork.mobileCamera.height : Math.max(extent.y, extent.x / aspect) * artwork.margin;
        camera.left = -span * aspect / 2; camera.right = span * aspect / 2;
        camera.top = span / 2; camera.bottom = -span / 2;
        camera.far = Math.max(fullExtent.length() * 10, 100);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        wake();
      };
      const reset = () => { target.set(0, 0); wake(); };
      const pointer = (event: PointerEvent) => {
        if (!event.isPrimary) return;
        const rect = element.getBoundingClientRect();
        target.set(T.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1), T.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height * 2, -1, 1));
        wake();
      };
      const pointerUp = (event: PointerEvent) => { if (event.pointerType !== "mouse") reset(); };
      const visibility = () => {
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; current.set(0, 0); target.set(0, 0); }
        else wake();
      };
      const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; setReady(false); setFailed(true); };
      const sizeObserver = new ResizeObserver(resize);
      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) { cancelAnimationFrame(frame); frame = 0; current.set(0, 0); target.set(0, 0); }
        else wake();
      });
      sizeObserver.observe(element); intersection.observe(element);
      element.addEventListener("pointermove", pointer, { passive: true });
      element.addEventListener("pointerleave", reset);
      element.addEventListener("pointercancel", reset);
      element.addEventListener("pointerup", pointerUp);
      document.addEventListener("visibilitychange", visibility);
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      let cleaned = false;
      clean = () => {
        if (cleaned) return;
        cleaned = true;
        lost = true;
        cancelAnimationFrame(frame); sizeObserver.disconnect(); intersection.disconnect();
        element.removeEventListener("pointermove", pointer); element.removeEventListener("pointerleave", reset); element.removeEventListener("pointercancel", reset); element.removeEventListener("pointerup", pointerUp);
        document.removeEventListener("visibilitychange", visibility); renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        disposeScene(scene); key.shadow.map?.dispose(); renderer.dispose(); renderer.domElement.remove();
        delete element.dataset.sceneStats;
      };
      const loader = new GLTFLoader().setMeshoptDecoder(meshopt.MeshoptDecoder);
      const modelUrl = mobile && artwork.mobileModel ? artwork.mobileModel : artwork.model;
      loader.load(modelUrl, (gltf) => {
        if (disposed) { disposeScene(gltf.scene); return; }
        try {
        const bounds = new T.Box3().setFromObject(gltf.scene);
        if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite) || bounds.max.x <= bounds.min.x || bounds.max.y <= bounds.min.y) {
          disposeScene(gltf.scene); clean(); setFailed(true); return;
        }
        bounds.getCenter(fullCenter); bounds.getSize(fullExtent);
        const humanBounds = new T.Box3();
        let framedMeshes = 0;
        gltf.scene.traverseVisible((object) => {
          if (!(object instanceof T.Mesh)) return;
          let names = object.name;
          let parent = object.parent;
          while (parent && parent !== gltf.scene) { names += ` ${parent.name}`; parent = parent.parent; }
          if (/architectural|shared|mantle|sleeve|shirt|tunic/i.test(names) || !/female|male|offering|receiving/i.test(names)) return;
          const meshBounds = new T.Box3().setFromObject(object);
          if (meshBounds.isEmpty() || ![...meshBounds.min.toArray(), ...meshBounds.max.toArray()].every(Number.isFinite)) return;
          humanBounds.union(meshBounds);
          framedMeshes++;
        });
        const useHumanBounds = framedMeshes > 0 && !humanBounds.isEmpty() && humanBounds.max.x > humanBounds.min.x && humanBounds.max.y > humanBounds.min.y;
        const framing = useHumanBounds ? humanBounds : bounds;
        framing.getCenter(center); framing.getSize(extent);
        if (mobile && artwork.mobileCamera) center.fromArray(artwork.mobileCamera.target);
        gltf.scene.traverse((object) => { if (object instanceof T.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
        scene.add(gltf.scene);
        let triangles = 0;
        let textureBytesEstimate = 0;
        const textures = new Set<InstanceType<typeof T.Texture>>();
        gltf.scene.traverseVisible((object) => {
          if (!(object instanceof T.Mesh)) return;
          const geometry = object.geometry;
          triangles += Math.min(geometry.drawRange.count, geometry.index?.count ?? geometry.attributes.position?.count ?? 0) / 3;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
          }
        });
        for (const texture of textures) {
          const image: unknown = texture.source.data;
          if (image && typeof image === "object" && "width" in image && "height" in image && typeof image.width === "number" && typeof image.height === "number")
            textureBytesEstimate += image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1);
        }
        element.dataset.sceneStats = JSON.stringify({ model: modelUrl, frameBoundsSource: useHumanBounds ? "human-meshes" : "full-scene-fallback", framedMeshes, frameBounds: { min: framing.min.toArray(), max: framing.max.toArray() }, fullBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, modelVisibleTriangles: Math.round(triangles), uniqueTextures: textures.size, textureBytesEstimate: Math.ceil(textureBytesEstimate), textureEstimateFormat: "RGBA8, with generated mipmaps; excludes render targets" });
        const span = Math.max(fullExtent.x, fullExtent.y);
        key.position.set(fullCenter.x - span * 0.55, fullCenter.y + span * 0.75, bounds.max.z + span);
        lightOrigin.copy(key.position);
        lightSpan = span;
        key.target.position.copy(fullCenter);
        key.shadow.camera.left = key.shadow.camera.bottom = -span;
        key.shadow.camera.right = key.shadow.camera.top = span;
        key.shadow.camera.far = span * 6;
        key.shadow.camera.updateProjectionMatrix();
        loaded = true;
        resize();
        } catch {
          // The model has joined scene before subsequent setup; scene disposal owns it.
          if (!gltf.scene.parent) disposeScene(gltf.scene);
          clean();
          if (!disposed) setFailed(true);
        }
      }, undefined, () => { clean(); if (!disposed) setFailed(true); });
      resize();
    }).catch(() => { clean(); if (!disposed) setFailed(true); });
    return () => { disposed = true; clean(); };
  }, [artwork, reduced, mobile]);

  const showingLive = ready && !reduced;
  return <div className={"monumental-stage"} role="img" aria-label={artwork.description} data-ready={showingLive}>
    {!posterFailed && <picture>{artwork.mobilePoster && <source media="(max-width: 700px)" srcSet={artwork.mobilePoster} />}<Image className={"monumental-poster"} src={artwork.poster} alt="" fill unoptimized sizes="100vw" priority onError={() => setPosterFailed(true)} style={{ opacity: showingLive ? 0 : 1 }} /></picture>}
    <div className={"monumental-canvas"} ref={host} style={{ opacity: showingLive ? 1 : 0 }} />
    {posterFailed && !showingLive && <p className={"monumental-unavailable"}>{failed ? "The relief could not load. The rest of Kind Helps is still available." : "The sculpted relief is being prepared."}</p>}
  </div>;
}
