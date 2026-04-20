// ── sketch.js ─────────────────────────────────────────────────
// Depends on: shared.js

let cw, ch;

function computeCanvasDimensions() {
  const ratio = ASPECT_RATIOS[state.aspectRatio];
  const wrap  = document.getElementById('canvas-wrap');
  const maxW  = wrap.clientWidth  - 60;
  const maxH  = wrap.clientHeight - 60;
  if (maxW / ratio.w * ratio.h <= maxH) {
    cw = Math.max(100, Math.floor(maxW));
    ch = Math.max(100, Math.floor(maxW / ratio.w * ratio.h));
  } else {
    ch = Math.max(100, Math.floor(maxH));
    cw = Math.max(100, Math.floor(maxH / ratio.h * ratio.w));
  }

  const artboard = document.getElementById('artboard');
  const overlays = document.getElementById('overlays');
  if (artboard) {
    artboard.style.width  = cw + 'px';
    artboard.style.height = ch + 'px';
    const scale = cw / 2696;
    artboard.style.setProperty('--scale', scale);
    if (overlays) overlays.style.display = 'block';
  }
}

function renderBackground(p) {
  const [r,g,b] = hexToRgb(state.bgColor);
  p.background(r, g, b);
}

// ── computeRectFill ──────────────────────────────────────────
function computeRectFill(dc, fillT, rx, ry, rw, rh, alpha, flip) {
  const a       = alpha.toFixed(3);
  const isHDist = state.baseline === 'bottom' || state.baseline === 'top';
  const gradDir = state.gradientDirection;
  const sorted  = [...state.gradientStops].sort((a,b) => a.stop - b.stop);

  const useRectGrad =
    ( isHDist && gradDir === 'vertical') ||
    (!isHDist && gradDir === 'horizontal');

  if (useRectGrad) {
    let x0, y0, x1, y1;
    if (gradDir === 'vertical') {
      x0=rx; y0= flip ? ry+rh : ry;
      x1=rx; y1= flip ? ry     : ry+rh;
    } else {
      x0= flip ? rx+rw : rx; y0=ry;
      x1= flip ? rx    : rx+rw; y1=ry;
    }
    const grad = dc.createLinearGradient(x0, y0, x1, y1);
    sorted.forEach(s => {
      const [r,g,b] = hexToRgb(s.color);
      grad.addColorStop(s.stop, `rgba(${r},${g},${b},${a})`);
    });
    return grad;
  } else {
    const t       = flip ? 1 - fillT : fillT;
    const [r,g,b] = sampleGradient(t, state.gradientStops);
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  }
}

// ── applyInnerGlow ───────────────────────────────────────────
// Uniform gradient-based inner illumination — no blur/filter.
// Covers the ENTIRE shape with a soft radial brightening from center.
// The glow radius equals the half-diagonal of the shape so the
// gradient reaches every corner/edge before fading out.
//
// Strategy:
//   • Bright highlight color (base → lighter) fills center
//   • A linear-mapped radial from r=0 to r=halfDiag
//   • Stops: 0% opaque-bright → 60% semi-bright → 100% transparent
// This creates a smooth "internal illumination" that enhances the
// gradient without replacing it.
function applyInnerGlow(dc, cx, cy, rw, rh, fillRgb) {
  const intensity = Math.max(0, Math.min(1, state.innerGlowIntensity));

  // Radius = half-diagonal so glow kisses every corner of the rect
  const halfDiag = Math.sqrt(rw * rw + rh * rh) * 0.5;

  // Bright highlight: push each channel toward white by intensity
  const br = Math.min(255, Math.round(fillRgb[0] + (255 - fillRgb[0]) * intensity * 0.9));
  const bg = Math.min(255, Math.round(fillRgb[1] + (255 - fillRgb[1]) * intensity * 0.9));
  const bb = Math.min(255, Math.round(fillRgb[2] + (255 - fillRgb[2]) * intensity * 0.9));

  // Core alpha at center — make it proportional to intensity
  const a0 = (intensity * 0.85).toFixed(3);
  const a1 = (intensity * 0.40).toFixed(3);

  const grad = dc.createRadialGradient(cx, cy, 0, cx, cy, halfDiag);
  grad.addColorStop(0.00, `rgba(${br},${bg},${bb},${a0})`);
  grad.addColorStop(0.55, `rgba(${br},${bg},${bb},${a1})`);
  grad.addColorStop(1.00, `rgba(${br},${bg},${bb},0)`);

  dc.fillStyle = grad;
  dc.fillRect(cx - rw/2, cy - rh/2, rw, rh);
}

