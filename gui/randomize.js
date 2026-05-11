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
  enforceCircleCoupling,
  enforceFillCoupling,
  enforceFlipCurveRule,
  onBgChanged,
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
  '1:1':    { rectCount: [40, 130], circleCount: [8, 14], circleDiameter: [950, 1500] },
  '4:5':    { rectCount: [60, 150], circleCount: [8, 13], circleDiameter: [600, 1300] },
  '16:9':   { rectCount: [60, 160], circleCount: [8, 14], circleDiameter: [700, 1500] },
  '1.91:1': { rectCount: [60, 160], circleCount: [8, 14], circleDiameter: [700, 1500] },
  '9:16':   { rectCount: [40, 110], circleCount: [8, 16], circleDiameter: [500, 1300] },
};
const _DEFAULT_RANGES = { rectCount: [10, 70], circleCount: [8, 20], circleDiameter: [200, 1400] };

function _randInt([lo, hi]) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

export function randomize() {
  // ── Visual / aesthetic parameters only ───────────────────────
  // Composition structure (type, curve, anchor, mirror, symmetry) is
  // intentionally NOT randomised — those are manual choices. Baseline
  // IS randomised, but only between top and bottom — the left/right
  // baselines look broken without symmetry tuning, so they're never
  // chosen by Random.
  // When a BG gradient is active its theme is the single source of truth;
  // palette + gradient stop colours must stay within that pool.
  if (state.bgGradientMode && state.bgGradientPreset && BG_GRADIENTS[state.bgGradientPreset]) {
    state.theme = BG_GRADIENTS[state.bgGradientPreset].theme || (Math.random() > 0.5 ? 'warm' : 'cool');
  } else {
    state.theme = Math.random() > 0.5 ? 'warm' : 'cool';
  }

  // Baseline: pick from the options actually allowed by the current
  // fill-coupling state. Fill OFF disables Bottom + Right (only Top and
  // Left remain). Fill ON allows the full set.
  const baselineChoices = state.headlineFillEnabled
    ? ['top', 'bottom', 'left', 'right']
    : ['top', 'left'];
  state.baseline = baselineChoices[Math.floor(Math.random() * baselineChoices.length)];
  // Symmetry: togglable in fill-off mode, so include it in random.
  // Mirror axis is locked ON by enforceFillCoupling() at the tail of
  // randomize() — no need to set it here.
  state.symmetry = Math.random() > 0.5;

  // Curve: pick from the non-flat options to avoid the "every Random
  // ends up on a straight line" feel. If the resulting baseline +
  // symmetry combo restricts curves to {flat, parabolic} the coupling
  // helper at the tail will snap to 'parabolic' (not 'flat').
  const curveChoices = ['linear', 'quadratic', 'cubic', 'parabolic', 'hyperbolic', 'bezier', 'noise'];
  state.curveType = curveChoices[Math.floor(Math.random() * curveChoices.length)];

  // Flip Curve: 20% chance the current value toggles. Most clicks
  // preserve direction so the user gets continuity; occasional flips
  // add variety.
  if (Math.random() < 0.2) state.flipCurve = !state.flipCurve;

  // Text Fill on/off: 20% chance the current value toggles, regardless
  // of current direction (symmetric).
  if (Math.random() < 0.2) state.headlineFillEnabled = !state.headlineFillEnabled;

  // Fill colour: 50/50 between the two binary options. The text-base
  // colour is set to the inverse by enforceFillCoupling() at the tail.
  state.headlineFillColor = Math.random() > 0.5 ? '#ffffff' : '#000000';

  // Slide style: pick from a theme-constrained set so the slide art
  // pairs cleanly with the random palette. Reset the slide index to 0
  // since the new style's image list is unrelated to the old one.
  const slideChoices = state.theme === 'cool'
    ? ['style1', 'style3']
    : ['style2', 'style3', 'style4', 'style5'];
  state.imageStyle      = slideChoices[Math.floor(Math.random() * slideChoices.length)];
  state.imageStyleIndex = 0;
  state.imageStyleOrder = null;
  state.userImageSrc    = '';   // Random picks a new preset slide; clear any upload

  const palKeys = Object.keys(PALETTES).filter(k => PALETTES[k].tone === state.theme);

  const r = _ASPECT_RANGES[state.aspectRatio] || _DEFAULT_RANGES;
  state.rectCount          = _randInt(r.rectCount);
  state.circleCount        = _randInt(r.circleCount);
  state.circleDiameter     = _randInt(r.circleDiameter);
  // Circle stagger: X-only — Y offset is always 0 (mirror mode
  // positions circles dynamically on the Y axis so they touch their
  // reflection regardless of diameter; manual Y offset would break it).
  const _staggerCap   = Math.max(25, Math.min(150, Math.floor(state.circleDiameter / 8 / 25) * 25));
  const _staggerSteps = Math.floor(_staggerCap / 25);
  const _rollStagger  = () => {
    if (Math.random() > 0.4) return 0;
    const sign = Math.random() < 0.5 ? -1 : 1;
    return sign * (1 + Math.floor(Math.random() * _staggerSteps)) * 25;
  };
  state.circleSpacingX = _rollStagger();
  state.circleSpacingY = 0;
  state.spacing            = 0;
  state.extent             = +(0.4+Math.random()*0.55).toFixed(2);
  // Anchor 'center-left' forces opacity into the 0.30–0.50 band so the
  // multi-mirror cascade reads as a translucent stack rather than a
  // solid wedge. Other anchors get the full 0.55–0.95 range.
  state.opacity = (state.compositionType === 'circular' && state.circleAlignment === 'center-left')
    ? +(0.30 + Math.random() * 0.20).toFixed(2)
    : +(0.55 + Math.random() * 0.40).toFixed(2);
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

  // ── Defensive theme sync ─────────────────────────────────
  // Belt-and-braces: confirm palette + bg gradient + bgColor are all in
  // the same theme as state.theme. Catches any drift from preset
  // restore, prior session state, or a path where applyPalette ran with
  // a stale key.
  const targetTheme = state.theme;
  if (PALETTES[state.palette]?.tone !== targetTheme && palKeys.length) {
    state.palette = palKeys[Math.floor(Math.random()*palKeys.length)];
    applyPalette(state.palette);
  }
  if (state.bgGradientMode && state.bgGradientPreset) {
    const def = BG_GRADIENTS[state.bgGradientPreset];
    if (def && def.theme !== targetTheme) {
      const replacement = Object.entries(BG_GRADIENTS).find(([, d]) => d.theme === targetTheme);
      if (replacement) {
        state.bgGradientPreset = replacement[0];
        state.bgGradientStops  = JSON.parse(JSON.stringify(replacement[1].stops));
        state.bgGradientDir    = replacement[1].dir || 'vertical';
      }
    }
  }
  // bgColor: re-pick if the chosen swatch doesn't belong to the active
  // theme/mode bucket (getActiveBgPresets is theme+mode filtered, so
  // this is mostly a sanity net for race conditions).
  const validBg = getActiveBgPresets();
  if (validBg.length && !validBg.some(b => b.color.toLowerCase() === state.bgColor.toLowerCase())) {
    state.bgColor = validBg[Math.floor(Math.random()*validBg.length)].color;
  }

  // Fill-box padding: only 1:1 and 4:5 get randomised within a range;
  // other aspects keep their locked per-aspect value. Top and bottom
  // are always equal.
  if (state.aspectRatio === '1:1') {
    const p = 88 + Math.floor(Math.random() * (156 - 88 + 1));
    state.headlineFillPaddingTop = p;
    state.headlineFillPaddingBottom = p;
  } else if (state.aspectRatio === '4:5') {
    const p = 108 + Math.floor(Math.random() * (152 - 108 + 1));
    state.headlineFillPaddingTop = p;
    state.headlineFillPaddingBottom = p;
  }

  rebuildBgSwatches();
  syncTheme();
  // Re-apply the fill/palette-mode coupling: if Fill Behind Text is off
  // we must remain in Sync mode (applyPalette above rebuilt the stops).
  enforceFillCoupling();
  // Circle coupling: clamps diameter, syncs anchor / mirror / flipAnchor.
  enforceCircleCoupling();
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
    // ctrl-img-preset-opacity removed from UI
    // ctrl-circle-sp-x / ctrl-circle-sp-y removed — Fine Tune section gone.
    // ctrl-circle-text-padding removed — Text-Aware Positioning gone
    ['ctrl-noise-seed',         'noiseSeed',          0],
    ['ctrl-spacing',           'spacing',             1],
    ['ctrl-extent',            'extent',              2],
    ['ctrl-opacity',           'opacity',             2],
    ['ctrl-blur',              'blur',                1],
    ['ctrl-ds-spread',         'dsSpread',            2],
    ['ctrl-ds-opacity',        'dsOpacity',           2],
    ['ctrl-glow-intensity',    'innerGlowIntensity',  2],
    // Headline sliders (font size, line height, Y position, L/R padding,
    // fill padding) all removed — values locked per aspect.
    ['ctrl-img-rad',           'imageRadius',         0],
    ['ctrl-img-count',         'imageMultiCount',     0],
    ['ctrl-img-multi-spacing', 'imageMultiSpacing',   0],
    ['ctrl-img-multi-stagger-y', 'imageMultiStaggerY', 0],
    ['ctrl-img-scale',         'imageScale',          2],
    ['ctrl-img-y',             'imageYOffset',        0],
    // ctrl-img-sop / ctrl-img-sw removed — locked to 1.0 / 12.
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
    ['ctrl-img-dist-mode','imageDistMode'],
    ['ctrl-img-stroke',   'imageStrokeStyle'],
    // ctrl-hl-align / ctrl-hl-font removed — locked to center/regular
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

  // Color pickers (free hex). The fill-colour control is now a binary
  // Black/White segmented — handled separately below. The headline
  // highlight colour picker was removed (auto-derived in
  // applyTextAdaptation), so we only sync the BG colour here.
  [
    ['ctrl-bgcolor',      'bgColor'],
  ].forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.value = state[key]; });

  // Fill-colour binary segmented — sync active class to state value.
  const fillSeg = document.getElementById('ctrl-hl-fill-col');
  if (fillSeg) {
    // Coerce legacy non-binary values to the nearest of black/white.
    if (state.headlineFillColor !== '#000000' && state.headlineFillColor !== '#ffffff') {
      state.headlineFillColor = '#000000';
    }
    fillSeg.querySelectorAll('.seg-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.value === state.headlineFillColor));
  }

  // Text areas / inputs
  const hlTa = document.getElementById('ctrl-hl-text');
  if (hlTa) hlTa.value = state.headlineText || '';
  const hlWords = document.getElementById('ctrl-hl-words');
  if (hlWords) hlWords.value = state.headlineHighlightWords || '';


  // Checkboxes
  [
    ['ctrl-symmetry',          'symmetry'],
    ['ctrl-mirror-y',          'mirrorY'],
    ['ctrl-flip-curve',        'flipCurve'],
    ['ctrl-circle-stagger-auto','circleStaggerAuto'],
    ['ctrl-circle-mirror',     'circleMirrorXY'],
    // ctrl-circle-flip-anchor / ctrl-circle-text-link removed from UI
    // ctrl-global-op removed — globalOpacity is now permanently true
    // (forced below to migrate older presets that saved it false).
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
  // Stroke weight + opacity are locked (sliders removed); normalise
  // any legacy preset values so the renderer always uses 12 / 100%.
  state.imageStrokeWeight = 12;
  state.imageStrokeOp     = 1.0;
  // Slide count is restricted to odd numbers (1, 3, 5, 7, 9)
  let n = Math.max(1, Math.min(9, Math.floor(state.imageMultiCount)));
  if (n % 2 === 0) n = Math.min(9, n + 1);
  state.imageMultiCount = n;
  // Blend-as-group is permanently on; legacy presets get corrected here.
  state.globalOpacity = true;

  updateAspectLabel(state.aspectRatio);

  // Update slider fill CSS custom properties for all range inputs
  document.querySelectorAll('input[type="range"]').forEach(_setSliderFill);

  // Sync theme toggle and all filtered sub-menus
  syncTheme();
  // Sync text base toggles and opacity sliders
  syncTextBaseUI();

  // ── Composition cards / control-group / curve-wrap active state ──
  // These are built once at boot with classes pinned to the initial
  // state.compositionType. Without this re-sync, a preset that lands
  // with a different composition leaves the GUI showing the wrong
  // section's controls (and the wrong card highlighted).
  const compType = state.compositionType;
  const _setActive = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', on);
  };
  _setActive('comp-card-rect', compType === 'rectangle');
  _setActive('comp-card-circ', compType === 'circular');
  _setActive('comp-card-img',  compType === 'image');
  _setActive('group-rect',     compType === 'rectangle');
  _setActive('group-circ',     compType === 'circular');
  _setActive('group-img-comp', compType === 'image');
  const curveWrap = document.getElementById('curve-controls-wrap');
  if (curveWrap) {
    curveWrap.style.display = (compType === 'circular' || compType === 'image') ? 'none' : '';
  }
  // Hide blur slider + global opacity in image-comp mode (rule lives in init.js).
  if (typeof window._syncBlurVisibility === 'function') window._syncBlurVisibility();

  // ── Re-fire all background / composition coupling rules ──
  // These keep the dark-BG opacity floor, palette-mode lock, sync-mode
  // gradient stops, circle anchor lock, fill colour rules etc. in step
  // with whatever state we just landed in. Without this, switching
  // composition manually (or loading a preset on first paint) leaves
  // the previously-applied rules stale.
  enforceFillCoupling();
  enforceCircleCoupling();
  enforceFlipCurveRule();
  onBgChanged();
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
      // Prefer the (theme + colorMode)-matched preset so warm-light
      // / cool-light stay paired with their mode.
      const wantMode = state.colorMode || 'dark';
      const themeModeMatch = Object.entries(BG_GRADIENTS).find(
        ([, bg]) => bg.theme === v && (bg.mode || 'dark') === wantMode
      );
      const anyThemeMatch = themeModeMatch
        || Object.entries(BG_GRADIENTS).find(([, bg]) => bg.theme === v);
      if (anyThemeMatch) {
        state.bgGradientPreset = anyThemeMatch[0];
        state.bgGradientStops  = JSON.parse(JSON.stringify(anyThemeMatch[1].stops));
        state.bgGradientDir    = anyThemeMatch[1].dir || 'vertical';
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
