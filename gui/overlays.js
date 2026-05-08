// ── gui/overlays.js ───────────────────────────────────────────
// DOM overlay sync: the live headline / image / footer overlays
// that sit on top of the p5 canvas, plus the helpers that adapt
// text colour to the background, swatch grids, theme picker
// plumbing, and the headline highlight HTML renderer.

import {
  state,
  PALETTES,
  BG_GRADIENTS,
  IMAGE_STYLES,
  applyPalette,
  hexToRgb,
  getColorLuma,
  getActiveBgPresets,
  getDisplayText,
  getLangDir,
  getStyleImages,
  parseHighlightWords,
  normalizeHighlightKey,
} from '../shared.js';
import {
  redraw,
  renderGradientBar,
  renderStopList,
  syncPaletteSelect,
  enforceSync,
  _setSliderFill,
} from './controls.js';

// ══════════════════════════════════════════════════════════════
// OVERLAY UPDATER
// ══════════════════════════════════════════════════════════════

// Compute rgba colour from base hex + opacity and apply to DOM + state.
export function applyTextAdaptation() {
  // Headline
  const hlBase = state.headlineTextBase || '#ffffff';
  const hlOp   = state.headlineTextOpacity ?? 1.0;
  const [hr, hg, hb] = hexToRgb(hlBase);
  state.headlineTextColor = `rgba(${hr},${hg},${hb},${hlOp})`;
  document.querySelectorAll('.headline-text').forEach(el => {
    el.style.color      = state.headlineTextColor;
    el.style.textShadow = 'none';
  });

  // Footer byline — opacity is fixed at 1, so the colour is just the base.
  state.footerTextColor = state.footerTextBase || '#ffffff';
  const bylineEl = document.getElementById('footer-byline');
  if (bylineEl) {
    bylineEl.style.color      = state.footerTextColor;
    bylineEl.style.textShadow = 'none';
  }
}

// Derives and sets text base colour automatically from the current BG state.
// Solid BG: luminance threshold. Gradient BG: white by default, dark when flipped.
//
// When the headline fill is enabled, the visible backdrop for the text is
// the fill rectangle — not the canvas BG — so changes to the canvas BG
// must NOT flip the headline text colour. Footer is unaffected by fill,
// so it still adapts to the canvas BG.
export function autoAssignTextColor() {
  let base;
  if (state.bgGradientMode) {
    base = state.bgGradientFlip ? '#050505' : '#ffffff';
  } else {
    base = getColorLuma(state.bgColor) > 140 ? '#050505' : '#ffffff';
  }
  if (!state.headlineFillEnabled) {
    state.headlineTextBase = base;
  }
  state.footerTextBase = base;
  applyTextAdaptation();
  syncTextBaseUI();
}

