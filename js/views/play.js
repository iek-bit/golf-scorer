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
  let positionAttemptedForHole = null; // holeNumber we've already tried to locate once
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
    const holeStarted = holeScore.shots.length > 0;

    outlet.innerHTML = `
      <section class="play-screen">
        ${renderScorecardStrip()}

        <div class="hole-card hole-card--map">
          <div class="map-area">
            <div id="shot-map" class="shot-map shot-map--large"></div>
            ${holeDef.green ? `<button type="button" class="rangefinder-overlay" id="rangefinder-btn">${renderRangefinderContent(holeDef, lastKnownPosition)}</button>` : ''}
          </div>

          <button type="button" class="track-shot-btn ${holeStarted ? '' : 'track-shot-btn--start'}" id="track-shot-btn" aria-label="${holeStarted ? 'Track shot' : 'Start hole'}">
            ${holeStarted ? crosshairIcon() : flagIcon()}
            <span>${holeStarted ? 'Track shot' : 'Start hole'}</span>
          </button>
          ${trackShotError ? `<p class="field-hint field-hint-error">${escapeHtml(trackShotError)}</p>` : ''}

          <div class="hole-meta-row">
            <span class="hole-number">Hole ${holeDef.number}</span>
            ${renderParControl(holeDef)}
          </div>
          ${isUnmapped ? `<p class="mapping-hint">${mappingHint(holeStarted)}</p>` : ''}

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

        <button type="button" class="text-btn text-btn-danger abandon-round-btn" id="abandon-round-btn">Abandon round</button>
      </section>
    `;

    renderShotMap(holeScore, holeDef, lastKnownPosition);

    document.getElementById('track-shot-btn').addEventListener('click', holeStarted ? trackShot : startHole);
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
    document.getElementById('abandon-round-btn').addEventListener('click', abandonRound);
    attachScorecardStripHandlers();
    attachParControlHandlers(holeDef);

    maybeAutoFetchPosition(holeScore);
  }

  async function abandonRound() {
    const confirmed = window.confirm('Discard this round? Every hole scored so far will be deleted — this can\'t be undone.');
    if (!confirmed) return;
    await storage.deleteRound(round.id);
    location.hash = '#/';
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
        positionAttemptedForHole = null;
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

  // The first tap on a hole marks where you're starting from — the tee —
  // and deliberately does NOT count as a stroke, so tracking "start, then
  // every shot" gives an accurate count instead of one too many. Every
  // tap after that is a real stroke.
  async function startHole() {
    trackShotError = null;
    try {
      const pos = await getCurrentPosition();
      lastKnownPosition = pos;
      const holeScore = round.holeScores[currentIndex];
      holeScore.shots.push({ lat: pos.lat, lng: pos.lng, capturedAt: new Date().toISOString() });
      holeScore.strokes = 0;
      await storage.saveRound(round);
    } catch (err) {
      trackShotError = err.message;
    }
    render();
  }

  async function trackShot() {
    trackShotError = null;
    try {
      const pos = await getCurrentPosition();
      lastKnownPosition = pos;
      const holeScore = round.holeScores[currentIndex];
      holeScore.shots.push({ lat: pos.lat, lng: pos.lng, capturedAt: new Date().toISOString() });
      holeScore.strokes = (holeScore.strokes ?? 0) + 1;
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
    if (holeScore.shots.length === 0) {
      // Undid the "start hole" marker itself — back to square one.
      const holeDef = course.holes.find((h) => h.number === holeScore.holeNumber);
      holeScore.strokes = holeDef.par;
    } else {
      holeScore.strokes = Math.max(0, (holeScore.strokes ?? 1) - 1);
    }
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

  // Tries once per hole to show where you are on the map immediately —
  // even before you've tapped anything — rather than leaving the map
  // blank until the first tap. This can prompt for location permission,
  // same reasoning as the home screen: it's central to the whole screen,
  // not an optional extra.
  async function maybeAutoFetchPosition(holeScore) {
    if (positionAttemptedForHole === holeScore.holeNumber) return;
    positionAttemptedForHole = holeScore.holeNumber;
    if (!('geolocation' in navigator)) return;
    try {
      lastKnownPosition = await getCurrentPosition();
      render();
    } catch {
      // Silent — Start hole / Track shot and the rangefinder badge are still tappable to retry.
    }
  }

  function go(delta) {
    currentIndex = Math.min(round.holeScores.length - 1, Math.max(0, currentIndex + delta));
    positionAttemptedForHole = null;
    editingPar = false;
    render();
  }

  async function finishOrNext() {
    await mapHoleFromShots(course, round.holeScores[currentIndex]);
    if (currentIndex < round.holeScores.length - 1) {
      currentIndex += 1;
      positionAttemptedForHole = null;
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

// Pure — testable without the DOM. The "start hole" tap (shots[0]) marks
// the tee; the last tracked shot marks the pin. A single point per hole
// for now; averaging across rounds (or a one-time "walk the green"
// calibration) to get true front/center/back edges is future work.
export function computeTeeGreenFromShots(shots) {
  if (!shots || !shots.length) return null;
  const first = shots[0];
  const last = shots[shots.length - 1];
  return {
    tee: { lat: first.lat, lng: first.lng },
    green: { lat: last.lat, lng: last.lng },
  };
}

function mappingHint(holeStarted) {
  return holeStarted ? 'Last tracked shot will mark the green' : 'Start hole marks the tee — free, not a stroke';
}

// Small line-art icons instead of an emoji, so the button reads as part of
// the app rather than a generic system glyph. currentColor picks up
// whatever color the button itself is styled with.
function flagIcon() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="21" x2="5" y2="3"/><path d="M5 4h13l-3 4 3 4H5"/></svg>`;
}

function crosshairIcon() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><line x1="12" y1="1.5" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22.5" y2="12"/></svg>`;
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
    container.innerHTML = `<p class="shot-map-placeholder">Locating you…</p>`;
    return;
  }

  // The map is a nice-to-have layer on top of the actual scoring/tracking
  // data, which is already saved by this point. A Leaflet/tile/marker
  // failure here should never take down the rest of the screen (buttons,
  // scorecard, strokes) or silently break the caller's render() call —
  // it just falls back to a plain placeholder instead.
  try {
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
  } catch (err) {
    console.error('Map render failed:', err);
    container.innerHTML = `<p class="shot-map-placeholder">Map unavailable right now.</p>`;
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
