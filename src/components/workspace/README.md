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
| `types.ts`, `primitives.tsx` | Shared types; `LiveLoading`, `LiveRoomLoading`, `LiveEmpty`, `LiveField`, `CountUp`. |
| `paper.css` | The paper frame: page head, motion, empty and loading states, phone bar, measure. |
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

## Motion, shared by every room

One way of moving, in `paper.css`: paper lifts, slides and settles, with
`var(--paper-ease)`, under 500ms, and still under Reduce Motion. The shell moves
the head, the picture and the menu marker itself. Rooms use four classes:

| Class | Does |
| --- | --- |
| `paper-rise` | A thing arrives: up 12px and in, 320ms. `paper-rows` on a parent does it for the first eight children, 30ms apart. `live-list`, `help-row`, `help-timeline` and `help-ledger` rows already have it. |
| `paper-settle` | A sheet is laid down, 420ms. `help-sheet` already has it. |
| `paper-fold` | Add to a `help-sheet` (or any `paper-corner`) when its yes is given: the corner turns from ochre to green and presses flat, 400ms. |
| `count-up` | A figure rolling to its value in 400ms: render `<CountUp value={n} format={...} />` from `primitives.tsx`. |

Set `--paper-order` (0 to 7) on an element to place it in a stagger by hand.
Rows and links already lift on hover; do not add another hover of your own.

## The date field

`date-field.tsx` is the one date field for every room: `<DateField name="start" required />` inside a `LiveField`.
It takes and gives the same `"YYYY-MM-DD"` string a date input does, so it replaces `<Input type="date">` in place:
read it from `FormData` by `name`, or pass `value` and `onChange(value)`. `min` and `max` bound the days.
It is a 44px paper button that opens a month (shadcn Popover with react-day-picker), in en, es and ht, and never
uses the system date box, so it holds its width on iPhone. Time off uses it; other rooms can switch when they like.
