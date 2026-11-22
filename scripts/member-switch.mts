// `bun run member-switch`: one browser, two members. Member A signs in, the room is drawn, the offline worker takes
// over and keeps what it keeps; A signs out through the room's own Sign out. Member B then signs in on the same
// browser. From A's sign-out until B's room is whole, every frame and every change of the page is read, and none of
// A's names, conference or room may ever show; after the sign-out nothing of A's may be left in local or session
// storage or in the worker's caches. Then B goes offline: A's kept room must not come back. It runs again for a
// session ended elsewhere (Clerk says signed out without the app's sign-out), and once as the iOS app's web view,
// which keeps its pages and This week for the next launch. Clerk and Convex are stand-ins (scripts/e2e/mocks.ts).
//
// Against a production build (`bun run build`, then `next start` with any NEXT_PUBLIC_CONVEX_URL on convex.cloud and a
// test Clerk key; `CLERK_SECRET_KEY=sk_test_dummy` is enough). Exit code 1 if anything fails.
//
//   SWITCH_URL      the site to check (default http://localhost:3000)
//   SWITCH_BROWSER  a Chrome or Chromium to use (default: the installed Google Chrome)
import { chromium, devices, type BrowserContext, type Page } from "playwright-core";
import { mock, traces, type Member, type Mocked } from "./e2e/mocks";

const base = (process.env.SWITCH_URL ?? "http://localhost:3000").replace(/\/$/, "");

const memberA: Member = {
  userId: "user_annaLeft",
  sessionId: "sess_annaLeft",
  name: "Philippa Quenneville",
  email: "philippa.q@example.org",
  church: { id: "church_stBrendanA", name: "Saint Brendan Ardmore" },
  people: ["Wenceslas Okonkwo", "Rosalind Featherstonehaugh"],
  team: "Lighthouse Pantry Crew",
  announcement: "Marigold coat drive Thursday",
};
const memberB: Member = {
  userId: "user_benRight",
  sessionId: "sess_benRight",
  name: "Tobias Lindqvist",
  email: "tobias.l@example.org",
  church: { id: "church_holyCrossB", name: "Holy Cross Bayview" },
  people: ["Imelda Varga", "Cosmo Abernathy"],
  team: "Riverside Visitors",
  announcement: "Pierogi supper Saturday",
};
const leaks = traces(memberA);

