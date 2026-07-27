import { storage } from '../storage.js';
import { computeStats } from '../stats.js';
import { toParText, escapeHtml, totalForRound } from './home.js';

export async function renderStats(outlet) {
  const [rounds, courses] = await Promise.all([storage.getRounds(), storage.getCourses()]);
  const stats = computeStats(rounds, courses);

  if (!stats.roundsPlayed) {
    outlet.innerHTML = `
      <section class="panel">
        <p class="empty-state">No completed rounds yet.<br />Finish a round and your stats will show up here.</p>
      </section>
    `;
    return;
  }

  const bestCourse = stats.best ? courses.find((c) => c.id === stats.best.round.courseId) : null;
  const recent = rounds
    .filter((r) => r.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 10);

  outlet.innerHTML = `
    <section class="panel">
      <div class="stat-block-grid">
        <div class="stat-block">
          <span class="stat-block-value">${stats.roundsPlayed}</span>
          <span class="stat-block-label">Rounds played</span>
        </div>
        <div class="stat-block">
          <span class="stat-block-value">${toParText(round1(stats.avgToPar))}</span>
          <span class="stat-block-label">Avg. to par</span>
        </div>
        ${
          stats.avgPuttsPerHole != null
            ? `
        <div class="stat-block">
          <span class="stat-block-value">${round1(stats.avgPuttsPerHole)}</span>
          <span class="stat-block-label">Avg. putts / hole</span>
        </div>`
            : ''
        }
        ${
          stats.best
            ? `
        <div class="stat-block">
          <span class="stat-block-value">${toParText(stats.best.toPar)}</span>
          <span class="stat-block-label">Best round${bestCourse ? ` · ${escapeHtml(bestCourse.name)}` : ''}</span>
        </div>`
            : ''
        }
      </div>

      <p class="stats-note">
        More detailed stats — by club, distance, landing type, and course — arrive once shot tracking is built.
      </p>

      <div class="panel-header">
        <h2>Recent rounds</h2>
      </div>
      <ul class="scorecard-list">
        ${recent.map((r) => renderRoundRow(r, courses)).join('')}
      </ul>
    </section>
  `;
}

function renderRoundRow(round, courses) {
  const course = courses.find((c) => c.id === round.courseId);
  const totals = totalForRound(round, course);
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
          <span class="score-topar">${toParText(totals.toPar)}</span>
        </span>
      </a>
    </li>
  `;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
