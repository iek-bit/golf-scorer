import { storage } from '../storage.js';
import { computeStats } from '../stats.js';
import { toParText, escapeHtml, totalForRound } from './home.js';
import { weatherIconSvg, weatherConditionLabel } from '../api/weather.js';

const WEATHER_FILTERS = ['sun', 'cloud', 'rain', 'snow'];

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
  const completed = rounds.filter((r) => r.completedAt).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  // Only offer filters for conditions that actually appear in your history —
  // a "Snow" button that always shows zero results isn't useful, it's clutter.
  const availableConditions = WEATHER_FILTERS.filter((cond) => completed.some((r) => r.weather?.condition === cond));

  let activeFilter = null; // null = all

  render();

  function render() {
    const filtered = activeFilter ? completed.filter((r) => r.weather?.condition === activeFilter) : completed;
    const recent = filtered.slice(0, 10);

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

        ${availableConditions.length ? renderWeatherFilter() : ''}

        ${
          recent.length
            ? `<ul class="scorecard-list">${recent.map((r) => renderRoundRow(r, courses)).join('')}</ul>`
            : `<p class="empty-state small-empty-state">No rounds played in that weather yet.</p>`
        }
      </section>
    `;

    const filterRow = document.getElementById('weather-filter-row');
    if (filterRow) {
      filterRow.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-condition]');
        if (!btn) return;
        const value = btn.dataset.condition;
        activeFilter = value === 'all' ? null : value === activeFilter ? null : value; // tap again to clear
        render();
      });
    }

    document.querySelectorAll('.delete-round-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const confirmed = window.confirm('Delete this round? This can\'t be undone.');
        if (!confirmed) return;
        await storage.deleteRound(btn.dataset.id);
        renderStats(outlet); // full re-render — stats totals shift too
      });
    });
  }

  function renderWeatherFilter() {
    return `
      <div class="segmented weather-filter" id="weather-filter-row">
        <button type="button" class="segment-btn ${activeFilter === null ? 'is-active' : ''}" data-condition="all">All</button>
        ${availableConditions
          .map(
            (cond) => `
          <button type="button" class="segment-btn weather-filter-btn ${activeFilter === cond ? 'is-active' : ''}" data-condition="${cond}" aria-label="${weatherConditionLabel(cond)}">
            ${weatherIconSvg(cond, 15)}
          </button>
        `
          )
          .join('')}
      </div>
    `;
  }
}

function renderRoundRow(round, courses) {
  const course = courses.find((c) => c.id === round.courseId);
  const totals = totalForRound(round, course);
  const date = new Date(round.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `
    <li class="score-row-wrap">
      <a class="score-row" href="#/round/${round.id}/summary">
        <span class="score-row-main">
          <span class="score-row-course">
            ${escapeHtml(course ? course.name : 'Unknown course')}
            ${round.weather ? `<span class="score-row-weather" aria-label="${weatherConditionLabel(round.weather.condition)}">${weatherIconSvg(round.weather.condition, 13)}</span>` : ''}
          </span>
          <span class="score-row-date">${date}</span>
        </span>
        <span class="score-row-total">
          <span class="score-strokes">${totals.strokes}</span>
          <span class="score-topar">${toParText(totals.toPar)}</span>
        </span>
      </a>
      <button type="button" class="icon-btn delete-round-btn" data-id="${round.id}" aria-label="Delete round">${trashIcon()}</button>
    </li>
  `;
}

function trashIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
