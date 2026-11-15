"use client";

import { upcomingCommitments } from "@/lib/commitment-visibility";
import { useWorkspace } from "@/components/workspace/context";
import {
  CommitmentRows,
  IncomingRequests,
} from "@/components/workspace/volunteer/commitment-rows";
import { MyVisits } from "@/components/workspace/visits/my-visits";

export function MineSection() {
  const { data, now, words } = useWorkspace();
  const mine = upcomingCommitments(data.commitments, now).filter(
    (item) => item.assigneeId === data.user.id,
  );
  return (
    <>
      <IncomingRequests />
      <MyVisits />
      <section className="live-section">
        <h2>{words.mine.accepted}</h2>
        <CommitmentRows items={mine} empty={{ title: words.mine.emptyTitle, detail: words.mine.emptyDetail }} />
      </section>
    </>
  );
}
