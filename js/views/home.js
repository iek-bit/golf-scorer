import { storage } from '../storage.js';
import { computeStats } from '../stats.js';
import { tile } from '../components/tile.js';
import { searchNearbyCourses } from '../api/opengolfapi.js';
import { getCurrentPosition, haversineMeters } from '../geo.js';
import { SATELLITE_TILE_URL, SATELLITE_ATTRIBUTION } from '../mapConfig.js';
import { ensureLocalCourse } from '../courseResolve.js';
import { getCourseWeather, weatherIconSvg, weatherConditionLabel, degToCompass } from '../api/weather.js';
import { statesContainingPoint } from '../usStates.js';
import { youthOnCourseIcon, externalLinkIcon, chevronIcon, closeIcon, navigationIcon } from '../icons.js';

// Set once per renderHome() and read by the hero tile's price row — home.js's
// other render functions are plain top-level functions keyed off the DOM
// (see finalizeTile below), not closures, so this follows the same pattern
// rather than threading one more parameter through every call site.
let yocEnabled = false;

export async function renderHome(outlet) {
  const [rounds, courses, bags, yoc] = await Promise.all([storage.getRounds(), storage.getCourses(), storage.getBags(), storage.getYouthOnCourseEnabled()]);
  yocEnabled = yoc;
  const heroState = computeHeroState(rounds, courses);

  outlet.innerHTML = `
    <div class="tile-stack">
      <div id="round-tile-slot">${renderRoundTile(heroState)}</div>
      ${renderStatsTile(rounds, courses)}
      ${renderBagsTile(bags)}
      ${renderSettingsTile()}
    </div>
  `;

  // Delegated on the outlet (not the tile itself) so it survives
  // round-tile-slot being swapped wholesale once resolveNearestAndUpdate()
  // settles — see finalizeTile() below. Reads the course fresh from
  // storage rather than the courses[] captured above, since the nearest
  // course can be one ensureLocalCourse() only just created this session.
  outlet.addEventListener('click', async (e) => {
    const btn = e.target.closest('.hero-price-details-btn');
    if (!btn) return;
    e.stopPropagation();
    const course = await storage.getCourse(btn.dataset.courseId);
    if (course) openPriceDetailsSheet(course);
  });

  mountHeroMap(heroState.course?.location || null);
  if (heroState.mode === 'continue') loadHeroWeather(heroState.course);

  // Actively resolve the true GPS-nearest course (this can prompt for
  // location permission — that's intentional here, since finding the
  // nearest course is the whole point of the button). Never runs while a
  // round is in progress; "Continue round" always wins. Always lands on a
  // definitive final label — success or not — so the tile never sits on
  // "Locating you…" forever if permission is denied or nothing's nearby.
  if (heroState.mode === 'start') resolveNearestAndUpdate(heroState.course);
}

// --- Tile 1: start a new round, or resume one already in progress.

function computeHeroState(rounds, courses) {
  const inProgress = rounds.find((r) => !r.completedAt);
  if (inProgress) {
    return { mode: 'continue', course: courses.find((c) => c.id === inProgress.courseId) || null, roundId: inProgress.id };
  }
  const fallbackCourse = courses.length ? getDefaultCourse(rounds, courses) : null;
  return { mode: 'start', course: fallbackCourse };
}

// Hero tile markup is hand-built (not using the shared tile() helper)
// because it needs a directions button (and now a booking link/price
// details button) as siblings of the main tap target, not nested inside
// it — nesting an <a>/<button> inside another <a> is invalid HTML and
// behaves inconsistently across browsers. The primary link is an
// absolutely-positioned overlay filling the whole tile; the secondary
// buttons sit on top of it in their own spots, so tapping one of them
// doesn't also trigger the tile's own navigation.
function heroTileMarkup({ href, extraClass, ariaLabel, eyebrow, courseLabel, cta, course }) {
  return `
    <div class="tile tile--hero ${extraClass || ''}">
      <div id="hero-tile-map" class="tile-map"></div>
      <a class="tile-primary-link" href="${href}" aria-label="${escapeHtml(ariaLabel)}"></a>
      ${directionsButtonHtml(course?.location || null)}
      <span id="hero-weather-badge"></span>
      <span class="hero-eyebrow">${escapeHtml(eyebrow)}</span>
      <span class="hero-course">${escapeHtml(courseLabel)}</span>
      ${heroPriceRowHtml(course)}
      <span class="hero-cta">${escapeHtml(cta)}</span>
    </div>
  `;
}

