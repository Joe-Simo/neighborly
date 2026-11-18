/// <reference lib="webworker" />
import {
  CacheableResponsePlugin,
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** This deploy, as the offline page's revision names it: the app's kept pages are kept under it and no other. */
const deploy = (self.__SW_MANIFEST ?? []).find((entry): entry is PrecacheEntry => typeof entry !== "string" && entry.url === "/offline")?.revision ?? "dev";
const APP_PAGES = "kh-app-pages-";
/**
 * Only inside the iOS app (its web view says so: Capacitor's `appendUserAgent`), whose device is the member's own,
 * the app's pages under /app are kept: from the network whenever there is one, and from what was kept only when
 * there is none, so the app opens whole and draws the room it last saw (lib/kept-room.ts). A page answer is kept only
 * when it is this site's own, whole and not redirected; nothing from Clerk, Convex, Cloudflare or any other host, and
 * no request a page makes for data, ever is. On the website pages stay on the network, as before.
 */
const inApp = self.navigator.userAgent.includes("KindHelpsApp");
const appPage = ({ request, url }: { request: Request; url: URL }) =>
  inApp &&
  request.mode === "navigate" &&
  url.origin === self.location.origin &&
  (url.pathname === "/app" || url.pathname.startsWith("/app/")) &&
  !url.searchParams.has("_rsc");
const keptPages = new NetworkFirst({
  cacheName: APP_PAGES + deploy,
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    { cacheWillUpdate: async ({ response }) => (response.redirected || response.type !== "basic" ? null : response) },
  ],
});

/** The rooms' head pictures, the app's own static art: kept with the pages, under the same deploy's name. */
const appArt = ({ request, url }: { request: Request; url: URL }) =>
  inApp && request.method === "GET" && url.origin === self.location.origin && url.pathname.startsWith("/assets/relief/");
const keptArt = new CacheFirst({ cacheName: APP_PAGES + deploy, plugins: [new CacheableResponsePlugin({ statuses: [200] })] });

// A new deploy lets go of the pages kept under the one before.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith(APP_PAGES) && name !== APP_PAGES + deploy).map((name) => caches.delete(name)))),
  );
});

// Pages always come from the network, but for the app's own (above). With no connection, the offline page
// answers instead of the browser's own error.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: appPage, handler: keptPages },
    { matcher: appArt, handler: keptArt },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
