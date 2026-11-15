"use client";

import { upcomingCommitments } from "@/lib/commitment-visibility";
import { useWorkspace } from "@/components/workspace/context";
import {
  CommitmentRows,
  IncomingRequests,
} from "@/components/workspace/volunteer/commitment-rows";

export function MineSection() {
  const { data, now } = useWorkspace();
  const mine = upcomingCommitments(data.commitments, now).filter(
    (item) => item.assigneeId === data.user.id,
  );
  return (
    <>
      <IncomingRequests />
      <section className="live-section">
        <h2>Accepted commitments</h2>
        <CommitmentRows items={mine} empty={{ title: "Nothing on your calendar yet.", detail: "Commitments you accept will appear here with everything you need to prepare." }} />
      </section>
    </>
  );
}
