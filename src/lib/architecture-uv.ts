export type Point3 = readonly [number, number, number];

/** Choose one projection for the entire face, independent of smoothed vertex normals. */
export function dominantFaceProjection(a: Point3, b: Point3, c: Point3): "x" | "y" | "z" {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const x = Math.abs(ab[1] * ac[2] - ab[2] * ac[1]);
  const y = Math.abs(ab[2] * ac[0] - ab[0] * ac[2]);
  const z = Math.abs(ab[0] * ac[1] - ab[1] * ac[0]);
  return x >= y && x >= z ? "x" : y >= z ? "y" : "z";
}

export function architectureUv(point: Point3, projection: "x" | "y" | "z"): readonly [number, number] {
  if (projection === "x") return [point[2] / 2, point[1] / 2];
  if (projection === "y") return [point[0] / 2, point[2] / 2];
  return [point[0] / 2, point[1] / 2];
}
