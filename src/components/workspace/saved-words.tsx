/**
 * The words of a saved line. Each sentence stays whole where the line allows, so the line breaks after the
 * first sentence, and the words of a person's name are never parted.
 */
export function SavedWords({ children }: { children: string }) {
  const sentences = children.split(/(?<=\p{L}{3}[.!?])\s+/u);
  return (
    <span>
      {sentences.map((sentence, at) => (
        <span className="live-said" key={at}>
          {sentence.replace(/(\p{Lu}[\p{L}'’-]*) (?=\p{Lu})/gu, "$1 ")}
          {at < sentences.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}
