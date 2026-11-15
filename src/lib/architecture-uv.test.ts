import { expect, test } from "bun:test";
import { architectureUv, dominantFaceProjection, type Point3 } from "./architecture-uv";

test("every principal face receives nondegenerate world-scale UVs", () => {
  const faces: readonly (readonly [Point3, Point3, Point3])[] = [
    [[3, 0, 0], [3, 2, 0], [3, 0, 2]],
    [[0, 3, 0], [2, 3, 0], [0, 3, 2]],
    [[0, 0, 3], [2, 0, 3], [0, 2, 3]],
  ];
  expect(faces.map(face => dominantFaceProjection(...face))).toEqual(["x", "y", "z"]);
  for (const face of faces) {
    const projection = dominantFaceProjection(...face);
    const [a, b, c] = face.map(point => architectureUv(point, projection));
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    expect(area).toBe(1);
    expect(dominantFaceProjection(face[2], face[1], face[0])).toBe(projection);
  }
});

test("sloped bevel faces use a single dominant projection without collapsed UVs", () => {
  const face = [[0, 0, 0], [.2, 2, 0], [.2, 0, 2]] as const;
  expect(dominantFaceProjection(...face)).toBe("x");
  expect(architectureUv(face[1], "x")).toEqual([0, 1]);
  expect(architectureUv(face[2], "x")).toEqual([1, 0]);
});
