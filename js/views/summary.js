import { storage } from '../storage.js';
import { totalForRound, toParText, escapeHtml } from './home.js';
import { scoreClass } from './play.js';

export async function renderSummary(outlet, params) {
  const round = await storage.getRound(params.id);
  if (!round) {
    outlet.innerHTML = `<p class="empty-state">Round not found. <a href="#/">Back home</a></p>`;
    return;
  }
  const course = await storage.getCourse(round.courseId);
  const totals = totalForRound(round, course);
  const totalPutts = round.holeScores.reduce((s, h) => s + (h.putts || 0), 0);

  outlet.innerHTML = `
    <section class="panel summary">
      <div class="summary-hero">
        <span class="summary-course">${escapeHtml(course ? course.name : 'Unknown course')}</span>
        <span class="summary-total">${totals.strokes}</span>
        <span class="summary-topar">${toParText(totals.toPar)} to par</span>
      </div>

      <div class="summary-stats">
        <div class="stat"><span class="stat-value">${totalPutts}</span><span class="stat-label">Putts</span></div>
        <div class="stat"><span class="stat-value">${round.holeScores.length}</span><span class="stat-label">Holes</span></div>
      </div>

      <ul class="scorecard-grid">
        ${round.holeScores.map((h) => renderHoleCell(h, course)).join('')}
      </ul>

      <a class="btn btn-primary btn-block" href="#/">Done</a>
    </section>
  `;
}

function renderHoleCell(holeScore, course) {
  const holeDef = course && course.holes.find((h) => h.number === holeScore.holeNumber);
  if (!holeDef) {
    return `<li class="grid-cell"><span class="grid-hole">${holeScore.holeNumber}</span><span class="grid-score">${holeScore.strokes ?? '–'}</span></li>`;
  }
  const cls = scoreClass(holeScore.strokes ?? holeDef.par, holeDef.par);
  return `
    <li class="grid-cell">
      <span class="grid-hole">${holeDef.number}</span>
      <span class="grid-score ${cls}">${holeScore.strokes ?? '–'}</span>
    </li>
  `;
}
