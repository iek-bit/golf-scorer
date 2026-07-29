import { storage } from '../storage.js';
import { computeStats } from '../stats.js';
import { tile } from '../components/tile.js';
import { searchCourses } from '../api/opengolfapi.js';
import { getCurrentPosition } from '../geo.js';
import { SATELLITE_TILE_URL, SATELLITE_ATTRIBUTION } from '../mapConfig.js';

export async function renderHome(outlet) {
  const [rounds, courses] = await Promise.all([storage.getRounds(), storage.getCourses()]);
  const heroState = computeHeroState(rounds, courses);

  outlet.innerHTML = `
    <div class="tile-stack">
      <div id="round-tile-slot">${renderRoundTile(heroState)}</div>
      ${renderStatsTile(rounds, courses)}
      ${renderSettingsTile()}
    </div>
  `;

  mountHeroMap(heroState.course?.location || null);

  // Actively resolve the true GPS-nearest course (this can prompt for
  // location permission — that's intentional here, since finding the
  // nearest course is the whole point of the button). Never runs while a
  // round is in progress; "Continue round" always wins.
  if (heroState.mode === 'start') resolveNearestAndUpdate();
}

// --- Tile 1: start a new round, or resume one already in progress.

function computeHeroState(rounds, courses) {
  const inProgress = rounds.find((r) => !r.completedAt);
  if (inProgress) {
    return { mode: 'continue', course: courses.find((c) => c.id === inProgress.courseId) || null, roundId: inProgress.id };
  }
  if (courses.length) {
    return { mode: 'start', course: getDefaultCourse(rounds, courses), label: 'Start round' };
  }
  return { mode: 'start', course: null, label: 'Start round' };
}

function renderRoundTile(state) {
  if (state.mode === 'continue') {
    return tile({
      href: `#/round/${state.roundId}/play`,
      extraClass: 'tile--hero',
      ariaLabel: 'Continue round in progress',
      innerHtml: `
        <div id="hero-tile-map" class="tile-map"></div>
        <span class="hero-eyebrow">Round in progress</span>
        <span class="hero-course">${escapeHtml(state.course ? state.course.name : 'Unknown course')}</span>
        <span class="hero-cta">Continue round →</span>
      `,
    });
  }

  return tile({
    href: '#/round/new',
    extraClass: `tile--hero ${state.course ? '' : 'tile--hero-empty'}`,
    ariaLabel: state.course ? `Start a new round at ${state.course.name}` : 'Find a course to play',
    innerHtml: `
      <div id="hero-tile-map" class="tile-map"></div>
      <span class="hero-eyebrow">Start round</span>
      <span class="hero-course">${escapeHtml(state.course ? state.course.name : 'Find a course')}</span>
      <span class="hero-cta">New round →</span>
    `,
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

async function resolveNearestAndUpdate() {
  if (!('geolocation' in navigator)) return;
  try {
    const pos = await getCurrentPosition();
    const [nearest] = await searchCourses({ lat: pos.lat, lng: pos.lng, radiusMi: 25, limit: 1 });
    if (!nearest) return;

    const localCourses = await storage.getCourses();
    const known = localCourses.find((c) => c.externalId === nearest.externalId);
    const slot = document.getElementById('round-tile-slot');
    if (!slot) return; // user navigated away before this resolved

    const loc = known?.location || (nearest.lat != null ? { lat: nearest.lat, lng: nearest.lng } : null);
    slot.innerHTML = tile({
      href: '#/round/new',
      extraClass: 'tile--hero',
      ariaLabel: `Start a new round at ${nearest.name}, the nearest course`,
      innerHtml: `
        <div id="hero-tile-map" class="tile-map"></div>
        <span class="hero-eyebrow">Nearest course</span>
        <span class="hero-course">${escapeHtml(known ? known.name : nearest.name)}</span>
        <span class="hero-cta">New round →</span>
      `,
    });
    mountHeroMap(loc);
  } catch {
    // Silent — the fallback tile already rendered.
  }
}

// A non-interactive satellite snapshot behind the hero tile's text —
// stands in for a real course photo. Disabled dragging/zoom/etc. since
// it's decorative; the whole tile is still one big tap target.
function mountHeroMap(loc) {
  const container = document.getElementById('hero-tile-map');
  if (!container || !loc || typeof L === 'undefined') return;
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

// --- Tile 3: settings.

function renderSettingsTile() {
  return tile({
    href: '#/settings',
    extraClass: 'tile--settings',
    ariaLabel: 'Settings',
    innerHtml: `<span class="settings-tile-label">Settings</span><span class="settings-tile-chevron">›</span>`,
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

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
