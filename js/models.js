// models.js
//
// Field names and shapes defined here are the local mirror of the future
// Cloudflare DB schema (players, courses, rounds, hole_scores tables).
// Keeping these consistent now means Stage 4 (the DB migration) is a
// storage-layer swap, not a data-model rewrite.

export const SCHEMA_VERSION = 1;

export function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers without crypto.randomUUID
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * @param {{name: string, numHoles: 9|18, holes: {number: number, par: number}[]}} args
 */
export function makeCourse({ name, numHoles, holes }) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    name,
    numHoles,
    holes, // [{ number, par }]
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
    holeScores: holeNumbers.map((n) => ({ holeNumber: n, strokes: null, putts: null })),
  };
}

export function makePlayer(name) {
  return {
    id: makeId(),
    name: name || 'Player',
    createdAt: new Date().toISOString(),
  };
}
