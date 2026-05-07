// ── gui/sections.js ───────────────────────────────────────────
// Section builders that compose mk* controls into named regions of
// the panel: gradient bar + actions, BG preset swatches & gradient
// presets, image-style picker + gallery, multi-instance distribution
// controls, the Color & Theme panel (legacy / fallback build path).

import {
  state,
  PALETTES,
  BG_GRADIENTS,
  IMAGE_STYLES,
  shuffleStyleImages,
} from '../shared.js';
import {
  redraw,
  renderGradientBar,
  shuffleGradient,
  enforceSymmetrical,
  enforceSync,
  mkSegmented,
  mkToggle,
  mkSlider,
  mkSubLabel,
  _setSliderFill,
  ICONS,
} from './controls.js';
import {
  onBgChanged,
  rebuildBgSwatches,
  selectPalette,
  updateImageDistribution,
  updateOverlays,
} from './overlays.js';

// ══════════════════════════════════════════════════════════════
// GRADIENT SECTION — gradient bar + stop list only
// (Theme toggle and palette swatches now live in buildColorThemeSection)
// ══════════════════════════════════════════════════════════════
export function buildGradientSection(sec) {
  // 0. Stops Mode segmented (Normal | Symmetrical | Sync) — sits above the bar
  sec.appendChild(mkSegmented({
    id: 'ctrl-palette-mode', label: '', key: 'paletteMode',
    options: [['normal', 'Normal'], ['symmetrical', 'Symmetrical'], ['sync', 'Sync']],
    onChange: (v) => {
      state.paletteMode = v;
      if (v === 'symmetrical') enforceSymmetrical();
      else if (v === 'sync')   enforceSync();
      renderGradientBar();
      redraw();
    },
  }));

  // 1. Gradient Bar
  const barOuter = document.createElement('div'); barOuter.className = 'grad-bar-outer';
  const bar      = document.createElement('canvas'); bar.id = 'grad-bar'; bar.width = 280; bar.height = 40;
  const markers  = document.createElement('div'); markers.id = 'grad-markers'; markers.className = 'grad-markers';
  barOuter.appendChild(bar); barOuter.appendChild(markers);
  sec.appendChild(barOuter);

  // 2 & 3 — Flip + Shuffle action row (matching button styles)
  const actions = document.createElement('div');
  actions.className = 'grad-action-row';
  actions.id = 'grad-shuffle-row';

  // Flip Gradient button (replaces the toggle)
  const flipBtn = document.createElement('button');
  flipBtn.type = 'button';
  flipBtn.className = 'grad-action-btn' + (state.barFlipGradient ? ' active' : '');
  flipBtn.id = 'ctrl-bar-flip-grad-btn';
  flipBtn.title = 'Flip gradient direction';
  flipBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 5h8l-2-2"/><path d="M13 11H5l2 2"/>
    </svg>
    <span>Flip</span>`;
  flipBtn.addEventListener('click', () => {
    state.barFlipGradient = !state.barFlipGradient;
    flipBtn.classList.toggle('active', state.barFlipGradient);
    redraw();
  });
  actions.appendChild(flipBtn);

  // Shuffle Stops button
  const shuffleBtn = document.createElement('button');
  shuffleBtn.type = 'button';
  shuffleBtn.className = 'grad-action-btn';
  shuffleBtn.id = 'btn-shuffle-stops';
  shuffleBtn.title = 'Shuffle gradient stops';
  shuffleBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 4h3l3 8h3"/><path d="M2 12h3l3-8h3"/>
      <path d="M11 2l3 2-3 2"/><path d="M11 10l3 2-3 2"/>
    </svg>
    <span>Shuffle</span>`;
  shuffleBtn.addEventListener('click', shuffleGradient);
  actions.appendChild(shuffleBtn);

  sec.appendChild(actions);
}

