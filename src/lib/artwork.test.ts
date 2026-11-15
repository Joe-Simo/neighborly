import { expect, test } from "bun:test";
import { reliefArtwork, validArtworkFraming } from "./artwork";

test("authored artwork cannot pass invalid coordinates to the camera", () => {
  expect(validArtworkFraming(reliefArtwork)).toBe(true);
  expect(validArtworkFraming({
    ...reliefArtwork,
    cameras: {
      ...reliefArtwork.cameras,
      exchange: { position: [0, Number.NaN, 2], target: [0, 0, 0], orthoHeight: 2 },
    },
  })).toBe(false);
  expect(validArtworkFraming({
    ...reliefArtwork,
    cameras: {
      ...reliefArtwork.cameras,
      group: { ...reliefArtwork.cameras.group, orthoWidth: Number.POSITIVE_INFINITY },
    },
  })).toBe(false);
  expect(validArtworkFraming({
    ...reliefArtwork,
    mobileCameras: {
      ...reliefArtwork.mobileCameras,
      preparation: { position: [0, 1], target: [0, 0, 0], orthoHeight: 0 },
    },
  })).toBe(false);
});
