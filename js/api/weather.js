// api/weather.js
//
// A round's weather is deliberately simple: wind speed + direction, and
// one of four conditions (sun/cloud/rain/snow) — not a full forecast UI.
// Two OpenGolfAPI endpoints, both free/keyless, both keyed by their
// course id (so only API-sourced courses get weather — a manually-added
// course has no externalId to ask about, and there's no coordinate-based
// weather endpoint to fall back to):
//
//  - /courses/{id}/conditions — model-based, precise wind_mph/direction/
//    gust/temp/precip, documented in OpenGolfAPI's own spec down to the
//    field names, so this is trusted directly.
//  - /courses/{id}/weather — a passthrough of a Weather.gov forecast.
//    OpenGolfAPI's docs don't pin down its exact shape, so this is only
//    ever used for its short text description (checked against several
//    likely field names) to classify sky condition — wind/temp always
//    come from /conditions above, never guessed from forecast text.
//
// If either call fails, or the course has no externalId, this fails soft
// (null) — same pattern as api/opengolfapi.js. A round without weather is
// a round with no weather section, not a broken one.

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

const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function degToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return null;
  return COMPASS_POINTS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

// Classifies into exactly the 4 conditions the person asked for. Forecast
// text (when we have it) wins, since it can distinguish sun from cloud —
// precipitation/temp alone can't. Without it, no rain/snow signal means
// "sun" is the only thing left to say (no cloud-cover number to read).
function classifyCondition({ precipitationIn, tempF, forecastText }) {
  const text = (forecastText || '').toLowerCase();
  if (text) {
    if (/snow|sleet|flurr/.test(text)) return 'snow';
    if (/rain|shower|drizzle|storm|thunder/.test(text)) return 'rain';
    if (/cloud|overcast/.test(text)) return 'cloud';
    if (/sun|clear|fair/.test(text)) return 'sun';
  }
  if (precipitationIn > 0.02) return tempF != null && tempF <= 34 ? 'snow' : 'rain';
  return 'sun';
}

function extractForecastText(data) {
  // Try the field names a Weather.gov-style payload is most likely to
  // use, in order — whichever OpenGolfAPI actually normalizes to.
  const period = data?.periods?.[0] || data?.properties?.periods?.[0] || data;
  return period?.shortForecast || period?.short_forecast || period?.summary || period?.forecast || period?.description || null;
}

const CONDITION_LABELS = { sun: 'Sunny', cloud: 'Cloudy', rain: 'Rain', snow: 'Snow' };

export function weatherConditionLabel(condition) {
  return CONDITION_LABELS[condition] || 'Unknown';
}

// Small stroke-based icons (matching the directions button's style
// elsewhere on the hero tile) rather than emoji, which render
// inconsistently across platforms and fonts.
const CONDITION_ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloud: '<path d="M7 18a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18 12a3.5 3.5 0 0 1-.5 6.98H7Z"/>',
  rain: '<path d="M7 15a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18 9a3.5 3.5 0 0 1-.5 6.98"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
  snow: '<path d="M7 15a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18 9a3.5 3.5 0 0 1-.5 6.98"/><path d="M9 19v3M9 19l-1.5 1M9 19l1.5 1M15 19v3M15 19l-1.5 1M15 19l1.5 1"/>',
};

export function weatherIconSvg(condition, size = 16) {
  const paths = CONDITION_ICONS[condition] || CONDITION_ICONS.sun;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}


 * @returns {Promise<{tempF, windSpeedMph, windDirectionDeg, windGustMph, condition: 'sun'|'cloud'|'rain'|'snow', fetchedAt}|null>}
 */
export async function getCourseWeather(externalId) {
  if (!externalId) return null;

  const [conditionsData, weatherData] = await Promise.all([
    safeFetchJson(`${BASE_URL}/api/v1/courses/${externalId}/conditions`),
    safeFetchJson(`${BASE_URL}/api/v1/courses/${externalId}/weather`),
  ]);

  const conditions = conditionsData?.conditions || conditionsData;
  if (!conditions || conditions.wind == null) return null; // nothing usable came back

  return {
    tempF: conditions.temp_f ?? null,
    windSpeedMph: conditions.wind?.speed_mph ?? null,
    windDirectionDeg: conditions.wind?.direction_deg ?? null,
    windGustMph: conditions.wind?.gust_mph ?? null,
    condition: classifyCondition({
      precipitationIn: conditions.precipitation_in ?? 0,
      tempF: conditions.temp_f ?? null,
      forecastText: extractForecastText(weatherData),
    }),
    fetchedAt: new Date().toISOString(),
  };
}
