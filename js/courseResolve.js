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
import { getCourseHoleDetails } from './api/opengolfapi.js';

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

  // One extra lookup against the full course detail, done once, right
  // here, at the moment a course is first saved:
  //  - hole count: assuming every API course was 18 holes was a real
  //    bug (a genuinely 9-hole course got 9 fabricated extra holes) —
  //    falls back to 18 only if this is truly undeterminable.
  //  - real per-hole par, when OpenGolfAPI actually has it: skips the
  //    placeholder-par-then-confirm flow entirely for that hole. When it
  //    doesn't, holes come back null and nothing about that flow changes.
  const { count, holes: realHoles } = await getCourseHoleDetails(apiCourse.externalId);
  const numHoles = count || FALLBACK_HOLE_COUNT;

  const holes = realHoles
    ? realHoles.map((h) => ({ number: h.number, par: h.par, parConfirmed: true }))
    : Array.from({ length: numHoles }, (_, i) => ({ number: i + 1, par: DEFAULT_PAR }));

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
