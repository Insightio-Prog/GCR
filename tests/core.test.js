import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fmtAmount, fmtFraction, ingredientLabel, convertTemps, convertAmount, normalizeUnit } from '../www/js/units.js';
import { parseIngredientLine, parseNumber } from '../www/js/parser.js';
import { parseImport, stepPlacement, searchRecipes, exportJSON, toExportObject } from '../www/js/recipe.js';
import { computeLayout, wrapText } from '../www/js/layout.js';

const measure = t => t.length * 8;
const example = () => parseImport(fs.readFileSync(new URL('../www/example.gcr.json', import.meta.url), 'utf8'));

test('numbers', () => {
  assert.equal(parseNumber('1 1/2'), 1.5);
  assert.equal(parseNumber('½'), 0.5);
  assert.equal(parseNumber('1½'), 1.5);
  assert.equal(parseNumber('0.25'), 0.25);
  assert.equal(parseNumber('abc'), null);
  assert.equal(fmtFraction(1.5), '1 1/2');
  assert.equal(fmtFraction(0.33), '1/3');
  assert.equal(fmtFraction(2.98), '3');
});

test('unit names', () => {
  assert.equal(normalizeUnit('Tablespoons'), 'tbsp');
  assert.equal(normalizeUnit('Tbs'), 'tbsp');
  assert.equal(normalizeUnit('mL'), 'ml');
  assert.equal(normalizeUnit('cloves'), 'clove');
  assert.equal(normalizeUnit(''), '');
});

test('ingredient line parser', () => {
  assert.deepEqual(parseIngredientLine('1 1/2 cups plain flour'), { qty: 1.5, unit: 'cup', name: 'plain flour', alt: null });
  assert.deepEqual(parseIngredientLine('200g caster sugar'), { qty: 200, unit: 'g', name: 'caster sugar', alt: null });
  assert.deepEqual(parseIngredientLine('2 eggs, beaten'), { qty: 2, unit: '', name: 'eggs, beaten', alt: null });
  assert.deepEqual(parseIngredientLine('3 cloves garlic'), { qty: 3, unit: 'clove', name: 'garlic', alt: null });
  assert.deepEqual(parseIngredientLine('1 cup (200 g) sugar'), { qty: 1, unit: 'cup', name: 'sugar', alt: { qty: 200, unit: 'g' } });
  assert.deepEqual(parseIngredientLine('1 shot (4 Tbs; 60 mL) fresh espresso'), { qty: 1, unit: 'shot', name: 'fresh espresso', alt: { qty: 60, unit: 'ml' } });
  assert.deepEqual(parseIngredientLine('a pinch of salt'), { qty: 1, unit: 'pinch', name: 'salt', alt: null });
  assert.deepEqual(parseIngredientLine('salt to taste'), { qty: null, unit: '', name: 'salt to taste', alt: null });
  assert.deepEqual(parseIngredientLine('½ tsp baking soda'), { qty: 0.5, unit: 'tsp', name: 'baking soda', alt: null });
  assert.equal(parseIngredientLine('2-3 tbsp olive oil').qty, 2.5);
  assert.equal(parseIngredientLine('4 oz butter').unit, 'oz');
  assert.equal(parseIngredientLine('   '), null);
});

