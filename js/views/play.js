import { storage } from '../storage.js';
import { escapeHtml } from './home.js';
import { getCurrentPosition, haversineMeters, metersToYards } from '../geo.js';
import { SATELLITE_TILE_URL, SATELLITE_ATTRIBUTION } from '../mapConfig.js';

const POSITION_ONLY_ZOOM = 17; // moderate — "see the full hole," not zoomed all the way in
const PAR_OPTIONS = [3, 4, 5, 6];

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
  let editingPar = false;

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
        ${renderScorecardStrip()}

        <div class="hole-card hole-card--map">
          <div class="map-area">
            <div id="shot-map" class="shot-map shot-map--large"></div>
            ${holeDef.green ? `<button type="button" class="rangefinder-overlay" id="rangefinder-btn">${renderRangefinderContent(holeDef, lastKnownPosition)}</button>` : ''}
            <button type="button" class="track-shot-fab" id="track-shot-btn" aria-label="Track shot">🎯</button>
          </div>
          ${trackShotError ? `<p class="field-hint field-hint-error">${escapeHtml(trackShotError)}</p>` : ''}

          <div class="hole-meta-row">
            <span class="hole-number">Hole ${holeDef.number}</span>
            ${renderParControl(holeDef)}
            ${isUnmapped ? `<span class="first-time-badge">Mapping this hole</span>` : ''}
          </div>

          <div class="stroke-display ${scoreClass(holeScore.strokes, holeDef.par)}">
            <span class="stroke-number">${holeScore.strokes}</span>
          </div>

          ${holeScore.shots.length ? `<button type="button" class="text-btn" id="undo-shot-btn">Undo last shot</button>` : ''}

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
    attachScorecardStripHandlers();
    attachParControlHandlers(holeDef);

    maybeAutoFetchRangefinder(holeDef, holeScore);
  }

  // ---- Scorecard strip ----

  function renderScorecardStrip() {
    const total = round.holeScores.reduce((sum, h) => sum + (h.strokes || 0), 0);
    return `
      <div class="scorecard-strip">
        <div class="scorecard-strip-scroll">
          ${round.holeScores
            .map((h, i) => {
              const holeDef = course.holes.find((hd) => hd.number === h.holeNumber);
              const played = h.strokes != null && i !== currentIndex ? h.strokes : null;
              const cls = played != null && holeDef ? scoreClass(h.strokes, holeDef.par) : '';
              return `
              <button type="button" class="strip-cell ${i === currentIndex ? 'is-current' : ''}" data-index="${i}">
                <span class="strip-hole">${h.holeNumber}</span>
                <span class="strip-score ${cls}">${played != null ? h.strokes : '–'}</span>
              </button>
            `;
            })
            .join('')}
        </div>
        <div class="strip-total">
          <span class="strip-hole">Tot</span>
          <span class="strip-score">${total || '–'}</span>
        </div>
      </div>
    `;
  }

  function attachScorecardStripHandlers() {
    document.querySelectorAll('.strip-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentIndex = Number(btn.dataset.index);
        rangefinderAttemptedForHole = null;
        editingPar = false;
        render();
      });
    });
  }

  // ---- Par confirmation (API-sourced courses only need this) ----

  function renderParControl(holeDef) {
    if (holeDef.parConfirmed) {
      return `<span class="hole-par">Par ${holeDef.par}</span>`;
    }
    if (editingPar) {
      return `
        <span class="par-confirm-row">
          <span class="par-confirm-label">Par?</span>
          ${PAR_OPTIONS.map((p) => `<button type="button" class="par-confirm-btn" data-par="${p}">${p}</button>`).join('')}
        </span>
      `;
    }
    return `<button type="button" class="hole-par hole-par-unconfirmed" id="edit-par-btn">Par ${holeDef.par} · confirm</button>`;
  }

  function attachParControlHandlers(holeDef) {
    const editBtn = document.getElementById('edit-par-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        editingPar = true;
        render();
      });
    }
    document.querySelectorAll('.par-confirm-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const par = Number(btn.dataset.par);
        holeDef.par = par;
        holeDef.parConfirmed = true;
        editingPar = false;
        // Only reset strokes if the player hasn't started this hole yet —
        // otherwise a mid-hole par correction would wipe their count.
        const holeScore = round.holeScores[currentIndex];
        if (holeScore.shots.length === 0 && holeScore.putts === 0) {
          holeScore.strokes = par;
        }
        await storage.saveCourse(course);
        await storage.saveRound(round);
        render();
      });
    });
  }

  // ---- Shot tracking ----

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
      // Silent — the rangefinder badge itself is still tappable to retry.
    }
  }

  function go(delta) {
    currentIndex = Math.min(round.holeScores.length - 1, Math.max(0, currentIndex + delta));
    rangefinderAttemptedForHole = null;
    editingPar = false;
    render();
  }

  async function finishOrNext() {
    await mapHoleFromShots(course, round.holeScores[currentIndex]);
    if (currentIndex < round.holeScores.length - 1) {
      currentIndex += 1;
      rangefinderAttemptedForHole = null;
      editingPar = false;
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

function renderRangefinderContent(holeDef, position) {
  if (!position) return `<span class="rangefinder-prompt">📍 Get distance</span>`;
  const yards = Math.round(metersToYards(haversineMeters(position, holeDef.green)));
  return `<span class="rangefinder-value">${yards}</span><span class="rangefinder-label">yds</span>`;
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
  ];

  const referencePoint = holeDef.green || points[0] || position;
  if (!referencePoint) {
    container.innerHTML = `<p class="shot-map-placeholder">Track a shot to start mapping this hole.</p>`;
    return;
  }

  const map = L.map(container, { zoomControl: false, attributionControl: false }).setView(
    [referencePoint.lat, referencePoint.lng],
    points.length ? 17 : POSITION_ONLY_ZOOM
  );
  L.tileLayer(SATELLITE_TILE_URL, { maxZoom: 19, attribution: SATELLITE_ATTRIBUTION }).addTo(map);

  if (holeDef.tee) L.marker([holeDef.tee.lat, holeDef.tee.lng], { icon: markerIcon('tee', 'T') }).addTo(map).bindTooltip('Tee');
  if (holeDef.green) L.marker([holeDef.green.lat, holeDef.green.lng], { icon: markerIcon('green', '⛳') }).addTo(map).bindTooltip('Green');
  holeScore.shots.forEach((s, i) => {
    L.marker([s.lat, s.lng], { icon: markerIcon('shot', String(i + 1)) }).addTo(map).bindTooltip(`Shot ${i + 1}`);
  });
  if (position) L.marker([position.lat, position.lng], { icon: markerIcon('you', '') }).addTo(map);

  const fitPoints = [...points, ...(position ? [position] : [])];
  if (fitPoints.length > 1) {
    map.fitBounds(L.latLngBounds(fitPoints.map((p) => [p.lat, p.lng])), { padding: [28, 28] });
  } else if (!points.length && position) {
    map.setView([position.lat, position.lng], POSITION_ONLY_ZOOM);
  }
}

// Small themed div-icons instead of Leaflet's default pin image, so the
// map matches the rest of the app instead of looking like a generic
// mapping-library demo.
function markerIcon(kind, label) {
  return L.divIcon({
    className: `map-marker map-marker--${kind}`,
    html: `<span>${label}</span>`,
    iconSize: kind === 'you' ? [14, 14] : [26, 26],
    iconAnchor: kind === 'you' ? [7, 7] : [13, 13],
  });
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
