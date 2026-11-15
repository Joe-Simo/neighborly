"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { Object3D } from "three";
import type { ReliefOutcome } from "@/lib/relief-playback";
import { reliefArtwork, validArtworkFraming, type ArtworkDefinition, type ArtworkView } from "@/lib/artwork";

const subscribe = () => () => {};
const forceStill = () =>
  new URLSearchParams(window.location.search).has("noWebGL");

export type ReliefView = ArtworkView;

type Props = {
  artwork?: ArtworkDefinition;
  view?: ReliefView;
  outcome: ReliefOutcome;
  paused: boolean;
  ready: boolean;
  onReadyChange: (ready: boolean) => void;
  attempt: number;
  isHero: boolean;
  posterAttempt: number;
  onPosterStatusChange: (key: string, failed: boolean) => void;
  guideAnchor?: RefObject<HTMLButtonElement | null>;
  paperOpen?: boolean;
  paperHovered?: boolean;
  onPaperReadyChange?: (ready: boolean) => void;
};

export function useStillArtwork() {
  return useSyncExternalStore(subscribe, forceStill, () => false);
}

/** One on-demand renderer for the authored Blender artwork. Product state owns the pose. */
export function ReliefStage({
  artwork = reliefArtwork,
  outcome,
  paused,
  view = "group",
  ready,
  onReadyChange,
  attempt,
  isHero,
  posterAttempt,
  onPosterStatusChange,
  guideAnchor,
  paperOpen = false,
  paperHovered = false,
  onPaperReadyChange,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ outcome, paused, view, isHero, paperOpen, paperHovered, onPaperReadyChange });
  const sync = useRef<() => void>(() => {});

  useEffect(() => {
    latest.current = { outcome, paused, view, isHero, paperOpen, paperHovered, onPaperReadyChange };
    sync.current();
  }, [outcome, paused, view, isHero, paperOpen, paperHovered, onPaperReadyChange]);

  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (outcome !== "pending" || saveData) return;
    const image = new Image();
    const posters = artwork.posters.accepted;
    image.src = matchMedia(`(max-width:${artwork.narrowBreakpoint ?? 420}px)`).matches
      ? posters.narrow
      : matchMedia(`(max-width:${artwork.mobileBreakpoint ?? 700}px)`).matches ? posters.mobile : posters.desktop;
  }, [outcome, artwork]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!validArtworkFraming(artwork)) {
      onReadyChange(false);
      return;
    }
    onReadyChange(false);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection?.saveData;
    if (
      new URLSearchParams(location.search).has("noWebGL") ||
      (saveData && attempt === 0)
    )
      return;
    let disposed = false;
    let cleanup = () => {};
    const entry = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      entry.disconnect();
      void Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("@/lib/relief-playback"),
        import("@/lib/paper-lift"),
        artwork.layout === "cast"
          ? import("three/addons/libs/meshopt_decoder.module.js")
          : Promise.resolve(null),
      ])
        .then(([T, { GLTFLoader }, { createReliefPlayback }, { createPaperLift }, meshopt]) => {
          if (disposed) return;
          let renderer: InstanceType<typeof T.WebGLRenderer>;
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
          renderer.outputColorSpace = T.SRGBColorSpace;
          renderer.toneMapping = T.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.05;
          renderer.shadowMap.enabled = artwork.layout === "cast";
          renderer.shadowMap.type = T.PCFShadowMap;
          renderer.domElement.setAttribute("aria-hidden", "true");
          renderer.domElement.style.visibility = "hidden";
          element.appendChild(renderer.domElement);

          const scene = new T.Scene();
          const camera = new T.OrthographicCamera(
            -7.2,
            7.2,
            10.24,
            0,
            0.1,
            100,
          );
          scene.add(new T.HemisphereLight(0xffffff, 0xb3aaa3, 2));
          const key = new T.DirectionalLight(0xfff6e5, 2);
          key.position.set(-5, 8, 12);
          if (artwork.layout === "cast") key.position.set(-3, 7, 5);
          key.castShadow = artwork.layout === "cast";
          key.shadow.mapSize.set(1024, 1024);
          key.shadow.camera.left = -5;
          key.shadow.camera.right = 5;
          key.shadow.camera.top = 5;
          key.shadow.camera.bottom = -5;
          key.shadow.normalBias = 0.01;
          key.shadow.radius = 5;
          scene.add(key);
          if (artwork.layout === "cast") {
            const floor = new T.Mesh(
              new T.PlaneGeometry(200, 200),
              new T.ShadowMaterial({ opacity: 0.12 }),
            );
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.002;
            floor.receiveShadow = true;
            scene.add(floor);
          }
          const paper = createPaperLift();
          const paperAnchor = { x: 0, y: 0 };
          let guideHover = 0;
          const originalGuidePosition = new T.Vector3();
          const originalGuideRotation = new T.Quaternion();
          let model: Object3D | undefined;
          let playback: ReturnType<typeof createReliefPlayback> | undefined;
          let visible = true;
          let contextLost = false;
          let frame = 0;
          let last = 0;
          let reduce = media.matches;
          let published = false;
          // Keep the authored camera and lighting as the exact neutral state.
          const response = new T.Vector2();
          const responseTarget = new T.Vector2();
          const neutralLight = key.position.clone();
          const renderPosition = new T.Vector3();
          const guidePosition = new T.Vector3();
          const cameraLook = new T.Vector3();
          const cameraDestination = new T.Vector3();
          const lookDestination = new T.Vector3();
          const cameraOrigin = new T.Vector3();
          const lookOrigin = new T.Vector3();
          let cameraSpan = 0;
          let spanOrigin = 0;
          let spanDestination = 0;
          let cameraAspect = 1;
          let cameraProgress = 1;
          let viewportWidth = 0;
          let viewportHeight = 0;
          let mobileFraming: boolean | undefined;
          const refreshVisibility = () => {
            // The same host is reparented between hero and story. An observer
            // entry can describe its former location until the next delivery.
            const bounds = element.getBoundingClientRect();
            visible = bounds.width > 0 && bounds.height > 0 &&
              bounds.bottom > 0 && bounds.top < window.innerHeight &&
              bounds.right > 0 && bounds.left < window.innerWidth;
          };

          const updateCamera = () => {
            camera.left = (-cameraSpan * cameraAspect) / 2;
            camera.right = (cameraSpan * cameraAspect) / 2;
            camera.top = cameraSpan / 2;
            camera.bottom = -cameraSpan / 2;
            camera.lookAt(cameraLook);
            camera.updateProjectionMatrix();
          };
          const settleCamera = () => {
            cameraProgress = 1;
            camera.position.copy(cameraDestination);
            cameraLook.copy(lookDestination);
            cameraSpan = spanDestination;
            updateCamera();
          };

          const draw = (now: number) => {
            frame = 0;
            if (disposed || contextLost || (!visible && !paper.active && !latest.current.paperOpen) || document.hidden) return;
            const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
            last = now;
            playback?.advance(dt);
            if (cameraProgress < 1) {
              if (reduce || latest.current.paused) settleCamera();
              else {
                cameraProgress = Math.min(1, cameraProgress + dt / 0.85);
                // Smooth acceleration/deceleration, with exact endpoints and no idle RAF.
                const blend = cameraProgress * cameraProgress * (3 - 2 * cameraProgress);
                camera.position.lerpVectors(cameraOrigin, cameraDestination, blend);
                cameraLook.lerpVectors(lookOrigin, lookDestination, blend);
                cameraSpan = T.MathUtils.lerp(spanOrigin, spanDestination, blend);
                updateCamera();
              }
            }
            if (reduce || latest.current.paused) {
              response.set(0, 0);
              responseTarget.set(0, 0);
            } else {
              response.lerp(responseTarget, 1 - Math.exp(-12 * dt));
              if (response.distanceToSquared(responseTarget) < 0.000001)
                response.copy(responseTarget);
            }
            // Tiny camera-angle changes reveal existing relief, never deform pigment.
            // Restore the base transform after rendering so retargeting stays authored.
            renderPosition.copy(camera.position);
            camera.position.x += response.x * 0.12;
            camera.position.y += response.y * 0.08;
            camera.lookAt(cameraLook);
            key.position.copy(neutralLight);
            key.position.x += response.x * 0.5;
            key.position.y += response.y * 0.3;
            const guide = model?.getObjectByName("Guide");
            const hoverTarget = latest.current.paperHovered && !latest.current.paperOpen && !reduce && !latest.current.paused ? 1 : 0;
            if (reduce || latest.current.paused) guideHover = 0;
            else guideHover += (hoverTarget - guideHover) * (1 - Math.exp(-16 * dt));
            if (Math.abs(guideHover - hoverTarget) < 0.001) guideHover = hoverTarget;
            if (guide) {
              originalGuidePosition.copy(guide.position);
              originalGuideRotation.copy(guide.quaternion);
              guide.position.y += guideHover * 0.035;
              guide.rotateZ(guideHover * 0.025);
              guide.updateWorldMatrix(true, true);
            }
            const guideVisibility: Array<{ object: Object3D; visible: boolean }> = [];
            if (paper.active || latest.current.paperOpen) model?.traverse((object) => {
              if (/^Role[ _]guide[ _]/.test(object.name)) {
                guideVisibility.push({ object, visible: object.visible });
                object.visible = false;
              }
            });
            renderer.render(scene, camera);
            for (const entry of guideVisibility) entry.object.visible = entry.visible;
            if (guide) {
              guide.getWorldPosition(guidePosition).project(camera);
              paperAnchor.x = (guidePosition.x + 1) * viewportWidth / 2;
              paperAnchor.y = (1 - guidePosition.y) * viewportHeight / 2;
            }
            if (guide && guideAnchor?.current) {
              guide.getWorldPosition(guidePosition).project(camera);
              const bounds = element.getBoundingClientRect();
              const parentBounds = guideAnchor.current.offsetParent?.getBoundingClientRect();
              guideAnchor.current.style.left = `${(guidePosition.x + 1) * viewportWidth / 2 + bounds.left - (parentBounds?.left ?? 0)}px`;
              guideAnchor.current.style.top = `${(1 - guidePosition.y) * viewportHeight / 2 + bounds.top - (parentBounds?.top ?? 0)}px`;
            }
            paper.set(latest.current.paperOpen, latest.current.paperHovered,
              (value) => latest.current.onPaperReadyChange?.(value));
            const paperWasActive = paper.active;
            const paperMoving = paper.draw(renderer, dt, element.getBoundingClientRect(), paperAnchor, reduce || latest.current.paused);
            if (guide) {
              guide.position.copy(originalGuidePosition);
              guide.quaternion.copy(originalGuideRotation);
              guide.updateWorldMatrix(true, true);
            }
            camera.position.copy(renderPosition);
            camera.lookAt(cameraLook);
            if (model && !published) {
              published = true;
              renderer.domElement.style.visibility = "visible";
              onReadyChange(true);
            }
            if (playback?.isRunning() || cameraProgress < 1 || !response.equals(responseTarget) || paperMoving || (paperWasActive && !paper.active) || guideHover !== hoverTarget)
              frame = requestAnimationFrame(draw);
          };
          const wake = () => {
            if (
              !frame &&
              (visible || latest.current.paperOpen || paper.active) &&
              !document.hidden &&
              !contextLost &&
              !disposed
            ) {
              last = 0;
              frame = requestAnimationFrame(draw);
            }
          };
          const resetResponse = () => {
            responseTarget.set(0, 0);
            wake();
          };
          const onPointer = (event: PointerEvent) => {
            if (reduce || latest.current.paused || !event.isPrimary) return;
            const bounds = element.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            responseTarget.set(
              T.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1),
              T.MathUtils.clamp(1 - (event.clientY - bounds.top) / bounds.height * 2, -1, 1),
            );
            wake();
          };
          element.addEventListener("pointermove", onPointer, { passive: true });
          element.addEventListener("pointerleave", resetResponse);
          element.addEventListener("pointercancel", resetResponse);
          // Touch ends return to neutral; native scrolling remains untouched.
          const onPointerUp = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") resetResponse();
          };
          element.addEventListener("pointerup", onPointerUp);
          const resize = (snap = false) => {
            const width = element.clientWidth;
            const height = element.clientHeight;
            if (!width || !height) return;
            refreshVisibility();
            const mobile = window.innerWidth <= (artwork.mobileBreakpoint ?? 700);
            const narrow = window.innerWidth <= 420;
            const aspect = width / height;
            const artworkWidth = mobile ? 7.8 : 14.4;
            const artworkHeight = mobile ? 16.88 : 10.24;
            const framing = (
              mobile ? artwork.mobileCameras : artwork.cameras
            )[latest.current.view];
            const frameHeight = Math.max(framing.orthoHeight, (framing.orthoWidth ?? 0) / aspect);
            const targetX =
              framing.target[0] + (artwork.layout === "relief" && narrow && latest.current.isHero ? 0.3 : 0);
            const span = artwork.layout === "cast" ? frameHeight : Math.min(
              frameHeight,
              (artworkWidth - 2 * Math.abs(targetX)) / aspect,
            );
            const targetY = artwork.layout === "cast" ? framing.target[1] : Math.min(
              artworkHeight - span / 2,
              Math.max(span / 2, framing.target[1]),
            );
            const position = new T.Vector3(
              framing.position[0] + targetX - framing.target[0],
              framing.position[1] + targetY - framing.target[1],
              framing.position[2],
            );
            const look = new T.Vector3(targetX, targetY, framing.target[2]);
            const viewportChanged = width !== viewportWidth || height !== viewportHeight || mobile !== mobileFraming;
            const destinationChanged = cameraDestination.distanceToSquared(position) > 1e-10 ||
              lookDestination.distanceToSquared(look) > 1e-10 || Math.abs(spanDestination - span) > 1e-6;
            cameraAspect = aspect;
            if (destinationChanged || viewportChanged || snap || reduce || latest.current.paused) {
              cameraOrigin.copy(camera.position);
              lookOrigin.copy(cameraLook);
              spanOrigin = cameraSpan;
              cameraDestination.copy(position);
              lookDestination.copy(look);
              spanDestination = span;
              if (snap || viewportChanged || !published || reduce || latest.current.paused)
                settleCamera();
              else cameraProgress = 0;
            }
            viewportWidth = width;
            viewportHeight = height;
            mobileFraming = mobile;
            if (artwork.layout === "relief") {
              model?.getObjectByName("BackgroundDesktop")?.traverse((object) => {
                object.visible = !mobile;
              });
              model?.getObjectByName("BackgroundMobile")?.traverse((object) => {
                object.visible = mobile && !narrow;
              });
              model?.getObjectByName("BackgroundNarrow")?.traverse((object) => {
                object.visible = narrow;
              });
              const rig = model?.getObjectByName("ReliefRig");
              if (rig) {
                rig.scale.setScalar(mobile ? 0.54 : 1);
                rig.position.set(0, mobile ? 4 : 0, 0);
              }
            }
            for (const [name, transforms] of Object.entries(artwork.roots ?? {})) {
              const root = model?.getObjectByName(name);
              if (!root) continue;
              const transform = transforms[mobile ? "mobile" : "desktop"];
              root.position.fromArray(transform.position);
              const rotation = transform.rotation ?? [0, 0, 0];
              root.rotation.set(rotation[0], rotation[1], rotation[2]);
              root.scale.fromArray(transform.scale ?? [1, 1, 1]);
            }
            if (viewportChanged) renderer.setSize(width, height);
            wake();
          };
          const apply = (restore = false) => {
            if (!playback) return;
            resize(restore);
            playback.apply(
              latest.current.outcome,
              latest.current.paused,
              reduce,
              restore,
            );
            wake();
          };
          sync.current = apply;
          const onPreference = () => {
            reduce = media.matches;
            apply();
          };
          const onVisibility = () => {
            if (document.hidden) {
              response.set(0, 0);
              responseTarget.set(0, 0);
            }
            if (document.hidden && frame) {
              cancelAnimationFrame(frame);
              frame = 0;
            } else wake();
          };
          const onLost = () => {
            contextLost = true;
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            renderer.domElement.style.visibility = "hidden";
            onReadyChange(false);
          };
          const observer = new IntersectionObserver(() => {
            refreshVisibility();
            if (!visible) {
              response.set(0, 0);
              responseTarget.set(0, 0);
            }
            if (!visible && !paper.active && frame) {
              cancelAnimationFrame(frame);
              frame = 0;
            } else wake();
          });
          observer.observe(element);
          const size = new ResizeObserver(() => resize(true));
          size.observe(element);
          media.addEventListener("change", onPreference);
          document.addEventListener("visibilitychange", onVisibility);
          renderer.domElement.addEventListener("webglcontextlost", onLost);
          resize();
          const loader = new GLTFLoader();
          if (meshopt) loader.setMeshoptDecoder(meshopt.MeshoptDecoder);
          loader.load(
            artwork.model,
            (gltf) => {
              if (disposed) return;
              scene.add(gltf.scene);
              if (artwork.layout === "cast" &&
                !["rest", "settle", "pending", "accepted", "declined"].every(
                  (name) => gltf.animations.some((clip) => clip.name === name),
                )) {
                onReadyChange(false);
                return;
              }
              model = gltf.scene;
              if (artwork.layout === "cast") model.traverse((object) => {
                if (object instanceof T.Mesh) {
                  object.castShadow = true;
                  object.receiveShadow = true;
                }
              });
              playback = createReliefPlayback(
                new T.AnimationMixer(model),
                gltf.animations,
              );
              resize();
              apply(true);
            },
            undefined,
            () => {
              renderer.domElement.style.visibility = "hidden";
              onReadyChange(false);
            },
          );
          cleanup = () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            size.disconnect();
            element.removeEventListener("pointermove", onPointer);
            element.removeEventListener("pointerleave", resetResponse);
            element.removeEventListener("pointercancel", resetResponse);
            element.removeEventListener("pointerup", onPointerUp);
            media.removeEventListener("change", onPreference);
            document.removeEventListener("visibilitychange", onVisibility);
            renderer.domElement.removeEventListener("webglcontextlost", onLost);
            playback?.stop();
            paper.dispose();
            scene.traverse((object) => {
              if (object instanceof T.Mesh) {
                object.geometry.dispose();
                for (const material of Array.isArray(object.material)
                  ? object.material
                  : [object.material]) {
                  if (material instanceof T.MeshStandardMaterial) {
                    material.map?.dispose();
                    material.alphaMap?.dispose();
                    material.normalMap?.dispose();
                  }
                  material.dispose();
                }
              }
            });
            renderer.dispose();
            renderer.domElement.remove();
            sync.current = () => {};
          };
        })
        .catch(() => onReadyChange(false));
    });
    entry.observe(element);
    return () => {
      disposed = true;
      entry.disconnect();
      cleanup();
    };
  }, [attempt, onReadyChange, artwork, guideAnchor]);

  return (
    <div
      className="relief-stage"
      data-artwork={artwork.layout}
      data-ready={ready}
      data-view={view}
      role={ready ? "img" : undefined}
      aria-label={ready
        ? outcome === "accepted"
          ? artwork.descriptions.accepted
          : artwork.descriptions.rest
        : undefined}
    >
      <ReliefPoster
        artwork={artwork}
        outcome={outcome}
        hidden={ready}
        ariaHidden={ready}
        attempt={posterAttempt}
        onStatusChange={onPosterStatusChange}
      />
      <div className="relief-canvas" ref={host} />
    </div>
  );
}

