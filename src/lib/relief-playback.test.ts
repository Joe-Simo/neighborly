import { expect, test } from "bun:test";
import {
  AnimationClip,
  AnimationMixer,
  NumberKeyframeTrack,
  Object3D,
} from "three";
import { createReliefPlayback } from "./relief-playback";

test("the guide freezes in flight, resumes at the same position, and reaches still endpoints", () => {
  const guide = new Object3D();
  const clip = (name: string, from: number, to: number) =>
    new AnimationClip(name, 1, [
      new NumberKeyframeTrack(".position[x]", [0, 1], [from, to]),
    ]);
  const playback = createReliefPlayback(new AnimationMixer(guide), [
    clip("settle", 0, 4),
    clip("pending", 4, 8),
    clip("accepted", 8, 12),
  ]);

  playback.apply("rest", false, false);
  playback.advance(0.25);
  expect(guide.position.x).toBeCloseTo(1);

  playback.apply("rest", true, false);
  playback.advance(0.5);
  expect(guide.position.x).toBeCloseTo(1);
  expect(playback.isRunning()).toBe(false);

  playback.apply("rest", false, false);
  playback.advance(0.25);
  expect(guide.position.x).toBeCloseTo(2);

  playback.apply("rest", true, false);
  playback.apply("pending", true, false);
  expect(guide.position.x).toBeCloseTo(8);
  playback.advance(0.5);
  expect(guide.position.x).toBeCloseTo(8);

  playback.apply("accepted", false, false);
  playback.advance(0.25);
  expect(guide.position.x).toBeCloseTo(9);
  playback.apply("accepted", false, true);
  expect(guide.position.x).toBeCloseTo(12);
  expect(playback.isRunning()).toBe(false);
});


test("handoff preserves palm shape while the guide moves", () => {
  const root = new Object3D();
  const palm = new Object3D(); palm.name = "DonorPalm";
  const guide = new Object3D(); guide.name = "Guide";
  root.add(palm, guide);
  const clip = new AnimationClip("accepted", 1, [
    new NumberKeyframeTrack("DonorPalm.position[x]", [0, 1], [0, 2]),
    new NumberKeyframeTrack("Guide.position[x]", [0, 1], [0, 4]),
  ]);
  const rest = new AnimationClip("rest", 1, [new NumberKeyframeTrack("DonorPalm.position[x]", [0, 1], [0, 0])]);
  const playback = createReliefPlayback(new AnimationMixer(root), [rest, clip]);
  playback.apply("accepted", false, false);
  playback.advance(.5);
  expect(palm.position.x).toBe(0);
  expect(guide.position.x).toBeCloseTo(2);
  expect(clip.tracks).toHaveLength(2);
});
