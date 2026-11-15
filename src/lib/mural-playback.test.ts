import { expect, test } from "bun:test";
import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  NumberKeyframeTrack,
  Object3D,
} from "three";
import { needsMuralFrame } from "./mural-playback";

test("a slow 15fps device reaches the accepted final pose even with a capped simulation step", () => {
  const object = new Object3D();
  const mixer = new AnimationMixer(object);
  const clip = new AnimationClip("accepted", 1.767, [
    new NumberKeyframeTrack(".position[x]", [0, 1.767], [0, 1]),
  ]);
  const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  let now = 0;
  let frames = 0;
  do {
    now += 1000 / 15;
    mixer.update(0.04);
    frames++;
  } while (
    needsMuralFrame(now, 1867, action.isRunning(), false, false) &&
    frames < 100
  );
  expect(now).toBeGreaterThan(1867);
  expect(action.isRunning()).toBe(false);
  expect(object.position.x).toBeCloseTo(1);
  expect(needsMuralFrame(now, now + 1000, true, true, false)).toBe(false);
  expect(needsMuralFrame(now, now + 1000, true, false, true)).toBe(false);
});
