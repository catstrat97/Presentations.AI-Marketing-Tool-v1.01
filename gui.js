// ── gui.js ────────────────────────────────────────────────────
// Vanilla JS control panel.
// Depends on: shared.js

// ── Redraw trigger ────────────────────────────────────────────
function redraw() {
  if (window._p5Redraw) window._p5Redraw();
  renderGradientBar();
  renderCurvePreview();
}

// ══════════════════════════════════════════════════════════════
// OVERLAY UPDATER
// ══════════════════════════════════════════════════════════════

// Compute rgba colour from base hex + opacity and apply to DOM + state.
function applyTextAdaptation() {
  // Headline
  const hlBase = state.headlineTextBase || '#ffffff';
  const hlOp   = state.headlineTextOpacity ?? 1.0;
  const [hr, hg, hb] = hexToRgb(hlBase);
  state.headlineTextColor = `rgba(${hr},${hg},${hb},${hlOp})`;
  document.querySelectorAll('.headline-text').forEach(el => {
    el.style.color      = state.headlineTextColor;
    el.style.textShadow = 'none';
  });

  // Footer byline
  const ftBase = state.footerTextBase || '#ffffff';
  const ftOp   = state.footerTextOpacity ?? 1.0;
  const [fr, fg, fb] = hexToRgb(ftBase);
  state.footerTextColor = `rgba(${fr},${fg},${fb},${ftOp})`;
  const bylineEl = document.getElementById('footer-byline');
  if (bylineEl) {
    bylineEl.style.color      = state.footerTextColor;
    bylineEl.style.textShadow = 'none';
  }
}

// Derives and sets text base colour automatically from the current BG state.
// Solid BG: luminance threshold. Gradient BG: white by default, dark when flipped.
function autoAssignTextColor() {
  let base;
  if (state.bgGradientMode) {
    base = state.bgGradientFlip ? '#050505' : '#ffffff';
  } else {
    base = getColorLuma(state.bgColor) > 140 ? '#050505' : '#ffffff';
  }
  state.headlineTextBase = base;
  state.footerTextBase   = base;
  applyTextAdaptation();
  syncTextBaseUI();
}

