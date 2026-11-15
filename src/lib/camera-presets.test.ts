import { expect, test } from "bun:test";
import cameras from "../../art/camera-presets.json";
import sourceManifest from "../../art/asset-manifest.json";
import exportedManifest from "../../public/assets/mural-manifest.json";
import livingRelief from "../../public/assets/living-relief-manifest.json";

test("exported camera presets are the same authored values imported by the runtime", () => {
  const expected = { desktop: cameras.desktop, mobile: cameras.mobile };
  expect(sourceManifest.cameras).toEqual(expected);
  expect(exportedManifest.cameras).toEqual(expected);
  expect(exportedManifest.cameraMobileBreakpoint).toBe(
    cameras.mobileBreakpoint,
  );
  for (const viewport of [cameras.desktop, cameras.mobile]) {
    expect(Object.keys(viewport).sort()).toEqual([
      "exchange",
      "group",
      "person",
      "preparation",
    ]);
    expect(
      new Set(
        Object.values(viewport).map((preset) =>
          JSON.stringify(preset.position),
        ),
      ).size,
    ).toBe(4);
    for (const preset of Object.values(viewport)) {
      expect(
        [...preset.position, ...preset.target, preset.fov].every(
          Number.isFinite,
        ),
      ).toBe(true);
    }
  }
});

test("the live relief supplies distinct usable framings on desktop and mobile", () => {
  for (const [presets, artworkHeight] of [
    [livingRelief.cameras, 10.24],
    [livingRelief.mobileCameras, 16.88],
  ] as const) {
    expect(Object.keys(presets).sort()).toEqual([
      "exchange",
      "group",
      "person",
      "preparation",
    ]);
    expect(presets.group.orthoHeight).toBe(artworkHeight);
    expect(presets.group.target).toEqual([0, artworkHeight / 2, 0]);

    const frames = Object.values(presets);
    expect(new Set(frames.map(({ target }) => target.join(","))).size).toBe(4);
    for (const { position, target, orthoHeight } of frames) {
      expect([...position, ...target, orthoHeight].every(Number.isFinite)).toBe(
        true,
      );
      expect(position[2]).toBeGreaterThan(target[2]);
      expect(orthoHeight).toBeGreaterThan(0);
      expect(orthoHeight).toBeLessThanOrEqual(artworkHeight);
    }
  }
});
