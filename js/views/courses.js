import { storage } from '../storage.js';
import { makeCourse } from '../models.js';
import { escapeHtml } from './home.js';

const MIN_PAR = 3;
const MAX_PAR = 6;
const DEFAULT_PAR = 4;

export async function renderCourses(outlet) {
  const courses = await storage.getCourses();
  outlet.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <a class="btn btn-primary" href="#/courses/new">Add course</a>
      </div>
      ${courses.length ? renderList(courses) : `<p class="empty-state">No courses yet.<br /><a href="#/courses/new">Add your first course →</a></p>`}
    </section>
  `;
}

function renderList(courses) {
  return `<ul class="plain-list">
    ${courses
      .map(
        (c) => `
      <li class="list-row">
        <span>${escapeHtml(c.name)}</span>
        <span class="list-row-meta">${c.numHoles} holes · par ${c.holes.reduce((s, h) => s + h.par, 0)}</span>
        <div>
          <a class="btn btn-secondary" href="#/courses/${c.id}/edit">Edit</a>
        </div>
      </li>
    `
      )
      .join('')}
  </ul>`;
}

async function renderCourseForm(outlet, existingCourse) {
  outlet.innerHTML = `
    <section class="panel">
      <form id="course-form" class="form">
        <label class="field">
          <span>Course name</span>
          <input type="text" name="name" required placeholder="e.g. Pebble Creek" autocomplete="off" />
        </label>
        <label class="field">
          <span>Number of holes</span>
          <select name="numHoles">
            <option value="9">9</option>
            <option value="18" selected>18</option>
          </select>
        </label>

        <label class="field">
          <span>Map course manually?</span>
          <div class="field-note">If you enable this, you can draw a boxed area for each hole and set the green center. You can also skip mapping and just save pars.</div>
          <input type="checkbox" name="useMap" id="useMap" /> <label for="useMap">Enable mapping</label>
        </label>

        <div class="field-group-label">Par per hole</div>
        <div id="par-list" class="par-list"></div>

        <div id="map-controls" style="display:none; margin-top:12px">
          <div class="field">
            <span>Hole to edit</span>
            <select id="hole-select"></select>
          </div>
          <div class="field" style="display:flex;gap:8px">
            <button type="button" class="btn" id="draw-area">Draw hole area</button>
            <button type="button" class="btn" id="set-green">Set green (tap map)</button>
            <button type="button" class="btn" id="clear-area">Clear area</button>
            <button type="button" class="btn" id="center-user">Center on current location</button>
          </div>
          <div id="map" style="height:320px; margin-top:8px; border-radius:8px; overflow:hidden"></div>
          <div class="field-note" style="margin-top:8px">Drawing: click once for corner A, click again for corner B to form a rectangle. Use Clear area to remove and redraw.</div>
        </div>

        <button type="submit" class="btn btn-primary btn-block">Save course</button>
      </form>
    </section>
  `;

  const form = document.getElementById('course-form');
  const parList = document.getElementById('par-list');
  const numHolesSelect = form.numHoles;
  const useMapCheckbox = document.getElementById('useMap');
  const mapControls = document.getElementById('map-controls');
  const holeSelect = document.getElementById('hole-select');
  const drawAreaBtn = document.getElementById('draw-area');
  const setGreenBtn = document.getElementById('set-green');
  const clearAreaBtn = document.getElementById('clear-area');
  const centerUserBtn = document.getElementById('center-user');
  const mapEl = document.getElementById('map');

  let map = null;
  let drawControl = null;
  let editingMode = null; // 'area' | 'green' | null
  let areaFirstCorner = null;
  let markers = {}; // { holeNumber: { area: rectangle, green: marker } };

  function renderParRows() {    const n = Number(numHolesSelect.value);
    parList.innerHTML = Array.from({ length: n }, (_, i) => i + 1)
      .map(
        (num) => `
      <div class="par-row">
        <span class="par-row-hole">Hole ${num}</span>
        <div class="par-row-stepper">
          <button type="button" class="stepper-btn stepper-btn-sm" data-hole="${num}" data-dir="-1" aria-label="Decrease par for hole ${num}">−</button>
          <span class="par-row-value" id="par-value-${num}">${DEFAULT_PAR}</span>
          <button type="button" class="stepper-btn stepper-btn-sm" data-hole="${num}" data-dir="1" aria-label="Increase par for hole ${num}">+</button>
        </div>
        <input type="hidden" name="par-${num}" value="${DEFAULT_PAR}" />
        <input type="hidden" name="hole-${num}-area" id="hole-${num}-area" value="" />
        <input type="hidden" name="hole-${num}-green" id="hole-${num}-green" value="" />
      </div>
    `
      )
      .join('');

    // Rebuild hole select for map controls
    holeSelect.innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">Hole ${i + 1}</option>`).join('');
  }

  // Delegated so it survives renderParRows() re-running when hole count changes.
  parList.addEventListener('click', (e) => {
    const btn = e.target.closest('.stepper-btn');
    if (!btn) return;
    const hole = btn.dataset.hole;
    const dir = Number(btn.dataset.dir);
    const hiddenInput = form.querySelector(`input[name="par-${hole}"]`);
    const valueEl = document.getElementById(`par-value-${hole}`);
    const next = Math.min(MAX_PAR, Math.max(MIN_PAR, Number(hiddenInput.value) + dir));
    hiddenInput.value = String(next);
    valueEl.textContent = String(next);
  });

  numHolesSelect.addEventListener('change', () => {
    renderParRows();
    if (map) {
      // clean markers/areas for holes beyond new count
      const max = Number(numHolesSelect.value);
      Object.keys(markers).forEach((k) => {
        const n = Number(k);
        if (n > max) {
          const m = markers[k];
          if (m.area) map.removeLayer(m.area);
          if (m.green) map.removeLayer(m.green);
          if (m.tempCornerA) map.removeLayer(m.tempCornerA);
          delete markers[k];
        }
      });
    }
  });

  renderParRows();

  // Toggle map UI
  useMapCheckbox.addEventListener('change', () => {
    if (useMapCheckbox.checked) {
      mapControls.style.display = '';
      ensureMapInitialized();
      // if editing existing course, load markers
      if (existingCourse && existingCourse.holes) loadExistingOnMap(existingCourse);
    } else {
      mapControls.style.display = 'none';
    }
  });

  function ensureMapInitialized() {
    if (map) return;
    try {
      map = L.map(mapEl).setView([39.5, -98.35], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Feature group for draw/edit interactions
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      // Draw control for rectangle drawing/editing
      drawControl = new L.Control.Draw({
        draw: {
          polyline: false,
          polygon: false,
          circle: false,
          marker: false,
          circlemarker: false,
          rectangle: {
            shapeOptions: { color: '#1f4d3a', weight: 2, fillOpacity: 0.08 }
          }
        },
        edit: { featureGroup: drawnItems }
      });
      map.addControl(drawControl);

      // when a rectangle is created via the draw toolbar
      map.on(L.Draw.Event.CREATED, (ev) => {
        const layer = ev.layer;
        const type = ev.layerType;
        if (type === 'rectangle') {
          const holeNum = Number(holeSelect.value);
          if (!holeNum) return;
          // remove previous rectangle for this hole
          if (markers[holeNum] && markers[holeNum].area) {
            try { map.removeLayer(markers[holeNum].area); } catch (e) {}
          }
          // add to drawn items and track
          drawnItems.addLayer(layer);
          markers[holeNum] = markers[holeNum] || {};
          markers[holeNum].area = layer;
          layer._holeNum = holeNum;
          const bounds = layer.getBounds();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          document.getElementById(`hole-${holeNum}-area`).value = `${sw.lat},${sw.lng}|${ne.lat},${ne.lng}`;
        }
      });

      // when rectangles are edited
      map.on(L.Draw.Event.EDITED, (ev) => {
        ev.layers.eachLayer((layer) => {
          const holeNum = layer._holeNum;
          if (!holeNum) return;
          const bounds = layer.getBounds();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          document.getElementById(`hole-${holeNum}-area`).value = `${sw.lat},${sw.lng}|${ne.lat},${ne.lng}`;
          // ensure markers mapping
          markers[holeNum] = markers[holeNum] || {};
          markers[holeNum].area = layer;
        });
      });

      // when rectangles are deleted
      map.on(L.Draw.Event.DELETED, (ev) => {
        ev.layers.eachLayer((layer) => {
          const holeNum = layer._holeNum;
          if (!holeNum) return;
          if (markers[holeNum] && markers[holeNum].area) {
            delete markers[holeNum].area;
          }
          document.getElementById(`hole-${holeNum}-area`).value = '';
        });
      });

      // click handler used only for green placement
      map.on('click', (ev) => {
        const holeNum = Number(holeSelect.value);
        if (!holeNum) return;
        if (!markers[holeNum]) markers[holeNum] = {};
        const latlng = ev.latlng;
        if (editingMode === 'green') {
          if (markers[holeNum].green) try { map.removeLayer(markers[holeNum].green); } catch (e) {}
          const mk = L.circleMarker(latlng, { radius: 6, color: 'green', title: `Hole ${holeNum} green` }).addTo(map);
          markers[holeNum].green = mk;
          document.getElementById(`hole-${holeNum}-green`).value = `${latlng.lat},${latlng.lng}`;
        }
      });

      // try to center on user location if available
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        });
      }

      // expose drawnItems for loadExistingOnMap to attach existing rectangles
      map._drawnItems = drawnItems;
    } catch (err) {
      console.error('Failed to initialize map', err);
    }
  }

  function loadExistingOnMap(course) {
    if (!map || !course || !course.holes) return;
    course.holes.forEach((h) => {
      const n = h.number;
      if (!markers[n]) markers[n] = {};
      if (h.area) {
        try {
          const sw = L.latLng(h.area.sw.lat, h.area.sw.lng);
          const ne = L.latLng(h.area.ne.lat, h.area.ne.lng);
          const bounds = L.latLngBounds(sw, ne);
          const rect = L.rectangle(bounds, { color: '#1f4d3a', weight: 2, fillOpacity: 0.08 });
          markers[n].area = rect;
          rect._holeNum = n;
          if (map && map._drawnItems) map._drawnItems.addLayer(rect);
          else rect.addTo(map);
          document.getElementById(`hole-${n}-area`).value = `${h.area.sw.lat},${h.area.sw.lng}|${h.area.ne.lat},${h.area.ne.lng}`;
        } catch (err) {
          console.warn('failed to render existing area', err);
        }
      }
      if (h.green) {
        try {
          const mk = L.circleMarker([h.green.lat, h.green.lng], { radius: 6, color: 'green' }).addTo(map);
          markers[n].green = mk;
          document.getElementById(`hole-${n}-green`).value = `${h.green.lat},${h.green.lng}`;
        } catch (err) {
          console.warn('failed to render existing green', err);
        }
      }
    });
  }

  drawAreaBtn.addEventListener('click', () => {
    editingMode = 'area';
    areaFirstCorner = null;
    drawAreaBtn.classList.add('active');
    setGreenBtn.classList.remove('active');
    if (!map) ensureMapInitialized();
    // programmatically start rectangle draw if the drawControl is available
    try {
      if (drawControl) {
        const drawer = new L.Draw.Rectangle(map, drawControl.options.draw.rectangle);
        drawer.enable();
      }
    } catch (err) {
      // fallback — user can click to create via legacy mode
      console.warn('rectangle draw not available', err);
    }
  });
  setGreenBtn.addEventListener('click', () => {
    editingMode = 'green';
    drawAreaBtn.classList.remove('active');
    setGreenBtn.classList.add('active');
    areaFirstCorner = null;
  });

  clearAreaBtn.addEventListener('click', () => {
    const holeNum = Number(holeSelect.value);
    if (!holeNum || !markers[holeNum]) return;
    if (markers[holeNum].area) { map.removeLayer(markers[holeNum].area); delete markers[holeNum].area; }
    if (markers[holeNum].tempCornerA) { map.removeLayer(markers[holeNum].tempCornerA); delete markers[holeNum].tempCornerA; }
    document.getElementById(`hole-${holeNum}-area`).value = '';
  });

  centerUserBtn.addEventListener('click', () => {
    if (!navigator.geolocation || !map) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 17);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const numHoles = Number(data.get('numHoles'));
    const holes = Array.from({ length: numHoles }, (_, i) => {
      const num = i + 1;
      const par = Number(data.get(`par-${num}`)) || DEFAULT_PAR;
      const areaVal = String(data.get(`hole-${num}-area`) || '').trim();
      const greenVal = String(data.get(`hole-${num}-green`) || '').trim();
      const hole = { number: num, par };
      if (areaVal) {
        // expected format: swLat,swLng|neLat,neLng
        const parts = areaVal.split('|');
        if (parts.length === 2) {
          const [a, b] = parts;
          const [swLat, swLng] = a.split(',').map((s) => Number(s));
          const [neLat, neLng] = b.split(',').map((s) => Number(s));
          if (![swLat, swLng, neLat, neLng].some((v) => Number.isNaN(v))) {
            hole.area = { sw: { lat: swLat, lng: swLng }, ne: { lat: neLat, lng: neLng } };
          }
        }
      }
      if (greenVal) {
        const [lat, lng] = greenVal.split(',').map((s) => Number(s));
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) hole.green = { lat, lng };
      }
      return hole;
    });
    const name = String(data.get('name') || '').trim();
    if (!name) return;
    let course;
    if (existingCourse) {
      course = Object.assign({}, existingCourse, { name, numHoles, holes, updatedAt: new Date().toISOString() });
    } else {
      course = makeCourse({ name, numHoles, holes });
    }
    await storage.saveCourse(course);
    location.hash = '#/courses';
  });

  // if editing existing course, populate fields
  if (existingCourse) {
    form.name.value = existingCourse.name || '';
    form.numHoles.value = existingCourse.numHoles || 18;
    renderParRows();
    // populate par values and hidden inputs
    if (existingCourse.holes && existingCourse.holes.length) {
      existingCourse.holes.forEach((h) => {
        const num = h.number;
        const parInput = form.querySelector(`input[name="par-${num}"]`);
        const parDisplay = document.getElementById(`par-value-${num}`);
        if (parInput && parDisplay) {
          parInput.value = String(h.par || DEFAULT_PAR);
          parDisplay.textContent = String(h.par || DEFAULT_PAR);
        }
      });
    }
    // if course has mapping info, enable map and load it
    if (existingCourse.holes && existingCourse.holes.some((h) => h.area || h.green)) {
      useMapCheckbox.checked = true;
      mapControls.style.display = '';
      ensureMapInitialized();
      // load markers/areas onto the map
      loadExistingOnMap(existingCourse);
    }
  }
}

export async function renderNewCourse(outlet) {
  return renderCourseForm(outlet, null);
}

export async function renderEditCourse(outlet, params) {
  const course = await storage.getCourse(params.id);
  if (!course) {
    outlet.innerHTML = `<p class="empty-state">Course not found. <a href="#/courses">Back to courses</a></p>`;
    return;
  }
  return renderCourseForm(outlet, course);
}
