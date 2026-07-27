# Fairway — Minimalist Golf Tracker

Stage 1 (Core MVP): a working digital scorecard, no map yet, local storage only.

## What's here

Plain HTML/CSS/JS — no build step, no framework, no npm install required.
That's deliberate: it deploys to GitHub Pages by just pushing the files, and
keeps "limited backend coding" true for as long as possible.

```
index.html          App shell: header, view outlet, bottom tab bar
css/styles.css       All styling — design tokens + light/dark theme at the top
js/app.js            Registers routes, wires up the theme toggle
js/router.js         Tiny hash-based router (#/, #/courses, #/round/:id/play, ...)
js/models.js         Data shapes (Course, Round, Player) + id/factory helpers
js/storage.js        The ONLY file that touches localStorage — see below
js/theme.js          Light/dark handling (system default + manual override)
js/views/*.js        One file per screen (home, courses, new round, play, summary)
```

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

1. Add a course (Courses → Add course) — give it a name and par per hole.
2. Start a new round, pick front 9 / back 9 / all 18.
3. Step through holes entering strokes and putts.
4. Finish the round and check the summary screen.
5. Toggle the theme button (top right) between light and dark.
6. Refresh the page mid-round — it should resume exactly where you left off
   (that's the "Round in progress" card on the home screen), which proves
   the local storage save/load/clear behavior the plan calls for.
