import { SYSTEMS, UNIT_CHOICES } from './units.js';
import { parseIngredientBlock, parseNumber } from './parser.js';
import { blankRecipe, blankIngredient, blankStep, parseImport, exportJSON, searchRecipes, slug } from './recipe.js';
import { drawRecipe } from './render.js';
import { state, load, save, byId, upsert, remove, addCategory, renameCategory, deleteCategory, mergeImport } from './store.js';
import { deliverFile, isNative } from './native.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = n => String(Math.round(n * 1000) / 1000);
const short = (s, n = 20) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  import: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

const ui = { q: '', cat: '', system: null, factor: 1, zoom: 'fit', zoomNow: 1, draft: null, draftId: null, dirty: false, repaint: null };

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
const go = h => { location.hash = h; };

// ---------------------------------------------------------------- routing
function route() {
  ui.repaint = null;
  document.body.classList.remove('printing');
  const [, a, b] = (location.hash || '#/').split('/');
  if (a === 'r' && byId(b)) viewRecipe(b);
  else if (a === 'e') viewEditor(b);
  else if (a === 'settings') viewSettings();
  else viewLibrary();
}
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => ui.repaint && ui.repaint(), 150); });

// ---------------------------------------------------------------- import / export
function pickFile() {
  const f = $('#file');
  f.value = '';
  f.onchange = async () => {
    const file = f.files[0];
    if (!file) return;
    doImport(await file.text());
  };
  f.click();
}

function doImport(text) {
  const res = parseImport(text);
  if (res.error) { toast(res.error); return; }
  const { added, replaced } = mergeImport(res.recipes, res.categories);
  if (res.warnings.length) alert('Imported, but check these:\n\n' + res.warnings.slice(0, 8).join('\n'));
  toast(`Imported ${added} new${replaced ? `, ${replaced} updated` : ''}`);
  if (res.recipes.length === 1) {
    const target = '#/r/' + res.recipes[0].id;
    if (location.hash === target) route(); else go(target);
  } else route();
}

async function loadExample() {
  try {
    const r = await fetch('example.gcr.json');
    doImport(await r.text());
  } catch (e) { toast('Could not load the example'); }
}

async function send(opts) {
  try { await deliverFile(opts); if (!isNative()) toast('Downloaded'); }
  catch (e) { if (!/cancel/i.test(String(e && (e.message || e)))) toast('Could not share: ' + (e.message || e)); }
}

// ---------------------------------------------------------------- library
function viewLibrary() {
  document.title = 'GCR';
  app.innerHTML = `
    <header class="bar"><h1>GCR</h1><div class="sp"></div>
      <button class="ic" id="bImport" aria-label="Import recipes">${icon('import')}</button>
      <a class="ic" href="#/settings" aria-label="Settings">${icon('gear')}</a></header>
    <main>
      <input id="q" type="search" placeholder="Search recipes, ingredients, steps…" value="${esc(ui.q)}" autocomplete="off">
      <div class="chips" id="cats"></div>
      <div class="list" id="list"></div>
    </main>
    <a class="fab" href="#/e/new" aria-label="New recipe">${icon('plus')}</a>`;
  $('#q').oninput = e => { ui.q = e.target.value; paintList(); };
  $('#bImport').onclick = pickFile;
  paintCats(); paintList();
}

const chip = (c, label) => `<button class="chip ${ui.cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(label)}</button>`;

function paintCats() {
  const el = $('#cats');
  if (ui.cat && !state.categories.includes(ui.cat)) ui.cat = '';
  if (!state.categories.length) { el.style.display = 'none'; return; }
  el.innerHTML = chip('', 'All') + state.categories.map(c => chip(c, c)).join('');
  $$('.chip', el).forEach(b => { b.onclick = () => { ui.cat = b.dataset.c; paintCats(); paintList(); }; });
}

