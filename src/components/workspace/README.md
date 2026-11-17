# The signed-in workspace

One owner per file. Build in your own folder; ask the foundation thread for any
change to a file marked closed.

## Shared, closed after the foundation

| File | Holds |
| --- | --- |
| `areas.ts` | The list of section ids. `/app/[area]` reads it on the server, so it stays a plain module with no imports. |
| `navigation.ts` | Menu entries, page headings, the primary action per section. |
| `sections.ts` | Which component renders each section. |
| `shell.tsx` | Header, menus, notices, the shared dialogs. |
| `context.tsx` | `useWorkspace()`: the group, the signed-in person, date helpers, `perform`, `confirm`. |
| `help.css` | Every `help-*` class from the design reference. The layout loads it once; sections do not import it or keep a copy. |
| `types.ts`, `primitives.tsx` | Shared types; `LiveLoading`, `LiveRoomLoading`, `LiveEmpty`, `LiveField`. |
| `paper.css` | The paper frame: page head, motion, empty and loading states, phone bar, measure. |
| `aside.tsx` | `RoomAside`: the room's one side column from 1280px up, and `useWideScreen()`. |
| `relief.tsx` | `ReliefPicture`: a room's relief picture, or its drawn placeholder until the files arrive (`reliefReady`). |
| `convex/schema.ts` | Every table, including `neighbors`, `calls`, `assistanceRequests`, `visits` and `ledgerEntries`. Money is whole cents. |
| `convex/access.ts` | `user()` and `membership()`: the gate every backend function starts with. `neighborAccess()` and `neighborRecord()`: the gate for anything about a neighbor. |
| `convex/sampleData.ts` | The made-up conference: `bunx convex run sampleData:load`. |

## Where each stream builds

| Stream | Screens | Backend |
| --- | --- | --- |
| Volunteer side (built) | `volunteer/` | `convex/workspace.ts`, `convex/pages.ts` |
| Help line and neighbors | `help-line/` | `convex/neighbors.ts`, `convex/assistance.ts` |
| Home visits | `visits/` | `convex/visits.ts` |
| Treasury | `treasury/` | `convex/treasury.ts` |
| Reports and yearly counts | `reports/` | `convex/reports.ts` |
| AI and languages | `src/lib/words/<language>.ts` | `convex/drafts.ts` |
| Demo and submission | none | `convex/demo.ts`, `scripts/` |

## Adding a section

A section is a component with no props. It reads `useWorkspace()` for the group
and the signed-in person, and fetches its own records with `useQuery` against
its own backend file, passing `data.church.id`. It does not add fields to
`workspace.dashboard` or commands to `workspace.execute`.

Every function that reads or writes neighbors, calls, assistance requests,
visits or the ledger starts with `neighborAccess(ctx, churchId)`, never
`membership()`. Only coordinators and owners pass. Opening one neighbor's
record goes through a mutation that calls `logNeighborOpening()`. Styles go in a CSS
file imported by the section, using the existing `live-*` classes first.

Every room's CSS loads on every workspace page, so a rule is never private to
its room. Prefix class names with the room's name, and start any print rule
that hides the rest of the page from `body:has(.your-sheet)`, or it blanks
every other room's printing.

To appear in the menu a section needs one line each in `areas.ts`,
`navigation.ts` (entry, heading, primary action) and `sections.ts`.
A help-side room's heading carries `room: "help"`. Every heading carries `art`,
the name of the room's relief picture.

## The way back from an inner view

`setHeading({ title, deck, back: { label: "Ledger", run } })` draws a quiet link
above the eyebrow in the page head, with a 44px touch area. Use it for every
inner view (one record, one tool); do not draw a back link of your own in the room.

## The side column on wide screens

From 1280px up a room may fill one quiet column on the right of its paper; under 1280px the column does not
exist (nothing is drawn, nothing is fetched for it), so it may never hold anything the phone lacks.

```tsx
import { RoomAside } from "@/components/workspace/aside";

<RoomAside title={words.timeOff.thisMonth}>…</RoomAside>
```

- Draw it anywhere inside the room; the shell places it (22% of the window, 264 to 340px, a hairline on its left)
  and narrows the room's own column beside it. It stays in view while the room scrolls.
- One per room, and only what the room already has in hand: no new query, no new field on the backend. If the
  aside needs a query of its own, read `useWideScreen()` and pass `"skip"` when it is false.
- It answers "what else do I need here" (the month with days away, the week by team, the next meeting, who is
  on the line today). No actions that exist nowhere else, no figures repeated from the room beside it.
- Keep it shorter than the window. `title` is its kicker and its name for screen readers; in a member's room it
  comes from the word tables. Inside, use the room's own quiet type: 15px text, 13px kickers, hairlines, no cards.
