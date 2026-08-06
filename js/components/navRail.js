// components/navRail.js
//
// M3's standard answer to "what replaces bottom nav once there's room for
// it": a persistent vertical rail pinned to the leading edge at medium+
// widths (see the `@media` breakpoints in styles.css — it's display:none
// below 600px and never shown on phone at all). This app has no bottom
// nav on phone by design (the home screen's tile stack IS the primary
// navigation there — see components/tile.js), so the rail is purely an
// addition for the extra space on tablet/desktop, not a replacement for
// anything phone-sized.
//
// Rendered once into the static #nav-rail element in index.html, then
// just has its active item swapped on every route change — called from
// router.js alongside renderHeader(), since both need to run on every
// navigation and neither depends on the other.

import { homeIcon, coursesIcon, bagsIcon, statsIcon, settingsIcon } from '../icons.js';

const ITEMS = [
  { key: 'home', href: '#/', label: 'Home', match: (p) => p === '/', icon: homeIcon },
  { key: 'courses', href: '#/courses', label: 'Courses', match: (p) => p.startsWith('/courses'), icon: coursesIcon },
  { key: 'bags', href: '#/bags', label: 'Bags', match: (p) => p.startsWith('/bags'), icon: bagsIcon },
  { key: 'stats', href: '#/stats', label: 'Stats', match: (p) => p.startsWith('/stats'), icon: statsIcon },
  { key: 'settings', href: '#/settings', label: 'Settings', match: (p) => p.startsWith('/settings'), icon: settingsIcon },
];

let mounted = false;

export function renderNavRail(path) {
  const rail = document.getElementById('nav-rail');
  if (!rail) return;

  // A round in progress (/round/...) isn't one of the rail's own
  // sections — it's reached FROM Home, so Home is the closest honest
  // match rather than leaving the whole rail unlit.
  const effectivePath = path.startsWith('/round') ? '/' : path;

  if (!mounted) {
    rail.innerHTML = `
      <a class="wordmark" href="#/">Fairway</a>
      <div class="nav-rail-items">
        ${ITEMS.map((item) => navItem(item, false)).join('')}
      </div>
    `;
    mounted = true;
  }

  ITEMS.forEach((item) => {
    const el = rail.querySelector(`[data-nav-key="${item.key}"]`);
    if (!el) return;
    const active = item.match(effectivePath);
    el.classList.toggle('is-active', active);
    el.querySelector('.nav-rail-icon').innerHTML = item.icon(22, active);
    el.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function navItem(item, active) {
  return `
    <a class="nav-rail-item ${active ? 'is-active' : ''}" href="${item.href}" data-nav-key="${item.key}" aria-current="${active ? 'page' : 'false'}">
      <span class="nav-rail-icon">${item.icon(22, active)}</span>
      <span class="nav-rail-label">${item.label}</span>
    </a>
  `;
}
