import { storage } from '../storage.js';
import { escapeHtml } from './home.js';

export async function renderPlay(outlet, params) {
  const round = await storage.getRound(params.id);
  if (!round) {
    outlet.innerHTML = `<p class="empty-state">Round not found. <a href="#/">Back home</a></p>`;
    return;
  }
  const course = await storage.getCourse(round.courseId);
  if (!course) {
    outlet.innerHTML = `<p class="empty-state">That round's course was deleted. <a href="#/">Back home</a></p>`;
    return;
  }

  let currentIndex = round.holeScores.findIndex((h) => h.strokes == null);
  if (currentIndex === -1) currentIndex = round.holeScores.length - 1;

  render();

  function render() {
    const holeScore = round.holeScores[currentIndex];
    const holeDef = course.holes.find((h) => h.number === holeScore.holeNumber);
    if (holeScore.strokes == null) holeScore.strokes = holeDef.par;
    if (holeScore.putts == null) holeScore.putts = 0;

    outlet.innerHTML = `
      <section class="play-screen">
        <div class="play-header">
          <span class="play-course">${escapeHtml(course.name)}</span>
          <span class="play-progress">Hole ${currentIndex + 1} of ${round.holeScores.length}</span>
        </div>

        <div class="hole-card">
          <div class="hole-card-top">
            <span class="hole-number">Hole ${holeDef.number}</span>
            <span class="hole-par">Par ${holeDef.par}</span>
          </div>

          <div class="stroke-display ${scoreClass(holeScore.strokes, holeDef.par)}">
            <span class="stroke-number">${holeScore.strokes}</span>
          </div>

          <div class="stepper-row">
            <button type="button" class="stepper-btn" id="strokes-minus" aria-label="Decrease strokes">−</button>
            <span class="stepper-label">Strokes</span>
            <button type="button" class="stepper-btn" id="strokes-plus" aria-label="Increase strokes">+</button>
          </div>

          <div class="stepper-row stepper-row-secondary">
            <button type="button" class="stepper-btn stepper-btn-sm" id="putts-minus" aria-label="Decrease putts">−</button>
            <span class="stepper-label">Putts: <strong>${holeScore.putts}</strong></span>
            <button type="button" class="stepper-btn stepper-btn-sm" id="putts-plus" aria-label="Increase putts">+</button>
          </div>
        </div>

        <div class="play-nav">
          <button type="button" class="btn btn-secondary" id="prev-hole" ${currentIndex === 0 ? 'disabled' : ''}>Back</button>
          <button type="button" class="btn btn-primary" id="next-hole">
            ${currentIndex === round.holeScores.length - 1 ? 'Finish round' : 'Next hole'}
          </button>
        </div>
      </section>
    `;

    document.getElementById('strokes-minus').addEventListener('click', () => adjust('strokes', -1, 1));
    document.getElementById('strokes-plus').addEventListener('click', () => adjust('strokes', 1, 1));
    document.getElementById('putts-minus').addEventListener('click', () => adjust('putts', -1, 0));
    document.getElementById('putts-plus').addEventListener('click', () => adjust('putts', 1, 0));
    document.getElementById('prev-hole').addEventListener('click', () => go(-1));
    document.getElementById('next-hole').addEventListener('click', finishOrNext);
  }

  async function adjust(field, delta, min) {
    const holeScore = round.holeScores[currentIndex];
    holeScore[field] = Math.max(min, (holeScore[field] ?? min) + delta);
    await storage.saveRound(round);
    render();
  }

  function go(delta) {
    currentIndex = Math.min(round.holeScores.length - 1, Math.max(0, currentIndex + delta));
    render();
  }

  async function finishOrNext() {
    if (currentIndex < round.holeScores.length - 1) {
      currentIndex += 1;
      render();
    } else {
      round.completedAt = new Date().toISOString();
      await storage.saveRound(round);
      location.hash = `#/round/${round.id}/summary`;
    }
  }
}

// Mirrors the pencil-and-paper convention: circle a birdie or better,
// box a bogey or worse. It's the one signature visual flourish in the app.
export function scoreClass(strokes, par) {
  const diff = strokes - par;
  if (diff <= -2) return 'score-eagle';
  if (diff === -1) return 'score-birdie';
  if (diff === 0) return 'score-par';
  if (diff === 1) return 'score-bogey';
  return 'score-double';
}
