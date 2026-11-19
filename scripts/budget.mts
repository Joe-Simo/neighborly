// Memory and first-load budget gate. Usage: bun run budget [base URL of a production build, default http://localhost:3196]
// Rooms: ROOMS_URL, default <base>/tools-sketch?area=week&switch=1 from the mac-rig. BUDGET_BROWSER: a Chromium binary (else installed Chrome). Exit 1 when over budget.
import { chromium, type CDPSession, type Page } from "playwright-core";

// Measured 2026-11-19 on main d978d44 with home-memory 0001 and 0002, production build, Chromium at 390×844 3x: about 15% margin, 5% on JS.
// Raise a budget only with the reason in the landing note: each was set to catch the home crash coming back.
const BUDGET = {
  webglTextureMB: 87, // measured 75.4 at its height
  webglTextureAtEndMB: 8, // 0: the scenes give their memory back once the reader is two windows past them (75 before home-memory 0001)
  layerMegapixels: 65, // 56.4
  decodedImageMB: 65, // 56.6
  jsHeapMB: 12, // 8.6 (the heap moves more between runs and engines, so a wider margin)
  roomsHeapMB: 12, // 8.6
  // Scroll at 4x CPU, measured 2026-11-19 on main f9723d1 (scroll-ios 0002) in the cloud (software GL, so an upper bound; set again from the Mac).
  longTasks: 1, // 0 on the Mac at a6e1573 + this batch (4x CPU); one allowed for noise
  longestTaskMs: 50, // 0 on the Mac: no task reached 50 ms, the long-task floor
  idleFramesPerSecond: 0, // 0: nothing asks for frames once the page is still
  forcedLayouts: 18, // 16 on the Mac at a6e1573 + this batch, about 15% over
  // Each of the 13 rooms scrolled the same way, worst room, measured on f9723d1: 1 forced layout, no long task, no frames once still.
  roomForcedLayouts: 5,
  roomLongTasks: 3,
  roomLongestTaskMs: 200,
  roomIdleFramesPerSecond: 0,
  // Cold at 4x CPU on Slow 4G, measured 2026-11-19 on main a6e1573 in the cloud, two runs.
  lcpMs: { "/": 1500, "/about": 1500, "/made": 1200, "/privacy": 1400, "/week": 1200, "/sign-in": 1200 }, // 1216-1232, 1232-1240, 976-980, 1132-1172, 956-980, 976-992
  clsMilli: 10, // CLS × 1000: 0.1 at most (0.0001 CLS), against the web's 100 for good
  inpMs: 200, // 16-80 for one tap on the first words; the web's line for good
  firstLoadJsKB: { "/": 900, "/about": 890, "/made": 820, "/privacy": 885, "/week": 820, "/sign-in": 820 }, // 854, 844, 780, 841, 780, 780
} as const;

type Route = keyof typeof BUDGET.firstLoadJsKB;
const ROUTES = Object.keys(BUDGET.firstLoadJsKB) as Route[];
const ROOMS = ["week", "team", "people", "commitments", "mine", "time-off", "tasks", "help-line", "neighbors", "visits", "treasury", "reports", "tools"];
const MB = 1024 * 1024;

const base = (process.argv[2] ?? "http://localhost:3196").replace(/\/$/, "");
const roomsUrl = process.env.ROOMS_URL ?? `${base}/tools-sketch?area=week&switch=1`;

declare global {
  interface Window { __textureBytes?: () => number }
}

// Counts every WebGL texture's bytes as it is uploaded and lets it go when deleted: the GPU memory Safari counts against the tab.
const countTextures = () => {
  const live = new Map<WebGLTexture, number>();
  const bound = new WeakMap<object, WebGLTexture | null>();
  const sized = (source: unknown) => source !== null && typeof source === "object" && "width" in source;
  const size = (args: unknown[]) => {
    const source = args.find(sized) as { width: number; height: number; naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number } | undefined;
    const [w, h] = source
      ? [source.naturalWidth || source.videoWidth || source.width, source.naturalHeight || source.videoHeight || source.height]
      : [Number(args[3]), Number(args[4])];
    return (w || 0) * (h || 0) * 4;
  };
  for (const Gl of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const proto: WebGL2RenderingContext = Gl.prototype as WebGL2RenderingContext;
    const { texImage2D, texStorage2D, bindTexture, deleteTexture } = proto;
    proto.bindTexture = function (target, texture) { bound.set(this, texture); return bindTexture.call(this, target, texture); };
    proto.texImage2D = function (this: WebGL2RenderingContext, ...args: unknown[]) {
      const texture = bound.get(this);
      if (args[1] === 0 && texture) live.set(texture, size(args));
      return (texImage2D as (...a: unknown[]) => void).apply(this, args);
    } as typeof texImage2D;
    if (texStorage2D) proto.texStorage2D = function (target, levels, format, w, h) {
      const texture = bound.get(this);
      if (texture) live.set(texture, w * h * 4 * (levels > 1 ? 4 / 3 : 1));
      return texStorage2D.call(this, target, levels, format, w, h);
    };
    proto.deleteTexture = function (texture) { if (texture) live.delete(texture); return deleteTexture.call(this, texture); };
  }
  window.__textureBytes = () => [...live.values()].reduce((sum, bytes) => sum + bytes, 0);
};

