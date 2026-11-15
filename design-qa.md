# Design QA — Living Relief

Source visual truth: `/Users/josephsimo/.codex/generated_images/01a1ae7f-4ea6-7530-af22-53316729b1a3/exec-17dff79f-90b0-43cc-b3ce-4c39bbaff404.png`.
Implementation: local production build at `http://127.0.0.1:3001/`, captured in the in-app browser at 1280 × 720 and 390 × 844 CSS pixels. The saved initial browser capture and normalized comparisons are in `art/qa/`; their dimensions and differences are recorded below.

## Findings

- Resolved P1: the blank guide received an ochre mark and two rules on its curved Blender cover. A repeat side-by-side browser view showed the new details in the still, and the live GLB also rendered them. The source has a more pronounced angled fold; assess this in the remaining focused review.
- Resolved P1: the full-view and focused comparisons were inspected and saved; the unintended CTA borders were removed. See the saved comparison below for remaining visual differences.
- [P2] Physical-device interaction and performance remain unverified because no phone is available. Browser emulation does not establish touch behavior or frame rate on a phone.

## Comparison history

- Desktop 1280 × 720: headline and date overlapped, and small header/footer text lacked contrast over artwork. Reduced headline size, moved date, and added light backing. Subsequent browser review showed separated text and legible rail.
- Mobile 390 × 844: header obscured a portrait, the headline crossed dark artwork, and the commitment dialog appeared partially offscreen. Repositioned the artwork below the header, moved the headline onto the paper area, and removed the dialog's inherited translate. Subsequent browser review showed the full portrait, readable headline, and in-frame dialog.
- Mobile person controls initially lacked a visible caption. Added “Explore as”; subsequent browser review showed the caption above Grace and Noor, and Noor opened her example.

At 320 × 700 CSS pixels, the header and commitment sheet were visible within the viewport; the sheet scrolls to its lower controls. The headline wraps to three lines at this width.

## Fidelity surfaces still requiring direct comparison

Typography, spacing, palette, image quality, and copy were inspected in normalized full-view and focused browser comparisons; persistent evidence is saved in `art/qa/`. The mobile layout is a deliberate recomposition and has no matching mobile source target. Browser checks observed the accepted and declined branches, workspace navigation, and a still-image fallback; reduced-motion acceptance was checked in the browser: after explicit acceptance the guide appeared on the receiving hand and the preparation action was available. Pause and Resume were observed during an in-flight handoff in an isolated, slowed diagnostic build; see the acceptance record for its limits. Complete keyboard traversal needs further verification. A fresh desktop browser session reported no console errors during initial rendering and keyboard selection; broader session coverage remains open. Keyboard Tab reached Grace, Enter opened her sheet, and Escape returned focus to Grace.

A native-scroll chapter now reframes the relief. In desktop browser review it moved from portrait to hands and returned to the opening on reverse scroll. At 390 × 844 the chapter showed separate portrait and hand compositions; 6 December remained selected after returning, and the DOM contained one canvas. With reduced motion emulated, scrolling the desktop chapter retained the group view and one canvas; the captions remained readable. With `?noWebGL`, the desktop scroll chapter displayed the still image and captions with zero canvases; The forced fallback also followed the explicit acceptance flow: its accepted still placed the guide on the receiving hand, and the workspace listed Noor for 22 November. The declined fallback retained the guide on the offering side, stated that the date stayed open, and the workspace listed 22 November as open with the request declined.

## Checklist

1. Saved initial browser capture and normalized desktop comparisons; dimensions are recorded below.
2. Saved and inspected a full-view comparison and focused crop; the earlier CTA border finding was fixed.
3. Verify keyboard traversal, reduced-motion accepted pose, fallback transitions, and console errors.
4. Test touch and performance on a named physical phone when available.

final result: physical-phone verification remains open

Comparison in progress: viewed source and live still together at 1280 × 720 browser size in a temporary local comparison page, each panel 640 × 360 CSS pixels. Source uses cover cropping; implementation is a scaled 1280 × 720 iframe. The prop difference was addressed in the subsequent iteration and the comparison was later saved.

Revised GLB handoff review: after explicit acceptance, the marked guide traveled to the receiving palm in the browser. The matching still and live GLB were reviewed; the remaining angled-fold comparison is open.

Angled guide iteration: Blender export completed; at rest the browser shows the angled, fanned cover, and after acceptance it reaches the receiving palm. The original 1280 × 720 accepted pose overlapped the date rail. The rail was lowered and the footer moved below the artwork; a repeat browser view showed the guide clear of the rail. Export inspection found one scene, no default cube, and 49,996 triangles matching the manifest.

At 1440 × 900, the initial desktop layout was inspected; the header, headline, actions, hands, and date rail were visible. Keyboard Tab focused the skip link and Enter moved focus to the selected example. After explicit acceptance at this size, the angled guide rested visibly in the receiving hand above the date rail.

Keyboard review: in the commitment sheet, Tab traversed the six date controls, selected actor radio and change action; Enter opened review, Tab reached Confirm, Enter recorded the change, and Escape returned focus to Review this Sunday. The request/accept path and selected workspace controls were subsequently traversed as recorded below.

Keyboard continuation: Tab and Enter reached Review cover options, Simulate sending request, Open Noor’s example, and Accept this Sunday. The accepted state appeared and focus moved to See Noor’s preparation. This covers the primary request/acceptance path, not every workspace control.

Keyboard preparation/workspace review: Enter opened Noor’s preparation; Right Arrow selected Task and Meeting tabs; Escape restored the preparation trigger. Tab/Enter opened the team workspace, traversed its navigation, selected People, and Escape restored the workspace trigger. Other controls remain outside this bounded check.

Normalized comparison: source 1487×1058 scaled to 640×455 and implementation iframe 1280×910 scaled to 640×455 were displayed together in a single browser view. The hierarchy, paper ribbon, pine/violet palette, two portraits, handoff, Newsreader-style headline and date order align in broad composition. The implementation uses different generated hand and portrait details, adds functional header controls and a light date rail for contrast, and the guide now has an angled marked cover. These are visible deviations rather than pixel matches. A persistent capture and focused crop were saved subsequently.