// Same for circles — use radius directly (already a circle so half-diagonal = radius)
function applyInnerGlowCircle(dc, cx, cy, radius, fillRgb) {
  const intensity = Math.max(0, Math.min(1, state.innerGlowIntensity));

  const br = Math.min(255, Math.round(fillRgb[0] + (255 - fillRgb[0]) * intensity * 0.9));
  const bg = Math.min(255, Math.round(fillRgb[1] + (255 - fillRgb[1]) * intensity * 0.9));
  const bb = Math.min(255, Math.round(fillRgb[2] + (255 - fillRgb[2]) * intensity * 0.9));

  const a0 = (intensity * 0.85).toFixed(3);
  const a1 = (intensity * 0.40).toFixed(3);

  const grad = dc.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0.00, `rgba(${br},${bg},${bb},${a0})`);
  grad.addColorStop(0.55, `rgba(${br},${bg},${bb},${a1})`);
  grad.addColorStop(1.00, `rgba(${br},${bg},${bb},0)`);

  dc.fillStyle = grad;
  dc.fill(); // path is already set (circle arc from clip)
}

// ── renderRect ───────────────────────────────────────────────
// Blur: applied as a real canvas filter BEFORE filling, then a second
// filtered pass layered at higher alpha to make it visible.
function renderRect(p, rx, ry, rw, rh, fillStyle, fillRgb) {
  if (rw < 1 || rh < 1) return;
  const dc = p.drawingContext;
  dc.save();
  dc.beginPath();
  dc.rect(rx, ry, rw, rh);
  dc.clip();

  // Base fill
  dc.fillStyle = fillStyle;
  dc.fillRect(rx, ry, rw, rh);

  // Blur: soft secondary layer, scale blur to canvas size
  if (state.blur > 0) {
    const blurPx = state.blur * (Math.max(cw, ch) / 600);
    dc.filter = `blur(${blurPx.toFixed(1)}px)`;
    dc.globalAlpha = 0.7;
    dc.fillStyle   = fillStyle;
    dc.fillRect(rx - blurPx, ry - blurPx, rw + blurPx*2, rh + blurPx*2);
    dc.globalAlpha = 1;
    dc.filter      = 'none';
  }

  // Inner glow — gradient-only, no filters
  if (state.innerGlow && fillRgb) {
    applyInnerGlow(dc, rx + rw/2, ry + rh/2, rw, rh, fillRgb);
  }

  dc.restore();
}

// ── renderCircle ─────────────────────────────────────────────
function renderCircle(p, cx, cy, radius, fillStyle, fillRgb) {
  if (radius < 0.5) return;
  const dc = p.drawingContext;
  dc.save();
  dc.beginPath();
  dc.arc(cx, cy, radius, 0, Math.PI * 2);
  dc.clip();

  // Base fill
  dc.fillStyle = fillStyle;
  dc.fill();

  // Blur
  if (state.blur > 0) {
    const blurPx = state.blur * (Math.max(cw, ch) / 600);
    dc.filter = `blur(${blurPx.toFixed(1)}px)`;
    dc.globalAlpha = 0.7;
    dc.fillStyle   = fillStyle;
    dc.fill();
    dc.globalAlpha = 1;
    dc.filter      = 'none';
  }

  // Inner glow
  if (state.innerGlow && fillRgb) {
    dc.beginPath();
    dc.arc(cx, cy, radius, 0, Math.PI * 2);
    applyInnerGlowCircle(dc, cx, cy, radius, fillRgb);
  }

  dc.restore();
}

