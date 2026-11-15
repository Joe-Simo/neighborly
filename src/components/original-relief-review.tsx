"use client";

import { useCallback, useState } from "react";
import { ReliefStage } from "@/components/relief-stage";
import { reliefArtwork } from "@/lib/artwork";

/** The approved artwork remains the reference while replacement studies are revised. */
export function OriginalReliefReview() {
  const [ready, setReady] = useState(false);
  const posterStatus = useCallback(() => {}, []);
  return <div className="original-relief-review">
    <ReliefStage artwork={reliefArtwork} outcome="rest" view="group" paused={false}
      ready={ready} onReadyChange={setReady} attempt={0} isHero posterAttempt={0}
      onPosterStatusChange={posterStatus} />
  </div>;
}
