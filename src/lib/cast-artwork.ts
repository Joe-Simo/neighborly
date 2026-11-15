import manifest from "../../public/assets/cast-handoff-v4-manifest.json";
import type { ArtworkDefinition } from "./artwork";

/** Matched model, authored framing and fallback stills from the same Blender export. */
export const castArtwork: ArtworkDefinition = { ...manifest, layout: "cast", mobileBreakpoint: 1023 };
