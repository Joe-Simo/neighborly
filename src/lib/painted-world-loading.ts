/** Dispose successful siblings, including late arrivals, when a resource batch fails. */
export async function loadResourceBatch<T>(
  sources: readonly string[],
  load: (source: string) => Promise<T>,
  release: (resource: T) => void,
): Promise<T[]> {
  let failed = false;
  const acquired = new Set<T>();
  return Promise.all(sources.map(async (source) => {
    try {
      const resource = await load(source);
      if (failed) release(resource);
      else acquired.add(resource);
      return resource;
    } catch (error) {
      if (!failed) {
        failed = true;
        acquired.forEach(release);
        acquired.clear();
      }
      throw error;
    }
  }));
}

/** An asset set is ready only for the layout revision that is still current. */
export async function loadForCurrentRevision<T>(
  revision: () => string,
  load: () => Promise<T>,
  cancelled: () => boolean,
): Promise<T> {
  while (!cancelled()) {
    const requested = revision();
    const resource = await load();
    if (cancelled()) break;
    if (requested === revision()) return resource;
  }
  throw new DOMException("Painted scene loading was cancelled.", "AbortError");
}
