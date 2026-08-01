# Fairway — Minimalist Golf Tracker

Stage 1 (Core MVP) + Stage 2 (Location & Mapping, in progress): a digital
scorecard with course search, GPS shot tracking, and a rangefinder. Course
hole-geometry (tee/green) is built organically the first time each hole is
played, rather than mapped upfront.

## What's here

Plain HTML/CSS/JS — no build step, no framework, no npm install required —
plus Leaflet loaded from a CDN for the one screen that needs a map. That's
deliberate: it deploys to GitHub Pages by just pushing the files, and keeps
"limited backend coding" true for as long as possible.

```
index.html          App shell: an empty header slot + the view outlet + Leaflet CDN tags + PWA/icon tags
manifest.webmanifest PWA manifest — name, icons, standalone display
sw.js                Service worker: precached app shell + stale-while-revalidate for fonts/tiles/API
icons/               Favicon + manifest icons, generated from one square source image (see PWA section)
css/styles.css       All styling — design tokens (light/dark × Standard/Material 3/Liquid Glass) at the top
js/app.js            Registers routes, boots theme/design/ripple, registers the service worker
js/router.js         Tiny hash-based router (#/, #/courses, #/round/:id/play, ...) — now parses ?query too
js/header.js         Renders the header per-route: wordmark+toggle on home, back+title elsewhere
js/models.js         Data shapes (Course, Round, Player) + id/factory helpers
js/storage.js        The ONLY file that touches localStorage — see below
js/theme.js          Light/dark handling (system default + manual override, or explicit choice)
js/design.js          Design-language (Standard/Material 3/Liquid Glass) + color palette handling — see below
js/ripple.js          Material 3's press ripple, delegated at the document level (no-op outside m3)
js/courseResolve.js  Shared "turn an OpenGolfAPI result into a saved local course" logic
js/stats.js          Aggregate stats computed from local round history
js/geo.js            Geolocation wrapper + distance math (rangefinder, nearest-course)
js/mapConfig.js      Shared map tile URLs (satellite + street) used by home.js and play.js
js/api/opengolfapi.js  Read-only wrapper around OpenGolfAPI's keyless course search — see below
js/components/tile.js  Shared wrapper for the home screen's tappable tiles
js/views/*.js        One file per screen (home, courses, new round, play, summary, stats, settings)
```

## Navigation

There's no bottom tab bar. The home screen is three stacked tiles:

1. **Start/continue round** — a hero tile. If a round is in progress it
   shows "Continue round" with that course's satellite image behind the
   text. Otherwise it shows "Locating you…" immediately and actively
   resolves the true GPS-nearest course in the background — this *can*
   prompt for location permission, since finding the nearest course is the
   point of the button (see `resolveNearestAndUpdate` in
   `js/views/home.js`). It always lands on a definitive final state:
   the nearest course if one's found, otherwise the most recently played
   course, otherwise a plain "Find a course" prompt — never stuck on
   "Locating…" if permission is denied or nothing's nearby. It never does
   this while a round is in progress. The satellite image comes from the
   same non-interactive map used elsewhere — see "Course search" below.
   Tapping it links straight to `#/round/new?course=<id>`, which
   preselects that course and jumps to the holes step instead of a blank
   search — see "Course search" below for why that used to be wrong.
2. **Stats** — a few mini stats (rounds played, avg to par, best round,
   avg putts). Tapping it opens the full Stats screen, which also lists
   every completed round (tap one to see its scorecard again).
3. **Settings** — theme (System/Light/Dark), design language (Standard /
   Material 3 / Liquid Glass, with a "match my device" auto option) and
   color palette, a link to manage courses, and a reset-all-data option.

Every other screen gets a back button + title in the header, targeting a
fixed parent screen (declared per-route in `app.js`) rather than browser
history — simpler to reason about than an actual history stack, given how
shallow this app's navigation is.

## Extending the UI in later stages

Two small seams exist specifically so later stages don't require a
redesign:

- **New home-screen sections** (e.g. a shortcut tile for something added in
  a later stage) should use `tile()` from `js/components/tile.js` rather
  than inventing new card markup — it's the shared wrapper all three
  current tiles use.
