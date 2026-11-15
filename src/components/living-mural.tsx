"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";
import type { AnimationClip, AnimationAction } from "three";
import authoredCameras from "../../art/camera-presets.json";
import { needsMuralFrame } from "@/lib/mural-playback";
const visibilityRuntimes = new Map<
  symbol,
  { ratio: number; activate: (active: boolean) => void }
>();
function chooseVisibleMural() {
  let chosen: symbol | undefined;
  let ratio = 0;
  for (const [key, runtime] of visibilityRuntimes)
    if (runtime.ratio > ratio) {
      chosen = key;
      ratio = runtime.ratio;
    }
  for (const [key, runtime] of visibilityRuntimes)
    runtime.activate(key === chosen);
}
const subscribeFallback = () => () => {};
const forcedFallbackSnapshot = () =>
  new URLSearchParams(window.location.search).has("noWebGL");
export type MuralView = keyof typeof authoredCameras.desktop;
type Outcome = "rest" | "pending" | "accepted" | "declined";
export function LivingMural({
  view = "group",
  outcome = "rest",
  paused = false,
  onPausedChange,
}: {
  view?: MuralView;
  outcome?: Outcome;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{ sync: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const forcedFallback = useSyncExternalStore(
    subscribeFallback,
    forcedFallbackSnapshot,
    () => false,
  );
  const latest = useRef({ view, outcome, paused });
  useEffect(() => {
    latest.current = { view, outcome, paused };
    controls.current?.sync();
  }, [view, outcome, paused]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = reduced.matches;
    const saveData = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection?.saveData;
    if (new URLSearchParams(location.search).has("noWebGL")) return;
    if (saveData && !optIn) return;
    let firstVisibility: IntersectionObserver | undefined;
    const whenVisible = new Promise<void>((resolve) => {
      firstVisibility = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          firstVisibility?.disconnect();
          resolve();
        }
      });
      firstVisibility.observe(el);
    });
    whenVisible
      .then(() =>
        Promise.all([
          import("three"),
          import("three/addons/loaders/GLTFLoader.js"),
        ]),
      )
      .then(([T, { GLTFLoader }]) => {
        if (disposed) return;
        let renderer: InstanceType<typeof T.WebGLRenderer>;
        let contextUnavailable = false;
        try {
          renderer = new T.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
          });
        } catch {
          return;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFShadowMap;
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute("aria-hidden", "true");
        const scene = new T.Scene();
        const initialCamera = authoredCameras.desktop.group;
        const camera = new T.PerspectiveCamera(initialCamera.fov, 1, 0.1, 100);
        const target = new T.Vector3().fromArray(initialCamera.target);
        const destination = new T.Vector3().fromArray(initialCamera.position);
        camera.position.copy(destination);
        camera.lookAt(target);
        scene.add(new T.HemisphereLight(0xffffff, 0xaaa4b5, 3.0));
        const light = new T.DirectionalLight(0xfff5e4, 2.2);
        light.position.set(-3, 7, 5);
        light.castShadow = true;
        light.shadow.mapSize.set(2048, 2048);
        light.shadow.normalBias = 0.025;
        light.shadow.bias = -0.0001;
        light.shadow.radius = 4;
        scene.add(light);
        const plane = new T.Mesh(
          new T.PlaneGeometry(200, 200),
          new T.ShadowMaterial({ opacity: 0.085 }),
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.012;
        plane.receiveShadow = true;
        scene.add(plane);
        let mixer: InstanceType<typeof T.AnimationMixer> | undefined;
        let clips: AnimationClip[] = [];
        let activeAction: AnimationAction | undefined;
        let visible = false;
        let active = false;
        let modelReady = false;
        let publishedReady = false;
        const runtimeKey = Symbol("mural");
        let frame = 0;
        let last = performance.now();
        let activeOutcome = "";
        let settlingUntil = 0;
        function positionFor() {
          const presets =
            el!.clientWidth < authoredCameras.mobileBreakpoint
              ? authoredCameras.mobile
              : authoredCameras.desktop;
          const preset = presets[latest.current.view];
          destination.fromArray(preset.position);
          target.fromArray(preset.target);
          if (camera.fov !== preset.fov) {
            camera.fov = preset.fov;
            camera.updateProjectionMatrix();
          }
          if (reduceMotion) {
            camera.position.copy(destination);
            camera.lookAt(target);
          }
        }
        function draw(now: number) {
          frame = 0;
          if (disposed || contextUnavailable || !visible || !active) return;
          const dt = Math.min((now - last) / 1000, 0.04);
          last = now;
          camera.position.lerp(destination, 1 - Math.exp(-dt * 4));
          camera.lookAt(target);
          if (!latest.current.paused && !reduceMotion) mixer?.update(dt);
          renderer.render(scene, camera);
          if (modelReady && !publishedReady) {
            publishedReady = true;
            setReady(true);
          }
          if (
            needsMuralFrame(
              now,
              settlingUntil,
              Boolean(activeAction?.isRunning()),
              latest.current.paused,
              reduceMotion,
            )
          )
            frame = requestAnimationFrame(draw);
        }
        function wake(duration = 1000) {
          if (contextUnavailable) return;
          const remaining =
            activeAction && !latest.current.paused && !reduceMotion
              ? Math.max(
                  0,
                  activeAction.getClip().duration - activeAction.time,
                ) * 1000
              : 0;
          settlingUntil = Math.max(
            settlingUntil,
            performance.now() + Math.max(duration, remaining + 100),
          );
          if (visible && active && !frame) {
            last = performance.now();
            frame = requestAnimationFrame(draw);
          }
        }
        function sync() {
          positionFor();
          if (
            mixer &&
            (activeOutcome !== latest.current.outcome || reduceMotion)
          ) {
            const arrival =
              activeOutcome === "" &&
              latest.current.outcome === "rest" &&
              !reduceMotion &&
              !latest.current.paused;
            activeOutcome = latest.current.outcome;
            const name = arrival
              ? "settle"
              : activeOutcome === "accepted"
                ? "accepted"
                : activeOutcome === "declined"
                  ? "decline"
                  : activeOutcome === "pending"
                    ? "attend"
                    : "rest";
            const clip = clips.find((c) => c.name === name);
            if (clip) {
              mixer.stopAllAction();
              const action = mixer.clipAction(clip);
              activeAction = action;
              action.reset();
              action.setLoop(T.LoopOnce, 1);
              action.clampWhenFinished = true;
              action.play();
              if (reduceMotion || latest.current.paused)
                mixer.update(clip.duration);
              wake(Math.max(1000, clip.duration * 1000 + 100));
            }
          }
          if (latest.current.paused && activeAction && mixer) {
            activeAction.time = activeAction.getClip().duration;
            mixer.update(0);
          }
          wake();
        }
        controls.current = { sync };
        const runtime = {
          ratio: 0,
          activate(value: boolean) {
            if (active === value) return;
            active = value;
            if (active) wake();
            else if (frame) {
              cancelAnimationFrame(frame);
              frame = 0;
            }
          },
        };
        visibilityRuntimes.set(runtimeKey, runtime);
        const observer = new IntersectionObserver(
          (entries) => {
            visible = entries[0].isIntersecting;
            runtime.ratio = visible ? entries[0].intersectionRatio : 0;
            chooseVisibleMural();
          },
          { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
        );
        observer.observe(el);
        const resize = new ResizeObserver(() => {
          renderer.setSize(el!.clientWidth, el!.clientHeight);
          camera.aspect = el!.clientWidth / el!.clientHeight;
          camera.updateProjectionMatrix();
          positionFor();
          wake();
        });
        resize.observe(el);
        const preference = () => {
          reduceMotion = reduced.matches;
          sync();
        };
        reduced.addEventListener("change", preference);
        const contextLost = () => {
          contextUnavailable = true;
          setReady(false);
          runtime.ratio = 0;
          chooseVisibleMural();
          if (frame) cancelAnimationFrame(frame);
        };
        renderer.domElement.addEventListener("webglcontextlost", contextLost);
        new GLTFLoader().load(
          "/assets/neighborly.glb",
          (gltf) => {
            if (disposed) return;
            scene.add(gltf.scene);
            gltf.scene.traverse((obj) => {
              if (obj instanceof T.Mesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
              }
            });
            clips = gltf.animations;
            mixer = new T.AnimationMixer(gltf.scene);
            modelReady = true;
            sync();
          },
          undefined,
          () => setReady(false),
        );
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          visibilityRuntimes.delete(runtimeKey);
          chooseVisibleMural();
          resize.disconnect();
          reduced.removeEventListener("change", preference);
          mixer?.stopAllAction();
          scene.traverse((obj) => {
            if (obj instanceof T.Mesh) {
              obj.geometry.dispose();
              (Array.isArray(obj.material)
                ? obj.material
                : [obj.material]
              ).forEach((m) => m.dispose());
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
          controls.current = null;
        };
      })
      .catch(() => setReady(false));
    return () => {
      disposed = true;
      firstVisibility?.disconnect();
      cleanup();
    };
  }, [optIn, attempt]);

  return (
    <div className="scene">
      <picture style={{ opacity: ready ? 0 : 1 }}>
        <source
          media="(max-width: 600px)"
          srcSet={
            outcome === "accepted"
              ? "/assets/mural-mobile-accepted.webp"
              : "/assets/mural-mobile.webp"
          }
        />
        <img
          className="scene-poster"
          src={
            outcome === "accepted"
              ? "/assets/mural-accepted.webp"
              : "/assets/mural-poster.webp"
          }
          alt={
            outcome === "accepted"
              ? "Noor receives the role guide after accepting one Sunday; Grace remains with the team."
              : "Grace, Noor, and their coordinator stand together, with the folded role guide ready."
          }
        />
      </picture>
      <div
        ref={host}
        style={{
          position: "absolute",
          inset: 0,
          visibility: ready ? "visible" : "hidden",
        }}
      />
      {ready && onPausedChange && (
        <div className="scene-controls">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPausedChange?.(!paused)}
            aria-pressed={paused}
          >
            {paused ? (
              <Play data-icon="inline-start" />
            ) : (
              <Pause data-icon="inline-start" />
            )}
            {paused ? "Resume motion" : "Pause motion"}
          </Button>
        </div>
      )}
      {!ready && !forcedFallback && (
        <div className="scene-controls">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOptIn(true);
              setAttempt((value) => value + 1);
            }}
          >
            Load interactive artwork
          </Button>
        </div>
      )}
    </div>
  );
}