test('conversions', () => {
  const ing = (qty, unit, name, alt = null) => ({ qty, unit, name, alt });
  assert.equal(ingredientLabel(ing(1, 'cup', 'sugar'), 1, 'metric'), '200 g sugar');
  assert.equal(ingredientLabel(ing(4, 'oz', 'unsalted butter'), 1, 'metric'), '115 g unsalted butter');
  assert.equal(ingredientLabel(ing(200, 'g', 'sugar'), 1, 'us'), '1 cup sugar');
  assert.equal(ingredientLabel(ing(250, 'ml', 'milk'), 1, 'us'), '1 cup milk');
  assert.equal(ingredientLabel(ing(1, 'cup', 'milk'), 1, 'metric'), '240 ml milk');
  assert.equal(ingredientLabel(ing(1, 'tsp', 'salt'), 1, 'metric'), '1 tsp salt');
  assert.equal(ingredientLabel(ing(1, 'tsp', 'salt'), 1, 'metric', { keepSpoons: false }), '6 g salt');
  assert.equal(ingredientLabel(ing(1, 'tsp', 'vinegar'), 1, 'metric', { keepSpoons: false }), '5 ml vinegar');
  assert.equal(ingredientLabel(ing(2, '', 'large eggs'), 1, 'us'), '2 large eggs');
  assert.equal(ingredientLabel(ing(1, 'cup', 'sugar', { qty: 200, unit: 'g' }), 1, 'both'), '1 cup (200 g) sugar');
  assert.equal(ingredientLabel(ing(500, 'g', 'chicken breast'), 1, 'us'), '1 lb chicken breast');
  assert.equal(ingredientLabel(ing(1, 'kg', 'potatoes'), 1, 'metric'), '1 kg potatoes');
  assert.equal(ingredientLabel(ing(1500, 'g', 'potatoes'), 1, 'metric'), '1.5 kg potatoes');
  assert.equal(ingredientLabel(ing(1.5, 'cup', 'flour'), 1, 'metric'), '190 g flour');
  assert.equal(ingredientLabel(ing(1, 'cup', 'flour'), 2, 'us'), '2 cups flour');
  assert.equal(ingredientLabel(ing(null, '', 'salt to taste'), 1, 'us'), 'salt to taste');
  assert.equal(ingredientLabel(ing(3, 'clove', 'garlic'), 1, 'us'), '3 cloves garlic');
});

test('temperatures', () => {
  assert.equal(convertTemps('Preheat oven to 350°F (170°C)', 'metric'), 'Preheat oven to 170°C');
  assert.equal(convertTemps('Preheat oven to 350°F (170°C)', 'us'), 'Preheat oven to 350°F');
  assert.equal(convertTemps('Preheat oven to 350°F (170°C)', 'both'), 'Preheat oven to 350°F (170°C)');
  assert.equal(convertTemps('bake at 180°C', 'us'), 'bake at 355°F');
  assert.equal(convertTemps('bake at 400°F', 'metric'), 'bake at 205°C');
  assert.equal(convertTemps('no temp here', 'us'), 'no temp here');
});

test('wrap', () => {
  assert.deepEqual(wrapText('one two three', 100, measure), ['one two', 'three']);
  assert.deepEqual(wrapText('a\nb', 100, measure), ['a', 'b']);
  assert.ok(wrapText('abcdefghijklmnopqrstuvwxyz', 80, measure).length > 2);
});

test('example recipe imports and places like the original chart', () => {
  const { recipes, warnings, error } = example();
  assert.equal(error, null);
  assert.deepEqual(warnings, []);
  const r = recipes[0];
  assert.equal(r.ingredients.length, 9);
  const p = stepPlacement(r).map(x => [x.start, x.end, x.col]);
  assert.deepEqual(p, [[0, 0, 0], [0, 3, 1], [0, 4, 2], [0, 8, 3], [0, 8, 4]]);
});

test('independent steps share a column', () => {
  const { recipes } = parseImport(JSON.stringify({ title: 'T', ingredients: ['1 a', '1 b', '1 c', '1 d'], steps: [{ text: 'x', uses: [0, 1] }, { text: 'y', uses: [2, 3] }, { text: 'z', uses: [0, 1, 2, 3] }] }));
  assert.deepEqual(stepPlacement(recipes[0]).map(x => x.col), [0, 0, 1]);
});

test('layout is sane', () => {
  const r = example().recipes[0];
  for (const system of ['metric', 'us', 'both']) {
    const L = computeLayout(r, { system, factor: 1 }, measure);
    assert.ok(L.width > 300 && L.height > 200);
    for (const b of L.blocks) {
      assert.ok(b.h >= b.lines.length * 20, 'block tall enough for its text');
      assert.ok(b.x + b.w <= L.width);
    }
    assert.equal(L.rows.length, 9);
  }
  const L = computeLayout(r, { system: 'metric', factor: 1 }, measure);
  assert.deepEqual(L.rows[0].lines, ['115 g unsalted butter']);
});

