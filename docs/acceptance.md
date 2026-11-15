# Neighborly completion evidence

## Current artwork: restored painted relief

The user explicitly preferred the earlier painted relief. The main page now
imports and passes `reliefArtwork` from `src/lib/artwork.ts` to the stage and
posters, with `data-artwork="relief"`. This selects
`public/assets/living-relief.glb` and its existing matched stills. The cast
experiment is preserved in the workspace and is no longer the main artwork.
The stateful coordination flow, draft validation and other functional fixes
remain in place. After restoration, direct lint, typecheck, production build
and all 32 tests passed. The production preview at `http://127.0.0.1:3140`
was reviewed at 1440 px, 789 px with DPR 2, and 390 px, including acceptance,
decline and no-WebGL behavior. The 789 px brand paper backing correction was
verified. These are restored-relief checks; cast results below remain separate.
The diagnostic server on port 3141 was stopped. No physical frame-rate result
is inferred from these browser checks.

## Preserved cast experiment and verification history

The following records the cast work and its bounded checks before the user
chose to restore the relief. It does not claim the cast is currently mounted
or that its original visual target was accepted. No work was removed.

### Anatomical source and licensing

The project session records installation and use of MPFB, followed by
sculpting and garment/hair studies. The installed MPFB 2.0.18 base file
identifies MakeHuman basemesh hm08 and an explicit September 2020 CC0 release.
The inspected source is
`/Users/josephsimo/Library/Application Support/Blender/5.2/extensions/user_default/mpfb/data/3dobjs/base.obj`.
Its header names Data Collection AB, Joel Palmius and Jonas Hauquier.

MPFB's program code is GPL-3.0-or-later; its bundled graphical assets are CC0.
The upstream explanation distinguishes these categories and the generated
output: https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md.
The retained asset license and inspected base notice are in
`licenses/MakeHuman-MPFB-CC0.md` and `licenses/MakeHuman-MPFB-NOTICE.md`.

The final-scene inspection reported body mesh names `base.025` (Ellis),
`base.023` (Noor / `Facial profile sculpt trial.001`) and `base.001` (Grace),
with empty object and mesh custom-property maps. No source UUID survived.
The session and installed source establish an MPFB/MakeHuman base input;
they do not establish a complete per-object derivative chain or inventory
of optional system assets in the final export. Do not label the cast wholly
from scratch or claim no third-party art inputs. No new license is assigned
here to Neighborly's later sculpting, clothing, animation or composition.

The earlier font OFL records remain in `licenses/` and `public/fonts/`.

### Cast runtime integration before restoration — 12 November 2026

`src/app/page.tsx` passed `castArtwork` to the live stage and fallback
poster. `src/lib/cast-artwork.ts` imports the v4 manifest, which selects the
v4 model and the six matching v3 stills. The runtime agent reported bounded branch,
reduced-motion and fallback checks passing on the isolated v3 preview at
`http://127.0.0.1:3138`. Direct workspace lint, typecheck, production build and 32 tests / 195 assertions
passed. The direct workspace production preview at `http://127.0.0.1:3140`
was checked at 1440 px with WebGL loading and acceptance, at 390 px in the
accepted state, and in forced fallback with decline and zero GLB requests.
Screenshots are retained at `output/playwright/cast-v3-desktop.png`,
`cast-v3-mobile-accepted.png` and `cast-v3-mobile-declined-fallback.png`.

The broader isolated preview checks covered all seven sample screens,
independent task completion and meeting RSVP, time-off preview/cancellation,
required local-draft fields and long text, keyboard focus, reduced motion,
asset failure/retry and data saver. These are bounded browser observations;
they do not establish full visual approval, physical touch/frame rate or field
Core Web Vitals.

### Physical iPhone Air touch flow — 12 November 2026

Using iPhone Mirroring, the primary agent operated Safari on a physical
iPhone Air at `http://192.168.50.218:3140`, the LAN address of the direct
workspace production preview. Touch interaction opened the 22 November
commitment, reviewed and confirmed that exact date change, and showed
Grace's 8 November and 6 December commitments and continuing team membership.
The agent then simulated the coordinator's request and explicitly accepted
as Noor. The animated handoff endpoint showed the guide in the receiving
palm. Preparation was available with the time zone, meeting place and role
guide. These observations are in the computer-use transcript; no screenshot
files were saved for this physical-device check.

This establishes the observed touch/visual flow on that physical iPhone Air.
It does not measure frame rate, GPU completion or stable 30 fps on a named
midrange phone. Those performance requirements remain unverified. Safari
also darkened the page during this check. An authored light-color-scheme fix
is being rebuilt and still requires a physical-device recheck; the earlier
flow is not evidence that this appearance issue has been fixed.

### Requested integrated-browser validation

The user explicitly requested validation in ChatGPT's integrated browser
instead of continuing the physical-phone diagnostic attempt. The primary
agent completed the acceptance flow there and found that the 789 × 891,
DPR 2 layout clipped Noor. A responsive correction is in progress and needs
a fresh check at that geometry before this pass can close. This requested
browser pass replaces further attempts to collect the phone diagnostic in
this run; it does not turn the unmeasured physical frame rate into a pass.
The earlier physical iPhone Air touch flow remains separate evidence.

### Preserved V4 cast package — 12 November 2026

The previously promoted cast runtime selected `public/assets/cast-handoff-v4-manifest.json`
and `public/assets/cast-handoff-v4.glb`. The model is 1,471,164 bytes with
SHA-256 `5ba8d361a94c7c812b65b91f7d4456bd168dc381e8770be0a429b28c2b7c6cf1`.
V4 derives from the v3 GLB and retains the v3 editable scene and six authored
stills. Palette material conversion and compatible primitive batching reduce
51 mesh primitives to four; independent comparison reports unchanged geometry,
skins and animation. Tested rest/accepted rendered-image channel differences
were at most 2/255. This is a bounded visual comparison, not identical material
factors. The retained `art/tooling/batch-cast.ts` reproduced the exact v4 hash.
Its dependencies are pinned by `art/tooling/package.json` and `bun.lock`.
The permanent authoring script, source hash and reproduction command are
recorded in `art/renders/cast/cast-handoff-v4-receipt.json`.

Direct workspace lint, typecheck, production build and 32 tests / 195 assertions
passed after v4 promotion. The production preview at `http://127.0.0.1:3140`
served the exact v4 model hash and its JavaScript selected v4. A bounded
acceptance smoke check reached preparation and observed at most nine draw
calls, including shadow work. The candidate's desktop submission-cadence
sample had median 16.7 ms, p95 16.9 ms and maximum 17.6 ms; the desktop browser
at responsive dimensions had median 16.7 ms, p95 17.4 ms and maximum 17.9 ms.
Neither sample measures physical-phone frame rate or GPU completion.

Physical iPhone Air acceptance/preparation was observed as described above.
Quantified phone frame rate remains pending: ScreenCaptureKit failures limited
further computer-use access. A diagnostic page at port 3141 was prepared to
receive an automatic frame sample; preparing that page or asking the user to
open it is not a received measurement. The authored light-scheme metadata and
CSS were rebuilt, but physical Safari continued darkening the page in the
reported recheck; do not claim that appearance issue resolved.

### V3 cast export — 12 November 2026

