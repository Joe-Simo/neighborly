"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";

/**
 * The way back on a saved line. It stays as long as the line does (ten seconds, longer while a hand or the focus is
 * on it) and runs the act's own reverse on the server, under the same rules as the act. The room says what came of it.
 */
export function UndoAct({ run }: { run: () => Promise<void> }) {
  const { words } = useWorkspace();
  const [going, setGoing] = useState(false);
  return (
    <Button
      variant="link"
      className="help-text-action"
      disabled={going}
      onClick={async () => {
        setGoing(true);
        try {
          await run();
        } finally {
          setGoing(false);
        }
      }}
    >
      {words.tasks.undo}
    </Button>
  );
}
