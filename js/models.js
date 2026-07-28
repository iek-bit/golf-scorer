// models.js
//
// Field names and shapes defined here are the local mirror of the future
// Cloudflare DB schema (players, courses, rounds, hole_scores tables).
// Keeping these consistent now means Stage 4 (the DB migration) is a
// storage-layer swap, not a data-model rewrite.

export const SCHEMA_VERSION = 2;

export function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers without crypto.randomUUID
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * A course can come from two places:
 *  - 'manual': the user typed in name/holes/par (Stage 1 flow, still here
 *    for courses OpenGolfAPI doesn't have).
 *  - 'api': picked from OpenGolfAPI search. `externalId` links back to
 *    their course id (for facts only — name/location — never geometry).
 *
 * Either way, `holes[].tee` and `holes[].green` start out null and get
 * filled in locally the first time someone plays that hole (see
 * inferGeoFromShots in views/play.js) — that geometry is never fetched
 * from OpenGolfAPI, since their precise green/tee data isn't free.
 *
 * @param {{name: string, numHoles: 9|18, holes: {number: number, par: number}[], source?: 'manual'|'api', externalId?: string|null, location?: {lat:number,lng:number}|null}} args
 */
export function makeCourse({ name, numHoles, holes, source = 'manual', externalId = null, location = null }) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    name,
    numHoles,
    holes: holes.map((h) => ({ tee: null, green: null, ...h })), // [{ number, par, tee, green }]
    source, // 'manual' | 'api'
    externalId, // OpenGolfAPI course id, or null for manually-added courses
    location, // { lat, lng } — the course's general location, for "nearest course"
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * @param {{courseId: string, holesPlayed: '9'|'18'|'front9'|'back9', holeNumbers: number[]}} args
 */
export function makeRound({ courseId, holesPlayed, holeNumbers }) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    courseId,
    holesPlayed,
    startedAt: now,
    completedAt: null,
    // shots: [{ lat, lng, capturedAt }] — GPS-tracked strokes for this hole,
    // in order. shots[0] approximates the tee; the last one approximates
    // the pin. `strokes` stays the authoritative score even if some shots
    // were logged manually (no location) via the +/- fallback.
    holeScores: holeNumbers.map((n) => ({ holeNumber: n, strokes: null, putts: null, shots: [] })),
  };
}

export function makePlayer(name) {
  return {
    id: makeId(),
    name: name || 'Player',
    createdAt: new Date().toISOString(),
  };
}