// Keeps the Dark/Light toggle buttons and opacity sliders in sync with state.
export function syncTextBaseUI() {
  ['hl', 'ft'].forEach(prefix => {
    const baseKey = prefix === 'hl' ? 'headlineTextBase' : 'footerTextBase';
    const opKey   = prefix === 'hl' ? 'headlineTextOpacity' : 'footerTextOpacity';
    const seg = document.getElementById(`ctrl-${prefix}-text-base`);
    if (seg) seg.querySelectorAll('.seg-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.value === state[baseKey]));
    const opEl = document.getElementById(`ctrl-${prefix}-text-op`);
    if (opEl) {
      opEl.value = state[opKey] ?? 1;
      _setSliderFill(opEl);
      const valEl = opEl.closest('.slider-row')?.querySelector('.val');
      if (valEl) valEl.textContent = Math.round((state[opKey] ?? 1) * 100) + '%';
    }
  });
}

// Called whenever BG colour or gradient mode/flip changes.
// Runs auto text-colour assignment and, in sync mode, updates stop 3 to match BG.
export function onBgChanged() {
  autoAssignTextColor();
  if (state.paletteMode === 'sync') {
    enforceSync();
    renderGradientBar();
    renderStopList();
    if (window._p5Redraw) window._p5Redraw();
  }
}

// Rebuild BG swatches whenever palette changes
export function rebuildBgSwatches() {
  const row = document.getElementById('bg-swatch-container');
  if (!row) return;
  row.innerHTML = '';
  getActiveBgPresets().forEach(preset => {
    const sw = document.createElement('button');
    sw.className = 'bg-swatch';
    sw.title     = preset.label;
    sw.style.background = preset.color;
    const luma = getColorLuma(preset.color);
    sw.style.border = luma > 180
      ? '1px solid rgba(0,0,0,0.2)'
      : '1px solid rgba(255,255,255,0.1)';
    sw.addEventListener('click', () => {
      state.bgColor = preset.color;
      const colorEl = document.getElementById('ctrl-bgcolor');
      if (colorEl) colorEl.value = preset.color;
      onBgChanged();
      redraw();
    });
    row.appendChild(sw);
  });
}

// Build / rebuild the image content inside #overlay-image.
// Always-on distribution path: count=1 renders a single slide; count>1
// distributes per state.imageDistMode ('horizontal' | 'vertical' | 'point').
export function updateImageDistribution() {
  const overlayImg = document.getElementById('overlay-image');
  if (!overlayImg) return;

  overlayImg.style.display = state.showImage ? 'flex' : 'none';

  const count = Math.max(1, Math.floor(state.imageMultiCount));
  const mode  = state.imageDistMode;
  const sx    = state.imageMultiSpacing  || 0;
  const sy    = state.imageMultiStaggerY || 0;

  // Build the slide order for `count` slots:
  //   • If the user has Shuffled, honour the shuffled order verbatim.
  //   • Otherwise centre the SELECTED slide (state.imageStyleIndex) at
  //     the middle slot. New slides added by bumping count fan out
  //     symmetrically around that anchor. Clicking a different gallery
  //     card simply re-centres around the new selection.
  const baseImgs   = IMAGE_STYLES[state.imageStyle] || [];
  const isShuffled = !!(state.imageStyleOrder && state.imageStyleOrder.length === baseImgs.length);
  let imgs;
  if (isShuffled || baseImgs.length === 0) {
    imgs = getStyleImages();
  } else {
    const n      = baseImgs.length;
    const center = Math.max(0, Math.min(n - 1, state.imageStyleIndex || 0));
    const mid    = Math.floor((count - 1) / 2);
    imgs = [];
    for (let p = 0; p < count; p++) {
      const offset = p - mid;
      const idx    = ((center + offset) % n + n) % n;
      imgs.push(baseImgs[idx]);
    }
  }

  // The outer wrapper is just a positioning shell — each .img-instance
  // built by buildInnerPlaceholder carries its own border / shadow / fill.
  overlayImg.innerHTML          = '';
  overlayImg.style.overflow     = 'visible';
  overlayImg.style.background   = 'transparent';
  overlayImg.style.borderColor  = 'transparent';
  overlayImg.style.borderStyle  = 'none';
  overlayImg.style.boxShadow    = 'none';
  overlayImg.style.position     = 'absolute';
  overlayImg.style.left         = '50%';
  overlayImg.style.transform    = `translateX(-50%) translateY(calc(${state.imageYOffset}px * var(--scale))) scale(${state.imageScale})`;

  if (mode === 'horizontal') {
    overlayImg.style.flexDirection   = 'row';
    overlayImg.style.gap             = `calc(${sx}px * var(--scale))`;
    overlayImg.style.alignItems      = 'center';
    overlayImg.style.justifyContent  = 'center';
    const yMid = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const node = buildInnerPlaceholder(imgs[i % imgs.length] || '');
      node.style.flexShrink = '0';
      const yOff = (i - yMid) * sy;
      if (yOff) node.style.transform = `translateY(calc(${yOff}px * var(--scale)))`;
      overlayImg.appendChild(node);
    }
  } else if (mode === 'vertical') {
    overlayImg.style.flexDirection   = 'column';
    overlayImg.style.gap             = `calc(${Math.abs(sy)}px * var(--scale))`;
    overlayImg.style.alignItems      = 'center';
    overlayImg.style.justifyContent  = 'center';
    const xMid = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const node = buildInnerPlaceholder(imgs[i % imgs.length] || '');
      node.style.flexShrink = '0';
      const xOff = (i - xMid) * sx;
      if (xOff) node.style.transform = `translateX(calc(${xOff}px * var(--scale)))`;
      overlayImg.appendChild(node);
    }
  } else {
    // Point / stagger — overlapping cascade
    overlayImg.style.flexDirection = 'row';
    overlayImg.style.gap           = '0';
    for (let i = 0; i < count; i++) {
      const node = buildInnerPlaceholder(imgs[i % imgs.length] || '');
      const xOff = i * sx;
      const yOff = i * sy;
      node.style.position  = 'absolute';
      node.style.transform = `translate(calc(${xOff}px * var(--scale)), calc(${yOff}px * var(--scale)))`;
      node.style.zIndex    = String(count - i);
      overlayImg.appendChild(node);
    }
  }
}

