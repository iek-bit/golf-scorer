# Fairway — Minimalist Golf Tracker

Stage 1 (Core MVP): a working digital scorecard, no map yet, local storage only.

## What's here

Plain HTML/CSS/JS — no build step, no framework, no npm install required.
That's deliberate: it deploys to GitHub Pages by just pushing the files, and
keeps "limited backend coding" true for as long as possible.

```
index.html          App shell: an empty header slot + the view outlet
css/styles.css       All styling — design tokens (light/dark) at the top
js/app.js            Registers routes (each with header title/back target)
js/router.js         Tiny hash-based router (#/, #/courses, #/round/:id/play, ...)
js/header.js         Renders the header per-route: wordmark+toggle on home, back+title elsewhere
js/models.js         Data shapes (Course, Round, Player) + id/factory helpers
js/storage.js        The ONLY file that touches localStorage — see below
js/theme.js          Light/dark handling (system default + manual override, or explicit choice)
js/stats.js          Aggregate stats computed from local round history
js/components/tile.js  Shared wrapper for the home screen's tappable tiles
js/views/*.js        One file per screen (home, courses, new round, play, summary, stats, settings)
```

## Navigation

There's no bottom tab bar. The home screen is three stacked tiles:

1. **Start/continue round** — a hero tile. If a round is in progress it
   shows "Continue round"; otherwise "Start round" at the most recently
   played course. That's a stand-in for GPS-based "nearest course" until
   Stage 2 adds course locations — same for the tile's dark gradient
   background, which stands in for a real course photo/map until then.
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

- **New home-screen sections** (e.g. a "Rangefinder" tile once Stage 2
  lands) should use `tile()` from `js/components/tile.js` rather than
  inventing new card markup — it's the shared wrapper all three current
  tiles use.
- **New screens** just need one line in `app.js`:
  `route('/new-thing', { title: 'New Thing', backTo: '/' }, renderNewThing)`.
  `header.js` handles the chrome automatically; the view itself never
  touches the header.

## How scoring works

- A **course** has a name, hole count (9 or 18), and a par per hole.
- A **round** picks a course and a hole range (18, front 9, or back 9), then
  walks through those holes one at a time. Each hole records strokes and
  putts. There's no per-shot / GPS tracking yet — that's Stage 2.
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
- No map, no GPS, no shot tracking — that's Stage 2.
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

## What to try once it's deployed

1. Add a course (home → Settings → Manage courses → Add course) — give it
   a name and set par per hole with the +/− steppers.
2. Tap the top tile on the home screen to start a round; pick front 9 /
   back 9 / all 18.
3. Step through holes entering strokes and putts.
4. Finish the round and check the summary screen.
5. Back on the home screen, the stats tile should now show real numbers —
   tap it to see the full Stats screen and your round history.
6. In Settings, switch between System / Light / Dark.
7. Refresh the page mid-round — it should resume exactly where you left
   off (the hero tile switches to "Continue round"), which proves the
   local storage save/load/clear behavior the plan calls for.
