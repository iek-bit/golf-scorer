// segmentedThumb.js
//
// Liquid Glass's segmented control needs a real sliding "thumb" (see the
// CSS comment above [data-design='glass'] .segment-thumb) — but every
// view in this app fully replaces its markup via innerHTML on each
// interaction, so there's no persistent DOM element to just animate a
// transform on. This bridges that with the FLIP technique (First, Last,
// Invert, Play): remember where the thumb visually was before a
// re-render, and after the new markup lands, animate FROM that
// remembered position TO the new one — so it reads as one thumb sliding
// across two renders, not two different elements appearing/disappearing.
//
// A no-op outside Liquid Glass — Standard and Material 3 use a solid
// background directly on whichever button is active (see styles.css)
// and never call this at all.

const lastRects = new Map(); // containerId -> {left, width} relative to its .segmented container

export function syncSegmentedThumb(containerId) {
  if (document.documentElement.dataset.design !== 'glass') return;

  const container = document.getElementById(containerId);
  if (!container) return;
  const active = container.querySelector('.segment-btn.is-active');
  if (!active) return;

  let thumb = container.querySelector('.segment-thumb');
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'segment-thumb';
    container.insertBefore(thumb, container.firstChild);
  }

  const containerRect = container.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const next = { left: activeRect.left - containerRect.left, width: activeRect.width };

  thumb.style.width = `${next.width}px`;
  thumb.style.transform = `translateX(${next.left}px)`;

  const prev = lastRects.get(containerId);
  lastRects.set(containerId, next);

  // First time this control has ever been synced (nothing to animate
  // from) — just place the thumb, no slide.
  if (!prev || (prev.left === next.left && prev.width === next.width)) return;

  // Invert: jump back to where it visually was, with transitions off...
  thumb.style.transition = 'none';
  thumb.style.width = `${prev.width}px`;
  thumb.style.transform = `translateX(${prev.left}px)`;
  // ...then Play: on the next frame, turn transitions back on and let it
  // animate forward to the real (already-set) target values.
  requestAnimationFrame(() => {
    thumb.style.transition = '';
    thumb.style.width = `${next.width}px`;
    thumb.style.transform = `translateX(${next.left}px)`;
  });
}