The saved editable scene is `art/cast-handoff-v3.blend`, prepared from
`art/cast-lod80-pose-final.blend`. The exported model is
`public/assets/cast-handoff-v3.glb`: 1,838,960 bytes, SHA-256
`2885f8fdc1643a8a8b1e5c88077cc35977939d1171ef0e4f39c605c0f7ad6148`.
The matching manifest is `public/assets/cast-handoff-v3-manifest.json`.
It records four desktop and mobile camera states and six matching WebP stills
for rest/accepted at desktop, mobile and narrow sizes. Source PNG renders and
a checksummed receipt remain under `art/renders/cast/`.

Independent decoded inspection reported three skins and five two-second clips
(`rest`, `settle`, `pending`, `accepted`, `declined`), finite animation transforms,
normalized skin weights, and zero exact zero-area triangles. Eleven tiny
sliver triangles match the uncompressed reference. The lossless codec
introduces none. These structural checks do not establish visual quality,
body clearance through every pose, browser performance or physical-phone
acceptance. Earlier export measurements do not apply to v3.

The model uses a lossless meshopt pass through `art/tooling/encode-meshopt.ts`;
the receipt records glTF Transform 4.5.1 and meshoptimizer 1.3.0.
`art/renders/cast/cast-handoff-v3-mesh-cleanup.json` and
`cast-handoff-v3-lossless.json` retain the source cleanup and encoding evidence.

## Historical relief evidence

The following describes the earlier relief implementation and its recorded
checks. It is not acceptance evidence for the new cast or the full original
character brief.

### Earlier relief implementation

The earlier page rendered `public/assets/living-relief.glb` through
`src/components/relief-stage.tsx`. Generated imagery supplies the painted
portrait textures, with source layers retained under `art/textures/`. Blender
supplies the displaced hand surfaces, the paper guide, the gesture rig and
animation, and the stage. The portraits are pigment layers within the relief.
The editable scene is `art/living-relief.blend`. Its authoring source is
`art/build_relief.py`.

The relief manifest lists the desktop and mobile backgrounds, donor hand, and
receiving hand source images. It records sizes, camera presets, and guide
transfer. PNG render sources are retained in `art/renders/relief/`. Font
provenance and OFL licenses remain in `public/fonts/` and `licenses/`.

The GLB is 2,022,328 bytes with SHA-256
`231efe7c94e00537e402fc4624a8f878479b1816d76d8579f2fdb56c66092765`.
The accepted clip was regenerated from the authoring function in Blender to add a brief contact hold before the guide follows the receiving hand. The other four animation streams and embedded images match the previous export; the existing stills were preserved. The staged export was reviewed in a local browser. Earlier performance measurements below describe the previous GLB.
The export contains one relief scene, eleven mesh instances, one skin and seven
textures. The `rest`, `settle`, `pending`, `accepted` and `declined` clips each
are authored over 1.5 seconds; the exported accepted clip spans approximately 1.53 seconds due to frame sampling. The exported 54,412 triangles, including all responsive
backgrounds, match the source and public manifests. The six browser WebP
stills, GLB and public relief manifest total 2,492,815 bytes on disk.

On 10 November, the mobile portrait pigment was updated to match the desktop's
shared outward gaze. The versioned source image is an image-generation edit
of the earlier mobile pigment with the desktop pigment as a visual reference;
its SHA-256 is
`803d51b7695deacab8e271747ae5f9b0298d61f4e17f5cb8a2dab0f6ef706146`.
The original mobile pigment remains retained. The mobile date rail now has a
paper backing for contrast over the artwork. Blender regenerated the scene,
GLB, and stills; the desktop WebP stills are byte-identical to the previous
release. Earlier browser performance and interaction measurements below were
made with the previous GLB and should not be read as fresh measurements of
this export. Independent inspection confirmed the same animation accessor
streams and full-width mobile stills in the new export.

The current production browser was reviewed at 390 × 844 after the rebuild:
the outward-facing profiles remain in frame, the paper-backed date rail is
legible, and the accepted guide reaches the receiving palm. The forced-no-WebGL
accepted still was also reviewed without the earlier right-edge gap. The current
scene, GLB, sources, stills, and authoring metadata have a checksummed local
recovery copy distinct from the preserved pre-change backup.

An additional generated narrow-screen pigment, derived from the existing mobile
artwork, keeps the profiles and light headline area within the 320 px crop. Its
source is `art/textures/relief-background-mobile-narrow.png` with SHA-256
`75a299540e7fee908efc03ba679cd164ae1c4ff8f732be11427487e213ff7714`.
At widths up to 420 CSS pixels, the renderer selects this background and the
no-WebGL path selects its matching stills; the other backgrounds remain in the
export. The narrow hero uses a rightward camera target and matching still-image
crop to keep the accepted guide in view; the closer-look section remains
centered. Browser review at 320 px covered initial and accepted states with
WebGL and forced fallback, including the centered study; 420 and 421 px checked
the responsive boundary. Independent inspection found no full-width still edge
gaps and confirmed that all five animation streams match the prior export.

### Current relief browser evidence

`../design-qa.md` records the earlier production browser review at 1440 × 900,
1280 × 720, 390 × 844 and 320 × 700 CSS pixels. In the updated export's
1280 × 720 review, the angled guide traveled to Noor's receiving palm after
explicit acceptance. A repeat view after lowering the date rail showed the
guide clear of the rail. The 1440 × 900 acceptance review also showed the guide
resting in the receiving hand above the date rail.

| Brief requirement | Current evidence |
| --- | --- |
| Editable art, four compositions, guide, rig, named clips and authored stills | Relief source, GLB, manifest and WebPs are present. Portrait pigment uses generated images, and the gesture rig and guide are Blender geometry. The selected relief direction replaces fully volumetric figures. The combined handoff is exported as `accepted`. |
| Church-coordination first viewport and responsive person controls | Browser rechecks showed separated desktop headline/date, legible rail, readable mobile headline, and Grace and Noor under a visible “Explore as” caption. Noor opened her example. At 320px the header and sheet remained visible and the sheet scrolled to its lower controls. |
| Date choice, explicit acceptance/decline, preparation and workspace | Browser checks observed both response branches and workspace navigation. Reduced-motion acceptance put the guide on the receiving hand after explicit acceptance and exposed preparation. Current source retains the separate membership/date and no-message rules. |
| Native scroll framing and preserved decisions | Desktop review moved from portrait to hands and back. The 390px browser showed distinct frames and retained 6 December on return, with one canvas. Reduced-motion desktop scrolling retained the group frame and readable captions. |
| Keyboard navigation and focus | Browser keyboard checks traversed dates, actor selection, change review, request, acceptance, preparation tabs and selected workspace navigation. Escape restored the respective opening controls. Other workspace controls remain outside the bounded check. |
| Motion and pause | Decoded tracks from the previous GLB ran through a Three.js mixer and the shared playback controller. The guide advanced by 0.32 s, held during a 0.5 s pause, resumed without jumping and reached the receiving endpoint. Reduced motion, acceptance while paused and restore reached the same endpoint. A slowed diagnostic browser build also showed the guide holding between hands and resuming to the receiver. The new export's animation accessors were independently checked as identical. |
| Still fallback and recovery | Forced `?noWebGL` preserved the accepted and declined choices and matching guide stills. A blocked GLB request left the still and commitment sheet usable. After clearing the block, Load interactive artwork restored rendering. Simulated context loss using `WEBGL_lose_context` exposed the still and Load control, and retry recreated the renderer. |
| Actual browser quality and physical-device performance | Initial desktop render and keyboard selection reported no console errors. The concept and implementation were compared at matching displayed proportions and in an enlarged region. A persistent comparison and focused crop are saved in `art/qa/`. Physical touch and frame rate on a named phone remain unverified. |
| Provenance and resource targets | Source materials, source renders, fonts and licenses are recorded above. Relief asset sizes are measured files. They establish neither end-to-end transfer nor frame rate. |