// $5-or-less Youth on Course pricing takes over the headline the moment a
// course is flagged as participating and the person has the feature on
// (see Settings) — that's the number that's actually true for them, and
// their normal green fee (if entered) moves into "Details" instead of
// competing with it for attention on a card this small.
function heroPriceRowHtml(course) {
  if (!course) return '';
  const showYoc = course.youthOnCourse && yocEnabled;
  const regularPrice = formatPriceRange(course);
  const headline = showYoc ? '$5 or less' : regularPrice;
  const hasDetails = Boolean(course.priceDetails) || (showYoc && regularPrice);
  if (!headline && !course.bookingUrl) return '';

  return `
    <div class="hero-price-row">
      ${
        headline
          ? `<span class="hero-price ${showYoc ? 'hero-price--yoc' : ''}">${showYoc ? youthOnCourseIcon(13) : ''}${escapeHtml(headline)}</span>`
          : ''
      }
      ${hasDetails ? `<button type="button" class="hero-price-details-btn" data-course-id="${course.id}" onclick="event.stopPropagation()">Details</button>` : ''}
      ${
        course.bookingUrl
          ? `<a class="hero-book-btn" href="${course.bookingUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Book ${externalLinkIcon(12)}</a>`
          : ''
      }
    </div>
  `;
}

// A flat number ("$45") when there's just one, a range ("$45–65") when
// both ends were entered — never a dash-to-nowhere if only one was.
export function formatPriceRange(course) {
  if (!course) return null;
  const { priceMin, priceMax } = course;
  if (priceMin == null && priceMax == null) return null;
  if (priceMin != null && priceMax != null && priceMax !== priceMin) return `$${priceMin}–${priceMax}`;
  return `$${priceMin ?? priceMax}`;
}

// A lightweight bottom sheet — same visual recipe as the club picker in
// views/play.js (see .sheet-scrim/.sheet-panel in styles.css), reused
// here rather than duplicated since both are "a few lines of info over a
// scrim" with nothing else in common.
function openPriceDetailsSheet(course) {
  closePriceDetailsSheet();
  const showYoc = course.youthOnCourse && yocEnabled;
  const regularPrice = formatPriceRange(course);

  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  scrim.id = 'price-details-scrim';
  scrim.innerHTML = `
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <span class="sheet-title">${escapeHtml(course.name)}</span>
        <button type="button" class="icon-btn" id="price-details-close-btn" aria-label="Close">${closeIcon(16)}</button>
      </div>
      ${
        showYoc
          ? `<div class="price-details-row"><span class="price-details-label">${youthOnCourseIcon(15)} Youth on Course</span><span class="price-details-value">$5 or less</span></div>`
          : ''
      }
      ${
        regularPrice
          ? `<div class="price-details-row"><span class="price-details-label">${showYoc ? 'Regular price' : 'Price'}</span><span class="price-details-value">${escapeHtml(regularPrice)}</span></div>`
          : ''
      }
      ${course.priceDetails ? `<p class="price-details-text">${escapeHtml(course.priceDetails)}</p>` : ''}
    </div>
  `;
  document.body.appendChild(scrim);

  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) closePriceDetailsSheet();
  });
  document.getElementById('price-details-close-btn').addEventListener('click', closePriceDetailsSheet);
  document.addEventListener('keydown', onPriceSheetKeydown);
}

function onPriceSheetKeydown(e) {
  if (e.key === 'Escape') closePriceDetailsSheet();
}

function closePriceDetailsSheet() {
  document.getElementById('price-details-scrim')?.remove();
  document.removeEventListener('keydown', onPriceSheetKeydown);
}

function weatherBadgeHtml(weather) {
  if (!weather) return '';
  const direction = degToCompass(weather.windDirectionDeg);
  const windText = weather.windSpeedMph != null ? `${Math.round(weather.windSpeedMph)} mph${direction ? ` ${direction}` : ''}` : null;
  const label = `${weatherConditionLabel(weather.condition)}${windText ? `, wind ${windText}` : ''}`;
  return `
    <div class="weather-badge">
      <span aria-hidden="true">${weatherIconSvg(weather.condition, 14)}</span>
      ${windText ? `<span aria-hidden="true">${escapeHtml(windText)}</span>` : ''}
      <span class="sr-only">${escapeHtml(label)}</span>
    </div>
  `;
}

// Fetches after the tile's already showing (never blocks the initial
// render) and drops the badge into its reserved slot if it resolves —
// API-sourced course only (see api/weather.js), so a manually-added
// course's tile just stays without one rather than showing something
// wrong or a permanent loading state.
async function loadHeroWeather(course) {
  if (!course?.externalId) return;
  const weather = await getCourseWeather(course.externalId);
  if (!weather) return;
  const slot = document.getElementById('hero-weather-badge');
  if (slot) slot.outerHTML = `<span id="hero-weather-badge">${weatherBadgeHtml(weather)}</span>`;
}

function directionsButtonHtml(location) {
  if (!location) return '';
  const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
  return `
    <a class="directions-btn" href="${url}" target="_blank" rel="noopener" aria-label="Get directions" onclick="event.stopPropagation()">
      ${navigationIcon(16)}
    </a>
  `;
}

function renderRoundTile(state) {
  if (state.mode === 'continue') {
    return heroTileMarkup({
      href: `#/round/${state.roundId}/play`,
      ariaLabel: 'Continue round in progress',
      eyebrow: 'Round in progress',
      courseLabel: state.course ? state.course.name : 'Unknown course',
      cta: 'Continue round →',
      course: state.course,
    });
  }

  // "resolving" means we're actively checking for a GPS-nearer course —
  // this is a real in-progress state, not a dead end, so it gets its own
  // label rather than reusing the final "nothing found" copy. Once
  // resolveNearestAndUpdate() actually settles with nothing, `resolved`
  // is true and the tile says so explicitly instead of staying stuck on
  // "Locating you…" forever — that used to be a real, if minor, bug:
  // the exact same copy covered both "still working on it" and "gave up,
  // found nothing," which look identical to someone just reading the tile.
  const emptyEyebrow = state.reason === 'no-coverage' ? 'Outside our course coverage' : 'No nearby courses found';
  const emptyLabel = state.reason === 'no-coverage' ? 'OpenGolfAPI only covers the US right now' : 'Add a course to get started';

  return heroTileMarkup({
    href: state.course ? `#/round/new?course=${state.course.id}` : '#/round/new',
    extraClass: state.course ? '' : 'tile--hero-empty',
    ariaLabel: state.course ? `Start a new round at ${state.course.name}` : 'Find a course to play',
    eyebrow: state.course ? 'Start round' : state.resolved ? emptyEyebrow : 'Locating you…',
    courseLabel: state.course ? state.course.name : state.resolved ? emptyLabel : 'Finding nearest course…',
    cta: 'New round →',
    course: state.course,
  });
}