export function buildInnerPlaceholder(src) {
  const op = state.imageStrokeOp;
  const r  = Math.min(40, Math.max(0, state.imageRadius));
  let strokeColor = `rgba(104,58,39,${op})`;
  if (state.imageStrokeStyle === 'frosty') strokeColor = `rgba(220,235,255,${op})`;

  const wrap = document.createElement('div');
  wrap.className = 'img-instance';
  wrap.style.cssText = `
    width: calc(1662.28px * var(--scale));
    height: calc(954.46px * var(--scale));
    background: #171717;
    border-radius: calc(${r}px * var(--scale));
    border: calc(${state.imageStrokeWeight}px * var(--scale)) solid ${strokeColor};
    box-shadow:
      0 calc(8px * var(--scale)) calc(12px * var(--scale)) calc(6px * var(--scale)) rgba(0,0,0,0.3),
      0 calc(4px * var(--scale)) calc(4px * var(--scale)) 0 rgba(0,0,0,0.5);
    display: flex; justify-content: center; align-items: center;
    overflow: hidden; position: relative; flex-shrink: 0;
  `;
  if (state.imageStrokeStyle === 'frosty' && op > 0) {
    wrap.style.backdropFilter = 'blur(4px)';
  }

  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;';
    wrap.appendChild(img);
  } else {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.style.cssText = `width:calc(80px * var(--scale));height:calc(80px * var(--scale));color:rgba(255,255,255,0.1);`;
    svg.innerHTML = `<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>`;
    wrap.appendChild(svg);
  }
  return wrap;
}

// Build innerHTML for headline: wrap highlight words in .headline-hl spans.
// Only called when the headline element is NOT focused (to avoid caret disruption).
function _renderHeadlineHTML() {
  const display = getDisplayText();
  const hlWords = parseHighlightWords(display.headlineHighlightWords);
  if (hlWords.size === 0) return null; // signal: use textContent instead

  const hlColor = state.headlineHighlightColor || '#f66a24';
  // Process each line, wrapping whole-word matches in spans
  const lines = display.headlineText.split('\n');
  const htmlLines = lines.map(line => {
    // Split on word boundaries but preserve spaces
    return line.replace(/(\S+)/g, (word) => {
      if (hlWords.has(normalizeHighlightKey(word))) {
        return `<span class="headline-hl" style="color:${hlColor}">${word}</span>`;
      }
      return word;
    });
  });
  return htmlLines.join('<br>');
}

