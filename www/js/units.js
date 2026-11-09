// Units, conversion and number formatting. Pure code, no AI, no network.

export const MASS = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
export const VOL = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 240, floz: 30 };

// Which measuring system a unit belongs to. tsp/tbsp are used in both.
const SYS = { g: 'metric', kg: 'metric', ml: 'metric', l: 'metric', oz: 'us', lb: 'us', cup: 'us', floz: 'us', tsp: 'both', tbsp: 'both' };

export const SYSTEMS = { metric: 'Metric', us: 'US cups', both: 'Both' };

// Units offered in the editor drop-downs (value, label)
export const UNIT_CHOICES = [
  ['', '(count)'], ['g', 'g'], ['kg', 'kg'], ['ml', 'ml'], ['l', 'l'],
  ['tsp', 'tsp'], ['tbsp', 'tbsp'], ['cup', 'cup'], ['oz', 'oz'], ['lb', 'lb'],
  ['floz', 'fl oz'], ['pinch', 'pinch'], ['clove', 'clove'], ['slice', 'slice'],
  ['can', 'can'], ['bunch', 'bunch'], ['sprig', 'sprig'], ['stick', 'stick'],
];

const PLURALS = {
  clove: 'cloves', slice: 'slices', bunch: 'bunches', can: 'cans', tin: 'tins', sprig: 'sprigs',
  stick: 'sticks', knob: 'knobs', handful: 'handfuls', packet: 'packets', pack: 'packs',
  shot: 'shots', dash: 'dashes', splash: 'splashes', pinch: 'pinches', cup: 'cups',
  stalk: 'stalks', head: 'heads', sheet: 'sheets', fillet: 'fillets', rasher: 'rashers',
};
const SINGULARS = Object.fromEntries(Object.entries(PLURALS).map(([s, p]) => [p, s]));

const SYNONYMS = {
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', mls: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  floz: 'floz', 'fl oz': 'floz', 'fl. oz': 'floz', 'fl.oz': 'floz', 'fluid ounce': 'floz', 'fluid ounces': 'floz',
};

// Returns the canonical unit string for anything the user might type ('' = count).
export function normalizeUnit(u) {
  if (u == null) return '';
  const raw = String(u).trim().toLowerCase().replace(/\.$/, '');
  if (!raw) return '';
  if (raw === 'l' || raw === 'liter') return 'l';
  if (SYNONYMS[raw]) return SYNONYMS[raw];
  if (SINGULARS[raw]) return SINGULARS[raw];
  return raw;
}

export function isKnownUnit(u) {
  const n = normalizeUnit(u);
  return n in MASS || n in VOL || n === 'pinch' || n in PLURALS;
}

export function unitKind(u) {
  if (u in MASS) return 'mass';
  if (u in VOL) return 'vol';
  return 'other';
}