### Bounded local renderer and transfer measurement — 10 November 2026

An isolated production staging build used the current page and relief asset with
only a temporary diagnostic overlay added immediately after `renderer.render`.
In an in-app desktop browser on its initial group frame, Three.js reported **11
draw calls and 52,804 rendered triangles**. This is a runtime count for that
frame; it differs from the manifest’s static mesh count and is not a maximum
across every camera and state. The renderer in this build did not enable shadow
maps. The local browser resource timing entries present at the first rendered
model frame totaled **1,882,416 transfer bytes**, including the GLB at
**1,279,217 transfer bytes** (1,278,917 encoded body bytes, 1,901,848 decoded).
These timing entries exclude the navigation document; a separate local gzip
request returned a 3,954-byte HTML body. The temporary instrumentation changes
one JavaScript chunk slightly, and this local, first-frame measurement is not a
field measurement or a full-session transfer budget. Physical-device frame rate
and touch remain unverified.

The earlier sculpted mural evidence below is preserved as history.

## Historical sculpted mural

> **Visual direction rejected by the user — 5 November 2026.** The user explicitly
> rejected the result as merely people in 3D and not an award-quality website.
> The technical and functional checks below remain historical evidence, not
> visual acceptance or completion. See `awwwards-study.md` for the subsequent
> firsthand reference study. A new whole-experience direction is required;
> polishing the existing figures or sticky layout is not sufficient.

Scope: the supplied “Living Mural” brief, including the full essential scene,
branching example, sample workspace, and editable team draft. The first visual
slice is a milestone, not a replacement for that scope. All unchecked items
remain unverified; source presence alone does not establish rendered behavior.

## Product behavior

- [x] Supplied church-coordination hero copy and immediate sample/start actions
  are implemented and present in the reviewed browser experience.
- [x] Six Sunday records separate active membership from dated commitments.
  Initial accepted dates are 8 Nov, 22 Nov and 6 Dec 2026; tests and the explicit
  unassigned branch preserve the no-commitment distinction.
- [x] Preview, cancellation and confirmation affect only the selected/previewed
  owned dates; other commitments and membership persist. Unit tests and the
  bounded keyboard/browser workflow prove these state transitions.
- [x] Named Grace/coordinator/Noor views and approved/available/opted-in candidate
  facts are implemented; the browser request/response flow was exercised.
- [x] Pending has no success timer. Explicit Noor acceptance assigns one date;
  decline leaves it open with a next-step control. Task completion is separate.
- [x] Shared commitment component has the date, 09:30–11:00, Eastern time zone,
  team, location, three steps, coordinator, change action and truthful synthetic
  contact dialog. Noor's subsequent change was browser-tested.
- [x] Task completion and meeting response use separate state/actions and were
  browser-tested; neither action claims a real message was delivered.
- [x] Sample workspace preserves accepted outcome/date across entry; reset has
  independent state tests. Membership and dated commitments are separate in Team.
- [x] Current source makes My commitments actor-aware, with Grace/Noor choice,
  team membership, volunteered availability, dated entries and Take a break.
  The preparation panel now has adjacent commitment/task/meeting tabs using
  shared components. The main-agent browser checks confirmed Noor’s empty and
  accepted-date states plus the adjacent dated task.
- [x] Description produces a bounded editable draft, asks for missing first date,
  zone, role and participants, and was browser-tested without invented consent.
- [x] Source uses synthetic labels and contains no message-send transport;
  sample interactions cannot send real messages. This is a local sample, not a
  claim of configured hosted accounts or a production communication service.

## Authored scene and files

- [x] Original authored geometry, three characters, one folded guide, procedural
  materials, rig, editable `art/neighborly.blend`, and authoring script exist.
  No external character pack or texture download is used.
- [x] Export contains one 40-joint skin and seven named clips; camera presets,
  state mapping, PNG source renders and optimized WebPs are delivered.
- [x] Final rendered pass reviewed the authored cast, protected copy, and guide
  contact in the actual browser scene. Desktop and mobile details are recorded
  below; this is visual review of this implementation, not an art-quality score.
- [x] Four desktop/mobile camera presets and passive scroll-selected chapter
  states are implemented without mutating product decisions.
- [x] Story-stage visibility defect was corrected and reverified: all four
  desktop frames remain readable; mobile group/person are composed in flow and
  exchange/preparation retain full heads and feet. Reverse scrolling preserved
  the accepted 22 November assignment.
- [x] Explicit acceptance alone selects the authored handoff clip; pending and
  decline select their separate visual paths. Slow-frame completion has a real
  AnimationMixer unit test; accepted reduced-motion endpoint was observed.
- [x] Accepted, pending and declined reduced-motion states were browser-reviewed:
  pending has no assignment; decline retains the guide with Ellis and uses a
  purposeful neutral pose. Final preparation review showed the guide supported
  by Noor; pending/exchange retained it with Ellis.
- [x] Still images load in forced-no-WebGL and low-data modes; actual context
  loss reveals the still and retry restores the renderer. GLB-load failure was
  separately exercised with a blocked request and retained the usable HTML.
- [x] Newsreader/Source Sans 3 originals and optimized fonts have recorded
  provenance/checksums and retained OFL licenses; original art provenance is
  recorded. Procedural colors require no separate texture-source files.

## Accessibility, quality and performance

- [x] Visible motion controls, reduced-motion final-pose handling, low-data opt-in
  and offscreen/inactive render cancellation are implemented. Observed checks
  are recorded below with their limits.
- [x] Bounded keyboard path covers section focus, actor focus/selection,
  preview/cancel and contact-dialog return focus. Source supplies native controls,
  visible focus, labels and live state announcements.
- [x] Local keyboard/action-path checks passed for the documented workflows.
  Actual phone touch remains unverified: IAB did not support dispatching the
  attempted touch event, and no connected physical phone was available.
- [x] 390px long-name/long-role check and a 2x browser page-scale check retained
  content and next-field keyboard access, as observed by the main agent.
- [x] Customized shadcn primitives and a shared paper/ink/pine/violet visual
  system are present across marketing and workspace; no audio/flashing is added.
- [x] Lint, typecheck, 24 unit tests/129 assertions, and production build passed.
  Main production tab reported no unexplained console warnings or errors.
- [x] Emitted-resource audit is below proposed initial/3D-JS size targets, GLB is
  33,375 triangles, and DPR is capped at 1.5. Runtime shadow-inclusive draw calls
  and actual network measurements remain separate from these static estimates.
- [ ] Named physical midrange-phone frame-rate measurement remains an explicit
  brief requirement. Desktop frame-scheduling evidence is recorded below.