// ══════════════════════════════════════════════════════════════
// BG PRESET SWATCHES + GRADIENT PRESETS (legacy single-section build)
// ══════════════════════════════════════════════════════════════
export function buildBgPresetsUI(sec) {
  // ── Flat colour swatches ──────────────────────────────────
  const wrap = document.createElement('div'); wrap.className = 'control-row';
  const lbl  = document.createElement('label'); lbl.textContent = 'BG Colour Presets';
  wrap.appendChild(lbl);
  const row = document.createElement('div'); row.className = 'bg-swatch-row'; row.id = 'bg-swatch-container';
  wrap.appendChild(row);
  sec.appendChild(wrap);
  rebuildBgSwatches();

  // ── Gradient BG presets ───────────────────────────────────
  sec.appendChild(mkSubLabel('BG Gradient Presets', 14));

  const gradWrap = document.createElement('div'); gradWrap.className = 'control-row';
  const gradRow  = document.createElement('div'); gradRow.className = 'bg-grad-row'; gradRow.id = 'bg-grad-container';

  // "Solid" reset button
  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.className = 'bg-grad-btn' + (!state.bgGradientMode ? ' active' : '');
  noneBtn.dataset.key = 'none';
  noneBtn.title = 'Solid colour (no BG gradient)';
  const noneSw = document.createElement('span'); noneSw.className = 'bg-grad-swatch';
  noneSw.style.background = '#0c0c0f';
  const noneLbl = document.createElement('span'); noneLbl.textContent = 'Solid';
  noneBtn.appendChild(noneSw); noneBtn.appendChild(noneLbl);
  noneBtn.addEventListener('click', () => {
    state.bgGradientMode = false;
    _syncBgGradBtns();
    onBgChanged();
    redraw();
  });
  gradRow.appendChild(noneBtn);

  // One button per BG_GRADIENTS entry — hidden if it doesn't match the active theme
  Object.entries(BG_GRADIENTS).forEach(([key, preset]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bg-grad-btn' + (state.bgGradientMode && state.bgGradientPreset === key ? ' active' : '');
    btn.dataset.key = key;
    btn.title = preset.label;
    btn.style.display = (!preset.theme || preset.theme === state.theme) ? '' : 'none';

    const css = preset.stops.map(s => `${s.color} ${(s.stop * 100).toFixed(0)}%`).join(', ');
    const sw  = document.createElement('span'); sw.className = 'bg-grad-swatch';
    sw.style.background = `linear-gradient(to bottom, ${css})`;
    const cap = document.createElement('span'); cap.textContent = preset.label;
    btn.appendChild(sw); btn.appendChild(cap);

    btn.addEventListener('click', () => {
      state.bgGradientMode   = true;
      state.bgGradientPreset = key;
      state.bgGradientStops  = JSON.parse(JSON.stringify(preset.stops));
      state.bgGradientDir    = preset.dir || 'vertical';
      _syncBgGradBtns();
      onBgChanged();
      redraw();
    });
    gradRow.appendChild(btn);
  });

  function _syncBgGradBtns() {
    gradRow.querySelectorAll('.bg-grad-btn').forEach(b => {
      const on = b.dataset.key === 'none'
        ? !state.bgGradientMode
        : (state.bgGradientMode && state.bgGradientPreset === b.dataset.key);
      b.classList.toggle('active', on);
    });
    const flipRow = document.getElementById('bg-grad-flip-row');
    if (flipRow) flipRow.style.display = state.bgGradientMode ? '' : 'none';
  }

  gradWrap.appendChild(gradRow);
  sec.appendChild(gradWrap);

  // BG gradient flip — visible only when gradient mode is on
  const bgFlipRow = mkToggle({
    id: 'ctrl-bg-grad-flip', label: 'Flip BG Gradient', key: 'bgGradientFlip',
    onChange: () => { onBgChanged(); redraw(); },
  });
  bgFlipRow.id = 'bg-grad-flip-row';
  bgFlipRow.style.display = state.bgGradientMode ? '' : 'none';
  sec.appendChild(bgFlipRow);
}

