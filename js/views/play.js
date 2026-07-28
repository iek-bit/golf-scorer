import { storage } from '../storage.js';
import { escapeHtml } from './home.js';
import { getCurrentPosition, haversineMeters, metersToYards } from '../geo.js';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

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

  let lastKnownPosition = null;
  let rangefinderAttemptedForHole = null; // holeNumber we've already silently tried once
  let trackShotError = null;

  render();

  function render() {
    const holeScore = round.holeScores[currentIndex];
    const holeDef = course.holes.find((h) => h.number === holeScore.holeNumber);
    if (holeScore.strokes == null) holeScore.strokes = holeDef.par;
    if (holeScore.putts == null) holeScore.putts = 0;
    if (!holeScore.shots) holeScore.shots = [];

    const isUnmapped = !holeDef.tee && !holeDef.green;

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

          ${isUnmapped ? `<span class="first-time-badge">First time here — shots you track will map this hole</span>` : ''}

          ${holeDef.green ? renderRangefinderRow(holeDef, lastKnownPosition) : ''}

          <div class="stroke-display ${scoreClass(holeScore.strokes, holeDef.par)}">
            <span class="stroke-number">${holeScore.strokes}</span>
          </div>

          <button type="button" class="btn btn-primary btn-block track-shot-btn" id="track-shot-btn">
            🎯 Track shot
          </button>
          ${trackShotError ? `<p class="field-hint field-hint-error">${escapeHtml(trackShotError)}</p>` : ''}
          ${holeScore.shots.length ? `<button type="button" class="text-btn" id="undo-shot-btn">Undo last shot</button>` : ''}

          <div id="shot-map" class="shot-map"></div>

          <div class="stepper-row stepper-row-secondary">
            <button type="button" class="stepper-btn stepper-btn-sm" id="strokes-minus" aria-label="Decrease strokes">−</button>
            <span class="stepper-label">Adjust strokes</span>
            <button type="button" class="stepper-btn stepper-btn-sm" id="strokes-plus" aria-label="Increase strokes">+</button>
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

    renderShotMap(holeScore, holeDef, lastKnownPosition);

    document.getElementById('track-shot-btn').addEventListener('click', trackShot);
    const undoBtn = document.getElementById('undo-shot-btn');
    if (undoBtn) undoBtn.addEventListener('click', undoLastShot);
    const rangefinderBtn = document.getElementById('rangefinder-btn');
    if (rangefinderBtn) rangefinderBtn.addEventListener('click', refreshDistance);
    document.getElementById('strokes-minus').addEventListener('click', () => adjust('strokes', -1, 1));
    document.getElementById('strokes-plus').addEventListener('click', () => adjust('strokes', 1, 1));
    document.getElementById('putts-minus').addEventListener('click', () => adjust('putts', -1, 0));
    document.getElementById('putts-plus').addEventListener('click', () => adjust('putts', 1, 0));
    document.getElementById('prev-hole').addEventListener('click', () => go(-1));
    document.getElementById('next-hole').addEventListener('click', finishOrNext);

    maybeAutoFetchRangefinder(holeDef, holeScore);
  }

  async function adjust(field, delta, min) {
    const holeScore = round.holeScores[currentIndex];
    holeScore[field] = Math.max(min, (holeScore[field] ?? min) + delta);
    await storage.saveRound(round);
    render();
  }

  // The first tracked shot switches a hole from "quick guess at par" to
  // "count what's actually happening" — so it resets the count to 1
  // instead of adding on top of the par default. Every tap after that
  // just adds one.
  async function trackShot() {
    trackShotError = null;
    try {
      const pos = await getCurrentPosition();
      lastKnownPosition = pos;
      const holeScore = round.holeScores[currentIndex];
      const isFirstTrackedShot = holeScore.shots.length === 0;
      holeScore.shots.push({ lat: pos.lat, lng: pos.lng, capturedAt: new Date().toISOString() });
      holeScore.strokes = isFirstTrackedShot ? 1 : (holeScore.strokes ?? 0) + 1;
      await storage.saveRound(round);
    } catch (err) {
      trackShotError = err.message;
    }
    render();
  }

  async function undoLastShot() {
    const holeScore = round.holeScores[currentIndex];
    if (!holeScore.shots.length) return;
    holeScore.shots.pop();
    holeScore.strokes = Math.max(0, (holeScore.strokes ?? 1) - 1);
    await storage.saveRound(round);
    render();
  }

  async function refreshDistance() {
    trackShotError = null;
    try {
      lastKnownPosition = await getCurrentPosition();
    } catch (err) {
      trackShotError = err.message;
    }
    render();
  }

  // Quietly fetch a position for the rangefinder if permission is already
  // granted — never prompts on its own. Only tries once per hole; after
  // that, the rangefinder button itself lets the user refresh manually.
  async function maybeAutoFetchRangefinder(holeDef, holeScore) {
    if (!holeDef.green) return;
    if (rangefinderAttemptedForHole === holeScore.holeNumber) return;
    rangefinderAttemptedForHole = holeScore.holeNumber;
    if (!('permissions' in navigator)) return;
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state !== 'granted') return;
      lastKnownPosition = await getCurrentPosition();
      render();
    } catch {
      // Silent — the manual "Get distance" button is still there.
    }
  }

  function go(delta) {
    currentIndex = Math.min(round.holeScores.length - 1, Math.max(0, currentIndex + delta));
    rangefinderAttemptedForHole = null;
    render();
  }

  async function finishOrNext() {
    await mapHoleFromShots(course, round.holeScores[currentIndex]);
    if (currentIndex < round.holeScores.length - 1) {
      currentIndex += 1;
      rangefinderAttemptedForHole = null;
      render();
    } else {
      round.completedAt = new Date().toISOString();
      await storage.saveRound(round);
      location.hash = `#/round/${round.id}/summary`;
    }
  }

  // Saves this hole's tee/green onto the COURSE (not the round) the first
  // time it's mapped — later rounds on the same course reuse it and never
  // overwrite it. That's what makes it "first-time playthrough defines
  // the hole": once mapped, it's mapped.
  async function mapHoleFromShots(course, holeScore) {
    const holeDef = course.holes.find((h) => h.number === holeScore.holeNumber);
    const inferred = computeTeeGreenFromShots(holeScore.shots);
    if (!holeDef || !inferred) return;
    let changed = false;
    if (!holeDef.tee) {
      holeDef.tee = inferred.tee;
      changed = true;
    }
    if (!holeDef.green) {
      holeDef.green = inferred.green;
      changed = true;
    }
    if (changed) await storage.saveCourse(course);
  }
}

