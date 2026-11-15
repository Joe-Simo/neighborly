import { expect, test } from "bun:test";
import * as T from "three";
import { createLivingWorldController, createLivingWorldResourceDisposer, getLivingWorldMotionState, getLivingWorldWelcomePose, getLivingWorldResidentRooms, getLivingWorldVisitDoorAngle } from "./living-world-controller";
import { getLivingWorldFrame } from "./living-world-timeline";

test("scene cuts are hidden under full opaque coverage, including reverse movement", () => {
  for (let chapter = 0; chapter < 3; chapter++) {
    const cut = (chapter + .64 + .34 * .5) * .22;
    const before = getLivingWorldFrame(cut - 1e-7);
    const after = getLivingWorldFrame(cut + 1e-7);
    expect(before.scene).not.toBe(after.scene);
    expect(before.fullyCovered).toBe(true);
    expect(after.fullyCovered).toBe(true);
    expect(before.coverOffset).toBe(0);
    expect(after.coverOffset).toBe(0);
  }
});

test("a stopped or reversed timeline has one deterministic visible world", () => {
  for (let step = 0; step <= 64; step++) {
    const progress = step / 64;
    const frame = getLivingWorldFrame(progress);
    expect(frame.scene).toBe(getLivingWorldFrame(progress).scene);
    expect(Number.isFinite(frame.coverOffset)).toBe(true);
    if (frame.fullyCovered) expect(frame.cover).not.toBeNull();
  }
  expect(getLivingWorldFrame(1).scene).toBe("complete");
  expect(getLivingWorldFrame(Number.NaN).scene).toBe("opening");
});


test("the final gathering keeps its completed pose when the camera settles", () => {
  const before = getLivingWorldFrame(.22 * 3.93);
  const after = getLivingWorldFrame(.22 * 3.95);
  expect(before.scene).toBe("welcome");
  expect(after.scene).toBe("complete");
  expect(before.sceneProgress).toBe(1);
  expect(after.sceneProgress).toBe(1);
  expect(after.cover).toBeNull();
});


test("shared cast resources and late arrivals are disposed once", () => {
  const release = createLivingWorldResourceDisposer();
  const geometry = new T.BoxGeometry();
  const texture = new T.Texture();
  const material = new T.MeshStandardMaterial({ map: texture });
  const root = new T.Group();
  const mesh = new T.Mesh(geometry, material);
  root.add(mesh, mesh.clone());
  const counts = { geometry: 0, texture: 0, material: 0 };
  geometry.addEventListener("dispose", () => counts.geometry++);
  texture.addEventListener("dispose", () => counts.texture++);
  material.addEventListener("dispose", () => counts.material++);
  release(root);
  release(mesh.clone());
  expect(counts).toEqual({ geometry: 1, texture: 1, material: 1 });
  const lateGeometry = new T.BoxGeometry();
  let lateDisposals = 0;
  lateGeometry.addEventListener("dispose", () => lateDisposals++);
  release(new T.Mesh(lateGeometry, material));
  expect(lateDisposals).toBe(1);
  expect(counts.material).toBe(1);
});


test("foreground travel stays within the brief authored transition window", () => {
  for (let chapter = 0; chapter < 3; chapter++) {
    expect(getLivingWorldFrame((chapter + .72) * .22).cover).toBeNull();
    expect(getLivingWorldFrame((chapter + .81) * .22).fullyCovered).toBe(true);
    expect(getLivingWorldFrame((chapter + .90) * .22).cover).toBeNull();
  }
});


test("reduced motion holds the camera and only selects stable endpoint poses", () => {
  for (const progress of [.24, .27, .30, .34, .38, .40]) {
    const frame = getLivingWorldFrame(progress);
    const motion = getLivingWorldMotionState(frame, true);
    expect(motion.cameraProgress).toBe(0);
    expect([0, 1]).toContain(motion.actionProgress);
    expect(motion.cover).toBeNull();
  }
  expect(getLivingWorldFrame(.24).scene).toBe("meal");
  expect(getLivingWorldFrame(.46).scene).toBe("visit");
});

test("renderer initialization failure reaches the host fallback callback", () => {
  let errors = 0;
  expect(() => createLivingWorldController({} as HTMLElement, { onError: () => errors++ })).toThrow();
  expect(errors).toBe(1);
});


test("the welcome camera stays inside the open door corridor throughout its travel", () => {
  for (const portrait of [false, true]) for (const progress of [0, .25, .5, .75, 1]) {
    const pose = getLivingWorldWelcomePose(progress, portrait, false);
    const crossing = (2.6 - pose.position[2]) / (pose.target[2] - pose.position[2]);
    const xAtDoor = pose.position[0] + crossing * (pose.target[0] - pose.position[0]);
    const openingHalfWidth = 2.1 * (1 - Math.cos(pose.doorAngle));
    expect(Math.abs(xAtDoor)).toBeLessThan(openingHalfWidth - .25);
    expect(Math.abs(pose.position[0])).toBeLessThan(1.5);
    expect(pose.fov).toBeGreaterThanOrEqual(48);
  }
});


test("directional room residency excludes distant scenes and supports reversal", () => {
  expect(getLivingWorldResidentRooms("opening", 1)).toEqual(["meal"]);
  expect(getLivingWorldResidentRooms("meal", 1)).toEqual(["meal", "visit"]);
  expect(getLivingWorldResidentRooms("visit", 1)).toEqual(["visit", "welcome"]);
  expect(getLivingWorldResidentRooms("complete", 1)).toEqual(["welcome"]);
  expect(getLivingWorldResidentRooms("welcome", -1)).toEqual(["welcome", "visit"]);
  expect(getLivingWorldResidentRooms("visit", -1)).toEqual(["visit", "meal"]);
  expect(getLivingWorldResidentRooms("meal", -1)).toEqual(["meal"]);
});


test("the visiting door swings inward behind the host throughout the greeting", () => {
  const doorwayZ = -1.21;
  for (const progress of [0, .25, .5, .75, 1]) {
    const angle = getLivingWorldVisitDoorAngle(progress, -55 * Math.PI / 180);
    const freeEdgeZ = doorwayZ - 1.56 * Math.sin(angle);
    expect(freeEdgeZ).toBeLessThanOrEqual(doorwayZ);
    expect(freeEdgeZ).toBeLessThan(-.85); // Host begins in front of the doorway.
  }
});
