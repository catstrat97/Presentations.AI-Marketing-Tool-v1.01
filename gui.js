// ── gui.js ────────────────────────────────────────────────────
// Thin barrel: the GUI is split across the gui/ directory. Importing
// gui/init.js triggers DOM-ready initialisation; the side-effects of
// that module (Tweakpane build, control wiring, randomize/export
// handlers) are everything index.html needs.
//
// File layout (all under gui/):
//   controls.js   - mk* factories, ICONS, redraw(), gradient bar / stops / curve preview
//   overlays.js   - DOM headline / image / footer sync, theme sync, palette helpers
//   sections.js   - gradient + bg presets + image presets + image distribution
//   presets.js    - localStorage save/load + DEFAULT_PRESETS seeding
//   translate.js  - Translate panel + worker call + zip-export pipeline
//   randomize.js  - randomize(), syncControlsToState(), _applyTheme()
//   init.js       - buildGUI() + DOM-ready init (Tweakpane assembly)
import './gui/init.js';
