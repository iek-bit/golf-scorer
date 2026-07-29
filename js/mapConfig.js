// mapConfig.js
//
// Shared tile sources so the hero tile background and the play-screen map
// (js/views/home.js, js/views/play.js) don't each hardcode their own URL.
//
// Esri World Imagery: free, keyless satellite tiles — used everywhere we
// show a course as an image (no signup, no billing account, unlike Google
// Maps — see the mapping research notes from planning this stage).
export const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const SATELLITE_ATTRIBUTION = 'Esri';

// OpenStreetMap: used as a fallback/base layer where a plain map (not
// satellite) reads better.
export const STREET_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const STREET_ATTRIBUTION = '&copy; OpenStreetMap contributors';
