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
| `types.ts`, `primitives.tsx` | Shared types; `LiveLoading`, `LiveEmpty`, `LiveField`. |
| `convex/schema.ts` | Every table. |
| `convex/access.ts` | `user()` and `membership()`: the gate every backend function starts with. |

## Where each stream builds

| Stream | Screens | Backend |
| --- | --- | --- |
| Volunteer side (built) | `volunteer/` | `convex/workspace.ts`, `convex/pages.ts` |
| Help line and neighbors | `help-line/` | `convex/neighbors.ts`, `convex/assistance.ts` |
| Home visits | `visits/` | `convex/visits.ts` |
| Treasury | `treasury/` | `convex/treasury.ts` |
| Reports and yearly counts | `reports/` | `convex/reports.ts` |
| AI and languages | `src/lib/words/<language>.ts` | `convex/drafts.ts` |
| Demo and submission | none | `convex/sampleData.ts`, `scripts/` |

## Adding a section

A section is a component with no props. It reads `useWorkspace()` for the group
and the signed-in person, and fetches its own records with `useQuery` against
its own backend file, passing `data.church.id`. It does not add fields to
`workspace.dashboard` or commands to `workspace.execute`. Styles go in a CSS
file imported by the section, using the existing `live-*` classes first.

To appear in the menu a section needs one line each in `areas.ts`,
`navigation.ts` (entry, heading, primary action) and `sections.ts`.
