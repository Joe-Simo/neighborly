"use client";

import { COURTYARD_STILL, type CourtyardStill } from "./courtyard-door";
import { useEffect, useRef } from "react";
import { whenIdle } from "@/lib/idle";
import { frameStep } from "@/lib/scroll-frame";
import { ImageBitmapLoader, LinearFilter, LinearMipmapLinearFilter, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Texture, Vector2, Vector4, WebGLRenderer } from "three";

const vertex = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

// The courtyard painting drawn as a place: depth measured from the painting, a sun that can move, dusk, and the people on their own cards.
// It is laid exactly where the painted layer sits on the page, so everything placed over the painting stays in register.
const fragment = /* glsl */ `
precision highp float;
uniform sampler2D uMap, uDepth, uNormal, uFigures, uIdle, uAnswer;
uniform vec2 uRes, uView, uSun;
uniform vec4 uRect;
uniform float uDolly, uAlive, uDusk, uLook, uTurn, uWelcome, uResponse, uTime, uWarm;
varying vec2 vUv;
const float FOCUS = .24;
const float IMAGE = 2.;
const vec2 HALL = vec2(.885, .44);
const vec2 PX = vec2(1. / 1774., 1. / 887.);

// The two near pillars stand at the picture's side edges. Lifted from the wall they would uncover a strip with nothing behind it, which shows as upright streaks; so towards each side edge everything settles onto the plane that does not move.
float depthAt(vec2 t){ float edge = smoothstep(.03, .12, t.x) * smoothstep(.97, .88, t.x); return mix(FOCUS, texture2D(uDepth, clamp(t, 0., 1.)).r, edge); }
float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cover(){ return max(uRect.z / IMAGE, uRect.w); }
// The painting fills its box the way the page's own image does: centred, covering.
vec2 paintingAt(vec2 px){ return .5 + (px - uRect.xy - uRect.zw * .5) / (cover() * vec2(IMAGE, 1.)); }
// Where a ray through painting point b lands if the surface sits at nearness h. The table and everything beyond it stay exactly in place; only the near world grows.
vec2 texAt(vec2 b, vec2 pivot, float h){ return pivot + (b - pivot - uView * (h - FOCUS)) / (1. + uDolly * max(h - FOCUS, 0.)); }

vec3 reliefAt(sampler2D image, vec2 t){
  float gx = lum(texture2D(image, t - vec2(PX.x * 1.5, 0.)).rgb) - lum(texture2D(image, t + vec2(PX.x * 1.5, 0.)).rgb);
  float gy = lum(texture2D(image, t - vec2(0., PX.y * 1.5)).rgb) - lum(texture2D(image, t + vec2(0., PX.y * 1.5)).rgb);
  return vec3(gx, gy, 0.) * 1.6;
}

// The painting already holds one light. This moves it: brighter where a surface turns to the new sun, darker where it turns away.
vec3 relight(vec3 col, vec3 n, vec2 t, float d){
  vec3 sun = normalize(vec3(uSun, .62));
  vec3 painted = normalize(vec3(-.45, -.55, .62));
  float lit = clamp(dot(n, sun) - dot(n, painted), -.3, .34) * uAlive;
  float shade = 0.;
  for (int i = 1; i <= 6; i++) {
    float reach = float(i) * .009;
    shade = max(shade, smoothstep(.015, .09, depthAt(t + sun.xy * vec2(reach, reach * 2.)) - d - reach * .9) * (1. - float(i) / 8.));
  }
  col *= 1. + lit * .95;
  col += lit * vec3(.05, .02, -.03);
  col *= 1. - shade * .3 * uAlive;
  col = mix(col, vec3(.99, .87, .69), (1. - smoothstep(0., .3, d)) * .09 * uAlive);
  float hall = smoothstep(.2, .09, d) * smoothstep(.78, .81, t.x) * smoothstep(.16, .26, t.y) * smoothstep(.7, .62, t.y);
  vec2 away = (HALL - t) * vec2(IMAGE, 1.);
  float glow = exp(-length(away) * 3.4) * (.35 + max(0., dot(n, normalize(vec3(away, .3))))) * 1.5 + hall;
  vec3 night = col * vec3(.4, .46, .68) + vec3(0., .004, .018);
  night = mix(night, col * vec3(1.22, .98, .68), clamp(glow, 0., 1.));
  // Once the wall has opened the day's light warms a little, and stays.
  col *= mix(vec3(1.), vec3(1.07, 1.01, .9), uWarm * (.45 + .55 * smoothstep(.1, .7, lum(col))));
  return mix(col, night, uDusk);
}

// One painting of a person, cut to their half of the courtyard.
vec4 poseAt(sampler2D pose, vec2 t, float side){
  vec4 figure = texture2D(pose, t);
  figure.a *= step(0., (t.x - .7) * side) * step(0., t.y) * step(t.y, 1.);
  return vec4(figure.rgb * figure.a, figure.a);
}

// The raised hand truly waves: the forearm swings about the elbow while the rest of the painting holds still.
vec2 waveAt(vec2 t){
  const vec2 ELBOW = vec2(.8292, .5254);
  float hold = 1. - smoothstep(.7, 1.15, length((t - vec2(.8281, .5062)) / PX / vec2(12., 21.)));
  float swing = sin(uTime * 10.) * .2 * hold;
  vec2 arm = (t - ELBOW) / PX;
  return ELBOW + vec2(arm.x * cos(swing) - arm.y * sin(swing), arm.x * sin(swing) + arm.y * cos(swing)) * PX;
}

// A person stands on their own card at one distance, lifted from the painting, and breathes around their feet.
// Each was painted three times: at rest, noticing you, and answering. One whole painting dissolves into the next, and the result is lit once.
vec3 person(vec3 col, vec2 b, vec2 pivot){
  float side = texAt(b, pivot, .19).x < .7 ? -1. : 1.;
  bool woman = side < 0.;
  float nearness = woman ? .225 : .158;
  vec2 feet = woman ? vec2(.472, .572) : vec2(.852, .623);
  float noticing = woman ? uLook : uTurn;
  float answering = woman ? uWelcome : uResponse;
  vec2 t = texAt(b, pivot, nearness);
  float turn = sin(uTime * (woman ? .55 : .43)) * .007;
  vec2 arm = (t - feet) * vec2(IMAGE, 1.);
  t = feet + vec2(arm.x * cos(turn) - arm.y * sin(turn), arm.x * sin(turn) + arm.y * cos(turn)) / vec2(IMAGE, 1.);
  vec4 seen = poseAt(uFigures, t, side);
  vec3 relief = reliefAt(uFigures, t);
  if (noticing > .002) { seen = mix(seen, poseAt(uIdle, t, side), noticing); relief = mix(relief, reliefAt(uIdle, t), noticing); }
  if (answering > .002) { vec2 a = woman ? t : waveAt(t); seen = mix(seen, poseAt(uAnswer, a, side), answering); relief = mix(relief, reliefAt(uAnswer, a), answering); }
  if (seen.a < .004) return col;
  return mix(col, relight(seen.rgb / seen.a, normalize(vec3(0., 0., 1.) + relief), t, nearness), seen.a);
}

void main(){
  vec2 s = vec2(vUv.x, 1. - vUv.y);
  vec2 b = paintingAt(s * uRes);
  vec2 pivot = paintingAt(uRes * .5);

  float hit = 1.;
  float above = depthAt(texAt(b, pivot, 1.)) - 1.;
  if (above < 0.) {
    float lastH = 1.;
    hit = 0.;
    for (int i = 1; i <= 30; i++) {
      float h = 1. - float(i) / 30.;
      float diff = depthAt(texAt(b, pivot, h)) - h;
      if (diff >= 0.) { hit = mix(lastH, h, above / (above - diff)); break; }
      lastH = h; above = diff;
    }
  }
  vec2 t = clamp(texAt(b, pivot, hit), 0., 1.);
  float d = depthAt(t);
  vec3 col = relight(texture2D(uMap, t).rgb, normalize(texture2D(uNormal, t).xyz * 2. - 1. + reliefAt(uMap, t)), t, d);
  col = person(col, b, pivot);

  float motes = 0.;
  float aspect = uRes.x / uRes.y;
  for (int k = 0; k < 3; k++) {
    float layer = .22 + .24 * float(k);
    vec2 m = (s - uView * layer * 2.2) * vec2(aspect, 1.) * (5. + 3. * float(k)) + vec2(uTime * .018 * float(k + 1), -uTime * .012);
    float seed = hash(floor(m) + float(k) * 17.3);
    vec2 at = .5 + .34 * vec2(sin(uTime * .31 + seed * 40.), cos(uTime * .23 + seed * 31.));
    float twinkle = .55 + .45 * sin(uTime * (.8 + seed) + seed * 60.);
    motes += smoothstep(.05, 0., length(fract(m) - at)) * step(.62, seed) * step(d, layer + .08) * twinkle;
  }
  col += motes * mix(vec3(1., .93, .78) * .2, vec3(1., .86, .42) * .7, uDusk) * uAlive;
  gl_FragColor = vec4(col, 1.);
}`;

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const FOCUS = .24;
// Everything placed over the painting, with how near it stands, so it moves in depth with the painting beneath it.
const placed = [[".threshold-table-chair", .25], [".threshold-table-settings", .16], [".threshold-garden-basket", .4], [".threshold-garden-plants", .4], [".threshold-hall-chairs", .12], [".threshold-hall-flowers", .11], [".threshold-lamps", .1], [".threshold-foreground", .78]] as const;
const placedLayers = placed.map(([selector]) => selector).join(",");