## Verified checkpoints — 5 November 2026

These checked items are narrower than the full gates above. Unit tests establish
state behavior; browser observations below were reported by the main agent at
1440px desktop and 390px mobile review sizes, not by a physical-phone audit.

- [x] Current `bun run test`: **24 tests / 129 assertions**. Coverage includes
  independent preview/cancel/confirm, exact multi-date effects, membership and
  other-date preservation, explicit Noor acceptance/decline, cross-date isolation,
  Noor releasing only her own assignment, reset, bounded draft extraction, and
  a real Three.js AnimationMixer reaching its endpoint with capped 15fps steps.
- [x] Main-agent final check run: `bun run lint`, `bun run typecheck`, production
  build, and **24 tests / 129 assertions** passed. The production server was then
  used for subsequent runtime checks.
- [x] Main-agent desktop browser check: acceptance carries into the workspace
  while other dates remain; Noor can release her accepted date; accepting the
  meeting does not complete the task.
- [x] Main-agent mobile forced-no-WebGL browser check: zero canvas elements,
  all displayed images load, acceptance switches both artwork instances to
  accepted WebP paths, and pending/declined outcomes have working controls.
- [x] Main-agent browser check: draft copies the stated two people, recurrence,
  and literal time; completing the local review form works without claiming a
  server-created team or sent invitations.
- [x] Source review confirms focused section navigation, explicit modal opener
  restoration, focus on workspace headings after screen changes, controlled
  meeting-tab navigation, and removal of the forced-fallback load button.
- [x] Source review confirms no timer advances request acceptance, task completion
  remains independent, low-data waits for opt-in, reduced-motion requests use
  final poses, and offscreen/inactive scene loops are cancelled.
- [x] Current `Home` scroll owner (`src/app/page.tsx`, lines 1036–1068 at review)
  uses a passive, requestAnimationFrame-throttled listener to choose group,
  person, exchange and preparation as their sections cross 42% of viewport
  height. Both mural props consume this state. The listener never dispatches a
  product decision and supports reverse scrolling.
- [x] Main-agent reduced-motion browser checks observed the accepted final pose
  and, at 390px, pending without assignment and decline with the guide still at
  Ellis in a purposeful neutral pose.
- [x] Main-agent actual context-loss test used `WEBGL_lose_context`. After fixing
  an obscuring canvas, the production retest showed the host hidden, poster
  opacity 1, and the image visible. Load interactive artwork produced a new
  canvas with visible host and poster opacity 0.
- [x] Main-agent low-data test used native CDP `Emulation.setDataSaverOverride`:
  with `saveData: true`, canvas count was 0 and the poster completed; explicit
  Load produced canvas count 1 and poster opacity 0. The override was removed.
- [x] Main-agent keyboard check at 720px: Enter on Explore focused `#example`,
  roving arrows focused an actor, Space selected, Enter opened change review,
  Enter on Keep cancelled, and Escape from Contact returned to its trigger.
- [x] Original and optimized fonts have provenance/checksums and OFL copies;
  original Blender geometry, editable source, rig and visual mapping are present.

### Latest source-and-unit checkpoint

After the newer core-screen changes, this independent run passed **24 tests /
129 assertions**, `bun run lint`, and `bun run typecheck`. New validator tests
cover whitespace-only values, explicit AM/PM and 24-hour intervals, impossible
dates/leap days, named zones and integer capacity. The camera test verifies
the exact source/export/runtime preset equality and four distinct compositions
per viewport. The main agent subsequently completed the production build and browser
retests described below; unit tests alone do not establish those UI outcomes.

Current source also shares the pause preference between both mural instances,
plays the authored settle clip on first arrival, unmounts artwork when the
preparation panel expands into the workspace, and restores the story on close.
The main agent subsequently verified expansion/focus/canvas removal and shared
pause persistence in the current production browser; authored settle and the
complete camera sequence remain separate visual checks.

## Current asset measurements — 5 November 2026

These measurements describe the latest file inspected during final refinement.
They do not certify visual quality, runtime draw calls, or physical performance.
Recheck if assets are replaced.

Artifact: `public/assets/neighborly.glb`, SHA-256
`332e368161367ccf2d78d8523941da122591f54de73620faf89787590b77eec9`.
The GLB header, version, declared length, JSON and accessors were parsed directly.

| Metric | Observed | Scope / implication |
| --- | ---: | --- |
| GLB bytes | 1,146,152 | Below 2.5MB optional-art target |
| GLB gzip bytes | 395,589 | Offline estimate; actual server transfer unmeasured |
| Mesh triangles | 33,375 | Indexed triangles in exported mesh instances |
| Mesh nodes / material primitives | 16 / 16 | 16 base scene draws; runtime shadows/passes additional |
| Skins / joints | 1 / 40 | Present; visual deformation reviewed separately |
| Materials / textures | 16 / 0 | PBR colors, no texture-image dependency |
| Desktop resting WebP | 18,878 bytes | Generated from original Blender PNG |
| Desktop accepted WebP | 19,134 bytes | State-specific guide handoff end pose |
| Mobile resting WebP | 15,376 bytes | Separately composed source render |
| Mobile accepted WebP | 16,118 bytes | Separately composed accepted source render |
| Manifest JSON | 2,958 bytes | Camera and visual-state metadata |
| GLB + four WebPs + manifest | 1,218,616 bytes | Active browser artwork payload; under 4MB |
| Three active font files | 52,080 bytes | Two Newsreader instances/subsets plus Source Sans 3 variable |

Original PNG renders are preserved in `art/renders`. Duplicate PNG files have
been removed from `public/assets`; its six files now total 1,218,616 bytes.
`art/optimize-assets.ts` preserves new source exports before deleting public PNG
duplicates and records the repeatable WebP conversion. No external imagery was
introduced.

Seven clips each contain 120 animation channels. Accessor time ranges give:

| Clip | Seconds |
| --- | ---: |
| rest | 1.967 |
| settle | 1.167 |
| attend | 1.167 |
| offer | 1.567 |
| receive | 1.567 |
| decline | 1.467 |
| accepted | 1.767 |

## Production emitted-resource audit

Build ID: `DkdM4zht_MYRfyA4qQt1I`. These figures were computed from the owning
`.next/server/app/index.html`, its exact linked chunk files, and local assets.
They use independent gzip streams at default level; actual HTTP encoding,
headers, caching and network timings may differ. Images/fonts are already
compressed and counted by their raw transfer file sizes.

| Resource group | Bytes counted | Basis |
| --- | ---: | --- |
| Initial HTML | 8,111 | 57,060 raw bytes, gzip estimate |
| Linked CSS | 10,948 | `355chfu_4ed60.css`, 58,287 raw bytes |
| Seven unique modern linked JS chunks | 184,463 | Gzip sum, excludes `nomodule` polyfill |
| Three active font files | 52,080 | WOFF2 bytes referenced by font CSS |
| Initial desktop poster | 18,878 | Same URL used twice; counted once |
| **Modern initial estimate** | **274,480** | HTML + CSS + JS + fonts + desktop poster |
| Mobile initial estimate | 270,978 | Replaces desktop poster with 15,376-byte mobile image |
| Legacy `nomodule` polyfill | 39,473 | Separate from modern total; 112,594 raw bytes |
| Optional Three.js + GLTFLoader JS | 201,984 | Three unique dynamically loaded chunks, gzip sum |

