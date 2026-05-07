// ── gui/init.js ───────────────────────────────────────────────
// Top-level wiring: assembles the Tweakpane folders, registers each
// section's controls, sets up the inline editable headline, the
// drag-to-move panel header, the export button, and the random
// button. Runs once at DOM ready.

import {
  state,
  PALETTES,
  BG_GRADIENTS,
  IMAGE_STYLES,
  applyPalette,
  applyAspectFields,
  snapshotAspectFields,
  getActiveBgPresets,
  ASPECT_RATIO_DEFAULTS,
} from '../shared.js';
import {
  redraw,
  renderGradientBar,
  renderStopList,
  renderCurvePreview,
  syncPaletteSelect,
  ICONS,
  curveThumbSvg,
  updateAspectLabel,
  mkSlider,
  mkColor,
  mkToggle,
  mkSegmented,
  mkAnchorGrid,
  mkInput,
  mkTextarea,
  mkSubLabel,
} from './controls.js';
import {
  applyTextAdaptation,
  autoAssignTextColor,
  onBgChanged,
  rebuildBgSwatches,
  rebuildCtSwatches,
  selectPalette,
  syncTheme,
  updateOverlays,
  mkTextBaseControl,
} from './overlays.js';
import {
  buildGradientSection,
  buildImagePresetControls,
  buildImageDistControls,
} from './sections.js';
import { buildPresetsContent, applyDefaultPreset } from './presets.js';
import { buildTranslateSection } from './translate.js';
import {
  syncControlsToState,
  _applyTheme,
} from './randomize.js';

// Helper used by the BG gradient group
function _buildBgGradPresets(container) {
  const gradWrap = document.createElement('div'); gradWrap.className = 'control-row';
  const gradRow  = document.createElement('div'); gradRow.className = 'bg-grad-row'; gradRow.id = 'bg-grad-container';

  // One button per BG_GRADIENTS entry
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
      _syncBgGradBtnsInner(gradRow);
      // Reflect "Solid → Gradient" in the BG Type segmented + group visibility
      const bgModeSeg = document.getElementById('ctrl-bg-mode');
      if (bgModeSeg) {
        bgModeSeg.querySelectorAll('.seg-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.value === 'gradient'));
      }
      const sg = document.getElementById('bg-solid-group');
      const gg = document.getElementById('bg-grad-group');
      if (sg) sg.style.display = 'none';
      if (gg) gg.style.display = '';
      onBgChanged();
      redraw();
    });
    gradRow.appendChild(btn);
  });

  gradWrap.appendChild(gradRow);
  container.appendChild(gradWrap);

  // BG gradient flip toggle
  const bgFlipRow = mkToggle({
    id: 'ctrl-bg-grad-flip', label: 'Flip BG Gradient', key: 'bgGradientFlip',
    onChange: () => { onBgChanged(); redraw(); },
  });
  bgFlipRow.id = 'bg-grad-flip-row';
  container.appendChild(bgFlipRow);
}

function _syncBgGradBtnsInner(gradRow) {
  gradRow.querySelectorAll('.bg-grad-btn').forEach(b => {
    b.classList.toggle('active', state.bgGradientMode && state.bgGradientPreset === b.dataset.key);
  });
}

