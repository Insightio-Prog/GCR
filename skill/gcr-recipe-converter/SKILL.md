---
name: gcr-recipe-converter
description: Turn a recipe (photo, screenshot, pasted text, or just a dish name) into a GCR recipe file (.gcr.json) that the user imports into their GCR "Gantt Chart Recipes" phone app. Use whenever the user mentions GCR, Gantt chart recipes, a recipe grid/chart, or asks to convert or format a recipe for their recipe app.
---

# GCR recipe converter

GCR draws a recipe as a grid: ingredients down the left, and each method step as a
block spanning the ingredient rows it uses, running left to right in time order.
Your job is to produce a `.gcr.json` file the app can import (Import button, or
Settings > Import a file). No AI runs inside the app, so the file must be exact.

## Steps

1. Read the recipe (image, text, or write it from the dish name if asked). Keep the
   user's quantities exactly. Do not invent or "improve" amounts.
2. Order the ingredients **by when they go in**, so each step's ingredients sit
   together (see "How the grid is drawn").
3. Write the JSON (format below) to `<dish-slug>.gcr.json`.
4. Run `python3 scripts/check_recipe.py <file>` from this skill's folder. Fix anything
   it reports, and look at the ASCII grid it prints: it should read like the recipe.
5. Give the user the file, and tell them in one line what to do: save it, open GCR,
   tap the import (upload arrow) icon, pick the file.

Several recipes can go in one file (put them all in `recipes`).

## File format

```json
{
  "gcr": 1,
  "recipes": [
    {
      "title": "Espresso Brownies",
      "servings": 9,
      "categories": ["Baking"],
      "prep": ["Butter and flour an 8x8-in pan", "Preheat oven to 350°F (170°C)"],
      "ingredients": [
        { "qty": 115, "unit": "g", "name": "unsalted butter", "alt": { "qty": 4, "unit": "oz" } },
        { "qty": 2, "unit": "", "name": "large eggs" },
        { "qty": null, "unit": "", "name": "salt to taste" }
      ],
      "steps": [
        { "text": "melt", "uses": [0] },
        { "text": "mix", "uses": [1], "carry": true },
        { "text": "bake\n350°F (170°C)\n30 to 40 min", "uses": [] }
      ],
      "notes": "Optional free text shown under the grid."
    }
  ]
}
```

Field rules:
- `title` required. `servings` a number or omit. `categories` optional list of names
  (the app creates them). `notes` optional.
- `prep`: full-width lines across the top (oven, tins, equipment, mise en place).
- `ingredients[]`: `qty` a number (`0.25`, not "1/4") or `null` for "to taste"; `unit`
  one of `g kg ml l tsp tbsp cup oz lb floz pinch clove slice can bunch sprig stick`
  or `""` for counts (eggs, onions). `name` required: put prep notes in it
  ("onions, sliced").
- `alt`: a second measure **when the source gives both** (e.g. "1 cup (200 g)"):
  primary is what is listed first or is most exact, `alt` the other. The app uses
  `alt` for exact switching between Metric and US. Never calculate an `alt` yourself;
  the app converts on its own when `alt` is missing.
- `steps[]`: `text` is short, a few words ("mix", "fold in", "simmer 45 min"). Use
  `\n` to break lines. Put temperature and time in the text. Write temperatures as
  `350°F (170°C)` or `180°C`: the app switches °C/°F by itself.
- `uses`: **zero-based indexes** into `ingredients` for what this step adds.
- `carry`: `true` when the step also works on the mixture made so far (mixing,
  folding, simmering, baking). Default false.

## How the grid is drawn (this decides your ordering)

- A step's block covers rows from its first to its last used ingredient. So ingredients
  that are used together must be **next to each other** in the list.
- `carry: true` stretches the block to also cover whatever the previous step covered.
- A step with `uses: []` covers exactly what the previous step covered (e.g. "bake").
- Steps are placed left to right: a step goes one column right of any earlier step it
  overlaps. Independent sub-recipes (e.g. a sauce and a dough) that touch different
  rows land in the same column, side by side.

Worked example: butter (0) melt; sugar, vanilla, espresso (1-3) mixed in; eggs (4)
mixed in; flour, cocoa, soda, salt (5-8) folded in; bake. Steps:
`melt [0]`, `mix [1,2,3] carry`, `mix [4] carry`, `fold in [5,6,7,8] carry`, `bake []`.

## Reading photos

- Transcribe numbers carefully; if something is unreadable, say which line and ask
  rather than guessing.
- If the source lists steps as a paragraph, split it into the short actions in order.
- If one step is "mix dry ingredients together", list those ingredients next to
  each other and use one step that covers them all.
- Don't copy a whole cookbook page; just the recipe the user asked for.