The modern linked JS gzip counts are `0xa--a0onjdk5.js` 6,962;
`1i04lm2-zu6qv.js` 48,995; `2-3bcc782c_pu.js` 71,787;
`turbopack-2u1d16houkiyo.js` 3,909; `0wj0noag-9_fs.js` 3,613;
`1voksnwp42cs4.js` 240; and `423u3khwi-hhz.js` 48,957. The initial HTML's
preload duplicates an existing script URL and is not counted twice.

The emitted dynamic-import stub (`1voksnwp42cs4.js`) maps Three.js and GLTFLoader
to `3q9giy0a_1pi8.js` (87,399 gzip bytes), `1gfrng4oz7oly.js` (13,430), and
shared `33vbglkbcj74y.js` (101,155), counted once. These chunks are not initial
script links. Source defers their import until artwork enters the viewport, so
they may still arrive early on a visible hero; this is not a claim of delayed
network timing. No decoder payload is required by the current uncompressed GLB.

This accounting is below the proposed 350KB initial and 400KB additional-3D-JS
targets. It excludes favicon/headers and does not establish Core Web Vitals.

## Remaining evidence and scope limits

### Core-screen findings resolved; bounded runtime retests passed

- `StartTeam` now reads named fields through FormData, validates trimmed presence,
  actual calendar dates, explicit same-day time ranges, named time zones and
  whole-number capacity, then focuses the first invalid field with associated
  error text. Form changes clear its reviewed state. Unit tests cover validation.
  Main-agent production checks blocked whitespace/banana values with linked
  errors and focus on team name, accepted a valid form, and cleared readiness
  when its role was edited.
- This week now states “Week ending Sunday”; fixed task and meeting dates are
  explicit (21 and 19 November 2026). For other selected Sundays, they appear
  under Other dated work rather than claiming to belong to that week. The main
  agent confirmed the 6 December view displays explicit 19/21 November dates
  beneath that heading.
- Person profiles now include actionable owned commitment dates and an empty
  state, in addition to their count. The count/list derives from the same owner.

Time-off ownership checks and reducer reset independence have test coverage;
the reviewed source did not reveal an additional defect in those transitions.
No previously reported core-screen source bug remains open at this checkpoint.
The additional bounded runtime checks below cover the newer implemented flows.

### Additional current-production browser checks

Reported by the main agent after the 24-test build:

- Open this sample team replaces the preparation panel in place, focuses
  `#workspace`, and leaves zero canvases while the workspace is open.
- Noor’s My commitments contains active team/availability information, shows
  the correct empty state, and lists 22 November after explicit acceptance.
- The adjacent Task tab renders the shared task due 21 November 2026.
- Shared pause persists after returning to the story and remounting the hero:
  two Resume controls and zero Pause controls are shown.
- At 390px, the expanded workspace has correct focus, measured scroll width
  375px within the 390px viewport, and a legible reviewed screenshot.
- After correcting Radix state/orientation selectors, the final 390px production
  retest showed the Tabs root in a column, the Task control visibly selected,
  and its complete panel legible; scroll width remained 375px within 390px.
  Source also forwards orientation to Radix and uses matching selectors in
  Dialog, Separator and ToggleGroup, with `tw-animate-css` imported.
- Lint, typecheck, the 24-test/129-assertion suite and production build passed.
  The later camera-stage correction was reviewed in the rendered browser as
  described below; passing code checks alone were not used to approve its layout.

### Remaining verification and deployment-scope limits

- Accepted, pending and declined reduced-motion endpoint checks passed as
  described above, followed by the final rendered art/contact pass.
- A tab-scoped block of the GLB request preserved the visible poster and working
  commitment preview. The block and cache override were removed and the test tab
  closed. GPU renderer-construction failures remain distinct from this check.
- Bounded keyboard checks cover Enter navigation to the example, arrow focus
  and Space selection between actors, preview/cancel, and Escape closing the
  coordinator dialog with focus restored. A long team name and approximately
  1,000-character role description stayed within the 390px layout. A 2x browser
  page-scale check retained keyboard access to the next form field. These checks
  do not constitute a full accessibility or real-touch-device certification.
- The camera-stage defect is resolved. Final desktop 1440px review showed the
  group hero, full cast at the person chapter with left copy, full Noor/Ellis at
  pending exchange with the guide held by Ellis, and accepted preparation with
  the guide supported by Noor and protected copy. The sticky stage stayed
  visible. Native reverse-to-home scrolling retained Noor's accepted 22 November.
  At 390px, group/person remained readable in flow; tightened exchange and
  preparation retained full heads/feet and a visible supported guide. Preparation
  scroll width was 375px within the 390px viewport; no console warnings/errors.
- Touch emulation was enabled, but IAB rejected `Input.dispatchTouchEvent`; it
  was then disabled. This is not successful touch execution. Actual phone touch
  behavior and named midrange-phone performance are the remaining external
  verification, with no connected/available phone and no user reply yet.
- The application remains an account-free local synthetic workspace and local
  draft, as labeled. It has no connected account sign-in, durable server team
  creation or real messaging. Do not present it as a hosted operational service.
- End-to-end actual HTTP transfer, runtime draw calls, LCP, INP and CLS have not
  been measured here. Emitted-file accounting supports the size targets but does
  not prove network performance or field Core Web Vitals.
- On the physical Apple M3 Mac (`Mac15,12`), a 2.3-second requestAnimationFrame
  probe during the actual accepted handoff recorded 138 intervals, mean 60Hz,
  p95 17.7ms and maximum 17.7ms. The production tab reported no console warnings
  or errors. This measures browser frame scheduling during the interaction,
  not GPU throughput or field performance. The named midrange phone check is
  still pending; the user has been asked about availability. Field Core Web
  Vitals remain unknown.
  A fresh `devicectl` inventory found no connected physical iOS device; paired
  phones were reported disconnected or unavailable. This does not prove a
  physical-phone test can be performed from the current desktop session.
- The final rendered pass used actual exported browser output. No unresolved
  local implementation defect or useful required local work is currently known.
  Formal accessibility certification and field Core Web Vitals are not claimed;
  their absence is not being substituted for the specific outstanding phone test.

### Direct workspace validation — 10 November 2026

A frozen Bun 1.4.4 install restored the workspace dependency directory after
local iCloud placeholders caused lint to stall. Stale generated Next.js output
was preserved separately and rebuilt. From the workspace itself, lint,
typecheck, production build, and 26 tests / 178 assertions passed. The prior
dependency directory and generated caches remain under ignored `node_modules`
as dated backups. These checks do not replace the physical-device review above.

The rebuilt workspace was served directly with `next start` on port 3002. The
browser displayed the sample, and loading interactive artwork replaced the
fallback control with the motion control. The preview remains local.

### Saved visual comparison — 10 November 2026

The initial live browser capture and normalized full and focused comparisons are retained in `art/qa/`. See `design-qa.md` for dimensions, state, and observed differences. Earlier references to missing persistent comparisons are superseded. The comparison itself does not establish in-flight timing or physical-phone performance; the separate slowed diagnostic review below covers the former.

