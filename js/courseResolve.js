// courseResolve.js
//
// Turns an OpenGolfAPI search result into a real, saved local Course
// record — reusing the existing one if this course has been played
// before (matched by externalId), otherwise creating it. Shared by
// js/views/home.js (resolving the "nearest course" suggestion) and
// js/views/newRound.js (picking a course from search) so there's exactly
// one place that owns "how an API result becomes a local course."

import { storage } from './storage.js';
import { makeCourse } from './models.js';
import { getCourseHoleCount } from './api/opengolfapi.js';

const FALLBACK_HOLE_COUNT = 18; // only used if the real count can't be determined at all
const DEFAULT_PAR = 4;

/**
 * @param {{externalId, name, lat, lng}} apiCourse
 * @param {object[]} localCourses — current local course list; mutated in
 *   place (a newly-created course is pushed onto it) so callers holding a
 *   reference stay in sync without a second storage.getCourses() round trip.
 */
export async function ensureLocalCourse(apiCourse, localCourses) {
  const existing = localCourses.find((c) => c.externalId === apiCourse.externalId);
  if (existing) return existing;

  // Assuming every API course has 18 holes was a real bug: a genuinely
  // 9-hole course (there are plenty — small municipal courses especially)
  // got 9 fabricated extra holes tacked on. One extra lookup against the
  // full course detail (holes.length) at the moment a course is first
  // saved gets the real count; only falls back to 18 if that's
  // undeterminable (detail fetch failed, or the course has no holes data).
  const numHoles = (await getCourseHoleCount(apiCourse.externalId)) || FALLBACK_HOLE_COUNT;

  // Par isn't reliably free from OpenGolfAPI, so every hole starts at a
  // placeholder par with parConfirmed: false — see makeCourse().
  const holes = Array.from({ length: numHoles }, (_, i) => ({ number: i + 1, par: DEFAULT_PAR }));
  const course = makeCourse({
    name: apiCourse.name,
    numHoles,
    holes,
    source: 'api',
    externalId: apiCourse.externalId,
    location: apiCourse.lat != null ? { lat: apiCourse.lat, lng: apiCourse.lng } : null,
  });
  await storage.saveCourse(course);
  localCourses.push(course);
  return course;
}