function paintList() {
  const el = $('#list');
  if (!state.recipes.length) {
    el.innerHTML = `<div class="empty"><p><b>No recipes yet</b></p><p>Add one yourself, import a recipe file, or try the example.</p>
      <button class="btn primary" id="eAdd">Add a recipe</button>
      <button class="btn" id="eImp">Import a file</button>
      <button class="btn" id="eEx">Try the example</button></div>`;
    $('#eAdd').onclick = () => go('#/e/new');
    $('#eImp').onclick = pickFile;
    $('#eEx').onclick = loadExample;
    return;
  }
  const list = searchRecipes(state.recipes, ui.q, ui.cat);
  if (!list.length) { el.innerHTML = '<div class="empty">No recipes match.</div>'; return; }
  el.innerHTML = list.map(r => {
    const meta = [...r.categories, `${r.ingredients.length} ingredients`].join(' · ');
    return `<a class="card" href="#/r/${r.id}"><h3>${esc(r.title)}</h3><div class="meta">${esc(meta)}</div></a>`;
  }).join('');
}

// ---------------------------------------------------------------- viewer
const viewOpts = () => ({ system: ui.system || state.settings.system, factor: ui.factor, keepSpoons: state.settings.keepSpoons });
// on-screen grid uses narrower columns on phones; saved images always use the roomy layout
const screenOpts = () => ({ ...viewOpts(), compact: window.innerWidth < 600 });

function fitCanvas(cv, wrap, L, zoom) {
  const avail = wrap.clientWidth - 8;
  const z = zoom === 'fit' ? Math.min(1, Math.max(avail / L.width, 0.6)) : zoom;
  cv.style.width = L.width * z + 'px';
  cv.style.height = L.height * z + 'px';
  return z;
}

function paintGrid(r, cv, wrap) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const L = drawRecipe(cv, r, screenOpts(), dpr);
  ui.zoomNow = fitCanvas(cv, wrap, L, ui.zoom);
}

function viewRecipe(id) {
  const r = byId(id);
  document.title = r.title;
  const sys = ui.system || state.settings.system;
  const seg = (name, items, cur) => `<div class="seg" data-seg="${name}">${items.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  app.innerHTML = `
    <header class="bar"><a class="ic" href="#/" aria-label="Back">${icon('back')}</a><h1 class="t">${esc(r.title)}</h1><div class="sp"></div>
      <a class="ic" href="#/e/${r.id}" aria-label="Edit">${icon('edit')}</a></header>
    <main>
      <div class="ctl">
        ${seg('sys', Object.entries(SYSTEMS), sys)}
        ${seg('scale', [[0.5, '½×'], [1, '1×'], [2, '2×'], [3, '3×']], ui.factor)}
        ${seg('zoom', [['out', '−'], ['fit', 'Fit'], ['in', '+']], '')}
      </div>
      <div class="gridwrap" id="gridwrap"><canvas id="cv"></canvas></div>
      ${r.notes ? `<div class="notes">${esc(r.notes)}</div>` : ''}
      <div class="actions">
        <button class="btn primary" id="bImg">Save / share image</button>
        <button class="btn" id="bFile">Share recipe file</button>
        ${isNative() ? '' : '<button class="btn" id="bPrint">Print</button>'}
        <button class="btn danger" id="bDel">Delete</button>
      </div>
    </main>`;
  const cv = $('#cv'), wrap = $('#gridwrap');
  const paint = () => paintGrid(r, cv, wrap);
  ui.repaint = paint;
  paint();

  $$('[data-seg] button').forEach(b => {
    b.onclick = () => {
      const k = b.parentElement.dataset.seg, v = b.dataset.v;
      if (k === 'sys') ui.system = v;
      else if (k === 'scale') ui.factor = +v;
      else if (k === 'zoom') ui.zoom = v === 'fit' ? 'fit' : Math.min(2.5, Math.max(0.4, ui.zoomNow + (v === 'in' ? 0.15 : -0.15)));
      if (k !== 'zoom') $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b));
      paint();
    };
  });

  $('#bImg').onclick = () => {
    const c = document.createElement('canvas');
    drawRecipe(c, r, viewOpts(), 2);
    send({ filename: slug(r.title) + '.png', mime: 'image/png', base64: c.toDataURL('image/png').split(',')[1], title: r.title });
  };
  $('#bFile').onclick = () => send({ filename: slug(r.title) + '.gcr.json', mime: 'application/json', text: exportJSON([r], r.categories), title: r.title });
  const bp = $('#bPrint');
  if (bp) bp.onclick = () => { document.body.classList.add('printing'); window.print(); };
  $('#bDel').onclick = () => {
    if (!confirm(`Delete "${r.title}"? This can't be undone.`)) return;
    remove(r.id); toast('Deleted'); go('#/');
  };
}

