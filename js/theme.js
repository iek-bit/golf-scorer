// theme.js
//
// Default is the device's light/dark setting. Either the header toggle (home
// screen) or the Settings screen can override it; the override is persisted
// via storage.js until changed again or reset to "System".

import { storage } from './storage.js';

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isDarkFor(mode) {
  return mode ? mode === 'dark' : systemPrefersDark();
}

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', isDarkFor(mode) ? 'dark' : 'light');
  syncThemeColorMeta();
}

// Keeps the browser's own chrome (Android's status bar, Safari's address
// bar tint) matching whatever --color-bg currently resolves to — which
// depends on both light/dark *and* the design language (design.js calls
// this too, after switching design), so switching to Liquid Glass's softer
// background or Material 3's warm neutral updates the OS chrome to match,
// not just the page content.
export function syncThemeColorMeta() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
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

// Sets an explicit mode ('light' | 'dark') or null to follow the system —
// used by the Settings screen's three-way control.
export async function setThemeMode(mode) {
  await storage.saveThemePreference(mode);
  applyTheme(mode);
  updateToggleIcon(mode);
}

export async function getThemeMode() {
  return storage.getThemePreference();
}

// Call after any header re-render (a fresh #theme-toggle button has no
// icon/label yet) to bring it in sync with the current preference.
export async function syncThemeToggle() {
  const saved = await storage.getThemePreference();
  updateToggleIcon(saved);
}
