import { dateFormatter } from "./words/dates";
/** Account-free, in-memory synthetic example. No action sends a message. */
export const sampleDates = [
  "2026-11-08",
  "2026-11-15",
  "2026-11-22",
  "2026-11-29",
  "2026-12-06",
  "2026-12-13",
] as const;
export type SampleDate = (typeof sampleDates)[number];
export type PersonId = "grace" | "noor" | "eli";
export type ExampleView = "grace" | "coordinator" | "noor";
export type RequestStatus = "none" | "pending" | "accepted" | "declined";
export type Phase =
  "committed" | "unassigned" | "open" | "pending" | "accepted" | "declined";

export const people = {
  grace: {
    id: "grace",
    name: "Grace",
    initials: "GR",
    role: "Welcome team",
    membership: "Active member",
    rhythm: "Every other Sunday",
  },
  noor: {
    id: "noor",
    name: "Noor",
    initials: "NA",
    role: "Welcome team",
    membership: "Active member",
    rhythm: "Occasional help",
    approved: true,
    available: true,
    optedIn: true,
  },
  eli: {
    id: "eli",
    name: "Ellis",
    initials: "EC",
    role: "Team coordinator",
    membership: "Active member",
    rhythm: "Helping the team prepare",
  },
} as const;

export interface Commitment {
  date: SampleDate;
  assignee: "grace" | "noor" | null;
  releasedByGrace: boolean;
  releasedByNoor: boolean;
  request: RequestStatus;
}
export interface ExampleState {
  selectedDate: SampleDate;
  view: ExampleView;
  commitments: Record<SampleDate, Commitment>;
  changePreview: SampleDate[] | null;
  taskComplete: boolean;
  meetingResponse: "unanswered" | "accepted" | "declined";
  announcement: string;
}

export function createInitialState(): ExampleState {
  const commitments = Object.fromEntries(
    sampleDates.map((date, index) => [
      date,
      {
        date,
        assignee: index % 2 === 0 ? "grace" : null,
        releasedByGrace: false,
        releasedByNoor: false,
        request: "none",
      },
    ]),
  ) as Record<SampleDate, Commitment>;
  return {
    selectedDate: "2026-11-22",
    view: "grace",
    commitments,
    changePreview: null,
    taskComplete: false,
    meetingResponse: "unanswered",
    announcement:
      "Explore Grace’s commitments. All people and activity are synthetic.",
  };
}
export const initialState = createInitialState();

export type ExampleAction =
  | { type: "select-date"; date: SampleDate }
  | { type: "preview-change"; dates?: readonly SampleDate[] }
  | { type: "cancel-change" }
  | { type: "confirm-change" }
  | { type: "set-view"; view: ExampleView }
  | { type: "send-request" }
  | { type: "respond"; response: "accepted" | "declined" }
  | { type: "complete-task"; complete?: boolean }
  | { type: "respond-meeting"; response: "accepted" | "declined" }
  | { type: "reset" };

