// export.js
//
// Turns a finished round into a single shareable PNG — course, total,
// to-par, weather (if the round has one), and a hole-by-hole grid colored
// the same way the in-app scorecard is. Colors are read live from the
// current CSS custom properties (getComputedStyle), not hardcoded, so an
// exported card matches whatever theme/design language/custom palette
// the person is actually using — not always the same green regardless.
//
// Sharing prefers the Web Share API (navigator.share with a file) when
// the browser supports sharing files — the normal mobile "share sheet"
// people already know, straight to Messages/whatever. Falls back to a
// plain download anywhere that isn't available (most desktop browsers).

import { toParText } from './views/home.js';
import { scoreClass } from './views/play.js';
import { weatherConditionLabel } from './api/weather.js';

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildScorecardCanvas(round, course, totals) {
  const holesPerRow = 9;
  const rows = Math.ceil(round.holeScores.length / holesPerRow);
  const width = 900;
  const padding = 48;
  const headerHeight = round.weather ? 260 : 220;
  const rowHeight = 130;
  const height = headerHeight + rows * rowHeight + padding;

  const canvas = document.createElement('canvas');
  const scale = 2; // export at 2x for a crisp share/download, not a blurry phone screenshot
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const colorBg = cssVar('--color-bg', '#121314');
  const colorSurface = cssVar('--color-surface', '#1b1c1e');
  const colorInk = cssVar('--color-ink', '#ededea');
  const colorMuted = cssVar('--color-ink-muted', '#93958f');
  const colorAccent = cssVar('--color-fairway-bright', '#57b085');
  const colorBogey = cssVar('--color-bogey', '#c97a54');
  const colorDouble = cssVar('--color-double', '#de9877');
  const fontDisplay = cssVar('--font-display', 'sans-serif').split(',')[0].replace(/['"]/g, '');
  const fontBody = cssVar('--font-body', 'sans-serif').split(',')[0].replace(/['"]/g, '');

  // Background
  ctx.fillStyle = colorBg;
  ctx.fillRect(0, 0, width, height);
  roundedRect(ctx, padding / 2, padding / 2, width - padding, height - padding, 24);
  ctx.fillStyle = colorSurface;
  ctx.fill();

  const left = padding;
  let y = padding + 42;

  // Course + date
  ctx.fillStyle = colorMuted;
  ctx.font = `600 15px ${fontBody}, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const dateText = round.completedAt ? new Date(round.completedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  ctx.fillText(dateText, left, y);

  y += 40;
  ctx.fillStyle = colorInk;
  ctx.font = `700 32px ${fontDisplay}, sans-serif`;
  ctx.fillText(course?.name || 'Unknown course', left, y);

  // Total + to-par, right-aligned
  ctx.textAlign = 'right';
  ctx.fillStyle = colorInk;
  ctx.font = `700 48px ${fontDisplay}, sans-serif`;
  ctx.fillText(String(totals.strokes), width - padding, y);
  ctx.font = `600 16px ${fontBody}, sans-serif`;
  ctx.fillStyle = colorAccent;
  ctx.fillText(`${toParText(totals.toPar)} to par`, width - padding, y + 24);
  ctx.textAlign = 'left';

  // Weather line
  if (round.weather) {
    y += 44;
    const w = round.weather;
    const parts = [
      weatherConditionLabel(w.condition),
      w.tempF != null ? `${Math.round(w.tempF)}°F` : null,
      w.windSpeedMph != null ? `Wind ${Math.round(w.windSpeedMph)} mph` : null,
    ].filter(Boolean);
    ctx.font = `500 16px ${fontBody}, sans-serif`;
    ctx.fillStyle = colorMuted;
    ctx.fillText(parts.join('   ·   '), left, y);
  }

  // Hole grid
  y = headerHeight;
  const cellWidth = (width - padding * 2) / holesPerRow;
  round.holeScores.forEach((holeScore, i) => {
    const row = Math.floor(i / holesPerRow);
    const col = i % holesPerRow;
    const cx = left + col * cellWidth + cellWidth / 2;
    const cy = y + row * rowHeight + rowHeight / 2;
    drawHoleCell(ctx, { cx, cy, holeScore, course, colorInk, colorMuted, colorAccent, colorBogey, colorDouble, fontBody, fontDisplay });
  });

  // Watermark
  ctx.fillStyle = colorMuted;
  ctx.font = `600 13px ${fontBody}, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('Fairway', width - padding, height - padding / 2 - 6);
  ctx.textAlign = 'left';

  return canvas;
}

function drawHoleCell(ctx, { cx, cy, holeScore, course, colorInk, colorMuted, colorAccent, colorBogey, colorDouble, fontBody, fontDisplay }) {
  const holeDef = course?.holes.find((h) => h.number === holeScore.holeNumber);
  const strokes = holeScore.strokes;

  ctx.textAlign = 'center';
  ctx.fillStyle = colorMuted;
  ctx.font = `600 13px ${fontBody}, sans-serif`;
  ctx.fillText(`HOLE ${holeScore.holeNumber}`, cx, cy - 34);

  const radius = 26;
  if (strokes != null && holeDef) {
    const cls = scoreClass(strokes, holeDef.par);
    if (cls === 'score-birdie' || cls === 'score-eagle') {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = cls === 'score-eagle' ? 4 : 3;
      ctx.strokeStyle = colorAccent;
      ctx.stroke();
    } else if (cls === 'score-bogey' || cls === 'score-double') {
      roundedRect(ctx, cx - radius, cy - radius, radius * 2, radius * 2, 10);
      ctx.lineWidth = cls === 'score-double' ? 4 : 3;
      ctx.strokeStyle = cls === 'score-double' ? colorDouble : colorBogey;
      ctx.stroke();
    }
  }

  ctx.fillStyle = colorInk;
  ctx.font = `700 24px ${fontDisplay}, sans-serif`;
  ctx.fillText(strokes != null ? String(strokes) : '–', cx, cy + 8);
  ctx.textAlign = 'left';
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * @returns {Promise<boolean>} true if a share/download was actually offered
 * (false only if canvas export itself failed — genuinely rare)
 */
export async function exportRoundImage(round, course, totals) {
  const canvas = buildScorecardCanvas(round, course, totals);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;

  const datePart = round.completedAt ? round.completedAt.slice(0, 10) : 'round';
  const namePart = (course?.name || 'round').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const filename = `fairway-${namePart}-${datePart}.png`;

  if (navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: course?.name || 'Golf round' });
        return true;
      } catch (err) {
        if (err?.name === 'AbortError') return true; // person just closed the share sheet — not a failure
        // any other share failure: fall through to a plain download instead
      }
    }
  }

  downloadBlob(blob, filename);
  return true;
}
