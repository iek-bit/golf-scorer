import { storage } from '../storage.js';

export async function renderHome(outlet) {
  const [rounds, courses] = await Promise.all([storage.getRounds(), storage.getCourses()]);

  const inProgress = rounds.find((r) => !r.completedAt);
  const recent = rounds
    .filter((r) => r.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 8);

  outlet.innerHTML = `
    <section class="panel">
      ${inProgress ? renderResumeCard(inProgress, courses) : ''}
      <div class="panel-header">
        <h2>Rounds</h2>
        <a class="btn btn-primary" href="#/round/new">New round</a>
      </div>
      ${recent.length ? renderRoundsList(recent, courses) : renderEmptyRounds(courses)}
    </section>
  `;
}

function renderResumeCard(round, courses) {
  const course = courses.find((c) => c.id === round.courseId);
  return `
    <a class="resume-card" href="#/round/${round.id}/play">
      <span class="resume-label">Round in progress</span>
      <span class="resume-course">${escapeHtml(course ? course.name : 'Unknown course')}</span>
      <span class="resume-cta">Continue →</span>
    </a>
  `;
}

function renderEmptyRounds(courses) {
  if (!courses.length) {
    return `<p class="empty-state">Add a course, then start your first round.<br /><a href="#/courses/new">Add a course →</a></p>`;
  }
  return `<p class="empty-state">No rounds yet. Ready when you are.</p>`;
}

function renderRoundsList(rounds, courses) {
  return `<ul class="scorecard-list">${rounds.map((r) => renderRoundRow(r, courses)).join('')}</ul>`;
}

function renderRoundRow(round, courses) {
  const course = courses.find((c) => c.id === round.courseId);
  const totals = totalForRound(round, course);
  const toParLabel = toParText(totals.toPar);
  const date = new Date(round.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `
    <li>
      <a class="score-row" href="#/round/${round.id}/summary">
        <span class="score-row-main">
          <span class="score-row-course">${escapeHtml(course ? course.name : 'Unknown course')}</span>
          <span class="score-row-date">${date}</span>
        </span>
        <span class="score-row-total">
          <span class="score-strokes">${totals.strokes}</span>
          <span class="score-topar">${toParLabel}</span>
        </span>
      </a>
    </li>
  `;
}

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