### Browser handoff pause review — 10 November 2026

An isolated diagnostic production build used the current GLB and playback
controller with a visible guide-position overlay and playback slowed to 0.2×.
After explicit acceptance, Pause held the guide visibly between hands at
x=0.0685, y=2.7462; a later browser observation retained that position. Resume
advanced it through x=0.1682, y=2.7519 to the receiver at x=3.2911, y=2.5005.
The timing and overlay were diagnostic changes, not production behavior. This
supplements the earlier numerical test and supersedes the note that direct
browser observation of an in-flight pause was missing.

A named iOS 18.4 simulator was also booted for a touch attempt, but Safari did
not open the site and timed out; no touch result is claimed. The simulator was
shut down after the attempt. Browser CDP allowed enabling touch emulation but
rejected touch-event dispatch, so it did not establish touch behavior either.

### Current validation update — 10 November 2026

The date-specific decline and release behavior prevents a repeat request for the
same date. The clean staging copy passed lint, typecheck, production build, and
26 tests / 182 assertions. Browser checks verified the artwork label in WebGL
and fallback study views without a duplicate announcement. The fallback PNG
sources were restored byte-identically, and WebPs were re-encoded with the same
settings and size; the original WebP hashes were unavailable, so byte identity
of those encodings is not claimed. Physical-phone touch and frame rate remain
unverified.

### iOS simulator touch review — 10 November 2026

On the Mac's iOS 18.4 simulator named Bot 69, Safari opened the workspace
preview served by an older workspace server on port 3000, not the latest rebuilt server. Using the simulator mirror, taps and swipes opened the commitment,
reviewed and confirmed the date change, opened cover options, simulated a
request, opened Noor's response, and accepted. The resulting screen showed
“Noor · One accepted commitment” and the preparation action. The mirror
reported settings timeouts and briefly disconnected at the end; the accepted
screen was visible afterward. This is simulator touch evidence, not a physical
phone or frame-rate measurement. The simulator was shut down and no simulator
remained booted after the check.

The touch flow was repeated against the current workspace production build on
`127.0.0.1:3015`, avoiding the older port-3000 process. On Bot 69 (iOS 18.4),
taps and a swipe reached change review, confirmation, the simulated cover
request, Noor's response, and the accepted state with preparation visible. This
is simulator evidence; it does not establish physical-device frame rate. The
mirror was stopped and the simulator shut down afterward.

### Desktop draw cadence and asset recovery

In a visible desktop browser tab, temporary JavaScript instrumentation recorded
the first WebGL draw submitted per animation callback during the actual accepted
handoff. It recorded 94 draw callbacks over 1,549.8 ms, with median interval
16.6 ms, 95th percentile 17.5 ms, and maximum 18.6 ms. This is one local
submission-cadence sample; it does not measure GPU completion, field performance,
or physical-phone frame rate. Instrumentation was confined to that tab, which
was closed after the check.

After iCloud evicted the GLB, Blender re-exported it from the open packed scene.
The recovered 1,901,848-byte GLB matched the prior verified SHA-256
`affec3609e2d35bb85cad1b0b34238ddce68262f680829e3da9336e7ad13ba90`,
and the live server returned it. A small recovery bundle outside the synced
folder retains that exact GLB, a packed copy of the open Blender session, source
images, the authoring script, and fallback WebPs. The session copy is not
claimed byte-identical to the original workspace `.blend`.

The original workspace Blender file was subsequently hydrated from iCloud and
cloned to the local recovery bundle separately from the session copy. Its
SHA-256 is `a5ce31e687a3afc00606b2bc21a9deb62dab471380d8bd397ac97e4e3dc8e18e`;
the clone was compared byte for byte. The four pigment sources matched their
recovery copies, and a 45-file source/config snapshot was checksummed against
the workspace. The bundle excludes dependencies and generated build caches;
iCloud may evict workspace files again.

The workspace was reinstalled from the frozen lockfile. Tailwind source
scanning is now scoped to `src`, avoiding the artwork directory. The direct
workspace lint, typecheck, production build, and 26 tests / 182 assertions
passed. The rebuilt desktop and 390 px mobile interface, including the
commitment sheet, were reviewed in the browser. The temporary old dependencies
were removed after verification. iCloud can still evict individual files.

A local browser data-saver override set `navigator.connection.saveData` to
true. On reload, the poster and Load interactive artwork control appeared with
no GLB resource request. Activating the control produced one GLB request and
the Pause motion control. The override was cleared and the diagnostic tab
closed. This is emulated browser evidence, not a physical-phone result.

A separate diagnostic build slowed the handoff to 0.1× and displayed its draw
count, visibility and guide position. Temporary bottom spacing allowed the
artwork to move fully outside the viewport. During an accepted handoff, the
counter held at 2,125 draws and the guide held at x=-0.7300 while the observer
reported the scene offscreen and playback still running. Returning to the scene
resumed draws and advanced the guide (2,393 draws, x=0.2948). The timing and
spacing were diagnostic changes; the production files were not changed.

The final narrow export was reviewed at 320 × 700 with reduced motion emulated.
After explicit acceptance, the interactive scene displayed the guide in the
receiving palm with the guide inside the viewport, and preparation remained a
separate action. The media override was cleared after the check.

The final narrow revision was subsequently built directly from the workspace
after a frozen dependency reinstall. Workspace lint, production build,
sequential typecheck, and 26 tests / 182 assertions passed. The direct build
was browser-reviewed at 320 px with the live artwork. The superseded local
validation stage and temporary dependency backup were removed afterward.

For the final narrow-art GLB (`cdff3344…1571a`), a visible desktop browser
recorded the first WebGL draw submission per animation callback during the
accepted handoff: 93 callbacks over 1,533.7 ms, median interval 16.7 ms, p95
17.5 ms, maximum 18.3 ms. This single local submission-cadence sample does not
measure GPU completion, field performance, or phone frame rate. The temporary
instrumentation was confined to a diagnostic browser tab that was closed.

For the current GLB, a local desktop browser with cache disabled recorded
1,960,297 transfer bytes in resource-timing entries through the interactive
artwork load, including 1,357,052 bytes for the GLB (1,356,752 encoded body;
2,022,328 decoded). This excludes the navigation document and is a local
single-session observation, not a field or full-session transfer measurement.
Browser caching was restored afterward.

A local diagnostic tab simulated WebGL renderer-construction failure by
returning null from the canvas WebGL context request. The still and commitment
sheet remained usable; after restoring context creation, the Load interactive
artwork action created the renderer and exposed Pause motion. The expected
Three.js context-creation error was observed only during the simulation. The
tab and its data-saver override were closed afterward.

The final layout was checked at 720 × 450 and 640 × 360 CSS pixels, which
approximate the available layout space of 1440 × 900 and 1280 × 720 windows at
200% zoom. At 720 px the hero extended below the viewport but its actions and
date rail were reachable by scrolling; at 640 × 360 the commitment dialog
scrolled to its lower action. This is a viewport-geometry check, not a direct
browser-zoom or assistive-technology certification.

