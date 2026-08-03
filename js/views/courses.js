import { storage } from '../storage.js';
import { makeCourse } from '../models.js';
import { escapeHtml } from './home.js';
import { getCurrentPosition } from '../geo.js';
import { getCourseTees, getCourseDifficulty, getCourseDaylight } from '../api/opengolfapi.js';

const MIN_PAR = 3;
const MAX_PAR = 6;
const DEFAULT_PAR = 4;

export async function renderCourses(outlet) {
  const courses = await storage.getCourses();
  outlet.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <a class="btn btn-primary" href="#/courses/new">Add course</a>
      </div>
      ${courses.length ? renderList(courses) : `<p class="empty-state">No courses yet.<br /><a href="#/courses/new">Add your first course →</a></p>`}
    </section>
  `;

  document.querySelectorAll('.delete-course-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { id, name } = btn.dataset;
      const confirmed = window.confirm(`Delete "${name}"? Rounds already played there stay in your history, but you won't be able to start a new one here until you add it again.`);
      if (!confirmed) return;
      await storage.deleteCourse(id);
      renderCourses(outlet);
    });
  });
}

function renderList(courses) {
  return `<ul class="plain-list">
    ${courses
      .map(
        (c) => `
      <li class="list-row">
        <a class="list-row-link" href="#/courses/${c.id}/edit">
          <span class="list-row-name">${escapeHtml(c.name)}</span>
          <span class="list-row-meta">${c.numHoles} holes · par ${c.holes.reduce((s, h) => s + h.par, 0)}</span>
        </a>
        <button type="button" class="icon-btn delete-course-btn" data-id="${c.id}" data-name="${escapeHtml(c.name)}" aria-label="Delete ${escapeHtml(c.name)}">${trashIcon()}</button>
      </li>
    `
      )
      .join('')}
  </ul>`;
}

function trashIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>`;
}

export async function renderNewCourse(outlet) {
  renderCourseForm(outlet, { existing: null });
}

export async function renderEditCourse(outlet, params) {
  const existing = await storage.getCourse(params.id);
  if (!existing) {
    outlet.innerHTML = `<p class="empty-state">Course not found. <a href="#/courses">Back to courses</a></p>`;
    return;
  }
  renderCourseForm(outlet, { existing });
  if (existing.externalId) loadCourseInfo(existing.externalId); // never blocks the editable form itself
}

// Tee ratings/slope, a difficulty percentile vs. nearby courses, and
// today's sunrise/sunset + suggested tee-time windows — all free from
// OpenGolfAPI, all extra context on top of the editable fields above, so
// this loads into its own slot after the form's already usable rather
// than delaying it. None of these response shapes are pinned down in
// OpenGolfAPI's spec beyond a one-line description, so every extractor
// below is deliberately defensive (checks a few plausible field-name
// spellings) and any section it can't make sense of is just omitted,
// same philosophy as the weather forecast-text handling in api/weather.js.
async function loadCourseInfo(externalId) {
  const [tees, difficulty, daylight] = await Promise.all([getCourseTees(externalId), getCourseDifficulty(externalId), getCourseDaylight(externalId)]);
  const sections = [teesSectionHtml(tees), difficultySectionHtml(difficulty), daylightSectionHtml(daylight)].filter(Boolean);
  const slot = document.getElementById('course-info-slot');
  if (slot && sections.length) slot.innerHTML = sections.join('');
}

function teesSectionHtml(tees) {
  if (!Array.isArray(tees) || !tees.length) return null;
  const rows = tees
    .map((t) => ({
      name: t.name ?? t.tee_name ?? t.tee_color ?? t.color ?? 'Tee',
      rating: t.rating ?? t.course_rating ?? null,
      slope: t.slope ?? t.slope_rating ?? null,
      yardage: t.yardage ?? t.total_yardage ?? t.distance_yards ?? t.yards ?? null,
    }))
    .filter((t) => t.rating != null || t.slope != null || t.yardage != null);
  if (!rows.length) return null;

  return `
    <div class="course-info-section">
      <div class="field-group-label">Tees</div>
      <div class="tee-table">
        <div class="tee-table-row tee-table-head">
          <span>Tee</span><span>Rating</span><span>Slope</span><span>Yardage</span>
        </div>
        ${rows
          .map(
            (t) => `
          <div class="tee-table-row">
            <span>${escapeHtml(String(t.name))}</span>
            <span>${t.rating != null ? Number(t.rating).toFixed(1) : '–'}</span>
            <span>${t.slope ?? '–'}</span>
            <span>${t.yardage != null ? Number(t.yardage).toLocaleString() : '–'}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function difficultySectionHtml(difficulty) {
  if (!difficulty) return null;
  const percentile = difficulty.percentile ?? difficulty.difficulty_percentile ?? difficulty.percentile_rank ?? null;
  if (typeof percentile !== 'number') return null;
  return `
    <div class="course-info-section">
      <div class="field-group-label">Difficulty</div>
      <p class="course-info-text">Harder than ${Math.round(percentile)}% of nearby courses.</p>
    </div>
  `;
}

function daylightSectionHtml(daylight) {
  if (!daylight) return null;
  const sunrise = formatClockTime(daylight.sunrise ?? daylight.sunrise_time);
  const sunset = formatClockTime(daylight.sunset ?? daylight.sunset_time);
  const windows = daylight.optimal_tee_times ?? daylight.best_tee_windows ?? daylight.tee_time_windows ?? null;

  if (!sunrise && !sunset && !Array.isArray(windows)) return null;

  return `
    <div class="course-info-section">
      <div class="field-group-label">Daylight today</div>
      ${sunrise || sunset ? `<p class="course-info-text">${[sunrise && `Sunrise ${sunrise}`, sunset && `Sunset ${sunset}`].filter(Boolean).join(' · ')}</p>` : ''}
      ${
        Array.isArray(windows) && windows.length
          ? `<p class="course-info-text">Best tee times: ${windows
              .map((w) => (typeof w === 'string' ? w : [formatClockTime(w.start), formatClockTime(w.end)].filter(Boolean).join('–')))
              .filter(Boolean)
              .join(', ')}</p>`
          : ''
      }
    </div>
  `;
}

function formatClockTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return typeof value === 'string' ? value : null; // e.g. an already-formatted "6:42 AM" string
}

// Shared by both the "add course" and "edit course" screens — same form,
// just pre-filled (and saving into the existing record) when editing.
function renderCourseForm(outlet, { existing }) {
  const isEdit = Boolean(existing);

  outlet.innerHTML = `
    <section class="panel">
      ${existing?.externalId ? `<div id="course-info-slot"></div>` : ''}
      <form id="course-form" class="form">
        <label class="field">
          <span>Course name</span>
          <input type="text" name="name" required placeholder="e.g. Pebble Creek" autocomplete="off" value="${existing ? escapeHtml(existing.name) : ''}" />
        </label>
        <label class="field">
          <span>Number of holes</span>
          <select name="numHoles">
            <option value="9" ${existing?.numHoles === 9 ? 'selected' : ''}>9</option>
            <option value="18" ${!existing || existing.numHoles === 18 ? 'selected' : ''}>18</option>
          </select>
        </label>
        <div class="field-group-label">Par per hole</div>
        <div id="par-list" class="par-list"></div>
        <button type="submit" class="btn btn-primary btn-block">Save course</button>
        ${isEdit ? `<p class="field-hint">Reducing hole count drops the removed holes' saved mapping and shot data — scores from finished rounds already played there are unaffected.</p>` : ''}
      </form>
    </section>
  `;

  const form = document.getElementById('course-form');
  const parList = document.getElementById('par-list');
  const numHolesSelect = form.querySelector('select[name="numHoles"]');

  function parFor(num) {
    return existing?.holes.find((h) => h.number === num)?.par ?? DEFAULT_PAR;
  }

  function renderParRows() {
    const n = Number(numHolesSelect.value);
    parList.innerHTML = Array.from({ length: n }, (_, i) => i + 1)
      .map((num) => {
        const par = parFor(num);
        return `
      <div class="par-row">
        <span class="par-row-hole">Hole ${num}</span>
        <div class="par-row-stepper">
          <button type="button" class="stepper-btn stepper-btn-sm" data-hole="${num}" data-dir="-1" aria-label="Decrease par for hole ${num}">−</button>
          <span class="par-row-value" id="par-value-${num}">${par}</span>
          <button type="button" class="stepper-btn stepper-btn-sm" data-hole="${num}" data-dir="1" aria-label="Increase par for hole ${num}">+</button>
        </div>
        <input type="hidden" name="par-${num}" value="${par}" />
      </div>
    `;
      })
      .join('');
  }

  // Delegated so it survives renderParRows() re-running when hole count changes.
  parList.addEventListener('click', (e) => {
    const btn = e.target.closest('.stepper-btn');
    if (!btn) return;
    const hole = btn.dataset.hole;
    const dir = Number(btn.dataset.dir);
    const hiddenInput = form.querySelector(`input[name="par-${hole}"]`);
    const valueEl = document.getElementById(`par-value-${hole}`);
    const next = Math.min(MAX_PAR, Math.max(MIN_PAR, Number(hiddenInput.value) + dir));
    hiddenInput.value = String(next);
    valueEl.textContent = String(next);
  });

  numHolesSelect.addEventListener('change', renderParRows);
  renderParRows();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const numHoles = Number(data.get('numHoles'));
    const name = String(data.get('name') || '').trim();
    if (!name) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    // Editing: keep each surviving hole's tee/green mapping and identity
    // (id, source, externalId, location) — only name/count/par are
    // actually editable here. Par typed into this form always counts as
    // confirmed, same as a brand-new manual course, since the person
    // just explicitly set it by hand — true whether the course
    // originally came from OpenGolfAPI or was added manually.
    const holes = Array.from({ length: numHoles }, (_, i) => {
      const num = i + 1;
      const par = Number(data.get(`par-${num}`)) || DEFAULT_PAR;
      const prior = existing?.holes.find((h) => h.number === num);
      return { number: num, par, parConfirmed: true, tee: prior?.tee ?? null, green: prior?.green ?? null };
    });

    if (existing) {
      existing.name = name;
      existing.numHoles = numHoles;
      existing.holes = holes;
      await storage.saveCourse(existing);
      location.hash = '#/courses';
      return;
    }

    // Best-effort: assumes you're adding this course while at or near it,
    // so it can show up as a "nearest course" suggestion later. If location
    // isn't available or is denied, the course still saves fine — it just
    // won't be suggested by proximity until edited.
    let courseLocation = null;
    try {
      const pos = await getCurrentPosition();
      courseLocation = { lat: pos.lat, lng: pos.lng };
    } catch {
      // no location — fine, continue without it
    }

    const course = makeCourse({ name, numHoles, holes, location: courseLocation });
    await storage.saveCourse(course);
    location.hash = '#/courses';
  });
}
