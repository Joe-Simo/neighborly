/**
 * A sentence with named places, filled: fill("Saved on {name}'s record.", { name }) . The sentence is written whole in
 * each language with its places where that language wants them; a place that is given no value is left as written.
 */
export function fill(sentence: string, values: Record<string, string | number>) {
  // A value that ends in its own point ("10:00 a.m.") takes the place of the sentence's full stop, never adds a second.
  return sentence.replace(/\{(\w+)\}(\.?)/g, (place, name: string, stop: string) => {
    if (!(name in values)) return place;
    const value = String(values[name]);
    return stop && value.endsWith(".") ? value : value + stop;
  });
}
