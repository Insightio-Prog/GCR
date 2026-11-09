// Draws the recipe grid onto a <canvas>. The same drawing is used for the
// on-screen view and for the saved image, so they always match.
import { computeLayout, M } from './layout.js';

const FONT = '15px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const BOLD = 'bold 22px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SMALL = '14px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const GREEN = '#2f9e44';
const TINT = '#eef8ee';
const INK = '#161616';

export function drawRecipe(canvas, recipe, opts, scale = 1) {
  const ctx = canvas.getContext('2d');
  const measure = t => { ctx.font = FONT; return ctx.measureText(t).width; };
  const bold = t => { ctx.font = BOLD; return ctx.measureText(t).width; };
  const L = computeLayout(recipe, opts, measure, bold);

  canvas.width = Math.ceil(L.width * scale);
  canvas.height = Math.ceil(L.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, L.width, L.height);
  ctx.textBaseline = 'middle';

  // title
  ctx.fillStyle = INK; ctx.font = BOLD; ctx.textAlign = 'left';
  L.titleLines.forEach((t, i) => ctx.fillText(t, L.x0, M.MARGIN + 14 + i * 28));
  ctx.fillStyle = '#666'; ctx.font = SMALL;
  ctx.fillText(L.subtitle, L.x0, M.MARGIN + 14 + L.titleLines.length * 28 - 6 + 4);

  const x0 = L.x0, W = L.tableW;
  ctx.strokeStyle = GREEN; ctx.lineJoin = 'round';

  // block fills first, so lines sit on top
  L.blocks.forEach(b => { ctx.fillStyle = TINT; ctx.fillRect(b.x, b.y, b.w, b.h); });

  // prep rows (full width)
  ctx.font = FONT; ctx.fillStyle = INK; ctx.textAlign = 'center';
  ctx.lineWidth = 1.5;
  L.prep.forEach(p => {
    textBlock(ctx, p.lines, x0 + W / 2, p.y, p.h);
    line(ctx, x0, p.y + p.h, x0 + W, p.y + p.h);
  });

  // ingredient rows
  ctx.textAlign = 'left';
  L.rows.forEach((r, i) => {
    r.lines.forEach((t, k) => ctx.fillText(t, x0 + M.PADX, r.y + (r.h - r.lines.length * M.LINE) / 2 + k * M.LINE + M.LINE / 2));
    if (i < L.rows.length - 1) line(ctx, x0, r.y + r.h, x0 + L.ingW, r.y + r.h);
  });
  ctx.lineWidth = 2;
  line(ctx, x0 + L.ingW, L.ingTop, x0 + L.ingW, L.tableBottom);

  // step blocks
  ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.lineWidth = 2;
  L.blocks.forEach(b => {
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    textBlock(ctx, b.lines, b.x + b.w / 2, b.y, b.h);
  });

  // outer frame
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, L.tableY, W, L.tableBottom - L.tableY);
  return L;
}

function textBlock(ctx, lines, cx, y, h) {
  const top = y + (h - lines.length * M.LINE) / 2;
  lines.forEach((t, i) => ctx.fillText(t, cx, top + i * M.LINE + M.LINE / 2));
}
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
