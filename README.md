# GCR - Gantt Chart Recipes

Turns a recipe into a clear grid: ingredients down the left, and each step drawn as a
block across the ingredients it uses, left to right in time order. All plain code, no AI
inside the app, and it works offline.

## Get the app on your phone

1. Push to `main` (or open **Actions > Build Android APK > Run workflow**).
2. When the run finishes (about 5 minutes), open the repo's **Releases** page on your phone.
3. Tap **GCR.apk** under the `latest` release and install it. The first time, Android asks
   to allow installs from your browser: say yes.

Every build uses the same signing key (`signing/debug.keystore`), so a new APK installs
over the old one and **keeps your recipes**. If you ever uninstall the app first, the
recipes go with it, so use **Settings > Back up all recipes** now and then.

## Using it

- **Library**: search across titles, ingredients and steps; filter by your own categories.
- **Recipe view**: switch **Metric / US cups / Both**, scale **½× 1× 2× 3×**, zoom, then
  **Save / share image** (share sheet: save to Photos, print, send) or **Share recipe file**.
- **Editor**: type a recipe, or paste an ingredient list and it splits quantity, unit
  and name for you. For each step tick which ingredients it uses. The preview updates live.
- **Import**: the upload-arrow button loads a `.gcr.json` file (one recipe or many, or a backup).

### How the grid is drawn

- A step covers the rows from its first to its last ingredient, so put ingredients in the
  order they are added.
- **Also covers the mixture so far** stretches a step to include what the previous step covered.
- A step with no ingredients (like "bake") covers whatever the previous step covered.
- Steps go left to right; steps that touch different rows sit side by side.

## Recipe files and Claude

`skill/gcr-recipe-converter/` is a Claude skill. Add it to Claude (zip that folder and
upload it under Settings > Capabilities > Skills), then send Claude a photo or text of a recipe
and ask for a GCR file. It writes a `.gcr.json`, checks it with `scripts/check_recipe.py`,
and you import it into the app. `www/example.gcr.json` is a complete example (the app's
"Try the example" button loads it).

## Developing

```
npm install
npm test                  # unit tests for conversions, parser, grid placement, import, search
npm run serve             # try the app in a desktop browser at http://localhost:8080
```

- `www/js/units.js` unit conversion and number formatting
- `www/js/parser.js` ingredient line parser
- `www/js/recipe.js` data model, grid placement, import/export, search
- `www/js/layout.js`, `render.js` grid layout and canvas drawing (same code draws the screen and the saved image)
- `www/js/app.js` screens; `store.js` local storage; `native.js` share sheet
- `.github/workflows/build-apk.yml` builds the APK with Capacitor + Gradle

The `android/` folder is generated in the workflow (`npx cap add android`), so it isn't committed.
