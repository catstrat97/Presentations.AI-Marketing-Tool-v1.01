# Presentations.AI Marketing Tool

A browser-based generative canvas for producing marketing visuals. Built with p5.js and vanilla JS — no build step.

## Running locally

The app loads local fonts and image presets, which browsers block when the page is opened via `file://`. Serve the directory over HTTP:

```bash
# Python 3 (already on macOS)
python3 -m http.server 8000

# or Node
npx serve .
```

Then open http://localhost:8000.

## Layout

- `index.html` — markup for canvas, overlays, and control panel
- `shared.js` — global state, palettes, color/curve/gradient utilities
- `sketch.js` — p5 canvas rendering (rectangle and circular compositions) and PNG export
- `gui.js` — control panel, overlay updates, randomize
- `style.css` — panel + overlay styling
- `Image Presets/` — preset images used by the Image Placeholder overlay
- `fonts/InnovatorGrotesk-*.otf` — headline/footer font
- `pai-wordmark.svg` — footer logo

## Export

The **Export PNG** button rasterizes the entire artboard (p5 canvas + HTML overlays) via `html2canvas` at 2× scale.
