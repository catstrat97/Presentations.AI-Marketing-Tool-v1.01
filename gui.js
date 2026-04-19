// ── gui.js ────────────────────────────────────────────────────
// Vanilla JS control panel.
// Depends on: shared.js (state, getCurveValue, sampleGradient,
//             hslToHex, hexToRgb, addGradientStop,
//             subdivideGradient, rgbToHex, PALETTES, applyPalette)

// ── Redraw trigger ────────────────────────────────────────────
function redraw() {
  if (window._p5Redraw) window._p5Redraw();
  renderGradientBar();
  renderCurvePreview();
}

function updateOverlays() {
  const h1 = document.getElementById('headline-l1');
  const h2 = document.getElementById('headline-l2');
  const overlayHead = document.getElementById('overlay-headline');
  const overlayImg = document.getElementById('overlay-image');
  const overlayFoot = document.getElementById('overlay-footer');
  const imgElem = document.getElementById('uploaded-image');
  const iconElem = document.getElementById('placeholder-icon');
  const byline = document.getElementById('footer-byline');
  
  if(h1 && h2 && overlayHead) {
    h1.textContent = state.headlineLine1;
    h2.textContent = state.headlineLine2;
    overlayHead.style.textAlign = state.headlineAlign;
    h1.style.letterSpacing = `calc(${state.headlineTracking}px * var(--scale))`;
    h2.style.letterSpacing = `calc(${state.headlineTracking}px * var(--scale))`;
    h1.style.lineHeight = state.headlineLineHeight;
    h2.style.lineHeight = state.headlineLineHeight;
    h1.style.fontSize = `calc(${state.headlineFontSize}px * var(--scale))`;
    h2.style.fontSize = `calc(${state.headlineFontSize}px * var(--scale))`;
    h1.style.fontWeight = state.headlineFont;
    h2.style.fontWeight = state.headlineFont;
    overlayHead.style.display = state.showHeadline ? 'flex' : 'none';
  }
  
  if(overlayImg && imgElem && iconElem) {
    if (state.imageSrc) {
      imgElem.src = state.imageSrc;
      imgElem.style.display = 'block';
      iconElem.style.display = 'none';
    } else {
      imgElem.style.display = 'none';
      iconElem.style.display = 'block';
    }
    
    // Stroke style
    const op = state.imageStrokeOp;
    let strokeColor = `rgba(104, 58, 39, ${op})`; // marketing
    if (state.imageStrokeStyle === 'frosty') {
       strokeColor = `rgba(220, 235, 255, ${op})`;
       overlayImg.style.backdropFilter = op > 0 ? "blur(4px)" : "none";
    } else {
       overlayImg.style.backdropFilter = "none";
    }
    overlayImg.style.borderColor = strokeColor;
    overlayImg.style.borderWidth = `calc(${state.imageStrokeWeight}px * var(--scale))`;
    overlayImg.style.borderRadius = `calc(${state.imageRadius}px * var(--scale))`;

    // Scale and Y-offset
    overlayImg.style.transform = `translateX(-50%) translateY(calc(${state.imageYOffset}px * var(--scale))) scale(${state.imageScale})`;
    
    overlayImg.style.display = state.showImage ? 'flex' : 'none';
  }
  
  if (overlayFoot && byline) {
    byline.textContent = state.footerByline;
    byline.style.textAlign = state.footerAlign;
    byline.style.letterSpacing = `calc(${state.footerTracking}px * var(--scale))`;
    byline.style.fontWeight = state.footerFont;
    overlayFoot.style.display = state.showFooter ? 'flex' : 'none';
  }
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

  // Checkerboard BG
  const sq = 8;
  for (let y = 0; y < H; y += sq)
    for (let x = 0; x < W; x += sq) {
      ctx.fillStyle = ((x/sq + y/sq) % 2 === 0) ? '#2a2a30' : '#1a1a20';
      ctx.fillRect(x, y, sq, sq);
    }

  if (state.gradientStops.length) {
    const sorted = [...state.gradientStops].sort((a,b)=>a.stop-b.stop);
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    sorted.forEach(s => {
      const [r,g,b] = hexToRgb(s.color);
      grad.addColorStop(s.stop, `rgba(${r},${g},${b},${state.opacity})`);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W-1, H-1);

  // Markers
  const markers = document.getElementById('grad-markers');
  if (markers) {
    markers.innerHTML = '';
    [...state.gradientStops].sort((a,b)=>a.stop-b.stop).forEach(s => {
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
// Color picker fix: NEVER call renderStopList() inside `input` events.
// Only update the specific element in-place to avoid destroying the DOM
// (which closes the native color picker dialog immediately).
// renderStopList() is only called on `change` (picker fully closed) or
// after add/delete/palette operations.
// ══════════════════════════════════════════════════════════════
function renderStopList() {
  const list = document.getElementById('grad-stops-list');
  if (!list) return;
  list.innerHTML = '';

  [...state.gradientStops].sort((a,b)=>a.stop-b.stop).forEach(stop => {
    const row = document.createElement('div');
    row.className = 'stop-row';

    // ── Color input ─────────────────────────────────────────
    // Do NOT wrap in <label> — direct input click avoids
    // focus/event conflicts that immediately close the picker.
    const colorInput = document.createElement('input');
    colorInput.type      = 'color';
    colorInput.value     = stop.color;
    colorInput.className = 'stop-color-input';
    colorInput.title     = 'Pick color';

    colorInput.addEventListener('input', () => {
      // Update state. DO NOT call renderStopList() here — that would
      // destroy this DOM node and close the native color picker.
      const idx = state.gradientStops.findIndex(s => s === stop);
      if (idx >= 0) {
        state.gradientStops[idx].color = colorInput.value;
        stop.color = colorInput.value;
      }
      // Only redraw canvas + gradient bar, NOT the stop list DOM
      if (window._p5Redraw) window._p5Redraw();
      renderGradientBar();
    });

    colorInput.addEventListener('change', () => {
      // Picker fully closed — safe to rebuild stop list now
      renderStopList();
    });

    // ── Position slider ──────────────────────────────────────
    const posWrap   = document.createElement('div');
    posWrap.className = 'stop-pos-wrap';
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
    posWrap.appendChild(posSlider);
    posWrap.appendChild(posVal);

    // ── Delete button ────────────────────────────────────────
    const del = document.createElement('button');
    del.className = 'stop-delete';
    del.title     = 'Remove stop';
    del.disabled  = state.gradientStops.length <= 2;
    del.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    del.addEventListener('click', () => {
      const idx = state.gradientStops.findIndex(s => s === stop);
      if (idx >= 0 && state.gradientStops.length > 2) {
        state.gradientStops.splice(idx, 1);
        state.palette = 'custom';
        syncPaletteSelect();
        redraw(); renderStopList();
      }
    });

    row.appendChild(colorInput);
    row.appendChild(posWrap);
    row.appendChild(del);
    list.appendChild(row);
  });
}

// ── Sync palette select to 'custom' ──────────────────────────
function syncPaletteSelect() {
  const el = document.getElementById('ctrl-palette');
  if (el) el.value = state.palette;
}

// ══════════════════════════════════════════════════════════════
// GRADIENT SECTION
// ══════════════════════════════════════════════════════════════
function buildGradientSection(sec) {
  // Palette select
  const palWrap = document.createElement('div');
  palWrap.className = 'control-row';
  const palLabel = document.createElement('label');
  palLabel.htmlFor = 'ctrl-palette';
  palLabel.textContent = 'Palette';
  const palSel = document.createElement('select');
  palSel.id = 'ctrl-palette';

  // "Custom" always first
  const customOpt = document.createElement('option');
  customOpt.value = 'custom'; customOpt.textContent = 'Custom';
  palSel.appendChild(customOpt);
  Object.entries(PALETTES).forEach(([key, p]) => {
    if (key === 'custom') return;
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = p.label;
    palSel.appendChild(opt);
  });
  palSel.value = state.palette;
  palSel.addEventListener('change', () => {
    state.palette = palSel.value;
    if (state.palette !== 'custom') applyPalette(state.palette);
    redraw(); renderStopList();
  });
  palWrap.appendChild(palLabel); palWrap.appendChild(palSel);
  sec.appendChild(palWrap);

  // Gradient direction
  sec.appendChild(mkSelect({
    id: 'ctrl-grad-dir', label: 'Direction', key: 'gradientDirection',
    options: [
      ['horizontal', 'Horizontal — sweeps left → right'],
      ['vertical',   'Vertical — sweeps top → bottom'],
    ],
  }));

  // Gradient bar + markers
  const barOuter = document.createElement('div');
  barOuter.className = 'grad-bar-outer';
  const bar = document.createElement('canvas');
  bar.id = 'grad-bar'; bar.width = 260; bar.height = 28;
  const markers = document.createElement('div');
  markers.id = 'grad-markers'; markers.className = 'grad-markers';
  barOuter.appendChild(bar); barOuter.appendChild(markers);
  sec.appendChild(barOuter);

  // Stop list
  const stopList = document.createElement('div');
  stopList.id = 'grad-stops-list'; stopList.className = 'grad-stops-list';
  sec.appendChild(stopList);

  // Actions: Add Stop + Subdivide
  const actions = document.createElement('div');
  actions.className = 'grad-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn small'; addBtn.id = 'btn-add-stop';
  addBtn.textContent = '+ Add Stop';
  addBtn.addEventListener('click', () => {
    addGradientStop(0.5);
    state.palette = 'custom'; syncPaletteSelect();
    redraw(); renderStopList();
  });

  const subDiv = document.createElement('div');
  subDiv.className = 'subdivide-ctrl';
  const subLabel = document.createElement('span');
  subLabel.textContent = 'Subdivide';
  const subN = document.createElement('input');
  subN.type = 'number'; subN.id = 'subdivide-n'; subN.min = '1'; subN.max = '8';
  subN.value = '2'; subN.className = 'subdivide-input';
  const subBtn = document.createElement('button');
  subBtn.className = 'btn small'; subBtn.textContent = 'Apply';
  subBtn.addEventListener('click', () => {
    subdivideGradient(Math.max(1, Math.min(8, parseInt(subN.value,10)||2)));
    state.palette = 'custom'; syncPaletteSelect();
    redraw(); renderStopList();
  });
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
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  [1,2,3].forEach(i=>{
    ctx.beginPath(); ctx.moveTo(W*i/4,0); ctx.lineTo(W*i/4,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,H*i/4); ctx.lineTo(W,H*i/4); ctx.stroke();
  });
  const lg=ctx.createLinearGradient(0,0,W,0);
  lg.addColorStop(0,'rgba(124,106,247,0.3)');
  lg.addColorStop(0.5,'rgba(124,106,247,1)');
  lg.addColorStop(1,'rgba(124,106,247,0.3)');
  ctx.strokeStyle=lg; ctx.lineWidth=2; ctx.beginPath();
  const S=120;
  for(let i=0;i<=S;i++){
    const t=i/S;
    
    // For preview, we match the currently selected mode's logic to some extent
    let tC = t;
    if (state.compositionType === 'rectangle' && state.symmetry) {
      tC = 1 - Math.abs(2*t - 1);
    }
    
    let v=getCurveValue(Math.max(0,Math.min(1,tC)),state.curveType);
    if (state.flipCurve) v = 1 - v;
    
    i===0?ctx.moveTo(t*W,H-v*H*0.84-H*0.08):ctx.lineTo(t*W,H-v*H*0.84-H*0.08);
  }
  ctx.stroke();
  const fg=ctx.createLinearGradient(0,0,0,H);
  fg.addColorStop(0,'rgba(124,106,247,0.15)'); fg.addColorStop(1,'rgba(124,106,247,0)');
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
  ctx.fillStyle=fg; ctx.fill();
}

// ══════════════════════════════════════════════════════════════
// CONTROL FACTORIES
// ══════════════════════════════════════════════════════════════
function mkSlider({ id, label, min, max, step, key, decimals=0, onChange }) {
  const wrap=document.createElement('div'); wrap.className='control-row';
  const lbl=document.createElement('label'); lbl.htmlFor=id;
  lbl.appendChild(document.createTextNode(label));
  const val=document.createElement('span'); val.className='val';
  val.textContent=(+state[key]).toFixed(decimals); lbl.appendChild(val);
  const input=document.createElement('input');
  input.type='range'; input.id=id; input.min=min; input.max=max;
  input.step=step; input.value=state[key];
  input.addEventListener('input',()=>{
    state[key]=parseFloat(input.value);
    val.textContent=state[key].toFixed(decimals);
    if(onChange) { onChange(state[key]); } else { redraw(); }
  });
  wrap.appendChild(lbl); wrap.appendChild(input);
  return wrap;
}

function mkSelect({ id, label, options, key, onChange }) {
  const wrap=document.createElement('div'); wrap.className='control-row';
  const lbl=document.createElement('label'); lbl.htmlFor=id; lbl.textContent=label;
  const sel=document.createElement('select'); sel.id=id;
  options.forEach(([value,text])=>{
    const opt=document.createElement('option');
    opt.value=value; opt.textContent=text;
    if(state[key]===value) opt.selected=true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change',()=>{
    state[key]=sel.value;
    if(onChange) { onChange(sel.value); } else { redraw(); }
  });
  wrap.appendChild(lbl); wrap.appendChild(sel);
  return wrap;
}

function mkColor({ id, label, key }) {
  const wrap=document.createElement('div'); wrap.className='control-row';
  const row=document.createElement('div'); row.className='color-row';
  const lbl=document.createElement('label');
  lbl.className='color-label'; lbl.htmlFor=id; lbl.textContent=label;
  const input=document.createElement('input');
  input.type='color'; input.id=id; input.value=state[key];
  input.addEventListener('input',()=>{ state[key]=input.value; redraw(); });
  row.appendChild(lbl); row.appendChild(input); wrap.appendChild(row);
  return wrap;
}

function mkToggle({ id, label, key, onChange }) {
  const wrap=document.createElement('div'); wrap.className='toggle-row';
  const lbl=document.createElement('label'); lbl.textContent=label;
  const tog=document.createElement('label'); tog.className='toggle'; tog.htmlFor=id;
  const inp=document.createElement('input');
  inp.type='checkbox'; inp.id=id; inp.checked=state[key];
  inp.addEventListener('change',()=>{ 
    state[key]=inp.checked; 
    if(onChange) { onChange(inp.checked); } else { redraw(); }
  });
  const track=document.createElement('span'); track.className='toggle-track';
  const thumb=document.createElement('span'); thumb.className='toggle-thumb';
  tog.appendChild(inp); tog.appendChild(track); tog.appendChild(thumb);
  wrap.appendChild(lbl); wrap.appendChild(tog);
  return wrap;
}

function mkInput({ id, label, key, onChange }) {
  const wrap=document.createElement('div'); wrap.className='control-row';
  const lbl=document.createElement('label'); lbl.htmlFor=id; lbl.textContent=label;
  const inp=document.createElement('input'); inp.type='text'; inp.id=id;
  inp.value=state[key]; inp.className='text-input';
  inp.addEventListener('input',()=>{ state[key]=inp.value; if(onChange) onChange(state[key]); });
  wrap.appendChild(lbl); wrap.appendChild(inp);
  return wrap;
}

function mkSection(labelText, toggleKey = null) {
  const sec=document.createElement('div'); sec.className='section';
  if (toggleKey) sec.classList.add('collapsible');

  const header=document.createElement('div'); header.className='section-header';
  const lbl=document.createElement('div'); lbl.className='section-label';
  lbl.textContent=labelText;
  header.appendChild(lbl);
  
  if (toggleKey) {
    const tg=document.createElement('label'); tg.className='toggle small-tog';
    const inp=document.createElement('input'); inp.type='checkbox'; inp.checked=state[toggleKey];
    inp.addEventListener('change', (e) => {
      e.stopPropagation();
      state[toggleKey]=inp.checked;
      updateOverlays();
    });
    const tr=document.createElement('span'); tr.className='toggle-track';
    const th=document.createElement('span'); th.className='toggle-thumb';
    tg.appendChild(inp); tg.appendChild(tr); tg.appendChild(th);
    header.appendChild(tg);
    
    header.addEventListener('click', (e) => {
      if (e.target.tagName==='INPUT' || e.target.tagName==='LABEL' || e.target.tagName==='SPAN') return;
      sec.classList.toggle('collapsed');
    });
  }
  
  const content=document.createElement('div'); content.className='section-content';
  sec.appendChild(header); sec.appendChild(content);
  return { sec, content };
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
    options:[['1:1','1:1 — Square'],['4:5','4:5 — Portrait'],
             ['16:9','16:9 — Landscape'],['9:16','9:16 — Story'],
             ['1.91:1','1.91:1 — Wide']],
    onChange: () => { if(window._p5Resize) window._p5Resize(); },
  }));
  scroll.appendChild(canvasSec.sec);

  // ── Graphics Section ─────────────────────────────────────────
  const graphSec = mkSection('Graphics', 'showGraphics');
  
  const typeLbl = document.createElement('div'); typeLbl.className='section-label sub'; typeLbl.textContent='Composition Setup';
  graphSec.content.appendChild(typeLbl);
  
  const cards = document.createElement('div');
  cards.className = 'comp-cards';
  
  const cardRect = document.createElement('div');
  cardRect.className = 'comp-card' + (state.compositionType==='rectangle'?' active':'');
  cardRect.innerHTML = `<svg viewBox="0 0 24 24"><rect x="5" y="6" width="3" height="12" rx="1"/><rect x="10.5" y="3" width="3" height="15" rx="1"/><rect x="16" y="8" width="3" height="10" rx="1"/></svg><span>Rectangle</span>`;
  
  const cardCirc = document.createElement('div');
  cardCirc.className = 'comp-card' + (state.compositionType==='circular'?' active':'');
  cardCirc.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="6" cy="14" r="3.5"/><circle cx="12" cy="7" r="3.5"/><circle cx="18" cy="11" r="3.5"/></svg><span>Circular</span>`;
  
  cards.appendChild(cardRect);
  cards.appendChild(cardCirc);
  graphSec.content.appendChild(cards);

  // ── Rectangle Specific Group ──────────────────────────────
  const groupRect = document.createElement('div');
  groupRect.className = 'ctrl-group' + (state.compositionType==='rectangle'?' active':'');
  groupRect.appendChild(mkSlider({ id:'ctrl-count', label:'Rectangle Count', min:2, max:40, step:1, key:'rectCount' }));
  groupRect.appendChild(mkSlider({ id:'ctrl-spacing', label:'Item Spacing', min:0, max:30, step:0.5, key:'spacing', decimals:1 }));
  groupRect.appendChild(mkToggle({ id:'ctrl-symmetry', label:'Symmetry (size)', key:'symmetry' }));
  groupRect.appendChild(mkToggle({ id:'ctrl-mirror-y', label:'Mirror Axis',     key:'mirrorY'  }));
  groupRect.appendChild(mkSelect({
    id:'ctrl-baseline', label:'Baseline Direction', key:'baseline',
    options:[
      ['bottom','↑ Bottom — grow upward'],
      ['top',   '↓ Top — grow downward'],
      ['left',  '→ Left — grow rightward'],
      ['right', '← Right — grow leftward'],
    ],
  }));

  // ── Circular Specific Group ───────────────────────────────
  const groupCirc = document.createElement('div');
  groupCirc.className = 'ctrl-group' + (state.compositionType==='circular'?' active':'');
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-count', label:'Circle Count', min:2, max:40, step:1, key:'circleCount' }));
  groupCirc.appendChild(mkSlider({ id:'ctrl-diameter', label:'Max Diameter', min:50, max:2000, step:10, key:'circleDiameter' }));
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-sp-x', label:'X Center Offset', min:0, max:1000, step:1, key:'circleSpacingX' }));
  groupCirc.appendChild(mkSlider({ id:'ctrl-circle-sp-y', label:'Y Center Offset', min:0, max:1000, step:1, key:'circleSpacingY' }));
  groupCirc.appendChild(mkSelect({
    id:'ctrl-circle-align', label:'Anchor Position', key:'circleAlignment',
    options:[
      ['top-left', '↖ Top Left'],
      ['top-center', '↑ Top Center'],
      ['top-right', '↗ Top Right'],
      ['center-left', '← Center Left'],
      ['center', '⇿ Center'],
      ['center-right', '→ Center Right'],
      ['bottom-left', '↙ Bottom Left'],
      ['bottom-center', '↓ Bottom Center'],
      ['bottom-right', '↘ Bottom Right'],
    ],
  }));
  groupCirc.appendChild(mkToggle({ id:'ctrl-circle-mirror', label:'Mirror X & Y Axis', key:'circleMirrorXY' }));

  graphSec.content.appendChild(groupRect);
  graphSec.content.appendChild(groupCirc);

  // Toggle behavior
  const switchType = (type) => {
    state.compositionType = type;
    cardRect.classList.toggle('active', type === 'rectangle');
    cardCirc.classList.toggle('active', type === 'circular');
    groupRect.classList.toggle('active', type === 'rectangle');
    groupCirc.classList.toggle('active', type === 'circular');
    redraw();
  };
  cardRect.addEventListener('click', () => switchType('rectangle'));
  cardCirc.addEventListener('click', () => switchType('circular'));

  // ── Shared Layout Controls ────────────────────────────────
  graphSec.content.appendChild(mkSlider({ id:'ctrl-extent', label:'Stagger/Growth Extent', min:0.05, max:1, step:0.01, key:'extent', decimals:2 }));
  
  graphSec.content.appendChild(mkSelect({
    id:'ctrl-curve', label:'Curve Distribution', key:'curveType',
    options:[['flat','Flat — No Variation'],
             ['linear','Linear'],['quadratic','Quadratic'],['cubic','Cubic'],
             ['parabolic','Parabolic — Peak Center'],
             ['hyperbolic','Hyperbolic — Asymptotic'],
             ['bezier','Bezier — Ease In/Out']],
  }));
  graphSec.content.appendChild(mkToggle({ id:'ctrl-flip-curve', label:'Flip Curve Shape', key:'flipCurve' }));

  // Curve preview
  const cvWrap=document.createElement('div'); cvWrap.className='control-row';
  const cvLbl=document.createElement('label'); cvLbl.textContent='Curve Preview';
  const cvCanvas=document.createElement('canvas');
  cvCanvas.id='curve-preview'; cvCanvas.width=260; cvCanvas.height=60;
  cvWrap.appendChild(cvLbl); cvWrap.appendChild(cvCanvas);
  graphSec.content.appendChild(cvWrap);

  buildGradientSection(graphSec.content);
  
  const styleLbl = document.createElement('div'); styleLbl.className='section-label sub'; styleLbl.textContent='Style / Blur'; styleLbl.style.marginTop='20px';
  graphSec.content.appendChild(styleLbl);
  graphSec.content.appendChild(mkColor({ id:'ctrl-bgcolor', label:'Background', key:'bgColor' }));
  graphSec.content.appendChild(mkSlider({
    id:'ctrl-opacity', label:'Opacity', min:0, max:1, step:0.01, key:'opacity', decimals:2,
    onChange: () => renderGradientBar(),
  }));
  graphSec.content.appendChild(mkToggle({ id:'ctrl-global-op', label:'Global Opacity (Blend Group)', key:'globalOpacity' }));
  graphSec.content.appendChild(mkSlider({
    id:'ctrl-blur', label:'Blur (inner)', min:0, max:20, step:0.5, key:'blur', decimals:1,
  }));
  scroll.appendChild(graphSec.sec);
  
  // ── Headline Overlays ──────────────────────────────────────
  const hlSec = mkSection('Headline', 'showHeadline');
  hlSec.content.appendChild(mkInput({ id:'ctrl-hl-l1', label:'Line 1', key:'headlineLine1', onChange: updateOverlays }));
  hlSec.content.appendChild(mkInput({ id:'ctrl-hl-l2', label:'Line 2', key:'headlineLine2', onChange: updateOverlays }));
  hlSec.content.appendChild(mkSelect({ id:'ctrl-hl-font', label:'Font Type', key:'headlineFont', options:[['400','Reg (Innovator)'],['500','Med (Innovator)'],['700','Bold (Innovator)']], onChange:updateOverlays }));
  hlSec.content.appendChild(mkSelect({ id:'ctrl-hl-align', label:'Alignment', key:'headlineAlign', options:[['left','Left'],['center','Center'],['right','Right']], onChange:updateOverlays }));
  hlSec.content.appendChild(mkSlider({ id:'ctrl-hl-tracking', label:'Tracking', min:-20, max:20, step:0.1, key:'headlineTracking', decimals:1, onChange: updateOverlays }));
  hlSec.content.appendChild(mkSlider({ id:'ctrl-hl-lh', label:'Line Height', min:0.5, max:2.5, step:0.05, key:'headlineLineHeight', decimals:2, onChange: updateOverlays }));
  hlSec.content.appendChild(mkSlider({ id:'ctrl-hl-fs', label:'Font Size', min:10, max:300, step:1, key:'headlineFontSize', decimals:0, onChange: updateOverlays }));
  scroll.appendChild(hlSec.sec);
  
  // ── Image Overlays ──────────────────────────────────────
  const imgSec = mkSection('Image Placeholder', 'showImage');
  const fileWrap = document.createElement('div'); fileWrap.className='control-row';
  const fileLbl = document.createElement('label'); fileLbl.textContent='Upload Image';
  const fileInp = document.createElement('input'); fileInp.type='file'; fileInp.accept='image/*'; fileInp.style.width='100%';
  fileInp.addEventListener('change', (e) => {
    if(!e.target.files.length) return;
    const url = URL.createObjectURL(e.target.files[0]);
    state.imageSrc = url;
    updateOverlays();
  });
  fileWrap.appendChild(fileLbl); fileWrap.appendChild(fileInp);
  imgSec.content.appendChild(fileWrap);
  
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-scale', label:'Scale Canvas Frame', min:0.1, max:2, step:0.01, key:'imageScale', decimals:2, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-y', label:'Y-Axis Offset', min:-1500, max:1500, step:10, key:'imageYOffset', decimals:0, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSelect({ id:'ctrl-img-stroke', label:'Stroke Preset', key:'imageStrokeStyle', options:[['marketing','Marketing Warm'],['frosty','Frosty Glass']], onChange:updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-rad', label:'Corner Radius', min:0, max:500, step:1, key:'imageRadius', decimals:0, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-sop', label:'Stroke Opacity', min:0, max:1, step:0.01, key:'imageStrokeOp', decimals:2, onChange: updateOverlays }));
  imgSec.content.appendChild(mkSlider({ id:'ctrl-img-sw', label:'Stroke Weight', min:0, max:100, step:1, key:'imageStrokeWeight', decimals:0, onChange: updateOverlays }));

  scroll.appendChild(imgSec.sec);
  
  // ── Footer Overlays ──────────────────────────────────────
  const ftSec = mkSection('Footer', 'showFooter');
  ftSec.content.appendChild(mkInput({ id:'ctrl-ft-byline', label:'Byline', key:'footerByline', onChange: updateOverlays }));
  ftSec.content.appendChild(mkSelect({ id:'ctrl-ft-font', label:'Font Type', key:'footerFont', options:[['400','Reg (Innovator)'],['500','Med (Innovator)'],['700','Bold (Innovator)']], onChange:updateOverlays }));
  ftSec.content.appendChild(mkSelect({ id:'ctrl-ft-align', label:'Alignment', key:'footerAlign', options:[['left','Left'],['center','Center'],['right','Right']], onChange:updateOverlays }));
  ftSec.content.appendChild(mkSlider({ id:'ctrl-ft-tracking', label:'Tracking', min:-10, max:20, step:0.1, key:'footerTracking', decimals:1, onChange: updateOverlays }));
  scroll.appendChild(ftSec.sec);
}

// ══════════════════════════════════════════════════════════════
// RANDOMIZE
// ══════════════════════════════════════════════════════════════
function randomize() {
  const curves    = ['flat','linear','quadratic','cubic','parabolic','hyperbolic','bezier'];
  const baselines = ['bottom','top','left','right'];
  const circleBaselines = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  const gradDirs  = ['horizontal','vertical'];
  const palKeys   = Object.keys(PALETTES).filter(k=>k!=='custom');
  const comps     = ['rectangle', 'circular'];

  state.compositionType   = comps    [Math.floor(Math.random()*comps.length)];
  state.curveType         = curves   [Math.floor(Math.random()*curves.length)];
  state.flipCurve         = Math.random()>0.5;
  state.baseline          = baselines[Math.floor(Math.random()*baselines.length)];
  state.circleAlignment   = circleBaselines[Math.floor(Math.random()*circleBaselines.length)];
  state.gradientDirection = gradDirs [Math.floor(Math.random()*gradDirs.length)];
  
  state.rectCount         = Math.floor(Math.random()*28)+4;
  state.circleCount       = Math.floor(Math.random()*15)+5;
  state.circleDiameter    = Math.floor(Math.random()*1200)+200;
  
  state.circleSpacingX    = +(Math.random()>0.7? Math.random()*200 : 0).toFixed(0);
  state.circleSpacingY    = +(Math.random()>0.7? Math.random()*200 : 0).toFixed(0);
  
  state.spacing           = 0;
  state.extent            = +(0.4+Math.random()*0.55).toFixed(2);
  state.opacity           = +(0.55+Math.random()*0.40).toFixed(2);
  state.blur              = Math.random()<0.35 ? +(Math.random()*10).toFixed(1) : 0;
  state.symmetry          = Math.random()>0.25;
  state.mirrorY           = Math.random()>0.5;
  state.circleMirrorXY    = Math.random()>0.5;

  state.palette = palKeys[Math.floor(Math.random()*palKeys.length)];
  applyPalette(state.palette);

  // Also sync UI visibility for composition types
  document.querySelectorAll('.comp-card').forEach(c => {
    c.classList.toggle('active', c.querySelector('span').textContent.toLowerCase() === state.compositionType);
  });
  const groupRect = document.querySelector('.ctrl-group:first-of-type');
  const groupCirc = document.querySelector('.ctrl-group:last-of-type');
  if (groupRect && groupCirc) {
    groupRect.classList.toggle('active', state.compositionType === 'rectangle');
    groupCirc.classList.toggle('active', state.compositionType === 'circular');
  }

  syncControlsToState();
  redraw();
  renderStopList();
}

function syncControlsToState() {
  [['ctrl-count','rectCount',0],
   ['ctrl-circle-count','circleCount',0],
   ['ctrl-diameter','circleDiameter',0],
   ['ctrl-circle-sp-x','circleSpacingX',0],
   ['ctrl-circle-sp-y','circleSpacingY',0],
   ['ctrl-spacing','spacing',1],
   ['ctrl-extent','extent',2],
   ['ctrl-opacity','opacity',2],
   ['ctrl-blur','blur',1]
  ].forEach(([id,key,dec])=>{
    const el=document.getElementById(id); if(!el) return;
    el.value=state[key];
    const b=el.closest('.control-row')?.querySelector('.val');
    if(b) b.textContent=(+state[key]).toFixed(dec);
  });
  
  [['ctrl-curve','curveType'],
   ['ctrl-aspect','aspectRatio'],
   ['ctrl-baseline','baseline'],
   ['ctrl-circle-align','circleAlignment'],
   ['ctrl-grad-dir','gradientDirection'],
   ['ctrl-palette','palette']
  ].forEach(([id,key])=>{
    const el=document.getElementById(id); if(el) el.value=state[key];
  });
  
  const bg=document.getElementById('ctrl-bgcolor'); if(bg) bg.value=state.bgColor;
  const sym=document.getElementById('ctrl-symmetry'); if(sym) sym.checked=state.symmetry;
  const my=document.getElementById('ctrl-mirror-y');  if(my)  my.checked=state.mirrorY;
  const fc=document.getElementById('ctrl-flip-curve');  if(fc)  fc.checked=state.flipCurve;
  const cm=document.getElementById('ctrl-circle-mirror'); if(cm) cm.checked=state.circleMirrorXY;
  const glop=document.getElementById('ctrl-global-op'); if(glop) glop.checked=state.globalOpacity;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildGUI();
  renderGradientBar();
  renderStopList();
  renderCurvePreview();
  updateOverlays();

  document.getElementById('btn-export').addEventListener('click', () => {
    const artboard = document.getElementById('artboard');
    if (!artboard) return;

    // Use html2canvas to capture everything inside the artboard (canvas + overlays)
    html2canvas(artboard, {
      backgroundColor: null,
      useCORS: true,
      scale: 2, // Export at 2x resolution for better quality
      logging: false,
    }).then(canvas => {
      const a = document.createElement('a');
      a.download = `generative-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    });
  });

  document.getElementById('btn-random').addEventListener('click', randomize);
});
