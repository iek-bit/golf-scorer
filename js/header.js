// header.js
//
// The header is the one piece of chrome every screen shares, so it's
// centralized here instead of duplicated per view. A screen just declares
// { title, backTo } in its route registration (see app.js) and doesn't have
// to think about header markup at all — including screens added in later
// stages (course map, shot placement, rangefinder, ...).

import { toggleTheme, syncThemeToggle } from './theme.js';

export function renderHeader({ title, backTo, action } = {}) {
  const header = document.getElementById('app-header');

  if (!backTo) {
    header.innerHTML = `
      <a class="wordmark" href="#/">Fairway</a>
      <button id="theme-toggle" class="icon-btn" aria-label="Toggle theme" type="button">☾</button>
    `;
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    syncThemeToggle();
    return;
  }

  // `action` (e.g. { label: 'Save' }) replaces the plain centering spacer
  // with a real button — the header's the "upper right" of the screen, the
  // spot people actually expect a save/done action to live, not a full-
  // width button buried in the scrollable content below. The route just
  // declares the label (see app.js); the view itself wires the click
  // handler after this renders — see e.g. views/bags.js.
  header.innerHTML = `
    <a class="icon-btn back-btn" href="#${backTo}" aria-label="Back">‹</a>
    <h1 class="header-title">${title || ''}</h1>
    ${action ? `<button type="button" id="header-action-btn" class="header-action-btn">${action.label}</button>` : `<span class="header-spacer" aria-hidden="true"></span>`}
  `;
}
