// router.js
//
// Small hash-based router. Hash routing (as opposed to the History API)
// means every route works as a static file on GitHub Pages with zero
// server-side rewrite rules — important since Stage 1 has no backend at all.

const routes = [];

export function route(pattern, handler) {
  routes.push({ pattern, handler });
}

function matchRoute(path) {
  for (const { pattern, handler } of routes) {
    const paramNames = [];
    const regexStr = pattern.replace(/:[^/]+/g, (m) => {
      paramNames.push(m.slice(1));
      return '([^/]+)';
    });
    const match = path.match(new RegExp(`^${regexStr}$`));
    if (match) {
      const params = {};
      paramNames.forEach((name, i) => (params[name] = match[i + 1]));
      return { handler, params };
    }
  }
  return null;
}

function updateActiveTab(path) {
  document.querySelectorAll('.tab-link').forEach((link) => {
    const isActive = link.dataset.route === path || (link.dataset.route !== '/' && path.startsWith(link.dataset.route));
    link.classList.toggle('is-active', isActive);
  });
}

export async function renderRoute() {
  const path = (location.hash || '#/').slice(1) || '/';
  const matched = matchRoute(path);
  const outlet = document.getElementById('view-outlet');

  if (!matched) {
    outlet.innerHTML = `<p class="empty-state">Nothing here. <a href="#/">Back to home</a></p>`;
    return;
  }

  await matched.handler(outlet, matched.params);
  updateActiveTab(path);
  outlet.scrollTo(0, 0);
}

export function initRouter() {
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
