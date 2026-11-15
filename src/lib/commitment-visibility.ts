type DatedCommitment = { start: number; end: number; status: string };

/** Cancelled dates remain discoverable in the commitment list, never in an active schedule. */
export function upcomingCommitments<T extends DatedCommitment>(
  commitments: readonly T[],
  now: number,
  includeCancelled = false,
): T[] {
  return commitments
    .filter((item) => item.end >= now && (includeCancelled || item.status !== "cancelled"))
    .sort((first, second) => first.start - second.start);
}

/** A pending invitation already has its own decision surface above the week list. */
export function withoutIncomingRequests<T extends { id: string }>(
  commitments: readonly T[],
  incoming: readonly { commitmentId: string }[],
): T[] {
  const requested = new Set(incoming.map((request) => request.commitmentId));
  return commitments.filter((commitment) => !requested.has(commitment.id));
}