A newly created temporary iPhone SE (3rd generation) simulator running iOS
18.4 loaded the current workspace preview. Using the simulator mirror, taps
and swipes completed the date-change and simulated-request flow through
Noor's explicit acceptance. The accepted still appeared after a noticeable
loading delay; the previous donor still remained visible during that delay.
This exposed a transition issue under investigation. The simulator was shut
down and the temporary device deleted afterward. This is simulator evidence,
not physical-phone performance.

On a temporary iPhone SE (3rd generation) simulator running iOS 18.4 Safari,
the updated still-image path was exercised through the simulated request and
acceptance. The accepted receiver image was visible in the observed frame. A
separate local browser failure simulation blocked the accepted WebP: the stale
donor image was removed, the artwork reported unavailable, and the HTML
commitment remained usable. With data saver enabled, no accepted-image prefetch
occurred before acceptance; without it, the pending request prefetched the
matching narrow still. These are simulator/browser observations, not a physical
phone or field-performance measurement.

For the fallback transition change, the clean local validation copy passed
lint, typecheck, production build, and 26 tests / 182 assertions. Direct
workspace tests also passed. Direct workspace lint and build were stopped after
more than 20 minutes of slow dependency reads without completing; they are not
reported as passes. The tested preview on port 3032 uses the validation copy.

## Current implementation validation — 13 November 2026

The latest local gates passed: lint, typecheck, 39 source tests with 211
assertions, 24 backend tests, and the production build. The build passed after
clearing a corrupt generated `.next` cache. The production preview on
`localhost:3144` was examined at desktop size with the original painted artwork.
Backend tests simulate authentication and provider behavior; they do not prove a
real sign-in, email delivery, or hosted acceptance.

Private workspace development targets the separate `neighborly-live` Convex
development deployment `valiant-canary-279`; the original backend was not
modified. Refreshing the Vercel CLI login resolved its access challenge. The
preview `https://neighborly-e1701c638-simo-js.vercel.app` reached READY after
including the imported camera-presets JSON in deployment packaging. The hosted
original artwork, explicit release/request/acceptance flow, and workspace
sign-in screen were checked in the integrated browser. This is a protected
preview, not a production promotion. Sender-domain configuration was deferred,
so signup remains disabled and no live email was sent or verified.


## The painting opens — 13 November 2026

The public entry preserves the original GLB and posters. An independently
authored procedural paper sheet uses the same Three.js renderer, opens from
the guide anchor, and aligns with accessible HTML. Paper opens in 900 ms and
closes in 550 ms; workspace details use the shared 350 ms paper surface.
The homepage offers Start, Join and Sign in, without assuming Sunday activity.
The optional fictional example remains separate. Existing tenant schema and
explicit commitment actions are unchanged.

Final gates: lint, typecheck, 44 unit tests / 234 assertions, 24 backend tests,
and production build passed. Browser review covered 1440 x 900 desktop,
390 x 844 mobile, 320 x 700 no-WebGL fallback, opening from the afterword,
close/focus return, reduced motion and the start-group route. Settled open
paper axe audits had zero violations on desktop and mobile (one and two
incomplete checks respectively). Mid-fade contrast is not a settled-state
audit. Tests verify zero-delta startup, finite animation endpoints, no idle
continuation and cross-tab entry restoration with expiration.

The protected preview https://neighborly-m3tj8c34t-simo-js.vercel.app was
visually checked after deployment, including its live paper opening.
Screenshots: output/playwright/paper-hosted-open.png and paper-open-mobile.png.
No physical-device frame-rate or completed authenticated workspace/browser
claim is made. Account creation and email delivery still await sender-domain
configuration. This is a preview, not a production promotion.

## Monumental first-scene candidate — 13 November 2026

A new review candidate combines TripoSR-reconstructed volumetric heads and
projected generated pigment with normalized hands derived from the preserved
MakeHuman-based cast. Sources, prompts, dependencies, and regeneration notes
are recorded in `art/monumental/provenance.md`; the prior source was not
modified. The generic-head and semantic-depth studies remain preserved and are
not selected.

`output/monumental/delivery-audit.json` records 141,854 desktop and 76,488
mobile triangles, no nonfinite attributes, invalid indices, exact zero-area
or duplicate triangles, and an estimated 17,432,579 decoded texture bytes for
each variant. The GLBs are 2,932,392 and 1,837,060 bytes respectively. Local
lint, typecheck, 68 tests and production build passed. The current shader uses
ACES with exposure 1.6. Actual WebGL was inspected at 1440 × 900 and 390 × 844;
the mobile view had no horizontal overflow. Axe reported zero violations and
one incomplete check at each size. The mobile GPU texture estimate was
18,830,678 bytes. An instrumented `drawElements` counter reached 952 after
motion and remained unchanged for 400 ms, supporting that rendering settled;
this is not a frame-rate measurement.

The fallback posters were captured from the neutral Three.js scene at those
sizes with UI temporarily hidden and then restored. The PNG captures are
`output/monumental/browser-poster-desktop.png` and
`output/monumental/browser-poster-mobile.png`; their encoded WebPs replace the
builder's Blender beauty posters in `public/assets`. Hosted preview and user
review remain pending. No physical-device performance or approval is claimed.


### Hosted sculptural review — 13 November 2026

The protected preview reached READY at
https://neighborly-bycnt85bg-simo-js.vercel.app/relief-review. The new route was
verified with the actual WebGL models at 1440 x 900 and 390 x 844. Browser logs
contained no warning/error entries on the hosted desktop check. Local 320 x 700
reduced-motion/no-WebGL checks retained loaded artwork and links with no
horizontal overflow. Simulated WebGL context loss restored the poster.

The final decoded asset audit reports 141,854 desktop triangles and 76,488 mobile
triangles; both have zero nonfinite attributes, invalid indices, zero-area or
duplicate triangles. Files are 2,932,392 and 1,837,060 bytes, respectively.
Posters are captured from the neutral browser renderer for matching color.

This completes the first-scene implementation/review checkpoint only. User
acceptance of the new visual direction and the subsequent app-wide design phase
remain outstanding. The existing home page and private workspace were not
replaced. No award, physical-device frame-rate or full authenticated-flow
acceptance is claimed.


## Artwork review correction — 13 November 2026

User rejected the replacement art as less beautiful and poorly proportioned.
Review identified changed facial character, mismatched hand/forearm proportions,
cuff/guide contact problems and inconsistent material detail. The replacement
models are retained as unapproved studies. The review route now selects the
original living-relief asset and its matching fallback images, as the main
homepage already did. Further visual work must preserve that reference rather
than substitute generated anatomy.

Restored reference preview reached READY at
https://neighborly-15lws9m33-simo-js.vercel.app/relief-review. Lint, typecheck,
44 source tests, 24 backend tests and production build passed. Source inspection
confirms the original poster/model references and no monumental model selection.
Fresh visual verification was blocked by the integrated browser connection,
which timed out during tab creation and browser-service initialization.


## Responsive original-art verification — 2026-11-13

Reviewed the original artwork in the integrated browser at 360×800, 390×844, 430×932, 768×1024, and 1440×900, plus phone/desktop sign-in and the invitation dialog. Corrected portrait-tablet overcropping with an authored-aspect artwork region, and moved the 421–700px hero title clear of the dark garment. No artwork geometry or textures changed. Tested blocked-GLB fallback at phone/tablet sizes and restored networking afterward. Lint, typecheck, 44 source tests (234 assertions), and production build pass. Preview https://neighborly-dprvvjipu-simo-js.vercel.app is READY; hosted phone/tablet artwork rendered successfully without horizontal overflow. Physical-device performance and award readiness are not established by this browser review.


