import { describe, expect, test } from "bun:test";
import {
  affectedCommitments,
  canRequestCover,
  createInitialState,
  getPhase,
  hasPreparation,
  people,
  reducer,
} from "./neighborly";

function release(state = createInitialState()) {
  return reducer(reducer(state, { type: "preview-change" }), {
    type: "confirm-change",
  });
}
function pending() {
  return reducer(
    reducer(release(), { type: "set-view", view: "coordinator" }),
    { type: "send-request" },
  );
}

describe("synthetic cover workflow", () => {
  test("preview and cancellation never change a commitment", () => {
    const initial = createInitialState();
    const preview = reducer(initial, { type: "preview-change" });
    expect(preview.changePreview).toEqual(["2026-11-22"]);
    expect(preview.commitments).toBe(initial.commitments);
    expect(reducer(preview, { type: "cancel-change" }).commitments).toBe(
      initial.commitments,
    );
  });
  test("a confirmed change preserves other dates and team membership", () => {
    const state = release();
    expect(getPhase(state)).toBe("open");
    expect(state.commitments["2026-11-08"].assignee).toBe("grace");
    expect(state.commitments["2026-12-06"].assignee).toBe("grace");
    expect(people.grace.membership).toBe("Active member");
    expect(state.commitments["2026-11-22"].assignee).toBeNull();
  });
  test("time-off preview includes only owned commitments and cancellation preserves every date", () => {
    const initial = createInitialState();
    const preview = reducer(initial, {
      type: "preview-change",
      dates: ["2026-11-08", "2026-11-15", "2026-11-22", "2026-11-22"],
    });
    expect(preview.changePreview).toEqual(["2026-11-08", "2026-11-22"]);
    const cancelled = reducer(preview, { type: "cancel-change" });
    expect(cancelled.changePreview).toBeNull();
    expect(cancelled.commitments).toEqual(initial.commitments);
    expect(reducer(cancelled, { type: "confirm-change" })).toBe(cancelled);

    const confirmed = reducer(preview, { type: "confirm-change" });
    expect(confirmed.commitments["2026-11-08"].assignee).toBeNull();
    expect(confirmed.commitments["2026-11-22"].assignee).toBeNull();
    expect(confirmed.commitments["2026-11-15"]).toEqual(
      initial.commitments["2026-11-15"],
    );
    expect(confirmed.commitments["2026-12-06"]).toEqual(
      initial.commitments["2026-12-06"],
    );
  });
  test("uncommitted dates cannot release or create Grace’s responsibility", () => {
    const state = reducer(createInitialState(), {
      type: "select-date",
      date: "2026-11-15",
    });
    expect(getPhase(release(state))).toBe("unassigned");
    expect(affectedCommitments(state, ["2026-11-15", "2026-11-22"])).toEqual([
      "2026-11-22",
    ]);
  });
  test("coordinator request requires released date and never implies acceptance", () => {
    const initial = reducer(createInitialState(), {
      type: "set-view",
      view: "coordinator",
    });
    expect(canRequestCover(initial)).toBe(false);
    expect(reducer(initial, { type: "send-request" })).toBe(initial);
    const state = pending();
    expect(getPhase(state)).toBe("pending");
    expect(state.commitments["2026-11-22"].assignee).toBeNull();
    expect(hasPreparation(state, "noor")).toBe(false);
    expect(reducer(state, { type: "respond", response: "accepted" })).toBe(
      state,
    );
  });
  test("only Noor’s explicit acceptance assigns the date and preparation", () => {
    const state = reducer(
      reducer(pending(), { type: "set-view", view: "noor" }),
      { type: "respond", response: "accepted" },
    );
    expect(getPhase(state)).toBe("accepted");
    expect(state.commitments["2026-11-22"].assignee).toBe("noor");
    expect(hasPreparation(state, "noor")).toBe(true);
    expect(state.taskComplete).toBe(false);
    expect(reducer(state, { type: "respond", response: "declined" })).toBe(
      state,
    );
  });
  test("decline leaves date open, without granting preparation", () => {
    const state = reducer(
      reducer(pending(), { type: "set-view", view: "noor" }),
      { type: "respond", response: "declined" },
    );
    expect(getPhase(state)).toBe("declined");
    expect(state.commitments["2026-11-22"].assignee).toBeNull();
    expect(hasPreparation(state, "noor")).toBe(false);
    expect(state.announcement).toContain("no other eligible candidate");
    const coordinator = reducer(state, { type: "set-view", view: "coordinator" });
    expect(canRequestCover(coordinator)).toBe(false);
    expect(reducer(coordinator, { type: "send-request" })).toBe(coordinator);
  });
  test("switching dates or views never undoes accepted choices", () => {
    const accepted = reducer(
      reducer(pending(), { type: "set-view", view: "noor" }),
      { type: "respond", response: "accepted" },
    );
    const navigated = reducer(
      reducer(accepted, { type: "select-date", date: "2026-12-06" }),
      { type: "set-view", view: "grace" },
    );
    expect(getPhase(navigated, "2026-11-22")).toBe("accepted");
    expect(getPhase(navigated)).toBe("committed");
  });
  test("requests and replies affect only their selected date", () => {
    let state = reducer(createInitialState(), {
      type: "preview-change",
      dates: ["2026-11-08", "2026-11-22"],
    });
    state = reducer(reducer(state, { type: "confirm-change" }), {
      type: "set-view",
      view: "coordinator",
    });
    state = reducer(state, { type: "send-request" });
    expect(getPhase(state, "2026-11-08")).toBe("open");
    state = reducer(
      reducer(state, { type: "select-date", date: "2026-11-08" }),
      { type: "send-request" },
    );
    state = reducer(state, { type: "set-view", view: "noor" });
    state = reducer(state, { type: "respond", response: "declined" });
    expect(getPhase(state, "2026-11-08")).toBe("declined");
    expect(getPhase(state, "2026-11-22")).toBe("pending");
    state = reducer(
      reducer(state, { type: "select-date", date: "2026-11-22" }),
      { type: "respond", response: "accepted" },
    );
    expect(getPhase(state, "2026-11-22")).toBe("accepted");
    expect(hasPreparation(state, "noor", "2026-11-22")).toBe(true);
    expect(hasPreparation(state, "noor", "2026-11-08")).toBe(false);
    expect(getPhase(state, "2026-11-08")).toBe("declined");
    expect(state.commitments["2026-12-06"].assignee).toBe("grace");
  });
  test("Noor may review and release only her own accepted commitment", () => {
    const accepted = reducer(
      reducer(pending(), { type: "set-view", view: "noor" }),
      { type: "respond", response: "accepted" },
    );
    const coordinator = reducer(accepted, {
      type: "set-view",
      view: "coordinator",
    });
    expect(reducer(coordinator, { type: "preview-change" })).toBe(coordinator);
    const grace = reducer(accepted, { type: "set-view", view: "grace" });
    expect(reducer(grace, { type: "preview-change" }).changePreview).toBeNull();
    const preview = reducer(accepted, {
      type: "preview-change",
      dates: ["2026-11-08", "2026-11-22", "2026-12-06"],
    });
    expect(preview.changePreview).toEqual(["2026-11-22"]);
    expect(preview.commitments["2026-11-22"].assignee).toBe("noor");
    const released = reducer(preview, { type: "confirm-change" });
    expect(released.commitments["2026-11-22"].assignee).toBeNull();
    expect(released.commitments["2026-11-22"].request).toBe("none");
    expect(getPhase(released)).toBe("open");
    expect(hasPreparation(released, "noor")).toBe(false);
    expect(released.commitments["2026-11-08"].assignee).toBe("grace");
    expect(released.commitments["2026-12-06"].assignee).toBe("grace");
    expect(released.announcement).toContain("Noor remains an active");
    expect(people.noor.membership).toBe("Active member");
    const coordinatorAfterRelease = reducer(released, {
      type: "set-view",
      view: "coordinator",
    });
    expect(canRequestCover(coordinatorAfterRelease)).toBe(false);
    expect(reducer(coordinatorAfterRelease, { type: "send-request" })).toBe(
      coordinatorAfterRelease,
    );
  });
  test("reset restores a fresh independent sample", () => {
    const state = reducer(reducer(pending(), { type: "complete-task" }), {
      type: "reset",
    });
    expect(getPhase(state)).toBe("committed");
    expect(state.taskComplete).toBe(false);
    expect(state.commitments).not.toBe(createInitialState().commitments);
  });
});
