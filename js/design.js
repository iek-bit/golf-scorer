// design.js
//
// Manages which *design language* the app renders in — Standard (this
// app's own minimalist look), Material 3 (Android/Pixel), or Liquid Glass
// (iOS/macOS) — as opposed to theme.js, which only handles light/dark.
// The two are independent: any design language can be light or dark.
//
// There's no web API that exposes "this is a Pixel" or "this device uses
// Liquid Glass" — only a general OS/browser signature. So "automatic"
// means OS-family detection (iOS/iPadOS/macOS → glass, Android → m3,
// everything else → standard), not literal hardware detection. That's
// documented here rather than hidden, since it's a real limitation, not
// a bug. A manual pick in Settings always overrides it.

import { storage } from './storage.js';
import { syncThemeColorMeta } from './theme.js';

const DESIGNS = ['standard', 'm3', 'glass'];

const PALETTE_PRESETS = {
  fairway: { primary: '#1f4d3a', secondary: '#b99a63', tertiary: '#46707f' }, // this app's original green (light-mode default)
  ocean: { primary: '#1d6fa5', secondary: '#3aa6a0', tertiary: '#6d97a6' },
  sunset: { primary: '#c9622f', secondary: '#e0a13a', tertiary: '#a04c6a' },
  slate: { primary: '#5b6570', secondary: '#8a7a63', tertiary: '#5f7480' },
};

export function paletteFor(id) {
  return PALETTE_PRESETS[id] || null;
}

export function paletteIds() {
  return Object.keys(PALETTE_PRESETS);
}

/**
 * Best-effort OS-family sniff. Deliberately coarse — see module comment.
 */
export function detectOsDesign() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = /Mac/.test(platform) && !isIOS;
  if (isIOS || isMac) return 'glass';
  if (/Android/.test(ua)) return 'm3';
  return 'standard';
}

function applyDesign(design) {
  document.documentElement.setAttribute('data-design', DESIGNS.includes(design) ? design : 'standard');
  syncThemeColorMeta();
}

function applyPalette(palette) {
  const root = document.documentElement.style;
  if (!palette) {
    root.removeProperty('--color-fairway');
    root.removeProperty('--color-fairway-bright');
    root.removeProperty('--color-sand');
    root.removeProperty('--color-sky');
    return;
  }
  // A slightly brighter variant of primary for accents-on-dark-surfaces —
  // matches how the built-in Fairway palette already has two greens.
  root.setProperty('--color-fairway', palette.primary);
  root.setProperty('--color-fairway-bright', mixWithWhite(palette.primary, 18));
  root.setProperty('--color-sand', palette.secondary);
  root.setProperty('--color-sky', palette.tertiary);
}

function mixWithWhite(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * (percent / 100));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export async function initDesign() {
  const auto = await storage.getDesignAuto();
  const manual = await storage.getDesignPreference();
  applyDesign(auto ? detectOsDesign() : manual);

  const palette = await storage.getPalette();
  applyPalette(palette ? { primary: palette.primary, secondary: palette.secondary, tertiary: palette.tertiary } : null);
}

export async function getDesignState() {
  return {
    auto: await storage.getDesignAuto(),
    manual: await storage.getDesignPreference(),
    detected: detectOsDesign(),
  };
}

// Picking a design language manually always turns auto-match off — the
// two controls represent one underlying state (see Settings), not two.
export async function setDesignManual(design) {
  await storage.saveDesignAuto(false);
  await storage.saveDesignPreference(design);
  applyDesign(design);
}

export async function setDesignAuto(auto) {
  await storage.saveDesignAuto(auto);
  const manual = await storage.getDesignPreference();
  applyDesign(auto ? detectOsDesign() : manual);
}

export async function getPaletteState() {
  return storage.getPalette(); // null | { id, primary, secondary, tertiary }
}

export async function setPalettePreset(id) {
  const preset = paletteFor(id);
  if (!preset) return;
  const palette = { id, ...preset };
  await storage.savePalette(id === 'fairway' ? null : palette); // 'fairway' IS the default, so store nothing
  applyPalette(id === 'fairway' ? null : palette);
}

export async function setCustomPalette({ primary, secondary, tertiary }) {
  const palette = { id: 'custom', primary, secondary, tertiary };
  await storage.savePalette(palette);
  applyPalette(palette);
}
