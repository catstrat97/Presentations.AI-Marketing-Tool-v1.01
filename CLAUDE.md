# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

There is no build step. The app uses `file://`-blocked resources (local fonts, image presets) so it must be served over HTTP:

```bash
python3 -m http.server 8000   # or: npx serve .
```

Then open http://localhost:8000.

There are no tests, no linter, and no package manifest. p5.js, html2canvas, and Tweakpane v3 are loaded from CDNs in `index.html`.

## Architecture

Three globally-scoped scripts share a single mutable `state` object. Load order matters and is fixed in `index.html`:

1. **`shared.js`** — defines `const state`, palette/gradient constants (`PALETTES`, `BG_GRADIENTS`, `BG_PALETTE_MAP`), per-aspect defaults (`ASPECT_RATIO_DEFAULTS`), curve math (`getCurveValue`, `cubicBezier`, `valueNoise1D`), color utilities (`hexToRgb`, `sampleGradient`, `lerpColor`), the `IMAGE_STYLES` registry, and `DEFAULT_PRESETS` (seeded into localStorage on first load).
2. **`sketch.js`** — p5 instance. Reads `state` and renders the **rectangle**, **circular**, or **image** composition onto a p5 canvas via `drawingContext` (raw 2D canvas API, not p5 primitives, to use gradients/clipping/filters). Exposes `window._p5Redraw`, `window._p5Resize`, and `window._exportCanvas` (a pure-canvas compositor that replaces html2canvas — it redraws p5 + overlays into a 2× canvas for PNG export).
3. **`gui.js`** — Tweakpane v3 control panel injected into `#panel-scroll`. Each control mutates `state` and calls `redraw()` (which calls `window._p5Redraw()` + re-renders the gradient bar / curve preview). Also runs `updateOverlays()` to push state into the DOM overlays.

### Hybrid canvas + DOM overlay rendering

The artboard is a p5 canvas with HTML overlays (`#overlay-headline`, `#overlay-image`, `#overlay-footer`) absolutely positioned on top. **Live editing uses the DOM** (the headline is `contentEditable`); **PNG export rasterises the DOM into a 2D canvas** in `_exportCanvas` (sketch.js:934). Anything visible during live editing must also be drawn in `_drawImages` / `_drawHeadline` / `_drawFooter` for the export to match — these are deliberate parallel implementations.

### The 2696px design-unit coordinate system

All numeric layout values in `state` (font sizes, paddings, Y offsets, stroke weights) are expressed in **design units** assuming a 2696px-wide artboard. `sketch.js` sets `--scale = cw / 2696` on `#artboard`, and the CSS / overlay code uses `calc(<design-px> * var(--scale))` to scale everything. Numbers in `ASPECT_RATIO_DEFAULTS` are in this 2696 space — when porting from Figma, multiply by `2696 / figma_canvas_width`.

### Aspect ratios reset layout defaults

Switching aspect ratio in the GUI does NOT just resize the canvas — it merges `ASPECT_RATIO_DEFAULTS[ratio]` into `state` (font size, headline Y / padding / fill paddings, image scale / Y offset / radius, bg color). If you add a new layout knob, decide whether each aspect needs its own value and add it to all five entries in `ASPECT_RATIO_DEFAULTS` (`shared.js:25`).

### Theme / palette / background coupling

- `state.theme` (`'warm'` | `'cool'`) is the single source of truth for tone.
- `state.colorMode` (`'dark'` | `'light'`) gates which BG swatches appear.
- `getActiveBgPresets()` returns `BG_PALETTE_MAP[theme + '-' + colorMode]`.
- `randomize()` (gui.js:2365) only randomises **visual** parameters — it deliberately preserves composition structure (type, baseline, symmetry, mirror, curve) and palettes stay within the active theme. Don't randomise structural fields.
- `onBgChanged()` (gui.js:75) auto-derives headline/footer text colour from BG luma; `paletteMode === 'sync'` also pulls a gradient stop to match the BG.

### Composition types

`state.compositionType` switches between three renderers, all in `sketch.js`:
- `'rectangle'` → `renderComposition` (rows of bars driven by `curveType`, `baseline`, `symmetry`, `mirrorY`, `extent`)
- `'circular'` → `renderCircularComposition` (circles driven by `circleCount`, `circleDiameter`, `circleAlignment`, `circleMirrorXY`, `circleStagger`)
- `'image'` → `renderImageComposition` (preloaded `Background Presets/BG-Dark.png` or `BG-Light.png` as a full-canvas backdrop)

Both rectangle and circular renderers wrap their impl in `_withHeadlineBoundsIfFilled` — when the headline fill box is enabled, the composition is clipped to draw only below it.

### Presets

User presets persist in `localStorage` under key `pai-tool-presets-v1`. On first load `DEFAULT_PRESETS` (`shared.js:577`) is seeded. To reset to defaults during dev: clear that key in DevTools. A preset snap is just `JSON.parse(JSON.stringify(state))`; restoring assigns back into `state` and runs `syncControlsToState()` + `updateOverlays()`.

### Headline highlight words

`state.headlineHighlightWords` is a space-separated word list; matched words in `headlineText` are coloured `headlineHighlightColor`. Matching is whitespace-tokenised and case-insensitive after stripping non-`[a-z0-9'-]`. The DOM path (`_renderHeadlineHTML`, gui.js:232) and the export path (`_drawHeadline`, sketch.js:817) re-implement the same matching — keep them in sync.

## Conventions

- Edit `state` directly, then call `redraw()` (or `window._p5Redraw()` from sketch). No reactive framework.
- Slider/select/toggle helpers in gui.js (`mkSlider`, `mkSelect`, `mkSegmented`, `mkToggle`, etc.) take a `key` that maps to a `state` field — prefer them over hand-rolled DOM.
- When adding a new state field that must persist in presets, no registration is needed (snaps shallow-copy `state`), but if it has a per-aspect default, add it to `ASPECT_RATIO_DEFAULTS`.
- Image preset paths in `IMAGE_STYLES` use literal em-dashes (`—`) — these are the actual filenames in `Image Presets/`. Don't ASCII-fy them.
