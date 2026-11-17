# Neighborly

A painted introduction to volunteering for churches and communities, with a
shared portrait-to-courtyard journey and a private coordination app.

## Run

```sh
bun install
bun run dev
```

Open http://localhost:3000. Public courtyard gestures use session-local state
and send no messages or create commitments. `/app` signs people in with Clerk; Convex checks Clerk's token on every call
(`convex/auth.config.ts`, `convex/access.ts`) and uses the separate
`neighborly-live` development backend for private workspaces.
The original `neighborly` backend is preserved and must not be overwritten.
Use the deployment in `.env.local` when running `bunx convex dev --once`.

```sh
bun run lint
bun run typecheck
bun run test
bun run build
```

`bun run a11y` runs axe (WCAG 2.1 A and AA) and a Tab walk on the sign-in page and every room of the sample conference at 1440, 390 and 1440 at 200% zoom, against a running `bun run dev` (`A11Y_URL` to point elsewhere; it uses your installed Chrome, or `A11Y_BROWSER`).

`test` runs both the Bun unit suite and the Vitest/convex-test backend suite.
Those backend tests simulate authentication; they do not prove real email or
browser sign-in. Clerk sends the sign-up and password codes itself.

## Live configuration

The client needs `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` and
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. The website's server also needs
`CLERK_SECRET_KEY`, and the Convex deployment needs `CLERK_JWT_ISSUER_DOMAIN`
(Clerk's Frontend API URL, not a secret). Production Clerk keys work only on
kindhelps.com; use the development instance's keys locally.
Server secrets remain in the Convex deployment, never in public variables.
Set `SITE_URL` to the exact frontend origin. After a dedicated sender is chosen,
configure `SENDER_EMAIL` and `RESEND_API_KEY`; enable the notification outbox with
`EMAIL_DELIVERY_ENABLED=true` only after delivery verification. Domain and email
setup require an owner-chosen sender domain and test recipient. Account-email
readiness is independent of the group-notification switch; leaving that switch
off prevents the outbox from sending group notifications.

`TYPESAFE_API_KEY` optionally enables server-side checks of explicit team-draft
facts. Without it, the deterministic draft remains editable and is labeled for
review. AI never creates members, assigns work or infers consent. Invitations
store only token hashes; an authorized owner may copy the one-time invitation
link for manual delivery while email is unavailable.

The app includes private church/team membership, dated and recurring
responsibilities, availability, cover requests, reviewed time off, tasks,
meetings and announcements. Server-side permissions and explicit recipient
acceptance are authoritative. Presentation effects never authorize an action.

## Artwork

At the user's request, the main page again selects the painted relief through
`reliefArtwork` in `src/lib/artwork.ts`. Its model is
`public/assets/living-relief.glb`; its desktop, mobile and narrow stills and
camera states are described by the relief artwork definition and manifest.
The artwork combines generated portrait pigment layers with Blender-authored
displaced hands, a folded guide and gesture animation.

The editable source is `art/living-relief.blend`, with generated source
pigments in `art/textures/` and original rendered PNGs in
`art/renders/relief/`. To regenerate from Blender's Python console:

```python
exec(compile(open('/Users/josephsimo/Documents/Neighborly/art/build_relief.py').read(), 'build_relief.py', 'exec'))
```

Then run `bun art/optimize-relief.ts` from the project root to encode WebP
stills. The stateful example, sample workspace, draft validation and other
functional fixes are retained. The current implementation passes lint,
typecheck, production build, 44 unit tests and 24 backend tests. The local
production preview is http://localhost:3144. The hosted preview is
https://neighborly-m3tj8c34t-simo-js.vercel.app (Vercel authentication required). See
`docs/acceptance.md` for bounded evidence and remaining verification limits.

## Preserved cast experiment

The volumetric cast work is preserved as an experiment and is not selected
by the main page. `src/lib/cast-artwork.ts` and its v4 manifest remain available
with the editable scenes, model, stills and export tooling.

The editable prepared scene is `art/cast-handoff-v3.blend`; its input is
`art/cast-lod80-pose-final.blend`. The model is
`public/assets/cast-handoff-v4.glb` (1,471,164 bytes; SHA-256
`5ba8d361a94c7c812b65b91f7d4456bd168dc381e8770be0a429b28c2b7c6cf1`).
Named clips are `rest`, `settle`, `pending`, `accepted` and `declined`.
The application chooses the clip; animation never authorizes acceptance,
sends a message or completes a task.

`art/cast_export.py` exports the selected meshes and rigs, runs the lossless
meshopt encoder in `art/tooling/encode-meshopt.ts`, renders matching stills,
and uses `/opt/homebrew/bin/cwebp` to encode them. Its pinned encoder
dependencies have a separate lockfile:

```sh
cd art/tooling
bun install --frozen-lockfile
```

To regenerate the v3 export from the prepared scene, open
`art/cast-handoff-v3.blend` in Blender, then run in its Python console
(replace the root if the project has moved):

```python
import sys
sys.path.insert(0, '/Users/josephsimo/Documents/Neighborly/art')
from cast_export import export_current
export_current(asset_prefix='cast-handoff-v3', model_suffix='', mobile_size=(390, 300), include_narrow=True, lossless=True)
```

This regenerates the v3 source export and its six stills. The preserved v4
package reuses those stills and applies palette materials and compatible
primitive batching without changing geometry, skins or animation. After the
v3 export, reproduce the v4 model from the project root with:

```sh
bun art/tooling/batch-cast.ts public/assets/cast-handoff-v3.glb public/assets/cast-handoff-v4.glb art/renders/cast/cast-handoff-v4-batch-audit.json
```

The retained script reproduced the exact v4 SHA-256 above. Its palette
material conversion changes the tested rendered image by at most 2/255 per
channel; it is not an assertion of byte-identical material factors. The v4
manifest selects the v4 model and the six v3 stills. Source PNG renders, the uncompressed
GLB, cleanup/encoding audits and checksummed receipt are retained in
`art/renders/cast/`. The receipt records the selected source and encoder
versions. Regeneration is not visual acceptance: inspect the exported scene
in the browser, including mobile, reduced motion and fallback states.

The cast uses a MakeHuman/MPFB anatomical base with subsequent Neighborly
sculpting, clothing and animation work. The installed MPFB base identifies
itself as hm08, released under CC0. MPFB code uses GPL-3.0-or-later; the asset
license is separate. See `licenses/MakeHuman-MPFB-NOTICE.md` and
`licenses/MakeHuman-MPFB-CC0.md`. The final body data blocks have no retained
source UUIDs, so the precise derivative chain and any optional asset inventory
remain incompletely documented. Do not describe this as wholly modeled from
scratch or free of third-party art inputs. Font OFL records remain in
`licenses/` and `public/fonts/`.

The original procedural mural also remains historical work. Cast verification
records are retained in `docs/acceptance.md`; they do not establish current
relief quality or phone performance.

The application previously passed direct lint, typecheck, production build
and 32 tests / 195 assertions with the cast selected. Physical iPhone Air
Safari interaction reached acceptance and preparation during that cast check.
Those results remain historical and do not establish a quantified physical
frame rate.

A separate cloud development deployment has been created for `neighborly-live`.
No production backend was overwritten and real email delivery remains disabled.
For the complete still experience, append `?noWebGL=1` to the local URL.


## Artwork review

The original artwork is selected on the review page again:
https://neighborly-15lws9m33-simo-js.vercel.app/relief-review

Generated replacement studies are preserved locally but unapproved and excluded
from deployment. Future work must retain the original proportions and character.


## Current unified design preview

Use https://neighborly-design-simo-js.vercel.app/ as the single design-review address. The homepage is the painted journey; /painted-world and /experience redirect to /. After verifying a new preview, retarget this alias in the existing simo-js/neighborly project rather than distributing another temporary deployment URL. This alias is a design preview, not a production-domain promotion.

The current design direction is scroll/swipe-driven: scroll the homepage to move through the painted story. This supersedes the earlier click-to-advance interaction. The canonical design address remains https://neighborly-design-simo-js.vercel.app/.
