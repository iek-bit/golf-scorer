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

// Official Google Material Symbols (Outlined, weight 400) paths — sunny,
// cloud, rainy, weather_snowy — rather than emoji (inconsistent across
// platforms/fonts) or hand-drawn icons. Kept local to this module (not in
// icons.js) since this sun/cloud/rain/snow set is self-contained and only
// used for weather condition badges, not reused elsewhere the way
// icons.js's contents are.
const CONDITION_ICONS = {
  sun: '<path d="M450-770v-150h60v150h-60Zm256 106-42-42 106-107 42 43-106 106Zm64 214v-60h150v60H770ZM450-40v-150h60v150h-60ZM253-665 148-770l42-42 106 106-43 41Zm518 517L664-254l41-41 108 104-42 43ZM40-450v-60h150v60H40Zm151 302-43-42 105-105 22 20 22 21-106 106Zm119-162q-70-70-70-170t70-170q70-70 170-70t170 70q70 70 70 170t-70 170q-70 70-170 70t-170-70Zm297.5-42.5Q660-405 660-480t-52.5-127.5Q555-660 480-660t-127.5 52.5Q300-555 300-480t52.5 127.5Q405-300 480-300t127.5-52.5ZM480-480Z"/>',
  cloud: '<path d="M251-160q-88 0-149.5-61.5T40-371q0-78 50-137t127-71q20-97 94-158.5T482-799q112 0 189 81.5T748-522v24q72-2 122 46.5T920-329q0 69-50 119t-119 50H251Z"/>',
  rain: '<path d="M558-83q-11 5-23.5 1T517-97l-69-138q-5-11-1.5-23.5T461-276q11-5 23.5-1t17.5 15l69 138q5 11 1.5 23.5T558-83Zm240-1q-11 5-23.5 1T757-98l-69-138q-5-11-1.5-23.5T701-277q11-5 23.5-1t17.5 15l69 138q5 11 1.5 23.5T798-84Zm-480 0q-11 5-23.5 1.5T277-97l-69-138q-5-11-1-23.5t15-17.5q11-5 23.5-1.5T263-263l69 139q5 11 1 23t-15 17Zm-28-256q-87 0-148.5-61.5T80-550q0-79 56.5-141T277-759q32-56 84.5-88.5T480-880q91 0 152.5 57.5T708-680q79 4 125.5 53.5T880-510q0 70-49.5 120T710-340H290Z"/>',
  snow: '<path d="M231.5-221.64q-11.5-11.64-11.5-28.5t11.64-28.36q11.64-11.5 28.5-11.5t28.36 11.64q11.5 11.64 11.5 28.5t-11.64 28.36q-11.64 11.5-28.5 11.5t-28.36-11.64Zm120 130q-11.5-11.64-11.5-28.5t11.64-28.36q11.64-11.5 28.5-11.5t28.36 11.64q11.5 11.64 11.5 28.5T408.36-91.5Q396.72-80 379.86-80T351.5-91.64Zm120-130q-11.5-11.64-11.5-28.5t11.64-28.36q11.64-11.5 28.5-11.5t28.36 11.64q11.5 11.64 11.5 28.5t-11.64 28.36q-11.64 11.5-28.5 11.5t-28.36-11.64Zm240 0q-11.5-11.64-11.5-28.5t11.64-28.36q11.64-11.5 28.5-11.5t28.36 11.64q11.5 11.64 11.5 28.5t-11.64 28.36q-11.64 11.5-28.5 11.5t-28.36-11.64Zm-120 130q-11.5-11.64-11.5-28.5t11.64-28.36q11.64-11.5 28.5-11.5t28.36 11.64q11.5 11.64 11.5 28.5T648.36-91.5Q636.72-80 619.86-80T591.5-91.64ZM290-380q-86.86 0-148.43-61.52Q80-503.04 80-589.83 80-669 136.5-731 193-793 277-799q32-56 84.5-88.5T480.42-920q90.58 0 152.08 57.5Q694-805 708-720q79 4 125.5 53.5T880-550.38Q880-480 830.42-430 780.83-380 710-380H290Z"/>',
};

export function weatherIconSvg(condition, size = 16) {
  const paths = CONDITION_ICONS[condition] || CONDITION_ICONS.sun;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor">${paths}</svg>`;
}

/**
 * @param {string} externalId — an OpenGolfAPI course id (course.externalId)
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
