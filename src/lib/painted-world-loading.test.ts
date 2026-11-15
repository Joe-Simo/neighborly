import { expect, test } from "bun:test";
import { loadForCurrentRevision, loadResourceBatch } from "./painted-world-loading";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test("failed asset batches release earlier successes and late arrivals once", async () => {
  const requests = new Map(["background", "foreground", "pose"].map((name) => [name, deferred<string>()]));
  const released: string[] = [];
  const batch = loadResourceBatch([...requests.keys()], (name) => requests.get(name)!.promise, (resource) => released.push(resource));
  requests.get("background")!.resolve("background-texture");
  await flush();
  requests.get("foreground")!.reject(new Error("Missing foreground"));
  await expect(batch).rejects.toThrow("Missing foreground");
  expect(released).toEqual(["background-texture"]);
  requests.get("pose")!.resolve("late-pose-texture");
  await flush();
  expect(released).toEqual(["background-texture", "late-pose-texture"]);
});

test("successful asset batches preserve source order without disposing resources", async () => {
  const released: string[] = [];
  const resources = await loadResourceBatch(["background", "foreground"], async (name) => `${name}-texture`, (value) => released.push(value));
  expect(resources).toEqual(["background-texture", "foreground-texture"]);
  expect(released).toEqual([]);
});

test("readiness reloads when the asset source changes without changing portrait mode", async () => {
  let revision = "portrait:narrow.webp";
  const requests: ReturnType<typeof deferred<string>>[] = [];
  const ready = loadForCurrentRevision(() => revision, () => {
    const request = deferred<string>();
    requests.push(request);
    return request.promise;
  }, () => false);
  revision = "portrait:desktop.webp";
  requests[0].resolve("old source");
  await flush();
  expect(requests).toHaveLength(2);
  requests[1].resolve("current source");
  expect(await ready).toBe("current source");
});

test("cancelled readiness never returns a completed obsolete request", async () => {
  let cancelled = false;
  const request = deferred<string>();
  const ready = loadForCurrentRevision(() => "layout", () => request.promise, () => cancelled);
  cancelled = true;
  request.resolve("obsolete");
  await expect(ready).rejects.toThrow("Painted scene loading was cancelled");
});
