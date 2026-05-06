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

export function buildImageDistControls(sec) {
  sec.appendChild(mkToggle({
    id: 'ctrl-img-multi', label: 'Multiple Instances', key: 'imageMulti',
    onChange: v => {
      const grp = document.getElementById('img-multi-group');
      if (grp) grp.style.display = v ? 'block' : 'none';
      updateOverlays();
    },
  }));

  const multiGroup = document.createElement('div'); multiGroup.id = 'img-multi-group';
  multiGroup.style.display = state.imageMulti ? 'block' : 'none';

  multiGroup.appendChild(mkSlider({ id:'ctrl-img-count', label:'Instance Count', min:1, max:10, step:1, key:'imageMultiCount', decimals:0, onChange: () => updateOverlays() }));

  multiGroup.appendChild(mkSegmented({
    id:'ctrl-img-dist-mode', label:'Distribution Mode', key:'imageDistMode',
    options: [
      ['horizontal', ICONS.distHoriz,   'Horizontal — row of instances'],
      ['point',      ICONS.distStagger, 'Point / Stagger — overlapping'],
    ],
    onChange: () => updateOverlays(),
  }));

  multiGroup.appendChild(mkSlider({ id:'ctrl-img-multi-spacing', label:'Spacing / Stagger', min:0, max:200, step:4, key:'imageMultiSpacing', decimals:0, onChange: () => updateOverlays() }));
  sec.appendChild(multiGroup);
}

// The legacy standalone Color & Theme section that used `mkSection`
// has been removed — the active build path lives in gui/init.js, which
// composes Color & Theme inside a Tweakpane folder. The helper
// functions it relies on (buildGradientSection, buildBgPresetsUI) are
// already exported above.
