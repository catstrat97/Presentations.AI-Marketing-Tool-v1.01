// ── gui/controls.js ───────────────────────────────────────────
// Stateless DOM control factories and shared visual helpers:
// mk* row builders, the icon library, aspect-ratio labels, curve
// thumbnail SVG generator, gradient bar / curve preview renderers,
// gradient-stop list + palette-mode enforcement, and the central
// `redraw()` trigger that the rest of the GUI calls.

import {
  state,
  PALETTES,
  hexToRgb,
  getCurveValue,
  getColorLuma,
} from '../shared.js';

// ── Redraw trigger ────────────────────────────────────────────
// Single entrypoint: runs the p5 sketch + the gradient bar + the
// curve preview. Other modules import this when they want a redraw.
export function redraw() {
  if (window._p5Redraw) window._p5Redraw();
  renderGradientBar();
  renderCurvePreview();
}

// ══════════════════════════════════════════════════════════════
// GRADIENT BAR
// ══════════════════════════════════════════════════════════════
export function renderGradientBar() {
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
export function enforceSymmetrical() {
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
export function enforceSync() {
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
export function shuffleGradient() {
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
export function renderStopList() {
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

export function syncPaletteSelect() {
  const row = document.getElementById('ctrl-palette');
  if (!row) return;
  row.querySelectorAll('.palette-sw').forEach(s => s.classList.toggle('active', s.dataset.value === state.palette));
}

// ══════════════════════════════════════════════════════════════
// CURVE PREVIEW
// ══════════════════════════════════════════════════════════════
export function renderCurvePreview() {
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
export function _setSliderFill(input) {
  const mn  = parseFloat(input.min)   || 0;
  const mx  = parseFloat(input.max)   || 1;
  const val = parseFloat(input.value) || 0;
  const pct = Math.max(0, Math.min(100, (val - mn) / (mx - mn) * 100)).toFixed(1);
  const wrap = input.closest('.slider-row');
  if (wrap) wrap.style.setProperty('--fill', pct + '%');
}

export function mkSlider({ id, label, min, max, step, key, decimals=0, onChange }) {
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

export function mkSelect({ id, label, options, key, onChange }) {
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

export function mkColor({ id, label, key, onChange }) {
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

export function mkToggle({ id, label, key, onChange }) {
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
export function mkSegmented({ id, label, key, options, onChange, variant }) {
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
export const ICONS = {
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
export function updateAspectLabel(value) {
  const seg = document.getElementById('ctrl-aspect');
  const lbl = seg && seg.closest('.control-row')?.querySelector('label');
  if (lbl) lbl.textContent = ASPECT_LABELS[value] || 'Aspect Ratio';
}

// Generate a tiny SVG preview of a curve type using getCurveValue
export function curveThumbSvg(type) {
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
export function mkAnchorGrid({ id, label, key, onChange }) {
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

export function mkInput({ id, label, key, onChange }) {
  const wrap = document.createElement('div'); wrap.className = 'control-row';
  const lbl  = document.createElement('label'); lbl.htmlFor = id; lbl.textContent = label;
  const inp  = document.createElement('input'); inp.type = 'text'; inp.id = id; inp.value = state[key]; inp.className = 'text-input';
  inp.addEventListener('input', () => { state[key] = inp.value; if (onChange) onChange(state[key]); });
  wrap.appendChild(lbl); wrap.appendChild(inp);
  return wrap;
}

export function mkTextarea({ id, label, key, rows = 3, onChange }) {
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

// `mkSection` is referenced by the legacy buildColorThemeSection (now
// dead but kept compileable for external callers). It returns a header
// + content pair plus an optional toggle that flips a state key.
// `updateOverlays` is required at call time, so import lazily.
export function mkSection(labelText, toggleKey = null) {
  const sec    = document.createElement('div'); sec.className = 'section';
  if (toggleKey) sec.classList.add('collapsible');
  const header = document.createElement('div'); header.className = 'section-header';
  const lbl    = document.createElement('div'); lbl.className = 'section-label'; lbl.textContent = labelText;
  header.appendChild(lbl);

  if (toggleKey) {
    const tg  = document.createElement('label'); tg.className = 'toggle small-tog';
    const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = state[toggleKey];
    inp.addEventListener('change', e => {
      e.stopPropagation();
      state[toggleKey] = inp.checked;
      // Lazy import to keep this module side-effect-free at load time.
      import('./overlays.js').then(m => m.updateOverlays());
    });
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
export function mkSubLabel(text, mt = 16) {
  const el = document.createElement('div');
  el.className = 'section-label sub';
  el.textContent = text;
  el.style.marginTop = mt + 'px';
  return el;
}
