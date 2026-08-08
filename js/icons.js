// icons.js
//
// Every icon in this app now comes from Google's official Material
// Symbols set (Outlined, weight 400) — https://fonts.google.com/icons —
// rather than the hand-drawn stroke icons used in earlier passes. Paths
// below are the unmodified `d` attributes from the official
// @material-symbols/svg-400 package (Apache 2.0), each wrapped in the
// same small helper shape: viewBox="0 -960 960 960" (Material Symbols'
// standard coordinate space), fill="currentColor" (a filled glyph, not
// a stroke icon — that's the Material Symbols style), sized by the
// `size` param the same way every caller already expects.
//
// This file is also now the single home for every icon used more than
// once across the app — several views used to define their own local
// close/trash/chevron/flag/crosshair icon instead of importing a shared
// one, which meant the same concept could quietly drift into two
// slightly different SVGs over time. Consolidating them here follows
// this file's own original rule ("only for the ones that repeat") more
// completely than before.

function materialIcon(path, size, viewBox = '0 -960 960 960') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="currentColor">${path}</svg>`;
}

export function sunIcon(size = 20) {
  return materialIcon(
    '<path d="M579-381q41-41 41-99t-41-99q-41-41-99-41t-99 41q-41 41-41 99t41 99q41 41 99 41t99-41Zm-240.5 42.5Q280-397 280-480t58.5-141.5Q397-680 480-680t141.5 58.5Q680-563 680-480t-58.5 141.5Q563-280 480-280t-141.5-58.5ZM200-450H40v-60h160v60Zm720 0H760v-60h160v60ZM450-760v-160h60v160h-60Zm0 720v-160h60v160h-60ZM262-658l-100-97 43-44 96 100-39 41Zm494 496-98-100 41-41 99 98-42 43Zm-99-537 98-99 44 42-99 98-43-41ZM162-205l99-98 42 42-98 99-43-43Zm318-275Z"/>',
    size
  );
}

export function moonIcon(size = 20) {
  return materialIcon(
    '<path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q8 0 17 .5t23 1.5q-36 32-56 79t-20 99q0 90 63 153t153 63q52 0 99-18.5t79-51.5q1 12 1.5 19.5t.5 14.5q0 150-105 255T480-120Zm0-60q109 0 190-67.5T771-406q-25 11-53.67 16.5Q688.67-384 660-384q-114.69 0-195.34-80.66Q384-545.31 384-660q0-24 5-51.5t18-62.5q-98 27-162.5 109.5T180-480q0 125 87.5 212.5T480-180Zm-4-297Z"/>',
    size
  );
}

// A price tag ("sell") — Youth on Course's whole identity is "$5 or
// less," so a tag reads truer to what it means than a generic golf glyph
// (golf_course/flag already cover that elsewhere in the app).
export function youthOnCourseIcon(size = 18) {
  return materialIcon(
    '<path d="M863-404 557-97q-9 8.5-20.25 12.75T514.25-80Q503-80 492-84.5T472-97L98-472q-8-8-13-18.96-5-10.95-5-23.04v-306q0-24.75 17.63-42.38Q115.25-880 140-880h307q12.07 0 23.39 4.87Q481.7-870.25 490-862l373 373q9.39 9 13.7 20.25 4.3 11.25 4.3 22.5t-4.5 22.75Q872-412 863-404ZM516-138l306-307-375-375H140v304l376 378ZM245-664q21 0 36.5-15.5T297-716q0-21-15.5-36.5T245-768q-21 0-36.5 15.5T193-716q0 21 15.5 36.5T245-664Zm236 185Z"/>',
    size
  );
}

// Booking / "open elsewhere" — a small arrow escaping a box, standard
// shorthand for "this leaves the app."
export function externalLinkIcon(size = 16) {
  return materialIcon(
    '<path d="M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h279v60H180v600h600v-279h60v279q0 24-18 42t-42 18H180Zm202-219-42-43 398-398H519v-60h321v321h-60v-218L382-339Z"/>',
    size
  );
}

export function chevronIcon(size = 16) {
  return materialIcon('<path d="M530-481 332-679l43-43 241 241-241 241-43-43 198-198Z"/>', size);
}

export function pinIcon(size = 14) {
  return materialIcon(
    '<path d="M529.5-510.5Q550-531 550-560t-20.5-49.5Q509-630 480-630t-49.5 20.5Q410-589 410-560t20.5 49.5Q451-490 480-490t49.5-20.5ZM480-159q133-121 196.5-219.5T740-552q0-118-75.5-193T480-820q-109 0-184.5 75T220-552q0 75 65 173.5T480-159Zm0 79Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z"/>',
    size
  );
}

// A plain circled "i" — the "more info" affordance next to the Youth on
// Course toggle in Settings, and available anywhere else a short
// explanation needs a tap-to-reveal trigger instead of always-on text.
export function infoIcon(size = 16) {
  return materialIcon(
    '<path d="M453-280h60v-240h-60v240Zm50.5-323.2q9.5-9.2 9.5-22.8 0-14.45-9.48-24.22-9.48-9.78-23.5-9.78t-23.52 9.78Q447-640.45 447-626q0 13.6 9.48 22.8 9.48 9.2 23.5 9.2t23.52-9.2ZM480.27-80q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34Q80-397.68 80-480.5t31.5-155.66Q143-709 197.5-763t127.34-85.5Q397.68-880 480.5-880t155.66 31.5Q709-817 763-763t85.5 127Q880-563 880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80Zm.23-60Q622-140 721-239.5t99-241Q820-622 721.19-721T480-820q-141 0-240.5 98.81T140-480q0 141 99.5 240.5t241 99.5Zm-.5-340Z"/>',
    size
  );
}

// A simple X — closing a bottom sheet (course price details, club-picker
// help, the Youth on Course info sheet).
export function closeIcon(size = 16) {
  return materialIcon('<path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z"/>', size);
}

// A trash can — every "delete this" button in the app (courses, bags,
// rounds) used to each define their own near-identical copy of this;
// centralized here so they can never drift apart.
export function trashIcon(size = 16) {
  return materialIcon(
    '<path d="M261-120q-24.75 0-42.37-17.63Q201-155.25 201-180v-570h-41v-60h188v-30h264v30h188v60h-41v570q0 24-18 42t-42 18H261Zm438-630H261v570h438v-570ZM367-266h60v-399h-60v399Zm166 0h60v-399h-60v399ZM261-750v570-570Z"/>',
    size
  );
}

export function chevronUpIcon(size = 14) {
  return materialIcon('<path d="M480-554 283-357l-43-43 240-240 240 240-43 43-197-197Z"/>', size);
}

export function chevronDownIcon(size = 14) {
  return materialIcon('<path d="M480-344 240-584l43-43 197 197 197-197 43 43-240 240Z"/>', size);
}

// A flag on a pole — marks "Start hole" on the play screen (the tap that
// records the tee, before any stroke has been taken).
export function flagIcon(size = 20) {
  return materialIcon(
    '<path d="M200-120v-680h343l19 86h238v370H544l-18.93-85H260v309h-60Zm300-452Zm95 168h145v-250H511l-19-86H260v251h316l19 85Z"/>',
    size
  );
}

// A targeting crosshair ("my_location") — marks "Track shot" on the play
// screen, i.e. GPS-tagging the ball's current position.
export function crosshairIcon(size = 22) {
  return materialIcon(
    '<path d="M450-42v-75q-137-14-228-105T117-450H42v-60h75q14-137 105-228t228-105v-75h60v75q137 14 228 105t105 228h75v60h-75q-14 137-105 228T510-117v75h-60Zm244.5-223.5Q784-355 784-480t-89.5-214.5Q605-784 480-784t-214.5 89.5Q176-605 176-480t89.5 214.5Q355-176 480-176t214.5-89.5Zm-321-108Q330-417 330-480t43.5-106.5Q417-630 480-630t106.5 43.5Q630-543 630-480t-43.5 106.5Q543-330 480-330t-106.5-43.5ZM544-416q26-26 26-64t-26-64q-26-26-64-26t-64 26q-26 26-26 64t26 64q26 26 64 26t64-26Zm-64-64Z"/>',
    size
  );
}

// A compass-arrow ("navigation") — the hero tile's directions button,
// linking out to Google Maps.
export function navigationIcon(size = 16) {
  return materialIcon('<path d="m190-120-30-30 320-730 320 730-30 30-290-132-290 132Zm68-98 222-98 222 98-222-514-222 514Zm222-98Z"/>', size);
}

// A plain left arrow — the header's back button on every screen except home.
export function backArrowIcon(size = 20) {
  return materialIcon('<path d="m274-450 248 248-42 42-320-320 320-320 42 42-248 248h526v60H274Z"/>', size);
}

// A six-dot grip ("drag_indicator") — the handle used to drag-reorder
// clubs in a bag (see js/views/bags.js). Kept as its own dedicated
// handle element (not the whole row) so a drag only starts from a
// deliberate, specific touch/click target — the row itself stays free
// for its normal tap-to-expand behavior.
export function dragHandleIcon(size = 20) {
  return materialIcon(
    '<path d="M349.91-160q-28.91 0-49.41-20.59-20.5-20.59-20.5-49.5t20.59-49.41q20.59-20.5 49.5-20.5t49.41 20.59q20.5 20.59 20.5 49.5t-20.59 49.41q-20.59 20.5-49.5 20.5Zm260 0q-28.91 0-49.41-20.59-20.5-20.59-20.5-49.5t20.59-49.41q20.59-20.5 49.5-20.5t49.41 20.59q20.5 20.59 20.5 49.5t-20.59 49.41q-20.59 20.5-49.5 20.5Zm-260-250q-28.91 0-49.41-20.59-20.5-20.59-20.5-49.5t20.59-49.41q20.59-20.5 49.5-20.5t49.41 20.59q20.5 20.59 20.5 49.5t-20.59 49.41q-20.59 20.5-49.5 20.5Zm260 0q-28.91 0-49.41-20.59-20.5-20.59-20.5-49.5t20.59-49.41q20.59-20.5 49.5-20.5t49.41 20.59q20.5 20.59 20.5 49.5t-20.59 49.41q-20.59 20.5-49.5 20.5Zm-260-250q-28.91 0-49.41-20.59-20.5-20.59-20.5-49.5t20.59-49.41q20.59-20.5 49.5-20.5t49.41 20.59q20.5 20.59 20.5 49.5t-20.59 49.41q-20.59 20.5-49.5 20.5Zm260 0q-28.91 0-49.41-20.59-20.5-20.59-20.5-49.5t20.59-49.41q20.59-20.5 49.5-20.5t49.41 20.59q20.5 20.59 20.5 49.5t-20.59 49.41q-20.59 20.5-49.5 20.5Z"/>',
    size
  );
}

// --- Navigation rail icons (Home / Courses / Bags / Stats / Settings) ---
// Filled variants (used for the active item) swap in the "-fill" path
// from the same Material Symbols set — for glyphs where Material
// Symbols doesn't draw a materially different filled shape (Golf Course,
// Bar Chart), the outline path already reads as solid, so both variants
// share one path; the active/inactive distinction there still reads
// clearly from the existing tonal-pill background in navRail.js/styles.css.

export function homeIcon(size = 22, filled = false) {
  const path = filled
    ? '<path d="M160-120v-480l320-240 320 240v480H560v-280H400v280H160Z"/>'
    : '<path d="M220-180h150v-250h220v250h150v-390L480-765 220-570v390Zm-60 60v-480l320-240 320 240v480H530v-250H430v250H160Zm320-353Z"/>';
  return materialIcon(path, size);
}

export function coursesIcon(size = 22, filled = false) {
  return materialIcon(
    '<path d="M791-123q-20 0-34.5-14.5T742-172q0-20 14.5-34.5T791-221q20 0 34.5 14.5T840-172q0 20-14.5 34.5T791-123ZM396-80q-97 0-166.5-19T160-149q0-21 40-39.5t94-27.5v76h72v-740l292 142-232 122v396q90 5 148 25t58 46q0 31-69.5 50T396-80Z"/>',
    size
  );
}

export function bagsIcon(size = 22, filled = false) {
  const path = filled
    ? '<path d="M220-80q-25 0-42.5-17.5T160-140v-510q0-55 34-95.5t86-50.5v-84h100v80h200v-80h100v84q52 10 86 50.5t34 95.5v510q0 25-17.5 42.5T740-80H220Zm400-250h60v-140H280v60h340v80Z"/>'
    : '<path d="M220-80q-24.75 0-42.37-17.63Q160-115.25 160-140v-510q0-55 34-95.5t86-50.5v-84h100v80h200v-80h100v84q52 10 86 50.5t34 95.5v510q0 24.75-17.62 42.37Q764.75-80 740-80H220Zm0-60h520v-510q0-38-26-64t-64-26H310q-37.12 0-63.56 26Q220-688 220-650v510Zm400-190h60v-140H280v60h340v80ZM480-440Z"/>';
  return materialIcon(path, size);
}

export function statsIcon(size = 22, filled = false) {
  return materialIcon('<path d="M660-160v-280h140v280H660Zm-250 0v-640h140v640H410Zm-250 0v-440h140v440H160Z"/>', size);
}

export function settingsIcon(size = 22, filled = false) {
  const path = filled
    ? '<path d="m388-80-20-126q-19-7-40-19t-37-25l-118 54-93-164 108-79q-2-9-2.5-20.5T185-480q0-9 .5-20.5T188-521L80-600l93-164 118 54q16-13 37-25t40-18l20-127h184l20 126q19 7 40.5 18.5T669-710l118-54 93 164-108 77q2 10 2.5 21.5t.5 21.5q0 10-.5 21t-2.5 21l108 78-93 164-118-54q-16 13-36.5 25.5T592-206L572-80H388Zm92-270q54 0 92-38t38-92q0-54-38-92t-92-38q-54 0-92 38t-38 92q0 54 38 92t92 38Z"/>'
    : '<path d="m388-80-20-126q-19-7-40-19t-37-25l-118 54-93-164 108-79q-2-9-2.5-20.5T185-480q0-9 .5-20.5T188-521L80-600l93-164 118 54q16-13 37-25t40-18l20-127h184l20 126q19 7 40.5 18.5T669-710l118-54 93 164-108 77q2 10 2.5 21.5t.5 21.5q0 10-.5 21t-2.5 21l108 78-93 164-118-54q-16 13-36.5 25.5T592-206L572-80H388Zm48-60h88l14-112q33-8 62.5-25t53.5-41l106 46 40-72-94-69q4-17 6.5-33.5T715-480q0-17-2-33.5t-7-33.5l94-69-40-72-106 46q-23-26-52-43.5T538-708l-14-112h-88l-14 112q-34 7-63.5 24T306-642l-106-46-40 72 94 69q-4 17-6.5 33.5T245-480q0 17 2.5 33.5T254-413l-94 69 40 72 106-46q24 24 53.5 41t62.5 25l14 112Zm44-210q54 0 92-38t38-92q0-54-38-92t-92-38q-54 0-92 38t-38 92q0 54 38 92t92 38Zm0-130Z"/>';
  return materialIcon(path, size);
}