// Keeps the Dark/Light toggle buttons and opacity sliders in sync with state.
function syncTextBaseUI() {
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
function onBgChanged() {
  autoAssignTextColor();
  if (state.paletteMode === 'sync') {
    enforceSync();
    renderGradientBar();
    renderStopList();
    if (window._p5Redraw) window._p5Redraw();
  }
}

// Rebuild BG swatches whenever palette changes
function rebuildBgSwatches() {
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

// Build / rebuild the image content inside #overlay-image
function updateImageDistribution() {
  const overlayImg = document.getElementById('overlay-image');
  if (!overlayImg) return;

  // Base styles always needed
  overlayImg.style.display = state.showImage ? 'flex' : 'none';

  if (!state.imageMulti) {
    // ── Single mode ───────────────────────────────────────────
    // Restore original CSS-driven layout (single instance)
    overlayImg.innerHTML = '';
    overlayImg.style.position        = 'absolute';
    overlayImg.style.left            = '50%';
    overlayImg.style.overflow        = 'hidden';
    overlayImg.style.background      = '#171717';
    overlayImg.style.flexDirection   = 'row';
    overlayImg.style.gap             = '0';
    overlayImg.style.boxShadow       = '';
    overlayImg.style.transform       = `translateX(-50%) translateY(calc(${state.imageYOffset}px * var(--scale))) scale(${state.imageScale})`;

    // Re-apply stroke from state
    const op = state.imageStrokeOp;
    let strokeColor = `rgba(104,58,39,${op})`;
    if (state.imageStrokeStyle === 'frosty') {
      strokeColor = `rgba(220,235,255,${op})`;
      overlayImg.style.backdropFilter = op > 0 ? 'blur(4px)' : 'none';
    } else {
      overlayImg.style.backdropFilter = 'none';
    }
    overlayImg.style.borderColor  = strokeColor;
    overlayImg.style.borderStyle  = 'solid';
    overlayImg.style.borderWidth  = `calc(${state.imageStrokeWeight}px * var(--scale))`;
    overlayImg.style.borderRadius = `calc(${Math.min(40,Math.max(0,state.imageRadius))}px * var(--scale))`;

    // Rebuild inner
    overlayImg.appendChild(buildInnerPlaceholder(state.imageSrc));
    return;
  }

  // ── Multi mode ────────────────────────────────────────────
  const count = Math.max(1, Math.floor(state.imageMultiCount));
  const imgs  = getStyleImages();
  const mode  = state.imageDistMode;

  overlayImg.innerHTML     = '';
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
    overlayImg.style.gap             = `calc(${state.imageMultiSpacing}px * var(--scale))`;
    overlayImg.style.alignItems      = 'center';
    overlayImg.style.justifyContent  = 'center';
    for (let i = 0; i < count; i++) {
      const node = buildInnerPlaceholder(imgs[i % imgs.length] || '');
      node.style.flexShrink = '0';
      overlayImg.appendChild(node);
    }
  } else {
    // Point / stagger
    overlayImg.style.flexDirection = 'row';
    overlayImg.style.gap           = '0';
    for (let i = 0; i < count; i++) {
      const node   = buildInnerPlaceholder(imgs[i % imgs.length] || '');
      const offset = i * state.imageMultiSpacing;
      node.style.position  = 'absolute';
      node.style.transform = `translate(calc(${offset}px * var(--scale)), calc(${offset}px * var(--scale)))`;
      node.style.zIndex    = String(count - i);
      overlayImg.appendChild(node);
    }
  }
}

function buildInnerPlaceholder(src) {
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

function updateOverlays() {
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
    byline.style.textAlign        = state.footerAlign;
    byline.style.letterSpacing    = `calc(${state.footerTracking}px * var(--scale))`;
    byline.style.fontWeight       = state.footerFont;
    byline.dir                    = getLangDir(display.lang);
    overlayFoot.style.display     = state.showFooter ? 'flex' : 'none';
  }

  applyTextAdaptation();
  redraw();
}

// ══════════════════════════════════════════════════════════════
// GRADIENT BAR
// ══════════════════════════════════════════════════════════════
function renderGradientBar() {
  const bar = document.getElementById('grad-bar');
  if (!bar) return;
  const ctx = bar.getContext('2d');
  const W = bar.width, H = bar.height;
  ctx.clearRect(0, 0, W, H);

  const sq = 8;
  for (let y = 0; y < H; y += sq)
    for (let x = 0; x < W; x += sq) {
      ctx.fillStyle = ((x/sq + y/sq) % 2 === 0) ? '#2a2a30' : '#1a1a20';
      ctx.fillRect(x, y, sq, sq);
    }

  if (state.gradientStops.length) {
    const sorted = [...state.gradientStops].sort((a,b) => a.stop - b.stop);
    const grad   = ctx.createLinearGradient(0, 0, W, 0);
    sorted.forEach(s => {
      const [r,g,b] = hexToRgb(s.color);
      grad.addColorStop(s.stop, `rgba(${r},${g},${b},${state.opacity})`);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(0.5, 0.5, W-1, H-1);

  const markers = document.getElementById('grad-markers');
  if (markers) {
    markers.innerHTML = '';
    const sorted = [...state.gradientStops].sort((a,b) => a.stop - b.stop);
    sorted.forEach(s => {
      const dot = document.createElement('div');
      dot.className = 'grad-stop-dot';
      dot.style.left = `${s.stop * 100}%`;
      dot.style.background = s.color;
      dot.title = 'Click to recolor';
      dot.dataset.stopRef = String(state.gradientStops.indexOf(s));

      // Hidden color input — click the dot to recolor
      const colorInp = document.createElement('input');
      colorInp.type = 'color';
      colorInp.value = s.color;
      colorInp.className = 'grad-stop-color-hidden';
      dot.appendChild(colorInp);

      colorInp.addEventListener('input', () => {
        const idx = +dot.dataset.stopRef;
        if (idx < 0 || idx >= state.gradientStops.length) return;
        state.gradientStops[idx].color = colorInp.value;
        const mode = state.paletteMode || 'normal';
        if (mode === 'symmetrical') enforceSymmetrical();
        else if (mode === 'sync')   enforceSync();
        renderGradientBar();
        if (window._p5Redraw) window._p5Redraw();
      });

      dot.addEventListener('click', () => colorInp.click());

      markers.appendChild(dot);
    });
  }
}

// ══════════════════════════════════════════════════════════════
// PALETTE MODE ENFORCEMENT
// ══════════════════════════════════════════════════════════════

// Symmetrical: 5 stops, stop positions [0, p, 0.5, 1-p, 1],
// stop 4 colour = stop 2, stop 5 colour = stop 1.
function enforceSymmetrical() {
  const s = state.gradientStops;
  while (s.length < 5) s.push({ stop: 0.5, color: s[0]?.color || '#888888' });
  s.sort((a, b) => a.stop - b.stop);
  while (s.length > 5) s.pop();
  s[0].stop = 0;
  s[1].stop = Math.max(0.05, Math.min(0.49, parseFloat(s[1].stop.toFixed(2))));
  s[2].stop = 0.5;
  s[3].stop = parseFloat((1 - s[1].stop).toFixed(2));
  s[4].stop = 1.0;
  s[3].color = s[1].color;
  s[4].color = s[0].color;
}

// Sync: 3 stops, stop 3 position always 1.0, colour always tracks bgColor.
function enforceSync() {
  const s = state.gradientStops;
  while (s.length < 3) s.push({ stop: s.length / 2, color: '#888888' });
  s.sort((a, b) => a.stop - b.stop);
  while (s.length > 3) s.pop();
  s[0].stop = 0;
  s[1].stop = Math.max(0.1, Math.min(0.89, parseFloat(s[1].stop.toFixed(2))));
  s[2].stop = 1.0;
  s[2].color = state.bgColor; // always tracks BG
}

// Shuffle editable stops from the active palette, maintaining light→dark ordering.
function shuffleGradient() {
  const palette = PALETTES[state.palette];
  const raw = palette?.stops
    ? [...palette.stops].sort((a, b) => getColorLuma(b.color) - getColorLuma(a.color))
    : [];
  if (!raw.length) return;
  const colors = raw.map(s => s.color);
  const n = colors.length;

  if (state.paletteMode === 'symmetrical') {
    const band = Math.max(1, Math.floor(n / 3));
    const i0 = Math.floor(Math.random() * band);
    const i1 = band + Math.floor(Math.random() * band);
    const i2 = Math.min(n - 1, 2 * band + Math.floor(Math.random() * band));
    const rev = Math.random() > 0.5; // light-dark-light or dark-light-dark
    state.gradientStops[0].color = rev ? colors[i2] : colors[i0];
    state.gradientStops[1].color = colors[i1];
    state.gradientStops[2].color = rev ? colors[i0] : colors[i2];
    enforceSymmetrical();
  } else if (state.paletteMode === 'sync') {
    const half = Math.max(1, Math.floor(n / 2));
    const i0 = Math.floor(Math.random() * half);
    const i1 = half + Math.floor(Math.random() * Math.max(1, n - half));
    state.gradientStops[0].color = colors[i0];       // lighter
    state.gradientStops[1].color = colors[Math.min(n - 1, i1)]; // darker
    enforceSync();
  } else {
    // Normal mode — give each stop a fresh random colour from the palette,
    // preserving existing stop positions
    state.gradientStops.forEach(s => {
      s.color = colors[Math.floor(Math.random() * n)];
    });
    state.palette = state.palette; // keep palette ref intact (no 'custom' switch — colours still come from it)
  }

  renderGradientBar();
  renderStopList();
  redraw();
}

// ══════════════════════════════════════════════════════════════
// STOP LIST
// ══════════════════════════════════════════════════════════════
function renderStopList() {
  const list = document.getElementById('grad-stops-list');
  if (!list) return;
  list.innerHTML = '';

  const mode = state.paletteMode || 'normal';

  // Enforce constraints before rendering
  if (mode === 'symmetrical') enforceSymmetrical();
  else if (mode === 'sync')   enforceSync();

  const sorted = [...state.gradientStops].sort((a, b) => a.stop - b.stop);

  const stopLabels = {
    symmetrical: ['Anchor', 'Mid', 'Centre', 'Mid ·auto', 'Anchor ·auto'],
    sync:        ['Stop 1', 'Stop 2', 'BG Sync ·auto'],
  };

  sorted.forEach((stop, displayIdx) => {
    const isLocked =
      (mode === 'symmetrical' && displayIdx >= 3) ||
      (mode === 'sync'        && displayIdx === 2);

    const row = document.createElement('div');
    row.className = 'stop-row' + (isLocked ? ' stop-locked' : '');

    // Label (non-normal modes only)
    if (mode !== 'normal' && stopLabels[mode]?.[displayIdx]) {
      const lbl = document.createElement('span');
      lbl.className = 'stop-label';
      lbl.textContent = stopLabels[mode][displayIdx];
      row.appendChild(lbl);
    }

    // Colour picker
    const colorInput = document.createElement('input');
    colorInput.type      = 'color';
    colorInput.value     = stop.color;
    colorInput.className = 'stop-color-input';
    colorInput.title     = isLocked ? 'Auto-synced' : 'Pick colour';
    colorInput.disabled  = isLocked;

    if (!isLocked) {
      colorInput.addEventListener('input', () => {
        const idx = state.gradientStops.findIndex(s => s === stop);
        if (idx >= 0) { state.gradientStops[idx].color = colorInput.value; stop.color = colorInput.value; }
        if (mode === 'symmetrical') enforceSymmetrical();
        else if (mode === 'sync')   enforceSync();
        if (window._p5Redraw) window._p5Redraw();
        renderGradientBar();
        if (mode !== 'normal') renderStopList(); // refresh locked mirrors
      });
      colorInput.addEventListener('change', () => { if (mode !== 'normal') renderStopList(); });
    }
    row.appendChild(colorInput);

    if (!isLocked) {
      // Position slider
      // In symmetrical mode stops 0 and 2 are fixed; only stop 1 moves (and 3 mirrors it)
      const posFixed = mode === 'symmetrical' && (displayIdx === 0 || displayIdx === 2);
      const posWrap  = document.createElement('div'); posWrap.className = 'stop-pos-wrap';
      const posSlider = document.createElement('input');
      posSlider.type = 'range'; posSlider.min = '0'; posSlider.max = '1';
      posSlider.step = '0.01'; posSlider.value = stop.stop;
      posSlider.className = 'stop-pos-slider';
      posSlider.disabled  = posFixed;

      const posVal = document.createElement('span');
      posVal.className = 'stop-pos-val';
      posVal.textContent = stop.stop.toFixed(2);

      posSlider.addEventListener('input', () => {
        const idx = state.gradientStops.findIndex(s => s === stop);
        if (idx >= 0) state.gradientStops[idx].stop = parseFloat(posSlider.value);
        posVal.textContent = parseFloat(posSlider.value).toFixed(2);
        if (mode === 'symmetrical') enforceSymmetrical();
        else if (mode === 'sync')   enforceSync();
        redraw();
      });
      posSlider.addEventListener('change', () => renderStopList());
      posWrap.appendChild(posSlider); posWrap.appendChild(posVal);
      row.appendChild(posWrap);

      // Delete — normal mode only
      if (mode === 'normal') {
        const del = document.createElement('button');
        del.className = 'stop-delete'; del.title = 'Remove stop';
        del.disabled  = state.gradientStops.length <= 2;
        del.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
        del.addEventListener('click', () => {
          const idx = state.gradientStops.findIndex(s => s === stop);
          if (idx >= 0 && state.gradientStops.length > 2) {
            state.gradientStops.splice(idx, 1);
            state.palette = 'custom'; syncPaletteSelect();
            redraw(); renderStopList();
          }
        });
        row.appendChild(del);
      }
    } else {
      // Locked row: lock icon instead of controls
      const lockIcon = document.createElement('span');
      lockIcon.className = 'stop-lock-icon';
      lockIcon.innerHTML = `<svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><rect x="2" y="5" width="6" height="7" rx="1"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
      row.appendChild(lockIcon);
    }

    list.appendChild(row);
  });

  // Show normal add/subdivide actions only in normal mode
  const actionsEl  = document.getElementById('grad-stop-actions');
  const shuffleEl  = document.getElementById('grad-shuffle-row');
  if (actionsEl) actionsEl.style.display  = mode === 'normal' ? '' : 'none';
  if (shuffleEl) shuffleEl.style.display  = mode !== 'normal' ? '' : 'none';
}

function syncPaletteSelect() {
  const row = document.getElementById('ctrl-palette');
  if (!row) return;
  row.querySelectorAll('.palette-sw').forEach(s => s.classList.toggle('active', s.dataset.value === state.palette));
}

// ══════════════════════════════════════════════════════════════
// THEME SYNC — filters palette + BG controls to active theme
// ══════════════════════════════════════════════════════════════
function syncTheme() {
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

  // Show only BG gradient presets that match the active theme + color mode
  const gradRow = document.getElementById('bg-grad-container');
  if (gradRow) {
    const activeMode = state.colorMode || 'dark';
    gradRow.querySelectorAll('.bg-grad-btn').forEach(btn => {
      const key = btn.dataset.key;
      if (key === 'none') return; // always visible
      const def = BG_GRADIENTS[key];
      if (!def) { btn.style.display = ''; return; }
      const themeOk = !def.theme || def.theme === state.theme;
      const modeOk  = !def.mode  || def.mode  === activeMode;
      btn.style.display = (themeOk && modeOk) ? '' : 'none';
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
function selectPalette(key) {
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
// GRADIENT SECTION — gradient bar + stop list only
// (Theme toggle and palette swatches now live in buildColorThemeSection)
// ══════════════════════════════════════════════════════════════
function buildGradientSection(sec) {
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
// CURVE PREVIEW
// ══════════════════════════════════════════════════════════════
function renderCurvePreview() {
  const canvas = document.getElementById('curve-preview');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  [1,2,3].forEach(i => {
    ctx.beginPath(); ctx.moveTo(W*i/4,0); ctx.lineTo(W*i/4,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,H*i/4); ctx.lineTo(W,H*i/4); ctx.stroke();
  });
  const lg = ctx.createLinearGradient(0,0,W,0);
  lg.addColorStop(0,   'rgba(124,106,247,0.3)');
  lg.addColorStop(0.5, 'rgba(124,106,247,1)');
  lg.addColorStop(1,   'rgba(124,106,247,0.3)');
  ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.beginPath();
  const S = 120;
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    let tC = t;
    if (state.compositionType === 'rectangle' && state.symmetry) tC = 1 - Math.abs(2*t - 1);
    let v = getCurveValue(Math.max(0,Math.min(1,tC)), state.curveType);
    if (state.flipCurve) v = 1 - v;
    i === 0 ? ctx.moveTo(t*W, H-v*H*0.84-H*0.08) : ctx.lineTo(t*W, H-v*H*0.84-H*0.08);
  }
  ctx.stroke();
  const fg = ctx.createLinearGradient(0,0,0,H);
  fg.addColorStop(0, 'rgba(124,106,247,0.15)'); fg.addColorStop(1, 'rgba(124,106,247,0)');
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
  ctx.fillStyle = fg; ctx.fill();
}

// ══════════════════════════════════════════════════════════════
// CONTROL FACTORIES
// ══════════════════════════════════════════════════════════════

// Sets the CSS --fill custom property on the .slider-row wrap so the
// fill bar reflects the current value position.
function _setSliderFill(input) {
  const mn  = parseFloat(input.min)   || 0;
  const mx  = parseFloat(input.max)   || 1;
  const val = parseFloat(input.value) || 0;
  const pct = Math.max(0, Math.min(100, (val - mn) / (mx - mn) * 100)).toFixed(1);
  const wrap = input.closest('.slider-row');
  if (wrap) wrap.style.setProperty('--fill', pct + '%');
}

function mkSlider({ id, label, min, max, step, key, decimals=0, onChange }) {
  const wrap  = document.createElement('div');
  wrap.className = 'control-row slider-row';

  const lbl = document.createElement('span');
  lbl.className = 'ctrl-label';
  lbl.textContent = label;

  const valEl = document.createElement('span');
  valEl.className = 'val';
  valEl.textContent = (+state[key]).toFixed(decimals);

  const input = document.createElement('input');
  input.type  = 'range';
  input.id    = id;
  input.min   = min;
  input.max   = max;
  input.step  = step;
  input.value = state[key];

  input.addEventListener('input', () => {
    state[key] = parseFloat(input.value);
    valEl.textContent = state[key].toFixed(decimals);
    _setSliderFill(input);
    if (onChange) onChange(state[key]); else redraw();
  });

  wrap.appendChild(lbl);
  wrap.appendChild(valEl);
  wrap.appendChild(input);

  // Set initial fill after appending so closest() works
  requestAnimationFrame(() => _setSliderFill(input));
  return wrap;
}

function mkSelect({ id, label, options, key, onChange }) {
  const wrap = document.createElement('div'); wrap.className = 'control-row';
  const lbl  = document.createElement('label'); lbl.htmlFor = id; lbl.textContent = label;
  const sel  = document.createElement('select'); sel.id = id;
  options.forEach(([value, text]) => {
    const opt = document.createElement('option'); opt.value = value; opt.textContent = text;
    if (state[key] === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => { state[key] = sel.value; if (onChange) onChange(sel.value); else redraw(); });
  wrap.appendChild(lbl); wrap.appendChild(sel);
  return wrap;
}

function mkColor({ id, label, key, onChange }) {
  const wrap  = document.createElement('div'); wrap.className = 'control-row';
  const row   = document.createElement('div'); row.className = 'color-row';
  const lbl   = document.createElement('label'); lbl.className = 'color-label'; lbl.htmlFor = id; lbl.textContent = label;
  const input = document.createElement('input'); input.type = 'color'; input.id = id; input.value = state[key];
  input.addEventListener('input', () => {
    state[key] = input.value;
    if (onChange) onChange(input.value); else redraw();
  });
  row.appendChild(lbl); row.appendChild(input); wrap.appendChild(row);
  return wrap;
}

function mkToggle({ id, label, key, onChange }) {
  const wrap  = document.createElement('div'); wrap.className = 'toggle-row';
  const lbl   = document.createElement('label'); lbl.textContent = label;
  const tog   = document.createElement('label'); tog.className = 'toggle'; tog.htmlFor = id;
  const inp   = document.createElement('input'); inp.type = 'checkbox'; inp.id = id; inp.checked = state[key];
  inp.addEventListener('change', () => {
    state[key] = inp.checked;
    if (onChange) onChange(inp.checked); else redraw();
  });
  const track = document.createElement('span'); track.className = 'toggle-track';
  const thumb = document.createElement('span'); thumb.className = 'toggle-thumb';
  tog.appendChild(inp); tog.appendChild(track); tog.appendChild(thumb);
  wrap.appendChild(lbl); wrap.appendChild(tog);
  return wrap;
}

// options: [value, labelOrHtml, title?]. If labelOrHtml contains '<' it is treated as HTML.
function mkSegmented({ id, label, key, options, onChange, variant }) {
  const wrap = document.createElement('div'); wrap.className = 'control-row' + (label ? '' : ' no-label');
  if (label) {
    const lbl  = document.createElement('label'); lbl.textContent = label;
    wrap.appendChild(lbl);
  }
  const seg  = document.createElement('div'); seg.className = 'segmented' + (variant ? ' ' + variant : ''); seg.id = id;
  options.forEach(([value, content, title]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn' + (state[key] === value ? ' active' : '');
    if (typeof content === 'string' && content.includes('<')) btn.innerHTML = content;
    else btn.textContent = content;
    if (title) btn.title = title;
    btn.dataset.value = value;
    btn.addEventListener('click', () => {
      const prev = state[key];
      state[key] = value;
      seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value));
      if (onChange) onChange(value, prev); else redraw();
    });
    seg.appendChild(btn);
  });
  wrap.appendChild(seg);
  return wrap;
}

// ── Icon library (inline SVG, 14px, currentColor) ────────────────────
const ICONS = {
  alignLeft:   `<svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor"><rect x="1" y="2.5" width="12" height="1.6" rx="0.6"/><rect x="1" y="6" width="8" height="1.6" rx="0.6"/><rect x="1" y="9.5" width="11" height="1.6" rx="0.6"/></svg>`,
  alignCenter: `<svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor"><rect x="1" y="2.5" width="12" height="1.6" rx="0.6"/><rect x="3" y="6" width="8" height="1.6" rx="0.6"/><rect x="1.5" y="9.5" width="11" height="1.6" rx="0.6"/></svg>`,
  alignRight:  `<svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor"><rect x="1" y="2.5" width="12" height="1.6" rx="0.6"/><rect x="5" y="6" width="8" height="1.6" rx="0.6"/><rect x="2" y="9.5" width="11" height="1.6" rx="0.6"/></svg>`,
  gradH:       `<svg viewBox="0 0 18 12" width="22" height="14"><defs><linearGradient id="__gh" x1="0" x2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0.15"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs><rect width="18" height="12" rx="2" fill="url(#__gh)"/></svg>`,
  gradV:       `<svg viewBox="0 0 12 18" width="14" height="22"><defs><linearGradient id="__gv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0.15"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs><rect width="12" height="18" rx="2" fill="url(#__gv)"/></svg>`,
  distHoriz:   `<svg viewBox="0 0 16 16" width="18" height="14" fill="currentColor"><rect x="1" y="4" width="3.6" height="8" rx="0.6"/><rect x="6.2" y="4" width="3.6" height="8" rx="0.6"/><rect x="11.4" y="4" width="3.6" height="8" rx="0.6"/></svg>`,
  distStagger: `<svg viewBox="0 0 16 16" width="18" height="14" fill="currentColor"><rect x="1" y="2" width="8" height="8" rx="0.8" opacity="0.35"/><rect x="4" y="5" width="8" height="8" rx="0.8" opacity="0.6"/><rect x="7" y="8" width="8" height="8" rx="0.8"/></svg>`,
  baseBottom:  `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><rect x="2" y="10" width="3" height="5"/><rect x="6.5" y="4" width="3" height="11"/><rect x="11" y="10" width="3" height="5"/></svg>`,
  baseTop:     `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><rect x="2" y="1" width="3" height="5"/><rect x="6.5" y="1" width="3" height="11"/><rect x="11" y="1" width="3" height="5"/></svg>`,
  baseLeft:    `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><rect x="1" y="2" width="5" height="3"/><rect x="1" y="6.5" width="11" height="3"/><rect x="1" y="11" width="5" height="3"/></svg>`,
  baseRight:   `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><rect x="10" y="2" width="5" height="3"/><rect x="4" y="6.5" width="11" height="3"/><rect x="10" y="11" width="5" height="3"/></svg>`,
  asp1x1:   `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="3.5" y="3.5" width="9"   height="9"   rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  asp4x5:   `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="4.5" y="2.5" width="7"   height="11"  rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  asp16x9:  `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="1"   y="4.5" width="14"  height="7"   rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  asp9x16:  `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="5"   y="1"   width="6"   height="14"  rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  asp191x1: `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="0.5" y="5.5" width="15"  height="5"   rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
};

const ASPECT_LABELS = {
  '1:1':    '1:1 — Square',
  '4:5':    '4:5 — Portrait',
  '16:9':   '16:9 — Landscape',
  '9:16':   '9:16 — Story',
  '1.91:1': '1.91:1 — Wide',
};
function updateAspectLabel(value) {
  const seg = document.getElementById('ctrl-aspect');
  const lbl = seg && seg.closest('.control-row')?.querySelector('label');
  if (lbl) lbl.textContent = ASPECT_LABELS[value] || 'Aspect Ratio';
}

// Generate a tiny SVG preview of a curve type using getCurveValue
function curveThumbSvg(type) {
  const W = 40, H = 22, S = 32, P = 2;
  let d = '';
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const v = Math.max(0, Math.min(1, getCurveValue(t, type)));
    const x = P + t * (W - P * 2);
    const y = H - P - v * (H - P * 2);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

// 3x3 anchor position picker: cells arranged in a grid, each selects one of
// the nine named positions (top-left, top-center, ..., bottom-right).
function mkAnchorGrid({ id, label, key, onChange }) {
  const wrap = document.createElement('div'); wrap.className = 'control-row';
  const lbl = document.createElement('label'); lbl.textContent = label;
  wrap.appendChild(lbl);
  const grid = document.createElement('div'); grid.className = 'anchor-grid'; grid.id = id;
  const positions = [
    'top-left','top-center','top-right',
    'center-left','center','center-right',
    'bottom-left','bottom-center','bottom-right',
  ];
  positions.forEach(value => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'anchor-cell' + (state[key] === value ? ' active' : '');
    btn.dataset.value = value;
    btn.title = value.replace('-', ' ');
    btn.addEventListener('click', () => {
      state[key] = value;
      grid.querySelectorAll('.anchor-cell').forEach(c => c.classList.toggle('active', c.dataset.value === value));
      if (onChange) onChange(value); else redraw();
    });
    grid.appendChild(btn);
  });
  wrap.appendChild(grid);
  return wrap;
}

function mkInput({ id, label, key, onChange }) {
  const wrap = document.createElement('div'); wrap.className = 'control-row';
  const lbl  = document.createElement('label'); lbl.htmlFor = id; lbl.textContent = label;
  const inp  = document.createElement('input'); inp.type = 'text'; inp.id = id; inp.value = state[key]; inp.className = 'text-input';
  inp.addEventListener('input', () => { state[key] = inp.value; if (onChange) onChange(state[key]); });
  wrap.appendChild(lbl); wrap.appendChild(inp);
  return wrap;
}

function mkTextarea({ id, label, key, rows = 3, onChange }) {
  const wrap = document.createElement('div'); wrap.className = 'control-row';
  const lbl  = document.createElement('label'); lbl.htmlFor = id; lbl.textContent = label;
  const ta   = document.createElement('textarea');
  ta.id = id; ta.rows = rows; ta.className = 'text-input textarea-input';
  ta.style.resize = 'vertical';
  ta.value = state[key] || '';
  ta.addEventListener('input', () => { state[key] = ta.value; if (onChange) onChange(state[key]); });
  wrap.appendChild(lbl); wrap.appendChild(ta);
  return wrap;
}

function mkSection(labelText, toggleKey = null) {
  const sec    = document.createElement('div'); sec.className = 'section';
  if (toggleKey) sec.classList.add('collapsible');
  const header = document.createElement('div'); header.className = 'section-header';
  const lbl    = document.createElement('div'); lbl.className = 'section-label'; lbl.textContent = labelText;
  header.appendChild(lbl);

  if (toggleKey) {
    const tg  = document.createElement('label'); tg.className = 'toggle small-tog';
    const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = state[toggleKey];
    inp.addEventListener('change', e => { e.stopPropagation(); state[toggleKey] = inp.checked; updateOverlays(); });
    const tr = document.createElement('span'); tr.className = 'toggle-track';
    const th = document.createElement('span'); th.className = 'toggle-thumb';
    tg.appendChild(inp); tg.appendChild(tr); tg.appendChild(th);
    header.appendChild(tg);
    header.addEventListener('click', e => {
      if (['INPUT','LABEL','SPAN'].includes(e.target.tagName)) return;
      sec.classList.toggle('collapsed');
    });
  }

  const content = document.createElement('div'); content.className = 'section-content';
  sec.appendChild(header); sec.appendChild(content);
  return { sec, content };
}

// ── Sub-label helper ──────────────────────────────────────────
function mkSubLabel(text, mt = 16) {
  const el = document.createElement('div');
  el.className = 'section-label sub';
  el.textContent = text;
  el.style.marginTop = mt + 'px';
  return el;
}

// ══════════════════════════════════════════════════════════════
// TRANSLATE SECTION
// ══════════════════════════════════════════════════════════════
function buildTranslateSection(ct) {
  // ── Preview language picker ──────────────────────────────
  ct.appendChild(mkSubLabel('Preview', 0));

  const previewSel = document.createElement('select');
  previewSel.className = 'tp-custom-select translate-preview-sel';
  previewSel.id = 'ctrl-preview-lang';
  ct.appendChild(previewSel);

  function rebuildPreviewOptions() {
    const current = state.previewLang || 'en';
    previewSel.innerHTML = '';
    LANGUAGES.forEach(l => {
      const has = l.code === 'en' || (state.translations && state.translations[l.code]);
      if (!has) return;
      const opt = document.createElement('option');
      opt.value = l.code;
      const stale = isTranslationStale(l.code);
      opt.textContent = l.label + (stale ? ' (stale)' : '');
      if (current === l.code) opt.selected = true;
      previewSel.appendChild(opt);
    });
  }
  rebuildPreviewOptions();

  previewSel.addEventListener('focus', rebuildPreviewOptions);
  previewSel.addEventListener('change', () => {
    state.previewLang = previewSel.value;
    updateOverlays();
  });

  // ── Target language checkboxes ───────────────────────────
  ct.appendChild(mkSubLabel('Translate to'));

  const targetsBox = document.createElement('div');
  targetsBox.className = 'translate-targets';
  TRANSLATION_TARGET_LANGS.forEach(l => {
    const row = document.createElement('label');
    row.className = 'translate-target-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.dataset.lang = l.code;
    row.appendChild(cb);
    const text = document.createElement('span');
    text.textContent = l.label;
    row.appendChild(text);
    targetsBox.appendChild(row);
  });
  ct.appendChild(targetsBox);

  // ── Translate button + status ────────────────────────────
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn translate-btn';
  btn.textContent = 'Translate';
  ct.appendChild(btn);

  const status = document.createElement('div');
  status.className = 'translate-status';
  ct.appendChild(status);

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.classList.toggle('error', !!isError);
  }

  if (!TRANSLATION_WORKER_URL) {
    setStatus('Set TRANSLATION_WORKER_URL in shared.js to enable.');
  }

  btn.addEventListener('click', async () => {
    const checkedLangs = Array.from(targetsBox.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.dataset.lang);
    if (checkedLangs.length === 0) {
      setStatus('Pick at least one language.', true);
      return;
    }
    if (!TRANSLATION_WORKER_URL) {
      setStatus('Set TRANSLATION_WORKER_URL in shared.js first.', true);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Translating…';
    setStatus(`Translating to ${checkedLangs.length} language${checkedLangs.length === 1 ? '' : 's'}…`);
    try {
      const stored = await runTranslate(checkedLangs);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setStatus(`Translated ${stored} at ${time}.`);
      rebuildPreviewOptions();
      updateOverlays();
    } catch (err) {
      setStatus(err.message || String(err), true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Translate';
    }
  });

  // ── Export all languages (.zip) ──────────────────────────
  const exportAllBtn = document.createElement('button');
  exportAllBtn.type = 'button';
  exportAllBtn.className = 'btn translate-btn export-all-btn';
  exportAllBtn.textContent = '↓ Export all (.zip)';
  ct.appendChild(exportAllBtn);

  exportAllBtn.addEventListener('click', async () => {
    if (typeof JSZip === 'undefined') {
      setStatus('JSZip not loaded — check your internet connection.', true);
      return;
    }
    const langs = ['en', ...Object.keys(state.translations || {})];
    if (langs.length === 1) {
      setStatus('No translations stored — translate something first.', true);
      return;
    }
    exportAllBtn.disabled = true;
    btn.disabled = true;
    exportAllBtn.textContent = 'Exporting…';
    try {
      const zip = await runExportAll(langs, lang => {
        setStatus(`Rendering ${lang}…`);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      window._downloadBlob(zipBlob, `slides-${Date.now()}.zip`);
      setStatus(`Exported ${langs.length} languages.`);
    } catch (err) {
      setStatus(err.message || String(err), true);
    } finally {
      exportAllBtn.disabled = false;
      btn.disabled = false;
      exportAllBtn.textContent = '↓ Export all (.zip)';
    }
  });

  // Expose so randomize / preset-load paths can refresh the dropdown later
  window._translateRefresh = rebuildPreviewOptions;
}

async function runExportAll(langs, onProgress) {
  const zip = new JSZip();
  const savedLang = state.previewLang;
  try {
    for (const lang of langs) {
      onProgress?.(lang);
      state.previewLang = lang;
      updateOverlays();                    // updates DOM overlays
      if (window._p5Redraw) window._p5Redraw(); // synchronous redraw of p5 canvas
      // Yield once so the browser can apply layout from updateOverlays
      // (the export reads getBoundingClientRect on overlay elements).
      await new Promise(r => setTimeout(r, 0));
      const blob = await window._exportToBlob();
      if (blob) zip.file(`${lang}.png`, blob);
    }
  } finally {
    state.previewLang = savedLang;
    updateOverlays();
    if (window._p5Redraw) window._p5Redraw();
  }
  return zip;
}

async function runTranslate(targetLanguages) {
  const resp = await fetch(TRANSLATION_WORKER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      targetLanguages,
      headlineText:           state.headlineText || '',
      footerByline:           state.footerByline || '',
      headlineHighlightWords: state.headlineHighlightWords || '',
    }),
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json()).error || ''; } catch { /* ignore */ }
    throw new Error(`Worker ${resp.status}${detail ? ': ' + detail : ''}`);
  }
  const data = await resp.json();
  if (!data || typeof data.translations !== 'object' || data.translations === null) {
    throw new Error('Worker returned no translations object');
  }

  const sourceHash = getEnglishSourceHash();
  let stored = 0;
  for (const lang of targetLanguages) {
    const t = data.translations[lang];
    if (!t || typeof t !== 'object') continue;
    state.translations[lang] = {
      headlineText:           typeof t.headlineText === 'string'           ? t.headlineText           : '',
      footerByline:           typeof t.footerByline === 'string'           ? t.footerByline           : '',
      headlineHighlightWords: typeof t.headlineHighlightWords === 'string' ? t.headlineHighlightWords : '',
      sourceHash,
    };
    stored++;
  }
  if (stored === 0) throw new Error('No valid translations in response');
  return stored;
}

// ══════════════════════════════════════════════════════════════
// BG PRESET SWATCHES + GRADIENT PRESETS (dynamic)
// ══════════════════════════════════════════════════════════════
function buildBgPresetsUI(sec) {
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
function buildImagePresetControls(sec) {
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

function applySelectedImage() {
  const imgs = IMAGE_STYLES[state.imageStyle] || [];
  const img  = imgs[state.imageStyleIndex];
  if (img) state.imageSrc = img;
}

function buildImageDistControls(sec) {
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

// ══════════════════════════════════════════════════════════════
// PRESETS  (localStorage persistence)
// ══════════════════════════════════════════════════════════════
const _PRESETS_KEY = 'pai-tool-presets-v1';

function _loadPresets() {
  try { return JSON.parse(localStorage.getItem(_PRESETS_KEY)) || []; }
  catch { return []; }
}
function _savePresetsStore(list) {
  localStorage.setItem(_PRESETS_KEY, JSON.stringify(list));
}

// Seed DEFAULT_PRESETS (from shared.js) into localStorage on first load.
// Only runs if the key is absent or empty — never overwrites user presets.
(function _seedDefaultPresets() {
  try {
    const existing = JSON.parse(localStorage.getItem(_PRESETS_KEY));
    if (!existing || existing.length === 0) {
      localStorage.setItem(_PRESETS_KEY, JSON.stringify(DEFAULT_PRESETS));
    }
  } catch { /* ignore */ }
})();

// Builds presets controls into a Tweakpane folder content area
function buildPresetsContent(content) {

  // ── Save row ────────────────────────────────────────────────
  const saveRow = document.createElement('div');
  saveRow.className = 'preset-save-row';

  const nameInput = document.createElement('input');
  nameInput.type        = 'text';
  nameInput.className   = 'text-input';
  nameInput.placeholder = 'Name this preset…';
  nameInput.style.flex  = '1';

  const saveBtn = document.createElement('button');
  saveBtn.className   = 'seg-btn';
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'flex-shrink:0;padding:0 12px;height:30px;';

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const list = _loadPresets();
    // Deep-copy state; drop transient fields that can't persist
    const snap = JSON.parse(JSON.stringify({
      ...state,
      imageSrc:        '',   // blob URL won't survive a session
      imageStyleOrder: null,
    }));
    list.unshift({ id: Date.now(), name, snap });
    _savePresetsStore(list);
    nameInput.value = '';
    renderList();
  });

  // Also save on Enter
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  saveRow.appendChild(nameInput);
  saveRow.appendChild(saveBtn);
  content.appendChild(saveRow);

  // ── Preset list ─────────────────────────────────────────────
  const listEl = document.createElement('div');
  listEl.className = 'preset-list';
  content.appendChild(listEl);

  function renderList() {
    const list = _loadPresets();
    listEl.innerHTML = '';

    if (list.length === 0) {
      const msg = document.createElement('p');
      msg.className   = 'preset-empty';
      msg.textContent = 'No presets yet — configure the tool and save.';
      listEl.appendChild(msg);
      return;
    }

    list.forEach((preset, idx) => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';

      const applyBtn = document.createElement('button');
      applyBtn.className   = 'preset-name';
      applyBtn.textContent = preset.name;
      applyBtn.title       = 'Apply preset';
      applyBtn.addEventListener('click', () => {
        Object.assign(state, preset.snap);
        // Migrate old presets that stored headlineTextColor/footerTextColor
        // as plain hex strings without the new base+opacity fields.
        if (!preset.snap.headlineTextBase) {
          const luma = getColorLuma(state.headlineTextColor || '#ffffff');
          state.headlineTextBase    = luma > 128 ? '#ffffff' : '#050505';
          state.headlineTextOpacity = 1.0;
        }
        if (!preset.snap.footerTextBase) {
          const luma = getColorLuma(state.footerTextColor || '#ffffff');
          state.footerTextBase    = luma > 128 ? '#ffffff' : '#050505';
          state.footerTextOpacity = 1.0;
        }
        syncControlsToState();
        updateOverlays();
        if (window._p5Resize) window._p5Resize();
      });

      const delBtn = document.createElement('button');
      delBtn.className   = 'preset-del';
      delBtn.textContent = '×';
      delBtn.title       = 'Delete preset';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        const updated = _loadPresets();
        updated.splice(idx, 1);
        _savePresetsStore(updated);
        renderList();
      });

      chip.appendChild(applyBtn);
      chip.appendChild(delBtn);
      listEl.appendChild(chip);
    });
  }

  renderList();
}

// ══════════════════════════════════════════════════════════════
// TEXT BASE CONTROL — Dark/Light toggle + opacity slider
// ══════════════════════════════════════════════════════════════
// prefix: 'hl' (headline) | 'ft' (footer)
function mkTextBaseControl(prefix) {
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

// ══════════════════════════════════════════════════════════════
// BUILD GUI
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// COLOR & THEME SECTION
// ══════════════════════════════════════════════════════════════

/** Rebuild the swatch grid inside the Color & Theme section */
function rebuildCtSwatches() {
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

// Rebuild the two visual palette gradient-bar swatches in Color & Theme section.
// Called after theme/colorMode changes so the correct warm/cool pair is shown.
function rebuildCtPaletteSwatches() {
  const existing = document.getElementById('ct-pal-swatches');
  if (!existing) return;
  const shapeLbl = document.getElementById('ct-shape-grad-label');
  if (!shapeLbl) return;
  const ct = shapeLbl.parentElement;

  existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'ct-pal-swatches';
  wrap.className = 'control-row';
  const swLabel = document.createElement('label'); swLabel.textContent = 'Palette';
  wrap.appendChild(swLabel);

  const warmKey = state.colorMode === 'light' ? 'marketingWarmLight' : 'marketingWarm';
  const coolKey = state.colorMode === 'light' ? 'arctic' : 'marketingCool';

  [warmKey, coolKey].forEach(key => {
    const p = PALETTES[key];
    if (!p) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ct-palette-swatch' + (state.palette === key ? ' active' : '');
    btn.title = p.label;
    if (p.stops) {
      const css = p.stops.map(s => `${s.color} ${(s.stop * 100).toFixed(0)}%`).join(', ');
      btn.style.background = `linear-gradient(90deg, ${css})`;
    }
    btn.addEventListener('click', () => {
      selectPalette(key);
      wrap.querySelectorAll('.ct-palette-swatch').forEach(b => b.classList.toggle('active', b === btn));
    });
    wrap.appendChild(btn);
  });

  ct.insertBefore(wrap, shapeLbl);
}

// Initial build: creates the #ct-pal-swatches element for the first time
function _initCtPaletteSwatches(ct) {
  const wrap = document.createElement('div');
  wrap.id = 'ct-pal-swatches';
  wrap.className = 'control-row';
  const swLabel = document.createElement('label'); swLabel.textContent = 'Palette';
  wrap.appendChild(swLabel);

  const warmKey = state.colorMode === 'light' ? 'marketingWarmLight' : 'marketingWarm';
  const coolKey = state.colorMode === 'light' ? 'arctic' : 'marketingCool';

  [warmKey, coolKey].forEach(key => {
    const p = PALETTES[key];
    if (!p) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ct-palette-swatch' + (state.palette === key ? ' active' : '');
    btn.title = p.label;
    if (p.stops) {
      const css = p.stops.map(s => `${s.color} ${(s.stop * 100).toFixed(0)}%`).join(', ');
      btn.style.background = `linear-gradient(90deg, ${css})`;
    }
    btn.addEventListener('click', () => {
      selectPalette(key);
      wrap.querySelectorAll('.ct-palette-swatch').forEach(b => b.classList.toggle('active', b === btn));
    });
    wrap.appendChild(btn);
  });

  const shapeLbl = ct.querySelector('#ct-shape-grad-label');
  if (shapeLbl) ct.insertBefore(wrap, shapeLbl);
  else ct.appendChild(wrap);
}

function buildColorThemeSection(scroll) {
  const sec = mkSection('Color & Theme');
  const ct = sec.content;

  // ── 1. Warm / Cool theme toggle ───────────────────────────
  ct.appendChild(mkSegmented({
    id: 'ctrl-theme', label: 'Theme', key: 'theme',
    options: [['warm', 'Warm'], ['cool', 'Cool']],
    onChange: (v) => {
      state.theme = v;

      // Reset palette to first one in the new theme
      const firstPal = Object.entries(PALETTES).find(([, p]) => p.tone === v);
      if (firstPal) { state.palette = firstPal[0]; applyPalette(firstPal[0]); }

      // Set stroke style from theme
      state.imageStrokeStyle = (v === 'cool') ? 'frosty' : 'marketing';

      // Reset BG gradient if it belongs to the wrong theme
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

      // Reset solid BG color to a mid-range swatch in the new theme
      const newBgs = getActiveBgPresets();
      if (newBgs.length && !newBgs.some(b => b.color.toLowerCase() === state.bgColor.toLowerCase())) {
        state.bgColor = newBgs[Math.floor(newBgs.length / 2)].color;
        const bgPicker = document.getElementById('ctrl-bgcolor');
        if (bgPicker) bgPicker.value = state.bgColor;
      }

      // update circle borders
      circleRow.querySelectorAll('[data-theme-circle]').forEach(b =>
        b.style.borderColor = b.dataset.themeCircle === v ? '#fff' : 'transparent');

      syncTheme(); syncPaletteSelect(); renderStopList(); updateOverlays(); redraw();
    },
  }));

  // ── 2 theme circles ──────────────────────────────────────
  const circleRow = document.createElement('div');
  circleRow.style.cssText = 'display:flex;gap:8px;margin:10px 0 4px;';

  [
    { key: 'warm', color: '#F66A24', label: 'Warm' },
    { key: 'cool', color: '#66A8FF', label: 'Cool' },
  ].forEach(({ key, color, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = label;
    btn.dataset.themeCircle = key;
    btn.style.cssText = `
      width:22px;height:22px;border-radius:50%;
      background:${color};border:2px solid transparent;
      padding:0;cursor:pointer;transition:border-color 0.15s,transform 0.12s;
      flex-shrink:0;outline:none;
    `;
    if (state.theme === key) btn.style.borderColor = '#fff';
    btn.addEventListener('click', () => {
      const v = key;
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
          } else { state.bgGradientMode = false; }
        }
      }
      const newBgs = getActiveBgPresets();
      if (newBgs.length && !newBgs.some(b => b.color.toLowerCase() === state.bgColor.toLowerCase())) {
        state.bgColor = newBgs[Math.floor(newBgs.length / 2)].color;
        const bgPicker = document.getElementById('ctrl-bgcolor');
        if (bgPicker) bgPicker.value = state.bgColor;
      }
      // update circle borders
      circleRow.querySelectorAll('[data-theme-circle]').forEach(b =>
        b.style.borderColor = b.dataset.themeCircle === v ? '#fff' : 'transparent');
      syncTheme(); syncPaletteSelect(); renderStopList(); updateOverlays(); redraw();
    });
    circleRow.appendChild(btn);
  });

  ct.appendChild(circleRow);

  // ── 2. Light / Dark mode segmented ───────────────────────
  const modeRow = document.createElement('div'); modeRow.className = 'control-row';
  const modeLbl = document.createElement('label'); modeLbl.textContent = 'Mode';
  modeRow.appendChild(modeLbl);
  const modeSeg = document.createElement('div'); modeSeg.className = 'segmented'; modeSeg.id = 'ct-mode-col';
  [['dark', 'Dark'], ['light', 'Light']].forEach(([val, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ct-mode-btn seg-btn' + (state.colorMode === val ? ' active' : '');
    btn.dataset.mode = val;
    btn.dataset.value = val;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (state.colorMode === val) return;
      state.colorMode = val;
      modeSeg.querySelectorAll('.ct-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === val));
      // Auto-select palette appropriate for new mode
      const themePalKey = state.theme === 'warm'
        ? (val === 'dark' ? 'marketingWarm' : 'marketingWarmLight')
        : (val === 'dark' ? 'marketingCool' : 'arctic');
      if (PALETTES[themePalKey]) selectPalette(themePalKey);
      applyPalette(state.palette);
      const newPresets = getActiveBgPresets();
      if (newPresets.length) {
        state.bgColor = newPresets[0].color;
        const colorEl = document.getElementById('ctrl-bgcolor');
        if (colorEl) colorEl.value = state.bgColor;
        onBgChanged();
      }
      rebuildBgSwatches();
      rebuildCtSwatches();
      syncTheme();
      redraw();
    });
    modeSeg.appendChild(btn);
  });
  modeRow.appendChild(modeSeg);
  ct.appendChild(modeRow);

  // ── 3. Palette swatches row (hidden; required for syncPaletteSelect / syncTheme) ─
  // The full palette-sw row is kept in the DOM for JS compatibility,
  // but not displayed — visual selection is done via ct-palette-swatch gradient bars below.
  const palRow = document.createElement('div');
  palRow.className = 'palette-row';
  palRow.id = 'ctrl-palette';
  palRow.style.display = 'none'; // hidden — ct-palette-swatches show the visual
  Object.entries(PALETTES).forEach(([key, p]) => {
    if (!p.tone) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.value = key;
    btn.title = p.label;
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

  // ── 4. Shape Gradient sublabel + gradient controls ─────────
  const shapeLbl = mkSubLabel('Shape Gradient');
  shapeLbl.id = 'ct-shape-grad-label';
  ct.appendChild(shapeLbl);

  // Build the gradient bar, stop list, actions, shuffle inside ct
  buildGradientSection(ct);

  // ── 6. Background sublabel + bg controls ──────────────────
  ct.appendChild(mkSubLabel('Background'));

  // Solid / Gradient segmented toggle
  ct.appendChild(mkSegmented({
    id: 'ctrl-bg-mode', label: 'BG Type', key: 'bgGradientMode',
    options: [['solid', 'Solid'], ['gradient', 'Gradient']],
    onChange: (v) => {
      state.bgGradientMode = (v === 'gradient');
      const sg = document.getElementById('bg-solid-group');
      const gg = document.getElementById('bg-grad-group');
      if (sg) sg.style.display = state.bgGradientMode ? 'none' : '';
      if (gg) gg.style.display = state.bgGradientMode ? '' : 'none';
      onBgChanged();
      redraw();
    },
  }));
  // Fix: state.bgGradientMode is boolean, segmented uses string values — patch the segmented key to use string
  // The mkSegmented will read state['bgGradientMode'] which is boolean; we need string matching.
  // Override: re-sync the newly created segmented to reflect boolean state correctly.
  setTimeout(() => {
    const bgModeSeg = document.getElementById('ctrl-bg-mode');
    if (bgModeSeg) {
      const v = state.bgGradientMode ? 'gradient' : 'solid';
      bgModeSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === v));
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
  // BG swatch container (flat colour presets)
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

  // Hidden container required by rebuildCtSwatches / syncTheme (provides colour luma logic etc)
  const ctSwatchHidden = document.createElement('div');
  ctSwatchHidden.id = 'ct-swatch-container';
  ctSwatchHidden.style.display = 'none';
  ct.appendChild(ctSwatchHidden);

  scroll.appendChild(sec.sec);

  // Populate swatches on first build
  rebuildCtSwatches();
  rebuildBgSwatches();
}

// Helper: builds BG gradient preset buttons + flip toggle into a container element
function _buildBgGradPresets(container) {
  const gradWrap = document.createElement('div'); gradWrap.className = 'control-row';
  const gradRow  = document.createElement('div'); gradRow.className = 'bg-grad-row'; gradRow.id = 'bg-grad-container';

  // "Solid" reset button is omitted here — mode switching is done by ctrl-bg-mode segmented
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

  // ── Presets (now a collapsible folder) ────────────────────
  const fPresets = registerFolder(pane.addFolder({ title: 'Presets', expanded: false }));
  into(fPresets, ct => {
    ct.classList.add('section-presets');
    buildPresetsContent(ct);
  });

  // ── Canvas ────────────────────────────────────────────────
  const fCanvas = registerFolder(pane.addFolder({ title: 'Canvas', expanded: false }));
  into(fCanvas, ct => {
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
        // Save the leaving aspect's current values so they're restored
        // verbatim if the user switches back. (Skip when prev === v —
        // happens on the very first click of the active button.)
        if (prev && prev !== v) {
          state.aspectOverrides[prev] = snapshotAspectFields();
        }
        // Prefer the user's stored override for the new aspect; fall back
        // to fresh defaults the first time they visit it.
        const override = state.aspectOverrides[v];
        applyAspectFields(override || ASPECT_RATIO_DEFAULTS[v]);

        updateAspectLabel(v);
        syncControlsToState();
        updateOverlays();
        if (window._p5Resize) window._p5Resize();
      },
    }));
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
  const fGraphics = registerFolder(pane.addFolder({ title: 'Composition', expanded: false }));
  into(fGraphics, ct => {
    ct.classList.add('section-composition');

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

    // Composition-only blur control
    ct.appendChild(mkSlider({ id:'ctrl-blur', label:'Blur', min:0, max:20, step:0.5, key:'blur', decimals:1 }));
  });

  // ── Graphics (slim: opacity + shadow + inner glow only) ───
  const fGraphicsFx = registerFolder(pane.addFolder({ title: 'Graphics', expanded: false }));
  into(fGraphicsFx, ct => {
    ct.appendChild(mkSubLabel('Global Opacity', 0));
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

  // ── Headline ──────────────────────────────────────────────
  const fHeadline = registerFolder(pane.addFolder({ title: 'Headline', expanded: false }));
  into(fHeadline, ct => {
    ct.classList.add('section-headline');

    // ── Text ──────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Text', 0));
    ct.appendChild(mkTextarea({ id:'ctrl-hl-text',  label:'',                key:'headlineText',           rows:3, onChange: updateOverlays }));
    ct.appendChild(mkInput(   { id:'ctrl-hl-words', label:'Highlight Words', key:'headlineHighlightWords',         onChange: updateOverlays }));

    // ── Colour ────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Colour'));
    ct.appendChild(mkTextBaseControl('hl'));
    ct.appendChild(mkColor({ id:'ctrl-hl-hl-color', label:'Highlight', key:'headlineHighlightColor', onChange: updateOverlays }));

    // ── Fill ──────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Fill'));
    ct.appendChild(mkToggle({ id:'ctrl-hl-fill',     label:'Fill Behind Text', key:'headlineFillEnabled',
      onChange: () => { state.headlineFillOpacity = 1; updateOverlays(); redraw(); } }));
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
  });

  // ── Image Placeholder ─────────────────────────────────────
  const fImage = registerFolder(pane.addFolder({ title: 'Image Placeholder', expanded: false }));
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

  // ── Footer ────────────────────────────────────────────────
  const fFooter = registerFolder(pane.addFolder({ title: 'Footer', expanded: false }));
  into(fFooter, ct => {
    ct.classList.add('section-footer');

    // ── Text ──────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Text', 0));
    ct.appendChild(mkInput({ id:'ctrl-ft-byline', label:'', key:'footerByline', onChange: updateOverlays }));

    // ── Colour ────────────────────────────────────────────
    ct.appendChild(mkSubLabel('Colour'));
    ct.appendChild(mkTextBaseControl('ft'));

    // ── Typography ────────────────────────────────────────
    ct.appendChild(mkSubLabel('Typography'));
    ct.appendChild(mkSegmented({ id:'ctrl-ft-align', label:'', key:'footerAlign',
      options:[['left', ICONS.alignLeft, 'Left'],['center', ICONS.alignCenter, 'Center'],['right', ICONS.alignRight, 'Right']],
      onChange: updateOverlays }));
    ct.appendChild(mkSegmented({ id:'ctrl-ft-font',  label:'', key:'footerFont',
      options:[['400','Regular'],['500','Medium'],['700','Bold']], onChange: updateOverlays }));
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

// ── _applyTheme: central warm/cool theme switcher ─────────────
function _applyTheme(v) {
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

// ══════════════════════════════════════════════════════════════
// RANDOMIZE
// ══════════════════════════════════════════════════════════════
function randomize() {
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

  state.rectCount          = Math.floor(Math.random()*60)+10;   // 10–70
  state.circleCount        = Math.floor(Math.random()*15)+5;
  state.circleDiameter     = Math.floor(Math.random()*1200)+200;
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

function syncControlsToState() {
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

  // Image style thumb
  const styleRow = document.getElementById('ctrl-img-style');
  if (styleRow) styleRow.querySelectorAll('.img-thumb').forEach(b => b.classList.toggle('active', b.dataset.value === state.imageStyle));

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
    ['ctrl-img-multi',         'imageMulti'],
    ['ctrl-bar-flip-grad',     'barFlipGradient'],
    ['ctrl-bg-grad-flip',      'bgGradientFlip'],
    ['ctrl-hl-fill',           'headlineFillEnabled'],
  ].forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.checked = state[key]; });

  updateAspectLabel(state.aspectRatio);

  // Update slider fill CSS custom properties for all range inputs
  document.querySelectorAll('input[type="range"]').forEach(_setSliderFill);

  // Sync theme toggle and all filtered sub-menus
  syncTheme();
  // Sync text base toggles and opacity sliders
  syncTextBaseUI();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Apply the correct layout defaults for the starting aspect ratio so
  // the GUI and canvas open with the right values (not the generic fallbacks).
  const initDefaults = ASPECT_RATIO_DEFAULTS[state.aspectRatio];
  if (initDefaults) Object.assign(state, initDefaults);

  buildGUI();
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

  document.getElementById('btn-random').addEventListener('click', randomize);

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
});
