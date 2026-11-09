// Works out where everything goes in the recipe grid. Pure maths, takes a
// `measure(text)` function so it runs in the browser (canvas) and in tests.
import { ingredientLabel, convertTemps, SYSTEMS } from './units.js';
import { stepPlacement } from './recipe.js';

export const M = { LINE: 20, PADX: 10, PADY: 7, MIN_ROW: 34, MARGIN: 14, ING_CAP: 250, STEP_MIN: 90, STEP_CAP: 150, MIN_W: 320 };

export function wrapText(text, maxW, measure) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let cur = '';
    for (let w of words) {
      while (measure(w) > maxW && w.length > 1) {
        let n = w.length;
        while (n > 1 && measure(w.slice(0, n)) > maxW) n--;
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      const t = cur ? `${cur} ${w}` : w;
      if (!cur || measure(t) <= maxW) cur = t; else { lines.push(cur); cur = w; }
    }
    lines.push(cur);
  }
  return lines;
}

export function computeLayout(recipe, opts, measure, boldMeasure = measure) {
  const { LINE, PADX, PADY, MIN_ROW, MARGIN } = M;
  const system = opts.system || 'metric';
  const factor = opts.factor || 1;
  const labelOpts = { keepSpoons: opts.keepSpoons !== false };
  // compact = narrower columns so the grid fits a phone screen better
  const ING_CAP = opts.compact ? 170 : M.ING_CAP;
  const STEP_MIN = opts.compact ? 66 : M.STEP_MIN;
  const STEP_CAP = opts.compact ? 100 : M.STEP_CAP;

  const labels = recipe.ingredients.map(g => ingredientLabel(g, factor, system, labelOpts));
  if (!labels.length) labels.push('');
  const place = stepPlacement(recipe);
  const nCols = place.length ? Math.max(...place.map(p => p.col)) + 1 : 0;
  const stepTexts = recipe.steps.map(s => convertTemps(s.text, system));

  // column widths
  let ingW = Math.max(...labels.map(t => measure(t)));
  ingW = Math.max(opts.compact ? 120 : 140, Math.min(ING_CAP, ingW) + 2 * PADX);
  const colW = Array(nCols).fill(STEP_MIN);
  for (const p of place) {
    const longest = Math.max(0, ...stepTexts[p.i].split(/\s+/).map(w => measure(w)));
    colW[p.col] = Math.max(colW[p.col], Math.min(STEP_CAP, longest + 2 * PADX));
  }
  let W = ingW + colW.reduce((a, b) => a + b, 0);
  if (W < M.MIN_W) { ingW += M.MIN_W - W; W = M.MIN_W; }

  // title block
  const innerW = W;
  const titleLines = wrapText(recipe.title || 'Untitled recipe', innerW, boldMeasure);
  const bits = [];
  if (recipe.servings) bits.push(`Serves ${trimNum(recipe.servings * factor)}`);
  bits.push(SYSTEMS[system] || system);
  const subtitle = bits.join('  ·  ');
  const titleH = titleLines.length * 28 + 22;

  // rows
  const prep = recipe.prep.map(t => {
    const text = convertTemps(t, system);
    const lines = wrapText(text, W - 2 * PADX, measure);
    return { lines, h: Math.max(30, lines.length * LINE + 2 * PADY) };
  });
  const rows = labels.map(t => {
    const lines = wrapText(t, ingW - 2 * PADX, measure);
    return { lines, h: Math.max(MIN_ROW, lines.length * LINE + 2 * PADY) };
  });

  // step blocks; grow rows when a block needs more height than its rows give
  const blocks = place.map(p => ({ ...p, lines: wrapText(stepTexts[p.i], colW[p.col] - 2 * PADX, measure) }));
  for (const b of blocks) {
    const need = b.lines.length * LINE + 2 * PADY;
    let have = 0;
    for (let r = b.start; r <= b.end; r++) have += rows[r].h;
    if (have < need) rows[b.end].h += need - have;
  }

  // coordinates
  const x0 = MARGIN;
  const tableY = MARGIN + titleH;
  let y = tableY;
  prep.forEach(p => { p.y = y; y += p.h; });
  const ingTop = y;
  rows.forEach(r => { r.y = y; y += r.h; });
  const tableBottom = y;
  const colX = [];
  let cx = x0 + ingW;
  colW.forEach(w => { colX.push(cx); cx += w; });
  blocks.forEach(b => {
    b.x = colX[b.col]; b.w = colW[b.col];
    b.y = rows[b.start].y; b.h = rows[b.end].y + rows[b.end].h - rows[b.start].y;
  });

  return {
    width: W + 2 * MARGIN, height: tableBottom + MARGIN + 2,
    x0, tableY, tableW: W, tableBottom, ingW, ingTop, titleLines, subtitle, prep, rows, blocks,
  };
}

function trimNum(n) { return String(Math.round(n * 100) / 100); }
