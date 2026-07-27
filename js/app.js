import { initRouter, route } from './router.js';
import { initTheme, toggleTheme } from './theme.js';
import { renderHome } from './views/home.js';
import { renderCourses, renderNewCourse } from './views/courses.js';
import { renderNewRound } from './views/newRound.js';
import { renderPlay } from './views/play.js';
import { renderSummary } from './views/summary.js';

route('/', renderHome);
route('/courses', renderCourses);
route('/courses/new', renderNewCourse);
route('/round/new', renderNewRound);
route('/round/:id/play', renderPlay);
route('/round/:id/summary', renderSummary);

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

initTheme();
initRouter();