// ---------------------------------------------------------------- editor
const starter = () => { const r = blankRecipe(); r.ingredients.push(blankIngredient()); r.steps.push(blankStep()); return r; };

function viewEditor(id) {
  if (id === 'new') ui.draft = starter();
  else {
    const src = byId(id);
    if (!src) { go('#/'); return; }
    ui.draft = JSON.parse(JSON.stringify(src));
  }
  ui.draftId = id; ui.dirty = false;
  renderEditor();
}

const unitOpts = sel => {
  const list = UNIT_CHOICES.some(u => u[0] === sel) ? UNIT_CHOICES : [...UNIT_CHOICES, [sel, sel]];
  return list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
};

function ingRow(g) {
  const a = g.alt;
  return `<div class="ing" data-id="${g.id}">
    <div class="l1"><input class="field qty" inputmode="decimal" placeholder="Qty" value="${g.qty == null ? '' : esc(round(g.qty))}">
      <select class="unit" aria-label="Unit">${unitOpts(g.unit)}</select></div>
    <div class="l2"><input class="field name" placeholder="Ingredient" value="${esc(g.name)}">
      <div class="tools">
        <button class="tb ${a ? 'on' : ''}" data-act="alt" title="Second measure, e.g. grams and cups">alt</button>
        <button class="tb" data-act="up" aria-label="Move up">${icon('up')}</button>
        <button class="tb" data-act="down" aria-label="Move down">${icon('down')}</button>
        <button class="tb del" data-act="del" aria-label="Delete">${icon('trash')}</button></div></div>
    ${a ? `<div class="alt"><input class="field aqty" inputmode="decimal" placeholder="Qty" value="${a.qty == null ? '' : esc(round(a.qty))}">
      <select class="aunit" aria-label="Second unit">${unitOpts(a.unit)}</select><span class="hint">2nd measure</span></div>` : ''}
  </div>`;
}

function stepRow(s, i, d) {
  const uses = d.ingredients.map((g, k) => `<button class="chip sm ${s.uses.includes(g.id) ? 'on' : ''}" data-ing="${g.id}">${esc(short(g.name) || '#' + (k + 1))}</button>`).join('');
  return `<div class="stp" data-id="${s.id}">
    <div class="hd">Step ${i + 1}<div class="sp"></div><div class="tools">
      <button class="tb" data-act="up" aria-label="Move up">${icon('up')}</button>
      <button class="tb" data-act="down" aria-label="Move down">${icon('down')}</button>
      <button class="tb del" data-act="del" aria-label="Delete">${icon('trash')}</button></div></div>
    <textarea class="stext" rows="2" placeholder="e.g. mix, fold in, bake 180°C 30 min">${esc(s.text)}</textarea>
    <div class="hint">Ingredients this step uses:</div>
    <div class="uses">${uses || '<span class="hint">Add ingredients first</span>'}</div>
    <label class="carry"><input type="checkbox" class="cb" ${s.carry ? 'checked' : ''}> Also covers the mixture so far</label>
  </div>`;
}

function cleanCopy(d) {
  const ingredients = d.ingredients.filter(g => g.name.trim()).map(g => ({ ...g, name: g.name.trim(), alt: g.alt && g.alt.qty != null ? g.alt : null }));
  const ids = new Set(ingredients.map(g => g.id));
  const steps = d.steps.filter(s => s.text.trim()).map(s => ({ ...s, text: s.text.trim(), uses: s.uses.filter(x => ids.has(x)) }));
  return { ...d, title: d.title.trim(), ingredients, steps, prep: d.prep.map(x => x.trim()).filter(Boolean), categories: [...d.categories] };
}