/**
 * Candidate layer area: every element the browser is likely to give its own GPU layer (will-change, a 3D transform,
 * fixed or sticky, a canvas or video, a running transform or opacity animation), at its full painted size and the
 * screen's scale. Safari holds each such layer as a bitmap, which is what ran the phone out of memory.
 */
const candidateArea = (scale: number) => {
  let area = 0;
  for (const element of document.querySelectorAll("body *")) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const own = /transform|opacity|filter/.test(style.willChange) || /matrix3d|translate3d|translateZ|rotate[XY]|perspective/.test(style.transform)
      || style.position === "fixed" || style.position === "sticky" || element.tagName === "CANVAS" || element.tagName === "VIDEO"
      || element.getAnimations().some((move) => move.playState === "running" && move.effect instanceof KeyframeEffect
        && move.effect.getKeyframes().some((frame) => "transform" in frame || "opacity" in frame || "translate" in frame));
    if (!own) continue;
    const box = element.getBoundingClientRect();
    area += Math.min(box.width, 16384) * Math.min(box.height, 16384) * scale * scale;
  }
  return area;
};

async function measure(page: Page, session: CDPSession) {
  await session.send("HeapProfiler.collectGarbage");
  const { usedSize: heap } = await session.send("Runtime.getHeapUsage");
  const { images, textures } = await page.evaluate(() => {
    let images = 0;
    for (const image of document.images) if (image.complete) images += image.naturalWidth * image.naturalHeight * 4;
    return { images, textures: window.__textureBytes?.() ?? 0 };
  });
  const layers = await page.evaluate(candidateArea, 3);
  return { heap, images, textures, layers };
}

// Scroll smoothness: the long tasks, the frame callbacks still asked for off screen, and the layouts a script forces while scrolling.
const watchScroll = () => {
  const tasks: number[] = [];
  new PerformanceObserver((list) => { for (const entry of list.getEntries()) tasks.push(entry.duration); }).observe({ type: "longtask" });
  let frames = 0;
  const ask = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => ask((time) => { frames += 1; callback(time); });
  window.__scroll = { tasks: () => tasks.splice(0), frames: () => { const now = frames; frames = 0; return now; } };
};

declare global {
  interface Window { __scroll?: { tasks: () => number[]; frames: () => number } }
}

/** Scrolls a page top to bottom at 4x CPU by wheel from outside it, then leaves it still: forced layouts, long tasks (ms each), frames per second asked for once still. */
async function scrollOnce(url: string, settle: number) {
  const context = await browser.newContext(phone);
  await context.addInitScript(watchScroll);
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(settle);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => window.__scroll?.tasks());
  // The farthest any part scrolls: the page itself, or a room's own scrolling column.
  const distance = await page.evaluate(() => Math.max(0, ...[document.documentElement, ...document.querySelectorAll("body *")]
    .filter((element) => element === document.documentElement || /auto|scroll/.test(getComputedStyle(element).overflowY))
    .map((element) => element.scrollHeight - element.clientHeight)));
  await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline.stack"] });
  // Wheel scrolling sent by the browser from outside the page (a synthesized touch did not move it under phone emulation), so the measuring itself forces no layout.
  if (distance > 0) await session.send("Input.synthesizeScrollGesture", { x: 195, y: 600, yDistance: -distance, speed: 1440, gestureSourceType: "mouse", preventFling: true });
  const trace = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: { name: string; args?: { beginData?: { stackTrace?: unknown[] } } }[] };
  const forced = trace.traceEvents.filter((event) => event.name === "Layout" && (event.args?.beginData?.stackTrace?.length ?? 0) > 0).length;
  const tasks = await page.evaluate(() => window.__scroll?.tasks() ?? []);
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__scroll?.frames());
  await page.waitForTimeout(3000);
  const idle = ((await page.evaluate(() => window.__scroll?.frames())) ?? 0) / 3;
  await context.close();
  return { forced, tasks, idle };
}

