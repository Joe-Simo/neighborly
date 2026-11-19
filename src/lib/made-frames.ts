import run from "../../eval/frames/made-scroll.json";

/** The two ways the page was filmed on the Mac: at desk width, and at phone width with the processor slowed four times. */
export const frameWidths = ["1440", "390"] as const;

/** The bar every change is held to: 33 ms, two refreshes at 60 Hz. A frame that took two refreshes (33.3 ms measured) is on time, as the recorder counts it. */
export const lateMs = 33;
export const late = (ms: number) => ms > lateMs + 0.4;

const summary = (all: number[]) => {
  const sorted = [...all].sort((a, b) => a - b);
  return { frames: all.length, over: all.filter(late).length, worst: sorted.at(-1) ?? 0, median: sorted[Math.floor(sorted.length / 2)] ?? 0 };
};

/** A scroll down this page on the Mac, frame by frame, from the recorder's own file: every number on the page is counted from it here. */
export const madeFrames = {
  // The recorder writes the build as "e4eacc3 (main + the patches on it)"; the page names the build itself.
  commit: run.commit.split(" ")[0],
  day: run.date,
  machine: run.machine,
  widths: frameWidths.map((width) => ({ width, all: run[width].all, ...summary(run[width].all) })),
};
