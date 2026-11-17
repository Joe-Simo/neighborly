/**
 * A conference in its first days: its owner alone, and nothing yet made in the rooms people share.
 * Read from what the workspace already holds; it asks the database for nothing.
 */
export type FirstDaysData = {
  user: { id: string };
  people: readonly { id: string; role: string }[];
  teams: readonly unknown[];
  commitments: readonly unknown[];
  announcements: readonly unknown[];
  tasks: readonly unknown[];
  meetings: readonly unknown[];
};

/** True only for the owner who is still alone: no one else has joined, and no team, commitment, announcement, task or meeting exists. */
export function isBrandNew(data: FirstDaysData) {
  return (
    data.people.length === 1 &&
    data.people[0].id === data.user.id &&
    data.people[0].role === "owner" &&
    [data.teams, data.commitments, data.announcements, data.tasks, data.meetings].every((list) => list.length === 0)
  );
}

/** True when each figure the week leads with, and the one line under them, would say nothing but 0. */
export function nothingWaiting(counts: { callsWaiting: number; visitsPlanned: number; requestsOpen: number; approvedUnpaid: number }) {
  return counts.callsWaiting === 0 && counts.visitsPlanned === 0 && counts.requestsOpen === 0 && counts.approvedUnpaid === 0;
}
