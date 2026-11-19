/** A line's sentences: it parts at a space that follows a word of three letters or more and a full stop, without a
 * lookbehind (Safari before 16.4 cannot parse one). */
export function sentencesOf(line: string): string[] {
  const sentences: string[] = [];
  let from = 0;
  for (const gap of line.matchAll(/\s+/g)) {
    if (!/\p{L}{3}[.!?]$/u.test(line.slice(0, gap.index))) continue;
    sentences.push(line.slice(from, gap.index));
    from = gap.index + gap[0].length;
  }
  sentences.push(line.slice(from));
  return sentences;
}

/**
 * The words of a saved line. Each sentence stays whole where the line allows, so the line breaks after the
 * first sentence, and the words of a person's name are never parted.
 */
export function SavedWords({ children }: { children: string }) {
  const sentences = sentencesOf(children);
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
