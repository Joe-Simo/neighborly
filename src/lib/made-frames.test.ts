import { expect, test } from "bun:test";
import run from "../../eval/frames/made-scroll.json";
import { madeFrames, frameWidths } from "./made-frames";

test("the frame strip counts the recorder's file the way the recorder did", () => {
  for (const width of frameWidths) {
    const counted = madeFrames.widths.find((row) => row.width === width);
    expect({ frames: counted?.frames, over: counted?.over, worst: counted?.worst }).toEqual({ frames: run[width].frames, over: run[width].over33, worst: run[width].worst });
  }
});
