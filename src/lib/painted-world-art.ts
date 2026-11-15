import type { PaintedWorldOptions } from "./painted-world-controller";

/** Original paintings and their separately authored foreground/environment plates. */
export const paintedWorldArt: NonNullable<PaintedWorldOptions["scenes"]> = {
  meal: {
    src: "/assets/painted-world/meal-background.webp",
    mobileSrc: "/assets/painted-world/meal-mobile-background.webp",
    mobileLayers: [{ src: "/assets/painted-world/meal-mobile-foreground.webp", fit: "artwork", depth: 0.7 }],
    completedSrc: "/assets/painted-world/meal-shared.webp",
    mobileCompletedSrc: "/assets/painted-world/meal-shared-mobile.webp",
    layers: [{ src: "/assets/painted-world/meal-foreground.webp", fit: "artwork", depth: 0.7 }],
    anchors: {
      desktop: { bowlStart: [0.61, 0.87], bowlTarget: [0.70, 0.82], bowlScale: 0.92 },
      mobile: { bowlStart: [0.82, 0.64], bowlTarget: [0.56, 0.64], bowlScale: 0.8 },
    },
  },
  visit: {
    src: "/assets/painted-world/visit-background.webp",
    mobileSrc: "/assets/painted-world/visit-mobile-background.webp",
    mobileLayers: [{ src: "/assets/painted-world/visit-mobile-foreground.webp", fit: "artwork", depth: 0.7 }],
    layers: [{ src: "/assets/painted-world/visit-foreground.webp", fit: "artwork", depth: 0.7 }],
    showBowl: false,
    anchors: {
      desktop: { doorCenter: [0.70, 0.50], doorScale: 1.90 },
      mobile: { doorCenter: [0.62, 0.55], doorScale: 1.50 },
    },
  },
  welcome: {
    src: "/assets/painted-world/welcome-background.webp",
    mobileSrc: "/assets/painted-world/welcome-mobile-background.webp",
    mobileLayers: [{ src: "/assets/painted-world/welcome-mobile-foreground.webp", fit: "artwork", depth: 0.7 }],
    layers: [{ src: "/assets/painted-world/welcome-foreground.webp", fit: "artwork", depth: 0.9 }],
    showBowl: false,
    anchors: { desktop: { doorCenter: [0.56, 0.5], doorScale: 2.8 }, mobile: { doorCenter: [0.5, 0.5], doorScale: 1.5 } },
  },
  complete: {
    src: "/assets/painted-world/welcome-background.webp",
    mobileSrc: "/assets/painted-world/welcome-mobile-background.webp",
    mobileLayers: [{ src: "/assets/painted-world/welcome-mobile-foreground.webp", fit: "artwork", depth: 0.7 }],
    layers: [{ src: "/assets/painted-world/welcome-foreground.webp", fit: "artwork", depth: 0.9 }],
    showBowl: false,
  },
};
