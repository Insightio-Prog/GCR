// Local storage of recipes on the phone (localStorage inside the app's WebView).
const KEY = 'gcr.v1';

export const state = {
  recipes: [],
  categories: [],
  settings: { system: 'metric', keepSpoons: true },
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    state.recipes = Array.isArray(d.recipes) ? d.recipes : [];
    state.categories = Array.isArray(d.categories) ? d.categories : [];
    state.settings = { ...state.settings, ...(d.settings || {}) };
  } catch (e) { console.warn('GCR: could not read saved data', e); }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (e) { console.warn('GCR: could not save', e); return false; }
}

export const byId = id => state.recipes.find(r => r.id === id);

export function upsert(recipe) {
  const i = state.recipes.findIndex(r => r.id === recipe.id);
  if (i >= 0) state.recipes[i] = recipe; else state.recipes.push(recipe);
  for (const c of recipe.categories) addCategory(c, false);
  save();
}

export function remove(id) {
  state.recipes = state.recipes.filter(r => r.id !== id);
  save();
}

export function addCategory(name, persist = true) {
  name = String(name || '').trim();
  if (!name) return false;
  if (!state.categories.some(c => c.toLowerCase() === name.toLowerCase())) {
    state.categories.push(name);
    state.categories.sort((a, b) => a.localeCompare(b));
    if (persist) save();
    return true;
  }
  return false;
}

export function renameCategory(from, to) {
  to = String(to || '').trim();
  if (!to || from === to) return;
  state.categories = [...new Set(state.categories.map(c => (c === from ? to : c)))].sort((a, b) => a.localeCompare(b));
  state.recipes.forEach(r => { r.categories = [...new Set(r.categories.map(c => (c === from ? to : c)))]; });
  save();
}

export function deleteCategory(name) {
  state.categories = state.categories.filter(c => c !== name);
  state.recipes.forEach(r => { r.categories = r.categories.filter(c => c !== name); });
  save();
}

// Merge imported recipes. Same id = replace (backup restore), otherwise add.
export function mergeImport(recipes, categories = []) {
  let added = 0, replaced = 0;
  for (const r of recipes) {
    const i = state.recipes.findIndex(x => x.id === r.id);
    if (i >= 0) { state.recipes[i] = r; replaced++; } else { state.recipes.push(r); added++; }
    r.categories.forEach(c => addCategory(c, false));
  }
  categories.forEach(c => addCategory(c, false));
  save();
  return { added, replaced };
}