export function getCommitment(
  state: ExampleState,
  date: SampleDate,
): Commitment {
  return state.commitments[date];
}
export function getSelectedCommitment(state: ExampleState): Commitment {
  return getCommitment(state, state.selectedDate);
}
export function affectedCommitments(
  state: ExampleState,
  dates: readonly SampleDate[],
): SampleDate[] {
  return sampleDates.filter(
    (date) =>
      dates.includes(date) && state.commitments[date].assignee === "grace",
  );
}
export function affectedOwnedCommitments(
  state: ExampleState,
  dates: readonly SampleDate[],
): SampleDate[] {
  if (state.view === "coordinator") return [];
  return sampleDates.filter(
    (date) =>
      dates.includes(date) && state.commitments[date].assignee === state.view,
  );
}
export function getPhase(
  state: ExampleState,
  date = state.selectedDate,
): Phase {
  const commitment = getCommitment(state, date);
  if (commitment.request === "accepted") return "accepted";
  if (commitment.request === "pending") return "pending";
  if (commitment.request === "declined") return "declined";
  if (commitment.assignee === "grace") return "committed";
  return commitment.releasedByGrace ? "open" : "unassigned";
}
export function formatDate(
  date: SampleDate,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
): string {
  return dateFormatter("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function canRequestCover(state: ExampleState): boolean {
  const commitment = getSelectedCommitment(state);
  return (
    state.view === "coordinator" &&
    commitment.releasedByGrace &&
    !commitment.releasedByNoor &&
    !commitment.assignee &&
    commitment.request === "none" &&
    people.noor.approved &&
    people.noor.available &&
    people.noor.optedIn
  );
}
export function hasPreparation(
  state: ExampleState,
  person: PersonId,
  date = state.selectedDate,
): boolean {
  return getCommitment(state, date).assignee === person;
}

export function reducer(
  state: ExampleState,
  action: ExampleAction,
): ExampleState {
  switch (action.type) {
    case "select-date":
      if (!sampleDates.includes(action.date)) return state;
      return {
        ...state,
        selectedDate: action.date,
        changePreview: null,
        announcement: `${formatDate(action.date)} selected.`,
      };
    case "set-view":
      return {
        ...state,
        view: action.view,
        changePreview: null,
        announcement: `Example view: ${action.view === "coordinator" ? "Ellis, coordinator" : people[action.view].name}.`,
      };
    case "preview-change": {
      if (state.view === "coordinator") return state;
      const dates = affectedOwnedCommitments(
        state,
        action.dates ?? [state.selectedDate],
      );
      if (!dates.length)
        return {
          ...state,
          changePreview: null,
          announcement: `${people[state.view].name} has no commitment on the selected dates.`,
        };
      return {
        ...state,
        changePreview: dates,
        announcement: `${dates.length} ${dates.length === 1 ? "commitment" : "commitments"} affected. Review before confirming. Team membership will stay active.`,
      };
    }
    case "cancel-change":
      return {
        ...state,
        changePreview: null,
        announcement: "Change cancelled. Your commitments are unchanged.",
      };
    case "confirm-change": {
      if (state.view === "coordinator" || !state.changePreview?.length)
        return state;
      const dates = affectedOwnedCommitments(state, state.changePreview);
      const commitments = { ...state.commitments };
      for (const date of dates)
        commitments[date] = {
          ...commitments[date],
          assignee: null,
          releasedByGrace: true,
          releasedByNoor: state.view === "noor" || commitments[date].releasedByNoor,
          request: "none",
        };
      return {
        ...state,
        commitments,
        changePreview: null,
        announcement: `${dates.length} ${dates.length === 1 ? "commitment changed" : "commitments changed"}. ${people[state.view].name} remains an active Welcome team member. Other dates are unchanged.`,
      };
    }
    case "send-request": {
      if (!canRequestCover(state)) return state;
      const commitment = getSelectedCommitment(state);
      return {
        ...state,
        commitments: {
          ...state.commitments,
          [state.selectedDate]: { ...commitment, request: "pending" },
        },
        announcement:
          "Request simulated for Noor. Waiting for her choice. No message was sent.",
      };
    }
    case "respond": {
      const commitment = getSelectedCommitment(state);
      if (
        state.view !== "noor" ||
        commitment.request !== "pending" ||
        commitment.assignee
      )
        return state;
      const accepted = action.response === "accepted";
      return {
        ...state,
        commitments: {
          ...state.commitments,
          [state.selectedDate]: {
            ...commitment,
            request: action.response,
            assignee: accepted ? "noor" : null,
          },
        },
        announcement: accepted
          ? "Noor accepted this commitment. The role guide is ready. The responsibility is not yet completed."
          : "Noor declined. The date stays open; no other eligible candidate is available in this example. Grace’s membership is unchanged.",
      };
    }
    case "complete-task":
      return {
        ...state,
        taskComplete: action.complete ?? !state.taskComplete,
        announcement:
          (action.complete ?? !state.taskComplete)
            ? "Entrance signs task marked complete in this example."
            : "Entrance signs task reopened in this example.",
      };
    case "respond-meeting":
      return {
        ...state,
        meetingResponse: action.response,
        announcement: `Meeting invitation ${action.response} in this example.`,
      };
    case "reset":
      return {
        ...createInitialState(),
        announcement:
          "Example reset. Grace’s three commitments and all sample choices have been restored.",
      };
  }
}