// Load quality: the largest paint and what it was, every layout shift and what moved, and the slowest response to a tap.
const watchLoad = () => {
  const name = (node: Node | null | undefined) => {
    if (!(node instanceof Element)) return node ? node.nodeName.toLowerCase() : "?";
    const id = node.id ? `#${node.id}` : "", kind = node.classList[0] ? `.${node.classList[0]}` : "";
    const what = node instanceof HTMLImageElement ? ` ${node.currentSrc.split("/").pop()?.split("?")[0] ?? ""}`
      : node instanceof HTMLAnchorElement ? ` → ${node.getAttribute("href") ?? ""}`
      : ` "${(node.textContent ?? "").trim().slice(0, 40)}"`;
    return `${node.tagName.toLowerCase()}${id}${kind}${what}`;
  };
  const load = { lcp: 0, lcpElement: "", cls: 0, shifted: new Set<string>(), inp: 0 };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { element?: Element | null })[]) { load.lcp = entry.startTime; load.lcpElement = name(entry.element); }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node | null }[] })[]) {
      if (entry.hadRecentInput) continue;
      load.cls += entry.value;
      for (const source of entry.sources ?? []) load.shifted.add(name(source.node));
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { interactionId?: number })[]) if (entry.interactionId) load.inp = Math.max(load.inp, entry.duration);
  }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  window.__load = () => ({ lcp: load.lcp, lcpElement: load.lcpElement, cls: load.cls, shifted: [...load.shifted], inp: load.inp });
};

declare global {
  interface Window { __load?: () => { lcp: number; lcpElement: string; cls: number; shifted: string[]; inp: number } }
}

/** A route opened cold at 4x CPU on Slow 4G (Lighthouse's mobile network), then tapped once on its first heading. */
async function loadOnce(url: string) {
  const context = await browser.newContext(phone);
  await context.addInitScript(watchLoad);
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(3000);
  // A tap on words, never on a link, so the page stays where it is.
  const heading = page.locator("h1, h2, p").first();
  const box = await heading.boundingBox();
  if (box) await page.touchscreen.tap(box.x + Math.min(8, box.width / 2), box.y + Math.min(8, box.height / 2));
  await page.waitForTimeout(1000);
  const found = await page.evaluate(() => window.__load?.());
  await context.close();
  return found ?? { lcp: 0, lcpElement: "?", cls: 0, shifted: [], inp: 0 };
}

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const executablePath = process.env.BUDGET_BROWSER;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : { channel: "chrome" }),
  args: ["--enable-precise-memory-info", ...(process.platform === "linux" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [])],
});
const loads = {} as Record<Route, Awaited<ReturnType<typeof loadOnce>>>;
const found = { roomForcedLayouts: 0, roomLongTasks: 0, roomLongestTaskMs: 0, roomIdleFramesPerSecond: 0, longTasks: 0, longestTaskMs: 0, idleFramesPerSecond: 0, forcedLayouts: 0, firstLoadJsKB: {} as Record<Route, number>, webglTextureMB: 0, webglTextureAtEndMB: 0, layerMegapixels: 0, decodedImageMB: 0, jsHeapMB: 0, roomsHeapMB: 0 };
try {
  // First-load JavaScript per route: every script the server's page names (script and modulepreload), as Next counts it.
  for (const route of ROUTES) {
    const html = await (await fetch(base + route)).text();
    const sources = new Set([...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="([^"]+\.js[^"]*)"/g)].map((match) => new URL(match[1].replace(/&amp;/g, "&"), base + route).href));
    let bytes = 0;
    for (const source of sources) bytes += (await (await fetch(source)).arrayBuffer()).byteLength;
    found.firstLoadJsKB[route] = Math.round(bytes / 1024);
  }

  // Home, top to bottom and back, as a phone scrolls it.
  const context = await browser.newContext(phone);
  await context.addInitScript(countTextures);
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 60000 });
  // The opening's 3D comes once the page has been still, at the latest 8 s in.
  await page.waitForTimeout(9000);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const take = async () => {
    const now = await measure(page, session);
    found.jsHeapMB = Math.max(found.jsHeapMB, now.heap / MB);
    found.decodedImageMB = Math.max(found.decodedImageMB, now.images / MB);
    found.webglTextureMB = Math.max(found.webglTextureMB, now.textures / MB);
    found.layerMegapixels = Math.max(found.layerMegapixels, now.layers / 1e6);
  };
  const down = [...Array(Math.ceil(height / 400)).keys()];
  for (const stops of [down, [...down].reverse()])
    for (const stop of stops) {
      await page.evaluate((y) => window.scrollTo(0, y), stop * 400);
      await page.waitForTimeout(120);
      if (stop % 5 === 0) await take();
      if (stops[0] === 0 && stop === stops.length - 1) {
        await page.waitForTimeout(1000);
        found.webglTextureAtEndMB = (await measure(page, session)).textures / MB;
      }
    }
  await page.waitForTimeout(1000);
  await take();
  await context.close();

  // Each public page cold, at a phone's CPU and network.
  for (const route of ROUTES) loads[route] = await loadOnce(base + route);

  // Home again, scrolled top to bottom at a steady thumb's pace on a phone four times slower, then left still at the end.
  const home = await scrollOnce(base + "/", 9000);
  found.forcedLayouts = home.forced;
  found.longTasks = home.tasks.length;
  found.longestTaskMs = Math.max(0, ...home.tasks);
  found.idleFramesPerSecond = home.idle;

  // Each of the thirteen rooms, scrolled the same way in its own document.
  for (const room of ROOMS) {
    const each = await scrollOnce(`${base}/tools-sketch?area=${room}`, 2000);
    found.roomForcedLayouts = Math.max(found.roomForcedLayouts, each.forced);
    found.roomLongTasks = Math.max(found.roomLongTasks, each.tasks.length);
    found.roomLongestTaskMs = Math.max(found.roomLongestTaskMs, ...each.tasks);
    found.roomIdleFramesPerSecond = Math.max(found.roomIdleFramesPerSecond, each.idle);
  }

  // Thirteen room switches in one document, the way a volunteer walks the rooms.
  const rooms = await browser.newContext(phone);
  const roomPage = await rooms.newPage();
  const roomSession = await rooms.newCDPSession(roomPage);
  await roomSession.send("Performance.enable");
  await roomPage.goto(roomsUrl, { waitUntil: "networkidle", timeout: 60000 });
  for (const room of [...ROOMS.slice(1), ROOMS[0]]) {
    await roomPage.evaluate((area) => { const link = document.createElement("a"); link.href = `/app/${area}`; document.body.append(link); link.click(); link.remove(); }, room);
    await roomPage.waitForTimeout(900);
  }
  found.roomsHeapMB = (await measure(roomPage, roomSession)).heap / MB;
  await rooms.close();
} finally {
  await browser.close();
}

