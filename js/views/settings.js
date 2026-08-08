import { storage } from '../storage.js';
import { getThemeMode, setThemeMode } from '../theme.js';
import { getInstallState, promptInstall } from '../installPrompt.js';
import { syncSegmentedThumb } from '../segmentedThumb.js';
import { youthOnCourseIcon, infoIcon, closeIcon, chevronIcon } from '../icons.js';

export async function renderSettings(outlet) {
  const mode = await getThemeMode(); // null | 'light' | 'dark'
  const yocEnabled = await storage.getYouthOnCourseEnabled();

  outlet.innerHTML = `
    <section class="panel">
      <div class="settings-group">
        <span class="settings-group-label">Appearance</span>
        <div class="segmented" id="theme-segmented">
          ${segmentButton('theme', 'system', 'System', mode === null)}
          ${segmentButton('theme', 'light', 'Light', mode === 'light')}
          ${segmentButton('theme', 'dark', 'Dark', mode === 'dark')}
        </div>
      </div>

      <div class="settings-group">
        <span class="settings-group-label">Youth on Course</span>
        <div class="settings-row settings-row-toggle" id="yoc-row">
          <span class="settings-row-icon">${youthOnCourseIcon(20)}</span>
          <span>I'm a Youth on Course member</span>
          <button type="button" class="settings-row-info-btn" id="yoc-info-btn" aria-label="What is Youth on Course?">${infoIcon(16)}</button>
          <span class="toggle-switch ${yocEnabled ? 'is-on' : ''}" id="yoc-toggle" role="switch" aria-checked="${yocEnabled}" tabindex="0"></span>
        </div>
      </div>

      ${renderInstallGroup(getInstallState())}

      <div class="settings-group">
        <span class="settings-group-label">Data</span>
        <a class="settings-row" href="#/courses">
          <span>Manage courses</span>
          <span class="settings-row-chevron">${chevronIcon(16)}</span>
        </a>
        <a class="settings-row" href="#/bags">
          <span>Manage bags</span>
          <span class="settings-row-chevron">${chevronIcon(16)}</span>
        </a>
        <button type="button" class="settings-row" id="export-data-btn">
          <span>Export my data</span>
        </button>
        <button type="button" class="settings-row" id="import-data-btn">
          <span>Import my data</span>
        </button>
        <input type="file" id="import-data-input" accept="application/json,.json" class="sr-only" />
        <button type="button" class="settings-row settings-row-danger" id="reset-data-btn">
          <span>Reset all data</span>
        </button>
      </div>
    </section>
  `;

  syncSegmentedThumb('theme-segmented');

  document.getElementById('theme-segmented').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    const value = btn.dataset.mode;
    await setThemeMode(value === 'system' ? null : value);
    renderSettings(outlet);
  });

  const handleYocToggle = async () => {
    await storage.saveYouthOnCourseEnabled(!yocEnabled);
    renderSettings(outlet);
  };
  // The row itself is a <div> (not a <label>) now that it contains a real
  // <button> (the info button) — a <label> wrapping a <button> is the
  // same invalid-nesting problem the hero tile's directions/booking
  // buttons already had to work around (see home.js), so the row owns
  // its own click handling instead. A tap on the info button specifically
  // is excluded so asking "what is this?" never also flips the toggle.
  document.getElementById('yoc-row').addEventListener('click', (e) => {
    if (e.target.closest('#yoc-info-btn')) return;
    handleYocToggle();
  });
  document.getElementById('yoc-toggle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleYocToggle();
    }
  });
  document.getElementById('yoc-info-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openYocInfoSheet();
  });

  const installBtn = document.getElementById('install-app-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      await promptInstall();
      renderSettings(outlet); // reflect whatever the person chose (installed, or prompt now spent)
    });
  }

  document.getElementById('export-data-btn').addEventListener('click', async () => {
    const data = await storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fairway-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const importInput = document.getElementById('import-data-input');
  document.getElementById('import-data-btn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = ''; // allow picking the same filename again later
    if (!file) return;

    const confirmed = window.confirm('Import this file? It replaces everything currently saved on this device — courses, rounds, and bags. This can\'t be undone.');
    if (!confirmed) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await storage.importAll(data);
      // Every view holds its own in-memory copy of courses/rounds/bags —
      // a full reload is the simplest way to guarantee nothing on screen
      // is left showing stale pre-import data.
      location.hash = '#/';
      location.reload();
    } catch (err) {
      window.alert(`Couldn't import that file: ${err.message}`);
    }
  });

  document.getElementById('reset-data-btn').addEventListener('click', async () => {
    const confirmed = window.confirm('This deletes every saved course and round on this device. This cannot be undone. Continue?');
    if (!confirmed) return;
    await storage.clearAll();
    location.hash = '#/';
  });
}

// The old always-visible explanatory paragraph now lives behind the (i)
// button instead of permanently taking up space in the Youth on Course
// group — same bottom-sheet component the home tile's price "Details"
// button and the play screen's club picker already use (see .sheet-*
// classes in styles.css), so this doesn't introduce a new UI pattern.
function openYocInfoSheet() {
  closeYocInfoSheet();
  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  scrim.id = 'yoc-info-scrim';
  scrim.innerHTML = `
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <span class="sheet-title">Youth on Course</span>
        <button type="button" class="icon-btn" id="yoc-info-close-btn" aria-label="Close">${closeIcon(16)}</button>
      </div>
      <p class="sheet-body-text">
        Youth on Course is a nonprofit that gets junior golfers on the course for $5 or less at partner courses.
        Mark a course as participating from its edit screen (Settings → Manage courses → tap a course).
      </p>
      <a class="text-link" href="https://youthoncourse.org" target="_blank" rel="noopener">youthoncourse.org →</a>
    </div>
  `;
  document.body.appendChild(scrim);

  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) closeYocInfoSheet();
  });
  document.getElementById('yoc-info-close-btn').addEventListener('click', closeYocInfoSheet);
  document.addEventListener('keydown', onYocSheetKeydown);
}

function onYocSheetKeydown(e) {
  if (e.key === 'Escape') closeYocInfoSheet();
}

function closeYocInfoSheet() {
  document.getElementById('yoc-info-scrim')?.remove();
  document.removeEventListener('keydown', onYocSheetKeydown);
}

function renderInstallGroup(installState) {
  if (installState.status === 'installed' || installState.status === 'unsupported') return '';

  if (installState.status === 'ios-manual') {
    return `
      <div class="settings-group">
        <span class="settings-group-label">App</span>
        <p class="stats-note">Add Fairway to your Home Screen: tap the Share icon in Safari, then "Add to Home Screen."</p>
      </div>
    `;
  }

  return `
    <div class="settings-group">
      <span class="settings-group-label">App</span>
      <button type="button" class="settings-row" id="install-app-btn">
        <span>Install Fairway</span>
        <span class="settings-row-chevron">${chevronIcon(16)}</span>
      </button>
    </div>
  `;
}

function segmentButton(group, mode, label, isActive) {
  return `<button type="button" class="segment-btn ${isActive ? 'is-active' : ''}" data-group="${group}" data-mode="${mode}">${label}</button>`;
}
