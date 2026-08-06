import { storage } from '../storage.js';
import { getThemeMode, setThemeMode } from '../theme.js';
import { getInstallState, promptInstall } from '../installPrompt.js';
import { syncSegmentedThumb } from '../segmentedThumb.js';
import { youthOnCourseIcon } from '../icons.js';

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
        <label class="settings-row settings-row-toggle" id="yoc-row">
          <span class="settings-row-icon">${youthOnCourseIcon(20)}</span>
          <span>
            I'm a Youth on Course member
            <span class="settings-row-subtext">Shows a badge and $5-or-less pricing on courses you've marked as participating</span>
          </span>
          <span class="toggle-switch ${yocEnabled ? 'is-on' : ''}" id="yoc-toggle" role="switch" aria-checked="${yocEnabled}" tabindex="0"></span>
        </label>
        <p class="stats-note">
          Youth on Course is a nonprofit that gets junior golfers on the course for $5 or less at partner courses.
          Mark a course as participating from its edit screen — see <a class="text-link" href="https://youthoncourse.org" target="_blank" rel="noopener">youthoncourse.org</a> for the directory and membership details.
        </p>
      </div>

      ${renderInstallGroup(getInstallState())}

      <div class="settings-group">
        <span class="settings-group-label">Data</span>
        <a class="settings-row" href="#/courses">
          <span>Manage courses</span>
          <span class="settings-row-chevron">${chevronIcon()}</span>
        </a>
        <a class="settings-row" href="#/bags">
          <span>Manage bags</span>
          <span class="settings-row-chevron">${chevronIcon()}</span>
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
  document.getElementById('yoc-row').addEventListener('click', (e) => {
    e.preventDefault(); // it's a <label> with no real form control inside — own the click fully
    handleYocToggle();
  });
  document.getElementById('yoc-toggle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleYocToggle();
    }
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
        <span class="settings-row-chevron">${chevronIcon()}</span>
      </button>
    </div>
  `;
}

function segmentButton(group, mode, label, isActive) {
  return `<button type="button" class="segment-btn ${isActive ? 'is-active' : ''}" data-group="${group}" data-mode="${mode}">${label}</button>`;
}

function chevronIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
}
