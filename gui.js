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
  const el = document.getElementById('ctrl-palette');
  if (el) el.value = state.palette;
}

// ══════════════════════════════════════════════════════════════
// GRADIENT SECTION
// ══════════════════════════════════════════════════════════════
function buildGradientSection(sec) {
  // Palette select — only Warm / Cool / Custom
  const palWrap = document.createElement('div'); palWrap.className = 'control-row';
  const palLabel = document.createElement('label'); palLabel.htmlFor = 'ctrl-palette'; palLabel.textContent = 'Palette';
  const palSel = document.createElement('select'); palSel.id = 'ctrl-palette';

  const customOpt = document.createElement('option'); customOpt.value = 'custom'; customOpt.textContent = 'Custom';
  palSel.appendChild(customOpt);
  Object.entries(PALETTES).forEach(([key, p]) => {
    if (key === 'custom') return;
    const opt = document.createElement('option'); opt.value = key; opt.textContent = p.label;
    palSel.appendChild(opt);
  });
  palSel.value = state.palette;
  palSel.addEventListener('change', () => {
    state.palette = palSel.value;
    if (state.palette !== 'custom') applyPalette(state.palette);
    // Auto-set stroke style based on tone
    const tone = getPaletteTone();
    state.imageStrokeStyle = (tone === 'cool') ? 'frosty' : 'marketing';
    rebuildBgSwatches();
    updateOverlays();
    renderStopList();
  });
  palWrap.appendChild(palLabel); palWrap.appendChild(palSel);
  sec.appendChild(palWrap);

  sec.appendChild(mkSelect({
    id: 'ctrl-grad-dir', label: 'Direction', key: 'gradientDirection',
    options: [
      ['horizontal', 'Horizontal — sweeps left → right'],
      ['vertical',   'Vertical — sweeps top → bottom'],
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
  // Style dropdown
  const styleWrap = document.createElement('div'); styleWrap.className = 'control-row';
  const styleLbl  = document.createElement('label'); styleLbl.htmlFor = 'ctrl-img-style'; styleLbl.textContent = 'Select Style';
  const styleSel  = document.createElement('select'); styleSel.id = 'ctrl-img-style';
  Object.keys(IMAGE_STYLES).forEach(key => {
    const opt = document.createElement('option'); opt.value = key; opt.textContent = key.replace('style', 'Style ');
    if (state.imageStyle === key) opt.selected = true;
    styleSel.appendChild(opt);
  });
  styleWrap.appendChild(styleLbl); styleWrap.appendChild(styleSel);
  sec.appendChild(styleWrap);

  // Image within style
  const imgWrap = document.createElement('div'); imgWrap.className = 'control-row';
  const imgLbl  = document.createElement('label'); imgLbl.htmlFor = 'ctrl-img-idx'; imgLbl.textContent = 'Select Image';
  const imgSel  = document.createElement('select'); imgSel.id = 'ctrl-img-idx';
  imgWrap.appendChild(imgLbl); imgWrap.appendChild(imgSel);

  function rebuildImgSel() {
    imgSel.innerHTML = '';
    const imgs = IMAGE_STYLES[state.imageStyle] || [];
    imgs.forEach((path, i) => {
      const opt = document.createElement('option'); opt.value = i;
      opt.textContent = path.split('/').pop().replace(/\.png$/i, '');
      if (state.imageStyleIndex === i) opt.selected = true;
      imgSel.appendChild(opt);
    });
  }
  rebuildImgSel();
  sec.appendChild(imgWrap);

  // Shuffle button
  const shuffleRow = document.createElement('div'); shuffleRow.className = 'control-row';
  const shuffleBtn = document.createElement('button'); shuffleBtn.className = 'btn small'; shuffleBtn.id = 'btn-shuffle-imgs';
  shuffleBtn.textContent = '⇄ Shuffle Images'; shuffleBtn.style.width = '100%';
  shuffleBtn.addEventListener('click', () => { shuffleStyleImages(); updateImageDistribution(); });
  shuffleRow.appendChild(shuffleBtn); sec.appendChild(shuffleRow);

  styleSel.addEventListener('change', () => {
    state.imageStyle = styleSel.value; state.imageStyleIndex = 0; state.imageStyleOrder = null;
    rebuildImgSel(); applySelectedImage(); updateOverlays();
  });
  imgSel.addEventListener('change', () => {
    const idx = parseInt(imgSel.value, 10);
    if (idx >= 0) { state.imageStyleIndex = idx; applySelectedImage(); }
    updateOverlays();
  });
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

  const modeWrap = document.createElement('div'); modeWrap.className = 'control-row';
  const modeLbl  = document.createElement('label'); modeLbl.textContent = 'Distribution Mode';
  const modeSel  = document.createElement('select'); modeSel.id = 'ctrl-img-dist-mode';
  [['horizontal','Horizontal'],['point','Point / Stagger']].forEach(([v,t]) => {
    const o = document.createElement('option'); o.value = v; o.textContent = t;
    if (state.imageDistMode === v) o.selected = true; modeSel.appendChild(o);
  });
  modeSel.addEventListener('change', () => { state.imageDistMode = modeSel.value; updateOverlays(); });
  modeWrap.appendChild(modeLbl); modeWrap.appendChild(modeSel);
  multiGroup.appendChild(modeWrap);

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
  canvasSec.content.appendChild(mkSelect({
    id:'ctrl-aspect', label:'Aspect Ratio', key:'aspectRatio',
    options:[['1:1','1:1 — Square'],['4:5','4:5 — Portrait'],['16:9','16:9 — Landscape'],['9:16','9:16 — Story'],['1.91:1','1.91:1 — Wide']],
    onChange: () => { if (window._p5Resize) window._p5Resize(); },
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
  groupRect.appendChild(mkSelect({ id:'ctrl-baseline', label:'Baseline Direction',  key:'baseline',
    options:[['bottom','↑ Bottom'],['top','↓ Top'],['left','→ Left'],['right','← Right']] }));

  // Circular Group
  const groupCirc = document.createElement('div'); groupCirc.id = 'group-circ'; groupCirc.className = 'ctrl-group' + (state.compositionType==='circular'?' active':'');
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-count',  label:'Circle Count',     min:2,  max:40,   step:1,  key:'circleCount' }));
  groupCirc.appendChild(mkSlider({ id:'ctrl-diameter',      label:'Max Diameter',      min:50, max:2000, step:10, key:'circleDiameter' }));
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-sp-x',   label:'X Center Offset',  min:0,  max:1000, step:1,  key:'circleSpacingX' }));
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-sp-y',   label:'Y Center Offset',  min:0,  max:1000, step:1,  key:'circleSpacingY' }));
  groupCirc.appendChild(mkSelect({ id:'ctrl-circle-align',  label:'Anchor Position',  key:'circleAlignment',
    options:[['top-left','↖ Top Left'],['top-center','↑ Top Center'],['top-right','↗ Top Right'],
             ['center-left','← Center Left'],['center','⇿ Center'],['center-right','→ Center Right'],
             ['bottom-left','↙ Bottom Left'],['bottom-center','↓ Bottom Center'],['bottom-right','↘ Bottom Right']] }));
  groupCirc.appendChild(mkToggle({ id:'ctrl-circle-mirror', label:'Mirror X & Y Axis', key:'circleMirrorXY' }));

  graphSec.content.appendChild(groupRect);
  graphSec.content.appendChild(groupCirc);

  const switchType = type => {
    state.compositionType = type;
    cardRect.classList.toggle('active', type==='rectangle');
    cardCirc.classList.toggle('active', type==='circular');
    groupRect.classList.toggle('active', type==='rectangle');
    groupCirc.classList.toggle('active', type==='circular');
    redraw();
  };
  cardRect.addEventListener('click', () => switchType('rectangle'));
  cardCirc.addEventListener('click', () => switchType('circular'));

  // Shared
  graphSec.content.appendChild(mkSlider({ id:'ctrl-extent',    label:'Stagger/Growth Extent', min:0.05, max:1, step:0.01, key:'extent', decimals:2 }));
  graphSec.content.appendChild(mkSelect({ id:'ctrl-curve',     label:'Curve Distribution',    key:'curveType',
    options:[['flat','Flat'],['linear','Linear'],['quadratic','Quadratic'],['cubic','Cubic'],
             ['parabolic','Parabolic — Peak Center'],['hyperbolic','Hyperbolic'],['bezier','Bezier']] }));
  graphSec.content.appendChild(mkToggle({ id:'ctrl-flip-curve', label:'Flip Curve Shape', key:'flipCurve' }));

  const cvWrap = document.createElement('div'); cvWrap.className = 'control-row';
  const cvLbl  = document.createElement('label'); cvLbl.textContent = 'Curve Preview';
  const cvCvs  = document.createElement('canvas'); cvCvs.id = 'curve-preview'; cvCvs.width = 260; cvCvs.height = 60;
  cvWrap.appendChild(cvLbl); cvWrap.appendChild(cvCvs);
  graphSec.content.appendChild(cvWrap);

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

  // ── Inner Glow ─────────────────────────────────────────────
  graphSec.content.appendChild(mkSubLabel('Inner Glow'));
  graphSec.content.appendChild(mkToggle({ id:'ctrl-inner-glow', label:'Enable Inner Glow', key:'innerGlow' }));
  // Only intensity — spread removed
  graphSec.content.appendChild(mkSlider({
    id:'ctrl-glow-intensity', label:'Glow Intensity', min:0, max:1, step:0.01, key:'innerGlowIntensity', decimals:2,
  }));

  scroll.appendChild(graphSec.sec);

  // ── Headline ─────────────────────────────────────────────
  const hlSec = mkSection('Headline', 'showHeadline');
  hlSec.content.appendChild(mkInput({ id:'ctrl-hl-l1', label:'Line 1', key:'headlineLine1', onChange: updateOverlays }));
  hlSec.content.appendChild(mkInput({ id:'ctrl-hl-l2', label:'Line 2', key:'headlineLine2', onChange: updateOverlays }));
  hlSec.content.appendChild(mkSelect({ id:'ctrl-hl-font',  label:'Font Type',  key:'headlineFont',  options:[['400','Reg'],['500','Med'],['700','Bold']], onChange: updateOverlays }));
  hlSec.content.appendChild(mkSelect({ id:'ctrl-hl-align', label:'Alignment',  key:'headlineAlign', options:[['left','Left'],['center','Center'],['right','Right']], onChange: updateOverlays }));
  hlSec.content.appendChild(mkSlider({ id:'ctrl-hl-tracking', label:'Tracking',    min:-20, max:20,  step:0.1,  key:'headlineTracking',  decimals:1, onChange: updateOverlays }));
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
  imgSec.content.appendChild(mkSelect({ id:'ctrl-img-stroke',label:'Stroke Preset',  key:'imageStrokeStyle', options:[['marketing','Marketing Warm'],['frosty','Frosty Glass']], onChange: updateOverlays }));
  // Corner radius clamped 0–40
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-rad',   label:'Corner Radius',  min:0, max:40, step:1, key:'imageRadius', decimals:0, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-sop',   label:'Stroke Opacity', min:0, max:1,  step:0.01, key:'imageStrokeOp',    decimals:2, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-sw',    label:'Stroke Weight',  min:0, max:100,step:1,    key:'imageStrokeWeight', decimals:0, onChange: updateOverlays }));
  scroll.appendChild(imgSec.sec);

  // ── Footer ───────────────────────────────────────────────
  const ftSec = mkSection('Footer', 'showFooter');
  ftSec.content.appendChild(mkInput({ id:'ctrl-ft-byline',   label:'Byline',    key:'footerByline', onChange: updateOverlays }));
  ftSec.content.appendChild(mkSelect({ id:'ctrl-ft-font',   label:'Font Type', key:'footerFont',   options:[['400','Reg'],['500','Med'],['700','Bold']], onChange: updateOverlays }));
  ftSec.content.appendChild(mkSelect({ id:'ctrl-ft-align',  label:'Alignment', key:'footerAlign',  options:[['left','Left'],['center','Center'],['right','Right']], onChange: updateOverlays }));
  ftSec.content.appendChild(mkSlider({ id:'ctrl-ft-tracking',label:'Tracking',  min:-10, max:20, step:0.1, key:'footerTracking', decimals:1, onChange: updateOverlays }));
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

  rebuildBgSwatches();
  syncControlsToState();
  updateOverlays();
  renderStopList();
}

function syncControlsToState() {
  // Sliders with numeric display
  [
    ['ctrl-count',        'rectCount',         0],
    ['ctrl-circle-count', 'circleCount',        0],
    ['ctrl-diameter',     'circleDiameter',     0],
    ['ctrl-circle-sp-x',  'circleSpacingX',     0],
    ['ctrl-circle-sp-y',  'circleSpacingY',     0],
    ['ctrl-spacing',      'spacing',            1],
    ['ctrl-extent',       'extent',             2],
    ['ctrl-opacity',      'opacity',            2],
    ['ctrl-blur',         'blur',               1],
    ['ctrl-glow-intensity','innerGlowIntensity',2],
    ['ctrl-hl-y',         'headlineYPos',       0],
    ['ctrl-hl-pad',       'headlinePadding',    0],
    ['ctrl-img-rad',      'imageRadius',        0],
    ['ctrl-img-count',    'imageMultiCount',    0],
    ['ctrl-img-multi-spacing','imageMultiSpacing',0],
  ].forEach(([id, key, dec]) => {
    const el = document.getElementById(id); if (!el) return;
    el.value = state[key];
    const b  = el.closest('.control-row')?.querySelector('.val');
    if (b) b.textContent = (+state[key]).toFixed(dec);
  });

  // Selects
  [
    ['ctrl-curve',       'curveType'],
    ['ctrl-aspect',      'aspectRatio'],
    ['ctrl-baseline',    'baseline'],
    ['ctrl-circle-align','circleAlignment'],
    ['ctrl-grad-dir',    'gradientDirection'],
    ['ctrl-palette',     'palette'],
    ['ctrl-img-style',   'imageStyle'],
    ['ctrl-img-dist-mode','imageDistMode'],
    ['ctrl-img-stroke',  'imageStrokeStyle'],
  ].forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.value = state[key]; });

  // Color
  const bg = document.getElementById('ctrl-bgcolor'); if (bg) bg.value = state.bgColor;

  // Checkboxes
  [
    ['ctrl-symmetry',    'symmetry'],
    ['ctrl-mirror-y',    'mirrorY'],
    ['ctrl-flip-curve',  'flipCurve'],
    ['ctrl-circle-mirror','circleMirrorXY'],
    ['ctrl-global-op',   'globalOpacity'],
    ['ctrl-inner-glow',  'innerGlow'],
    ['ctrl-img-multi',   'imageMulti'],
  ].forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.checked = state[key]; });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildGUI();
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
