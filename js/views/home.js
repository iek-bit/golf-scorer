import { storage } from '../storage.js';
import { computeStats } from '../stats.js';
import { tile } from '../components/tile.js';
import { searchCourses } from '../api/opengolfapi.js';
import { getCurrentPosition } from '../geo.js';

export async function renderHome(outlet) {
  const [rounds, courses] = await Promise.all([storage.getRounds(), storage.getCourses()]);

  outlet.innerHTML = `
    <div class="tile-stack">
      <div id="round-tile-slot">${renderRoundTile(rounds, courses)}</div>
      ${renderStatsTile(rounds, courses)}
      ${renderSettingsTile()}
    </div>
  `;

  maybeUpgradeToNearest(rounds, courses);
}

// If geolocation permission has already been granted (we never prompt for
// it here — that only happens when the user taps something that needs
// it), quietly swap the hero tile for the true GPS-nearest course. Any
// failure just leaves the "most recently played" fallback tile in place.
async function maybeUpgradeToNearest(rounds, courses) {
  if (rounds.some((r) => !r.completedAt)) return; // a round is in progress — nothing to upgrade
  if (!('permissions' in navigator) || !('geolocation' in navigator)) return;

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state !== 'granted') return;

    const pos = await getCurrentPosition();
    const [nearest] = await searchCourses({ lat: pos.lat, lng: pos.lng, radiusMi: 25, limit: 1 });
    if (!nearest) return;

    const known = courses.find((c) => c.externalId === nearest.externalId);
    const slot = document.getElementById('round-tile-slot');
    if (!slot) return; // user navigated away before this resolved

    slot.innerHTML = tile({
      href: '#/round/new',
      extraClass: 'tile--hero',
      ariaLabel: `Start a new round at ${nearest.name}, the nearest course`,
      innerHtml: `
        <span class="hero-eyebrow">Nearest course</span>
        <span class="hero-course">${escapeHtml(known ? known.name : nearest.name)}</span>
        <span class="hero-cta">New round →</span>
      `,
    });
  } catch {
    // Silent — the fallback tile already rendered.
  }
}

// --- Tile 1: start a new round, or resume one already in progress.
// Shows the most recently played course by default; maybeUpgradeToNearest
// (above) silently swaps this for the true GPS-nearest course when
// location permission is already granted. Background art is still a
// stand-in for a real course photo — that needs per-course photos, which
// aren't part of this pass.

function renderRoundTile(rounds, courses) {
  const inProgress = rounds.find((r) => !r.completedAt);

  if (inProgress) {
    const course = courses.find((c) => c.id === inProgress.courseId);
    return tile({
      href: `#/round/${inProgress.id}/play`,
      extraClass: 'tile--hero',
      ariaLabel: 'Continue round in progress',
      innerHtml: `
        <span class="hero-eyebrow">Round in progress</span>
        <span class="hero-course">${escapeHtml(course ? course.name : 'Unknown course')}</span>
        <span class="hero-cta">Continue round →</span>
      `,
    });
  }

  if (!courses.length) {
    return tile({
      href: '#/courses/new',
      extraClass: 'tile--hero tile--hero-empty',
      ariaLabel: 'Add a course to get started',
      innerHtml: `
        <span class="hero-eyebrow">Get started</span>
        <span class="hero-course">Add your first course</span>
        <span class="hero-cta">Add course →</span>
      `,
    });
  }

  const defaultCourse = getDefaultCourse(rounds, courses);
  return tile({
    href: '#/round/new',
    extraClass: 'tile--hero',
    ariaLabel: `Start a new round at ${defaultCourse.name}`,
    innerHtml: `
      <span class="hero-eyebrow">Start round</span>
      <span class="hero-course">${escapeHtml(defaultCourse.name)}</span>
      <span class="hero-cta">New round →</span>
    `,
  });
}

// Default/fallback when we haven't (yet, or can't) confirm the true
// GPS-nearest course: most recently played, falling back to the first
// course a user created.
export function getDefaultCourse(rounds, courses) {
  if (!courses.length) return null;
  const sorted = [...rounds].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  for (const round of sorted) {
    const course = courses.find((c) => c.id === round.courseId);
    if (course) return course;
  }
  return courses[0];
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
