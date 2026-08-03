import { storage } from '../storage.js';
import { getThemeMode, setThemeMode } from '../theme.js';
import { getDesignState, setDesignManual, setDesignAuto, getPaletteState, setPalettePreset, setCustomPalette, paletteIds, paletteFor } from '../design.js';
import { getInstallState, promptInstall } from '../installPrompt.js';
import { syncSegmentedThumb } from '../segmentedThumb.js';

const DESIGN_LABELS = { standard: 'Standard', m3: 'Material 3', glass: 'Liquid Glass' };
const PALETTE_LABELS = { fairway: 'Fairway', ocean: 'Ocean', sunset: 'Sunset', slate: 'Slate' };

export async function renderSettings(outlet) {
  const mode = await getThemeMode(); // null | 'light' | 'dark'
  const design = await getDesignState(); // { auto, manual, detected }
  const activeDesign = design.auto ? design.detected : design.manual;
  const palette = await getPaletteState(); // null (= fairway default) | { id, primary, secondary, tertiary }
  const activePaletteId = palette?.id || 'fairway';
  const customColors = palette?.id === 'custom' ? palette : { ...paletteFor('fairway') };

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
        <span class="settings-group-label">Design language</span>
        <label class="settings-row settings-row-toggle" id="auto-design-row">
          <span>
            Match my device
            <span class="settings-row-subtext">${design.auto ? `Currently: ${DESIGN_LABELS[design.detected]}` : 'Off — pick one below'}</span>
          </span>
          <span class="toggle-switch ${design.auto ? 'is-on' : ''}" id="auto-design-toggle" role="switch" aria-checked="${design.auto}" tabindex="0"></span>
        </label>
        <div class="segmented" id="design-segmented">
          ${segmentButton('design', 'standard', 'Standard', activeDesign === 'standard')}
          ${segmentButton('design', 'm3', 'Material 3', activeDesign === 'm3')}
          ${segmentButton('design', 'glass', 'Liquid Glass', activeDesign === 'glass')}
        </div>
        <p class="stats-note">Browsers can't tell us exactly which phone you're on — "Match my device" goes by iOS/macOS vs. Android. Pick one manually any time to override it.</p>
      </div>

      <div class="settings-group">
        <span class="settings-group-label">Color palette</span>
        <div class="palette-swatch-row" id="palette-swatch-row">
          ${paletteIds()
            .map((id) => paletteSwatchHtml(id, activePaletteId === id))
            .join('')}
          ${paletteSwatchHtml('custom', activePaletteId === 'custom', customColors)}
        </div>
        <div class="custom-palette-panel ${activePaletteId === 'custom' ? '' : 'is-hidden'}" id="custom-palette-panel">
          ${colorField('primary', 'Primary', customColors.primary)}
          ${colorField('secondary', 'Secondary', customColors.secondary)}
          ${colorField('tertiary', 'Tertiary', customColors.tertiary)}
        </div>
      </div>

      ${renderInstallGroup(getInstallState())}

      <div class="settings-group">
        <span class="settings-group-label">Data</span>
        <a class="settings-row" href="#/courses">
          <span>Manage courses</span>
          <span class="settings-row-chevron">›</span>
        </a>
        <button type="button" class="settings-row" id="export-data-btn">
          <span>Export my data</span>
        </button>
        <button type="button" class="settings-row settings-row-danger" id="reset-data-btn">
          <span>Reset all data</span>
        </button>
      </div>
    </section>
  `;

  syncSegmentedThumb('theme-segmented');
  syncSegmentedThumb('design-segmented');

  document.getElementById('theme-segmented').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    const value = btn.dataset.mode;
    await setThemeMode(value === 'system' ? null : value);
    renderSettings(outlet);
  });

  document.getElementById('design-segmented').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    await setDesignManual(btn.dataset.mode);
    renderSettings(outlet);
  });

  const handleAutoToggle = async () => {
    await setDesignAuto(!design.auto);
    renderSettings(outlet);
  };
  document.getElementById('auto-design-row').addEventListener('click', (e) => {
    e.preventDefault(); // it's a <label> with no real form control inside — own the click fully
    handleAutoToggle();
  });
  document.getElementById('auto-design-toggle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAutoToggle();
    }
  });

  document.getElementById('palette-swatch-row').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-palette]');
    if (!btn) return;
    const id = btn.dataset.palette;
    if (id === 'custom') {
      // Just reveal the pickers with sensible starting colors — don't
      // commit anything until the user actually changes a color, so
      // tapping "Custom" then walking away doesn't silently switch you
      // off whatever preset you had.
      document.getElementById('custom-palette-panel').classList.remove('is-hidden');
      document.querySelectorAll('#palette-swatch-row button').forEach((b) => b.classList.toggle('is-active', b === btn));
      return;
    }
    await setPalettePreset(id);
    renderSettings(outlet);
  });

  document.getElementById('custom-palette-panel').addEventListener('input', async (e) => {
    const input = e.target.closest('input[type="color"]');
    if (!input) return;
    const next = {
      primary: document.getElementById('color-input-primary').value,
      secondary: document.getElementById('color-input-secondary').value,
      tertiary: document.getElementById('color-input-tertiary').value,
    };
    await setCustomPalette(next);
    document.querySelectorAll('#palette-swatch-row button').forEach((b) => b.classList.toggle('is-active', b.dataset.palette === 'custom'));
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
        <span class="settings-row-chevron">›</span>
      </button>
    </div>
  `;
}

function segmentButton(group, mode, label, isActive) {
  return `<button type="button" class="segment-btn ${isActive ? 'is-active' : ''}" data-group="${group}" data-mode="${mode}">${label}</button>`;
}

function paletteSwatchHtml(id, isActive, customColors) {
  const preset = id === 'custom' ? customColors : paletteFor(id);
  const label = id === 'custom' ? 'Custom' : PALETTE_LABELS[id];
  return `
    <button type="button" class="palette-swatch ${isActive ? 'is-active' : ''}" data-palette="${id}" aria-label="${label} palette">
      <span class="palette-swatch-dots">
        <span style="background:${preset.primary}"></span>
        <span style="background:${preset.secondary}"></span>
        <span style="background:${preset.tertiary}"></span>
      </span>
      <span class="palette-swatch-label">${label}</span>
    </button>
  `;
}

function colorField(key, label, value) {
  return `
    <label class="color-input-field">
      <span>${label}</span>
      <input type="color" id="color-input-${key}" value="${value}" />
    </label>
  `;
}
