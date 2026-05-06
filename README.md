# Presentations.AI Marketing Tool

A browser-based generative canvas for producing marketing visuals. Built with p5.js, Tweakpane, and vanilla JS — no build step.

## Running locally

The app loads local fonts and image presets, which browsers block when the page is opened via `file://`. Serve the directory over HTTP:

```bash
# Python 3 (already on macOS)
python3 -m http.server 8000

# or Node
npx serve .
```

Then open http://localhost:8000.

## Features

- **Three composition modes:** rectangle bars, circular packs, or full-image backdrops
- **Five aspect ratios:** 1:1, 4:5, 16:9, 9:16, 1.91:1 — each ships with hand-tuned typography and layout defaults
- **Curve-driven shapes:** linear, quadratic, cubic, parabolic, hyperbolic, bezier, or 1-D value noise
- **Live HTML overlays:** editable headline (click to edit), image placeholder with style presets, footer with logo
- **Theming:** warm/cool tones × dark/light modes, with background-swatch and gradient presets that match the shape palette
- **Presets:** save/load named configurations to `localStorage` (key: `pai-tool-presets-v1`)
- **Randomize:** shuffles visual parameters within the current theme without touching composition structure
- **Export PNG:** rasterizes the entire artboard at 2× via a pure-canvas compositor (matches what's on screen, including `backdrop-filter` blur)

## Layout

- `index.html` — markup for canvas, overlays, and control panel; loads p5.js, html2canvas, and Tweakpane v3 from CDNs
- `shared.js` — global `state`, palettes, per-aspect defaults, curve/color/gradient utilities, default presets
- `sketch.js` — p5 canvas rendering (rectangle, circular, image) and the PNG export compositor
- `gui.js` — Tweakpane control panel, overlay updates, randomize, preset persistence
- `style.css` — panel + overlay styling, font-face declarations
- `Image Presets/` — preset images grouped by visual style, used by the Image Placeholder overlay
- `Background Presets/` — full-canvas backdrops for the image composition mode
- `fonts/InnovatorGrotesk-*.otf` — headline/footer font (Regular / Medium / Bold)
- `img/pai-wordmark.svg` — footer logo

## Coordinate system

All layout values (font sizes, paddings, offsets) are stored in **design units** assuming a 2696px-wide artboard. The CSS variable `--scale` (set by `sketch.js`) is `cw / 2696`, and overlays scale via `calc(<design-px> * var(--scale))`. Numbers ported from Figma should be multiplied by `2696 / figma_canvas_width`.

## Export

The **Export PNG** button (`window._exportCanvas` in `sketch.js`) draws the p5 canvas into a 2×-scale offscreen canvas, then composites the image / headline / footer overlays on top — including a manual reproduction of the footer's `backdrop-filter: blur()`. Any change to live overlay rendering must also be mirrored in `_drawImages` / `_drawHeadline` / `_drawFooter` for the export to match.

## Resetting presets

User presets are stored in `localStorage` under `pai-tool-presets-v1`. To reset to the bundled defaults, clear that key in DevTools and reload.