// Pure — testable without the DOM. First tracked shot ≈ the tee, last ≈
// the pin. A single point per hole for now; averaging across rounds (or a
// one-time "walk the green" calibration) to get true front/center/back
// edges is future work, not this pass.
export function computeTeeGreenFromShots(shots) {
  if (!shots || !shots.length) return null;
  const first = shots[0];
  const last = shots[shots.length - 1];
  return {
    tee: { lat: first.lat, lng: first.lng },
    green: { lat: last.lat, lng: last.lng },
  };
}

function renderRangefinderRow(holeDef, position) {
  if (!position) {
    return `<button type="button" class="rangefinder rangefinder-prompt" id="rangefinder-btn">📍 Get distance to green</button>`;
  }
  const yards = Math.round(metersToYards(haversineMeters(position, holeDef.green)));
  return `
    <button type="button" class="rangefinder" id="rangefinder-btn">
      <span class="rangefinder-value">${yards}</span>
      <span class="rangefinder-label">yds to green</span>
    </button>
  `;
}

function renderShotMap(holeScore, holeDef, position) {
  const container = document.getElementById('shot-map');
  if (!container) return;

  if (typeof L === 'undefined') {
    container.innerHTML = `<p class="shot-map-placeholder">Map unavailable right now.</p>`;
    return;
  }

  const points = [
    ...holeScore.shots.map((s) => ({ lat: s.lat, lng: s.lng })),
    ...(holeDef.tee ? [holeDef.tee] : []),
    ...(holeDef.green ? [holeDef.green] : []),
    ...(position ? [position] : []),
  ];

  if (!points.length) {
    container.innerHTML = `<p class="shot-map-placeholder">Track a shot to start mapping this hole.</p>`;
    return;
  }

  const center = holeDef.green || points[0];
  const map = L.map(container, { zoomControl: false, attributionControl: false }).setView([center.lat, center.lng], 17);
  L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);

  if (holeDef.tee) {
    L.circleMarker([holeDef.tee.lat, holeDef.tee.lng], { radius: 7, color: '#3f7c5a', fillColor: '#3f7c5a', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip('Tee');
  }
  if (holeDef.green) {
    L.circleMarker([holeDef.green.lat, holeDef.green.lng], { radius: 7, color: '#9c4b2c', fillColor: '#9c4b2c', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip('Green');
  }
  holeScore.shots.forEach((s, i) => {
    L.marker([s.lat, s.lng]).addTo(map).bindTooltip(`Shot ${i + 1}`);
  });

  if (points.length > 1) {
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [24, 24] });
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
