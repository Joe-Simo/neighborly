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
  // Scroll at 4x CPU, measured 2026-11-19 on main d1336ef (scroll-ios 0001) in the cloud (software GL, so an upper bound; set again from the Mac).
  longTasks: 185, // 158-164
  longestTaskMs: 3000, // 1797-2624, the opening's scene built in software GL
  idleFramesPerSecond: 0, // 0: nothing asks for frames once the page is still
  forcedLayouts: 135, // 117-118
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

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const executablePath = process.env.BUDGET_BROWSER;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : { channel: "chrome" }),
  args: ["--enable-precise-memory-info", ...(process.platform === "linux" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [])],
});
const found = { longTasks: 0, longestTaskMs: 0, idleFramesPerSecond: 0, forcedLayouts: 0, firstLoadJsKB: {} as Record<Route, number>, webglTextureMB: 0, webglTextureAtEndMB: 0, layerMegapixels: 0, decodedImageMB: 0, jsHeapMB: 0, roomsHeapMB: 0 };
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

  // Home again, scrolled top to bottom at a steady thumb's pace on a phone four times slower, then left still at the end.
  const smooth = await browser.newContext(phone);
  await smooth.addInitScript(watchScroll);
  const scrollPage = await smooth.newPage();
  const scrollSession = await smooth.newCDPSession(scrollPage);
  await scrollPage.goto(base + "/", { waitUntil: "networkidle", timeout: 60000 });
  await scrollPage.waitForTimeout(9000);
  await scrollSession.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await scrollPage.evaluate(() => window.__scroll?.tasks());
  await browser.startTracing(scrollPage, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline.stack"] });
  await scrollPage.evaluate(() => new Promise<void>((done) => {
    const step = () => {
      window.scrollBy(0, 24);
      if (window.scrollY + innerHeight >= document.documentElement.scrollHeight - 1) done();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
  const trace = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: { name: string; args?: { beginData?: { stackTrace?: unknown[] } } }[] };
  found.forcedLayouts = trace.traceEvents.filter((event) => event.name === "Layout" && (event.args?.beginData?.stackTrace?.length ?? 0) > 0).length;
  const tasks = await scrollPage.evaluate(() => window.__scroll?.tasks() ?? []);
  found.longTasks = tasks.length;
  found.longestTaskMs = Math.max(0, ...tasks);
  await scrollPage.waitForTimeout(2000);
  await scrollPage.evaluate(() => window.__scroll?.frames());
  await scrollPage.waitForTimeout(3000);
  found.idleFramesPerSecond = ((await scrollPage.evaluate(() => window.__scroll?.frames())) ?? 0) / 3;
  await smooth.close();

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
for (const route of ROUTES) check(`First-load JS ${route} (KB)`, found.firstLoadJsKB[route], BUDGET.firstLoadJsKB[route]);
console.log(over.length ? `\nOver budget: ${over.join(", ")}` : "\nWithin budget.");
process.exit(over.length ? 1 : 0);