// ── Helper: sample base RGB for inner glow ───────────────────
function extractFillRgb(fillT, flip) {
  const t = flip ? 1 - fillT : fillT;
  return sampleGradient(t, state.gradientStops).map(Math.round);
}

// ── renderComposition ────────────────────────────────────────
function renderComposition(p) {
  const count   = Math.max(2, Math.floor(state.rectCount));
  const spacing = Math.max(0, state.spacing);
  const dir     = state.baseline;
  const sym     = state.symmetry;
  const mirror  = state.mirrorY;
  const dc      = p.drawingContext;

  const isH = dir === 'bottom' || dir === 'top';

  const totalSpacing = spacing * (count + 1);
  const axisDim  = isH ? cw : ch;
  const slotSize = Math.max(2, (axisDim - totalSpacing) / count);

  const perpDim   = isH ? ch : cw;
  const maxGrowth = perpDim * Math.min(state.extent, mirror ? 0.499 : 1.0);

  for (let i = 0; i < count; i++) {
    let tCurve;
    if (sym) {
      const c = (count - 1) / 2;
      tCurve = 1 - (count > 1 ? Math.abs(i - c) / c : 0);
    } else {
      tCurve = count > 1 ? i / (count - 1) : 1;
    }
    tCurve = Math.max(0, Math.min(1, tCurve));
    let tVal = getCurveValue(tCurve, state.curveType);
    if (state.flipCurve) tVal = 1 - tVal;

    const growth = maxGrowth * Math.max(0.03, tVal);
    const alpha  = state.opacity;
    const fillT  = count > 1 ? i / (count - 1) : 0;
    const slotC  = spacing + slotSize / 2 + i * (slotSize + spacing);

    const rects = [];
    if (dir === 'bottom') {
      rects.push({ rx: slotC-slotSize/2, ry: ch-growth, rw: slotSize, rh: growth, flip: false });
      if (mirror) rects.push({ rx: slotC-slotSize/2, ry: 0, rw: slotSize, rh: growth, flip: true });
    } else if (dir === 'top') {
      rects.push({ rx: slotC-slotSize/2, ry: 0, rw: slotSize, rh: growth, flip: false });
      if (mirror) rects.push({ rx: slotC-slotSize/2, ry: ch-growth, rw: slotSize, rh: growth, flip: true });
    } else if (dir === 'left') {
      rects.push({ rx: 0, ry: slotC-slotSize/2, rw: growth, rh: slotSize, flip: false });
      if (mirror) rects.push({ rx: cw-growth, ry: slotC-slotSize/2, rw: growth, rh: slotSize, flip: true });
    } else {
      rects.push({ rx: cw-growth, ry: slotC-slotSize/2, rw: growth, rh: slotSize, flip: false });
      if (mirror) rects.push({ rx: 0, ry: slotC-slotSize/2, rw: growth, rh: slotSize, flip: true });
    }

    rects.forEach(({ rx, ry, rw, rh, flip }) => {
      const fill    = computeRectFill(dc, fillT, rx, ry, rw, rh, alpha, flip);
      const fillRgb = state.innerGlow ? extractFillRgb(fillT, flip) : null;
      renderRect(p, rx, ry, rw, rh, fill, fillRgb);
    });
  }
}

