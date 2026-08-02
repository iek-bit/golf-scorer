// installPrompt.js
//
// Chrome/Edge/Android fire `beforeinstallprompt` and let a page trigger
// the native install UI on demand — but only if the event is captured
// (and preventDefault'd) the moment it fires, which can happen before any
// UI that wants to offer "Install" has rendered. So this captures it
// once, immediately, at app boot (see app.js), and Settings just asks
// this module for whatever state it's in.
//
// iOS Safari has no equivalent API at all — there is no programmatic
// install prompt to trigger. The only "install" path there is the
// person doing Share → Add to Home Screen themselves, so the best this
// can do is detect iOS and show instructions instead of a button.

let deferredPrompt = null;
let promptOutcome = null; // 'accepted' | 'dismissed' | null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // stop the browser's own mini-infobar; we show our own UI instead
  deferredPrompt = e;
});

// Once installed, either platform can still fire this — clear our
// state so Settings stops offering to install an already-installed app.
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * @returns {{status: 'installed'|'promptable'|'ios-manual'|'unsupported'}}
 */
export function getInstallState() {
  if (isStandalone()) return { status: 'installed' };
  if (deferredPrompt) return { status: 'promptable' };
  if (isIOS()) return { status: 'ios-manual' };
  return { status: 'unsupported' }; // e.g. desktop Firefox — no install path to offer
}

/**
 * Triggers the native install prompt. Only valid when getInstallState()
 * returned 'promptable' — the prompt can only be shown once per capture.
 * @returns {Promise<'accepted'|'dismissed'|null>}
 */
export async function promptInstall() {
  if (!deferredPrompt) return null;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  promptOutcome = outcome;
  deferredPrompt = null; // a captured prompt is single-use
  return promptOutcome;
}