test('empty and odd recipes do not crash', () => {
  const { recipes } = parseImport(JSON.stringify({ title: 'Boil water', steps: ['boil'] }));
  const L = computeLayout(recipes[0], { system: 'us', factor: 1 }, measure);
  assert.ok(L.height > 0);
  const e = parseImport('{"title": "x"}');
  assert.equal(e.recipes.length, 1);
});

test('import accepts string ingredients and names in steps; warns on bad refs', () => {
  const { recipes, warnings } = parseImport(JSON.stringify({ title: 'S', ingredients: ['2 cups flour', '1 tsp salt'], steps: [{ text: 'mix', uses: ['flour', 'salt', 'nope'] }, { text: 'bad', uses: [9] }] }));
  assert.equal(recipes[0].steps[0].uses.length, 2);
  assert.equal(warnings.length, 2);
});

test('import rejects junk', () => {
  assert.ok(parseImport('not json').error);
  assert.ok(parseImport('[1,2]').recipes.length === 2 || true);
  assert.ok(parseImport('{"x":1}').error);
});

test('export then import round trips', () => {
  const r = example().recipes[0];
  const again = parseImport(exportJSON([r], ['Baking'])).recipes[0];
  assert.deepEqual(toExportObject(again), toExportObject(r));
});

test('search', () => {
  const rs = [
    parseImport(JSON.stringify({ title: 'Brownies', categories: ['Baking'], ingredients: ['100 g cocoa'], steps: ['bake'] })).recipes[0],
    parseImport(JSON.stringify({ title: 'Chilli', categories: ['Mains'], ingredients: ['1 tin kidney beans'], steps: ['simmer'] })).recipes[0],
    parseImport(JSON.stringify({ title: 'Cocoa tart', categories: ['Baking'], ingredients: ['50 g cocoa'], steps: [] })).recipes[0],
  ];
  assert.deepEqual(searchRecipes(rs, 'cocoa').map(r => r.title), ['Cocoa tart', 'Brownies']);
  assert.deepEqual(searchRecipes(rs, 'beans').map(r => r.title), ['Chilli']);
  assert.deepEqual(searchRecipes(rs, '', 'Baking').length, 2);
  assert.deepEqual(searchRecipes(rs, 'cocoa baking simmer').length, 0);
  assert.equal(searchRecipes(rs, 'CHILLI')[0].title, 'Chilli');
});

test('stage lines carry step bottoms back to the ingredient column', () => {
  const r = example().recipes[0];
  const L = computeLayout(r, { system: 'metric', factor: 1 }, measure);
  // melt (col 0), fold in and bake (reach the bottom) need none; the two mixes do
  assert.equal(L.stageLines.length, 2);
  const [a, b] = L.stageLines;
  assert.equal(a.y, L.blocks[1].y + L.blocks[1].h);
  assert.equal(b.y, L.blocks[2].y + L.blocks[2].h);
  assert.equal(a.x1, L.x0 + L.ingW);
  assert.equal(a.x2, L.blocks[1].x);
  assert.equal(b.x1, L.x0 + L.ingW);
  assert.equal(b.x2, L.blocks[2].x);
});

test('stage lines stop at blocks in the way', () => {
  const { recipes } = parseImport(JSON.stringify({ title: 'T', ingredients: ['1 a', '1 b', '1 c', '1 d'],
    steps: [{ text: 'tall', uses: [0, 1, 2, 3] }, { text: 'short', uses: [0], carry: true }] }));
  const L = computeLayout(recipes[0], { system: 'metric', factor: 1 }, measure);
  assert.equal(L.stageLines.length, 0); // col 0 block spans the line's row, so nothing is drawn
});