- A room with a wide table (People, Neighbors, the ledger) leaves it out: at 1280px the room's column beside it
  is about 590px.

## Motion, shared by every room

One way of moving, in `paper.css`: paper lifts, slides and settles, with
`var(--paper-ease)`, under 500ms, and still under Reduce Motion. The shell moves
the head, the picture and the menu marker itself. Rooms use four classes:

| Class | Does |
| --- | --- |
| `paper-rise` | A thing arrives: up 12px and in, 320ms. `paper-rows` on a parent does it for the first eight children, 30ms apart. `live-list`, `help-row`, `help-timeline` and `help-ledger` rows already have it. |
| `paper-settle` | A sheet is laid down, 420ms. `help-sheet` already has it. |
| `paper-fold` | Add to a `help-sheet` (or any `paper-corner`) when its yes is given: the corner lifts, turns from ochre to green and is pressed flat with a tick, about half a second. Keep the sheet on the page for `FOLD_HOLD` (`fold.ts`, 1.8 s, which reads as 1.6 s of green once the corner has turned) before it moves on, so the word can be read; then mark what goes with `data-fold-leaves` and `await foldLeaves()`, which closes it up over 360ms and holds the page so it never jumps. |
| `paper-waits` | The corner is ochre: something here waits for a person's yes. `help-sheet` has it already. |
| `paper-rest` | The corner is plain paper: add to a `help-sheet` that waits for nothing. `paper-corner` alone rests plain. |
| `count-up` | A large figure's digits. It stands at its value at once: nothing in the workspace counts up. |

Set `--paper-order` (0 to 7) on an element to place it in a stagger by hand.
Rows and links already lift on hover; do not add another hover of your own.

## The date and time fields

`date-field.tsx` holds the one pattern for every room; no browser date box anywhere.

- `<DateField name="start" required />` inside a `LiveField`. It takes and gives the same `"YYYY-MM-DD"` a date
  input does: read it from `FormData` by `name`, or pass `value` and `onChange(value)`. `min` and `max` bound the days.
  Closed it reads "Thursday, November 19" with a chevron; open it is a month with 44px days (shadcn Popover with
  react-day-picker on a desk, a sheet from the bottom under 700px). On a desk a day can be typed (11/19 in English,
  19/11 in Spanish, or 2026-11-19).
- `<TimeField name="time" from="07:00" to="20:30" />` is a list of half hours as `"HH:mm"`, the range set by the room.

Both speak en and es from the word tables.

## When something is not as usual

One family, in `states.tsx` and `failure.ts`; the look is in `paper.css`. Plum asks for attention; nothing is red.

- A refused save: `readFailure(cause)` gives the sentence to show. It is the backend's own sentence when the
  backend threw a `ConvexError("plain sentence")`, calm words otherwise, and never the raw error. Backend refusals
  meant for the person must be `ConvexError`; production strips a plain `Error` down to "Server Error".
  `useSave()` (`use-save.ts`) already reads through it.
- `<LiveFailure message={sentence} />` inside the form, above its buttons: what happened, then that what was typed
  is kept. The form's own button sends it again. `retry` adds a "Try again" that submits, for a form with no button
  of its own. A bare `<div className="live-error" role="alert">` has the same look.
- `<LiveWaiting when={saving} />` beside a form's buttons: if the connection drops while the form is being sent, it
  says the entry is kept and will go by itself (Convex holds the save and sends it on return).
- `<LiveState kind="private|missing|error|offline|empty" title action>`: the room's round mark, one serif line, one
  sentence, at most one action. `LiveEmpty` stays the short way to write the empty one.
- `<LiveConnection />` is the strip above a room while the connection is down, and `RoomBoundary` keeps a fault
  inside one room; the shell places both. Whole-page states (`app/error.tsx`, `not-found.tsx`, `/offline`) use
  the sign-in layout. Words are `words.states` (en, es); `stateWords` is the English copy for pages outside the workspace.

## The paper corner rule

A paper corner is plain paper at rest, ochre only while something waits for a person's yes, and green once it is
given or done. Nothing else may colour a corner. In classes: `paper-corner` rests plain; `paper-waits` is ochre;
`paper-fold` is green. A `help-sheet` is the waiting sheet and is ochre by default, so a `help-sheet` that waits
for no one (a statement, a finished check) takes `paper-rest` until it earns `paper-fold`.

## Cutting a relief picture