// ── renderCircularComposition ────────────────────────────────
function renderCircularComposition(p) {
  const count      = Math.max(2, Math.floor(state.circleCount));
  const maxD       = state.circleDiameter;
  const minD       = Math.max(10, maxD * 0.05);
  const maxStagger = ch * state.extent;
  const dc         = p.drawingContext;

  for (let i = 0; i < count; i++) {
    const fillT = count > 1 ? i / (count - 1) : 0;

    let curveVal = getCurveValue(fillT, state.curveType);
    if (state.flipCurve) curveVal = 1 - curveVal;

    const currentD = maxD - (maxD - minD) * fillT;
    const R        = currentD / 2;
    const offset   = maxStagger * curveVal;

    let cx = cw / 2, cy = ch / 2;
    const align = state.circleAlignment;
    if (align.includes('left'))   cx = R + offset;
    else if (align.includes('right'))  cx = cw - R - offset;
    if (align.includes('top'))    cy = R + offset;
    else if (align.includes('bottom')) cy = ch - R - offset;

    function moveAndDraw(px, py, flipX = false) {
      const vx = px - cw/2, vy = py - ch/2;
      const dx = Math.abs(vx) < 0.5 ? 0 : Math.sign(vx);
      const dy = Math.abs(vy) < 0.5 ? 0 : Math.sign(vy);
      const finalX = px + dx * state.circleSpacingX;
      const finalY = py + dy * state.circleSpacingY;

      const alpha   = state.opacity;
      const fill    = computeRectFill(dc, fillT, finalX-R, finalY-R, currentD, currentD, alpha, flipX);
      const fillRgb = state.innerGlow ? extractFillRgb(fillT, flipX) : null;
      renderCircle(p, finalX, finalY, R, fill, fillRgb);
    }

    moveAndDraw(cx, cy, false);

    if (state.circleMirrorXY) {
      const mx = cw - cx, my = ch - cy;
      const notCenterH = Math.abs(cx - cw/2) > 0.5;
      const notCenterV = Math.abs(cy - ch/2) > 0.5;
      if (notCenterH) moveAndDraw(mx, cy, true);
      if (notCenterV) moveAndDraw(cx, my, false);
      if (notCenterH && notCenterV) moveAndDraw(mx, my, true);
    }
  }
}

// ── p5 Instance ──────────────────────────────────────────────
const sketch = function(p) {
  p.setup = function() {
    computeCanvasDimensions();
    p.createCanvas(cw, ch).parent('p5-target');
    p.noLoop();
  };

  p.draw = function() {
    p.drawingContext.filter = 'none';
    renderBackground(p);

    if (state.showGraphics) {
      if (state.globalOpacity) {
        // Off-screen buffer: render at full alpha, then composite with opacity
        if (!window._pg || window._pg.width !== cw || window._pg.height !== ch) {
          if (window._pg) window._pg.remove();
          window._pg = p.createGraphics(cw, ch);
        }
        const pg = window._pg;
        pg.clear();

        const savedOpacity = state.opacity;
        state.opacity = 1.0;
        if (state.compositionType === 'circular') {
          renderCircularComposition(pg);
        } else {
          renderComposition(pg);
        }
        state.opacity = savedOpacity;

        p.drawingContext.globalAlpha = savedOpacity;
        p.image(pg, 0, 0);
        p.drawingContext.globalAlpha = 1.0;
      } else {
        if (state.compositionType === 'circular') {
          renderCircularComposition(p);
        } else {
          renderComposition(p);
        }
      }
    }
  };

  window._p5Redraw = () => p.redraw();
  window._p5Resize = () => {
    computeCanvasDimensions();
    p.resizeCanvas(cw, ch);
    p.redraw();
  };

  // ── Export: draw everything to a fresh off-screen canvas ──
  // We bypass html2canvas entirely to avoid cross-origin / timing issues.
  // Instead we composite: p5 canvas pixels → HTML overlay text via SVG trick.
  window._exportCanvas = () => {
    const artboard = document.getElementById('artboard');
    if (!artboard) return;

    // Use html2canvas with explicit options for reliability
    const scale = 2;
    html2canvas(artboard, {
      backgroundColor: state.bgColor,
      useCORS: true,
      allowTaint: true,
      scale: scale,
      logging: false,
      imageTimeout: 0,
      removeContainer: true,
      // Ignore the panel overlay completely
      ignoreElements: (el) => {
        return el.id === 'panel' || el.classList.contains('ignore-export');
      },
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `generative-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(err => {
      console.error('Export failed:', err);
      // Fallback: export just the p5 canvas
      const p5canvas = document.querySelector('#p5-target canvas');
      if (p5canvas) {
        const link2 = document.createElement('a');
        link2.download = `generative-shapes-${Date.now()}.png`;
        link2.href = p5canvas.toDataURL('image/png');
        link2.click();
      }
    });
  };
};

new p5(sketch);