## Artwork interaction pass — 2026-11-13

Preserved the approved original art. Added optional Belong/Choose/Prepare chapters using the same renderer and authored cameras, with keyboard-accessible shadcn tabs and a return to the original composition. Refined invitation lift into staged unfolding with exact settled dimensions and reduced-motion endpoints. Reviewed desktop and mobile chapter layouts in the integrated browser, fixed text/navigation contrast and 320px header wrapping. Final preview https://neighborly-igsfns362-simo-js.vercel.app is READY; hosted320px story loaded WebGL without horizontal overflow. Lint/typecheck,44 source tests(234 assertions),and production build pass. Earlier dev-only Next instant validation reported stale module-factory errors; production builds passed. This pass is not an assertion of award readiness or physical-device performance.


## Continuous spatial study — 2026-11-13

The user rejected the chapter/modal approach as insufficient. A separate /experience study now opens the original painting into a real Three.js gathering space. A raycast/captured-pointer invitation drag triggers a connected light response and an unfolding twelve-leaf canopy. The semantic Offer button follows the same story path; actual group entry uses existing /app links. Existing homepage and approved image assets remain intact. Reviewed desktop and390px portrait; desktop direct gesture and button path both reached together. Touch injection is unsupported by IAB, so physical touch/phone performance is unverified. Final preview https://neighborly-o5smrlrb0-simo-js.vercel.app/experience rendered ready without fallback. Lint, typecheck,44 source tests/234 assertions and production build pass. This is explicitly an unfinished visual study; do not describe it as award-ready or as completing the user's design goal.


## Living painted story implementation — 2026-11-13

Selected public entry now uses PaintedWorld at /, /painted-world, and /experience. Previous home/experience entry files are preserved under art/painted-world; original illustration and GLB remain unchanged. Built-in image generation produced three connected care scenes, separate portrait compositions, environment and foreground layers, corrected sharing pose, and painted bowl/door props. New typed single-renderer controller handles opening/meal/visit/welcome/complete, direct gestures, pose blending, cancellation, skip/restart, reduced motion and fallback. Original scene-aware synthesized score starts only from user action.

Final preview https://neighborly-98qhbqr4p-simo-js.vercel.app is READY. Hosted journey completed by keyboard, music enabled across scenes, final Start a group focus and three real account destinations verified. Local pointer bowl completion and incomplete-gesture reset verified. Reviewed360/390/430px phone viewports,768pxportrait tablet,1440pxdesktop; fixed crop/word spacing/header overlap. Scene-loadfailure fallback and reduced-motion endpoints verified. Lint,typecheck,productionbuild and46source tests/241assertions pass. Physical iPhone/Android touch andFPS, soundtrack listening quality, and measured cold initialtransfer remain unverified; this is not an award-readiness claim. Production domain not promoted.


## Hero regression recovery — 2026-11-13

User reported widespread glitches and damaged hero faces. Reproduced at IAB default789×891: the painted-world opening selected a narrow portrait source, then cover-scaled it until both faces were offscreen. Original GLB hash still matched the recorded original. Restored / to the stable ReliefStage homepage without chapter UI; newstory remains separate at /painted-world and /experience. Verified restored original faces at defaultsize and390px, and hostedroot https://neighborly-lr3wn7yt7-simo-js.vercel.app.

Fixed isolatedstory defects: opening width-based source identity and containedportrait framing; original GLBmaterial transparency/depth flags restored outsidefade; authoredlayerY retained duringpointermotion; awaitproptextures before scenecommit; revision-aware loading acrossresize; ignore/dispose renderer afterfallback; releasefailedbatchtextures includinglatearrivals; contain intermediate sceneaspects and anchorprops toactualartbounds. Verified isolateddefaultopening andcompletekitchen framing locally. Lint/typecheck/build and56source tests/273assertions pass. Storyvisualacceptance remains open; do not promote it or claim allvisualglitchesresolved solely fromthesechecks.


## Story stabilization — 2026-11-13

User rejected remaining glitches/style/mobile. Replaced accumulated absolute caption/breakpoint overrides with a bounded full-height art stage and normal-flow captions, persistent44px primary scene action, naturally scrollable short-screen content, and contained artwork. Original homepage unchanged. Added reduced mobile opening type, clear source-space bowl anchors, and brief sharing-pose blend to avoid overlapping limbs. Fixed early prop motion while loading and reverse/replay at transition start by freezing the shown pose and continuing monotonically. Resize cancels active gestures. Keyboard finale focus scrolls its destination into view; pointer completion does not unexpectedly move focus.

Preview https://neighborly-pwktexms3-simo-js.vercel.app/painted-world READY. Reviewed320×640,390×844,789×891,1440×900 layouts. Hosted390px direct action preservedscrollY0, full keyboard story reachedcomplete withvisibleStartagrouplink, nohorizontaloverflow, nohostedconsoleerrors observed. Lint/typecheck/build and58source tests/284assertions pass. This verifies specific repairs; it is not overall artistic approval or physical-phone performance evidence.


## Unified entry — 2026-11-13

User explicitly requested finishing the integrated current-site experience. Root now renders PaintedWorld; legacy storyroutes redirect to root. Originalhero asset retained, duplicateopeningheading visuallyremoved, stageusesauthoredaspectratio, controls movedoutsidepaintedsurface, finalStartgroup remainsvisible, and nativepan-y enabled withhorizontalmobilebowlgesture. The selected preview is https://neighborly-design-simo-js.vercel.app/, aliasing dpl_EZw2ZWiFNr9B8GgLBm6ogMySDA55 in simo-js/neighborly. Hostedmobile keyboardjourney completed atsame / URL withsoundenabled; finalStartgroup focus and realaccountentry verified. Alias /painted-world redirects to /. Lint/typecheck/build and58tests/284assertions passed. Physicaldeviceperformance and award-readiness remain unverified; emailconfiguration andproductiondomain were notchanged.


## Scroll/swipe cinematic direction — 2026-11-13

Latest user instruction explicitly replaces click-to-advance with scroll/swipe. Homepage now uses a native-scroll sticky600svh desktop/620svh phone timeline. Progress maps reversibly to opening/meal/visit/welcome/complete, prop poses, fades, camera and foreground depth. Removed allnext-scene/gesture buttons; onlysound and realappentry remain. Removed floating3Ddoorpanels fromscrollmode; painteddoorway/gatheringreveal uses the artwork. Independentcaption entranceanimationsremoved. Portraitframingandshortermobilecopy keepfacesclear.

Same canonicalpreview https://neighborly-design-simo-js.vercel.app now points to dpl_6Co9yvwidC1k995p6msTLayvWF6L. Verifiedhosted390px nativewheel progression tovisit and reverse toopening atscrollY0, nohorizontaloverflow, onlySoundoff button inDOM. Localforwardallacts, accountending, reverse andrapidjump checks passed on390px and1440px surfaces. Build/lint/typecheck and61source tests/307assertions pass. Physicaltouchdevice/FPS andaward-levelvisualacceptance remain unverified. Originalartworkunchanged.
