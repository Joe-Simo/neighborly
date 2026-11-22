"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Landmark } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { LiveLoading } from "@/components/workspace/primitives";
import { useQuery } from "@/components/workspace/query";
import { LiveFailure } from "@/components/workspace/states";
import { councilWords } from "@/components/workspace/reports/council-words";
import { sayRefused } from "@/lib/refusals";

/**
 * The conference's side of a council, in Your files: its code to give the council, and each council's invitation to
 * accept, decline or leave. It draws nothing unless the person is the owner of a real conference.
 */
export default function CouncilLink() {
  const { data, isOwner } = useWorkspace();
  if (!isOwner || data.church.sample) return null;
  return <CouncilLinkLeaf />;
}

function CouncilLinkLeaf() {
  const { data, words } = useWorkspace();
  const w = councilWords(words.locale);
  const seen = useQuery(api.councils.forConference, { churchId: data.church.id });
  const accept = useMutation(api.councils.accept);
  const unlink = useMutation(api.councils.unlink);
  const [said, setSaid] = useState("");
  // Leaving a council is asked once more first: only a new invitation from it joins the two again.
  const [leaving, setLeaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const run = async (work: () => Promise<unknown>, done: string) => {
    setError("");
    setSaid("");
    try {
      await work();
      setSaid(done);
    } catch (problem) {
      setError(problem instanceof ConvexError && typeof problem.data === "string" ? sayRefused(words.notices, problem.data) : w.failed);
    }
  };
  return (
    <section className="tools-leaf" aria-labelledby="council-link-name">
      <h2 id="council-link-name"><Landmark size={18} aria-hidden="true" /> {w.joinTitle}</h2>
      <p className="tools-leaf-deck">{w.joinDeck}</p>
      {error && <LiveFailure message={error} kept="" />}
      <p className="tools-small" role="status">{said}</p>
      {seen === undefined ? (
        <LiveLoading label={w.loading} />
      ) : (
        <>
          <p className="tools-small">
            {w.code}: <code className="council-code">{seen.code}</code>
            <br />
            {w.codeDeck}
          </p>
          <ul className="council-list">
            {seen.councils.map((row) => (
              <li key={row.id}>
                <span>{row.status === "accepted" ? w.countedBy(row.name) : w.invitedBy(row.name)}</span>{" "}
                {row.status === "pending" && <Button onClick={() => void run(() => accept({ linkId: row.id }), w.accepted)}>{w.accept}</Button>}{" "}
                {leaving === row.id ? (
                  <>
                    <span className="tools-small">{w.leaveQuestion}</span>{" "}
                    <Button variant="outline" onClick={() => void run(() => unlink({ linkId: row.id }), w.left).then(() => setLeaving(null))}>{w.leaveSure}</Button>{" "}
                    <Button variant="ghost" onClick={() => setLeaving(null)}>{w.stay}</Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => (row.status === "accepted" ? setLeaving(row.id) : void run(() => unlink({ linkId: row.id }), w.left))}>
                    {row.status === "accepted" ? w.leave : w.decline}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
