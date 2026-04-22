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

// Compute and apply adaptive text color + drop shadow based on bg luma
function applyTextAdaptation() {
  const textColor  = getTextColorForBg(state.bgColor);
  const isLight    = textColor === '#000000';
  // Subtle shadow: opposite of text color
  const shadowColor = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)';
  const shadow      = `0 1px 6px ${shadowColor}, 0 2px 12px ${shadowColor}`;

  // Headline
  document.querySelectorAll('.headline-text').forEach(el => {
    el.style.color      = textColor;
    el.style.textShadow = shadow;
  });

  // Footer byline
  const bylineEl = document.getElementById('footer-byline');
  if (bylineEl) {
    bylineEl.style.color      = textColor;
    bylineEl.style.textShadow = shadow;
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
      applyTextAdaptation();
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

function updateOverlays() {
  const h1         = document.getElementById('headline-l1');
  const h2         = document.getElementById('headline-l2');
  const overlayHead = document.getElementById('overlay-headline');
  const overlayFoot = document.getElementById('overlay-footer');
  const byline      = document.getElementById('footer-byline');

  if (h1 && h2 && overlayHead) {
    // Don't stomp the caret while the user is editing in-place
    if (document.activeElement !== h1) h1.textContent = state.headlineLine1;
    if (document.activeElement !== h2) h2.textContent = state.headlineLine2;
    overlayHead.style.textAlign    = state.headlineAlign;
    overlayHead.style.display      = state.showHeadline ? 'flex' : 'none';
    overlayHead.style.top          = `calc(${state.headlineYPos}px * var(--scale))`;
    overlayHead.style.paddingLeft  = `calc(${state.headlinePadding}px * var(--scale))`;
    overlayHead.style.paddingRight = `calc(${state.headlinePadding}px * var(--scale))`;

    [h1, h2].forEach(el => {
      el.style.letterSpacing = `calc(${state.headlineTracking}px * var(--scale))`;
      el.style.lineHeight    = state.headlineLineHeight;
      el.style.fontSize      = `calc(${state.headlineFontSize}px * var(--scale))`;
      el.style.fontWeight    = state.headlineFont;
    });
  }

  updateImageDistribution();

  if (overlayFoot && byline) {
    byline.textContent            = state.footerByline;
    byline.style.textAlign        = state.footerAlign;
    byline.style.letterSpacing    = `calc(${state.footerTracking}px * var(--scale))`;
    byline.style.fontWeight       = state.footerFont;
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
    [...state.gradientStops].sort((a,b) => a.stop - b.stop).forEach(s => {
      const m = document.createElement('div');
      m.className = 'grad-marker';
      m.style.left = `calc(${s.stop*100}% - 7px)`;
      m.style.borderBottomColor = s.color;
      markers.appendChild(m);
    });
  }
}

// ══════════════════════════════════════════════════════════════
// STOP LIST
// ══════════════════════════════════════════════════════════════
function renderStopList() {
  const list = document.getElementById('grad-stops-list');
  if (!list) return;
  list.innerHTML = '';

  [...state.gradientStops].sort((a,b) => a.stop - b.stop).forEach(stop => {
    const row = document.createElement('div');
    row.className = 'stop-row';

    const colorInput = document.createElement('input');
    colorInput.type      = 'color';
    colorInput.value     = stop.color;
    colorInput.className = 'stop-color-input';
    colorInput.title     = 'Pick color';

    colorInput.addEventListener('input', () => {
      const idx = state.gradientStops.findIndex(s => s === stop);
      if (idx >= 0) { state.gradientStops[idx].color = colorInput.value; stop.color = colorInput.value; }
      if (window._p5Redraw) window._p5Redraw();
      renderGradientBar();
    });
    colorInput.addEventListener('change', () => renderStopList());

    const posWrap   = document.createElement('div'); posWrap.className = 'stop-pos-wrap';
    const posSlider = document.createElement('input');
    posSlider.type  = 'range'; posSlider.min = '0'; posSlider.max = '1';
    posSlider.step  = '0.01'; posSlider.value = stop.stop;
    posSlider.className = 'stop-pos-slider';
    const posVal = document.createElement('span');
    posVal.className = 'stop-pos-val';
    posVal.textContent = stop.stop.toFixed(2);

    posSlider.addEventListener('input', () => {
      const idx = state.gradientStops.findIndex(s => s === stop);
      if (idx >= 0) state.gradientStops[idx].stop = parseFloat(posSlider.value);
      posVal.textContent = parseFloat(posSlider.value).toFixed(2);
      redraw();
    });
    posSlider.addEventListener('change', () => renderStopList());
    posWrap.appendChild(posSlider); posWrap.appendChild(posVal);

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

    row.appendChild(colorInput); row.appendChild(posWrap); row.appendChild(del);
    list.appendChild(row);
  });
}

function syncPaletteSelect() {
  const row = document.getElementById('ctrl-palette');
  if (!row) return;
  row.querySelectorAll('.palette-sw').forEach(s => s.classList.toggle('active', s.dataset.value === state.palette));
}

// ══════════════════════════════════════════════════════════════
// GRADIENT SECTION
// ══════════════════════════════════════════════════════════════
function buildGradientSection(sec) {
  // Palette swatches — gradient previews
  const palWrap = document.createElement('div'); palWrap.className = 'control-row';
  const palLabel = document.createElement('label'); palLabel.textContent = 'Palette';
  palWrap.appendChild(palLabel);
  const palRow = document.createElement('div'); palRow.className = 'palette-row'; palRow.id = 'ctrl-palette';

  const selectPalette = (key) => {
    state.palette = key;
    if (key !== 'custom') applyPalette(key);
    const tone = getPaletteTone();
    state.imageStrokeStyle = (tone === 'cool') ? 'frosty' : 'marketing';
    palRow.querySelectorAll('.palette-sw').forEach(s => s.classList.toggle('active', s.dataset.value === key));
    rebuildBgSwatches();
    updateOverlays();
    renderStopList();
  };

  Object.entries(PALETTES).forEach(([key, p]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.value = key;
    btn.title = p.label;
    btn.className = 'palette-sw' + (state.palette === key ? ' active' : '') + (key === 'custom' ? ' custom' : '');
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
  palWrap.appendChild(palRow);
  sec.appendChild(palWrap);

  sec.appendChild(mkSegmented({
    id: 'ctrl-grad-dir', label: 'Direction', key: 'gradientDirection',
    options: [
      ['horizontal', ICONS.gradH, 'Horizontal — sweeps left → right'],
      ['vertical',   ICONS.gradV, 'Vertical — sweeps top → bottom'],
    ],
  }));

  const barOuter = document.createElement('div'); barOuter.className = 'grad-bar-outer';
  const bar = document.createElement('canvas'); bar.id = 'grad-bar'; bar.width = 260; bar.height = 28;
  const markers = document.createElement('div'); markers.id = 'grad-markers'; markers.className = 'grad-markers';
  barOuter.appendChild(bar); barOuter.appendChild(markers);
  sec.appendChild(barOuter);

  const stopList = document.createElement('div'); stopList.id = 'grad-stops-list'; stopList.className = 'grad-stops-list';
  sec.appendChild(stopList);

  const actions = document.createElement('div'); actions.className = 'grad-actions';
  const addBtn  = document.createElement('button'); addBtn.className = 'btn small'; addBtn.id = 'btn-add-stop'; addBtn.textContent = '+ Add Stop';
  addBtn.addEventListener('click', () => { addGradientStop(0.5); state.palette = 'custom'; syncPaletteSelect(); redraw(); renderStopList(); });

  const subDiv   = document.createElement('div'); subDiv.className = 'subdivide-ctrl';
  const subLabel = document.createElement('span'); subLabel.textContent = 'Subdivide';
  const subN = document.createElement('input'); subN.type = 'number'; subN.id = 'subdivide-n'; subN.min = '1'; subN.max = '8'; subN.value = '2'; subN.className = 'subdivide-input';
  const subBtn = document.createElement('button'); subBtn.className = 'btn small'; subBtn.textContent = 'Apply';
  subBtn.addEventListener('click', () => { subdivideGradient(Math.max(1,Math.min(8,parseInt(subN.value,10)||2))); state.palette='custom'; syncPaletteSelect(); redraw(); renderStopList(); });
  subDiv.appendChild(subLabel); subDiv.appendChild(subN); subDiv.appendChild(subBtn);
  actions.appendChild(addBtn); actions.appendChild(subDiv);
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
function mkSlider({ id, label, min, max, step, key, decimals=0, onChange }) {
  const wrap  = document.createElement('div'); wrap.className = 'control-row';
  const lbl   = document.createElement('label'); lbl.htmlFor = id;
  lbl.appendChild(document.createTextNode(label));
  const val   = document.createElement('span'); val.className = 'val';
  val.textContent = (+state[key]).toFixed(decimals); lbl.appendChild(val);
  const input = document.createElement('input');
  input.type='range'; input.id=id; input.min=min; input.max=max; input.step=step; input.value=state[key];
  input.addEventListener('input', () => {
    state[key] = parseFloat(input.value);
    val.textContent = state[key].toFixed(decimals);
    if (onChange) onChange(state[key]); else redraw();
  });
  wrap.appendChild(lbl); wrap.appendChild(input);
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
  const wrap = document.createElement('div'); wrap.className = 'control-row';
  const lbl  = document.createElement('label'); lbl.textContent = label;
  wrap.appendChild(lbl);
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
      state[key] = value;
      seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value));
      if (onChange) onChange(value); else redraw();
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
// BG PRESET SWATCHES (dynamic)
// ══════════════════════════════════════════════════════════════
function buildBgPresetsUI(sec) {
  const wrap = document.createElement('div'); wrap.className = 'control-row';
  const lbl  = document.createElement('label'); lbl.textContent = 'Background Presets';
  wrap.appendChild(lbl);

  const row = document.createElement('div'); row.className = 'bg-swatch-row'; row.id = 'bg-swatch-container';
  wrap.appendChild(row);
  sec.appendChild(wrap);
  // Initial population
  rebuildBgSwatches();
}

// ══════════════════════════════════════════════════════════════
// IMAGE PRESET + DISTRIBUTION CONTROLS
// ══════════════════════════════════════════════════════════════
function buildImagePresetControls(sec) {
  // Style thumbnail picker
  const styleWrap = document.createElement('div'); styleWrap.className = 'control-row';
  const styleLbl  = document.createElement('label'); styleLbl.textContent = 'Style';
  styleWrap.appendChild(styleLbl);
  const styleRow = document.createElement('div'); styleRow.className = 'img-style-row'; styleRow.id = 'ctrl-img-style';
  Object.entries(IMAGE_STYLES).forEach(([key, list]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'img-thumb' + (state.imageStyle === key ? ' active' : '');
    btn.dataset.value = key;
    btn.title = key.replace('style', 'Style ');
    const im = document.createElement('img');
    im.src = list[0] || '';
    im.alt = key;
    im.loading = 'lazy';
    btn.appendChild(im);
    btn.addEventListener('click', () => {
      state.imageStyle = key;
      state.imageStyleIndex = 0;
      state.imageStyleOrder = null;
      styleRow.querySelectorAll('.img-thumb').forEach(b => b.classList.toggle('active', b.dataset.value === key));
      rebuildImgGrid();
      applySelectedImage();
      updateOverlays();
    });
    styleRow.appendChild(btn);
  });
  styleWrap.appendChild(styleRow);
  sec.appendChild(styleWrap);

  // Image thumbnail grid within the chosen style
  const imgWrap = document.createElement('div'); imgWrap.className = 'control-row';
  const imgLbl  = document.createElement('label'); imgLbl.textContent = 'Image';
  imgWrap.appendChild(imgLbl);
  const imgGrid = document.createElement('div'); imgGrid.className = 'img-idx-grid'; imgGrid.id = 'ctrl-img-idx';
  imgWrap.appendChild(imgGrid);
  sec.appendChild(imgWrap);

  function rebuildImgGrid() {
    imgGrid.innerHTML = '';
    const imgs = IMAGE_STYLES[state.imageStyle] || [];
    imgs.forEach((path, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'img-thumb' + (state.imageStyleIndex === i ? ' active' : '');
      btn.dataset.value = String(i);
      btn.title = path.split('/').pop().replace(/\.png$/i, '');
      const im = document.createElement('img'); im.src = path; im.alt = btn.title; im.loading = 'lazy';
      btn.appendChild(im);
      btn.addEventListener('click', () => {
        state.imageStyleIndex = i;
        applySelectedImage();
        imgGrid.querySelectorAll('.img-thumb').forEach(b => b.classList.toggle('active', parseInt(b.dataset.value, 10) === i));
        updateOverlays();
      });
      imgGrid.appendChild(btn);
    });
  }
  rebuildImgGrid();

  // Shuffle button — full width
  const shuffleRow = document.createElement('div'); shuffleRow.className = 'control-row';
  const shuffleBtn = document.createElement('button'); shuffleBtn.className = 'btn small'; shuffleBtn.id = 'btn-shuffle-imgs';
  shuffleBtn.textContent = '⇄ Shuffle Images'; shuffleBtn.style.width = '100%';
  shuffleBtn.addEventListener('click', () => { shuffleStyleImages(); updateImageDistribution(); });
  shuffleRow.appendChild(shuffleBtn); sec.appendChild(shuffleRow);
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
// BUILD GUI
// ══════════════════════════════════════════════════════════════
function buildGUI() {
  const scroll = document.getElementById('panel-scroll');

  // ── Canvas ────────────────────────────────────────────────
  const canvasSec = mkSection('Canvas');
  canvasSec.content.appendChild(mkSegmented({
    id:'ctrl-aspect', label:'Aspect Ratio', key:'aspectRatio',
    options:[
      ['1:1',    ICONS.asp1x1,   '1:1 — Square'],
      ['4:5',    ICONS.asp4x5,   '4:5 — Portrait'],
      ['16:9',   ICONS.asp16x9,  '16:9 — Landscape'],
      ['9:16',   ICONS.asp9x16,  '9:16 — Story'],
      ['1.91:1', ICONS.asp191x1, '1.91:1 — Wide'],
    ],
    onChange: v => { updateAspectLabel(v); if (window._p5Resize) window._p5Resize(); },
  }));
  scroll.appendChild(canvasSec.sec);

  // ── Graphics ─────────────────────────────────────────────
  const graphSec = mkSection('Graphics', 'showGraphics');
  graphSec.content.appendChild(mkSubLabel('Composition Setup', 0));

  const cards    = document.createElement('div'); cards.className = 'comp-cards';
  const cardRect = document.createElement('div'); cardRect.className = 'comp-card' + (state.compositionType==='rectangle'?' active':'');
  cardRect.innerHTML = `<svg viewBox="0 0 24 24"><rect x="5" y="6" width="3" height="12" rx="1"/><rect x="10.5" y="3" width="3" height="15" rx="1"/><rect x="16" y="8" width="3" height="10" rx="1"/></svg><span>Rectangle</span>`;
  const cardCirc = document.createElement('div'); cardCirc.className = 'comp-card' + (state.compositionType==='circular'?' active':'');
  cardCirc.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="6" cy="14" r="3.5"/><circle cx="12" cy="7" r="3.5"/><circle cx="18" cy="11" r="3.5"/></svg><span>Circular</span>`;
  cards.appendChild(cardRect); cards.appendChild(cardCirc);
  graphSec.content.appendChild(cards);

  // Rectangle Group
  const groupRect = document.createElement('div'); groupRect.id = 'group-rect'; groupRect.className = 'ctrl-group' + (state.compositionType==='rectangle'?' active':'');
  groupRect.appendChild(mkSlider({ id:'ctrl-count',    label:'Rectangle Count',    min:2, max:40, step:1,   key:'rectCount' }));
  groupRect.appendChild(mkSlider({ id:'ctrl-spacing',  label:'Item Spacing',        min:0, max:30, step:0.5, key:'spacing', decimals:1 }));
  groupRect.appendChild(mkToggle({ id:'ctrl-symmetry', label:'Symmetry (size)',     key:'symmetry' }));
  groupRect.appendChild(mkToggle({ id:'ctrl-mirror-y', label:'Mirror Axis',         key:'mirrorY'  }));
  groupRect.appendChild(mkSegmented({ id:'ctrl-baseline', label:'Baseline Direction', key:'baseline',
    options:[
      ['bottom', ICONS.baseBottom, 'Bottom — grow upward'],
      ['top',    ICONS.baseTop,    'Top — grow downward'],
      ['left',   ICONS.baseLeft,   'Left — grow rightward'],
      ['right',  ICONS.baseRight,  'Right — grow leftward'],
    ],
  }));

  // Circular Group
  const groupCirc = document.createElement('div'); groupCirc.id = 'group-circ'; groupCirc.className = 'ctrl-group' + (state.compositionType==='circular'?' active':'');
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-count',  label:'Circle Count',    min:2,  max:40,   step:1,  key:'circleCount' }));
  groupCirc.appendChild(mkSlider({ id:'ctrl-diameter',      label:'Max Diameter',    min:50, max:2000, step:10, key:'circleDiameter' }));
  groupCirc.appendChild(mkAnchorGrid({ id:'ctrl-circle-align', label:'Anchor Position', key:'circleAlignment' }));
  groupCirc.appendChild(mkToggle({ id:'ctrl-circle-mirror',      label:'Mirror X & Y Axis',             key:'circleMirrorXY'   }));
  groupCirc.appendChild(mkToggle({ id:'ctrl-circle-flip-anchor', label:'Flip Anchor (smallest at edge)', key:'circleFlipAnchor' }));
  groupCirc.appendChild(mkSubLabel('Text-Aware Positioning'));
  groupCirc.appendChild(mkToggle({
    id:'ctrl-circle-text-link', label:'Link X to Headline', key:'circleTextLink',
    onChange: () => {
      document.getElementById('ctrl-circle-text-padding').closest('.control-row').style.display =
        state.circleTextLink ? '' : 'none';
      redraw();
    },
  }));
  const textPadRow = mkSlider({ id:'ctrl-circle-text-padding', label:'Text Padding', min:0, max:600, step:10, key:'circleTextPadding' });
  textPadRow.style.display = state.circleTextLink ? '' : 'none';
  groupCirc.appendChild(textPadRow);
  groupCirc.appendChild(mkSubLabel('Fine Tune'));
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-sp-x', label:'X Offset', min:-1000, max:1000, step:1, key:'circleSpacingX' }));
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-sp-y', label:'Y Offset', min:-1000, max:1000, step:1, key:'circleSpacingY' }));

  graphSec.content.appendChild(groupRect);
  graphSec.content.appendChild(groupCirc);

  // Curve controls are only relevant for rectangle composition
  const curveWrap = document.createElement('div');
  curveWrap.id = 'curve-controls-wrap';
  curveWrap.style.display = state.compositionType === 'circular' ? 'none' : '';

  curveWrap.appendChild(mkSlider({ id:'ctrl-extent', label:'Stagger/Growth Extent', min:0.05, max:1, step:0.01, key:'extent', decimals:2 }));
  curveWrap.appendChild(mkSegmented({
    id:'ctrl-curve', label:'Curve Distribution', key:'curveType', variant:'grid grid-4',
    options:[
      ['flat',       curveThumbSvg('flat'),       'Flat'],
      ['linear',     curveThumbSvg('linear'),     'Linear'],
      ['quadratic',  curveThumbSvg('quadratic'),  'Quadratic'],
      ['cubic',      curveThumbSvg('cubic'),      'Cubic'],
      ['parabolic',  curveThumbSvg('parabolic'),  'Parabolic — Peak Center'],
      ['hyperbolic', curveThumbSvg('hyperbolic'), 'Hyperbolic'],
      ['bezier',     curveThumbSvg('bezier'),     'Bezier'],
    ],
  }));
  curveWrap.appendChild(mkToggle({ id:'ctrl-flip-curve', label:'Flip Curve Shape', key:'flipCurve' }));

  const cvWrap = document.createElement('div'); cvWrap.className = 'control-row';
  const cvLbl  = document.createElement('label'); cvLbl.textContent = 'Curve Preview';
  const cvCvs  = document.createElement('canvas'); cvCvs.id = 'curve-preview'; cvCvs.width = 260; cvCvs.height = 60;
  cvWrap.appendChild(cvLbl); cvWrap.appendChild(cvCvs);
  curveWrap.appendChild(cvWrap);

  graphSec.content.appendChild(curveWrap);

  const switchType = type => {
    state.compositionType = type;
    cardRect.classList.toggle('active', type==='rectangle');
    cardCirc.classList.toggle('active', type==='circular');
    groupRect.classList.toggle('active', type==='rectangle');
    groupCirc.classList.toggle('active', type==='circular');
    curveWrap.style.display = type === 'circular' ? 'none' : '';
    redraw();
  };
  cardRect.addEventListener('click', () => switchType('rectangle'));
  cardCirc.addEventListener('click', () => switchType('circular'));

  buildGradientSection(graphSec.content);

  // ── Style / Opacity / Blur ─────────────────────────────────
  graphSec.content.appendChild(mkSubLabel('Style'));

  // Background
  graphSec.content.appendChild(mkColor({
    id:'ctrl-bgcolor', label:'Background', key:'bgColor',
    onChange: () => { applyTextAdaptation(); rebuildBgSwatches(); },
  }));
  buildBgPresetsUI(graphSec.content);

  // ─ Global Opacity ABOVE Opacity slider ─────────────────────
  graphSec.content.appendChild(mkToggle({ id:'ctrl-global-op', label:'Global Opacity (Blend Group)', key:'globalOpacity' }));
  graphSec.content.appendChild(mkSlider({
    id:'ctrl-opacity', label:'Opacity', min:0, max:1, step:0.01, key:'opacity', decimals:2,
    onChange: () => { renderGradientBar(); redraw(); },
  }));

  // Blur — scaled to canvas so effect is always visible
  graphSec.content.appendChild(mkSlider({
    id:'ctrl-blur', label:'Blur (inner)', min:0, max:20, step:0.5, key:'blur', decimals:1,
  }));

  // ── Depth & Effects ────────────────────────────────────────
  graphSec.content.appendChild(mkSubLabel('Depth & Effects'));
  graphSec.content.appendChild(mkToggle({
    id: 'ctrl-depth-shadow', label: 'Depth Shadow', key: 'depthShadow',
  }));
  graphSec.content.appendChild(mkSlider({
    id:'ctrl-ds-spread', label:'Shadow Spread', min:0.01, max:1, step:0.01, key:'dsSpread', decimals:2,
  }));
  graphSec.content.appendChild(mkSlider({
    id:'ctrl-ds-opacity', label:'Shadow Opacity', min:0, max:1, step:0.01, key:'dsOpacity', decimals:2,
  }));
  graphSec.content.appendChild(mkToggle({ id:'ctrl-inner-glow', label:'Inner Glow', key:'innerGlow' }));
  graphSec.content.appendChild(mkSlider({
    id:'ctrl-glow-intensity', label:'Glow Intensity', min:0, max:1, step:0.01, key:'innerGlowIntensity', decimals:2,
  }));

  scroll.appendChild(graphSec.sec);

  // ── Headline ─────────────────────────────────────────────
  const hlSec = mkSection('Headline', 'showHeadline');
  hlSec.content.appendChild(mkInput({ id:'ctrl-hl-l1', label:'Line 1', key:'headlineLine1', onChange: updateOverlays }));
  hlSec.content.appendChild(mkInput({ id:'ctrl-hl-l2', label:'Line 2', key:'headlineLine2', onChange: updateOverlays }));
  hlSec.content.appendChild(mkSegmented({ id:'ctrl-hl-font',  label:'Font Type',  key:'headlineFont',  options:[['400','Regular'],['500','Medium'],['700','Bold']], onChange: updateOverlays }));
  hlSec.content.appendChild(mkSegmented({ id:'ctrl-hl-align', label:'Alignment', key:'headlineAlign',
    options:[['left', ICONS.alignLeft, 'Left'],['center', ICONS.alignCenter, 'Center'],['right', ICONS.alignRight, 'Right']],
    onChange: updateOverlays }));
  hlSec.content.appendChild(mkSlider({ id:'ctrl-hl-lh',       label:'Line Height', min:0.5, max:2.5, step:0.05, key:'headlineLineHeight', decimals:2, onChange: updateOverlays }));
  hlSec.content.appendChild(mkSlider({ id:'ctrl-hl-fs',       label:'Font Size',   min:10,  max:300, step:1,    key:'headlineFontSize',   decimals:0, onChange: updateOverlays }));
  hlSec.content.appendChild(mkSlider({ id:'ctrl-hl-y',        label:'Y Position',  min:0,   max:1500,step:1,    key:'headlineYPos',       decimals:0, onChange: updateOverlays }));
  hlSec.content.appendChild(mkSlider({ id:'ctrl-hl-pad',      label:'L/R Padding', min:0,   max:400, step:1,    key:'headlinePadding',    decimals:0, onChange: updateOverlays }));
  scroll.appendChild(hlSec.sec);

  // ── Image Placeholder ────────────────────────────────────
  const imgSec = mkSection('Image Placeholder', 'showImage');

  // Upload
  const fileWrap = document.createElement('div'); fileWrap.className = 'control-row';
  const fileLbl  = document.createElement('label'); fileLbl.textContent = 'Upload Image';
  const fileInp  = document.createElement('input'); fileInp.type = 'file'; fileInp.id = 'ctrl-img-upload'; fileInp.accept = 'image/*'; fileInp.style.width = '100%';
  fileInp.addEventListener('change', e => {
    if (!e.target.files.length) return;
    state.imageSrc = URL.createObjectURL(e.target.files[0]);
    updateOverlays();
  });
  fileWrap.appendChild(fileLbl); fileWrap.appendChild(fileInp);
  imgSec.content.appendChild(fileWrap);

  imgSec.content.appendChild(mkSubLabel('Style Presets', 12));
  buildImagePresetControls(imgSec.content);

  imgSec.content.appendChild(mkSubLabel('Distribution', 12));
  buildImageDistControls(imgSec.content);

  imgSec.content.appendChild(mkSubLabel('Position & Style', 12));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-scale', label:'Scale',          min:0.1, max:2,   step:0.01, key:'imageScale',       decimals:2, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-y',     label:'Y-Axis Offset',  min:-1500,max:1500,step:10,  key:'imageYOffset',     decimals:0, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSegmented({
    id:'ctrl-img-stroke', label:'Stroke Preset', key:'imageStrokeStyle',
    options: [
      ['marketing', `<span class="stroke-sw marketing"></span><span class="seg-caption">Warm</span>`,   'Marketing Warm'],
      ['frosty',    `<span class="stroke-sw frosty"></span><span class="seg-caption">Frosty</span>`, 'Frosty Glass'],
    ],
    onChange: updateOverlays,
  }));
  // Corner radius clamped 0–40
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-rad',   label:'Corner Radius',  min:0, max:40, step:1, key:'imageRadius', decimals:0, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-sop',   label:'Stroke Opacity', min:0, max:1,  step:0.01, key:'imageStrokeOp',    decimals:2, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-sw',    label:'Stroke Weight',  min:0, max:100,step:1,    key:'imageStrokeWeight', decimals:0, onChange: updateOverlays }));
  scroll.appendChild(imgSec.sec);

  // ── Footer ───────────────────────────────────────────────
  const ftSec = mkSection('Footer', 'showFooter');
  ftSec.content.appendChild(mkInput({ id:'ctrl-ft-byline',   label:'Byline',    key:'footerByline', onChange: updateOverlays }));
  ftSec.content.appendChild(mkSegmented({ id:'ctrl-ft-font',   label:'Font Type', key:'footerFont',   options:[['400','Regular'],['500','Medium'],['700','Bold']], onChange: updateOverlays }));
  ftSec.content.appendChild(mkSegmented({ id:'ctrl-ft-align', label:'Alignment', key:'footerAlign',
    options:[['left', ICONS.alignLeft, 'Left'],['center', ICONS.alignCenter, 'Center'],['right', ICONS.alignRight, 'Right']],
    onChange: updateOverlays }));
  scroll.appendChild(ftSec.sec);
}

// ══════════════════════════════════════════════════════════════
// RANDOMIZE
// ══════════════════════════════════════════════════════════════
function randomize() {
  const curves      = ['flat','linear','quadratic','cubic','parabolic','hyperbolic','bezier'];
  const baselines   = ['bottom','top','left','right'];
  const circAligns  = ['top-left','top-center','top-right','center-left','center','center-right','bottom-left','bottom-center','bottom-right'];
  const gradDirs    = ['horizontal','vertical'];
  const palKeys     = Object.keys(PALETTES).filter(k => k !== 'custom');
  const comps       = ['rectangle','circular'];

  state.compositionType   = comps       [Math.floor(Math.random()*comps.length)];
  state.curveType         = curves      [Math.floor(Math.random()*curves.length)];
  state.flipCurve         = Math.random() > 0.5;
  state.baseline          = baselines   [Math.floor(Math.random()*baselines.length)];
  state.circleAlignment   = circAligns  [Math.floor(Math.random()*circAligns.length)];
  state.gradientDirection = gradDirs    [Math.floor(Math.random()*gradDirs.length)];
  state.rectCount         = Math.floor(Math.random()*28)+4;
  state.circleCount       = Math.floor(Math.random()*15)+5;
  state.circleDiameter    = Math.floor(Math.random()*1200)+200;
  state.circleSpacingX    = +(Math.random()>0.7 ? Math.random()*200 : 0).toFixed(0);
  state.circleSpacingY    = +(Math.random()>0.7 ? Math.random()*200 : 0).toFixed(0);
  state.spacing           = 0;
  state.extent            = +(0.4+Math.random()*0.55).toFixed(2);
  state.opacity           = +(0.55+Math.random()*0.40).toFixed(2);
  state.blur              = Math.random()<0.35 ? +(Math.random()*10).toFixed(1) : 0;
  state.symmetry          = Math.random() > 0.25;
  state.mirrorY           = Math.random() > 0.5;
  state.circleMirrorXY    = Math.random() > 0.5;
  state.innerGlow         = Math.random() > 0.5;
  state.innerGlowIntensity = +(0.3+Math.random()*0.65).toFixed(2);

  // Pick palette and auto-apply matching bg
  state.palette = palKeys[Math.floor(Math.random()*palKeys.length)];
  applyPalette(state.palette);

  // Pick a bg from the matching tone palette
  const bgs    = getActiveBgPresets();
  state.bgColor = bgs[Math.floor(Math.random()*bgs.length)].color;

  // Auto-adapt stroke based on tone
  state.imageStrokeStyle = (getPaletteTone() === 'cool') ? 'frosty' : 'marketing';

  document.querySelectorAll('.comp-card').forEach(c => {
    c.classList.toggle('active', c.querySelector('span').textContent.toLowerCase() === state.compositionType);
  });
  const groupRect = document.getElementById('group-rect');
  const groupCirc = document.getElementById('group-circ');
  if (groupRect && groupCirc) {
    groupRect.classList.toggle('active', state.compositionType==='rectangle');
    groupCirc.classList.toggle('active', state.compositionType==='circular');
  }
  const curveEl = document.getElementById('curve-controls-wrap');
  if (curveEl) curveEl.style.display = state.compositionType === 'circular' ? 'none' : '';

  rebuildBgSwatches();
  syncControlsToState();
  updateOverlays();
  renderStopList();
}

function syncControlsToState() {
  // Sliders with numeric display
  [
    ['ctrl-count',             'rectCount',          0],
    ['ctrl-circle-count',      'circleCount',         0],
    ['ctrl-diameter',          'circleDiameter',      0],
    ['ctrl-circle-sp-x',       'circleSpacingX',      0],
    ['ctrl-circle-sp-y',       'circleSpacingY',      0],
    ['ctrl-circle-text-padding','circleTextPadding',  0],
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
  ].forEach(([id, key, dec]) => {
    const el = document.getElementById(id); if (!el) return;
    el.value = state[key];
    const b  = el.closest('.control-row')?.querySelector('.val');
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
    ['ctrl-aspect',       'aspectRatio'],
    ['ctrl-baseline',     'baseline'],
    ['ctrl-curve',        'curveType'],
    ['ctrl-grad-dir',     'gradientDirection'],
    ['ctrl-hl-align',     'headlineAlign'],
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

  // Color
  const bg = document.getElementById('ctrl-bgcolor'); if (bg) bg.value = state.bgColor;

  // Checkboxes
  [
    ['ctrl-symmetry',          'symmetry'],
    ['ctrl-mirror-y',          'mirrorY'],
    ['ctrl-flip-curve',        'flipCurve'],
    ['ctrl-circle-mirror',     'circleMirrorXY'],
    ['ctrl-circle-flip-anchor','circleFlipAnchor'],
    ['ctrl-circle-text-link',  'circleTextLink'],
    ['ctrl-global-op',         'globalOpacity'],
    ['ctrl-depth-shadow',      'depthShadow'],
    ['ctrl-inner-glow',        'innerGlow'],
    ['ctrl-img-multi',         'imageMulti'],
  ].forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.checked = state[key]; });

  updateAspectLabel(state.aspectRatio);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildGUI();
  updateAspectLabel(state.aspectRatio);
  renderGradientBar();
  renderStopList();
  renderCurvePreview();
  updateOverlays();

  // Clicking the image placeholder on the canvas opens the file picker
  const overlayImg = document.getElementById('overlay-image');
  if (overlayImg) {
    overlayImg.addEventListener('click', () => {
      const up = document.getElementById('ctrl-img-upload');
      if (up) up.click();
    });
  }

  // Inline-editable headlines on the canvas, kept in sync with panel inputs
  [
    { el: 'headline-l1', stateKey: 'headlineLine1', inputId: 'ctrl-hl-l1' },
    { el: 'headline-l2', stateKey: 'headlineLine2', inputId: 'ctrl-hl-l2' },
  ].forEach(({ el, stateKey, inputId }) => {
    const node = document.getElementById(el);
    if (!node) return;
    node.contentEditable = 'true';
    node.spellcheck = false;
    node.addEventListener('input', () => {
      state[stateKey] = node.textContent;
      const inp = document.getElementById(inputId);
      if (inp) inp.value = state[stateKey];
    });
    node.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
    });
  });

  // Export — delegates to sketch.js _exportCanvas
  document.getElementById('btn-export').addEventListener('click', () => {
    if (window._exportCanvas) window._exportCanvas();
  });

  document.getElementById('btn-random').addEventListener('click', randomize);
});