export function ReliefPoster({
  artwork = reliefArtwork,
  outcome,
  hidden = false,
  ariaHidden = false,
  attempt = 0,
  onStatusChange,
}: {
  artwork?: ArtworkDefinition;
  outcome: ReliefOutcome;
  hidden?: boolean;
  ariaHidden?: boolean;
  attempt?: number;
  onStatusChange?: (key: string, failed: boolean) => void;
}) {
  const accepted = outcome === "accepted";
  const imageKey = `${accepted ? "accepted" : "rest"}:${attempt}`;
  const { desktop, mobile, narrow } = artwork.posters[accepted ? "accepted" : "rest"];
  const description = artwork.descriptions[accepted ? "accepted" : "rest"];
  return (
    <PosterImage
      key={`${artwork.model}:${imageKey}`}
      imageKey={imageKey}
      desktop={desktop}
      mobile={mobile}
      narrow={narrow}
      description={description}
      narrowBreakpoint={artwork.narrowBreakpoint ?? 420}
      mobileBreakpoint={artwork.mobileBreakpoint ?? 700}
      hidden={hidden}
      ariaHidden={ariaHidden}
      onStatusChange={onStatusChange}
    />
  );
}

function PosterImage({ desktop, mobile, narrow, description, narrowBreakpoint, mobileBreakpoint, hidden, ariaHidden, imageKey, onStatusChange }: {
  desktop: string;
  mobile: string;
  narrow: string;
  description: string;
  narrowBreakpoint: number;
  mobileBreakpoint: number;
  hidden: boolean;
  ariaHidden: boolean;
  imageKey: string;
  onStatusChange?: (key: string, failed: boolean) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image?.complete) return;

    const failed = image.naturalWidth === 0;
    setStatus(failed ? "error" : "ready");
    onStatusChange?.(imageKey, failed);
  }, [imageKey, onStatusChange]);

  return (
    <picture className="relief-poster" style={{ opacity: hidden ? 0 : 1 }}>
      <source media={`(max-width:${narrowBreakpoint}px)`} srcSet={narrow} />
      <source media={`(max-width:${mobileBreakpoint}px)`} srcSet={mobile} />
      <img
        ref={imageRef}
        src={desktop}
        style={{ opacity: status === "error" ? 0 : 1 }}
        onLoad={() => {
          setStatus("ready");
          onStatusChange?.(imageKey, false);
        }}
        onError={() => {
          setStatus("error");
          onStatusChange?.(imageKey, true);
        }}
        aria-hidden={ariaHidden || undefined}
        alt={
          hidden ? "" : status === "error"
            ? "Illustration unavailable."
            : status === "loading"
              ? "Illustration loading."
              : description
        }
      />
    </picture>
  );
}
