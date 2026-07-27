import { storage } from '../storage.js';
import { makeRound } from '../models.js';
import { escapeHtml, getDefaultCourse } from './home.js';

export async function renderNewRound(outlet) {
  const [courses, rounds] = await Promise.all([storage.getCourses(), storage.getRounds()]);

  if (!courses.length) {
    outlet.innerHTML = `
      <section class="panel">
        <p class="empty-state">You need a course first.<br /><a href="#/courses/new">Add a course →</a></p>
      </section>
    `;
    return;
  }

  const defaultCourse = getDefaultCourse(rounds, courses);
  const orderedCourses = [defaultCourse, ...courses.filter((c) => c.id !== defaultCourse.id)];

  outlet.innerHTML = `
    <section class="panel">
      <form id="round-form" class="form">
        <label class="field">
          <span>Course</span>
          <select name="courseId">
            ${orderedCourses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${c.numHoles} holes)</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Holes to play</span>
          <select name="holesPlayed" id="holes-played"></select>
        </label>
        <button type="submit" class="btn btn-primary btn-block">Start round</button>
      </form>
    </section>
  `;

  const form = document.getElementById('round-form');
  const courseSelect = form.courseId;
  const holesPlayedSelect = document.getElementById('holes-played');

  function updateHolesOptions() {
    const course = courses.find((c) => c.id === courseSelect.value);
    const opts =
      course.numHoles === 18
        ? [
            { value: '18', label: 'All 18' },
            { value: 'front9', label: 'Front 9' },
            { value: 'back9', label: 'Back 9' },
          ]
        : [{ value: '9', label: 'All 9' }];
    holesPlayedSelect.innerHTML = opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  }
  courseSelect.addEventListener('change', updateHolesOptions);
  updateHolesOptions();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const courseId = data.get('courseId');
    const holesPlayed = data.get('holesPlayed');
    const holeNumbers = holeNumbersFor(holesPlayed);
    const round = makeRound({ courseId, holesPlayed, holeNumbers });
    await storage.saveRound(round);
    location.hash = `#/round/${round.id}/play`;
  });
}

function holeNumbersFor(holesPlayed) {
  if (holesPlayed === '9' || holesPlayed === '18') {
    return Array.from({ length: Number(holesPlayed) }, (_, i) => i + 1);
  }
  if (holesPlayed === 'front9') return Array.from({ length: 9 }, (_, i) => i + 1);
  if (holesPlayed === 'back9') return Array.from({ length: 9 }, (_, i) => i + 10);
  return [];
}
