// api/opengolfapi.js
//
// Deliberately thin wrapper around ONE endpoint: OpenGolfAPI's plain,
// keyless course search (GET /v1/courses/search). That's it.
//
// OpenGolfAPI's broader platform bundles an identity system ("OpenGolf
// ID," derived from a hash of your email), a Bitcoin-anchored verification
// chain, and an asset-minting system — none of which this app touches or
// needs. We only ever call the read-only search route below, no sign-in,
// no dev key, no writes. If that endpoint ever changes shape or goes away,
// every caller here fails soft (empty array), and "add a course manually"
// (js/views/courses.js) still works as a complete fallback.

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

  return data.courses.map((c) => ({
    externalId: c.id,
    name: c.course_name || c.name || 'Unnamed course',
    city: c.city || null,
    state: c.state || null,
    lat: c.latitude,
    lng: c.longitude,
    par: c.par ?? c.par_total ?? null,
  }));
}

// A fixed 25mi radius comes up empty in areas where OpenGolfAPI's
// coverage is thin, which made "nearest course" look broken rather than
// just under-covered. This tries progressively wider radii and returns
// the first non-empty result set.
const NEARBY_RADII_MI = [25, 50, 100];

/**
 * @param {{lat: number, lng: number, limit?: number}} args
 * @returns {Promise<{externalId, name, city, state, lat, lng, par}[]>}
 */
export async function searchNearbyCourses({ lat, lng, limit = 30 } = {}) {
  for (const radiusMi of NEARBY_RADII_MI) {
    const results = await searchCourses({ lat, lng, radiusMi, limit });
    if (results.length) return results;
  }
  return [];
}
