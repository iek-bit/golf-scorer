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
index.html          App shell: an empty header slot + the view outlet + Leaflet CDN tags
css/styles.css       All styling — design tokens (light/dark) at the top
js/app.js            Registers routes (each with header title/back target)
js/router.js         Tiny hash-based router (#/, #/courses, #/round/:id/play, ...)
js/header.js         Renders the header per-route: wordmark+toggle on home, back+title elsewhere
js/models.js         Data shapes (Course, Round, Player) + id/factory helpers
js/storage.js        The ONLY file that touches localStorage — see below
js/theme.js          Light/dark handling (system default + manual override, or explicit choice)
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
2. **Stats** — a few mini stats (rounds played, avg to par, best round,
   avg putts). Tapping it opens the full Stats screen, which also lists
   every completed round (tap one to see its scorecard again).
3. **Settings** — theme (System/Light/Dark), a link to manage courses,
   and a reset-all-data option.

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

- We call exactly **one** OpenGolfAPI endpoint: their plain, keyless `GET
  /v1/courses/search`. Nothing else — see the comment at the top of
  `js/api/opengolfapi.js`.
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
- A fixed search radius made "nearest course" look broken in areas with
  thin OpenGolfAPI coverage, so nearby search now escalates — 25mi, then
  50, then 100 — and stops at the first radius that finds anything
  (`searchNearbyCourses` in `js/api/opengolfapi.js`).
- Every result list — nearby search, name search, and your own saved
  courses — is sorted nearest-first once your position is known
  (`sortByDistance` in `js/geo.js`), not just the dedicated "near me" flow.
  This one was a confirmed real bug, not just a UX gap: the home tile was
  asking the API for a single result and trusting it was the closest one,
  with no client-side check — which is how a course an hour away ended up
  labeled "nearest." Every "nearest" lookup now fetches a real batch and
  sorts it by actual calculated distance itself, never trusting the API's
  own ordering.
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
- No PWA manifest / service worker / offline caching yet — that's Stage 3.

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
your own edits going forward, bump the `?v=` number in `index.html` so
this keeps working.

## What to try once it's deployed

This one really needs a phone with location on — desktop geolocation is
usually too imprecise to be meaningful, and the map/rangefinder need real
coordinates to show anything useful.

1. Tap the home screen's top tile — it should prompt for location and
   then go straight to a "Near you" list of real nearby courses (search by
   name also works; "add manually" is there if a course isn't listed).
2. Pick a course, choose holes to play, and start the round.
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
7. Everything from Stage 1 still applies: stats, settings, theme, and
   resuming a round after a refresh.
