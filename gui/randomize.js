// ── gui/randomize.js ──────────────────────────────────────────
// Randomize button handler, the helper that pushes state values
// back into every control after a programmatic state change
// (preset apply / aspect switch / randomize), and the central
// theme switcher.

import {
  state,
  PALETTES,
  BG_GRADIENTS,
  applyPalette,
  getActiveBgPresets,
} from '../shared.js';
import {
  redraw,
  renderStopList,
  syncPaletteSelect,
  updateAspectLabel,
  _setSliderFill,
} from './controls.js';
import {
  rebuildBgSwatches,
  syncTheme,
  syncTextBaseUI,
  updateOverlays,
} from './overlays.js';

// ══════════════════════════════════════════════════════════════
// RANDOMIZE
// ══════════════════════════════════════════════════════════════

// Aspect-aware random ranges: counts and diameters that read well at
// each aspect's proportions. A wide aspect can fit fewer-but-larger
// circles; a tall aspect benefits from a higher circle count and
// thicker bar grids. Falls back to the generic ranges if an aspect
// isn't listed (e.g. a custom value).
const _ASPECT_RANGES = {
  '1:1':    { rectCount: [40, 130], circleCount: [4, 14], circleDiameter: [700, 1400] },
  '4:5':    { rectCount: [60, 150], circleCount: [4, 13], circleDiameter: [600, 1300] },
  '16:9':   { rectCount: [60, 160], circleCount: [3, 8],  circleDiameter: [700, 1500] },
  '1.91:1': { rectCount: [60, 160], circleCount: [3, 8],  circleDiameter: [700, 1500] },
  '9:16':   { rectCount: [40, 110], circleCount: [6, 16], circleDiameter: [500, 1300] },
};
const _DEFAULT_RANGES = { rectCount: [10, 70], circleCount: [5, 20], circleDiameter: [200, 1400] };

function _randInt([lo, hi]) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

export function randomize() {
  // ── Visual / aesthetic parameters only ───────────────────────
  // Composition structure (type, curve, baseline, anchor, mirror,
  // symmetry) is intentionally NOT randomised — those are manual choices.
  // When a BG gradient is active its theme is the single source of truth;
  // palette + gradient stop colours must stay within that pool.
  if (state.bgGradientMode && state.bgGradientPreset && BG_GRADIENTS[state.bgGradientPreset]) {
    state.theme = BG_GRADIENTS[state.bgGradientPreset].theme || (Math.random() > 0.5 ? 'warm' : 'cool');
  } else {
    state.theme = Math.random() > 0.5 ? 'warm' : 'cool';
  }
  const palKeys = Object.keys(PALETTES).filter(k => PALETTES[k].tone === state.theme);

  const r = _ASPECT_RANGES[state.aspectRatio] || _DEFAULT_RANGES;
  state.rectCount          = _randInt(r.rectCount);
  state.circleCount        = _randInt(r.circleCount);
  state.circleDiameter     = _randInt(r.circleDiameter);
  state.circleSpacingX     = +(Math.random()>0.7 ? Math.random()*200 : 0).toFixed(0);
  state.circleSpacingY     = +(Math.random()>0.7 ? Math.random()*200 : 0).toFixed(0);
  state.spacing            = 0;
  state.extent             = +(0.4+Math.random()*0.55).toFixed(2);
  state.opacity            = +(0.55+Math.random()*0.40).toFixed(2);
  state.blur               = Math.random()<0.35 ? +(Math.random()*10).toFixed(1) : 0;
  state.innerGlow          = Math.random() > 0.5;
  state.innerGlowIntensity = +(0.3+Math.random()*0.65).toFixed(2);
  // Always generate a fresh noise seed so noise mode looks different each time
  state.noiseSeed = Math.floor(Math.random()*999)+1;

  // Pick palette and auto-apply matching BG (all within the chosen theme)
  state.palette = palKeys[Math.floor(Math.random()*palKeys.length)];
  applyPalette(state.palette);

  const bgs = getActiveBgPresets();
  state.bgColor = bgs[Math.floor(Math.random()*bgs.length)].color;
  state.imageStrokeStyle = (state.theme === 'cool') ? 'frosty' : 'marketing';

  rebuildBgSwatches();
  syncTheme();
  syncControlsToState();
  updateOverlays();
  renderStopList();
}

