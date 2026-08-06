// segmentedThumb.js
//
// M3's segmented button row highlights the active segment with a tonal
// fill — and like M3 Tabs' sliding indicator, that fill reads better as
// one shape animating between positions than as two different segments
// silently swapping backgrounds. Every view in this app fully replaces
// its markup via innerHTML on each interaction though, so there's no
// persistent DOM element to just animate a transform on. This bridges
// that with the FLIP technique (First, Last, Invert, Play): remember
// where the thumb visually was before a re-render, and after the new
// markup lands, animate FROM that remembered position TO the new one —
// so it reads as one pill sliding across two renders, not one shape
// disappearing and a different one appearing elsewhere.

const lastRects = new Map(); // containerId -> {left, width} relative to its .segmented container

export function syncSegmentedThumb(containerId) {
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