- **New screens** just need one line in `app.js`:
  `route('/new-thing', { title: 'New Thing', backTo: '/' }, renderNewThing)`.
  `header.js` handles the chrome automatically; the view itself never
  touches the header.

## Course search — and why it's scoped the way it is

Starting a round automatically searches nearby using your location as soon
as the screen opens (no button tap needed) — [OpenGolfAPI](https://opengolfapi.org)'s
course list (16,800+ US courses, name/location/par), or the search box to
find one by name. "Add a course manually" is the fallback, not the
default, and manually-added courses now capture a location too (your
position when you save it), so they can show up as "nearest" just like
API-sourced ones. Worth knowing:

- We call two OpenGolfAPI endpoints, both plain and keyless: `GET
  /v1/courses/search` (name search, and as a coverage supplement — see
  below) and `GET /v1/courses/state/:code` (the real source of "nearest").
  Nothing else — see the comment at the top of `js/api/opengolfapi.js`.
- Their platform bundles a lot more than a course database (an email-hash-
  derived "OpenGolf ID," a Bitcoin-anchored verification chain, asset
  minting) and their docs actively court AI coding agents to auto-integrate
  it. This app deliberately doesn't touch any of that — no sign-in, no dev
  key, no writes.
- Their own docs say precise green/tee/hazard geometry is gated, not free —
  only coarse OSM-derived shapes are. That's *why* the app doesn't try to
  pull hole geometry from them at all; see the next section.
- If this endpoint ever disappears or changes shape, every call fails soft
  (empty results) — "Add a course manually" still works as a complete
  fallback, same as it did in Stage 1.
- Satellite imagery (the hero tile background, the play-screen map) comes
  from Esri World Imagery — free, keyless tiles, no billing account
  required (unlike Google Maps — see `js/mapConfig.js`).
- The location-based `?lat&lng&radius_mi` mode of `/v1/courses/search`
  turned out not to be trustworthy for "find the closest one": a
  confirmed-real, findable-by-name course was consistently missing from
  its results near home, on both desktop and phone — most likely because
  it doesn't reliably sort by true distance before applying `limit`
  (unverifiable from outside the API; the docs don't say either way). So
  `searchNearbyCourses` no longer depends on that endpoint's own ranking
  at all: it resolves your state from lat/lng against a small built-in
  bounding-box table (`js/usStates.js` — no geocoding API, no network
  call, no rate limit), pulls that *entire* state's course list via the
  unambiguous `/v1/courses/state/{code}` (paginated to get all of it),
  and ranks that itself with the same haversine math used everywhere else
  in this app. The old radius search is still called too and merged in
  (deduped by id) purely as extra coverage for any course OpenGolfAPI
  hasn't tagged with a state — but it's no longer what "nearest" is
  actually trusted to mean. A state's course list is one-time-fetched per
  session (not cached to storage), and a bounding box near a state line
  can match 2 states, which is intentional — it costs one extra fetch and
  never drops a real result the way a too-narrow match would.
- Every result list — nearby search, name search, and your own saved
  courses — is sorted nearest-first once your position is known
  (`sortByDistance` in `js/geo.js`), not just the dedicated "near me" flow.
- The home tile's "nearest course" had a real bug: it only ever ranked
  OpenGolfAPI results against each other, so a course you'd added
  manually — which can genuinely be your closest course — never got a
  chance to win, even though manually-added courses capture a location
  too. `resolveNearestAndUpdate` in `js/views/home.js` now merges your own
  saved courses and a real OpenGolfAPI batch into one list and ranks it by
  actual calculated distance, never the API's own ordering and never a
  single trusted result.
- Whatever wins that comparison becomes a real saved local course (via
  `ensureLocalCourse` in `js/courseResolve.js`, reusing an existing record
  by `externalId` if there is one) before the hero tile links to it, so
  tapping "New round" from home goes straight to `#/round/new?course=<id>`
  — the suggested course preselected on the holes step, with a "Not this
  one?" link back to search — instead of a blank searchable list that
  didn't even surface the course that was just suggested.
- The home screen's hero tile now has a small directions button (top-right
  corner) that opens Google Maps with driving directions to that course —
  a plain `maps.google.com/dir` link, no API key needed.

## Par, when OpenGolfAPI doesn't have it

Per-hole par isn't reliably available for free (see above), so API-sourced
holes start at a placeholder par of 4 with `parConfirmed: false`. The play
screen shows that as a tappable "Par 4 · confirm" badge instead of a plain
label; picking the real par (3/4/5/6) saves it onto the course record —
same "confirmed once, remembered forever" pattern as tee/green mapping
below. Manually-added courses skip this entirely; typing a par in counts
as confirming it.

## Shot tracking & how a course gets mapped

The plan called for either an API for hole-by-hole GPS or a manual
satellite-drawing tool. In practice neither free API offers real tee/green
precision, and a full drawing tool is a lot of upfront tedium before a
course is even playable. So instead: **a course maps itself the first time
someone plays it.**

- The play screen's map is the current hole rendered on Esri satellite
  imagery. Once tee and green are both known, it fits the view to show the
  whole hole; before that, it centers on your current position at a
  moderate zoom (not tight — "see the hole," not "see your feet"), and it
  tries to show that position as soon as the hole loads, before you've
  tapped anything — not just after tracking a shot. Tee/green/shots/your
  position use small themed markers (`.map-marker--*` in `styles.css`)
  instead of Leaflet's default pin image.
- The floating button on the map has two modes — wait, it's not floating
  anymore. It started as a circular button overlaying the map, but that
  depended on stacking cleanly on top of a Leaflet instance's own internal
  layout, and broke in practice (visible in testing, then reported as
  fully missing after a deploy). Rather than keep patching that pattern,
  it's now a plain full-width button in normal document flow directly
  below the map — same two modes, same colors/icons, just not floating.
  The **first** tap on a hole is **Start hole** (flag icon, sand-colored)
  — it marks the tee and deliberately does **not** count as a stroke.
  Every tap after that is **Track shot** (crosshair icon, fairway-colored)
  and does count. That split exists specifically so "mark the tee, then
  track every shot" produces an accurate stroke count instead of one too
  many. A manual +/− below still works with no location attached, for
  when GPS isn't available or wanted.
- The map itself is now wrapped defensively: if Leaflet or a tile/marker
  call ever throws, it falls back to a plain placeholder instead of
  breaking the rest of the screen — shot tracking and scoring keep working
  either way, since the map is a display layer on top of already-saved
  data, not a dependency of it.
- A compact scorecard strip runs across the top of the screen — every hole
  in the round, tap any one to jump straight to it, current hole
  highlighted, running total at the end.
- When you move past a hole (Next hole / Finish round) and that hole has no
  saved tee/green yet, the **Start hole** tap becomes the tee and the
  **last tracked shot** becomes the green — saved onto the *course*
  record, not the round, so it's there for every future round on that
  course and is never overwritten once set. See `mapHoleFromShots()` /
  `computeTeeGreenFromShots()` in `js/views/play.js`.
- A hole not yet mapped shows a one-line hint under Hole/Par explaining
  which tap does what, so the tee/green logic isn't a surprise.
- This is a single point per green for now (not the separate front/center/
  back edges the plan describes) — that needs either several rounds' worth
  of data to average out, or a dedicated one-time calibration step, and
  we scoped this pass to points only. Straightforward to add later.

## Rangefinder

Once a hole has a saved green, a small floating badge in the top corner of
the map shows a live distance to it (pulling your position the same way —
silently if location permission is already granted, otherwise via a tap
on the badge itself). It's a single "yards to green" number for now, not
separate front/center/back distances, for the same reason noted above.

## How scoring works

- A **course** has a name, hole count (9 or 18), and a par per hole — either
  typed in manually, or picked from OpenGolfAPI search (par defaults to 4
  per hole for API-sourced courses, since per-hole par isn't reliably free —
  editable as you play).
- A **round** picks a course and a hole range (18, front 9, or back 9), then
  walks through those holes one at a time. Each hole records strokes,
  putts, and — if you use Track shot — a GPS-tagged shot list.
- Scores follow the pencil-and-paper scorecard convention: a birdie or
  better is circled, a bogey or worse is boxed, par sits plain. That's the
  one deliberate visual flourish in the app (see `.score-*` classes in
  `styles.css` and `scoreClass()` in `js/views/play.js`).

## Design languages: Standard / Material 3 / Liquid Glass

Settings has one main control — a three-way segmented slider (Standard /
Material 3 / Liquid Glass) — plus a "Match my device" toggle above it and
a color palette below it. All three live in `js/design.js`:

- **Auto-match** is on by default and picks a design language from a
  best-effort OS-family sniff (`detectOsDesign()`): iOS/iPadOS/macOS →
  Liquid Glass, Android → Material 3, everything else → Standard. There's
  no web API for "this is specifically a Pixel" (or literally "this uses
  Apple's Liquid Glass") — only a general UA/platform signature — so this
  is documented as OS-family detection, not hardware detection, both in
  the module comment and in the Settings copy itself.
- Picking a value on the segmented control always overrides auto-match
  (and turns the toggle off) — the two controls represent one underlying
  state, not two independent ones.
- Almost the entire visual shift is token remapping, not per-component
  rewrites: every card/button/input in `styles.css` already reads from
  `--color-*`, `--radius-*`, and `--shadow-card`, so
  `[data-design='m3']`/`[data-design='glass']` mostly just redefine those
  tokens once, near the top of the file. On top of that: Material 3 gets
  pill-shaped buttons/segmented controls, tonal (flat) secondary buttons,
  and a real state-layer ripple on press (`js/ripple.js`, delegated at the
  document level so it works across every view without per-element
  wiring, and a genuine no-op outside `data-design="m3"`); Liquid Glass
  gets translucent blurred surfaces with an inset highlight rim over a
  soft color wash on the page background.
- The hero tile keeps its own photographic satellite-image treatment in
  every design language — it's meant to read as a photo card, not a
  themed surface.
- **Color palette** (Fairway/Ocean/Sunset/Slate presets, or a custom
  primary/secondary/tertiary picker) applies across all three design
  languages, by setting `--color-fairway`/`-bright`/`-sand`/`-sky` as
  inline styles on `<html>` — inline styles outrank any of the tokens
  above regardless of which design language is active, so there's no
  design-specific palette plumbing needed. It intentionally doesn't vary
  by light/dark (one color per role, not two) — matches the original
  plan's "edit primary/secondary/tertiary color" scope without doubling
  the settings UI.
- `theme-color` (the browser/OS chrome tint) follows both light/dark *and*
  design language automatically — see `syncThemeColorMeta()` in
  `js/theme.js`.

## PWA & offline

`manifest.webmanifest` + `sw.js` make this installable and usable with a
spotty or absent connection:

- The app shell (HTML/CSS/JS, icons) is precached on install and served
  cache-first, so the app still opens with no signal at all.
- Everything else useful offline — Leaflet, Google Fonts, Esri satellite
  tiles, OpenGolfAPI search — is cached at runtime with a
  stale-while-revalidate strategy: once you've viewed a hole's map tiles
  or searched courses with a signal, they're reusable without one. This is
  opportunistic caching of what you've actually used, not a proactive
  "download this course for offline" feature — that would need its own UI
  and is a reasonable Stage 3+ addition, not assumed here.
- `sw.js` bumps its own cache on `CACHE_VERSION` and calls `skipWaiting()`
  / `clients.claim()` on install/activate, with a one-time reload on
  `controllerchange` in `app.js` — the simplest correct "always run the
  latest version" pattern, no separate "update available" UI. Bump
  `CACHE_VERSION` (and the `?v=` query strings on `styles.css`/`app.js` in
  `index.html`, and the matching precache list in `sw.js`) any time you
  change a precached file's content.
- Icons in `icons/` are generated from one square source image: `any`
  (transparent) variants for the browser tab and general manifest use,
  `maskable` variants with extra padding + a solid fill for Android's
  adaptive-icon safe zone, and a flattened `apple-touch-icon.png` (iOS
  ignores alpha).

## Local storage → future DB: the migration path

Every screen calls functions on the `storage` object exported from
`js/storage.js` (`storage.getCourses()`, `storage.saveRound()`, etc.), and
every one of those functions already returns a `Promise` — even though
`localStorage` itself is synchronous. That's intentional groundwork for
Stage 4: when the Cloudflare DB is ready, `storage.js` is the **only** file
that needs to change. Its functions will do `fetch()` calls instead of
`localStorage.getItem/setItem`, but they'll return the same shapes, so
`views/*.js` won't need to change at all.

The field names in `js/models.js` (`Course`, `Round`, hole/par/strokes/putts)
are meant to become the DB's table/column names directly — so there's no
translation layer to write later, just a schema that already matches.

Not yet handled (by design, deferred to later stages):
- No `player_id` / auth / password hashing — that's Stage 4.
- No club selection per shot, no club bag management yet.
- No editing a shot's location by dragging its map marker (only undo-last).
- No hazard/landing-type polygons (sand/fairway/rough) — points only so far.
- Green geometry is a single point, not separate front/center/back edges.
- Editing a course's basic details (name, hole count) after creation isn't
  built yet — only par-per-hole is editable, in place, while playing.

## Running it locally

No build step — any static file server works:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed local URL. Because it's ES modules loaded via
`<script type="module">`, opening `index.html` directly via `file://` won't
work in most browsers — use a local server.

## Deploying to GitHub Pages

1. Create a new GitHub repository (or use an existing empty one) — this
   part needs to happen on your account, since I don't have access to push
   to GitHub on your behalf.
2. Push these files to the repo's default branch:
   ```bash
   git init
   git add .
   git commit -m "Stage 1: core MVP scorecard"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
3. In the repo's **Settings → Pages**, set the source to "Deploy from a
   branch," branch `main`, folder `/ (root)`.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two.

**After every redeploy, hard-refresh** (Cmd+Shift+R / Ctrl+Shift+R) before
testing — `index.html` loads `css/styles.css` and `js/app.js` with a `?v=`
query string specifically so a normal refresh doesn't serve a stale cached
copy, but a hard refresh is still the reliable way to be sure you're
looking at what you just pushed, not a leftover from before. If you make
your own edits going forward, bump the `?v=` number in `index.html` **and**
`CACHE_VERSION` + the matching precache list in `sw.js` — the service
worker now also caches the app shell (see "PWA & offline" above), and its
own reload-on-update logic only fires once a new worker has actually
activated, which needs the cache version bumped to be noticed at all.

## What to try once it's deployed

This one really needs a phone with location on — desktop geolocation is
usually too imprecise to be meaningful, and the map/rangefinder need real
coordinates to show anything useful.

1. Tap the home screen's top tile — it should prompt for location, then
   land on the holes step with your real nearest course already selected
   (labeled "Nearest course," with a "Not this one?" link back to search —
   not a blank searchable list).
2. Pick holes to play and start the round.
3. On hole 1, if it's an API-sourced course, you should see a tappable
   "Par 4 · confirm" badge — tap it and pick the real par.
4. On hole 1, the map should locate you almost immediately. Tap the
   (sand-colored, flag icon) **Start hole** button once at the tee — that
   marks the tee and doesn't count as a stroke. From then on the same
   button is **Track shot** (fairway-colored, crosshair icon) — tap it at
   your actual position after each stroke and watch the count, the
   scorecard strip, and the map markers update.
5. Tap **Next hole**. Play that same hole again later (new round, same
   course) and you should see a "yds to green" badge appear in the corner
   of the map, and the map should already be framed around the hole you
   mapped.
6. Back on the home screen, the top tile should show your real nearest
   course with its satellite image behind the text.
7. In Settings, try the design language slider (Standard / Material 3 /
   Liquid Glass) and the "Match my device" toggle, and a color palette —
   confirm the palette carries over when you switch design language.
8. On a phone, use the browser's "Add to Home Screen" / install prompt —
   it should install with the golf-ball icon, open without browser chrome,
   and (after one normal visit while online) still open with airplane
   mode on.
9. Everything from Stage 1 still applies: stats, settings, theme, and
   resuming a round after a refresh.