/** `within` is the stage that carries the scene's state; `painting` is the still picture this is laid over. */
export function LivingCourtyard({ within = ".threshold-experience", painting: paintingSelector = ".threshold-background" }: { within?: string; painting?: string }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = holder.current;
    const host = frame?.closest<HTMLElement>(within);
    if (!frame || !host) return;
    // Nothing of the living courtyard is made until the first screen is whole and the page is idle: making a graphics context alone costs a phone tens of
    // milliseconds, and the painted courtyard beneath already shows exactly what it will draw first.
    let stop: (() => void) | undefined, cancelled = false;
    const opened = new Promise<void>(resolve => { if (document.readyState === "complete") resolve(); else addEventListener("load", () => resolve(), { once: true }); });
    // The living courtyard holds about forty megabytes of graphics memory, which an iPhone counts against the tab: it is let go once the courtyard
    // is more than two windows away, and made again as it comes back within two, before it is in sight. Meanwhile the painted courtyard shows, as it always does first.
    let ready = false, close = true;
    const start = () => { if (ready && close && !cancelled && !stop) stop = live(frame, host, paintingSelector); };
    const near = new IntersectionObserver(entries => {
      close = entries[entries.length - 1].isIntersecting;
      if (close) start(); else { stop?.(); stop = undefined; }
    }, { rootMargin: "200% 0px" });
    near.observe(host);
    opened.then(() => new Promise<void>(resolve => { whenIdle(() => resolve(), 1500, 200); })).then(() => { ready = true; start(); });
    return () => { cancelled = true; near.disconnect(); stop?.(); };
  }, [within, paintingSelector]);

  return <div ref={holder} className="living-courtyard" aria-hidden="true" />;
}