Focused browser comparison: enlarged matched region shows the source guide has a deeper, more pronounced fold; the implementation has a tilted three-leaf form and matching ochre/rule marks. Its hand imagery is smoother and more photographic, an intentional consequence of different generated texture inputs. The source’s CTA text has no resting rectangular outlines; the implementation displayed pale boxes around both actions. Remove the resting borders while preserving focus indication, then repeat the comparison.

CTA detail iteration: removed the unintended resting outlines; the same focused comparison showed clean text actions. Tabbing to Change this commitment displayed a distinct blue focus outline in the live browser. Staged lint/typecheck, 25 tests / 169 assertions and build passed.

Playback controller verification: a Three.js mixer test with synthetic tracks uses the same controller as the renderer and checks pose freeze, resume, new outcome while paused, and reduced-motion endpoint. It is not direct visual verification of the authored clip. The refactored renderer loaded the current GLB in the browser without console errors. Staged lint/typecheck, 26 tests / 178 assertions, and production build passed.

Asset-load recovery: blocking the GLB request in a fresh browser session left the still visible and the commitment sheet usable. After clearing the block, activating Load interactive artwork replaced that control with Pause motion. This tests request failure and retry, not WebGL context loss.

Authored GLB animation check: decoded actual exported animation accessors into Three.js tracks and exercised the shared playback controller. The guide moved at 0.32 s, held through a 0.5 s pause, resumed without jumping, and reached the receiving position. Reduced motion, acceptance while paused, and restore reached the same endpoint. This is numerical playback evidence, not a browser visual timing capture.

WebGL context-loss review: invoked the browser’s WEBGL_lose_context extension on the loaded canvas; the still became visible and Load interactive artwork returned. Activating that control recreated the renderer and restored Pause motion. This was a local browser simulation.

## Saved browser comparison — 10 November 2026

The live browser capture is `art/qa/browser-desktop.jpg` (1265 × 899 pixels, JPEG). `art/qa/comparison.png` displays the 1487 × 1058 concept and browser capture side by side, each rescaled to 640 × 455; `art/qa/comparison-detail.png` crops the lower 255 pixels of that normalized comparison. This capture shows the initial state with motion paused. The broad composition and hierarchy align, while the browser uses different generated hands and portraits, a shallower guide fold, extra controls, and a grounded date rail. These are visible differences, not a pixel match. This saved evidence supersedes earlier notes that captures were missing; physical-phone testing remains unverified. The in-flight pause was subsequently observed in a slowed diagnostic build.

## Mobile portrait revision — 10 November 2026

The earlier mobile pigment showed the two profiles facing one another at close
range, unlike the desktop's shared outward gaze. A versioned, original
generated edit restores that shared direction while retaining mobile paper
space. The first offset prototype produced a right-edge gap in full-width stills
and was rejected. The final source contains a natural right margin and uses an
unshifted mesh; 390 × 844 browser review showed the profiles in frame and the
paper-backed date rail legible. The current accepted WebGL and forced-no-WebGL
views showed the guide in the receiving palm with no right-edge strip. The two
desktop still WebPs are byte-identical to the prior release. Desktop comparison
images earlier in this file show the prior export and remain useful for that
unchanged desktop composition.

## Experiential review — 12 November 2026

The approved painted relief remains the selected artwork. No source art or
cast experiment was replaced during this pass. The product story is a Sunday
commitment: belonging, a voluntary choice, and preparation after acceptance.

### Direction and references

The three considered directions were editorial refinement, an interactive
Sunday story, and a spatial artwork exploration. The Sunday story was chosen
because it connects the distinctive artwork to the working product. The more
spatial direction risked obscuring the actual task.