export function syncControlsToState() {
  // Sliders with numeric display
  [
    ['ctrl-count',              'rectCount',          0],
    ['ctrl-circle-count',       'circleCount',        0],
    ['ctrl-diameter',           'circleDiameter',     0],
    ['ctrl-img-preset-opacity',  'imagePresetOpacity',  2],
    ['ctrl-circle-sp-x',        'circleSpacingX',     0],
    ['ctrl-circle-sp-y',        'circleSpacingY',     0],
    ['ctrl-circle-text-padding','circleTextPadding',  0],
    ['ctrl-noise-seed',         'noiseSeed',          0],
    ['ctrl-spacing',           'spacing',             1],
    ['ctrl-extent',            'extent',              2],
    ['ctrl-opacity',           'opacity',             2],
    ['ctrl-blur',              'blur',                1],
    ['ctrl-ds-spread',         'dsSpread',            2],
    ['ctrl-ds-opacity',        'dsOpacity',           2],
    ['ctrl-glow-intensity',    'innerGlowIntensity',  2],
    ['ctrl-hl-y',              'headlineYPos',        0],
    ['ctrl-hl-pad',            'headlinePadding',     0],
    ['ctrl-img-rad',           'imageRadius',         0],
    ['ctrl-img-count',         'imageMultiCount',     0],
    ['ctrl-img-multi-spacing', 'imageMultiSpacing',   0],
    ['ctrl-img-multi-stagger-y', 'imageMultiStaggerY', 0],
    ['ctrl-hl-fs',             'headlineFontSize',    0],
    ['ctrl-hl-lh',             'headlineLineHeight',  2],
    ['ctrl-img-scale',         'imageScale',          2],
    ['ctrl-img-y',             'imageYOffset',        0],
    ['ctrl-img-sop',           'imageStrokeOp',       2],
    ['ctrl-img-sw',            'imageStrokeWeight',   0],
  ].forEach(([id, key, dec]) => {
    const el = document.getElementById(id); if (!el) return;
    el.value = state[key];
    _setSliderFill(el);
    const b = el.closest('.slider-row')?.querySelector('.val');
    if (b) b.textContent = (+state[key]).toFixed(dec);
  });

  // Anchor grid
  const anchor = document.getElementById('ctrl-circle-align');
  if (anchor) anchor.querySelectorAll('.anchor-cell').forEach(c => c.classList.toggle('active', c.dataset.value === state.circleAlignment));

  // Image style tabs (5-chip strip)
  const styleRow = document.getElementById('ctrl-img-style');
  if (styleRow) {
    styleRow.querySelectorAll('.img-style-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.value === state.imageStyle));
    // Legacy thumbnail support (older custom builds)
    styleRow.querySelectorAll('.img-thumb').forEach(b =>
      b.classList.toggle('active', b.dataset.value === state.imageStyle));
  }
  // Image gallery — rebuild from the current style + active card index
  const gallery = document.getElementById('ctrl-img-idx');
  if (gallery && typeof gallery._rebuild === 'function') {
    gallery._rebuild();
  } else if (gallery) {
    // Fallback: just toggle the active class
    gallery.querySelectorAll('.img-gallery-card').forEach(b =>
      b.classList.toggle('active', parseInt(b.dataset.value, 10) === state.imageStyleIndex));
  }

  syncPaletteSelect();

  // Segmented controls
  [
    ['ctrl-aspect',        'aspectRatio'],
    ['ctrl-baseline',      'baseline'],
    ['ctrl-curve',         'curveType'],
    ['ctrl-palette-mode',  'paletteMode'],
    ['ctrl-hl-align',      'headlineAlign'],
    ['ctrl-ft-align',     'footerAlign'],
    ['ctrl-img-dist-mode','imageDistMode'],
    ['ctrl-img-stroke',   'imageStrokeStyle'],
    ['ctrl-hl-font',      'headlineFont'],
    ['ctrl-ft-font',      'footerFont'],
  ].forEach(([id, key]) => {
    const seg = document.getElementById(id);
    if (!seg) return;
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === String(state[key])));
  });

  // ctrl-bg-mode — boolean bgGradientMode → 'solid' | 'gradient' string values
  const bgModeSeg = document.getElementById('ctrl-bg-mode');
  if (bgModeSeg) {
    const v = state.bgGradientMode ? 'gradient' : 'solid';
    bgModeSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === v));
    const sg = document.getElementById('bg-solid-group');
    const gg = document.getElementById('bg-grad-group');
    if (sg) sg.style.display = state.bgGradientMode ? 'none' : '';
    if (gg) gg.style.display = state.bgGradientMode ? '' : 'none';
  }

  // ct-mode-col (colorMode)
  const ctMode = document.getElementById('ct-mode-col');
  if (ctMode) {
    ctMode.querySelectorAll('.ct-mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === (state.colorMode || 'dark')));
  }

  // Color pickers
  [
    ['ctrl-bgcolor',      'bgColor'],
    ['ctrl-hl-hl-color',  'headlineHighlightColor'],
    ['ctrl-hl-fill-col',  'headlineFillColor'],
  ].forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.value = state[key]; });

  // Text areas / inputs
  const hlTa = document.getElementById('ctrl-hl-text');
  if (hlTa) hlTa.value = state.headlineText || '';
  const hlWords = document.getElementById('ctrl-hl-words');
  if (hlWords) hlWords.value = state.headlineHighlightWords || '';

  // Fill opacity is hardcoded to 1.0 — no UI control
  state.headlineFillOpacity = 1;
  // Footer text opacity is hardcoded to 1.0 — UI control removed,
  // overrides any stale values restored from older presets.
  state.footerTextOpacity = 1;

  // Checkboxes
  [
    ['ctrl-symmetry',          'symmetry'],
    ['ctrl-mirror-y',          'mirrorY'],
    ['ctrl-flip-curve',        'flipCurve'],
    ['ctrl-circle-stagger-auto','circleStaggerAuto'],
    ['ctrl-circle-mirror',     'circleMirrorXY'],
    ['ctrl-circle-flip-anchor','circleFlipAnchor'],
    ['ctrl-circle-text-link',  'circleTextLink'],
    ['ctrl-global-op',         'globalOpacity'],
    ['ctrl-depth-shadow',      'depthShadow'],
    ['ctrl-inner-glow',        'innerGlow'],
    // Slides distribution is always on — force the legacy flag true
    // so old presets that saved imageMulti:false still render correctly.
    ['ctrl-bar-flip-grad',     'barFlipGradient'],
    ['ctrl-bg-grad-flip',      'bgGradientFlip'],
    ['ctrl-hl-fill',           'headlineFillEnabled'],
  ].forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.checked = state[key]; });

  // Force always-on slides distribution (covers older presets)
  state.imageMulti = true;
  // Slide count is restricted to odd numbers (1, 3, 5, 7, 9)
  let n = Math.max(1, Math.min(9, Math.floor(state.imageMultiCount)));
  if (n % 2 === 0) n = Math.min(9, n + 1);
  state.imageMultiCount = n;

  updateAspectLabel(state.aspectRatio);

  // Update slider fill CSS custom properties for all range inputs
  document.querySelectorAll('input[type="range"]').forEach(_setSliderFill);

  // Sync theme toggle and all filtered sub-menus
  syncTheme();
  // Sync text base toggles and opacity sliders
  syncTextBaseUI();
}

