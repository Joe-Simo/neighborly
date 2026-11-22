import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { LiveField } from "@/components/workspace/primitives";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import { words as wordsFor } from "@/lib/words";
import { helpLineFormsWords } from "@/lib/words/rooms/help-line-forms";

const english = wordsFor();

export const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The box where a name is typed to confirm an act that cannot be undone. While the person types, nothing is
 * said. When they leave the box or press Enter with something in it that is not the name, one quiet line
 * gives the name as it is written; it goes as soon as they type again.
 */
export function NameToConfirm({
  label,
  name,
  typed,
  onTyped,
}: {
  label: string;
  name: string;
  typed: string;
  onTyped: (typed: string) => void;
}) {
  const note = useId();
  const w = helpLineFormsWords((useWorkspaceIfAny()?.words ?? english)).confirm;
  const [left, setLeft] = useState(false);
  const off = left && typed.trim() !== "" && nameKey(typed) !== nameKey(name);
  return (
    <LiveField label={label}>
      <Input
        value={typed}
        onChange={(event) => {
          setLeft(false);
          onTyped(event.target.value);
        }}
        onBlur={() => setLeft(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") setLeft(true);
        }}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        aria-describedby={off ? note : undefined}
        required
      />
      {off && (
        <small id={note} className="live-field-needed" role="status">
          {w.noMatch}{" "}
          <span className={name.length <= 28 ? "help-name-whole" : undefined}>{name}.</span>
        </small>
      )}
    </LiveField>
  );
}