export function updateOverlays() {
  const headEl      = document.getElementById('headline-text');
  const overlayHead = document.getElementById('overlay-headline');
  const overlayFoot = document.getElementById('overlay-footer');
  const byline      = document.getElementById('footer-byline');

  if (headEl && overlayHead) {
    const display = getDisplayText();
    // Don't stomp the caret while the user is editing in-place
    if (document.activeElement !== headEl) {
      const html = _renderHeadlineHTML();
      if (html !== null) {
        headEl.innerHTML = html;
      } else {
        headEl.textContent = display.headlineText;
      }
    }
    // RTL when previewing a right-to-left language; clear otherwise.
    headEl.dir       = getLangDir(display.lang);
    overlayHead.dir  = getLangDir(display.lang);
    // Edits only apply to English. In a translated preview, the canvas is
    // read-only — clicking the headline does nothing until the user
    // switches preview back to English.
    headEl.contentEditable = display.lang === 'en' ? 'true' : 'false';

    overlayHead.style.textAlign    = state.headlineAlign;
    overlayHead.style.display      = state.showHeadline ? 'flex' : 'none';
    overlayHead.style.paddingLeft  = `calc(${state.headlinePadding}px * var(--scale))`;
    overlayHead.style.paddingRight = `calc(${state.headlinePadding}px * var(--scale))`;

    // Fill mode: box anchored to canvas top with internal top/bottom padding.
    // 112 Figma-px → 214 design-units; 105 Figma-px → 201 design-units.
    if (state.headlineFillEnabled) {
      // Opaque fill box behind the text. Padding is per-aspect (dynamic).
      const [fr, fg, fb] = hexToRgb(state.headlineFillColor || '#000000');
      const padTop = state.headlineFillPaddingTop    ?? 214;
      const padBot = state.headlineFillPaddingBottom ?? 201;
      overlayHead.style.top           = '0';
      overlayHead.style.paddingTop    = `calc(${padTop}px * var(--scale))`;
      overlayHead.style.paddingBottom = `calc(${padBot}px * var(--scale))`;
      overlayHead.style.background    = `rgb(${fr},${fg},${fb})`;
    } else {
      overlayHead.style.top           = `calc(${state.headlineYPos}px * var(--scale))`;
      overlayHead.style.paddingTop    = '0';
      overlayHead.style.paddingBottom = '0';
      overlayHead.style.background    = 'transparent';
    }

    headEl.style.letterSpacing = `calc(${state.headlineTracking}px * var(--scale))`;
    headEl.style.lineHeight    = state.headlineLineHeight;
    headEl.style.fontSize      = `calc(${state.headlineFontSize}px * var(--scale))`;
    headEl.style.fontWeight    = state.headlineFont;
    headEl.style.width         = '100%';
  }

  updateImageDistribution();

  if (overlayFoot && byline) {
    const display = getDisplayText();
    byline.textContent            = display.footerByline;
    byline.style.textAlign        = 'left';
    byline.style.letterSpacing    = `calc(${state.footerTracking}px * var(--scale))`;
    byline.style.fontWeight       = '500';
    byline.dir                    = getLangDir(display.lang);
    overlayFoot.style.display     = state.showFooter ? 'flex' : 'none';
  }

  applyTextAdaptation();
  redraw();
}

