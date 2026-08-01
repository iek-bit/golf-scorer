// router.js
//
// Small hash-based router. Hash routing (as opposed to the History API)
// means every route works as a static file on GitHub Pages with zero
// server-side rewrite rules — important since Stage 1 has no backend at all.
//
// Each route carries { title, backTo } meta so header.js can render the
// right chrome without every view needing to know about the header.

import { renderHeader } from './header.js';

const routes = [];

/**
 * @param {string} pattern e.g. '/round/:id/play'
 * @param {{title?: string, backTo?: string}} meta backTo omitted = home header (wordmark + theme toggle)
 * @param {(outlet: HTMLElement, params: object) => void|Promise<void>} handler
 */
export function route(pattern, meta, handler) {
  routes.push({ pattern, meta, handler });
}

function matchRoute(path) {
  for (const { pattern, meta, handler } of routes) {
    const paramNames = [];
    const regexStr = pattern.replace(/:[^/]+/g, (m) => {
      paramNames.push(m.slice(1));
      return '([^/]+)';
    });
    const match = path.match(new RegExp(`^${regexStr}$`));
    if (match) {
      const params = {};
      paramNames.forEach((name, i) => (params[name] = match[i + 1]));
      return { handler, params, meta };
    }
  }
  return null;
}

export async function renderRoute() {
  const raw = (location.hash || '#/').slice(1) || '/';
  const [path, queryStr] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryStr || ''));
  const matched = matchRoute(path || '/');
  const outlet = document.getElementById('view-outlet');

  if (!matched) {
    renderHeader({ backTo: '/' });
    outlet.innerHTML = `<p class="empty-state">Nothing here. <a href="#/">Back to home</a></p>`;
    return;
  }

  renderHeader(matched.meta || {});
  await matched.handler(outlet, { ...matched.params, ...query });
  outlet.scrollTo(0, 0);
}

export function initRouter() {
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