// ── _applyTheme: central warm/cool theme switcher ─────────────
export function _applyTheme(v) {
  state.theme = v;
  const firstPal = Object.entries(PALETTES).find(([, p]) => p.tone === v);
  if (firstPal) { state.palette = firstPal[0]; applyPalette(firstPal[0]); }
  state.imageStrokeStyle = (v === 'cool') ? 'frosty' : 'marketing';
  if (state.bgGradientMode && state.bgGradientPreset) {
    const currentBgTheme = BG_GRADIENTS[state.bgGradientPreset]?.theme;
    if (currentBgTheme !== v) {
      const firstBg = Object.entries(BG_GRADIENTS).find(([, bg]) => bg.theme === v);
      if (firstBg) {
        state.bgGradientPreset = firstBg[0];
        state.bgGradientStops  = JSON.parse(JSON.stringify(firstBg[1].stops));
        state.bgGradientDir    = firstBg[1].dir || 'vertical';
      } else {
        state.bgGradientMode = false;
      }
    }
  }
  const newBgs = getActiveBgPresets();
  if (newBgs.length && !newBgs.some(b => b.color.toLowerCase() === state.bgColor.toLowerCase())) {
    state.bgColor = newBgs[Math.floor(newBgs.length / 2)].color;
    const bgPicker = document.getElementById('ctrl-bgcolor');
    if (bgPicker) bgPicker.value = state.bgColor;
  }
  document.querySelectorAll('[data-theme-circle]').forEach(b => {
    b.classList.toggle('active', b.dataset.themeCircle === v);
  });
  syncTheme(); syncPaletteSelect(); renderStopList(); updateOverlays(); redraw();
}
