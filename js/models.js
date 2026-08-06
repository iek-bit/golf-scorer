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
 *    for courses OpenGolfAPI doesn't have). Par is always considered
 *    confirmed here — the user typed it in on purpose.
 *  - 'api': picked from OpenGolfAPI search. `externalId` links back to
 *    their course id (for facts only — name/location — never geometry).
 *    Per-hole par isn't reliably free from them, so each hole starts at a
 *    placeholder par with `parConfirmed: false` — the play screen asks
 *    once, the first time that hole is played, and saves the answer.
 *
 * Either way, `holes[].tee` and `holes[].green` start out null and get
 * filled in locally the first time someone plays that hole (see
 * mapHoleFromShots in views/play.js) — that geometry is never fetched
 * from OpenGolfAPI, since their precise green/tee data isn't free.
 *
 * Pricing, a booking link, and Youth on Course participation are all
 * entered by hand (see views/courses.js) — there's no free API for live
 * green fees, tee-time booking URLs, or which specific courses
 * participate in Youth on Course, so this is the same "you tell us"
 * pattern as par on a manually-added course.
 *
 * @param {{name: string, numHoles: 9|18, holes: {number: number, par: number, parConfirmed?: boolean}[], source?: 'manual'|'api', externalId?: string|null, location?: {lat:number,lng:number}|null, priceMin?: number|null, priceMax?: number|null, priceDetails?: string, bookingUrl?: string|null, youthOnCourse?: boolean}} args
 */
export function makeCourse({
  name,
  numHoles,
  holes,
  source = 'manual',
  externalId = null,
  location = null,
  priceMin = null,
  priceMax = null,
  priceDetails = '',
  bookingUrl = null,
  youthOnCourse = false,
}) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    name,
    numHoles,
    holes: holes.map((h) => ({ tee: null, green: null, parConfirmed: source === 'manual', ...h })), // [{ number, par, parConfirmed, tee, green }]
    source, // 'manual' | 'api'
    externalId, // OpenGolfAPI course id, or null for manually-added courses
    location, // { lat, lng } — the course's general location, for "nearest course"
    priceMin, // number|null — headline price range shown on the hero card
    priceMax, // number|null — same as priceMin when there's a single flat rate
    priceDetails, // free text: twilight/member/weekday rates, shown behind a "details" tap
    bookingUrl, // string|null — tee-time booking link for this course
    youthOnCourse, // boolean — this course participates in the Youth on Course program (youthoncourse.org)
    createdAt: now,
    updatedAt: now,
  };
}

// Starting point for every new bag — a standard set covering driver
// through wedges. No putter: putts are tracked separately from GPS shot
// distance (see holeScores[].putts vs .shots below), so a putter would
// never be a meaningful choice in the club picker. Easy to edit from here
// (js/views/bags.js) — this is just a reasonable default, not a fixed list.
export const DEFAULT_CLUBS = [
  'Driver',
  '3 Wood',
  '5 Wood',
  'Hybrid',
  '3 Iron',
  '4 Iron',
  '5 Iron',
  '6 Iron',
  '7 Iron',
  '8 Iron',
  '9 Iron',
  'PW',
  'GW',
  'SW',
  'LW',
];

/**
 * A bag is just a named, ordered list of clubs. Multiple bags exist for
 * people who carry different setups (e.g. a full bag vs. a links/travel
 * bag) — which one was in play for a round is recorded as `round.bagId`,
 * chosen at round start if more than one bag exists (see js/views/newRound.js).
 * @param {{name?: string, clubs?: string[]}} args
 */
export function makeBag({ name = 'My Bag', clubs = DEFAULT_CLUBS } = {}) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    name,
    clubs: clubs.map((c) => (typeof c === 'string' ? { id: makeId(), name: c, brand: '', notes: '' } : { brand: '', notes: '', ...c })),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * @param {{courseId: string, holesPlayed: '9'|'18'|'front9'|'back9', holeNumbers: number[], bagId?: string|null}} args
 */
export function makeRound({ courseId, holesPlayed, holeNumbers, bagId = null }) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    courseId,
    holesPlayed,
    bagId, // which bag was carried this round — see makeBag() above. null for rounds started before bags existed.
    startedAt: now,
    completedAt: null,
    // shots: [{ lat, lng, capturedAt, club? }] — GPS-tracked strokes for
    // this hole, in order. shots[0] approximates the tee and is never
    // itself a swing (nothing to assign a club to); every shot after that
    // is the *result* of a swing, so its `club` (optional — see the
    // shot-tracking chip picker in views/play.js) is the club that
    // produced THAT shot, arriving at that position — not whatever's
    // about to be hit next. `strokes` stays the authoritative score even
    // if some shots were logged manually (no location) via the +/- fallback.
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