// ══════════════════════════════════════════════════════════════
// IMAGE PRESET + DISTRIBUTION CONTROLS
// ══════════════════════════════════════════════════════════════
export function buildImagePresetControls(sec) {
  // ── Style tabs (compact chip row) ─────────────────────────
  const styleTabs = document.createElement('div');
  styleTabs.className = 'img-style-tabs';
  styleTabs.id = 'ctrl-img-style';

  Object.keys(IMAGE_STYLES).forEach((key, idx) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'img-style-tab' + (state.imageStyle === key ? ' active' : '');
    tab.dataset.value = key;
    tab.textContent = String(idx + 1);
    tab.title = `Style ${idx + 1}`;
    tab.addEventListener('click', () => {
      state.imageStyle      = key;
      state.imageStyleIndex = 0;
      state.imageStyleOrder = null;
      styleTabs.querySelectorAll('.img-style-tab').forEach(b => b.classList.toggle('active', b.dataset.value === key));
      rebuildGallery();
      applySelectedImage();
      updateOverlays();
    });
    styleTabs.appendChild(tab);
  });
  sec.appendChild(styleTabs);

  // ── Image gallery (large 2-col thumbs) ────────────────────
  const gallery = document.createElement('div');
  gallery.className = 'img-gallery';
  gallery.id = 'ctrl-img-idx';
  sec.appendChild(gallery);

  // Expose a rebuild hook so syncControlsToState can refresh the
  // gallery + tabs after a preset is applied.
  gallery._rebuild = rebuildGallery;

  function rebuildGallery() {
    gallery.innerHTML = '';
    const imgs = IMAGE_STYLES[state.imageStyle] || [];
    if (imgs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'img-gallery-empty';
      empty.textContent = 'No images in this style';
      gallery.appendChild(empty);
      return;
    }
    imgs.forEach((path, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'img-gallery-card' + (state.imageStyleIndex === i ? ' active' : '');
      card.dataset.value = String(i);
      card.title = path.split('/').pop().replace(/\.png$/i, '');
      const im = document.createElement('img');
      im.src = path; im.alt = card.title; im.loading = 'lazy';
      card.appendChild(im);
      card.addEventListener('click', () => {
        state.imageStyleIndex = i;
        // In point/cascade mode, clicking a different slide reshuffles
        // the surrounding cascade for a fresh composition. Other modes
        // keep the centred-around-selection layout (no shuffle).
        if (state.imageDistMode === 'point' && state.imageMultiCount > 1) {
          shuffleStyleImages();
        } else {
          // Clearing the shuffled order lets the centred-distribution
          // logic in updateImageDistribution take over again.
          state.imageStyleOrder = null;
        }
        applySelectedImage();
        gallery.querySelectorAll('.img-gallery-card').forEach(b => b.classList.toggle('active', parseInt(b.dataset.value, 10) === i));
        updateOverlays();
      });
      gallery.appendChild(card);
    });
  }
  rebuildGallery();

  // ── Shuffle button (matches other action buttons) ────────
  const shuffleRow = document.createElement('div'); shuffleRow.className = 'control-row no-label';
  const shuffleBtn = document.createElement('button');
  shuffleBtn.type = 'button';
  shuffleBtn.id   = 'btn-shuffle-imgs';
  shuffleBtn.className = 'grad-action-btn';
  shuffleBtn.title = 'Randomise the image order';
  shuffleBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 4h3l3 8h3"/><path d="M2 12h3l3-8h3"/>
      <path d="M11 2l3 2-3 2"/><path d="M11 10l3 2-3 2"/>
    </svg>
    <span>Shuffle</span>`;
  shuffleBtn.addEventListener('click', () => {
    const imgs = IMAGE_STYLES[state.imageStyle] || [];
    if (imgs.length > 1) {
      // Pick a different random image from the gallery
      let next = state.imageStyleIndex;
      while (next === state.imageStyleIndex) {
        next = Math.floor(Math.random() * imgs.length);
      }
      state.imageStyleIndex = next;
    } else if (imgs.length === 1) {
      state.imageStyleIndex = 0;
    }
    applySelectedImage();
    // Also re-shuffle the multi-instance order
    shuffleStyleImages();
    // Refresh active state on the gallery cards
    gallery.querySelectorAll('.img-gallery-card').forEach(b =>
      b.classList.toggle('active', parseInt(b.dataset.value, 10) === state.imageStyleIndex));
    updateImageDistribution();
    updateOverlays();
  });
  shuffleRow.appendChild(shuffleBtn);
  sec.appendChild(shuffleRow);
}

export function applySelectedImage() {
  const imgs = IMAGE_STYLES[state.imageStyle] || [];
  const img  = imgs[state.imageStyleIndex];
  if (img) state.imageSrc = img;
}

// Per-mode slider configuration for the two stagger/offset controls.
// Each entry maps a state field → { label, min, max, step } for that mode.
const _DIST_SLIDER_CFG = {
  horizontal: {
    imageMultiSpacing:  { label: 'Spacing', min: 0,    max: 200, step: 20  },
    imageMultiStaggerY: { label: 'Offset',  min: -500, max: 500, step: 100 },
  },
  vertical: {
    // In vertical mode the meanings swap: Y becomes spacing, X becomes offset.
    imageMultiSpacing:  { label: 'Offset',  min: -500, max: 500, step: 100 },
    imageMultiStaggerY: { label: 'Spacing', min: 0,    max: 200, step: 20  },
  },
  point: {
    // Cascade: each instance shifts by (Side, Drop). Stepped values keep the
    // composition feeling intentional rather than fiddly.
    imageMultiSpacing:  { label: 'Side', min: -200, max: 200, step: 25 },
    imageMultiStaggerY: { label: 'Drop', min: -200, max: 200, step: 25 },
  },
};

// Re-label and re-range the two stagger sliders to match the active mode.
function _refreshDistStaggerControls() {
  const cfg = _DIST_SLIDER_CFG[state.imageDistMode] || _DIST_SLIDER_CFG.point;
  [
    ['ctrl-img-multi-spacing',   'imageMultiSpacing'],
    ['ctrl-img-multi-stagger-y', 'imageMultiStaggerY'],
  ].forEach(([id, key]) => {
    const slider = document.getElementById(id);
    if (!slider) return;
    const { label, min, max, step } = cfg[key];
    slider.min  = String(min);
    slider.max  = String(max);
    slider.step = String(step);
    // Snap value to the new range/step so the dot doesn't hang off the bar
    let v = state[key];
    v = Math.max(min, Math.min(max, v));
    v = Math.round(v / step) * step;
    state[key] = v;
    slider.value = v;
    // Update visible label + numeric readout
    const row = slider.closest('.slider-row');
    if (row) {
      const lbl = row.querySelector('.ctrl-label');
      if (lbl) lbl.textContent = label;
      const valEl = row.querySelector('.val');
      if (valEl) valEl.textContent = String(v);
    }
    _setSliderFill(slider);
  });
}

export function buildImageDistControls(sec) {
  // Always-on distribution. Slide Count locked to odd numbers (1,3,5,7,9).
  sec.appendChild(mkSlider({ id:'ctrl-img-count', label:'Slide Count', min:1, max:9, step:2, key:'imageMultiCount', decimals:0, onChange: () => updateOverlays() }));

  sec.appendChild(mkSegmented({
    id:'ctrl-img-dist-mode', label:'', key:'imageDistMode',
    options: [
      ['horizontal', ICONS.distHoriz,    'Horizontal — row of instances'],
      ['vertical',   ICONS.distVertical, 'Vertical — column of instances'],
      ['point',      ICONS.distStagger,  'Point / Stagger — overlapping'],
    ],
    onChange: () => { _refreshDistStaggerControls(); updateOverlays(); },
  }));

  // Initial config uses the current mode; gets re-applied on every mode change.
  const initCfg = _DIST_SLIDER_CFG[state.imageDistMode] || _DIST_SLIDER_CFG.point;
  sec.appendChild(mkSlider({
    id: 'ctrl-img-multi-spacing',
    label: initCfg.imageMultiSpacing.label,
    min:   initCfg.imageMultiSpacing.min,
    max:   initCfg.imageMultiSpacing.max,
    step:  initCfg.imageMultiSpacing.step,
    key:   'imageMultiSpacing',
    decimals: 0,
    onChange: () => updateOverlays(),
  }));
  sec.appendChild(mkSlider({
    id: 'ctrl-img-multi-stagger-y',
    label: initCfg.imageMultiStaggerY.label,
    min:   initCfg.imageMultiStaggerY.min,
    max:   initCfg.imageMultiStaggerY.max,
    step:  initCfg.imageMultiStaggerY.step,
    key:   'imageMultiStaggerY',
    decimals: 0,
    onChange: () => updateOverlays(),
  }));

  // Snap once on first build so out-of-range values from old presets settle.
  requestAnimationFrame(_refreshDistStaggerControls);
}

// The legacy standalone Color & Theme section that used `mkSection`
// has been removed — the active build path lives in gui/init.js, which
// composes Color & Theme inside a Tweakpane folder. The helper
// functions it relies on (buildGradientSection, buildBgPresetsUI) are
// already exported above.
