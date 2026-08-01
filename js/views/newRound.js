import { storage } from '../storage.js';
import { makeRound } from '../models.js';
import { escapeHtml } from './home.js';
import { searchCourses, searchNearbyCourses } from '../api/opengolfapi.js';
import { getCurrentPosition, sortByDistance } from '../geo.js';
import { ensureLocalCourse } from '../courseResolve.js';

let searchDebounce = null;

// `params.course` is a local course id, passed via `#/round/new?course=<id>`
// by the home screen's hero tile once it's resolved a suggested/nearest
// course — see resolveNearestAndUpdate() in home.js. When present, this
// screen skips straight to the holes step with that course preselected
// (and clearly labeled as a suggestion, with an easy way to change it)
// instead of dropping the user into a blank searchable list that doesn't
// even show the course that was just suggested.
export async function renderNewRound(outlet, params = {}) {
  const localCourses = await storage.getCourses();
  const suggested = params.course ? localCourses.find((c) => c.id === params.course) : null;

  let step = suggested ? 'holes' : 'course'; // 'course' | 'holes'
  let selectedCourse = suggested || null;
  let viaSuggestion = Boolean(suggested);
  let apiResults = [];
  let resultsLabel = ''; // e.g. "Near you" or 'Results for "pebble"'
  let searchStatus = 'idle'; // idle | loading | empty
  let locationStatus = 'loading'; // loading | idle | error — starts loading, see loadNearby() below
  let requestId = 0; // guards against a slow response clobbering a newer one
  let userPosition = null; // cached once known — reused to sort every result list "nearest first"

  render();
  loadNearby(); // auto-run on open — no button tap needed, even past the course step

  function render() {
    step === 'holes' ? renderHolesStep() : renderCourseStep();
  }

  // ---- Step 1: find a course ----

  function renderCourseStep() {
    outlet.innerHTML = `
      <section class="panel">
        <input type="text" id="course-search" class="search-input" placeholder="Search courses by name" autocomplete="off" />

        ${locationStatus === 'error' ? `<p class="field-hint">Couldn't get your location — <button type="button" class="text-btn" id="retry-location-btn">try again</button>, or search by name.</p>` : ''}

        <div id="search-results">${renderApiResults()}</div>

        ${renderLocalCourses()}

        <p class="empty-state small-empty-state">Can't find it? <a href="#/courses/new">Add a course manually</a></p>
      </section>
    `;

    document.getElementById('course-search').addEventListener('input', onSearchInput);
    const retryBtn = document.getElementById('retry-location-btn');
    if (retryBtn) retryBtn.addEventListener('click', loadNearby);
    attachCourseCardHandlers();
  }

  function renderApiResults() {
    if (locationStatus === 'loading' && searchStatus !== 'loading' && !apiResults.length) {
      return `<p class="field-hint">Finding courses near you…</p>`;
    }
    if (searchStatus === 'loading') return `<p class="field-hint">Searching…</p>`;
    if (searchStatus === 'empty') return `<p class="field-hint">No matches — try a different search, or add it manually below.</p>`;
    if (!apiResults.length) return '';
    return `
      <div class="field-group-label">${escapeHtml(resultsLabel)}</div>
      <ul class="course-card-list">
        ${apiResults.map((c, i) => renderCourseCard(c, `api-${i}`, c.city && c.state ? `${c.city}, ${c.state}` : '')).join('')}
      </ul>
    `;
  }

  function renderLocalCourses() {
    if (!localCourses.length) return '';
    const sorted = sortByDistance(userPosition, localCourses, (c) => c.location);
    return `
      <div class="field-group-label">Your courses</div>
      <ul class="course-card-list">
        ${sorted.map((c) => renderCourseCard(c, `local-${localCourses.indexOf(c)}`, `${c.numHoles} holes`)).join('')}
      </ul>
    `;
  }

  function renderCourseCard(course, key, subtitle) {
    return `
      <li>
        <button type="button" class="course-card" data-key="${key}">
          <span class="course-card-name">${escapeHtml(course.name)}</span>
          ${subtitle ? `<span class="course-card-meta">${escapeHtml(subtitle)}</span>` : ''}
        </button>
      </li>
    `;
  }

  function attachCourseCardHandlers() {
    document.querySelectorAll('.course-card').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const [kind, idxStr] = btn.dataset.key.split('-');
        const idx = Number(idxStr);
        if (kind === 'local') {
          selectedCourse = localCourses[idx];
        } else {
          selectedCourse = await ensureLocalCourse(apiResults[idx], localCourses);
        }
        viaSuggestion = false; // manually picked — the "suggested" label no longer applies
        step = 'holes';
        render();
      });
    });
  }

  function onSearchInput(e) {
    const q = e.target.value.trim();
    clearTimeout(searchDebounce);
    if (!q) {
      apiResults = [];
      searchStatus = 'idle';
      document.getElementById('search-results').innerHTML = renderApiResults();
      return;
    }
    searchDebounce = setTimeout(async () => {
      const myRequest = ++requestId;
      searchStatus = 'loading';
      document.getElementById('search-results').innerHTML = renderApiResults();
      // Pass position along if we already have it (from loadNearby, below)
      // so results can be ranked with distance in mind, not just text
      // match — and sort client-side regardless, so "nearest first" is
      // guaranteed even if the API doesn't blend the two itself.
      const results = await searchCourses(userPosition ? { q, lat: userPosition.lat, lng: userPosition.lng } : { q });
      if (myRequest !== requestId) return; // a newer search/location request superseded this one
      apiResults = sortByDistance(userPosition, results, (c) => (c.lat != null ? { lat: c.lat, lng: c.lng } : null));
      resultsLabel = `Results for "${q}"`;
      searchStatus = results.length ? 'idle' : 'empty';
      document.getElementById('search-results').innerHTML = renderApiResults();
      attachCourseCardHandlers();
    }, 400);
  }

  async function loadNearby() {
    const myRequest = ++requestId;
    locationStatus = 'loading';
    render();
    try {
      const pos = await getCurrentPosition();
      userPosition = pos;
      const results = await searchNearbyCourses({ lat: pos.lat, lng: pos.lng });
      if (myRequest !== requestId) return; // the user searched by name before this resolved
      apiResults = sortByDistance(userPosition, results, (c) => (c.lat != null ? { lat: c.lat, lng: c.lng } : null));
      resultsLabel = 'Near you';
      searchStatus = results.length ? 'idle' : 'empty';
      locationStatus = 'idle';
    } catch {
      if (myRequest !== requestId) return;
      locationStatus = 'error';
    }
    render();
  }

  // ---- Step 2: holes to play ----

  function renderHolesStep() {
    const opts =
      selectedCourse.numHoles === 18
        ? [
            { value: '18', label: 'All 18' },
            { value: 'front9', label: 'Front 9' },
            { value: 'back9', label: 'Back 9' },
          ]
        : [{ value: '9', label: 'All 9' }];

    outlet.innerHTML = `
      <section class="panel">
        ${
          viaSuggestion
            ? `<div class="suggested-course-banner">
                 <div>
                   <span class="suggested-course-eyebrow">Nearest course</span>
                   <span class="field-group-label">${escapeHtml(selectedCourse.name)}</span>
                 </div>
                 <button type="button" class="text-btn" id="change-course-btn">Not this one?</button>
               </div>`
            : `<div class="field-group-label">${escapeHtml(selectedCourse.name)}</div>`
        }
        <form id="round-form" class="form">
          <label class="field">
            <span>Holes to play</span>
            <select name="holesPlayed">
              ${opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
          </label>
          <button type="submit" class="btn btn-primary btn-block">Start round</button>
        </form>
        ${!viaSuggestion ? `<button type="button" class="btn btn-secondary btn-block" id="change-course-btn">Choose a different course</button>` : ''}
      </section>
    `;

    document.getElementById('change-course-btn').addEventListener('click', () => {
      step = 'course';
      render();
    });

    document.getElementById('round-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      const holesPlayed = data.get('holesPlayed');
      const holeNumbers = holeNumbersFor(holesPlayed);
      const round = makeRound({ courseId: selectedCourse.id, holesPlayed, holeNumbers });
      await storage.saveRound(round);
      location.hash = `#/round/${round.id}/play`;
    });
  }
}

function holeNumbersFor(holesPlayed) {
  if (holesPlayed === '9' || holesPlayed === '18') {
    return Array.from({ length: Number(holesPlayed) }, (_, i) => i + 1);
  }
  if (holesPlayed === 'front9') return Array.from({ length: 9 }, (_, i) => i + 1);
  if (holesPlayed === 'back9') return Array.from({ length: 9 }, (_, i) => i + 10);
  return [];
}