// ══════════════════════════════════════════════════════════════
// BUILD GUI
// ══════════════════════════════════════════════════════════════
function buildGUI() {
  const scroll = document.getElementById('panel-scroll');

  // ── Tweakpane pane ────────────────────────────────────────
  const pane = new Tweakpane.Pane({ container: scroll });
  window._pane = pane;

  // Hide the Tweakpane root title bar (try both v3 naming variants)
  requestAnimationFrame(() => {
    const rotTitle = scroll.querySelector('.tp-rotv_t, .tp-rot_t, .tp-rot > .tp-fld_t');
    if (rotTitle) rotTitle.style.display = 'none';
  });

  // Helper: inject custom DOM into a Tweakpane folder's content area
  function into(folder, buildFn) {
    const el = document.createElement('div');
    el.className = 'tp-custom';
    buildFn(el);
    // Tweakpane v3 uses .tp-fld_c for folder content
    const cnt = folder.element.querySelector('.tp-fld_c') ||
                folder.element.querySelector('.tp-fldv_c') ||
                folder.element;
    cnt.appendChild(el);
  }

  // Track all folders for accordion behaviour
  const allFolders = [];
  function registerFolder(f) { allFolders.push(f); return f; }

  // ── Asset Size (Canvas + Presets, merged) ─────────────────
  // Order inside the folder:
  //   1. Aspect Ratio bar  (existing styling, unchanged behaviour)
  //   2. Preset list        (filtered to current aspect ratio)
  //   3. Save Preset row    (saves into the active aspect's bucket)
  let _refreshPresetList = null;
  const fAssetSize = registerFolder(pane.addFolder({ title: 'Asset Size', expanded: true }));
  into(fAssetSize, ct => {
    ct.classList.add('section-asset-size');

    // 1. Aspect Ratio bar
    ct.appendChild(mkSegmented({
      id: 'ctrl-aspect', label: 'Aspect Ratio', key: 'aspectRatio',
      options: [
        ['1:1',    ICONS.asp1x1,   '1:1 — Square'],
        ['4:5',    ICONS.asp4x5,   '4:5 — Portrait'],
        ['16:9',   ICONS.asp16x9,  '16:9 — Landscape'],
        ['9:16',   ICONS.asp9x16,  '9:16 — Story'],
        ['1.91:1', ICONS.asp191x1, '1.91:1 — Wide'],
      ],
      onChange: (v, prev) => {
        if (prev && prev !== v) {
          state.aspectOverrides[prev] = snapshotAspectFields();
        }
        const override = state.aspectOverrides[v];
        applyAspectFields(override || ASPECT_RATIO_DEFAULTS[v]);

        updateAspectLabel(v);
        syncControlsToState();
        updateOverlays();
        if (window._p5Resize) window._p5Resize();
        // Refresh the filtered preset list so only this aspect's
        // entries are visible.
        if (_refreshPresetList) _refreshPresetList();
      },
    }));

    // 2 + 3. Preset list and save row (handled by buildPresetsContent)
    ct.appendChild(mkSubLabel('Presets'));
    const presetsWrap = document.createElement('div');
    presetsWrap.className = 'section-presets';
    ct.appendChild(presetsWrap);
    _refreshPresetList = buildPresetsContent(presetsWrap, { syncControlsToState, updateOverlays });
  });

  // ── Color & Theme ─────────────────────────────────────────
  const fTheme = registerFolder(pane.addFolder({ title: 'Color & Theme', expanded: false }));
  into(fTheme, ct => {
    ct.classList.add('section-color-theme');
    // Theme label
    const themeLbl = document.createElement('div');
    themeLbl.className = 'theme-section-label';
    themeLbl.textContent = 'Theme';
    ct.appendChild(themeLbl);

    // 2 theme circles: warm (orange) + cool (blue)
    const circleRow = document.createElement('div');
    circleRow.className = 'theme-circle-row';
    [
      { key: 'warm', color: '#F66A24', label: 'Warm' },
      { key: 'cool', color: '#66A8FF', label: 'Cool' },
    ].forEach(({ key, color, label }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = label;
      btn.dataset.themeCircle = key;
      btn.className = 'theme-circle-btn' + (state.theme === key ? ' active' : '');
      btn.style.setProperty('--circle-color', color);
      btn.addEventListener('click', () => _applyTheme(key));
      circleRow.appendChild(btn);
    });
    ct.appendChild(circleRow);

    // Light / Dark mode segmented (no label — higher hierarchy)
    const modeRow = document.createElement('div'); modeRow.className = 'control-row mode-row-noLabel';
    const modeSeg = document.createElement('div'); modeSeg.className = 'segmented'; modeSeg.id = 'ct-mode-col';
    [['dark', 'Dark'], ['light', 'Light']].forEach(([val, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ct-mode-btn seg-btn' + (state.colorMode === val ? ' active' : '');
      btn.dataset.mode = val; btn.dataset.value = val; btn.textContent = label;
      btn.addEventListener('click', () => {
        if (state.colorMode === val) return;
        state.colorMode = val;
        modeSeg.querySelectorAll('.ct-mode-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.mode === val));
        const themePalKey = state.theme === 'warm'
          ? (val === 'dark' ? 'marketingWarm' : 'marketingWarmLight')
          : (val === 'dark' ? 'marketingCool' : 'arctic');
        if (PALETTES[themePalKey]) selectPalette(themePalKey);
        applyPalette(state.palette);
        // Swap the active BG GRADIENT to its same-theme counterpart for
        // the new mode (warm-dark → warm-light, cool-dark → cool-light).
        if (state.bgGradientMode && BG_GRADIENTS[themePalKey]) {
          const def = BG_GRADIENTS[themePalKey];
          state.bgGradientPreset = themePalKey;
          state.bgGradientStops  = JSON.parse(JSON.stringify(def.stops));
          state.bgGradientDir    = def.dir || 'vertical';
          // Reflect new active button
          const gradRow = document.getElementById('bg-grad-container');
          if (gradRow) {
            gradRow.querySelectorAll('.bg-grad-btn').forEach(b =>
              b.classList.toggle('active', b.dataset.key === themePalKey));
          }
        }
        const newPresets = getActiveBgPresets();
        if (newPresets.length) {
          state.bgColor = newPresets[0].color;
          const colorEl = document.getElementById('ctrl-bgcolor');
          if (colorEl) colorEl.value = state.bgColor;
          onBgChanged();
        }
        rebuildBgSwatches(); rebuildCtSwatches(); syncTheme(); redraw();
      });
      modeSeg.appendChild(btn);
    });
    modeRow.appendChild(modeSeg);
    ct.appendChild(modeRow);

    // Hidden palette row (required by syncPaletteSelect / syncTheme)
    const palRow = document.createElement('div');
    palRow.className = 'palette-row'; palRow.id = 'ctrl-palette'; palRow.style.display = 'none';
    Object.entries(PALETTES).forEach(([key, p]) => {
      if (!p.tone) return;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.dataset.value = key; btn.title = p.label;
      btn.className = 'palette-sw' + (state.palette === key ? ' active' : '');
      btn.style.display = (p.tone === state.theme) ? '' : 'none';
      const sw = document.createElement('span'); sw.className = 'palette-sw-fill';
      if (p.stops) {
        const css = p.stops.map(s => `${s.color} ${(s.stop * 100).toFixed(0)}%`).join(', ');
        sw.style.background = `linear-gradient(90deg, ${css})`;
      }
      const cap = document.createElement('span'); cap.className = 'palette-sw-label'; cap.textContent = p.label;
      btn.appendChild(sw); btn.appendChild(cap);
      btn.addEventListener('click', () => selectPalette(key));
      palRow.appendChild(btn);
    });
    ct.appendChild(palRow);

    // Shape gradient sub-label + gradient bar
    ct.appendChild(mkSubLabel('Shape Gradient'));
    buildGradientSection(ct);

    // Background
    ct.appendChild(mkSubLabel('Background'));
    ct.appendChild(mkSegmented({
      id: 'ctrl-bg-mode', label: '', key: 'bgGradientMode',
      options: [['solid', 'Solid'], ['gradient', 'Gradient']],
      onChange: v => {
        state.bgGradientMode = (v === 'gradient');
        const sg = document.getElementById('bg-solid-group');
        const gg = document.getElementById('bg-grad-group');
        if (sg) sg.style.display = state.bgGradientMode ? 'none' : '';
        if (gg) gg.style.display = state.bgGradientMode ? '' : 'none';
        onBgChanged(); redraw();
      },
    }));
    setTimeout(() => {
      const bgModeSeg = document.getElementById('ctrl-bg-mode');
      if (bgModeSeg) {
        const v = state.bgGradientMode ? 'gradient' : 'solid';
        bgModeSeg.querySelectorAll('.seg-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.value === v));
      }
    }, 0);

    // BG Solid group
    const bgSolidGroup = document.createElement('div');
    bgSolidGroup.id = 'bg-solid-group';
    bgSolidGroup.style.display = state.bgGradientMode ? 'none' : '';
    bgSolidGroup.appendChild(mkColor({
      id: 'ctrl-bgcolor', label: 'Background Colour', key: 'bgColor',
      onChange: () => { onBgChanged(); rebuildBgSwatches(); rebuildCtSwatches(); },
    }));
    const bgSwatchWrap = document.createElement('div'); bgSwatchWrap.className = 'control-row';
    const bgSwatchRow  = document.createElement('div'); bgSwatchRow.className = 'bg-swatch-row'; bgSwatchRow.id = 'bg-swatch-container';
    bgSwatchWrap.appendChild(bgSwatchRow);
    bgSolidGroup.appendChild(bgSwatchWrap);
    ct.appendChild(bgSolidGroup);

    // BG Gradient group
    const bgGradGroup = document.createElement('div');
    bgGradGroup.id = 'bg-grad-group';
    bgGradGroup.style.display = state.bgGradientMode ? '' : 'none';
    _buildBgGradPresets(bgGradGroup);
    ct.appendChild(bgGradGroup);

    // Hidden ct-swatch-container (required by rebuildCtSwatches)
    const ctSwatchHidden = document.createElement('div');
    ctSwatchHidden.id = 'ct-swatch-container';
    ctSwatchHidden.style.display = 'none';
    ct.appendChild(ctSwatchHidden);

    rebuildCtSwatches();
    rebuildBgSwatches();
  });

  // ── Composition ──────────────────────────────────────────
  const fBackground = registerFolder(pane.addFolder({ title: 'Background', expanded: false }));
  into(fBackground, ct => {
    ct.classList.add('section-background');

    const cards    = document.createElement('div'); cards.className = 'comp-cards';
    const cardRect = document.createElement('div');
    cardRect.className = 'comp-card' + (state.compositionType === 'rectangle' ? ' active' : '');
    cardRect.innerHTML = `<svg viewBox="0 0 24 24"><rect x="5" y="6" width="3" height="12" rx="1"/><rect x="10.5" y="3" width="3" height="15" rx="1"/><rect x="16" y="8" width="3" height="10" rx="1"/></svg><span>Rectangle</span>`;
    const cardCirc = document.createElement('div');
    cardCirc.className = 'comp-card' + (state.compositionType === 'circular' ? ' active' : '');
    cardCirc.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="6" cy="14" r="3.5"/><circle cx="12" cy="7" r="3.5"/><circle cx="18" cy="11" r="3.5"/></svg><span>Circular</span>`;
    const cardImg  = document.createElement('div');
    cardImg.className = 'comp-card' + (state.compositionType === 'image' ? ' active' : '');
    cardImg.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M3 16l4.5-4.5 3 3 3-4 4.5 5.5"/></svg><span>Image</span>`;
    cards.appendChild(cardRect); cards.appendChild(cardCirc); cards.appendChild(cardImg);
    ct.appendChild(cards);

    // Rectangle group
    const groupRect = document.createElement('div');
    groupRect.id = 'group-rect';
    groupRect.className = 'ctrl-group' + (state.compositionType === 'rectangle' ? ' active' : '');
    groupRect.appendChild(mkSlider({ id:'ctrl-count',    label:'Rectangle Count',   min:2,   max:120,  step:1,   key:'rectCount' }));
    groupRect.appendChild(mkSlider({ id:'ctrl-spacing',  label:'Item Spacing',      min:0,   max:30,   step:0.5, key:'spacing',   decimals:1 }));
    groupRect.appendChild(mkToggle({ id:'ctrl-symmetry', label:'Symmetry (size)',   key:'symmetry' }));
    groupRect.appendChild(mkToggle({ id:'ctrl-mirror-y', label:'Mirror Axis',       key:'mirrorY'  }));
    groupRect.appendChild(mkSegmented({ id:'ctrl-baseline', label:'Baseline Direction', key:'baseline',
      options:[
        ['bottom', ICONS.baseBottom, 'Bottom — grow upward'],
        ['top',    ICONS.baseTop,    'Top — grow downward'],
        ['left',   ICONS.baseLeft,   'Left — grow rightward'],
        ['right',  ICONS.baseRight,  'Right — grow leftward'],
      ],
    }));
    ct.appendChild(groupRect);

    // Circular group
    const groupCirc = document.createElement('div');
    groupCirc.id = 'group-circ';
    groupCirc.className = 'ctrl-group' + (state.compositionType === 'circular' ? ' active' : '');
    groupCirc.appendChild(mkSlider({ id:'ctrl-circle-count',        label:'Circle Count',                      min:2,    max:40,   step:1,  key:'circleCount' }));
    groupCirc.appendChild(mkSlider({ id:'ctrl-diameter',            label:'Max Diameter',                      min:50,   max:2000, step:10, key:'circleDiameter' }));
    groupCirc.appendChild(mkToggle({ id:'ctrl-circle-stagger-auto', label:'Auto Stagger',                       key:'circleStaggerAuto' }));
    groupCirc.appendChild(mkAnchorGrid({ id:'ctrl-circle-align',    label:'Anchor Position',                   key:'circleAlignment' }));
    groupCirc.appendChild(mkToggle({ id:'ctrl-circle-mirror',       label:'Mirror X & Y Axis',                 key:'circleMirrorXY' }));
    groupCirc.appendChild(mkToggle({ id:'ctrl-circle-flip-anchor',  label:'Flip Anchor',                       key:'circleFlipAnchor' }));
    groupCirc.appendChild(mkSubLabel('Text-Aware Positioning'));
    groupCirc.appendChild(mkToggle({
      id: 'ctrl-circle-text-link', label: 'Link X to Headline', key: 'circleTextLink',
      onChange: () => {
        const r = document.getElementById('ctrl-circle-text-padding')?.closest('.control-row');
        if (r) r.style.display = state.circleTextLink ? '' : 'none';
        redraw();
      },
    }));
    const textPadRow = mkSlider({ id:'ctrl-circle-text-padding', label:'Text Gap (extra px)', min:-200, max:400, step:10, key:'circleTextPadding' });
    textPadRow.style.display = state.circleTextLink ? '' : 'none';
    groupCirc.appendChild(textPadRow);
    groupCirc.appendChild(mkSubLabel('Fine Tune'));
    groupCirc.appendChild(mkSlider({ id:'ctrl-circle-sp-x', label:'X Offset', min:-1000, max:1000, step:1, key:'circleSpacingX' }));
    groupCirc.appendChild(mkSlider({ id:'ctrl-circle-sp-y', label:'Y Offset', min:-1000, max:1000, step:1, key:'circleSpacingY' }));
    ct.appendChild(groupCirc);

    // Image group — preset picker + opacity
    const groupImg = document.createElement('div');
    groupImg.id = 'group-img-comp';
    groupImg.className = 'ctrl-group' + (state.compositionType === 'image' ? ' active' : '');
    const imgPickerRow  = document.createElement('div'); imgPickerRow.className = 'control-row';
    const imgPickerLabel = document.createElement('label'); imgPickerLabel.textContent = 'Preset';
    const imgPickerWrap = document.createElement('div'); imgPickerWrap.className = 'img-preset-picker';
    [['dark', 'Background%20Presets/BG-Dark.png', 'Dark'], ['light', 'Background%20Presets/BG-Light.png', 'Light']].forEach(([key, src, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'img-preset-btn' + (state.imagePresetSelected === key ? ' active' : '');
      btn.title = label; btn.dataset.key = key;
      const thumb = document.createElement('img'); thumb.src = src; thumb.alt = label;
      btn.appendChild(thumb);
      btn.addEventListener('click', () => {
        state.imagePresetSelected = key;
        imgPickerWrap.querySelectorAll('.img-preset-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.key === key));
        if (window._p5Redraw) window._p5Redraw();
      });
      imgPickerWrap.appendChild(btn);
    });
    imgPickerRow.appendChild(imgPickerLabel); imgPickerRow.appendChild(imgPickerWrap);
    groupImg.appendChild(imgPickerRow);
    groupImg.appendChild(mkSlider({ id:'ctrl-img-preset-opacity', label:'Opacity', min:0, max:1, step:0.01, key:'imagePresetOpacity', decimals:2 }));
    ct.appendChild(groupImg);

    // Curve distribution (hidden for circular / image compositions)
    const curveWrap = document.createElement('div');
    curveWrap.id = 'curve-controls-wrap';
    curveWrap.style.display = (state.compositionType === 'circular' || state.compositionType === 'image') ? 'none' : '';
    curveWrap.appendChild(mkSlider({ id:'ctrl-extent', label:'Stagger/Growth Extent', min:0.05, max:1, step:0.01, key:'extent', decimals:2 }));

    const noiseSeedRow = mkSlider({ id:'ctrl-noise-seed', label:'Noise Seed', min:1, max:999, step:1, key:'noiseSeed', onChange: () => redraw() });
    noiseSeedRow.id = 'noise-seed-row';
    noiseSeedRow.style.display = state.curveType === 'noise' ? '' : 'none';

    const reseedRow = document.createElement('div');
    reseedRow.id = 'noise-reseed-row'; reseedRow.className = 'control-row no-label';
    reseedRow.style.display = state.curveType === 'noise' ? '' : 'none';
    const reseedBtn = document.createElement('button');
    reseedBtn.type = 'button';
    reseedBtn.className = 'grad-action-btn';
    reseedBtn.title = 'Generate a new noise seed';
    reseedBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 4h3l3 8h3"/><path d="M2 12h3l3-8h3"/>
        <path d="M11 2l3 2-3 2"/><path d="M11 10l3 2-3 2"/>
      </svg>
      <span>New Seed</span>`;
    reseedBtn.addEventListener('click', () => {
      state.noiseSeed = Math.floor(Math.random() * 999) + 1;
      const sl = document.getElementById('ctrl-noise-seed');
      if (sl) { sl.value = state.noiseSeed; const vv = sl.closest('.control-row')?.querySelector('.val'); if (vv) vv.textContent = state.noiseSeed; }
      redraw();
    });
    reseedRow.appendChild(reseedBtn);

    curveWrap.appendChild(mkSubLabel('Curve Distribution'));
    curveWrap.appendChild(mkSegmented({
      id: 'ctrl-curve', label: '', key: 'curveType', variant: 'grid grid-4',
      options: [
        ['flat',       curveThumbSvg('flat'),       'Flat'],
        ['linear',     curveThumbSvg('linear'),     'Linear'],
        ['quadratic',  curveThumbSvg('quadratic'),  'Quadratic'],
        ['cubic',      curveThumbSvg('cubic'),      'Cubic'],
        ['parabolic',  curveThumbSvg('parabolic'),  'Parabolic — Peak Center'],
        ['hyperbolic', curveThumbSvg('hyperbolic'), 'Hyperbolic'],
        ['bezier',     curveThumbSvg('bezier'),     'Bezier'],
        ['noise',      curveThumbSvg('noise'),      'Noise — Organic'],
      ],
      onChange: v => {
        const show = v === 'noise';
        noiseSeedRow.style.display = show ? '' : 'none';
        reseedRow.style.display    = show ? '' : 'none';
        redraw();
      },
    }));
    curveWrap.appendChild(noiseSeedRow);
    curveWrap.appendChild(reseedRow);
    curveWrap.appendChild(mkToggle({ id:'ctrl-flip-curve', label:'Flip Curve Shape', key:'flipCurve' }));

    // Curve preview — no label, just the canvas
    const cvWrap = document.createElement('div'); cvWrap.className = 'control-row no-label curve-preview-wrap';
    const cvCvs  = document.createElement('canvas'); cvCvs.id = 'curve-preview'; cvCvs.width = 280; cvCvs.height = 56;
    cvWrap.appendChild(cvCvs);
    curveWrap.appendChild(cvWrap);
    ct.appendChild(curveWrap);

    // Composition type switch handler
    const switchType = type => {
      state.compositionType = type;
      cardRect.classList.toggle('active', type === 'rectangle');
      cardCirc.classList.toggle('active', type === 'circular');
      cardImg.classList.toggle('active',  type === 'image');
      groupRect.classList.toggle('active', type === 'rectangle');
      groupCirc.classList.toggle('active', type === 'circular');
      groupImg.classList.toggle('active',  type === 'image');
      curveWrap.style.display = (type === 'circular' || type === 'image') ? 'none' : '';
      redraw();
    };
    cardRect.addEventListener('click', () => switchType('rectangle'));
    cardCirc.addEventListener('click', () => switchType('circular'));
    cardImg.addEventListener('click',  () => switchType('image'));

    // Background-wide blur control
    ct.appendChild(mkSlider({ id:'ctrl-blur', label:'Blur', min:0, max:20, step:0.5, key:'blur', decimals:1 }));

    // ── Effects (was the standalone 'Graphics' folder) ──────
    ct.appendChild(mkSubLabel('Global Opacity'));
    ct.appendChild(mkToggle({ id:'ctrl-global-op', label:'Blend as Group', key:'globalOpacity' }));
    ct.appendChild(mkSlider({ id:'ctrl-opacity', label:'Opacity', min:0, max:1, step:0.01, key:'opacity', decimals:2,
      onChange: () => { renderGradientBar(); redraw(); } }));

    ct.appendChild(mkSubLabel('Depth Shadow'));
    ct.appendChild(mkToggle({ id:'ctrl-depth-shadow', label:'Enabled',         key:'depthShadow' }));
    ct.appendChild(mkSlider({ id:'ctrl-ds-spread',    label:'Spread',          min:0.01, max:1, step:0.01, key:'dsSpread',  decimals:2 }));
    ct.appendChild(mkSlider({ id:'ctrl-ds-opacity',   label:'Opacity',         min:0,    max:1, step:0.01, key:'dsOpacity', decimals:2 }));

    ct.appendChild(mkSubLabel('Inner Shadow'));
    ct.appendChild(mkToggle({ id:'ctrl-inner-glow',    label:'Enabled',        key:'innerGlow' }));
    ct.appendChild(mkSlider({ id:'ctrl-glow-intensity',label:'Intensity',      min:0,    max:1, step:0.01, key:'innerGlowIntensity', decimals:2 }));
  });

  // ── Text Content (Headline + Footer) ──────────────────────
  const fHeadline = registerFolder(pane.addFolder({ title: 'Text Content', expanded: false }));
  into(fHeadline, ct => {
    ct.classList.add('section-text-content');

    // ── Header Text ───────────────────────────────────────
    ct.appendChild(mkSubLabel('Header Text', 0));
    ct.appendChild(mkTextarea({ id:'ctrl-hl-text',  label:'',                key:'headlineText',           rows:3, onChange: updateOverlays }));
    ct.appendChild(mkInput(   { id:'ctrl-hl-words', label:'Highlight Words', key:'headlineHighlightWords',         onChange: updateOverlays }));

    // ── Footer Text (sits right after Header Text so both text
    //   inputs are adjacent and editable together).
    ct.appendChild(mkSubLabel('Footer Text'));
    ct.appendChild(mkInput({ id:'ctrl-ft-byline', label:'', key:'footerByline', onChange: updateOverlays }));

    // ── Colour ────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Colour'));
    ct.appendChild(mkTextBaseControl('hl'));
    ct.appendChild(mkColor({ id:'ctrl-hl-hl-color', label:'Highlight', key:'headlineHighlightColor', onChange: updateOverlays }));

    // ── Fill ──────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Fill'));
    ct.appendChild(mkToggle({ id:'ctrl-hl-fill',     label:'Fill Behind Text', key:'headlineFillEnabled',
      onChange: () => { updateOverlays(); redraw(); } }));
    ct.appendChild(mkColor( { id:'ctrl-hl-fill-col', label:'Fill Colour',      key:'headlineFillColor', onChange: updateOverlays }));

    // ── Typography ────────────────────────────────────────
    ct.appendChild(mkSubLabel('Typography'));
    ct.appendChild(mkSegmented({ id:'ctrl-hl-align', label:'', key:'headlineAlign',
      options:[['left', ICONS.alignLeft, 'Left'],['center', ICONS.alignCenter, 'Center'],['right', ICONS.alignRight, 'Right']],
      onChange: updateOverlays }));
    ct.appendChild(mkSegmented({ id:'ctrl-hl-font',  label:'', key:'headlineFont',
      options:[['400','Regular'],['500','Medium'],['700','Bold']], onChange: updateOverlays }));
    ct.appendChild(mkSlider({ id:'ctrl-hl-fs', label:'Font Size',   min:10,  max:300, step:1,    key:'headlineFontSize',   decimals:0, onChange: updateOverlays }));
    ct.appendChild(mkSlider({ id:'ctrl-hl-lh', label:'Line Height', min:0.5, max:2.5, step:0.05, key:'headlineLineHeight', decimals:2, onChange: updateOverlays }));

    // ── Position ──────────────────────────────────────────
    ct.appendChild(mkSubLabel('Position'));
    ct.appendChild(mkSlider({ id:'ctrl-hl-y',   label:'Y Position',  min:0, max:1500, step:1, key:'headlineYPos',    decimals:0, onChange: updateOverlays }));
    ct.appendChild(mkSlider({ id:'ctrl-hl-pad', label:'L/R Padding', min:0, max:700,  step:1, key:'headlinePadding', decimals:0, onChange: updateOverlays }));

    // ── Footer Colour (single inline row — the only footer-styling
    //   control left after Typography was removed; no longer worth a
    //   group divider + sub-section).
    ct.appendChild(mkSubLabel('Footer Colour'));
    ct.appendChild(mkTextBaseControl('ft', { withOpacity: false }));
  });

  // ── Slides ────────────────────────────────────────────────
  const fImage = registerFolder(pane.addFolder({ title: 'Slides', expanded: false }));
  into(fImage, ct => {
    ct.classList.add('section-image');

    // ── Upload ────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Upload', 0));
    const uploadWrap = document.createElement('div'); uploadWrap.className = 'control-row no-label';
    const uploadBtn  = document.createElement('label');
    uploadBtn.className = 'img-upload-btn';
    uploadBtn.htmlFor   = 'ctrl-img-upload';
    uploadBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 13v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1"/>
        <path d="M5 5l3-3 3 3"/><path d="M8 2v9"/>
      </svg>
      <span>Choose Image</span>`;
    const fileInp = document.createElement('input');
    fileInp.type = 'file'; fileInp.id = 'ctrl-img-upload'; fileInp.accept = 'image/*';
    fileInp.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    fileInp.addEventListener('change', e => {
      if (!e.target.files.length) return;
      state.imageSrc = URL.createObjectURL(e.target.files[0]);
      updateOverlays();
    });
    uploadWrap.appendChild(fileInp);
    uploadWrap.appendChild(uploadBtn);
    ct.appendChild(uploadWrap);

    // ── Presets (style + image picker + shuffle) ──────────
    ct.appendChild(mkSubLabel('Presets'));
    buildImagePresetControls(ct);

    // ── Position ──────────────────────────────────────────
    ct.appendChild(mkSubLabel('Position'));
    ct.appendChild(mkSlider({ id:'ctrl-img-scale', label:'Scale',         min:0.1,   max:2,    step:0.01, key:'imageScale',   decimals:2, onChange: updateOverlays }));
    ct.appendChild(mkSlider({ id:'ctrl-img-y',     label:'Y-Axis Offset', min:-3000, max:3000, step:10,   key:'imageYOffset', decimals:0, onChange: updateOverlays }));

    // ── Stroke ────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Stroke'));
    ct.appendChild(mkSegmented({
      id: 'ctrl-img-stroke', label: '', key: 'imageStrokeStyle',
      options: [
        ['marketing', `<span class="stroke-sw marketing"></span><span class="seg-caption">Warm</span>`,  'Marketing Warm'],
        ['frosty',    `<span class="stroke-sw frosty"></span><span class="seg-caption">Frosty</span>`,   'Frosty Glass'],
      ],
      onChange: updateOverlays,
    }));
    ct.appendChild(mkSlider({ id:'ctrl-img-sw',  label:'Weight',  min:0, max:100, step:1,    key:'imageStrokeWeight', decimals:0, onChange: updateOverlays }));
    ct.appendChild(mkSlider({ id:'ctrl-img-sop', label:'Opacity', min:0, max:1,   step:0.01, key:'imageStrokeOp',     decimals:2, onChange: updateOverlays }));
    ct.appendChild(mkSlider({ id:'ctrl-img-rad', label:'Corner Radius', min:0, max:40, step:1, key:'imageRadius',     decimals:0, onChange: updateOverlays }));

    // ── Distribution ──────────────────────────────────────
    ct.appendChild(mkSubLabel('Distribution'));
    buildImageDistControls(ct);
  });

  // ── Translate ─────────────────────────────────────────────
  const fTranslate = registerFolder(pane.addFolder({ title: 'Translate', expanded: false }));
  into(fTranslate, ct => {
    ct.classList.add('section-translate');
    buildTranslateSection(ct);
  });

  // ── Accordion: only one folder open at a time ─────────────
  // Tweakpane v3 fires 'fold' events when expanded changes
  allFolders.forEach(folder => {
    folder.on('fold', ev => {
      // ev.expanded is true when this folder has just expanded
      if (!ev.expanded) return;
      allFolders.forEach(other => {
        if (other !== folder && other.expanded) other.expanded = false;
      });
    });
  });
}

// ── Init ──────────────────────────────────────────────────────
function _initGUI() {
  // Apply the correct layout defaults for the starting aspect ratio so
  // the GUI and canvas open with the right values (not the generic fallbacks).
  const initDefaults = ASPECT_RATIO_DEFAULTS[state.aspectRatio];
  if (initDefaults) Object.assign(state, initDefaults);

  buildGUI();

  // ── Boot with the first preset for the active aspect ──────
  // Falls back to the per-aspect defaults already applied above if
  // localStorage is empty for this ratio.
  if (applyDefaultPreset()) {
    syncControlsToState();
  }

  updateAspectLabel(state.aspectRatio);
  renderGradientBar();
  renderStopList();
  renderCurvePreview();
  autoAssignTextColor(); // sets smart default text colour for initial BG
  updateOverlays();
  syncTheme();

  // Clicking the image placeholder on the canvas opens the file picker
  const overlayImg = document.getElementById('overlay-image');
  if (overlayImg) {
    overlayImg.addEventListener('click', () => {
      const up = document.getElementById('ctrl-img-upload');
      if (up) up.click();
    });
  }

  // Inline-editable headline on the canvas, kept in sync with panel textarea
  const hlNode = document.getElementById('headline-text');
  if (hlNode) {
    hlNode.spellcheck = false;
    // contentEditable is set per-render in updateOverlays — only true when
    // previewLang === 'en'. We attach the listeners unconditionally; they
    // simply don't fire when the element isn't editable.

    // On focus: switch to plain-text mode so user edits raw text.
    // Never invoked in non-English preview because contentEditable is off.
    hlNode.addEventListener('focus', () => {
      hlNode.textContent = state.headlineText || '';
    });
    hlNode.addEventListener('input', () => {
      state.headlineText = hlNode.innerText;
      const ta = document.getElementById('ctrl-hl-text');
      if (ta) ta.value = state.headlineText;
    });
    hlNode.addEventListener('blur', () => {
      // Re-apply highlights on blur
      updateOverlays();
    });
  }

  // Export — delegates to sketch.js _exportCanvas
  document.getElementById('btn-export').addEventListener('click', () => {
    if (window._exportCanvas) window._exportCanvas();
  });

  // ── Make the floating panel draggable by its header ─────────
  const panel  = document.getElementById('panel');
  const header = document.getElementById('panel-header');
  if (panel && header) {
    let dragging = false, sx = 0, sy = 0, startLeft = 0, startTop = 0;
    header.addEventListener('pointerdown', e => {
      if (e.target.closest('button, input, select')) return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      startLeft = r.left; startTop = r.top;
      sx = e.clientX; sy = e.clientY;
      // Switch from right-anchored to left-anchored on first drag
      panel.style.left  = startLeft + 'px';
      panel.style.top   = startTop  + 'px';
      panel.style.right = 'auto';
      header.setPointerCapture(e.pointerId);
    });
    header.addEventListener('pointermove', e => {
      if (!dragging) return;
      const nx = Math.max(8, Math.min(window.innerWidth  - panel.offsetWidth  - 8, startLeft + (e.clientX - sx)));
      const ny = Math.max(8, Math.min(window.innerHeight - 60                    , startTop  + (e.clientY - sy)));
      panel.style.left = nx + 'px';
      panel.style.top  = ny + 'px';
    });
    header.addEventListener('pointerup',     () => { dragging = false; });
    header.addEventListener('pointercancel', () => { dragging = false; });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initGUI);
} else {
  _initGUI();
}
