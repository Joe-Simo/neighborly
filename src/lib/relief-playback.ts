import {
  LoopOnce,
  type AnimationAction,
  type AnimationClip,
  type AnimationMixer,
} from "three";

export type ReliefOutcome = "rest" | "pending" | "accepted" | "declined";

export function createReliefPlayback(
  mixer: AnimationMixer,
  clips: readonly AnimationClip[],
) {
  let current: ReliefOutcome | undefined;
  let action: AnimationAction | undefined;

  return {
    apply(
      outcome: ReliefOutcome,
      paused: boolean,
      reducedMotion: boolean,
      restore = false,
    ) {
      const changed = current !== outcome;
      if (changed) {
        const name =
          !current && outcome === "rest" && !reducedMotion ? "settle" : outcome;
        current = outcome;
        const sourceClip =
          clips.find((candidate) => candidate.name === name) ??
          clips.find((candidate) => candidate.name === outcome);
        // Keep hand joints at the authored rest endpoint: palm movement against
        // pinned wrists stretches the weighted relief. Only the guide transfers.
        const rest = clips.find(candidate => candidate.name === "rest");
        const clip = sourceClip?.clone();
        if (clip) clip.tracks = clip.tracks.map(track => {
          if (!/(?:^|[/.])(Donor|DonorPalm|Receiver|ReceiverPalm)(?:[./]|$)/.test(track.name)) return track;
          const reference = rest?.tracks.find(candidate => candidate.name === track.name) ?? track;
          const size = reference.getValueSize();
          const endpoint = reference.values.slice(reference.values.length - size);
          for (let offset = 0; offset < track.values.length; offset += size) track.values.set(endpoint, offset);
          return track;
        });
        mixer.stopAllAction();
        action = clip && mixer.clipAction(clip);
        if (action) {
          action.reset().setLoop(LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
        }
      }

      mixer.timeScale = paused || reducedMotion ? 0 : 1;
      // A hand-off left part-way by the visitor's own drag carries on from where they let go.
      if (!changed && !paused && !reducedMotion && action?.paused && action.time < action.getClip().duration) action.paused = false;
      if (
        action &&
        (reducedMotion ||
          (changed && paused) ||
          (restore && outcome !== "rest"))
      ) {
        action.time = action.getClip().duration;
        action.paused = true;
      }
      mixer.update(0);
    },
    /** Holds an outcome's movement at a point along its length, so a hand can lead it. */
    scrub(outcome: ReliefOutcome, progress: number) {
      this.apply(outcome, true, false);
      if (!action) return;
      action.time = Math.max(0, Math.min(1, progress)) * action.getClip().duration;
      action.paused = true;
      mixer.update(0);
    },
    advance(seconds: number) {
      mixer.update(seconds);
    },
    isRunning() {
      return mixer.timeScale !== 0 && (action?.isRunning() ?? false);
    },
    stop() {
      mixer.stopAllAction();
    },
  };
}
