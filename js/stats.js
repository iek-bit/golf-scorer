// stats.js
//
// Lightweight aggregate stats from whatever round data already exists
// locally. This is intentionally simple — Stage 3 is where filtering by
// club, distance, landing type, date range, etc. gets built. This module
// is the seed that gets extended then, not replaced.

import { totalForRound } from './views/home.js';
import { haversineMeters, metersToYards } from './geo.js';

const MIN_SHOTS_FOR_OUTLIERS = 5; // fewer than this and "outlier" isn't a meaningful idea yet
const OUTLIER_STDDEV_THRESHOLD = 1.5;

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

/**
 * Per-club distance stats from every GPS-tracked shot that has a club
 * attached — across ALL rounds, not just completed ones (a shot tracked
 * mid-round is real data, no reason to wait for the round to finish).
 * Each shot's distance is measured from the position right before it
 * (the tee for a hole's first tracked shot, otherwise the previous
 * tracked shot) to where it landed — see the makeRound() comment in
 * models.js for why that's the correct pairing of position and club.
 *
 * @param {object[]} rounds
 * @returns {Array<{
 *   club: string, shotCount: number, average: number,
 *   averageExcludingOutliers: number, longest: number,
 *   outliers: Array<{distanceYards: number, roundId: string, holeNumber: number, capturedAt: string}>
 * }>} sorted longest-average-first (driver-to-wedges order, roughly)
 */
export function computeClubStats(rounds) {
  const byClub = new Map();

  for (const round of rounds) {
    for (const holeScore of round.holeScores) {
      const shots = holeScore.shots || [];
      for (let i = 1; i < shots.length; i++) {
        const club = shots[i].club;
        if (!club) continue; // shot was tracked but the club prompt was skipped
        const distanceYards = metersToYards(haversineMeters(shots[i - 1], shots[i]));
        if (!Number.isFinite(distanceYards) || distanceYards <= 0) continue;
        if (!byClub.has(club)) byClub.set(club, []);
        byClub.get(club).push({ distanceYards, roundId: round.id, holeNumber: holeScore.holeNumber, capturedAt: shots[i].capturedAt });
      }
    }
  }

  const results = [];
  for (const [club, entries] of byClub) {
    const distances = entries.map((e) => e.distanceYards);
    const average = mean(distances);
    const longest = Math.max(...distances);

    let outliers = [];
    let averageExcludingOutliers = average;
    if (entries.length >= MIN_SHOTS_FOR_OUTLIERS) {
      const sd = stddev(distances, average);
      if (sd > 0) {
        const isOutlier = (d) => Math.abs(d - average) > OUTLIER_STDDEV_THRESHOLD * sd;
        const kept = entries.filter((e) => !isOutlier(e.distanceYards));
        outliers = entries.filter((e) => isOutlier(e.distanceYards));
        if (kept.length) averageExcludingOutliers = mean(kept.map((e) => e.distanceYards));
      }
    }

    results.push({ club, shotCount: entries.length, average, averageExcludingOutliers, longest, outliers });
  }

  return results.sort((a, b) => b.average - a.average);
}

function mean(nums) {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function stddev(nums, avg) {
  const variance = nums.reduce((s, n) => s + (n - avg) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}
