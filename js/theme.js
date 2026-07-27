// theme.js
//
// Default is the device's light/dark setting. The toggle button lets the
// user override that; the override is remembered (localStorage via
// storage.js) until they tap the toggle again. There is no third "custom
// palette" mode by design — see the project plan.

import { storage } from './storage.js';

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isDarkFor(mode) {
  return mode ? mode === 'dark' : systemPrefersDark();
}

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', isDarkFor(mode) ? 'dark' : 'light');
}

function updateToggleIcon(mode) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const dark = isDarkFor(mode);
  btn.textContent = dark ? '☀' : '☾';
  btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}

export async function initTheme() {
  const saved = await storage.getThemePreference();
  applyTheme(saved);
  updateToggleIcon(saved);

  // Keep following the system if the user hasn't overridden it.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const current = await storage.getThemePreference();
    if (!current) {
      applyTheme(null);
      updateToggleIcon(null);
    }
  });
}

export async function toggleTheme() {
  const current = await storage.getThemePreference();
  const next = isDarkFor(current) ? 'light' : 'dark';
  await storage.saveThemePreference(next);
  applyTheme(next);
  updateToggleIcon(next);
}
