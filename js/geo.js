// geo.js
//
// Thin wrapper around the browser Geolocation API, plus the distance math
// both the rangefinder and "nearest course" hero tile need. Kept separate
// from any view so both can share it without duplicating the haversine math.

const EARTH_RADIUS_M = 6371000;

/**
 * Great-circle distance between two {lat, lng} points, in meters.
 */
export function haversineMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function metersToYards(m) {
  return m * 1.09361;
}

/**
 * Sorts a copy of `items` by distance from `position`. Items whose
 * location is unknown (getLatLng returns null/undefined) sort to the end
 * rather than being dropped, so "no location on file" doesn't hide a
 * course — it just doesn't get to claim to be the nearest one. Returns
 * `items` unchanged (same order) if `position` isn't known yet.
 */
export function sortByDistance(position, items, getLatLng) {
  if (!position) return items;
  return [...items].sort((a, b) => {
    const locA = getLatLng(a);
    const locB = getLatLng(b);
    if (!locA && !locB) return 0;
    if (!locA) return 1;
    if (!locB) return -1;
    return haversineMeters(position, locA) - haversineMeters(position, locB);
  });
}

/**
 * Promise wrapper around navigator.geolocation.getCurrentPosition.
 * Rejects with a plain Error (not a raw GeolocationPositionError) so
 * callers can just read err.message.
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not available on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission was denied.'));
        } else {
          reject(new Error('Could not get your location. Try again.'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000, ...options }
    );
  });
}
