// icons.js
//
// Small line-art icons shared across two or more views — kept here so
// e.g. the Youth on Course tag reads identically on the home tile, the
// course form, and Settings instead of drifting. A view that only ever
// needs one icon still just defines it locally (see flagIcon/crosshairIcon
// in views/play.js) — this file is only for the ones that repeat.
//
// Every icon here follows the same stroke language as the rest of the
// app (round caps/joins, currentColor, no fills except small dots) so
// nothing reads as a mismatched icon set — and deliberately never a
// system emoji, which is the whole point of drawing these by hand.

export function sunIcon(size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/></svg>`;
}

export function moonIcon(size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5a8.5 8.5 0 1 0 11.2 11.2Z"/></svg>`;
}

// A price tag — Youth on Course's whole identity is "$5 or less," so a
// tag reads more true to what it actually means than a generic golf
// glyph (which the flag icon already covers elsewhere in the app).
export function youthOnCourseIcon(size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/></svg>`;
}

// Booking / "open elsewhere" — a small arrow escaping a box, standard
// shorthand for "this leaves the app."
export function externalLinkIcon(size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 13.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5h5.5"/></svg>`;
}

export function chevronIcon(size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
}

export function pinIcon(size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.4-7-11.5A7 7 0 0 1 19 9.5C19 14.6 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.2"/></svg>`;
}

// --- Navigation rail icons (Home / Courses / Bags / Stats / Settings) ---
// Filled variants (used for the active item) are the same silhouette with
// fill: currentColor instead of a stroke outline — matching M3's own
// nav-rail convention of a filled icon marking the selected destination.

export function homeIcon(size = 22, filled = false) {
  if (filled) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"><path d="M12 3.2 3 10.5V21h6v-6h6v6h6V10.5L12 3.2Z"/></svg>`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/></svg>`;
}

export function coursesIcon(size = 22, filled = false) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="21" x2="6" y2="3"/><path d="M6 4h13l-3.5 4.5L19 13H6" fill="${filled ? 'currentColor' : 'none'}"/></svg>`;
}

export function bagsIcon(size = 22, filled = false) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21 6.5 9h11L16 21" fill="${filled ? 'currentColor' : 'none'}"/><path d="M9.5 9V6a2.5 2.5 0 0 1 5 0v3"/><line x1="5.5" y1="9" x2="18.5" y2="9"/></svg>`;
}

export function statsIcon(size = 22, filled = false) {
  if (filled) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"><rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="7" width="4" height="13" rx="1"/><rect x="16" y="3" width="4" height="17" rx="1"/></svg>`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="7" width="4" height="13" rx="1"/><rect x="16" y="3" width="4" height="17" rx="1"/></svg>`;
}

export function settingsIcon(size = 22, filled = false) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" fill="${filled ? 'currentColor' : 'none'}"/><path d="M19.4 13a7.4 7.4 0 0 0 0-2l2-1.5-2-3.5-2.4.8a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.3 2.3a7.6 7.6 0 0 0-1.7 1l-2.4-.8-2 3.5L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-.8a7.6 7.6 0 0 0 1.7 1L11 21h4l.3-2.3a7.6 7.6 0 0 0 1.7-1l2.4.8 2-3.5-2-1.5Z"/></svg>`;
}
