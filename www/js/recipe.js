// Recipe data model, grid placement, import/export and search. Pure code.
import { normalizeUnit } from './units.js';
import { parseNumber, parseIngredientLine } from './parser.js';

export const FORMAT_VERSION = 1;

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function blankRecipe() {
  return { id: uid(), title: '', servings: null, categories: [], prep: [], notes: '', ingredients: [], steps: [], created: Date.now(), updated: Date.now() };
}
export const blankIngredient = () => ({ id: uid(), qty: null, unit: '', name: '', alt: null });
export const blankStep = () => ({ id: uid(), text: '', uses: [], carry: false });

// ---------------------------------------------------------------------------
// Grid placement ("Gantt" layout).
// Each step covers the ingredient rows it uses (first..last). With `carry`
// it also covers whatever the previous step covered (the mixture so far).
// A step with no ingredients acts on the previous step's rows (e.g. "bake").
// Columns are packed left to right: a step goes one column right of the
// right-most earlier step it overlaps.
export function stepPlacement(recipe) {
  const n = Math.max(recipe.ingredients.length, 1);
  const idx = new Map(recipe.ingredients.map((g, i) => [g.id, i]));
  const out = [];
  let prev = null;
  recipe.steps.forEach((s, i) => {
    const own = (s.uses || []).map(id => idx.get(id)).filter(v => v !== undefined);
    let start, end;
    if (own.length) {
      start = Math.min(...own); end = Math.max(...own);
      if (s.carry && prev) { start = Math.min(start, prev.start); end = Math.max(end, prev.end); }
    } else if (prev) { start = prev.start; end = prev.end; }
    else { start = 0; end = n - 1; }
    let col = 0;
    for (const p of out) if (p.start <= end && start <= p.end) col = Math.max(col, p.col + 1);
    const placed = { i, start, end, col };
    out.push(placed);
    prev = placed;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Import / export
const toLines = v => (Array.isArray(v) ? v : String(v || '').split(/\r?\n/)).map(x => String(x).trim()).filter(Boolean);

function normAmount(o) {
  if (!o || typeof o !== 'object') return null;
  const qty = typeof o.qty === 'number' ? o.qty : parseNumber(o.qty);
  if (qty == null || !isFinite(qty)) return null;
  return { qty, unit: normalizeUnit(o.unit) };
}

export function normalizeRecipe(raw, warnings = []) {
  const title = String(raw.title || raw.name || '').trim() || 'Untitled recipe';
  const w = m => warnings.push(`${title}: ${m}`);
  const r = blankRecipe();
  r.title = title;
  if (typeof raw.id === 'string' && raw.id) r.id = raw.id;
  const sv = typeof raw.servings === 'number' ? raw.servings : parseNumber(raw.servings);
  r.servings = sv && sv > 0 ? sv : null;
  r.categories = [...new Set(toLines(raw.categories ?? raw.category ?? []))];
  r.prep = toLines(raw.prep ?? []);
  r.notes = String(raw.notes || '').trim();
  if (raw.created) r.created = +raw.created || r.created;

  (raw.ingredients || []).forEach((g, i) => {
    let ing;
    if (typeof g === 'string') ing = parseIngredientLine(g);
    else if (g && typeof g === 'object') {
      const a = normAmount(g);
      ing = { qty: a ? a.qty : null, unit: a ? a.unit : '', name: String(g.name || '').trim(), alt: normAmount(g.alt) };
    }
    if (!ing || !ing.name) { w(`ingredient ${i + 1} skipped (no name)`); return; }
    r.ingredients.push({ id: uid() + i, qty: ing.qty, unit: ing.unit || '', name: ing.name, alt: ing.alt || null });
  });

  (raw.steps || []).forEach((s, i) => {
    const o = typeof s === 'string' ? { text: s } : s || {};
    const text = String(o.text || o.label || '').trim();
    if (!text) { w(`step ${i + 1} skipped (no text)`); return; }
    const uses = [];
    for (const u of o.uses ?? o.ingredients ?? []) {
      let g;
      if (typeof u === 'number') g = r.ingredients[u];
      else { const q = String(u).toLowerCase(); g = r.ingredients.find(x => x.name.toLowerCase() === q) || r.ingredients.find(x => x.name.toLowerCase().includes(q)); }
      if (g) uses.push(g.id); else w(`step ${i + 1} refers to unknown ingredient "${u}"`);
    }
    r.steps.push({ id: uid() + i, text, uses, carry: !!o.carry });
  });
  if (!r.ingredients.length) w('has no ingredients');
  return r;
}

// Accepts: a recipe object, an array of recipes, or {gcr:1, recipes:[...], categories:[...]}
export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return { recipes: [], categories: [], warnings: [], error: 'That file is not valid JSON.' }; }
  const list = Array.isArray(data) ? data : Array.isArray(data.recipes) ? data.recipes : data && typeof data === 'object' && (data.ingredients || data.title) ? [data] : null;
  if (!list) return { recipes: [], categories: [], warnings: [], error: 'No recipes found in that file.' };
  const warnings = [];
  const recipes = list.map(x => normalizeRecipe(x, warnings));
  const categories = Array.isArray(data.categories) ? toLines(data.categories) : [];
  return { recipes, categories, warnings, error: null };
}

export function toExportObject(recipe, withIds = false) {
  const idx = new Map(recipe.ingredients.map((g, i) => [g.id, i]));
  const o = {};
  if (withIds) { o.id = recipe.id; o.created = recipe.created; }
  o.title = recipe.title;
  if (recipe.servings) o.servings = recipe.servings;
  if (recipe.categories.length) o.categories = recipe.categories;
  if (recipe.prep.length) o.prep = recipe.prep;
  o.ingredients = recipe.ingredients.map(g => {
    const x = { qty: g.qty, unit: g.unit, name: g.name };
    if (g.alt) x.alt = g.alt;
    return x;
  });
  o.steps = recipe.steps.map(s => ({ text: s.text, uses: s.uses.map(id => idx.get(id)).filter(v => v !== undefined), carry: !!s.carry }));
  if (recipe.notes) o.notes = recipe.notes;
  return o;
}

export function exportJSON(recipes, categories = [], withIds = false) {
  return JSON.stringify({ gcr: FORMAT_VERSION, categories, recipes: recipes.map(r => toExportObject(r, withIds)) }, null, 2);
}

export function slug(s) {
  return String(s || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'recipe';
}

// ---------------------------------------------------------------------------
// Search across everything: title, categories, ingredients, steps, prep, notes.
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchRecipes(recipes, query = '', category = '') {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  const scored = [];
  for (const r of recipes) {
    if (category && !r.categories.includes(category)) continue;
    if (!tokens.length) { scored.push([0, r]); continue; }
    const title = fold(r.title);
    const hay = fold([r.title, r.categories.join(' '), r.notes, r.prep.join(' '), r.ingredients.map(g => g.name).join(' '), r.steps.map(s => s.text).join(' ')].join(' \n '));
    if (!tokens.every(t => hay.includes(t))) continue;
    let score = 0;
    for (const t of tokens) if (title.includes(t)) score += 10;
    scored.push([score, r]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title));
  return scored.map(x => x[1]);
}
