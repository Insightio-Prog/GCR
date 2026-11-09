// Rules-based ingredient line parser (no AI). "1 1/2 cups plain flour" -> {qty:1.5, unit:'cup', name:'plain flour'}
import { normalizeUnit, isKnownUnit } from './units.js';

const UF = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
const UFC = '½¼¾⅓⅔⅛⅜⅝⅞';
const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[${UFC}]|\\d+\\/\\d+|\\d*\\.\\d+|\\d+|[${UFC}])`;

// "1 1/2" | "3/4" | "½" | "1½" | "0.5" | "2" -> number, else null
export function parseNumber(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  if (typeof str === 'number') return str;
  let m;
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + +m[2] / +m[3];
  if ((m = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞])$/))) return +m[1] + UF[m[2]];
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return +m[2] ? +m[1] / +m[2] : null;
  if (UF[s] != null) return UF[s];
  if (/^\d*\.?\d+$/.test(s)) return parseFloat(s);
  return null;
}

const SPECIAL = /^(?:a|an|one)\s+(pinch|dash|splash|knob|handful|bunch|sprig)\s+(?:of\s+)?(.*)$/i;

function parseParen(inner) {
  // pick the last "number unit" pair that has a recognised unit: "4 Tbs; 60 mL" -> 60 ml
  const re = new RegExp(`(${NUM})\\s*([A-Za-z]+(?:\\.?\\s?oz)?)`, 'g');
  let m, found = null;
  while ((m = re.exec(inner))) {
    const q = parseNumber(m[1]);
    const u = normalizeUnit(m[2]);
    if (q != null && isKnownUnit(u)) found = { qty: q, unit: u };
  }
  return found;
}

export function parseIngredientLine(line) {
  let s = String(line || '').trim().replace(/^[-•*•]\s*/, '').replace(/\s+/g, ' ');
  if (!s) return null;

  let m = s.match(SPECIAL);
  if (m) return { qty: 1, unit: normalizeUnit(m[1]), name: m[2].trim() || m[1], alt: null };

  m = s.match(new RegExp(`^(${NUM})(?:\\s*(?:-|–|to)\\s*(${NUM}))?\\s*(.*)$`, 'i'));
  if (!m) return { qty: null, unit: '', name: s, alt: null };
  let qty = parseNumber(m[1]);
  if (m[2]) { const hi = parseNumber(m[2]); if (hi != null && qty != null) qty = (qty + hi) / 2; }
  let rest = m[3].trim();
  let alt = null, unit = '';

  const takeParen = () => {
    const pm = rest.match(/^\(([^)]*)\)\s*/);
    if (pm) { const a = parseParen(pm[1]); if (a) { alt = alt || a; rest = rest.slice(pm[0].length); return true; } }
    return false;
  };

  takeParen();
  const um = rest.match(/^(fl\.?\s?oz\.?|[A-Za-z]+\.?)(?=\s|$|\()/);
  if (um) {
    const cand = normalizeUnit(um[1]);
    if (isKnownUnit(cand)) { unit = cand; rest = rest.slice(um[0].length).trim(); }
  }
  takeParen();
  rest = rest.replace(/^of\s+/i, '').trim();
  const name = rest || (unit ? unit : '');
  if (!rest && unit) unit = '';
  return { qty, unit, name, alt };
}

export function parseIngredientBlock(text) {
  return String(text || '').split(/\r?\n/).map(parseIngredientLine).filter(Boolean);
}