Official [Awwwards criteria](https://www.awwwards.com/about-evaluation/) weight
design 40%, usability 30%, creativity 20%, and content 10%. Calibration used
[Igloo Inc](https://www.awwwards.com/sites/igloo-inc),
[Don't Board Me](https://www.awwwards.com/sites/dont-board-me),
[Pangram Pangram](https://pangrampangram.com/), and
[Lusion](https://lusion.co/). Only the first two award entries were verified;
the last two are current-site references, not verified annual winners. The
annual/SOTY indexes did not load. Principles taken were a consistent material
world, subject-specific interactions, and useful product substance. No assets,
layouts or signature sequences were copied.

### Implementation and second critique

The first pass read too much like an explanatory appendix. The revision enlarges
the persistent art stage, reduces empty chapter pacing, adds direct chapter
navigation, and ends with the actual selected date and responsibility outcome.
The same reducer owns all choices. Scrolling and camera movement never assign
someone a commitment. Acceptance reveals preparation; decline keeps the date
open. The existing working sample and editable team draft remain accessible.

Camera transitions are interruptible and finite (850 ms); reduced motion snaps
to the group framing. A canvas resize/portal visibility defect found in rendered
review was fixed and rechecked through desktop-to-panel resizing and navigation.

The optional original ambient synthesis uses native Web Audio, starts only on
an explicit click, and exposes a persistent mute control while enabled. It
suspends when the document is hidden or a working product sheet is open. This
is a restrained harmonic bed, not a commissioned recording or an independently
auditioned professional sound mix. Audio API behavior follows the MDN
[resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume),
[suspend](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/suspend),
and [automation](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime)
documentation. Existing Three.js and shadcn components are reused; no runtime
dependency was added.

### Current evidence

Production build, lint, typecheck, and 32 tests / 195 assertions pass. The current
local production preview is http://127.0.0.1:3143/.
Browser review at 375×812, 768×1024, 1440×900 and 1920×1080 found visible hero
and story artwork, correct portal placement, and no horizontal overflow.
Screenshots are in `output/playwright/elevation-*`.
Parent review independently completed release → request → Noor accepts,
observed focus return and the guide in the receiving hand, and checked the
optional sound toggle and chapter navigation. Selected views:
`output/playwright/award-story-final.png`, `award-choice-desktop.png`,
`award-preparation-desktop.png`, and `award-choice-mobile-settled.png`.

The final rebuilt version passes axe-core 4.14.0 WCAG 2 A/AA, 2.1 and 2.2 AA
checks on the 375px hero, story and commitment dialog (zero detected violations).
This is bounded automated evidence, not a complete accessibility certification.
The story action opens the dialog and Escape restores its focus; chapter 02
lands below the sticky artwork without occluding its heading. Audio instrumentation
observed zero contexts before opt-in, then running → suspended in a dialog →
running on return → closed after mute. No claim about audible mix quality follows
from that instrumentation.

The final bounded browser pass also verified the full release → request → accept
story under reduced motion and forced no-WebGL, workspace and draft entry points,
reset, the decline outcome without preparation, and the unassigned 15 November
branch. Reduced motion used group framing; forced no-WebGL created no canvas.
Test-owned browsers were closed. VoiceOver, current Core Web Vitals, physical
mobile frame time, and auditory quality were not measured in this pass.

## Direct live Site of the Year comparison — 12 November 2026

This supersedes the earlier limitation about not reaching the annual collection.
The integrated browser loaded the [Site of the Year collection](https://www.awwwards.com/websites/sites_of_the_year/),
opened the entries and clicked their Visit Site links. These are current live
destinations; this does not establish that every current detail matches its
historical winning version.

| Reference | Directly explored | Comparison with Neighborly |
| --- | --- | --- |
| [Lando Norris](https://landonorris.com/) | Portrait/helmet opening, scroll into message and photographic archive | Subject-specific transformation, stronger shifts in composition and denser authored material. Neighborly currently zooms one artwork beside text. |
| [Igloo Inc](https://www.igloo.inc/) | Live snowy scene, assembling blocks, scroll-driven scale and refractive transition | An enveloping material world, with lighting/environment sharing the interaction. Neighborly's stage remains a framed illustration. |
| [Messenger](https://messenger.abeto.co/) | Begin, opening dialogue, advance narrative, keyboard-controlled movement through the town, delivery-list control | The visitor acts as a protagonist in a continuous world. Neighborly's meaningful actions mostly occur in a separate utility dialog. |
| [Opal Tadpole entry](https://www.awwwards.com/sites/opal-tadpole) | Visit Site redirects to https://op.al/ | The historical product experience was unavailable; excluded from craft comparison. |

Evidence: `output/playwright/benchmark-lando-live.png`,
`benchmark-igloo-live.png`, `benchmark-messenger-entry.png`,
`benchmark-messenger-dialogue.png`, `benchmark-messenger-play.png`,
`benchmark-messenger-deliveries.png`, and `benchmark-neighborly-live.png`.
Lando/Igloo/Neighborly captures use the browser panel viewport; Messenger was
also entered and played at 1440×900. No benchmark audio-quality, accessibility,
performance or complete-game claim is made.

Revised assessment: Neighborly is an attractive illustrated product demo, but
not yet at these references' experiential depth. The missing work is not simply
more transitions or audio. The signature Sunday decision should be staged
inside the artwork: Grace releases one date, an invitation remains pending,
Noor actively chooses, and the guide and preparation resolve visibly. Detailed
review can remain in the modal, but it should not carry the entire dramatic
action. Preserve the approved painted relief, paper, warmth and belonging
theme; do not copy a racing interface, frozen landscape or game world.

## Complete public-collection pass — 13 November 2026

The expanded [study report](output/awwwards-study/REPORT.md) covers every one
of the 53 entries exposed across the official collection's two linked pages.
The header advertises 64, but an independent HTML and browser inventory found
only 53 public entries; the difference of 11 remains unexplained. No missing
entry names were invented. Every listed destination was visited or attempted
in the integrated browser. The ledger distinguishes usable current sites,
redesigns, partial media loads, phone-dependent behavior, and access failures.
Its 93 linked screenshots exist; file coverage was independently checked.

This broader pass adds especially useful evidence from Nomadic Tribe's
gesture-driven illustration, Orano's contextual equipment explanation,
Persepolis's reconstruction/present-day comparison and accessibility options,
Inside The Head's illustrated reading interface, and Beagle's document-led
product walkthrough. These support preserving Neighborly's approved artwork
while making the actual commitment decision the central interaction. They do
not support copying a game world, treating all animation as meaningful, or
claiming that every historical winner remains accessible.

This is a stronger experiential candidate, not evidence of Site of the Year
readiness or a likely award. Physical mobile GPU/frame-time testing, independent
auditory judgement, and public hosted acceptance are not established by local
browser checks.

## Current implementation review — 13 November 2026

The production preview at `localhost:3144` was examined at desktop size with
the original painted artwork. The latest local lint, typecheck, 39 source tests
(211 assertions), 24 backend tests, and production build passed after clearing
a corrupt generated `.next` cache. These checks do not establish a hosted
production experience, real email delivery, or physical-device performance.

Live workspace development uses the separate `neighborly-live` development
deployment `valiant-canary-279`; the original backend was not modified. Vercel
owner access was verified, while an access challenge and CLI login refresh
remained under investigation. Sender-domain setup was deferred and no live
email was sent.


### Paper entry refinement — 13 November 2026

Original painted relief retained. A three-panel paper folds out of the guide
using the existing WebGL renderer, with warm fiber detail and contact shadow.
The final reading surface is semantic HTML; fallback supplies its own paper
background. Public copy now addresses churches and communities, with
organization-defined volunteering rather than a default Sunday scenario.

Browser revisions corrected zero-delta animation startup, offscreen opening,
duplicate guide geometry, mobile inherited grid collapse, header legibility,
lettering over dark pigment and the dialog accessible name. Desktop/mobile
opened paper audits reported no axe violations in settled state. Preview:
https://neighborly-m3tj8c34t-simo-js.vercel.app. Physical-device timing and
authenticated workspace visual acceptance remain unverified.

## Painted journey refinement — 14 November 2026

Preview: https://neighborly-lz82ind45-simo-js.vercel.app (Vercel authentication protected).
The deployment is READY; authenticated CLI requests returned HTTP 200 for `/` and `/app?intent=start`. Browser navigation reached Vercel authentication, so hosted visual acceptance is not claimed. Preview build/runtime use the existing `valiant-canary-279` development backend; no production release or backend migration was performed.

Implemented: direct opening-to-courtyard link and keyboard skip; offscreen opening renderer disposal; concrete planning links after care gestures; revised practical chapter; scoped paper/forest workspace and auth styling; intent-specific account entry copy; mobile sound/skip collision fix; replay focus target; optional chair respects no-WebGL. Original artwork retained. No new runtime dependency.

Final local lint, typecheck, 129 source tests (1,254 assertions), 24 backend tests, and production build passed. Browser review covered 320, 375, 768, 1440 and 1920px widths without observed horizontal overflow. Actual screenshots cover the hero, courtyard, practical chapter and account entry. Axe WCAG 2/2.1/2.2 A/AA checks returned no violations on the reviewed mobile courtyard, desktop sign-in and mobile account-entry states. Keyboard skip landed on the practical chapter. Reduced-motion/no-WebGL courtyard gesture worked with zero canvases. These bounded checks do not establish whole-app accessibility.

Second visual review found the mobile sound dock covering Skip story; repositioned the skip and quiet-view controls and recaptured. Artwork continuity improved through navigation/copy; a fully authored hand-to-courtyard transformation remains future work. Existing benchmark study was reused for principles, not re-run or copied. Implementation followed installed Next.js 16.4.5 CSS guidance. Vercel deployment documentation: https://vercel.com/docs/deployments.

Screenshots: `output/playwright/refinement-mobile.png`, `refinement-mobile-final.png`, `refinement-process-desktop.png`, `refinement-signin-desktop.png`, `refinement-onboarding-mobile-final.png`.

Limitations: authenticated workspace was not visually exercised (no existing browser session or safe fixture); account creation remains unavailable because email delivery is unconfigured. No physical-phone, VoiceOver, full failure-state matrix, or field Core Web Vitals pass. A warm-cache local FCP measurement is not representative performance evidence. TypeSafe docs were consulted; no Jev credential was configured in this project, and no API integration was added. This is a refinement pass toward the full plan, not evidence of award readiness.

### Continued refinement — 14 November 2026

Further changes: courtyard motion module now waits until near the viewport; existing stage-based table/hall loading retained. Courtyard-only variants omit hidden doorway assets. Both variants expose base-image failure with retry and direct product continuation. Browser blocked the base image, observed recovery controls, unblocked it and successfully retried to the interactive basket. Create/join onboarding now uses the existing shadcn ToggleGroup, intent-specific headings, pending announcements and recoverable error copy; real workspace empty states distinguish date scope and accepted commitments.

A scroll crossfade experiment was visually rejected because it mixed two text compositions. Final treatment retains crisp artwork with a short paper overlap and reduced-motion alternative. Mobile arrival screenshot: `output/playwright/paper-arrival-mobile.png`; recovery: `output/playwright/recovery-courtyard.png`. Mobile arrival had no horizontal overflow or axe violations. Final local lint, typecheck, 129 source tests, 24 backend tests and production build passed. Authenticated rendering and field/physical-device performance remain unverified.

Updated preview: https://neighborly-ngpnbfv8t-simo-js.vercel.app (READY; protected). Keyboard-triggered basket action was checked through completion: the result became “Something to share” and focus moved to “Reset the garden.” This is a long authored sequence; the result is not immediate. The goal remains active, with authenticated visual review, meaningful performance profiling and broader acceptance outstanding.

### Actual component and performance review — 14 November 2026

Rendered the actual LiveWorkspace and LiveWelcome components in a temporary localhost-only bundle using dashboard output from existing in-memory Convex fixtures. No production test route, auth bypass, live account, or production data was created. Desktop request/details and mobile accepted state were inspected; create-group failure retained entered values; 320px join view had no horizontal overflow. Automated axe checks reported no violations in reviewed details/create/join views. These are component evidence, not live authenticated integration proof. Screenshots: `actual-workspace-fixture.png`, `actual-workspace-details.png`, `actual-workspace-mobile-accepted.png`, `actual-create-mobile.png` in output/playwright.

Cold local production browser profile: 375×812, 4× CPU throttle, 150ms network latency, 200,000 bytes/s download. One run measured LCP 1,332ms, CLS 0.00149, long tasks 72/92/94ms and ~3.41MB transfer. This is one lab run, not field percentiles. The optional hero 3D enhancement now starts after first paint/idle opportunity; browser confirmed zero canvas initially, one after enhancement. Further profiling required.

A first-Enter bug was reproduced: residual smooth scrolling cancelled explicit care before reveal. Explicit care now temporarily owns the scene, with genuine navigation taking over and normal completion releasing ownership. Repeated immediate Open door → focus basket → Enter succeeded in browser, including reduced-motion/no-WebGL. Two controller tests cover visibility-based lost-choice cases. Source tests now 131, backend tests 24.

Further browser acceptance: PaperSurface closes back to the originating Details button after its 550ms exit animation; successful request acceptance focuses the status notice. Both were exercised in the actual-component fixture. Immediate desktop Open door → basket Enter now fully opens the doorway before care starts, and reaches the visible result. Wheel navigation after completion resumes the next chapter. No live authenticated account flow is claimed.

The first-keyboard-action fix was further verified at 1440px and 375px: canonical doorway completion avoids leaving opaque doors over a completed gesture. Active chapter heading now exposes level 2 when the introductory heading is hidden; the repeated full axe scan returned zero violations. Paper dialog return focus was verified after its exit animation, and acceptance focused the status notice. These fixes remain separate from live-backend acceptance claims.

### Shared entry stage — 14 November 2026

Replaced stacked hero/doorway presentation with a shared sticky viewport. The portrait exits to paper before the doorway enters; inactive scene controls are inert and hidden from accessibility traversal. Five desktop progress samples (0, .25, .5, .75, 1) were captured in `output/playwright/shared-stage-*.png`; mid-frame contains only paper rather than overlapping headlines. Native scroll remains authoritative; reduced motion uses a cut. Step inside lands after the intro. The immediate keyboard basket flow works with the new offset on desktop/mobile; current courtyard axe scan has zero violations. This supersedes the earlier partial paper-overlap treatment.

Also excluded cancelled commitments from active upcoming views while preserving all-commitment history, corrected acceptance copy when preparation is empty, and named email validation/reset continuation buttons. Latest source tests 132, backend tests 24; lint/typecheck/build pass. Live authentication and physical-device verification remain outstanding.

### Progressive entry and form corrections — 14 November 2026

Shared-stage CSS now activates only after its controller mounts; a no-JavaScript browser displayed the original portrait and static courtyard with practical content rather than overlapped scenes. Step inside transfers keyboard focus to the courtyard. Fade progress uses the actual stable stage height and responds to motion-preference changes. Reviewed reduced-motion courtyard returned zero axe violations and no overflow.

Time-off review now preserves the controlled draft when returning Back. Location fields match server required validation; preparation limit matches server 5,000-character limit. Lint/typecheck, 132 source tests,24 backend tests and production build pass. No live auth/email or physical-device verification claim is added.

### Readiness correction — 14 November 2026

Local account-email readiness is now independent of the group-notification delivery switch. Focused backend test confirms configured account mail can report ready while notifications remain unqueued with delivery disabled. No remote backend deployment, environment change, or email send occurred for this change. A sender domain and test recipient have been requested before real onboarding verification.

Shared-entry keyboard fixes: invisible portrait controls become inert during paper transition, focus transfers to courtyard after entry, and reverse navigation restores the visible opening link. Actual browser checks confirmed forward and reverse focus. Latest local checks:132 source tests,25 backend tests,lint,typecheck/build pass. Remote frontend preview does not imply local backend changes are deployed.

### Request context and publication limit — 14 November 2026

Fixed My commitments pending requests losing context: requestsPage returns an authorized per-request commitment summary, distinct from assigned commitments. Missing authorized context disables acceptance. Test covers paginated pending requests, private preparation hiding, coordinator visibility and outsider rejection. Actual component fixture showed title/time/location and Details on My commitments, then acceptance moved the item into Accepted commitments and focused confirmation. Foreground failure/retry also verified: blocked image left care available, retry restored a complete 1774px image.

Final checks passed: lint/typecheck,132 source tests,26 backend tests,production build. Deployed backend to existing development `neighborly-live` / `valiant-canary-279` with convex dev --once; no records/env/email changed. Live emailConfiguration returned false.

Frontend publication was rejected by Vercel: api-deployments-free-per-day, more than100, retry in24 hours. No repeated retry attempted. Last published preview remains https://neighborly-e2bw6tru8-simo-js.vercel.app; current source includes request-context/foreground fixes beyond that build. Sender domain/test recipient question still pending; live onboarding and physical device checks remain unverified. Goal not complete.

### Final cold profile and compatibility — 14 November 2026

Current production build, cold context at375×812,4×CPU,150ms latency,200,000bytes/s: LCP1328ms,CLS0.001413; long tasks62/87/91ms. The87ms task coincided with the Three.js chunk completing,91ms with GLB decode/upload after download. These timings identify likely owners, not a full trace attribution. The largest transfer remains the1.36MB compressed GLB. This does not establish physical-device smoothness or field performance compliance.

Live development backend rejected unauthenticated workspace access. Additive request-summary field remains compatible with published frontend (old code ignores it); new client tolerates old missing field but needs updated backend for full details. Current backend is deployed; frontend publication remains quota-blocked. README updated to describe current public session-only courtyard and separate auth/outbox readiness.

### Responsive opening payloads — 14 November 2026

Preserved original living-relief.glb and generated dedicated opening variants with glTF Transform NodeIO/prune. Removed only inactive responsive backgrounds and unused animation clips; retained mesh arrays compare identically after decoding, retained image bytes have identical SHA-256. Sizes: original2,022,328B; desktop1,495,200B; mobile1,324,656B; narrow1,142,020B (26%,35%,44% smaller). Runtime swaps variant on breakpoint changes and disposes replaced geometry/materials/mixer. Browser resized narrow→desktop with one canvas and correct assets. Saved optimized-opening-desktop/mobile screenshots inspected; original artwork preserved. Model-load failure retained usable painted rendering and heading. No quantization, simplification or image recompression performed.

Build/typecheck/lint pass. Frontend publication remains blocked by daily quota; these assets are local only. Official tooling references: https://gltf-transform.dev/modules/core/classes/NodeIO and https://gltf-transform.dev/modules/functions/functions/prune . Reproduction script: scripts/prepare-opening-assets.mts; tool packages installed outside repo under /tmp, not runtime dependencies.

Responsive-model failure check: loaded desktop, blocked narrow variant, resized to375px. Fixed stale desktop geometry suppressing narrow poster by disposing old model/mixer and clearing references on replacement failure. Browser showed intact narrow painting; removing block and resizing390px retried same variant with one canvas. Screenshot `optimized-breakpoint-fallback.png`. Full lint,typecheck,132 source tests,26 backend tests and production build passed afterward. Publication still quota-blocked; no new hosted claim.

## Local design closeout — 14 November 2026

User clarified deployment is not required to finish this goal. Completion is assessed as a locally implemented and reviewed award-caliber candidate, not an official award or a production-delivery certification. Final current screenshot `output/playwright/local-final-desktop.png` confirms paper-backed primary actions are legible; earlier optimized-opening-desktop capture predates that correction. Repeated current keyboard entry/care flow succeeded, with no horizontal overflow.

Final checks: lint, typecheck,132 source tests and26 backend tests,production build passed. Original artwork preserved; shared entry, responsive layouts, keyboard interaction, reduced motion, no-JavaScript content, artwork failure/retry, actual workspace component states and backend consent/access rules have bounded evidence above. No remaining known local implementation defect from final design and workflow audits.

Unverified release conditions remain explicit: real sender/email onboarding, hosted current revision, physical-phone touch/GPU behavior and real screen-reader pass. They do not imply award endorsement, official judging outcome, or production readiness. Local candidate work is complete under the clarified deployment-independent scope.

## Reopened quality goal — 14 November 2026

User rejected equating completed local implementation with Awwwards-level quality. Prior local closeout is superseded; quality goal remains active. Creative review identifies three unresolved dimensions: guide does not cause narrative transition; courtyard gestures lack social consequence; real product behavior remains outside artwork.

This pass replaces the generic three-step process with a disclosed interactive paper invitation: offer → pending → accept/decline → preparation or open responsibility. No messages or production commitments are created. Courtyard completed-act links now lead to this interaction. Desktop/mobile pending, accepted, declined/reset paths reviewed; fixed contrast and heading/accessibility findings, latest declined full axe scan zero violations. Screenshots invitation-integrated.png and invitation-accepted-mobile.png. This is progress, not a claim the quality target is achieved. The invitation still requires stronger authored integration with the artwork and subsequent creative review.

### Invitation inside the artwork — 14 November 2026

Completed care now exposes a folded-guide-marked invitation directly in the courtyard. Existing semantic PaperSurface opens over the visible scene, with compact CareInvitation. Pending/accepted/declined state survives closing and reopening; scene action label reflects the outcome. This replaces a generic redirect with an in-scene product decision. Mobile accepted modal axe scan found no violations and Escape restored the scene invitation button. No actual message or commitment is created.

Desktop screenshot scene-invitation-accepted.png records first visual pass; compact spacing subsequently reduced to avoid tall empty framing. The quality goal remains active: visible object-origin motion and deeper social response still require creative review. This pass is not completion proof.

### Guide-origin invitation pass — 14 November 2026

Added invitation-specific PaperSurface motion from the marked guide control, reverse closing, right-aligned desktop framing and reduced-motion static alternative. Workspace sheets retain their prior style. Closing a chosen invitation moves attention to the table; accepted outcome shows a paper marker “Bread · Your neighbor” and prepared settings, while pending/declined remain open. Existing images represent welcome/preparation, not a fabricated person arriving. Outcome persists on reopening. Desktop invitation full axe scan zero violations; origin screenshot invitation-origin-desktop.png; table return invitation-table-result.png. Further creative review required; goal remains active.

### One remembered invitation — 14 November 2026

Removed duplicate interactive appendix. Invitation outcome now has one parent owner shared by courtyard and ending, with controlled CareInvitation and fallback for isolated study callers. Replay clears outcome. The final chapter reflects accepted/declined/pending rather than restarting a fresh invitation; accepted table copy states who brings bread. Browser accepted flow carried the same outcome into final heading and copy; full axe scan returned zero violations. Screenshot remembered-invitation-ending.png. This resolves repetition and state contradiction but does not by itself prove Awwwards-level craft. Goal remains active.

### The outcome lands at the table — 14 November 2026

Added a small ochre-marked bread note anchored to the same scene coordinate system as the table. It reopens the retained invitation and reads Your neighbor / Awaiting a reply / Still open. Acceptance no longer forces table settings independent of care state; arrangement remains a separate gesture. Shortened the separate outcome chapter so it does not compete with the scene. Actual browser accepted→reopen→reset→decline showed the note and copy change coherently; mobile invitation scan zero axe violations. Screenshot table-note-result.png. This is a creative integration improvement; no completion claim.

### Invitation hierarchy and independent access — 14 November 2026

Removed duplicate caption invitation control once table note exists; note is sole table reopen control, slightly smaller with tabletop perspective/contact shadow. Added ending Try a shared plan using same parent outcome so skipping or failed artwork does not block the example. Browser keyboard skip→example→decline→close preserved ending outcome and focus returned to trigger; modal axe scan zero violations. This avoids imposing optional art gestures before understanding the product. Goal remains active pending holistic creative calibration.

### Opening guide enters the same story — 14 November 2026

Opening now exposes Open the invitation beside the guide, using the same parent-owned invitation as courtyard and ending access. Closing returns focus to the initiating control. Actual mobile modal axe scan returned zero violations; direct opening acceptance persisted into final outcome. Screenshot opening-invitation-mobile.png. All standard checks passed. This adds a meaningful first action to the original handoff image, but placement and whole-sequence craft still need creative review; goal stays active.

### Opening hierarchy revision — 14 November 2026

Reduced three competing opening actions to one primary Open the invitation and a quieter Start a group link; native scroll remains the courtyard path. Removed the floating third button below the hands. Primary remains an anchor so no-JavaScript navigation still reaches courtyard; JS opens the same retained invitation. Mobile screenshot opening-single-action.png inspected. This addresses clutter; overall Awwwards-level quality remains unproven and goal active.

### Authored handoff follows consent — 14 November 2026

The same invitation outcome now reaches the opening GLB through existing createReliefPlayback. Accepted moves the marked guide into the receiving hand; pending/declined keep offering pose. Variants retain authored clips rather than rest-only export. Browser accepted pose inspected (opening-accepted-handoff.png), ordinary animated completion captured (opening-animated-accepted.png), no-WebGL acceptance uses matching accepted still. Per-frame guide reset no longer overrides non-rest clips. Outcome restores on responsive model load, reduced motion snaps endpoint. This addresses the unresolved opening promise, not merely UI functionality. Goal remains active for whole-experience critique.

### Visible handoff timing — 14 November 2026

Separated the immediate invitation state from opening-art reveal: accepted/declined opening outcome now applies after PaperSurface exit completion, preventing its1.53s handoff from finishing behind an opaque sheet. Opening caption/primary action reflect accepted or declined outcome instead of repeating the untouched entry. Browser confirmed old caption while sheet stayed open, then accepted caption and received guide after close; accepted opening axe scan zero violations. Screenshot accepted-story-opening.png. Goal remains active; this is a narrative timing improvement, not overall quality proof.

### Accepted path resolves at the table — 14 November 2026

See what comes together now navigates directly to the table using the existing chapter controller, preserving outcome without implying furniture completion. Table heading reflects accepted/declined state. Removed the redundant green outcome recap; final section now invites Bring this to your people and real create/join access. Browser accepted opening→table path preserved accepted state and passed axe scan. Standard checks passed. Goal remains active for independent quality review.

### Handoff-to-table continuity — 14 November 2026

See what comes together now carries the guide motif through a brief paper transition before the shared table is revealed; reduced motion navigates directly. Animation/timer cleanup prevents delayed navigation after unmount. Browser normal-motion accepted→transition→table retained correct accepted copy and destination. Also fixed rest baseline capture on GLB reload: authored rest is cached before accepted endpoint restoration, preventing later reset from retaining received guide pose. Goal remains active; a transition alone does not prove exceptional craft.

### Transition restraint and interruption — 14 November 2026

Midpoint review rejected centered floating guide over full-screen paper as loading-screen-like rather than physical continuity. Removed that extra icon and shortened transition to650ms plain paper cut. Explicit wheel/touch/navigation-key or motion-preference changes cancel animation and pending navigation. Browser Escape within delay kept scroll at0 and zero running transition animations. This is a deliberate reduction of an unconvincing effect, not a claim full quality achieved. Standard checks pass.

### Invitation editorial pass — 14 November 2026

Replaced meaningless01/01 with actual state, clarified role switch to neighbor, shortened repeated explanatory copy and removed duplicate declined statement. Accepted view prioritizes responsibility and preparation. Restored visible focus outline on outcome heading. Browser accepted dialog scan zero axe violations. This refines the central interaction's reading hierarchy; quality goal remains active.

### Table artifact material pass — 14 November 2026

Current production-build viewport sweep at375/768/1440 completed accepted path with one retained note, no horizontal overflow and zero axe violations. Review still found the note visually floating. Split larger transparent click target from smaller paper face; adjusted paper perspective, contact shadow and tabletop anchor. Reopen remained usable on mobile and dialog axe scan passed. Screenshot table-note-surface.png records material pass. This is improvement evidence, not overall award-level completion evidence.

### Human response variation — 14 November 2026

Generated original matched courtyard variation table-welcome-v2.webp from existing table-offering-v1 source: woman turns toward open place and offers bread. Accepted invitation reveals upper-body region; pending/declined retain base. First rectangular crop had a visible hard seam and was rejected; feathered elliptical compositing inspected at desktop/mobile (human-response-blended.png / human-response-mobile.png). New image is local and preserves original asset. Mobile framing crops offered loaf at far left; further framing/creative review remains. This is work in progress, not goal completion. Added concrete private-team/planning product description near final CTA.

### Mobile human-response framing — 14 November 2026

Accepted portrait table framing shifts scene and foreground together by a bounded offset, preserving edge coverage. 375px browser image now includes woman's face, full arm and offered loaf; note remains aligned. Controller test covers accepted/reset/landscape/garden offset behavior;133 source tests now pass,26 backend tests. Screenshot human-response-mobile-framed.png inspected. Original/default/landscape framing remains unchanged. This resolves prior cropped-loaf finding; whole experience quality assessment remains active.

### Welcome-image recovery — 14 November 2026

Added loading/error tracking for accepted welcome variation, using the existing per-asset retry mechanism. Browser blocked table-welcome-v2 request, observed Retry artwork, restored request and verified natural image dimensions after retry. Invitation state remained intact.133 source tests,26 backend tests,lint/typecheck/build pass. Goal remains active; correctness supports but does not establish creative-quality target.

### Settled human response — 14 November 2026

Independent still review found new desktop/mobile welcome composition coherent and no obvious identity seam. Removed600ms pose crossfade to prevent double face/arms; outcome switches beneath decision sheet and is revealed settled. Mobile no-WebGL/reduced-motion accepted flow showed response opacity1,zero canvases,zero axe violations. The current story now includes choice, visible handoff and reciprocal welcome; goal still active pending whole-quality judgment rather than inferred from checks.

### Accepted arrival emphasis — 14 November 2026

Whole-story mobile contact sheet exposed competition between human response and optional scene controls. Accepted table arrival now emphasizes woman, loaf and note; optional chair/chapter/view controls are revealed via Explore the courtyard. Navigation remains available elsewhere and normal exploration restores on request. Browser reveal returned chair control and axe scan zero violations. Contact sheet review-contact-sheet.png and quiet-accepted-table.png record this pass. Goal active; no award-quality completion asserted.

### Full normal-motion review — 14 November 2026

Replayed current opening→pending→accepted→visible handoff→table at desktop and390px normal motion; scene retained answer and note. Reopening receipt now returns to quiet response rather than inadvertently revealing optional exploration; explicit Explore restores controls. Fixed replay flag reset. Mobile accepted scene axe scan zero violations. Saved final-motion-handoff.png/final-motion-table.png. Independent still review found no additional substantial visual change justified, but timing judgment is bounded by browser review; goal not marked complete here.

### Whole-experience art direction review — 14 November 2026

Independent review now finds central story coherent but courtyard materially denser/more ornate than sculptural opening. Started original quieter courtyard variation study preserving geometry and figures, to assess whether a consistent visual grammar improves the whole. No existing art replaced pending direct review. Goal remains active.

### Quieter courtyard study — 14 November 2026

Generated original quieter material study at art/studies/courtyard-quiet-v1.png, based on current courtyard and opening relief. Broader sculptural foliage, simplified sky/plaster and muted highlights address cross-scene art-direction mismatch. Retained only as a study; not swapped into production because registration with foreground/prop/response layers must be verified and rebuilt coherently. Existing working scene untouched. Goal remains active; visual language consistency is the current substantive gap.

### Quiet-art browser trial — 14 November 2026

Intercepted only base courtyard request with quiet study for local rendered comparison. Trial quiet-art-trial.png confirms clearer focal scene but mismatch with ornate original foreground; no production base change yet. Proceeding with a coordinated quiet foreground study rather than shipping a single mismatched asset. Existing original retained.

### Quiet courtyard family integration — 14 November 2026

Integrated versioned quiet base and matching transparent foreground after intercepted comparison. Original assets retained. Larger matte foliage and quieter walls/sky reduce visual noise and better match opening relief. Mobile accepted scene reviewed in quiet-family-mobile.png; full arm/loaf and table note remain visible. Existing prop/response crops retained; their boundary matching and all three exploration states still require focused visual review before calling the family complete. Goal remains active.

### Quiet-family interaction review — 14 November 2026

Rendered garden/table/hall completed states on quiet background. Fixed translucent foreground ghosting by restoring opaque pigment, and removed legacy table-response crop from main variant because its background rectangle mismatched the quiet mural; quiet base provides resting woman and accepted welcome remains separate. Table active screenshot quiet-table-layer-clean.png; axe scan zero violations. Full checks pass. Other legacy prop assets retain original styling and need final whole-family comparison; no completion claim.

### Quiet-family whole-sequence review — 14 November 2026

Captured opening/invitation/accepted table/ending contact sheet quiet-family-contact.png. Independent art review found no further substantial still-image mismatch requiring more artwork; motion and layer transition review remains necessary. Fixed inert no-JavaScript Try shared plan button by hiding in existing noscript styles; static story and Join remain available, verified in JS-disabled browser. Goal remains active; no equivalence between passing checks and quality target asserted.

### Layer dependency cleanup — 14 November 2026

Removed unused main-variant table-response image mount and readiness dependency. Main table now depends only on chair/settings; courtyard-only study retains response. Browser blocked old response path and table action still reached Reset the table. Full checks pass. Current remaining quality question is assembled timing/composition, not an identified new still-image redesign. Goal active.

### Current production sequence assessment — 14 November 2026

Ran current production build normal-motion invitation/accept/handoff/table on390px. Unthrottled cold browser observation: LCP124ms,CLS.00413,one63ms long task (not field data). At final settled table caption opacity1; earlier capture caught travel fade. Independent review found pale caption crossing pale leaf; added localized dark backing gradient behind caption only. Current mobile scene axe scan zero violations. Quality direction assessed as coherent and distinctive; uninterrupted motion review remains the basis for final judgment, not endpoint tests alone. Goal stays active.

### Continuous mobile recording — 14 November 2026

Recorded uninterrupted mobile normal-motion opening→invitation→accept→close→handoff→table. Video: output/playwright/quality-video/page@606087375d3c6e1fcef4d0558fb7a0fe.webm; half-second contact sheet motion-contact.png. Recording confirms authored guide transfer occurs after sheet exit and table response follows; intermediate paper transition still shows brief overlaid ghost lettering from fading underlying hero and is retained as a review finding, not a pass claim. Browser capture dependency installed to isolated tooling cache; no app dependency added. Goal active.

### Temporal typography correction — 14 November 2026

Continuous frame review found invitation typography readable while sheet still expanded translucently over hero heading. Delayed reading layer reveal until latter portion of500ms paper arrival; reduced motion shows it immediately. Extended opaque portion of table transition so underlying outgoing lettering is covered during navigation. Standard checks pass. Goal remains active pending re-recorded temporal review.

### Direct covered table arrival — 14 November 2026

Second continuous recording page@242f5d3b63ea6fb60b3c8a05c5c804cd.webm and current-motion-contact.png showed table navigation passing through garden after cover began clearing. Changed only explicit See what comes together navigation to instant chapter arrival beneath cover; normal chapter links retain smooth motion. Browser sampled destination1 during and after cover. Full checks passed. Goal remains active; this resolves a specific temporal discontinuity rather than proving overall quality.

### Current production motion checkpoint — 14 November 2026

Production3159 transition measured:200ms cover.75/current opening;320ms cover1/table selected;500ms cover.5/table;740ms cover0/table. This removes visible garden detour. Continuous desktop capture output/playwright/neighborly-current-desktop.mp4 generated from current production build, no editing beyond video transcoding. Independent review now judges credible award-caliber candidate with no concrete redesign justified by current evidence. That is bounded subjective review, not proof of reaching user's quality bar. Goal remains active for user's direct visual feedback; no completion status set.

### 320px final edge-case check — 14 November 2026

Current production3159 at320×700: decline dialog had no horizontal overflow or axe violations; reset/accept/close/table path worked and bread note remained in frame (x150,width137). Asked user for specific qualitative feedback on current continuous recording, because further speculative edits do not establish the requested quality bar. Goal active pending that feedback; no completion claim.

### Real workspace continuity pass — 14 November 2026

Refined actual commitment rows into compact date leaf, task/team/time and action hierarchy; removed current user's pending-request duplicates from Coming up while keeping accepted rows. Accepted own row uses View preparation only when content exists, otherwise View commitment. Page heading reduced so real work leads. Actual-component fixture screenshots workspace-date-leaf.png/workspace-editorial-mobile.png inspected; mobile had no overflow or axe violations. Data remains isolated fixture, not hosted auth evidence. Goal remains active; this extends public craft into core product rather than adding decorative scenes.

### Mobile workspace navigation — 14 November 2026

Replaced horizontal overflow menu at<=760px with visible This week/My commitments plus accessible full workspace menu; current other section named in trigger. Existing desktop nav unchanged. Menu opens with full links/current marker, Escape restores trigger. Fixed current-marker contrast from4.18 to compliant darker text; repeated axe scan zero violations. Acceptance confirmation now local concise status rather than redirecting to a separate section already visible below. Actual-component fixture reviewed; not hosted auth claim.

### Current core-product verification — 14 November 2026

Actual-component mobile fixture accepted request→View commitment→details→Escape completed; missing preparation accurately explained, zero axe violations, focus returned to View commitment. Final consolidated feedback request remains pending. No additional source change justified by this pass; local functional evidence does not resolve user's subjective quality judgment. Goal remains active, not complete.

### Production interaction latency check — 14 November 2026

Fresh production3160,390×844,4×CPU throttle: opening invitation80ms event duration, invite56ms,accept56ms,Escape40ms,next-table40ms (Event Timing API; one bounded lab run, not field INP). Development first interaction232ms was not used as production claim. All story steps completed. No performance edit justified by this production sample. Goal remains active; qualitative user feedback still pending.

### Current review package — 14 November 2026

Refreshed neighborly-current-desktop.mp4 from current production3160: full opening/invitation/accepted/handoff/table/reopen journey. Captured current actual-component fixture mobile menu and accepted row in output/playwright/final-review. This supersedes older public recording for review; workspace fixtures remain isolated synthetic test evidence, not live authentication. No new implementation change justified by this verification. Goal remains active pending concrete quality critique; no completion claim.

### Short-viewport text-spacing verification — 14 November 2026

Current production3160 at640×450 with root font200% and paragraph WCAG-style spacing overrides: invitation→pending→decline remained operable; dialog stayed within viewport at560×394, no page horizontal overflow, axe scan zero violations. This uses CSS text-size/spacing overrides, not a claim of true browser zoom or screen-reader testing. No implementation change needed. User's qualitative feedback remains pending and goal is not marked achieved.

## Hand-stretch correction — 14 November 2026

User identified cartoon-like hand stretching. Root cause: translated palm bones against stationary wrist/root weights. Fixed runtime playback to hold Donor/DonorPalm/Receiver/ReceiverPalm TRS at authored rest endpoint, leaving Guide animation independent. Regenerated all responsive opening GLBs with constant hand tracks; corrected Blender authoring script so future exports do not reintroduce palm deformation. Original full source GLB retained; all consumers using shared playback protected.

Verified desktop before/mid/after browser captures hands-fixed-before/during/after.png; mid-frame shows guide travelling with unchanged hand silhouette. Decoded responsive GLBs:60 hand TRS tracks each constant across desktop/mobile/narrow. Added focused test proving hand position remains fixed, guide moves, and source clip is not mutated. This fixes stretching, not a claim of anatomical finger animation.