let failures = 0;
const check = (ok: boolean, what: string, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${what}${ok || !detail ? "" : `\n      ${detail}`}`);
};

/**
 * Reads the page's text on every change and every frame, in every document the tab opens, and hands it here, with
 * whoever Clerk says is signed in at that moment. What was read while `watching`, with A no longer signed in, is
 * said to `seen` (A's own room may still stand in the instant the Sign out is pressed).
 */
async function watch(context: BrowserContext) {
  const state = { watching: false, seen: [] as string[] };
  await context.exposeFunction("__pageText", (text: string, who: string) => {
    if (state.watching && who !== memberA.userId) state.seen.push(text);
  });
  await context.addInitScript(() => {
    let last = "";
    const read = () => {
      const text = `${document.title}\n${document.body?.innerText ?? ""}`;
      const who = (window as unknown as { Clerk?: { user?: { id: string } | null } }).Clerk?.user?.id ?? "nobody";
      if (text + who === last) return;
      last = text + who;
      void (window as unknown as { __pageText: (text: string, who: string) => Promise<void> }).__pageText(text, who);
    };
    new MutationObserver(read).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    const frame = () => {
      read();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return state;
}
/** The first reading that showed something of A's, as it read, for the failure line. */
const first = (texts: string[]) => texts.find((text) => leaks.some((leak) => text.includes(leak)))?.replace(/\s+/g, " ").slice(0, 300) ?? "";
const found = (texts: string[]) => {
  const hits = new Set<string>();
  for (const text of texts) for (const leak of leaks) if (text.includes(leak)) hits.add(leak);
  return [...hits];
};

const roomOf = (page: Page, member: Member) =>
  page.waitForFunction((name) => !!document.querySelector(".live-app[data-room-shown]") && document.body.innerText.includes(name), member.church.name, { timeout: 30000 });

/** A's room, drawn, with the worker in charge and (in the app) its pages and This week kept. */
async function aIsIn(page: Page, mocked: Mocked, app: boolean) {
  await page.goto(`${base}/app`);
  await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true);
  await mocked.signIn(page, memberA);
  await roomOf(page, memberA);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
  if (!app) return;
  // A page opened under the worker is kept by it; This week is kept by the app once the room is whole and live.
  await page.reload();
  await roomOf(page, memberA);
  await page.waitForFunction(async () => (await caches.keys()).some((name) => name.startsWith("kh-app-pages-")), null, { timeout: 15000 });
  check(mocked.appKept()?.includes(memberA.church.name) === true, "the app keeps A's This week");
  // The next launch: A's kept room is drawn at once, then the live one.
  await mocked.launch(page);
  await roomOf(page, memberA);
}

/** What the browser holds of A's after A is gone: local and session storage, and every cache's keys and answers. */
async function heldOfA(page: Page) {
  return page.evaluate(async (leaks) => {
    const held: string[] = [];
    const look = (where: string, text: string) => leaks.forEach((leak) => text.includes(leak) && held.push(`${where}: ${leak}`));
    for (const [name, storage] of [["localStorage", localStorage], ["sessionStorage", sessionStorage]] as const)
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index)!;
        look(`${name} ${key}`, `${key}=${storage.getItem(key)}`);
      }
    for (const name of await caches.keys()) {
      if (name.startsWith("kh-app-pages-")) held.push(`cache ${name} is still there`);
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const answer = await cache.match(request);
        if (answer && /text|json|javascript/.test(answer.headers.get("content-type") ?? "")) look(`cache ${name} ${request.url}`, `${request.url}\n${await answer.text()}`);
      }
    }
    return held;
  }, leaks);
}

async function scenario(label: string, { app, elsewhere }: { app: boolean; elsewhere: boolean }) {
  console.log(`\n${label}`);
  const browser = await chromium.launch(process.env.SWITCH_BROWSER ? { executablePath: process.env.SWITCH_BROWSER } : { channel: "chrome" });
  // The app's web view says so in its user agent (Capacitor's appendUserAgent).
  const userAgent = app ? `${devices["Desktop Chrome"].userAgent} KindHelpsApp` : undefined;
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, userAgent });
  await context.addCookies([{ name: "__clerk_db_jwt", value: "dvb_test", url: base }]);
  try {
    const mocked = await mock(context, [memberA, memberB], { app });
    const seen = await watch(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => console.log(`      page error: ${error.message.slice(0, 200)}`));
    await aIsIn(page, mocked, app);
    check(found([await page.evaluate(() => document.body.innerText)]).length > 0, "A's room shows A's names (the check can see them)");

    seen.watching = true;
    if (elsewhere) await mocked.endElsewhere(page);
    else await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.waitForSelector(".door-out", { timeout: 15000 });
    // The worker's caches are let go a moment after the press.
    await page.waitForTimeout(1000);
    const held = await heldOfA(page);
    check(held.length === 0, `after ${elsewhere ? "the session ended elsewhere" : "sign-out"}, nothing of A's is held in storage or caches`, held.join("\n      "));
    if (app) check(mocked.appKept() === null, "the app lets A's kept room go");

    await mocked.signIn(page, memberB);
    await roomOf(page, memberB);
    await page.waitForSelector(".live-app[data-room-whole]", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    const html = await page.content();
    const inPage = leaks.filter((leak) => html.includes(leak));
    check(found(seen.seen).length === 0 && inPage.length === 0, `from A's leaving until B's room is whole (${seen.seen.length} readings), nothing of A's shows`, `${[...found(seen.seen), ...inPage].join(", ")}\n      first seen in: ${first(seen.seen)}`);

    // B goes offline right after signing in; in the app the page is opened again from what the app holds.
    seen.seen.length = 0;
    await context.setOffline(true);
    if (app) await mocked.launch(page);
    else await page.reload().catch(() => {});
    await page.waitForTimeout(3000);
    check(found(seen.seen).length === 0, "offline after B signs in, A's kept room never shows", `${found(seen.seen).join(", ")}\n      first seen in: ${first(seen.seen)}`);
    await context.setOffline(false);
    seen.watching = false;
  } finally {
    await browser.close();
  }
}

await scenario("the website: A signs out, B signs in", { app: false, elsewhere: false });
await scenario("the iOS app: A signs out, B signs in", { app: true, elsewhere: false });
await scenario("the iOS app: A's session ends elsewhere, B signs in", { app: true, elsewhere: true });
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