// Default/fallback while the true GPS-nearest course resolves (or if it
// never does): most recently played, falling back to the first course a
// user created.
export function getDefaultCourse(rounds, courses) {
  if (!courses.length) return null;
  const sorted = [...rounds].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  for (const round of sorted) {
    const course = courses.find((c) => c.id === round.courseId);
    if (course) return course;
  }
  return courses[0];
}

async function resolveNearestAndUpdate(fallbackCourse) {
  if (!('geolocation' in navigator)) {
    finalizeTile(fallbackCourse, null);
    return;
  }
  try {
    const pos = await getCurrentPosition();

    // The real bug behind "the suggested course isn't the nearest one":
    // this used to rank OpenGolfAPI results only against each other, so a
    // course you'd added manually — which can absolutely be your actual
    // nearest course — never got a chance to win. Now both sources are
    // merged into one candidate list before ranking by real calculated
    // distance (never the API's own ordering, and never a 1-result ask
    // that just assumes it was the closest).
    const localCourses = await storage.getCourses();
    const apiResults = await searchNearbyCourses({ lat: pos.lat, lng: pos.lng, limit: 30 });

    const candidates = [
      ...localCourses.filter((c) => c.location).map((c) => ({ kind: 'local', course: c, location: c.location })),
      ...apiResults.filter((c) => c.lat != null).map((c) => ({ kind: 'api', course: c, location: { lat: c.lat, lng: c.lng } })),
    ];
    if (!candidates.length) {
      // OpenGolfAPI's own coverage is the US only (its nearest-course
      // lookup resolves your state from lat/lng — see js/usStates.js). No
      // matching state at all is a real, distinct reason to say "we don't
      // cover this area" rather than the generic "nothing nearby" a US
      // location with genuinely no courses in range would get.
      const reason = statesContainingPoint(pos.lat, pos.lng).length ? 'empty' : 'no-coverage';
      finalizeTile(fallbackCourse, null, null, reason);
      return;
    }
    candidates.sort((a, b) => haversineMeters(pos, a.location) - haversineMeters(pos, b.location));

    const winner = candidates[0];
    const distanceMi = haversineMeters(pos, winner.location) / 1609.344;
    // A local course is already a real saved record; an API result needs
    // to become one (or reuse an existing one, deduped by externalId) so
    // the hero tile can link straight to "start round at this course"
    // instead of dropping the user into search again.
    const nearestCourse = winner.kind === 'local' ? winner.course : await ensureLocalCourse(winner.course, localCourses);
    finalizeTile(fallbackCourse, nearestCourse, distanceMi);
  } catch {
    finalizeTile(fallbackCourse, null); // denied, timed out, or no signal — fall back, don't hang
  }
}

