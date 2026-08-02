// api/opengolfapi.js
//
// Wrapper around OpenGolfAPI's plain, keyless course endpoints — no
// sign-in, no dev key, no writes.
//
// OpenGolfAPI's broader platform bundles an identity system ("OpenGolf
// ID," derived from a hash of your email), a Bitcoin-anchored verification
// chain, and an asset-minting system — none of which this app touches or
// needs. If these endpoints ever change shape or go away, every caller
// here fails soft (empty array), and "add a course manually"
// (js/views/courses.js) still works as a complete fallback.
//
// Why "nearby" doesn't just call /courses/search?lat&lng&radius_mi and
// trust it: that endpoint returned real results, but not reliably the
// *closest* ones — a manually-confirmed-real course (findable by name)
// was consistently missing from its location-search results close to
// home, on multiple devices. Whether that's the server not sorting by
// true distance, or truncating to `limit` before it does, isn't
// something we can fix or fully verify from outside the API — so instead
// of trusting it, searchNearbyCourses() below pulls the user's *entire*
// home state via /courses/state/{code} (a plain, unambiguous listing,
// paginated to get all of it) and ranks that ourselves with the same
// haversine math already used everywhere else in this app. The old
// radius search is kept and merged in too, purely as extra coverage for
// courses OpenGolfAPI hasn't tagged with a state.

import { statesContainingPoint } from '../usStates.js';
import { haversineMeters } from '../geo.js';

const BASE_URL = 'https://api.opengolfapi.org';

async function safeFetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function mapCourse(c) {
  return {
    externalId: c.id,
    name: c.course_name || c.name || 'Unnamed course',
    city: c.city || null,
    state: c.state || null,
    lat: c.latitude,
    lng: c.longitude,
    par: c.par ?? c.par_total ?? null,
  };
}

/**
 * @param {{q?: string, lat?: number, lng?: number, radiusMi?: number, limit?: number}} args
 * @returns {Promise<{externalId, name, city, state, lat, lng, par}[]>}
 */
export async function searchCourses({ q, lat, lng, radiusMi = 25, limit = 15 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (lat != null && lng != null) {
    params.set('lat', String(lat));
    params.set('lng', String(lng));
    params.set('radius_mi', String(radiusMi));
  }
  params.set('limit', String(limit));

  const data = await safeFetchJson(`${BASE_URL}/v1/courses/search?${params.toString()}`);
  if (!data || !Array.isArray(data.courses)) return [];
  return data.courses.map(mapCourse);
}

// PAGE_SIZE / MAX_PAGES bound how much we'll fetch for one state — a US
// state tops out around ~1,600 courses (TX); at 200/page that's 8 calls,
// worst case, for the single largest state in the country. Most states
// finish in 1-2 calls.
const STATE_PAGE_SIZE = 200;
const STATE_MAX_PAGES = 10;

/**
 * Every course in one US state, unambiguous and unfiltered by distance —
 * the thing /courses/search's lat/lng mode was supposed to give us a
 * ranked subset of, but couldn't be trusted to.
 * @returns {Promise<{externalId, name, city, state, lat, lng, par}[]>}
 */
// In-memory only (not persisted) — cleared on a real page reload, which is
// exactly the lifetime we want: home.js resolves "nearest" on load, then
// newRound.js immediately does the same work again if you tap through to
// it, and without this they'd both pay the full multi-page state fetch.
// A stale cached list (a brand-new course added to OpenGolfAPI mid-session)
// is an acceptable trade for not re-fetching a few hundred courses per tap.
const stateListCache = new Map();

export async function searchCoursesByState(code) {
  if (stateListCache.has(code)) return stateListCache.get(code);

  const all = [];
  for (let page = 0; page < STATE_MAX_PAGES; page++) {
    const offset = page * STATE_PAGE_SIZE;
    const data = await safeFetchJson(`${BASE_URL}/v1/courses/state/${code}?limit=${STATE_PAGE_SIZE}&offset=${offset}`);
    if (!data || !Array.isArray(data.courses) || !data.courses.length) break;
    all.push(...data.courses.map(mapCourse));
    if (typeof data.total === 'number' && all.length >= data.total) break;
    if (data.courses.length < STATE_PAGE_SIZE) break; // short page = last page
  }
  stateListCache.set(code, all);
  return all;
}

// The compact search/state results (mapCourse above) never include a hole
// count — only par_total, which isn't a reliable proxy (a par-70 18-hole
// course and a par-35 9-hole course don't share a fixed ratio). The only
// place OpenGolfAPI actually exposes hole count is the full CourseDetail's
// `holes` array length, via a second per-course fetch — worth doing once,
// right when a course is first saved locally (see ensureLocalCourse in
// js/courseResolve.js), rather than assuming every course is 18 holes.
/**
 * @returns {Promise<number|null>} real hole count, or null if undeterminable
 */
export async function getCourseHoleCount(externalId) {
  if (!externalId) return null;
  const data = await safeFetchJson(`${BASE_URL}/api/v1/courses/${externalId}`);
  const count = Array.isArray(data?.holes) ? data.holes.length : null;
  return count > 0 ? count : null;
}

/**
 * @param {{lat: number, lng: number, limit?: number}} args
 * @returns {Promise<{externalId, name, city, state, lat, lng, par}[]>}
 */
export async function searchNearbyCourses({ lat, lng, limit = 30 } = {}) {
  const stateCodes = statesContainingPoint(lat, lng); // usually 1, sometimes 2 near a border, rarely 0

  const [stateBatches, radiusResults] = await Promise.all([
    Promise.all(stateCodes.map((code) => searchCoursesByState(code))),
    searchCourses({ lat, lng, radiusMi: 50, limit: 100 }), // extra coverage; see module note above
  ]);

  const byId = new Map();
  for (const course of [...stateBatches.flat(), ...radiusResults]) {
    if (course.lat == null || course.lng == null) continue; // can't rank what we can't place
    if (!byId.has(course.externalId)) byId.set(course.externalId, course);
  }

  return [...byId.values()]
    .sort((a, b) => haversineMeters({ lat, lng }, { lat: a.lat, lng: a.lng }) - haversineMeters({ lat, lng }, { lat: b.lat, lng: b.lng }))
    .slice(0, limit);
}