const over: string[] = [];
const check = (name: string, value: number, limit: number) => {
  const within = value <= limit;
  if (!within) over.push(name);
  console.log(`${within ? "ok  " : "OVER"} ${name.padEnd(28)} ${value.toFixed(1).padStart(8)}  budget ${limit}`);
};
check("WebGL textures (MB)", found.webglTextureMB, BUDGET.webglTextureMB);
check("WebGL textures at the end (MB)", found.webglTextureAtEndMB, BUDGET.webglTextureAtEndMB);
check("Layer area (megapixels)", found.layerMegapixels, BUDGET.layerMegapixels);
check("Decoded images (MB)", found.decodedImageMB, BUDGET.decodedImageMB);
check("JS heap, home (MB)", found.jsHeapMB, BUDGET.jsHeapMB);
check("JS heap, 13 rooms (MB)", found.roomsHeapMB, BUDGET.roomsHeapMB);
check("Long tasks, scroll 4x CPU", found.longTasks, BUDGET.longTasks);
check("Longest task, scroll (ms)", found.longestTaskMs, BUDGET.longestTaskMs);
check("Frames/s still at the end", found.idleFramesPerSecond, BUDGET.idleFramesPerSecond);
check("Forced layouts, scroll", found.forcedLayouts, BUDGET.forcedLayouts);
check("Rooms: forced layouts, worst", found.roomForcedLayouts, BUDGET.roomForcedLayouts);
check("Rooms: long tasks, worst", found.roomLongTasks, BUDGET.roomLongTasks);
check("Rooms: longest task (ms)", found.roomLongestTaskMs, BUDGET.roomLongestTaskMs);
check("Rooms: frames/s still", found.roomIdleFramesPerSecond, BUDGET.roomIdleFramesPerSecond);
for (const route of ROUTES) {
  const load = loads[route];
  check(`LCP ${route} (ms)`, load.lcp, BUDGET.lcpMs[route]);
  console.log(`       largest paint: ${load.lcpElement}`);
  check(`CLS ${route} (x1000)`, load.cls * 1000, BUDGET.clsMilli);
  if (load.shifted.length) console.log(`       shifted: ${load.shifted.join(", ")}`);
  check(`INP ${route}, a tap (ms)`, load.inp, BUDGET.inpMs);
}
for (const route of ROUTES) check(`First-load JS ${route} (KB)`, found.firstLoadJsKB[route], BUDGET.firstLoadJsKB[route]);
console.log(over.length ? `\nOver budget: ${over.join(", ")}` : "\nWithin budget.");
process.exit(over.length ? 1 : 0);
