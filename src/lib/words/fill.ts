/**
 * A sentence with named places, filled: fill("Saved on {name}'s record.", { name }) . The sentence is written whole in
 * each language with its places where that language wants them; a place that is given no value is left as written.
 */
export function fill(sentence: string, values: Record<string, string | number>) {
  return sentence.replace(/\{(\w+)\}/g, (place, name: string) => (name in values ? String(values[name]) : place));
}