`python3 scripts/level-relief.py <source.png> <name>` writes the six files in `public/assets/relief/` and adds the
name to nothing: add it to `reliefReady` in `relief.tsx` yourself. The script levels the picture's paper to the page
(#f7f4ed): it reads the paper colour from the top left 300px, then moves every pixel by the difference, in full where
the pixel is paper and fading out 70 levels of colour away, so the subject keeps its own colour and no tan cloud shows
where a head fades into the page. Any page that shows a relief picture on #f7f4ed should use files cut this way.

## A picture's one move on arrival

A room's head picture makes one small move the first time the room is opened in a visit (the cup is set down, the
key goes on its hook), then never again until the tab is closed; Reduce Motion always shows it at rest. The shell
plays it (`relief-arrival.tsx`); a room does nothing. A picture moves only when it is listed in `reliefMoves` in
`relief.tsx`, and it is listed only when its two layers are in `public/assets/relief/`:

- `relief-<name>-base-<width>`: the picture without the moving piece, the paper behind it painted in.
- `relief-<name>-piece-<width>`: the piece alone, with its shadow, on a clear ground.

- `relief-<name>-front-<width>`, only where the cut needs it: a still layer laid over the piece (hands that stay
  while the door leaf moves under them). The entry then says `front: true`.

All on the flat picture's canvas, levelled the same way, at 640, 1024 and 1536 in AVIF and WebP, so that the layers
at rest are the flat picture. The entry gives where the piece starts, in screen pixels and degrees from rest,
6 to 10px: `week: { y: -8 }`, `commitment: { y: -8, turn: -2 }`. The piece waits there until both layers are in,
then travels home in 520ms. Never fake a layer from the flat file.

## Dialogs

Every dialog is a `LiveDialog`: paper sheet, title and a 44px way out held at the top, the form's button held at the
foot (`live-form-actions`), first field focused with a mouse and the title on touch. Under 700px it is a sheet from the
bottom edge, above the keyboard. Do not use the raw `Dialog`, and no browser date or time boxes inside one: use
`DateField`, `TimeField`, or `WhenField` (a day and a time under one name, the same value as `datetime-local`).

## Leaders' rooms are English throughout

A room marked `leadersOnly` in `navigation.ts` is hidden from members and is English for everyone who opens it.
The shell gives that room's subtree (the head, the room, its dialogs) a workspace whose `words` are the English
table, so anything that reads `useWorkspace().words`, the states family included, follows with no props. The bar and
the menu stay in the person's own language. A member's room must read every string from the word tables.

## Reading from the backend

Rooms import `useQuery` and `usePaginatedQuery` from `@/components/workspace/query`, never from
`convex/react` (`useQueries`, `useMutation`, `useAction` and `useConvex` stay with `convex/react`).
Inside the app those two keep what a room last showed for five minutes after it is left, so going
back shows the room at once while it refreshes.

A picture harness or a test needs nothing new: with only a `ConvexProvider` around the room the same
calls read straight from Convex. To see the keeping itself in a harness, wrap the room as the app does:

```tsx
import { ConvexProvider } from "convex/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";

<ConvexProvider client={client}>
  <ConvexQueryCacheProvider>
    <LiveWorkspace area={area} data={data} run={run} signOut={signOut} />
  </ConvexQueryCacheProvider>
</ConvexProvider>
```

One frame serves every room (`src/components/live-frame.tsx`, in the app layout). A link from one room
to another is an ordinary `<Link href="/app/…">`; the frame takes the click and changes room without
asking the server. Never draw `LiveApp` from a page, and never hide a room before the next one stands.

## Pictures from a harness

The live sample keeps Eastern time, so a harness that takes pictures does too, or its days and hours
will not match the live site: give the sample conference `timeZone: "America/New_York"` and open the
browser in the same zone (Playwright: `browser.newContext({ timezoneId: "America/New_York", locale: "en-US" })`).

## Waiting

There is one way to wait: `<LiveLoading />` from `primitives`, a quiet line ("Opening…" in the reader's
language, or the `label` you pass). It shows only after 400ms, so a quick answer never flashes it.
No grey rows or blocks stand in for content anywhere. The full-screen `LiveRoomLoading` is for the
frame alone, before anyone's workspace has arrived.

## What the iPhone app's launch cover may watch

- `.paper-loading` is on screen while the whole workspace is still on its way (`LiveRoomLoading`).
- `.live-app[data-room-in]` is set once, when the first room is whole: its sheet has finished arriving and its
  head picture is loaded and decoded. A cover that lifts on this never shows a room still coming up under the mark.
- `.live-app[data-room-shown]` is set in the frame each room is shown whole (the door's paper lifts on it), and
  `.live-app[data-room-whole]` once the room is at rest: its figures have landed and its picture's piece is set down.

- The draft sheet has a still copy on the home page for readers without scripts (`src/components/home-yes.tsx`, drawn by `.home-yes-still` in `home-yes.css`). When the sheet's look or words change in `help-line/draft-sheet.tsx`, `help.css` or `paper.css`, change the still copy with it.