function renderEditor() {
  const d = ui.draft;
  const y = window.scrollY;
  const isNew = ui.draftId === 'new';
  document.title = isNew ? 'New recipe' : 'Edit recipe';
  app.innerHTML = `
    <header class="bar"><button class="ic" id="bBack" aria-label="Back">${icon('back')}</button><h1 class="t">${isNew ? 'New recipe' : 'Edit recipe'}</h1></header>
    <main>
      <div class="sec">
        <div class="row2"><div><label class="lb" for="title">Title</label><input class="field" id="title" value="${esc(d.title)}" placeholder="e.g. Espresso Brownies"></div>
          <div><label class="lb" for="serves">Serves</label><input class="field" id="serves" inputmode="decimal" value="${d.servings ?? ''}"></div></div>
        <label class="lb">Categories</label><div class="chips wrap" id="ecats"></div>
        <div class="row2" style="grid-template-columns:1fr auto;margin-top:8px"><input class="field" id="newcat" placeholder="New category"><button class="btn sm" id="addcat">Add</button></div>
      </div>
      <div class="sec"><h2>Prep (shown across the top)</h2>
        <textarea id="prep" rows="3" placeholder="One per line, e.g. Preheat oven to 180°C">${esc(d.prep.join('\n'))}</textarea></div>
      <div class="sec"><h2>Ingredients</h2>
        <p class="hint" style="margin-top:0">List them in the order they go in. Each step covers the rows it uses.</p>
        <div id="ings"></div>
        <button class="btn sm" id="addIng">+ Add ingredient</button>
        <label class="lb">Or paste a list, one per line</label>
        <textarea id="paste" rows="3" placeholder="1 1/2 cups flour&#10;200g sugar&#10;2 eggs"></textarea>
        <button class="btn sm" id="doPaste" style="margin-top:6px">Add these lines</button></div>
      <div class="sec"><h2>Steps</h2><div id="steps"></div><button class="btn sm" id="addStep">+ Add step</button></div>
      <div class="sec"><h2>Notes</h2><textarea id="notes" rows="3" placeholder="Optional">${esc(d.notes)}</textarea></div>
      <div class="sec"><h2>Preview</h2><div class="gridwrap" id="pvwrap"><canvas id="pv"></canvas></div></div>
    </main>
    <div class="savebar"><button class="btn" id="bCancel">Cancel</button><button class="btn primary" id="bSave">Save recipe</button></div>`;

  let pt;
  const preview = () => { clearTimeout(pt); pt = setTimeout(drawPreview, 160); };
  const drawPreview = () => {
    const cv = $('#pv'), wrap = $('#pvwrap');
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const L = drawRecipe(cv, cleanCopy(d), screenOpts(), dpr);
    fitCanvas(cv, wrap, L, 'fit');
  };
  ui.repaint = drawPreview;
  const touch = () => { ui.dirty = true; preview(); };

  $('#title').oninput = e => { d.title = e.target.value; touch(); };
  $('#serves').oninput = e => { const n = parseNumber(e.target.value); d.servings = n && n > 0 ? n : null; touch(); };
  $('#prep').oninput = e => { d.prep = e.target.value.split('\n'); touch(); };
  $('#notes').oninput = e => { d.notes = e.target.value; ui.dirty = true; };

  const paintCatsE = () => {
    const el = $('#ecats');
    el.innerHTML = state.categories.length ? state.categories.map(c => `<button class="chip sm ${d.categories.includes(c) ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('') : '<span class="hint">No categories yet. Add one below.</span>';
    $$('.chip', el).forEach(b => {
      b.onclick = () => {
        const c = b.dataset.c;
        d.categories = d.categories.includes(c) ? d.categories.filter(x => x !== c) : [...d.categories, c];
        ui.dirty = true; paintCatsE();
      };
    });
  };
  $('#addcat').onclick = () => {
    const el = $('#newcat'), name = el.value.trim();
    if (!name) return;
    addCategory(name);
    const exact = state.categories.find(c => c.toLowerCase() === name.toLowerCase());
    if (exact && !d.categories.includes(exact)) d.categories.push(exact);
    el.value = ''; ui.dirty = true; paintCatsE();
  };
  paintCatsE();

  const find = (list, el) => list.find(x => x.id === el.closest('[data-id]').dataset.id);
  const move = (list, item, dir) => {
    const i = list.indexOf(item), j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  };

  const paintIngs = () => { $('#ings').innerHTML = d.ingredients.map(ingRow).join('') || '<p class="hint">No ingredients yet.</p>'; };
  const paintSteps = () => { $('#steps').innerHTML = d.steps.map((s, i) => stepRow(s, i, d)).join('') || '<p class="hint">No steps yet.</p>'; };
  paintIngs(); paintSteps();

  const ings = $('#ings');
  ings.addEventListener('input', e => {
    const g = find(d.ingredients, e.target); if (!g) return;
    if (e.target.classList.contains('qty')) g.qty = parseNumber(e.target.value);
    else if (e.target.classList.contains('name')) g.name = e.target.value;
    else if (e.target.classList.contains('aqty')) g.alt.qty = parseNumber(e.target.value);
    touch();
  });
  ings.addEventListener('change', e => {
    const g = find(d.ingredients, e.target); if (!g) return;
    if (e.target.classList.contains('unit')) g.unit = e.target.value;
    else if (e.target.classList.contains('aunit')) g.alt.unit = e.target.value;
    else if (e.target.classList.contains('name')) paintSteps();
    touch();
  });
  ings.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const g = find(d.ingredients, b);
    if (b.dataset.act === 'up') move(d.ingredients, g, -1);
    else if (b.dataset.act === 'down') move(d.ingredients, g, 1);
    else if (b.dataset.act === 'del') {
      d.ingredients = d.ingredients.filter(x => x !== g);
      d.steps.forEach(s => { s.uses = s.uses.filter(u => u !== g.id); });
    } else if (b.dataset.act === 'alt') g.alt = g.alt ? null : { qty: null, unit: '' };
    paintIngs(); paintSteps(); touch();
  });

  const steps = $('#steps');
  steps.addEventListener('input', e => {
    if (!e.target.classList.contains('stext')) return;
    find(d.steps, e.target).text = e.target.value; touch();
  });
  steps.addEventListener('change', e => {
    if (!e.target.classList.contains('cb')) return;
    find(d.steps, e.target).carry = e.target.checked; touch();
  });
  steps.addEventListener('click', e => {
    const chipEl = e.target.closest('[data-ing]');
    if (chipEl) {
      const s = find(d.steps, chipEl), gid = chipEl.dataset.ing;
      s.uses = s.uses.includes(gid) ? s.uses.filter(x => x !== gid) : [...s.uses, gid];
      chipEl.classList.toggle('on'); touch(); return;
    }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const s = find(d.steps, b);
    if (b.dataset.act === 'up') move(d.steps, s, -1);
    else if (b.dataset.act === 'down') move(d.steps, s, 1);
    else if (b.dataset.act === 'del') d.steps = d.steps.filter(x => x !== s);
    paintSteps(); touch();
  });

  $('#addIng').onclick = () => { d.ingredients.push(blankIngredient()); paintIngs(); paintSteps(); ui.dirty = true; const n = $$('.name', ings); n[n.length - 1].focus(); };
  $('#addStep').onclick = () => { d.steps.push(blankStep()); paintSteps(); ui.dirty = true; const n = $$('.stext', steps); n[n.length - 1].focus(); };
  $('#doPaste').onclick = () => {
    const lines = parseIngredientBlock($('#paste').value);
    if (!lines.length) { toast('Paste some ingredient lines first'); return; }
    // drop a lone empty starter row before adding
    d.ingredients = d.ingredients.filter(g => g.name.trim() || g.qty != null);
    lines.forEach(l => d.ingredients.push({ ...blankIngredient(), ...l }));
    $('#paste').value = ''; paintIngs(); paintSteps(); touch(); toast(`Added ${lines.length} ingredient${lines.length > 1 ? 's' : ''}`);
  };

  $('#bBack').onclick = $('#bCancel').onclick = () => {
    if (ui.dirty && !confirm('Discard your changes?')) return;
    ui.dirty = false;
    history.length > 1 ? history.back() : go('#/');
  };
  $('#bSave').onclick = () => {
    if (!d.title.trim()) { toast('Give it a title first'); $('#title').focus(); return; }
    const c = cleanCopy(d);
    if (!c.ingredients.length) { toast('Add at least one ingredient'); return; }
    c.updated = Date.now();
    upsert(c);
    ui.dirty = false;
    toast('Saved');
    location.replace('#/r/' + c.id);
  };

  drawPreview();
  window.scrollTo(0, y);
}

// ---------------------------------------------------------------- settings
function viewSettings() {
  document.title = 'Settings';
  const s = state.settings;
  app.innerHTML = `
    <header class="bar"><a class="ic" href="#/" aria-label="Back">${icon('back')}</a><h1 class="t">Settings</h1></header>
    <main>
      <div class="sec"><h2>Default measurements</h2>
        <div class="seg" id="sysSeg">${Object.entries(SYSTEMS).map(([v, l]) => `<button data-v="${v}" class="${s.system === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <p class="hint">You can still switch on each recipe. "Both" shows e.g. 1 cup (200 g).</p>
        <label class="check"><input type="checkbox" id="spoons" ${s.keepSpoons ? 'checked' : ''}> Keep tsp / tbsp as spoons in Metric</label>
      </div>
      <div class="sec"><h2>Categories</h2><div id="catlist"></div>
        <div class="row2" style="grid-template-columns:1fr auto;margin-top:8px"><input class="field" id="newcat" placeholder="New category"><button class="btn sm" id="addcat">Add</button></div></div>
      <div class="sec"><h2>Backup</h2>
        <p class="hint" style="margin-top:0">Recipes live on this phone only. Uninstalling the app erases them, so back up now and then.</p>
        <div class="actions"><button class="btn primary" id="bExport">Back up all recipes</button><button class="btn" id="bImport">Import a file</button></div></div>
      <p class="hint" style="text-align:center">GCR · ${state.recipes.length} recipe${state.recipes.length === 1 ? '' : 's'} saved</p>
    </main>`;
  $$('#sysSeg button').forEach(b => { b.onclick = () => { s.system = b.dataset.v; ui.system = null; save(); $$('#sysSeg button').forEach(x => x.classList.toggle('on', x === b)); }; });
  $('#spoons').onchange = e => { s.keepSpoons = e.target.checked; save(); };
  const paintCats = () => {
    $('#catlist').innerHTML = state.categories.map(c => `<div class="item" data-c="${esc(c)}"><span class="grow">${esc(c)}</span><button class="btn sm" data-act="ren">Rename</button><button class="btn sm danger" data-act="del">Delete</button></div>`).join('') || '<p class="hint">No categories yet.</p>';
  };
  paintCats();
  $('#catlist').onclick = e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const c = b.closest('.item').dataset.c;
    if (b.dataset.act === 'ren') { const n = prompt('Rename category', c); if (n && n.trim()) { renameCategory(c, n); paintCats(); } }
    else if (confirm(`Delete the category "${c}"? Recipes keep existing, they just lose this label.`)) { deleteCategory(c); paintCats(); }
  };
  $('#addcat').onclick = () => { const el = $('#newcat'); if (addCategory(el.value)) { el.value = ''; paintCats(); } };
  $('#bExport').onclick = () => {
    if (!state.recipes.length) { toast('Nothing to back up yet'); return; }
    send({ filename: `gcr-backup-${new Date().toISOString().slice(0, 10)}.gcr.json`, mime: 'application/json', text: exportJSON(state.recipes, state.categories, true), title: 'GCR backup' });
  };
  $('#bImport').onclick = pickFile;
}

// ---------------------------------------------------------------- start
load();
route();