function live(frame: HTMLDivElement, host: HTMLElement, paintingSelector: string): (() => void) | undefined {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Safari on iPhone and iPad closes a tab outright when its memory runs short, and a phone with little memory may too: there the scene is shaded at one pixel per point.
    const tight = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); } catch { return; }
    frame.append(renderer.domElement);
    // If the graphics context is ever taken away, the painted courtyard underneath shows exactly as it always has.
    const origins = new WeakMap<HTMLElement, { x: number; y: number }>();
    const release = () => { host.removeAttribute("data-living"); host.querySelectorAll<HTMLElement>(placedLayers).forEach(layer => { layer.style.removeProperty("scale"); layer.style.removeProperty("translate"); origins.delete(layer); }); };
    // Once the context is lost the scene is over for this visit: nothing draws again, and a start still under way does not show it.
    let gone = false;
    const lost = (event: Event) => { event.preventDefault(); gone = true; step.drop(); release(); };
    // The paintings' decoded copies are let go once they are on the graphics card, so a lost context is not brought back: the painted courtyard stays.
    const restored = () => {};
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.addEventListener("webglcontextrestored", restored);

    // The paintings are decoded away from the page's own thread, so reading the first screen is never interrupted.
    // On a phone the plates (1774 wide) are decoded at 1024 wide: the courtyard is drawn there at one pixel per point and never wider than that.
    const loader = new ImageBitmapLoader().setOptions({ imageOrientation: "from-image", premultiplyAlpha: "none", ...(tight ? { resizeWidth: 1024, resizeQuality: "high" as const } : {}) });
    const load = (name: string, mipmaps: boolean) => loader.loadAsync(`/assets/threshold/${name}.webp`).then(bitmap => {
      const texture = new Texture(bitmap);
      texture.flipY = false;
      texture.needsUpdate = true;
      texture.generateMipmaps = mipmaps;
      texture.minFilter = mipmaps ? LinearMipmapLinearFilter : LinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    });
    const empty = { value: null as Texture | null };
    const uniforms = {
      uMap: { ...empty }, uDepth: { ...empty }, uNormal: { ...empty }, uFigures: { ...empty }, uIdle: { ...empty }, uAnswer: { ...empty },
      uRes: { value: new Vector2(1, 1) }, uRect: { value: new Vector4(0, 0, 2, 1) }, uView: { value: new Vector2() }, uSun: { value: new Vector2(-.45, -.55) },
      uDolly: { value: 0 }, uAlive: { value: 1 }, uDusk: { value: 0 }, uLook: { value: 0 }, uTurn: { value: 0 }, uWelcome: { value: 0 }, uResponse: { value: 0 }, uTime: { value: 0 }, uWarm: { value: 0 },
    };
    const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, depthTest: false, depthWrite: false });
    const geometry = new PlaneGeometry(2, 2);
    const scene = new Scene().add(new Mesh(geometry, material));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    let detail = 1, pace = 1 / 60, strained = 0, calm = 0, recoveries = 0, drawn = false;
    // A courtyard at rest (out of reach of the window, or behind shut doors and drawn) asks for no frames: the next scroll, resize or still asks again.
    // Asking every frame regardless kept a phone measuring four boxes and two styles, sixty times a second, through the rest of the page.
    let resting = false;
    const wake = () => { if (resting && !gone) { resting = false; step.ask(); } };
    const resize = () => {
      // The scene is twice the window's height wide, so its cost is its area: it is drawn at up to 1.25, but never past the pixels a 1920 by 1080 window shades cleanly.
      // A window just over that (1728 by 1117) would otherwise be caught by the pace check mid-walk, and its drawing buffer reallocated in one long frame.
      const budget = Math.sqrt(2.36e6 / Math.max(1, frame.clientWidth * frame.clientHeight));
      renderer.setPixelRatio(Math.min(devicePixelRatio, tight ? 1 : 1.25, budget) * detail);
      renderer.setSize(frame.clientWidth, frame.clientHeight, false);
      uniforms.uRes.value.set(frame.clientWidth, frame.clientHeight);
      host.querySelectorAll<HTMLElement>(placedLayers).forEach(layer => origins.delete(layer));
      drawn = false;
      wake();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(frame);

    const pointer = { x: 0, y: 0, seen: false };
    const look = { x: 0, y: 0 };
    const onPointer = (event: PointerEvent) => { if (event.pointerType === "touch") return; pointer.x = event.clientX / innerWidth - .5; pointer.y = event.clientY / innerHeight - .5; pointer.seen = true; };
    // When the mouse leaves the window the courtyard settles back to rest instead of holding the last lean.
    const rest = () => { pointer.x = 0; pointer.y = 0; };
    addEventListener("pointermove", onPointer, { passive: true });
    // Where the browser gives the device's tilt without asking, holding the phone leans the courtyard as the mouse does; nothing asks for it where it would have to.
    const asks = typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    const onTilt = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      pointer.x = Math.max(-.5, Math.min(.5, event.gamma / 50)); pointer.y = Math.max(-.5, Math.min(.5, (event.beta - 50) / 60)); pointer.seen = true;
    };
    if (!asks && !still) addEventListener("deviceorientation", onTilt, { passive: true });
    document.documentElement.addEventListener("pointerleave", rest);
    // On a screen past 1920 by 1080 the page around the scene costs the graphics card more to put together while it moves, so while the page is scrolling the scene is
    // shaded on a smaller part of its own canvas, stretched to fill its place; within a frame of the scroll stopping it is shaded whole again. Nothing is reallocated.
    let scrolledAt = -1e9, shade = 1;
    const onScroll = () => { scrolledAt = performance.now(); wake(); };
    addEventListener("scroll", onScroll, { passive: true });
    // Going in through the arch, the courtyard is held as it is: one frame is drawn whole and handed over as a picture of the same size and place.
    const onStill = (event: Event) => {
      if (!(event instanceof CustomEvent) || renderer.getContext().isContextLost()) return;
      renderer.setScissorTest(false);
      renderer.render(scene, camera);
      (event.detail as CourtyardStill).take(renderer.domElement.toDataURL("image/jpeg", .92), renderer.domElement.getBoundingClientRect());
      drawn = false;
      wake();
    };
    addEventListener(COURTYARD_STILL, onStill);

    const shown = (selector: string) => { const layer = host.querySelector(selector); return layer ? Number(getComputedStyle(layer).opacity) : 0; };
    // Left alone, the people notice you now and then: a look up, a turn of the head. An act of care is answered with a reach or a wave, and then they stay turned towards you.
    const notice = { place: "", since: 0 };
    const answers = { table: { on: false, since: 0 }, hall: { on: false, since: 0 } };
    const poseFor = (answer: { on: boolean; since: number }, on: boolean, place: string, seconds: number) => {
      if (on && !answer.on) answer.since = seconds;
      answer.on = on;
      if (still) return { noticing: 0, answering: Number(on) };
      const waited = (seconds - notice.since) % 13;
      const glance = host.dataset.open === "true" && host.dataset.destination === place && waited > 1.5 && waited < 5.5;
      return { noticing: Number(on || glance), answering: Number(on && seconds - answer.since < 4.5) };
    };
    const journey = host.closest(".fresco-journey");
    // Walking through the doors, the near stone slides out past the window's edges faster than the far hills.
    const inside = () => Number(host.style.getPropertyValue("--inside") || 0);
    let last = 0, began = 0, disposed = false, clock = 0;
    // Everything the frame needs of the page's layout is read in the shared frame's first half, before any part has written (scroll-frame.ts):
    // read after the doors' and the chapters' writes, each of these made the browser style the whole page again inside the frame.
    let stage = frame.getBoundingClientRect(), painting: DOMRect | undefined, walked: DOMRect | undefined, worldBox: DOMRect | undefined, worldWidth = 1;
    let frameWidth = 0, frameHeight = 0, tableShown = 0, hallShown = 0;
    const read = () => {
      stage = frame.getBoundingClientRect();
      painting = host.querySelector(paintingSelector)?.getBoundingClientRect();
      walked = journey?.getBoundingClientRect();
      const world = host.querySelector<HTMLElement>(".threshold-world");
      worldBox = world?.getBoundingClientRect(); worldWidth = world?.offsetWidth ?? 1;
      frameWidth = frame.clientWidth; frameHeight = frame.clientHeight;
      tableShown = shown(".threshold-table-welcome"); hallShown = shown(".threshold-hall-response");
    };
    const tick = (time: number) => {
      if (gone) return;
      if (!began) began = time;
      const elapsed = (time - last) / 1000 || .016;
      const dt = Math.min(.05, elapsed); last = time;
      const seconds = (time - began) / 1000;
      // It goes on drawing for half a window beyond the screen's edges, so on a quick flick back it is already painted when it comes into view.
      if (!painting || stage.bottom < -innerHeight * .5 || stage.top > innerHeight * 1.5 || renderer.getContext().isContextLost()) { resting = true; return; }
      // Behind shut doors nobody sees the courtyard: once it has been drawn at this size it rests, and the frame it holds is the one the doors open on.
      if (drawn && host.dataset.opening !== "true" && host.dataset.inside !== "true") { resting = true; return; }
      step.ask();
      // Only the columns of the painting that are on the screen are shaded, with a margin for a frame's movement: on a phone the painting is four times as wide as the window.
      // Its whole height is always drawn, because a quick flick moves the page further in one frame than any margin, and a strip left undrawn would show bare.
      const marginX = stage.width * .08;
      const left = Math.max(0, (-marginX - stage.left) / stage.width), right = Math.min(1, (innerWidth + marginX - stage.left) / stage.width);
      const moving = time - scrolledAt < 120;
      const nowShade = moving ? Math.min(1, Math.sqrt((1920 * 1080) / Math.max(1, innerWidth * innerHeight))) : 1;
      if (nowShade !== shade) {
        shade = nowShade; drawn = false;
        renderer.domElement.style.transform = shade < 1 ? `scale(${1 / shade})` : "";
      }
      const width = frameWidth * shade, height = frameHeight * shade;
      renderer.setViewport(0, frameHeight - height, width, height);
      renderer.setScissorTest(drawn);
      renderer.setScissor(left * width, frameHeight - height, Math.max(0, right - left) * width, height);
      // If the graphics card cannot keep pace, the painting is drawn a little smaller rather than letting the journey stutter.
      pace = mix(pace, Math.min(elapsed, .1), .06);
      strained = pace > .0195 ? strained + 1 : 0;
      if (strained > 40 && detail > .7) { detail -= .15; strained = 0; calm = 0; pace = 1 / 60; resize(); }
      // A busy moment, such as the first load, should not cost sharpness for the whole visit: after a long calm spell the detail is tried again, twice at most.
      calm = pace < .0175 ? calm + 1 : 0;
      if (calm > 360 && detail < 1 && recoveries < 2) { detail = Math.min(1, detail + .15); recoveries += 1; calm = 0; resize(); }
      const follow = still ? 1 : 1 - Math.exp(-dt * 2.6);
      const driftX = still ? 0 : Math.sin(seconds * .33) * (pointer.seen ? .08 : .34), driftY = still ? 0 : Math.cos(seconds * .26) * (pointer.seen ? .06 : .2);
      look.x = mix(look.x, still ? 0 : pointer.x + driftX, follow);
      look.y = mix(look.y, still ? 0 : pointer.y + driftY, follow);
      const evening = host.dataset.evening === "true";
      // Measured in the canvas's own units, so the scene stays in register when its holder is scaled on the page.
      const unit = stage.width / Math.max(1, frameWidth) || 1;
      uniforms.uRect.value.set((painting.left - stage.left) / unit, (painting.top - stage.top) / unit, painting.width / unit, painting.height / unit);
      // Scrolling through the fresco, the near stone and the far hills part by about ten pixels from first sight to last.
      const through = still || !walked ? .5 : Math.max(0, Math.min(1, (-walked.top / Math.max(1, innerHeight) - 3.65) / .9));
      const part = (through - .5) * 10 / (.9 * Math.max(1, painting.height));
      // Standing in the courtyard, its paper parts in depth as the page goes on: the near sheets come forward and lean further with the cursor or the tilt than the far ones.
      const standing = still ? 0 : Number(host.style.getPropertyValue("--standing") || 0);
      const lean = 1 + inside() * .8;
      uniforms.uView.value.set(-look.x * .03 * lean, -look.y * .022 * lean + part);
      // The light warms once, when the wall has opened, and the sun leans a little with it.
      uniforms.uWarm.value = mix(uniforms.uWarm.value, Number(host.dataset.open === "true"), still ? 1 : 1 - Math.exp(-dt * .9));
      uniforms.uSun.value.set(-.45 + look.x * 1.5 + uniforms.uWarm.value * .25, -.55 + look.y * .9);
      // Walking in: the near world grows faster than the far one as the doors are passed, and eases back for the last wide view.
      const entered = Math.min(1, Number(host.style.getPropertyValue("--door-progress") || 0) / .2);
      uniforms.uDolly.value = mix(uniforms.uDolly.value, still ? 0 : host.dataset.overview === "true" ? .5 : .2 + entered * entered * (3 - 2 * entered) + inside() * .25 + standing * .35, follow);
      if (worldBox && host.dataset.living === "true") {
        const frameOfWorld = worldBox;
        const size = frameOfWorld.width / Math.max(1, worldWidth);
        const centreX = (stage.left + stage.width / 2 - frameOfWorld.left) / size, centreY = (stage.top + stage.height / 2 - frameOfWorld.top) / size;
        const reach = Math.max(painting.width / 2, painting.height) / size;
        const open = host.dataset.open === "true" && !still;
        const lookX = open ? Number(host.style.getPropertyValue("--look-x") || 0) : 0, lookY = open ? Number(host.style.getPropertyValue("--look-y") || 0) : 0;
        for (const [selector, nearness] of placed) for (const layer of host.querySelectorAll<HTMLElement>(selector)) {
          let origin = origins.get(layer);
          if (!origin) {
            const [x, y] = getComputedStyle(layer).transformOrigin.split(" ").map(parseFloat);
            origin = { x: layer.offsetLeft + x, y: layer.offsetTop + y };
            origins.set(layer, origin);
          }
          const grow = 1 + uniforms.uDolly.value * Math.max(nearness - FOCUS, 0);
          const drift = selector === ".threshold-foreground" ? [-26, -13] : [-7, -4];
          layer.style.setProperty("scale", String(grow));
          layer.style.setProperty("translate", `${(centreX - origin.x) * (1 - grow) + uniforms.uView.value.x * (nearness - FOCUS) * reach * 2 + lookX * drift[0]}px ${(centreY - origin.y) * (1 - grow) + uniforms.uView.value.y * (nearness - FOCUS) * reach + lookY * drift[1]}px`);
        }
      }
      clock = mix(clock, Number(evening), still ? 1 : 1 - Math.exp(-dt * 1.4));
      // The week ends at dusk: over the last screen of the walk, as the story's sheet comes up over the wall, the same sun goes down and the arch's light warms.
      // It follows the scroll exactly, back as well as forward; under Reduce Motion the courtyard is simply at evening once that last screen is reached.
      const end = walked ? Math.max(0, Math.min(1, 1 - (walked.bottom - innerHeight) / (.9 * innerHeight))) : 0;
      const late = still ? Number(end > 0) : end * end * (3 - 2 * end);
      uniforms.uDusk.value = Math.max(clock, late);
      const place = host.dataset.destination ?? "";
      if (place !== notice.place) { notice.place = place; notice.since = seconds; }
      const ease = still ? 1 : 1 - Math.exp(-dt * 2.4);
      const table = poseFor(answers.table, host.dataset.tableReady === "true" || tableShown > .5, "1", seconds);
      const hall = poseFor(answers.hall, hallShown > .5, "2", seconds);
      uniforms.uLook.value = mix(uniforms.uLook.value, table.noticing, ease);
      uniforms.uWelcome.value = mix(uniforms.uWelcome.value, table.answering, ease);
      uniforms.uTurn.value = mix(uniforms.uTurn.value, hall.noticing, ease);
      uniforms.uResponse.value = mix(uniforms.uResponse.value, hall.answering, ease);
      uniforms.uTime.value = still ? 0 : seconds;
      renderer.render(scene, camera);
      drawn = true;
    };
    const step = frameStep(read, tick);

    Promise.all([load("courtyard-quiet-plate-v1", true), load("courtyard-plate-depth-v1", false), load("courtyard-plate-normal-v1", false), load("courtyard-figures-v1", true), load("courtyard-poses-idle-v1", true), load("courtyard-poses-answer-v1", true)]).then(async textures => {
      if (disposed) { textures.forEach(texture => texture.dispose()); return; }
      [uniforms.uMap.value, uniforms.uDepth.value, uniforms.uNormal.value, uniforms.uFigures.value, uniforms.uIdle.value, uniforms.uAnswer.value] = textures;
      resize();
      // Each painting is handed to the graphics card on its own frame, and the shader is prepared in the background, so arriving in the courtyard costs nothing.
      for (const texture of textures) { await new Promise(requestAnimationFrame); if (disposed) return; renderer.initTexture(texture); if (texture.image instanceof ImageBitmap) texture.image.close(); }
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      // One frame is drawn before the layers are shown, so the program's first use and the textures' first sampling happen now, not on the walk.
      await new Promise(requestAnimationFrame);
      if (disposed) return;
      renderer.render(scene, camera);
      await new Promise(requestAnimationFrame);
      if (disposed || gone) return;
      host.setAttribute("data-living", "true");
      step.ask();
    }).catch(() => { /* Without the living layers the painted courtyard shows exactly as it always has. */ });

    return () => {
      disposed = true;
      step.drop();
      observer.disconnect();
      removeEventListener("pointermove", onPointer);
      removeEventListener("deviceorientation", onTilt);
      removeEventListener(COURTYARD_STILL, onStill);
      removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("pointerleave", rest);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("webglcontextrestored", restored);
      release();
      [uniforms.uMap, uniforms.uDepth, uniforms.uNormal, uniforms.uFigures, uniforms.uIdle, uniforms.uAnswer].forEach(uniform => { if (uniform.value?.image instanceof ImageBitmap) uniform.value.image.close(); uniform.value?.dispose(); });
      geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
}
