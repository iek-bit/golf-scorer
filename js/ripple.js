// ripple.js
//
// The Material 3 "state layer" ripple, delegated at the document level so
// it works for every interactive surface across every view without each
// view wiring it up individually — including content re-rendered after
// this listener attaches (delegation, not per-element binding).

const RIPPLE_SELECTOR =
  '.btn, .tile, .icon-btn, .segment-btn, .settings-row, .course-card, .score-row, .list-row, .strip-cell, .stepper-btn, .par-confirm-btn, .track-shot-btn, .text-btn, .fab, .nav-rail-item, .club-chip, .club-row-summary, .toggle-switch, .settings-row-info-btn';

export function initRipple() {
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target.closest(RIPPLE_SELECTOR);
    if (!target || target.hasAttribute('disabled')) return;

    const rect = target.getBoundingClientRect();
    // Radius reaches the farthest corner from the touch point, so the
    // ripple always fully covers the surface it's on.
    const dx = Math.max(e.clientX - rect.left, rect.width - (e.clientX - rect.left));
    const dy = Math.max(e.clientY - rect.top, rect.height - (e.clientY - rect.top));
    const radius = Math.hypot(dx, dy);

    const ripple = document.createElement('span');
    ripple.className = 'm3-ripple';
    ripple.style.width = ripple.style.height = `${radius * 2}px`;
    ripple.style.left = `${e.clientX - rect.left - radius}px`;
    ripple.style.top = `${e.clientY - rect.top - radius}px`;

    const computed = getComputedStyle(target);
    if (computed.position === 'static') target.classList.add('m3-ripple-host');
    target.appendChild(ripple);

    ripple.addEventListener('animationend', () => ripple.remove());
  });
}
