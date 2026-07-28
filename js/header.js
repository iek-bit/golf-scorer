// header.js
//
// The header is the one piece of chrome every screen shares, so it's
// centralized here instead of duplicated per view. A screen just declares
// { title, backTo } in its route registration (see app.js) and doesn't have
// to think about header markup at all — including screens added in later
// stages (course map, shot placement, rangefinder, ...).

import { toggleTheme, syncThemeToggle } from './theme.js';

export function renderHeader({ title, backTo } = {}) {
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

  header.innerHTML = `
    <a class="icon-btn back-btn" href="#${backTo}" aria-label="Back">‹</a>
    <h1 class="header-title">${title || ''}</h1>
    <span class="header-spacer" aria-hidden="true"></span>
  `;
}