// ══════════════════════════════════════════════════════════════
// THEME SYNC — filters palette + BG controls to active theme
// ══════════════════════════════════════════════════════════════
export function syncTheme() {
  // Theme toggle active state
  const themeSeg = document.getElementById('ctrl-theme');
  if (themeSeg) {
    themeSeg.querySelectorAll('.seg-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.value === state.theme));
  }

  // Show only palettes that match the active theme (hide 'custom' and cross-theme)
  const palRow = document.getElementById('ctrl-palette');
  if (palRow) {
    palRow.querySelectorAll('.palette-sw').forEach(btn => {
      const key  = btn.dataset.value;
      const tone = PALETTES[key]?.tone;
      btn.style.display = (tone && tone === state.theme) ? '' : 'none';
    });
  }

  // Rebuild solid BG swatches for the new theme + colorMode
  rebuildBgSwatches();
  rebuildCtSwatches();

  // Sync colorMode buttons
  const modeCol = document.getElementById('ct-mode-col');
  if (modeCol) {
    modeCol.querySelectorAll('.ct-mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === (state.colorMode || 'dark')));
  }

  // Show every BG gradient preset for the active theme — both Dark and
  // Light variants are always available regardless of the colour-mode
  // toggle (which controls the SOLID swatch palette).
  const gradRow = document.getElementById('bg-grad-container');
  if (gradRow) {
    gradRow.querySelectorAll('.bg-grad-btn').forEach(btn => {
      const key = btn.dataset.key;
      if (key === 'none') return; // always visible
      const def = BG_GRADIENTS[key];
      if (!def) { btn.style.display = ''; return; }
      const themeOk = !def.theme || def.theme === state.theme;
      btn.style.display = themeOk ? '' : 'none';
    });
  }

  // Sync theme circle borders (supports both class-based and inline-style approaches)
  document.querySelectorAll('[data-theme-circle]').forEach(b => {
    const isActive = b.dataset.themeCircle === state.theme;
    b.classList.toggle('active', isActive);
    b.style.borderColor = isActive ? '#fff' : 'transparent';
  });
}

// ══════════════════════════════════════════════════════════════
// PALETTE SELECTION — module-scope so both sections can use it
// ══════════════════════════════════════════════════════════════
export function selectPalette(key) {
  state.palette = key;
  if (key !== 'custom') applyPalette(key);
  state.imageStrokeStyle = (state.theme === 'cool') ? 'frosty' : 'marketing';
  const palRow = document.getElementById('ctrl-palette');
  if (palRow) palRow.querySelectorAll('.palette-sw').forEach(s => s.classList.toggle('active', s.dataset.value === key));
  rebuildBgSwatches();
  rebuildCtSwatches();
  updateOverlays();
  renderStopList();
}

// ══════════════════════════════════════════════════════════════
// Color & Theme swatch grid (mirrors the BG presets but styled as
// chips for the Color & Theme section).
// ══════════════════════════════════════════════════════════════
export function rebuildCtSwatches() {
  const container = document.getElementById('ct-swatch-container');
  if (!container) return;
  container.innerHTML = '';
  getActiveBgPresets().forEach(preset => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ct-swatch-btn' + (preset.color.toLowerCase() === state.bgColor.toLowerCase() ? ' active' : '');
    btn.title = preset.label;
    btn.style.background = preset.color;
    const luma = getColorLuma(preset.color);
    btn.style.boxShadow = luma > 220
      ? '0 0 0 1px rgba(0,0,0,0.15)'
      : '0 0 0 1px rgba(255,255,255,0.08)';
    btn.addEventListener('click', () => {
      state.bgColor = preset.color;
      const colorEl = document.getElementById('ctrl-bgcolor');
      if (colorEl) colorEl.value = preset.color;
      // Mark active
      container.querySelectorAll('.ct-swatch-btn').forEach(b =>
        b.classList.toggle('active', b.style.background === preset.color || b === btn));
      onBgChanged();
      redraw();
    });
    container.appendChild(btn);
  });
}

// ══════════════════════════════════════════════════════════════
// TEXT BASE CONTROL — Dark/Light toggle + (optional) opacity slider
// ══════════════════════════════════════════════════════════════
// prefix: 'hl' (headline) | 'ft' (footer)
// opts.withOpacity: include the opacity slider (default true)
export function mkTextBaseControl(prefix, { withOpacity = true } = {}) {
  const baseKey = prefix === 'hl' ? 'headlineTextBase'    : 'footerTextBase';
  const opKey   = prefix === 'hl' ? 'headlineTextOpacity' : 'footerTextOpacity';

  const wrap = document.createElement('div'); wrap.className = 'text-base-ctrl';

  // Dark / Light toggle
  const togRow = document.createElement('div'); togRow.className = 'control-row';
  const togLbl = document.createElement('label'); togLbl.textContent = 'Text Colour';
  togRow.appendChild(togLbl);
  const seg = document.createElement('div'); seg.className = 'segmented'; seg.id = `ctrl-${prefix}-text-base`;
  [['#050505', 'Dark'], ['#ffffff', 'Light']].forEach(([value, label]) => {
    const btn = document.createElement('button'); btn.type = 'button';
    btn.className = 'seg-btn' + (state[baseKey] === value ? ' active' : '');
    btn.dataset.value = value; btn.textContent = label;
    btn.addEventListener('click', () => {
      state[baseKey] = value;
      seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value));
      applyTextAdaptation();
      updateOverlays();
    });
    seg.appendChild(btn);
  });
  togRow.appendChild(seg); wrap.appendChild(togRow);

  if (!withOpacity) return wrap;

  // Opacity slider
  const opRow = document.createElement('div'); opRow.className = 'control-row slider-row';
  const opLbl = document.createElement('span'); opLbl.className = 'ctrl-label';
  opLbl.textContent = 'Opacity';
  const opVal = document.createElement('span'); opVal.className = 'val';
  opVal.textContent = Math.round((state[opKey] ?? 1) * 100) + '%';
  const opSlider = document.createElement('input');
  opSlider.type = 'range'; opSlider.id = `ctrl-${prefix}-text-op`;
  opSlider.min = '0'; opSlider.max = '1'; opSlider.step = '0.01';
  opSlider.value = state[opKey] ?? 1;
  opSlider.addEventListener('input', () => {
    state[opKey] = parseFloat(opSlider.value);
    opVal.textContent = Math.round(state[opKey] * 100) + '%';
    _setSliderFill(opSlider);
    applyTextAdaptation();
    updateOverlays();
  });
  opRow.appendChild(opLbl); opRow.appendChild(opVal); opRow.appendChild(opSlider);
  requestAnimationFrame(() => _setSliderFill(opSlider));
  wrap.appendChild(opRow);
  return wrap;
}
