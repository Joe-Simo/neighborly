export type ScrollCareCompletion = readonly [boolean, boolean, boolean];

/** Initial/restored state is silent; a forward jump accents only its latest new completion. */
export function getScrollCareCue(previous: ScrollCareCompletion | undefined, next: ScrollCareCompletion): 0 | 1 | 2 | null {
  if (!previous) return null;
  for (const index of [2, 1, 0] as const) {
    if (next[index] && !previous[index]) return index;
  }
  return null;
}
