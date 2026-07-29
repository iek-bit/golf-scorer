import { storage } from '../storage.js';
import { makeCourse } from '../models.js';
import { escapeHtml } from './home.js';
import { getCurrentPosition } from '../geo.js';

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
}

function renderList(courses) {
  return `<ul class="plain-list">
    ${courses
      .map(
        (c) => `
      <li class="list-row">
        <span>${escapeHtml(c.name)}</span>
        <span class="list-row-meta">${c.numHoles} holes · par ${c.holes.reduce((s, h) => s + h.par, 0)}</span>
      </li>
    `
      )
      .join('')}
  </ul>`;
}

export async function renderNewCourse(outlet) {
  outlet.innerHTML = `
    <section class="panel">
      <form id="course-form" class="form">
        <label class="field">
          <span>Course name</span>
          <input type="text" name="name" required placeholder="e.g. Pebble Creek" autocomplete="off" />
        </label>
        <label class="field">
          <span>Number of holes</span>
          <select name="numHoles">
            <option value="9">9</option>
            <option value="18" selected>18</option>
          </select>
        </label>
        <div class="field-group-label">Par per hole</div>
        <div id="par-list" class="par-list"></div>
        <button type="submit" class="btn btn-primary btn-block">Save course</button>
      </form>
    </section>
  `;

  const form = document.getElementById('course-form');
  const parList = document.getElementById('par-list');
  const numHolesSelect = form.querySelector('select[name="numHoles"]');

  function renderParRows() {
    const n = Number(numHolesSelect.value);
    parList.innerHTML = Array.from({ length: n }, (_, i) => i + 1)
      .map(
        (num) => `
      <div class="par-row">
        <span class="par-row-hole">Hole ${num}</span>
        <div class="par-row-stepper">
          <button type="button" class="stepper-btn stepper-btn-sm" data-hole="${num}" data-dir="-1" aria-label="Decrease par for hole ${num}">−</button>
          <span class="par-row-value" id="par-value-${num}">${DEFAULT_PAR}</span>
          <button type="button" class="stepper-btn stepper-btn-sm" data-hole="${num}" data-dir="1" aria-label="Increase par for hole ${num}">+</button>
        </div>
        <input type="hidden" name="par-${num}" value="${DEFAULT_PAR}" />
      </div>
    `
      )
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
    const holes = Array.from({ length: numHoles }, (_, i) => {
      const num = i + 1;
      return { number: num, par: Number(data.get(`par-${num}`)) || DEFAULT_PAR };
    });
    const name = String(data.get('name') || '').trim();
    if (!name) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    // Best-effort: assumes you're adding this course while at or near it,
    // so it can show up as a "nearest course" suggestion later. If location
    // isn't available or is denied, the course still saves fine — it just
    // won't be suggested by proximity until edited (not yet supported).
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
