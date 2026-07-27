import { storage } from '../storage.js';
import { makeCourse } from '../models.js';
import { escapeHtml } from './home.js';

export async function renderCourses(outlet) {
  const courses = await storage.getCourses();
  outlet.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>Courses</h2>
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
      <div class="panel-header"><h2>Add course</h2></div>
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
        <div id="par-grid" class="par-grid"></div>
        <button type="submit" class="btn btn-primary btn-block">Save course</button>
      </form>
    </section>
  `;

  const form = document.getElementById('course-form');
  const parGrid = document.getElementById('par-grid');
  const numHolesSelect = form.numHoles;

  function renderParInputs() {
    const n = Number(numHolesSelect.value);
    parGrid.innerHTML = Array.from({ length: n }, (_, i) => i + 1)
      .map(
        (num) => `
      <label class="par-field">
        <span>${num}</span>
        <input type="number" name="par-${num}" min="3" max="6" value="4" inputmode="numeric" required />
      </label>
    `
      )
      .join('');
  }
  numHolesSelect.addEventListener('change', renderParInputs);
  renderParInputs();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const numHoles = Number(data.get('numHoles'));
    const holes = Array.from({ length: numHoles }, (_, i) => {
      const num = i + 1;
      return { number: num, par: Number(data.get(`par-${num}`)) || 4 };
    });
    const name = String(data.get('name') || '').trim();
    if (!name) return;
    const course = makeCourse({ name, numHoles, holes });
    await storage.saveCourse(course);
    location.hash = '#/courses';
  });
}