// --- Approximate densities (grams per metric cup of 240 ml) for converting
// between weight and volume. Only used when the recipe doesn't give both.
const DENSITIES = [
  { re: /\b(milk|buttermilk|water|cream|stock|broth|oil|juice|vinegar|wine|beer|coffee|espresso|yoghurt|yogurt|passata)\b/i, g: 240, liquid: true },
  { re: /\b(icing sugar|confectioners'?|powdered sugar)\b/i, g: 120 },
  { re: /\b(brown sugar|muscovado)\b/i, g: 200 },
  { re: /\bsugar\b/i, g: 200 },
  { re: /\b(ground almonds?|almond flour)\b/i, g: 96 },
  { re: /\b(cornflour|cornstarch|corn flour)\b/i, g: 120 },
  { re: /\bflour\b/i, g: 125 },
  { re: /\b(butter|margarine)\b/i, g: 227 },
  { re: /\bcocoa\b/i, g: 85 },
  { re: /\b(oats?|porridge)\b/i, g: 90 },
  { re: /\brice\b/i, g: 185 },
  { re: /\b(honey|syrup|treacle|molasses)\b/i, g: 340 },
  { re: /\bsalt\b/i, g: 290 },
  { re: /\b(baking powder|baking soda|bicarb)/i, g: 230 },
  { re: /\bchocolate (chips?|chunks?)\b/i, g: 170 },
  { re: /\bbreadcrumbs?\b/i, g: 110 },
  { re: /\b(parmesan|cheddar|grated cheese)\b/i, g: 100 },
];

export function densityFor(name) {
  const n = String(name || '');
  return DENSITIES.find(d => d.re.test(n)) || null;
}

// --- number formatting
const FRACS = [[0, ''], [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'], [1 / 2, '1/2'], [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [7 / 8, '7/8'], [1, '']];

export function fmtFraction(v) {
  if (v >= 10) return String(Math.round(v));
  let whole = Math.floor(v);
  const frac = v - whole;
  let best = FRACS[0], bd = Infinity;
  for (const f of FRACS) { const d = Math.abs(f[0] - frac); if (d < bd) { bd = d; best = f; } }
  if (best[0] === 1) { whole += 1; best = FRACS[0]; }
  if (whole === 0 && best[0] === 0) return v > 0 ? '1/8' : '0';
  return [whole || '', best[1]].filter(x => x !== '').join(' ');
}

function fracToNumber(s) {
  return s.split(' ').reduce((t, p) => {
    if (p.includes('/')) { const [a, b] = p.split('/'); return t + +a / +b; }
    return t + (parseFloat(p) || 0);
  }, 0);
}

export function fmtMetricNum(v) {
  if (v < 10) return String(Math.round(v * 10) / 10);
  if (v < 30) return String(Math.round(v));
  return String(Math.round(v / 5) * 5);
}

function fmtDec(v, dp) { return String(Math.round(v * 10 ** dp) / 10 ** dp); }

export function unitLabel(unit, qty) {
  if (unit === 'floz') return 'fl oz';
  if (qty > 1 && PLURALS[unit]) return PLURALS[unit];
  return unit;
}

export function fmtAmount(a) {
  if (!a || a.qty == null) return '';
  const { qty, unit } = a;
  let n;
  if (unit === 'g' || unit === 'ml') n = fmtMetricNum(qty);
  else if (unit === 'kg' || unit === 'l') n = fmtDec(qty, 2);
  else n = fmtFraction(qty);
  const shown = n.includes('/') || n.includes(' ') ? fracToNumber(n) : parseFloat(n);
  const u = unitLabel(unit, shown);
  return u ? `${n} ${u}` : n;
}

// --- conversion
function tidyMetric(base, baseUnit) {
  if (base >= 1000) return { qty: base / 1000, unit: baseUnit === 'g' ? 'kg' : 'l' };
  return { qty: base, unit: baseUnit };
}
function volUS(ml) {
  if (ml >= 59) return { qty: ml / 240, unit: 'cup' };
  if (ml >= 14) return { qty: ml / 15, unit: 'tbsp' };
  return { qty: ml / 5, unit: 'tsp' };
}
function massUS(g) {
  const oz = g / MASS.oz;
  return oz >= 16 ? { qty: Math.round((g / MASS.lb) * 4) / 4, unit: 'lb' } : { qty: oz, unit: 'oz' };
}

// Convert one amount ({qty, unit}) into the wanted system ('metric' | 'us').
export function convertAmount(a, name, system, opts = {}) {
  const keepSpoons = opts.keepSpoons !== false;
  if (!a || a.qty == null) return a;
  const { qty, unit } = a;
  const kind = unitKind(unit);
  if (kind === 'other') return a;
  const dens = densityFor(name);
  if (system === 'metric') {
    if (kind === 'mass') return tidyMetric(qty * MASS[unit], 'g');
    if (unit === 'ml' || unit === 'l') return tidyMetric(qty * VOL[unit], 'ml');
    if ((unit === 'tsp' || unit === 'tbsp') && keepSpoons) return a;
    const ml = qty * VOL[unit];
    if (dens && !dens.liquid) return tidyMetric((ml / 240) * dens.g, 'g');
    return tidyMetric(ml, 'ml');
  }
  // US
  if (kind === 'vol') {
    if (unit === 'ml' || unit === 'l') return volUS(qty * VOL[unit]);
    return a;
  }
  if (unit === 'oz' || unit === 'lb') return a;
  const g = qty * MASS[unit];
  if (dens && !dens.liquid) return volUS((g / dens.g) * 240);
  if (g < 14) return { qty: g, unit: 'g' };
  return massUS(g);
}

function pick(ing, factor, system, opts) {
  const scale = a => (a && a.qty != null ? { qty: a.qty * factor, unit: a.unit || '' } : null);
  const p = scale({ qty: ing.qty, unit: ing.unit });
  const alt = scale(ing.alt);
  if (!p) return null;
  if (system === 'metric' && opts.keepSpoons !== false && (p.unit === 'tsp' || p.unit === 'tbsp')) return convertAmount(p, ing.name, system, opts);
  const exact = [p, alt].find(c => c && SYS[c.unit] === system);
  return convertAmount(exact || p, ing.name, system, opts);
}

// "1 cup (200 g) sugar" style label for one ingredient row.
export function ingredientLabel(ing, factor = 1, system = 'metric', opts = {}) {
  const name = ing.name || '';
  if (ing.qty == null) return name;
  let amount;
  if (system === 'both') {
    const us = fmtAmount(pick(ing, factor, 'us', opts));
    const me = fmtAmount(pick(ing, factor, 'metric', opts));
    amount = us === me || !me ? us : (!us ? me : `${us} (${me})`);
  } else {
    amount = fmtAmount(pick(ing, factor, system, opts));
  }
  return `${amount} ${name}`.trim();
}

// --- temperatures inside free text: "350°F (170°C)", "180°C", "400 °F"
const TEMP_RE = /(\d{2,3})\s*°\s*([CF])(?:\s*\(\s*(\d{2,3})\s*°\s*([CF])\s*\))?/gi;
const r5 = v => Math.round(v / 5) * 5;
const toC = f => r5(((f - 32) * 5) / 9);
const toF = c => r5((c * 9) / 5 + 32);

export function convertTemps(text, system) {
  return String(text).replace(TEMP_RE, (m, a, au, b, bu) => {
    a = +a; au = au.toUpperCase();
    let F, C;
    if (b && bu && bu.toUpperCase() !== au) { b = +b; if (au === 'F') { F = a; C = b; } else { C = a; F = b; } }
    else if (au === 'F') { F = a; C = toC(a); } else { C = a; F = toF(a); }
    if (system === 'us') return `${F}°F`;
    if (system === 'metric') return `${C}°C`;
    return `${F}°F (${C}°C)`;
  });
}
