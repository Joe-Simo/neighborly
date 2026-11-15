"use client";

import { upcomingCommitments, withoutIncomingRequests } from "@/lib/commitment-visibility";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import {
  CommitmentRows,
  IncomingRequests,
  incomingRequests,
} from "@/components/workspace/volunteer/commitment-rows";

export function WeekSection() {
  const { data, now, format } = useWorkspace();
  const weekEnd = now + 7 * 86400000;
  const upcoming = upcomingCommitments(data.commitments, now);
  const incoming = incomingRequests(data);
  return (
    <>
      <IncomingRequests />
      <section className="live-section">
        <div className="live-section-head">
          <h2>Coming up</h2>
          <span className="live-count">Next 7 days</span>
        </div>
        <CommitmentRows
          items={withoutIncomingRequests(upcoming.filter((item) => item.start <= weekEnd), incoming)}
          empty={{ title: incoming.length ? "Your next choice is above." : "A little breathing room.", detail: incoming.length ? "Reply to your invitation when you’re ready. Other upcoming commitments will appear here." : "No commitments are scheduled in the next seven days. Later dates are in Commitments." }}
        />
      </section>
      <section className="live-section">
        <h2>From your group</h2>
        {data.announcements.length ? (
          <div className="live-list">
            {data.announcements.map((item) => (
              <article className="live-row" key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p className="live-prep">{item.body}</p>
                  <div className="live-meta">
                    {item.authorName} · {format(item.createdAt)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <LiveEmpty title="No announcements yet.">
            Updates from your coordinators will be kept here.
          </LiveEmpty>
        )}
      </section>
    </>
  );
}