// Renders the tile's final state once we know whether a GPS-nearest
// course was found: the nearest course if we got one, otherwise whatever
// fallback we already had (or the "Find a course" CTA if there was none).
function finalizeTile(fallbackCourse, nearestCourse, distanceMi, reason) {
  const slot = document.getElementById('round-tile-slot');
  if (!slot) return;

  if (!nearestCourse) {
    slot.innerHTML = renderRoundTile({ mode: 'start', course: fallbackCourse, resolved: true, reason });
    mountHeroMap(fallbackCourse?.location || null);
    loadHeroWeather(fallbackCourse);
    return;
  }

  // The distance is shown right on the tile (not just implied by the
  // "nearest" label) specifically so a wrong-looking suggestion is
  // immediately checkable against a map — "3.1 mi away" you can verify
  // yourself, "nearest course" alone you just have to trust.
  const eyebrow = distanceMi != null ? `Nearest course · ${formatMiles(distanceMi)} away` : 'Nearest course';

  slot.innerHTML = heroTileMarkup({
    href: `#/round/new?course=${nearestCourse.id}`,
    ariaLabel: `Start a new round at ${nearestCourse.name}, the nearest course`,
    eyebrow,
    courseLabel: nearestCourse.name,
    cta: 'New round →',
    course: nearestCourse,
  });
  mountHeroMap(nearestCourse.location);
  loadHeroWeather(nearestCourse);
}

// A non-interactive satellite snapshot behind the hero tile's text —
// stands in for a real course photo. Disabled dragging/zoom/etc. since
// it's decorative; the whole tile is still one big tap target.
function mountHeroMap(loc) {
  const container = document.getElementById('hero-tile-map');
  if (!container || !loc || typeof L === 'undefined') return;
  try {
    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false,
    }).setView([loc.lat, loc.lng], 16);
    L.tileLayer(SATELLITE_TILE_URL, { maxZoom: 19, attribution: SATELLITE_ATTRIBUTION }).addTo(map);
  } catch (err) {
    console.error('Hero map render failed:', err);
  }
}

// --- Tile 2: a handful of mini stats; tapping opens the full stats screen.

function renderStatsTile(rounds, courses) {
  const stats = computeStats(rounds, courses);

  if (!stats.roundsPlayed) {
    return tile({
      href: '#/stats',
      extraClass: 'tile--stats',
      ariaLabel: 'Stats',
      innerHtml: `<span class="stats-tile-empty">Finish a round to see stats here</span>`,
    });
  }

  const chips = [
    { value: String(stats.roundsPlayed), label: 'Rounds' },
    { value: toParText(round1(stats.avgToPar)), label: 'Avg to par' },
  ];
  if (stats.best) chips.push({ value: toParText(stats.best.toPar), label: 'Best round' });
  if (stats.avgPuttsPerHole != null) chips.push({ value: String(round1(stats.avgPuttsPerHole)), label: 'Putts/hole' });

  return tile({
    href: '#/stats',
    extraClass: 'tile--stats',
    ariaLabel: 'View full stats',
    innerHtml: `
      <div class="mini-stat-grid">
        ${chips
          .slice(0, 4)
          .map((c) => `<div class="mini-stat"><span class="mini-stat-value">${c.value}</span><span class="mini-stat-label">${c.label}</span></div>`)
          .join('')}
      </div>
    `,
  });
}

// --- Tile 3: clubs/bags preview; tapping opens bag management.

function renderBagsTile(bags) {
  return tile({
    href: '#/bags',
    extraClass: 'tile--bags',
    ariaLabel: 'Manage clubs and bags',
    innerHtml: `
      <div class="bags-tile-header">
        <span class="bags-tile-label">Clubs</span>
        <span class="bags-tile-chevron">${chevronIcon(16)}</span>
      </div>
      <div class="bags-tile-list">
        ${bags
          .map(
            (b) => `
          <div class="bags-tile-bag">
            <span class="bags-tile-bag-name">${escapeHtml(b.name)}</span>
            <span class="bags-tile-bag-clubs">${b.clubs.length ? b.clubs.map((c) => escapeHtml(c.name)).join(', ') : 'No clubs yet'}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `,
  });
}

// --- Tile 4: settings.

function renderSettingsTile() {
  return tile({
    href: '#/settings',
    extraClass: 'tile--settings',
    ariaLabel: 'Settings',
    innerHtml: `<span class="settings-tile-label">Settings</span><span class="settings-tile-chevron">${chevronIcon(16)}</span>`,
  });
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// --- Shared helpers used by other views (courses, round, summary, stats).

export function totalForRound(round, course) {
  const played = round.holeScores.filter((h) => h.strokes != null);
  const strokes = played.reduce((sum, h) => sum + h.strokes, 0);
  const par = course
    ? played.reduce((sum, h) => {
        const holeDef = course.holes.find((c) => c.number === h.holeNumber);
        return sum + (holeDef ? holeDef.par : 0);
      }, 0)
    : 0;
  return { strokes, par, toPar: strokes - par };
}

export function toParText(toPar) {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

function formatMiles(mi) {
  if (mi < 0.1) return 'under 0.1 mi';
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
