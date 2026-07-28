// stats.js
//
// Lightweight aggregate stats from whatever round data already exists
// locally. This is intentionally simple — Stage 3 is where filtering by
// club, distance, landing type, date range, etc. gets built. This module
// is the seed that gets extended then, not replaced.

import { totalForRound } from './views/home.js';

/**
 * @param {object[]} rounds
 * @param {object[]} courses
 */
export function computeStats(rounds, courses) {
  const completed = rounds.filter((r) => r.completedAt);

  if (!completed.length) {
    return { roundsPlayed: 0 };
  }

  const totals = completed.map((r) => totalForRound(r, courses.find((c) => c.id === r.courseId)));
  const avgToPar = totals.reduce((sum, t) => sum + t.toPar, 0) / totals.length;

  const best = completed.reduce((bestSoFar, round) => {
    const t = totalForRound(round, courses.find((c) => c.id === round.courseId));
    if (!bestSoFar || t.toPar < bestSoFar.toPar) {
      return { round, ...t };
    }
    return bestSoFar;
  }, null);

  const totalPutts = completed.reduce((sum, r) => sum + r.holeScores.reduce((s, h) => s + (h.putts || 0), 0), 0);
  const totalHolesWithPutts = completed.reduce((sum, r) => sum + r.holeScores.filter((h) => h.putts != null).length, 0);
  const avgPutts = totalHolesWithPutts ? totalPutts / totalHolesWithPutts : null;

  return {
    roundsPlayed: completed.length,
    avgToPar,
    best,
    avgPuttsPerHole: avgPutts,
  };
}
