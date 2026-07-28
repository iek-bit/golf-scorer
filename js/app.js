import { initRouter, route } from './router.js';
import { initTheme } from './theme.js';
import { renderHome } from './views/home.js';
import { renderCourses, renderNewCourse } from './views/courses.js';
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
route('/round/new', { title: 'New round', backTo: '/' }, renderNewRound);
route('/round/:id/play', { title: 'Round', backTo: '/' }, renderPlay);
route('/round/:id/summary', { title: 'Summary', backTo: '/' }, renderSummary);

initTheme();
initRouter();
