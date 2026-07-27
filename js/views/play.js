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
    holeScore.shots = holeScore.shots || [];

    const lastShot = holeScore.shots[holeScore.shots.length - 1];
    const lastShotLabel = lastShot ? `${lastShot.club || '—'} @ ${lastShot.lat.toFixed(5)}, ${lastShot.lng.toFixed(5)}` : 'No shots tracked yet';

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

          <div style="margin-top:12px;">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
              <select id="club-select" aria-label="Select club">
                <option value="Driver">Driver</option>
                <option value="3-wood">3-wood</option>
                <option value="5-wood">5-wood</option>
                <option value="3-iron">3-iron</option>
                <option value="7-iron">7-iron</option>
                <option value="PW">Pitching Wedge</option>
                <option value="Putter">Putter</option>
              </select>
              <button type="button" class="btn btn-secondary" id="track-shot">Track shot (tap)</button>
              <button type="button" class="btn" id="rangefinder">Rangefinder</button>
              <button type="button" class="btn" id="show-hole-map">Show hole map</button>
            </div>
            <div class="field-note">Last tracked: ${escapeHtml(lastShotLabel)}</div>
            <div id="play-map-container" style="display:none; margin-top:12px">
              <div id="play-map" style="height:260px; border-radius:10px; overflow:hidden"></div>
            </div>
          </div>
        </div>

        <div class="play-nav">
          <button type="button" class="btn btn-secondary" id="prev-hole" ${currentIndex === 0 ? 'disabled' : ''}>Back</button>
          <button type="button" class="btn btn-primary" id="next-hole">
            ${currentIndex === round.holeScores.length - 1 ? 'Finish round' : 'Next hole'}
          </button>
        </div>

        <div id="range-output" style="padding:12px;display:none"></div>
      </section>
    `;

    document.getElementById('strokes-minus').addEventListener('click', () => adjust('strokes', -1, 1));
    document.getElementById('strokes-plus').addEventListener('click', () => adjust('strokes', 1, 1));
    document.getElementById('putts-minus').addEventListener('click', () => adjust('putts', -1, 0));
    document.getElementById('putts-plus').addEventListener('click', () => adjust('putts', 1, 0));
    document.getElementById('prev-hole').addEventListener('click', () => go(-1));
    document.getElementById('next-hole').addEventListener('click', finishOrNext);

    document.getElementById('track-shot').addEventListener('click', trackShot);
    document.getElementById('rangefinder').addEventListener('click', runRangefinder);
    document.getElementById('show-hole-map').addEventListener('click', togglePlayMap);
  }

  let playMap = null;
  let playMapRect = null;
  let playMapGreen = null;

  function togglePlayMap() {
    const container = document.getElementById('play-map-container');
    const mapEl = document.getElementById('play-map');
    if (container.style.display === 'none') {
      container.style.display = '';
      ensurePlayMapInitialized();
      drawPlayMapContents();
    } else {
      container.style.display = 'none';
    }
  }

  function ensurePlayMapInitialized() {
    if (playMap) return;
    try {
      playMap = L.map('play-map', { zoomControl: true, attributionControl: false }).setView([39.5, -98.35], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(playMap);
      // try center on user if available
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          playMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
        });
      }
    } catch (err) {
      console.error('Failed to init play map', err);
    }
  }

  function drawPlayMapContents() {
    if (!playMap) return;
    // clear previous overlays
    if (playMapRect) { playMap.removeLayer(playMapRect); playMapRect = null; }
    if (playMapGreen) { playMap.removeLayer(playMapGreen); playMapGreen = null; }

    const holeDef = course.holes.find((h) => h.number === round.holeScores[currentIndex].holeNumber);
    if (!holeDef) return;

    if (holeDef.area) {
      const sw = L.latLng(holeDef.area.sw.lat, holeDef.area.sw.lng);
      const ne = L.latLng(holeDef.area.ne.lat, holeDef.area.ne.lng);
      const bounds = L.latLngBounds(sw, ne);
      playMapRect = L.rectangle(bounds, { color: '#1f4d3a', weight: 2, fillOpacity: 0.06 }).addTo(playMap);
      playMap.fitBounds(bounds.pad(0.15));
    } else if (holeDef.green) {
      playMap.setView([holeDef.green.lat, holeDef.green.lng], 17);
    }

    if (holeDef.green) {
      playMapGreen = L.circleMarker([holeDef.green.lat, holeDef.green.lng], { radius: 6, color: 'green' }).addTo(playMap);
    }
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

  async function trackShot() {
    if (!navigator.geolocation) {
      alert('Geolocation not available');
      return;
    }
    const club = document.getElementById('club-select').value;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const holeScore = round.holeScores[currentIndex];
      holeScore.shots = holeScore.shots || [];
      holeScore.shots.push({ lat, lng, club, ts: new Date().toISOString() });
      // Optionally increment strokes when tracking a shot (user expectation varies).
      // Leave strokes unchanged — user controls strokes count manually.
      await storage.saveRound(round);
      render();
    }, (err) => {
      console.error('geo error', err);
      alert('Failed to get location. Make sure location permissions are allowed.');
    }, { enableHighAccuracy: true, maximumAge: 5000 });
  }

  function haversineMeters(aLat, aLng, bLat, bLng) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const a = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function runRangefinder() {
    const holeDef = course.holes.find((h) => h.number === round.holeScores[currentIndex].holeNumber);
    const out = document.getElementById('range-output');
    out.style.display = '';
    if (!holeDef || !holeDef.green) {
      out.textContent = 'No green coordinates for this hole. Add them via Courses → Add course → enable mapping.';
      return;
    }
    if (!navigator.geolocation) {
      out.textContent = 'Geolocation not available.';
      return;
    }
    out.textContent = 'Finding distance…';
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const meters = haversineMeters(lat, lng, holeDef.green.lat, holeDef.green.lng);
      const metersRounded = Math.round(meters);
      const yards = Math.round(meters / 0.9144);
      out.innerHTML = `<strong>Rangefinder</strong><div>To green center: ${metersRounded} m (${yards} yd)</div>`;
    }, (err) => {
      console.error('geo error', err);
      out.textContent = 'Failed to get current location. Check permissions.';
    }, { enableHighAccuracy: true });
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
