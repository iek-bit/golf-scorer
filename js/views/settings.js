import { storage } from '../storage.js';
import { getThemeMode, setThemeMode } from '../theme.js';

export async function renderSettings(outlet) {
  const mode = await getThemeMode(); // null | 'light' | 'dark'

  outlet.innerHTML = `
    <section class="panel">
      <div class="settings-group">
        <span class="settings-group-label">Appearance</span>
        <div class="segmented" id="theme-segmented">
          ${segmentButton('system', 'System', mode === null)}
          ${segmentButton('light', 'Light', mode === 'light')}
          ${segmentButton('dark', 'Dark', mode === 'dark')}
        </div>
      </div>

      <div class="settings-group">
        <span class="settings-group-label">Data</span>
        <a class="settings-row" href="#/courses">
          <span>Manage courses</span>
          <span class="settings-row-chevron">›</span>
        </a>
        <button type="button" class="settings-row settings-row-danger" id="reset-data-btn">
          <span>Reset all data</span>
        </button>
      </div>
    </section>
  `;

  document.getElementById('theme-segmented').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    const value = btn.dataset.mode;
    await setThemeMode(value === 'system' ? null : value);
    renderSettings(outlet);
  });

  document.getElementById('reset-data-btn').addEventListener('click', async () => {
    const confirmed = window.confirm('This deletes every saved course and round on this device. This cannot be undone. Continue?');
    if (!confirmed) return;
    await storage.clearAll();
    location.hash = '#/';
  });
}

function segmentButton(mode, label, isActive) {
  return `<button type="button" class="segment-btn ${isActive ? 'is-active' : ''}" data-mode="${mode}">${label}</button>`;
}
