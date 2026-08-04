import './installPrompt.js';
import { initRouter, route } from './router.js';
import { initTheme } from './theme.js';
import { initDesign } from './design.js';
import { initRipple } from './ripple.js';
import { renderHome } from './views/home.js';
import { renderCourses, renderNewCourse, renderEditCourse } from './views/courses.js';
import { renderBags, renderNewBag, renderEditBag } from './views/bags.js';
import { renderNewRound } from './views/newRound.js';
import { renderPlay } from './views/play.js';
import { renderSummary } from './views/summary.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';

// meta.backTo omitted => home header (wordmark + theme toggle).
// meta.backTo set => back button + title, targeting a fixed parent route
// (kept explicit rather than browser history, since the hash-history stack
// gets messy once forms redirect forward on submit).

route('/', {}, renderHome);
route('/stats', { title: 'Stats', backTo: '/' }, renderStats);
route('/settings', { title: 'Settings', backTo: '/' }, renderSettings);
route('/courses', { title: 'Courses', backTo: '/settings' }, renderCourses);
route('/courses/new', { title: 'Add course', backTo: '/courses' }, renderNewCourse);
route('/courses/:id/edit', { title: 'Edit course', backTo: '/courses' }, renderEditCourse);
route('/bags', { title: 'Bags', backTo: '/settings' }, renderBags);
route('/bags/new', { title: 'New bag', backTo: '/bags' }, renderNewBag);
route('/bags/:id/edit', { title: 'Edit bag', backTo: '/bags' }, renderEditBag);
route('/round/new', { title: 'New round', backTo: '/' }, renderNewRound);
route('/round/:id/play', { title: 'Round', backTo: '/' }, renderPlay);
route('/round/:id/summary', { title: 'Summary', backTo: '/' }, renderSummary);

// Each of these is independent — a failure in one (a storage read throwing,
// browser API not existing, etc.) should never be able to stop the others
// from running, and initRouter() in particular must always run or nothing
// ever renders at all.
try {
  initTheme();
} catch (err) {
  console.error('initTheme failed', err);
}
try {
  initDesign();
} catch (err) {
  console.error('initDesign failed', err);
}
try {
  initRipple();
} catch (err) {
  console.error('initRipple failed', err);
}
initRouter();

// PWA: cache the app shell + map/course data as it's used, so the app
// still opens and a course already viewed still works with no signal.
// Registered with an explicit relative scope so it works from a GitHub
// Pages project subpath (e.g. /golf-scorer/), not just a domain root.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });

  // A new SW version takes over (skipWaiting + clients.claim in sw.js) —
  // reload once so the page is served by the version that just activated,
  // instead of running old JS against a newer cache indefinitely.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}
