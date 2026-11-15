import reliefManifest from "../../public/assets/living-relief-manifest.json";

export type ArtworkView = "group" | "person" | "exchange" | "preparation";
export type ArtworkCamera = {
  position: readonly [number, number, number] | readonly number[];
  target: readonly [number, number, number] | readonly number[];
  orthoHeight: number;
  orthoWidth?: number;
};
type ArtworkTransform = {
  position: readonly number[];
  rotation?: readonly number[];
  scale?: readonly number[];
};
export type ArtworkDefinition = {
  roots?: Record<string, { desktop: ArtworkTransform; mobile: ArtworkTransform }>;
  model: string;
  narrowBreakpoint?: number;
  mobileBreakpoint?: number;
  layout: "relief" | "cast";
  cameras: Record<ArtworkView, ArtworkCamera>;
  mobileCameras: Record<ArtworkView, ArtworkCamera>;
  posters: {
    rest: { desktop: string; mobile: string; narrow: string };
    accepted: { desktop: string; mobile: string; narrow: string };
  };
  descriptions: { rest: string; accepted: string };
};

/** A complete asset set keeps live poses and fallback stills from different exports apart. */
export const reliefArtwork: ArtworkDefinition = {
  model: "/assets/living-relief.glb",
  layout: "relief",
  cameras: reliefManifest.cameras,
  mobileCameras: reliefManifest.mobileCameras,
  posters: {
    rest: {
      desktop: "/assets/living-relief-poster.webp",
      mobile: "/assets/living-relief-mobile.webp",
      narrow: "/assets/living-relief-narrow.webp",
    },
    accepted: {
      desktop: "/assets/living-relief-accepted.webp",
      mobile: "/assets/living-relief-mobile-accepted.webp",
      narrow: "/assets/living-relief-narrow-accepted.webp",
    },
  },
  descriptions: {
    rest: "Painted community portraits surround two hands offering a folded paper, an invitation to help.",
    accepted: "Painted community portraits remain together as the volunteering guide rests in the hand of the person who accepted the responsibility.",
  },
};

const finiteVector = (value: readonly number[]) =>
  value.length === 3 && value.every(Number.isFinite);

/** Validate authored camera data before it reaches Three.js matrices. */
export function validArtworkFraming(artwork: ArtworkDefinition): boolean {
  const views: ArtworkView[] = ["group", "person", "exchange", "preparation"];
  return [artwork.cameras, artwork.mobileCameras].every((cameras) =>
    views.every((view) => {
      const camera = cameras[view];
      return Boolean(camera) && finiteVector(camera.position) &&
        finiteVector(camera.target) && Number.isFinite(camera.orthoHeight) &&
        camera.orthoHeight > 0 &&
        (camera.orthoWidth === undefined ||
          (Number.isFinite(camera.orthoWidth) && camera.orthoWidth > 0));
    }),
  ) && Object.values(artwork.roots ?? {}).every((root) =>
    [root.desktop, root.mobile].every((transform) =>
      finiteVector(transform.position) &&
      (!transform.rotation || finiteVector(transform.rotation)) &&
      (!transform.scale || finiteVector(transform.scale)),
    ),
  );
}
