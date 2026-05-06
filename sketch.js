// ── sketch.js ─────────────────────────────────────────────────
// Depends on: shared.js

let cw, ch;

function computeCanvasDimensions() {
  const ratio = ASPECT_RATIOS[state.aspectRatio];
  const wrap  = document.getElementById('canvas-wrap');
  // Reserve space for the floating panel on the right (320px panel + 24px
  // gutter on each side + small buffer = 380px). Always leave that gap so
  // landscape canvases never extend underneath the GUI.
  const panel = document.getElementById('panel');
  const reserveRight = panel ? Math.max(380, panel.offsetWidth + 60) : 380;
  const maxW  = wrap.clientWidth  - reserveRight - 60;
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
    // Per-aspect footer scale (story format gets a bigger footer block,
    // but the text inside is scaled a touch less for proportion).
    const footerScale     = state.aspectRatio === '9:16' ? 2   : 1;
    const footerTextScale = state.aspectRatio === '9:16' ? 1.5 : 1;
    artboard.style.setProperty('--footer-scale',      footerScale);
    artboard.style.setProperty('--footer-text-scale', footerTextScale);
    artboard.dataset.aspect = state.aspectRatio;
    if (overlays) overlays.style.display = 'block';
  }
}

function renderBackground(p) {
  if (state.bgGradientMode && state.bgGradientStops && state.bgGradientStops.length >= 2) {
    const dc   = p.drawingContext;
    const flip = state.bgGradientFlip;
    let x0, y0, x1, y1;
    if (state.bgGradientDir === 'horizontal') {
      x0 = flip ? cw : 0; y0 = 0;
      x1 = flip ? 0 : cw; y1 = 0;
    } else {
      x0 = 0; y0 = flip ? ch : 0;
      x1 = 0; y1 = flip ? 0 : ch;
    }
    const grad = dc.createLinearGradient(x0, y0, x1, y1);
    [...state.bgGradientStops].sort((a, b) => a.stop - b.stop).forEach(s => {
      const [r, g, b] = hexToRgb(s.color);
      grad.addColorStop(s.stop, `rgb(${r},${g},${b})`);
    });
    dc.fillStyle = grad;
    dc.fillRect(0, 0, cw, ch);
  } else {
    const [r,g,b] = hexToRgb(state.bgColor);
    p.background(r, g, b);
  }
}

// ── computeRectFill ──────────────────────────────────────────
function computeRectFill(dc, fillT, rx, ry, rw, rh, alpha, flip) {
  const a       = alpha.toFixed(3);
  const isHDist = state.baseline === 'bottom' || state.baseline === 'top';
  // Gradient direction is auto-derived from the baseline setting.
  // Horizontal baselines (left/right) → horizontal gradient; vertical (top/bottom) → vertical.
  const gradDir = (state.baseline === 'left' || state.baseline === 'right') ? 'horizontal' : 'vertical';
  const sorted  = [...state.gradientStops].sort((a,b) => a.stop - b.stop);

  // Apply global bar flip (XOR with per-rect mirror flip)
  const ef = state.barFlipGradient ? !flip : flip;

  const useRectGrad =
    ( isHDist && gradDir === 'vertical') ||
    (!isHDist && gradDir === 'horizontal');

  if (useRectGrad) {
    let x0, y0, x1, y1;
    if (gradDir === 'vertical') {
      x0=rx; y0= ef ? ry+rh : ry;
      x1=rx; y1= ef ? ry     : ry+rh;
    } else {
      x0= ef ? rx+rw : rx; y0=ry;
      x1= ef ? rx    : rx+rw; y1=ry;
    }
    const grad = dc.createLinearGradient(x0, y0, x1, y1);
    sorted.forEach(s => {
      const [r,g,b] = hexToRgb(s.color);
      grad.addColorStop(s.stop, `rgba(${r},${g},${b},${a})`);
    });
    return grad;
  } else {
    const t       = ef ? 1 - fillT : fillT;
    const [r,g,b] = sampleGradient(t, state.gradientStops);
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  }
}

// ── Edge Highlight — simple gradient overlay ──────────────────
// Produces the luminous banding artefact between stacked shapes:
// a bright white gradient at the "tip" edge of each shape that fades
// inward. When shapes overlap the highlights from adjacent layers
// create glowing seam lines — like light caught between stacked surfaces.
// All inside the clip — zero background bleed, no tricks.

// ── applyInnerShadowRect ─────────────────────────────────────
// White gradient at the tip edges of the shape.
// Vertical bars: highlight on left/right faces.
// Horizontal bars: highlight on top/bottom faces.
function applyInnerShadowRect(dc, rx, ry, rw, rh, flipX, flipY) {
  if (!state.depthShadow) return;
  if (rw < 1 || rh < 1) return;

  const isV    = rh >= rw;
  const fadeLen = Math.min(rw, rh) * state.dsSpread;
  const softAlpha = (Math.max(0, state.dsOpacity * 0.36)).toFixed(3);

  if (isV) {
    // Vertical bars -> highlight on sides. Primary on left by default.
    const primaryX1 = rx;
    const primaryX2 = rx + fadeLen;
    const secondaryX1 = rx + rw;
    const secondaryX2 = rx + rw - fadeLen;

    const usePrimaryRight = flipX; // If mirrored horizontally, primary light is on the right
    
    const g1X1 = usePrimaryRight ? secondaryX1 : primaryX1;
    const g1X2 = usePrimaryRight ? secondaryX2 : primaryX2;
    const g1 = dc.createLinearGradient(g1X1, ry, g1X2, ry);
    g1.addColorStop(0, `rgba(255,255,255,${state.dsOpacity})`);
    g1.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = g1;
    dc.fillRect(rx, ry, rw, rh);

    const g2X1 = usePrimaryRight ? primaryX1 : secondaryX1;
    const g2X2 = usePrimaryRight ? primaryX2 : secondaryX2;
    const g2 = dc.createLinearGradient(g2X1, ry, g2X2, ry);
    g2.addColorStop(0, `rgba(255,255,255,${softAlpha})`);
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = g2;
    dc.fillRect(rx, ry, rw, rh);
  } else {
    // Horizontal bars -> highlight on top/bottom edges. Primary on top by default.
    const primaryY1 = ry;
    const primaryY2 = ry + fadeLen;
    const secondaryY1 = ry + rh;
    const secondaryY2 = ry + rh - fadeLen;

    const usePrimaryBottom = flipY; // If mirrored vertically, primary light is on bottom

    const g1Y1 = usePrimaryBottom ? secondaryY1 : primaryY1;
    const g1Y2 = usePrimaryBottom ? secondaryY2 : primaryY2;
    const g1 = dc.createLinearGradient(rx, g1Y1, rx, g1Y2);
    g1.addColorStop(0, `rgba(255,255,255,${state.dsOpacity})`);
    g1.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = g1;
    dc.fillRect(rx, ry, rw, rh);

    const g2Y1 = usePrimaryBottom ? primaryY1 : secondaryY1;
    const g2Y2 = usePrimaryBottom ? primaryY2 : secondaryY2;
    const g2 = dc.createLinearGradient(rx, g2Y1, rx, g2Y2);
    g2.addColorStop(0, `rgba(255,255,255,${softAlpha})`);
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = g2;
    dc.fillRect(rx, ry, rw, rh);
  }
}

// ── applyInnerShadowCircle ───────────────────────────────────
// Radial white rim from the outer edge inward — creates luminous
// arc banding between overlapping circles.
function applyInnerShadowCircle(dc, cx, cy, radius) {
  if (!state.depthShadow) return;
  if (radius < 0.5) return;

  const inner = radius * (1 - state.dsSpread);
  const grad  = dc.createRadialGradient(cx, cy, inner, cx, cy, radius);
  grad.addColorStop(0,   'rgba(255,255,255,0)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1,   `rgba(255,255,255,${state.dsOpacity})`);

  dc.fillStyle = grad;
  dc.beginPath();
  dc.arc(cx, cy, radius, 0, Math.PI * 2);
  dc.fill();
}

// ── applyInnerGlow ───────────────────────────────────────────
// Uniform gradient-based inner illumination — no blur/filter.
function applyInnerGlow(dc, cx, cy, rw, rh, fillRgb) {
  const intensity = Math.max(0, Math.min(1, state.innerGlowIntensity));
  const halfDiag  = Math.sqrt(rw * rw + rh * rh) * 0.5;

  const br = Math.min(255, Math.round(fillRgb[0] + (255 - fillRgb[0]) * intensity * 0.9));
  const bg = Math.min(255, Math.round(fillRgb[1] + (255 - fillRgb[1]) * intensity * 0.9));
  const bb = Math.min(255, Math.round(fillRgb[2] + (255 - fillRgb[2]) * intensity * 0.9));

  const a0 = (intensity * 0.85).toFixed(3);
  const a1 = (intensity * 0.40).toFixed(3);

  const grad = dc.createRadialGradient(cx, cy, 0, cx, cy, halfDiag);
  grad.addColorStop(0.00, `rgba(${br},${bg},${bb},${a0})`);
  grad.addColorStop(0.55, `rgba(${br},${bg},${bb},${a1})`);
  grad.addColorStop(1.00, `rgba(${br},${bg},${bb},0)`);

  dc.fillStyle = grad;
  dc.fillRect(cx - rw/2, cy - rh/2, rw, rh);
}

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
  dc.fill();
}

// ── renderRect ───────────────────────────────────────────────
function renderRect(p, rx, ry, rw, rh, fillStyle, fillRgb, flipX, flipY) {
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

  // Inner shadow — defined edge within clip, no background bleed
  applyInnerShadowRect(dc, rx, ry, rw, rh, flipX, flipY);

  // Inner glow — gradient-only radial, no filters
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

  // Inner shadow — defined edge within clip
  applyInnerShadowCircle(dc, cx, cy, radius);

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
  const ef = state.barFlipGradient ? !flip : flip;
  const t = ef ? 1 - fillT : fillT;
  return sampleGradient(t, state.gradientStops).map(Math.round);
}

// ── _withHeadlineBoundsIfFilled ───────────────────────────────
// When fill-behind-text is enabled, the headline fill box defines a
// new TOP BOUND for the composition: the composition draws between
// the bottom edge of the fill box and the bottom of the canvas.
// Original proportions/behavior preserved — only the reference frame
// shifts. Restores cw/ch after fn() returns.
function _withHeadlineBoundsIfFilled(p, fn) {
  if (!state.headlineFillEnabled) { fn(); return; }
  const bbox = getHeadlineBBox();
  if (!bbox) { fn(); return; }
  const topBound = bbox.y + bbox.h;
  const newH = ch - topBound;
  if (newH < 4) { fn(); return; }
  const dc = p.drawingContext;
  dc.save();
  dc.beginPath();
  dc.rect(0, topBound, cw, newH);
  dc.clip();
  dc.translate(0, topBound);
  const _ch = ch;
  ch = newH;
  try { fn(); } finally {
    ch = _ch;
    dc.restore();
  }
}

// ── renderComposition ────────────────────────────────────────
function renderComposition(p) {
  _withHeadlineBoundsIfFilled(p, () => _renderCompositionImpl(p));
}

function _renderCompositionImpl(p) {
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
    const isPastCenter = count > 1 && (i >= count / 2);
    const symFlip = sym && isPastCenter;
    let tVal = getCurveValue(tCurve, state.curveType);
    if (state.flipCurve) tVal = 1 - tVal;

    const growth = maxGrowth * Math.max(0.03, tVal);
    const alpha  = state.opacity;
    const fillT  = count > 1 ? i / (count - 1) : 0;
    const slotC  = spacing + slotSize / 2 + i * (slotSize + spacing);

    const rects = [];
    if (dir === 'bottom') {
      rects.push({ rx: slotC-slotSize/2, ry: ch-growth, rw: slotSize, rh: growth, flipX: symFlip, flipY: false, fillFlip: false });
      if (mirror) rects.push({ rx: slotC-slotSize/2, ry: 0, rw: slotSize, rh: growth, flipX: symFlip, flipY: true, fillFlip: true });
    } else if (dir === 'top') {
      rects.push({ rx: slotC-slotSize/2, ry: 0, rw: slotSize, rh: growth, flipX: symFlip, flipY: false, fillFlip: false });
      if (mirror) rects.push({ rx: slotC-slotSize/2, ry: ch-growth, rw: slotSize, rh: growth, flipX: symFlip, flipY: true, fillFlip: true });
    } else if (dir === 'left') {
      rects.push({ rx: 0, ry: slotC-slotSize/2, rw: growth, rh: slotSize, flipX: false, flipY: symFlip, fillFlip: false });
      if (mirror) rects.push({ rx: cw-growth, ry: slotC-slotSize/2, rw: growth, rh: slotSize, flipX: true, flipY: symFlip, fillFlip: true });
    } else {
      rects.push({ rx: cw-growth, ry: slotC-slotSize/2, rw: growth, rh: slotSize, flipX: false, flipY: symFlip, fillFlip: false });
      if (mirror) rects.push({ rx: 0, ry: slotC-slotSize/2, rw: growth, rh: slotSize, flipX: true, flipY: symFlip, fillFlip: true });
    }

    rects.forEach(({ rx, ry, rw, rh, flipX, flipY, fillFlip }) => {
      const fill    = computeRectFill(dc, fillT, rx, ry, rw, rh, alpha, fillFlip);
      const fillRgb = state.innerGlow ? extractFillRgb(fillT, fillFlip) : null;
      renderRect(p, rx, ry, rw, rh, fill, fillRgb, flipX, flipY);
    });
  }
}

// ── getHeadlineBBox ──────────────────────────────────────────
// Returns headline bounding box in canvas coordinates {x,y,w,h}.
function getHeadlineBBox() {
  const artboard = document.getElementById('artboard');
  const headline = document.getElementById('overlay-headline');
  if (!artboard || !headline || !state.showHeadline) return null;
  const ab = artboard.getBoundingClientRect();
  const hb = headline.getBoundingClientRect();
  if (ab.width === 0) return null;
  const scale = cw / ab.width;
  return {
    x: (hb.left - ab.left) * scale,
    y: (hb.top  - ab.top)  * scale,
    w: hb.width  * scale,
    h: hb.height * scale,
  };
}

// ── renderCircularComposition ────────────────────────────────
function renderCircularComposition(p) {
  _withHeadlineBoundsIfFilled(p, () => _renderCircularCompositionImpl(p));
}

function _renderCircularCompositionImpl(p) {
  const count = Math.max(2, Math.floor(state.circleCount));
  const maxD  = state.circleDiameter;
  // Smallest circle = 25 % of max (floored at 60 px) so it stays visible.
  const minD  = Math.max(60, maxD * 0.25);
  const maxR  = maxD / 2;
  const minR  = minD / 2;
  const dc    = p.drawingContext;
  const align = state.circleAlignment;

  // ── Reference radius ──────────────────────────────────────────
  // refR controls which circle sits exactly at the anchor boundary.
  //   false (default) → refR = maxR : largest circle's edge at boundary,
  //                                   smaller circles nest inside.
  //   true  (flip)    → refR = minR : smallest circle's edge at boundary,
  //                                   larger circles bleed beyond it.
  const refR = state.circleFlipAnchor ? minR : maxR;

  // ── Gradient direction for this composition ───────────────────
  // Mirrors in the opposite axis must flip the gradient so the reflected
  // copy looks like a true mirror image rather than a repeat.
  // Direction matches what computeRectFill derives from baseline.
  const circGradDir = (state.baseline === 'left' || state.baseline === 'right') ? 'horizontal' : 'vertical';

  // ── Anchor centre ─────────────────────────────────────────────
  let anchorX = cw / 2, anchorY = ch / 2;

  if (state.circleTextLink) {
    const bbox = getHeadlineBBox();
    if (bbox) {
      // Auto-pad = half the measured text-box height (scales with text size).
      // circleTextPadding adds extra pixels on top for fine-tuning.
      const autoPad = Math.round(bbox.h * 0.5) + state.circleTextPadding;
      anchorX = bbox.x + bbox.w + autoPad;
    }
  } else {
    if      (align.includes('left'))  anchorX = refR;
    else if (align.includes('right')) anchorX = cw - refR;
  }
  if      (align.includes('top'))    anchorY = refR;
  else if (align.includes('bottom')) anchorY = ch - refR;

  // ── Mirror mode: move anchor so largest circles just touch at centre ──
  // Without this, large circles with a central anchor can overlap their
  // reflected copies. The rule: anchor the largest circle so its inner edge
  // is exactly at the canvas midline (spacing = 0), then let circleSpacingX/Y
  // add gap naturally via the direction-based offset in moveAndDraw.
  if (state.circleMirrorXY) {
    if      (align.includes('bottom')) anchorY = ch / 2 + maxR;
    else if (align.includes('top'))    anchorY = ch / 2 - maxR;
    if      (align.includes('right'))  anchorX = cw / 2 + maxR;
    else if (align.includes('left'))   anchorX = cw / 2 - maxR;
  }

  // ── Stagger ───────────────────────────────────────────────────
  // Auto mode: stagger = diameter ÷ 2.68656 (fixed visual ratio).
  // Manual mode: use state.circleStagger directly.
  // Each circle is offset from the anchor toward the canvas centre by
  // (fillT × effectiveStagger).  fillT = 0 → largest at anchor;
  // fillT = 1 → smallest furthest inward.
  const staggerDirX = Math.sign(cw / 2 - anchorX);
  const staggerDirY = Math.sign(ch / 2 - anchorY);

  // Mirror-mode guard: cap stagger so no circle crosses the canvas midpoint,
  // guaranteeing the two reflected groups never overlap.
  let effectiveStagger = state.circleStaggerAuto
    ? state.circleDiameter / 2.68656
    : state.circleStagger;
  if (state.circleMirrorXY && effectiveStagger > 0) {
    if (staggerDirX !== 0)
      effectiveStagger = Math.min(effectiveStagger, Math.max(0, Math.abs(anchorX - cw / 2)));
    if (staggerDirY !== 0)
      effectiveStagger = Math.min(effectiveStagger, Math.max(0, Math.abs(anchorY - ch / 2)));
  }

  for (let i = 0; i < count; i++) {
    const fillT    = count > 1 ? i / (count - 1) : 0;
    const currentD = maxD - (maxD - minD) * fillT;   // largest → smallest
    const R        = currentD / 2;

    // Per-circle centre: stagger shifts each ring inward from the anchor.
    const cx = anchorX + staggerDirX * effectiveStagger * fillT;
    const cy = anchorY + staggerDirY * effectiveStagger * fillT;

    // isHMirror / isVMirror drive gradient flip so the reflected copy is a
    // true mirror image. For a horizontal gradient, flipping H reverses it;
    // for a vertical gradient, flipping V reverses it.
    function moveAndDraw(px, py, isHMirror = false, isVMirror = false) {
      const vx = px - cw / 2, vy = py - ch / 2;
      const dx = Math.abs(vx) < 0.5 ? 0 : Math.sign(vx);
      const dy = Math.abs(vy) < 0.5 ? 0 : Math.sign(vy);
      const finalX = px + dx * state.circleSpacingX;
      const finalY = py + dy * state.circleSpacingY;

      const gradFlip = circGradDir === 'horizontal' ? isHMirror : isVMirror;
      const alpha    = state.opacity;
      const fill     = computeRectFill(dc, fillT, finalX - R, finalY - R, currentD, currentD, alpha, gradFlip);
      const fillRgb  = state.innerGlow ? extractFillRgb(fillT, gradFlip) : null;
      renderCircle(p, finalX, finalY, R, fill, fillRgb);
    }

    moveAndDraw(cx, cy, false, false);

    if (state.circleMirrorXY) {
      // Reflect the staggered (cx, cy) around the canvas midpoint.
      const mx = cw - cx;
      const my = ch - cy;
      const notCenterH = Math.abs(cx - cw / 2) > 0.5;
      const notCenterV = Math.abs(cy - ch / 2) > 0.5;
      if (notCenterH)               moveAndDraw(mx, cy, true,  false);
      if (notCenterV)               moveAndDraw(cx, my, false, true);
      if (notCenterH && notCenterV) moveAndDraw(mx, my, true,  true);
    }
  }
}

// ── Background-image preloader ────────────────────────────────
// Loads the two preset images once at startup. Each onload triggers a
// redraw so the canvas updates as soon as the file arrives.
const _bgPresetImages = { dark: null, light: null };
(function () {
  const load = (key, src) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      _bgPresetImages[key] = img;
      if (window._p5Redraw) window._p5Redraw();
    };
  };
  load('dark',  'Background%20Presets/BG-Dark.png');
  load('light', 'Background%20Presets/BG-Light.png');
}());

// ── renderImageComposition ────────────────────────────────────
// Draws the selected preset image cover-fitted to the full canvas.
// Opacity is controlled via state.imagePresetOpacity (default 1.0).
function renderImageComposition(p) {
  const dc    = p.drawingContext;
  const alpha = state.imagePresetOpacity;
  const img   = _bgPresetImages[state.imagePresetSelected] || null;

  if (!img) {
    // Placeholder while image is loading
    dc.fillStyle = `rgba(60,60,70,${alpha})`;
    dc.fillRect(0, 0, cw, ch);
    return;
  }

  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const sw    = img.naturalWidth  * scale;
  const sh    = img.naturalHeight * scale;
  const ox    = (cw - sw) / 2;
  const oy    = (ch - sh) / 2;

  dc.save();
  dc.globalAlpha = alpha;
  dc.drawImage(img, ox, oy, sw, sh);
  dc.restore();
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
      if (state.compositionType === 'image') {
        // Image composition handles its own opacity internally — bypass globalOpacity buffer
        renderImageComposition(p);
      } else if (state.globalOpacity) {
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

  // ── Export: pure canvas compositor ──────────────────────────
  // Replaces html2canvas to guarantee backdrop-filter, gradient BG,
  // and images all render identically to what is seen on screen.

  // Load an image element by src, reusing it if already decoded.
  function _loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error('img load failed: ' + src));
      img.src = src;
    });
  }

  // Rounded-rectangle path helper.
  function _rrPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  // Returns element's bounding rect mapped to export-canvas coordinates.
  function _xRect(el, ab, ES) {
    const r = el.getBoundingClientRect();
    return {
      x: (r.left - ab.left) * ES,
      y: (r.top  - ab.top)  * ES,
      w: r.width  * ES,
      h: r.height * ES,
    };
  }

  async function _drawImages(ctx, ab, ES) {
    const overlay = document.getElementById('overlay-image');
    if (!overlay || overlay.style.display === 'none') return;

    const DESIGN_W = 2696;
    const scale    = (ab.width / DESIGN_W) * ES;
    const bw       = state.imageStrokeWeight * scale;
    const op       = state.imageStrokeOp;
    const rad      = Math.min(40, Math.max(0, state.imageRadius)) * scale;
    const strokeColor = state.imageStrokeStyle === 'frosty'
      ? `rgba(220,235,255,${op})`
      : `rgba(104,58,39,${op})`;

    const instances = overlay.querySelectorAll('.img-instance');
    // Sort by CSS z-index ascending so the HIGHEST z-index (front) is drawn last,
    // matching the CSS stagger where element 0 has z-index=count (frontmost).
    const targets = (instances.length > 0 ? Array.from(instances) : [overlay])
      .sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));

    for (const el of targets) {
      const rect = _xRect(el, ab, ES);
      if (rect.w < 1 || rect.h < 1) continue;

      // Background
      _rrPath(ctx, rect.x, rect.y, rect.w, rect.h, rad);
      ctx.fillStyle = '#171717';
      ctx.fill();

      // Image content
      const imgEl = el.querySelector('img');
      const imgSrc = imgEl && imgEl.src && !imgEl.src.endsWith('#') ? imgEl.src : null;
      if (imgSrc) {
        try {
          // Reuse the already-decoded image when possible.
          const loaded = (imgEl.complete && imgEl.naturalWidth > 0)
            ? imgEl
            : await _loadImg(imgSrc);
          ctx.save();
          const ir  = Math.max(0, rad - bw);
          const dw  = rect.w - bw * 2;
          const dh  = rect.h - bw * 2;
          _rrPath(ctx, rect.x + bw, rect.y + bw, dw, dh, ir);
          ctx.clip();
          // Fill / cover mode — scale to fill, crop to fit (matches object-fit:cover)
          const iw  = loaded.naturalWidth  || dw;
          const ih  = loaded.naturalHeight || dh;
          const s   = Math.max(dw / iw, dh / ih);
          const sw  = iw * s;
          const sh  = ih * s;
          const ox  = rect.x + bw + (dw - sw) / 2;
          const oy  = rect.y + bw + (dh - sh) / 2;
          ctx.drawImage(loaded, ox, oy, sw, sh);
          ctx.restore();
        } catch (_) { /* image missing — leave dark bg */ }
      }

      // Border
      if (op > 0 && bw > 0) {
        ctx.save();
        _rrPath(ctx, rect.x + bw / 2, rect.y + bw / 2, rect.w - bw, rect.h - bw, Math.max(0, rad - bw / 2));
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth   = bw;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  async function _drawFooter(ctx, ab, ES) {
    const footEl = document.getElementById('overlay-footer');
    if (!footEl || footEl.style.display === 'none') return;

    const rect     = _xRect(footEl, ab, ES);
    const DESIGN_W = 2696;
    const scale    = (ab.width / DESIGN_W) * ES;

    // ── Replicate backdrop-filter: blur(100px) + rgba(0,0,0,0.6) ──
    // 1. Snapshot everything already drawn on the export canvas.
    // 2. Clip to footer rect, redraw snapshot through a blur filter —
    //    this is the canvas equivalent of backdrop-filter: blur().
    // 3. Overlay rgba(0,0,0,0.6) to match the CSS background colour.
    // CSS backdrop-filter:blur(100px) → 100 CSS-px × ES = export canvas pixels.
    // (ab.width/2696 was wrong — the CSS blur value is in viewport px, not design units.)
    const blurRadius = 100 * ES;
    const snap = document.createElement('canvas');
    snap.width  = ctx.canvas.width;
    snap.height = ctx.canvas.height;
    snap.getContext('2d').drawImage(ctx.canvas, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(snap, 0, 0);
    ctx.restore();

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Inset top highlight (matches CSS inset box-shadow)
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(rect.x, rect.y, rect.w, Math.max(1, 4 * scale));

    const padL      = 45 * scale;
    const padR      = 48.6 * scale;
    const fontSize  = 54.517 * scale;
    const tracking  = -1.6355 * scale;
    const textColor = state.footerTextColor || '#ffffff';

    await document.fonts.ready;

    // ── Footer byline ──────────────────────────────────────────
    ctx.save();
    ctx.font         = `${state.footerFont} ${fontSize}px "Innovator Grotesk", sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
    ctx.fillStyle    = textColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = state.footerAlign === 'right'  ? 'right'  :
                       state.footerAlign === 'center' ? 'center' : 'left';

    const textX = state.footerAlign === 'right'  ? rect.x + rect.w - padR :
                  state.footerAlign === 'center' ? rect.x + rect.w / 2   :
                  rect.x + padL;
    ctx.fillText(state.footerByline, textX, rect.y + rect.h / 2);
    ctx.restore();

    // ── Logo ───────────────────────────────────────────────────
    try {
      const logo  = await _loadImg('img/pai-wordmark.svg');
      const logoH = 71.51 * scale;
      const logoW = logo.naturalWidth * (logoH / logo.naturalHeight);
      ctx.drawImage(logo, rect.x + rect.w - padR - logoW, rect.y + (rect.h - logoH) / 2, logoW, logoH);
    } catch (_) { /* logo missing — skip */ }
  }

  function _drawHeadline(ctx, ab, ES) {
    const headEl = document.getElementById('overlay-headline');
    if (!headEl || headEl.style.display === 'none') return;

    const DESIGN_W  = 2696;
    const scale     = (ab.width / DESIGN_W) * ES;
    const EW        = ab.width * ES;
    const fontSize  = state.headlineFontSize * scale;
    const tracking  = state.headlineTracking  * scale;
    const padL      = state.headlinePadding   * scale;
    const padR      = state.headlinePadding   * scale;
    const textColor = state.headlineTextColor || '#ffffff';
    const lineH     = fontSize * state.headlineLineHeight;

    // ── Fill background (uses overlay bounding rect — includes padding) ──
    const headRect   = _xRect(headEl, ab, ES);
    const textEl     = document.getElementById('headline-text');
    // textEl's y already accounts for fill padding-top or headlineYPos offset
    const textStartY = textEl ? _xRect(textEl, ab, ES).y : headRect.y;

    if (state.headlineFillEnabled) {
      const [fr, fg, fb] = hexToRgb(state.headlineFillColor || '#000000');
      ctx.fillStyle = `rgba(${fr},${fg},${fb},${state.headlineFillOpacity})`;
      ctx.fillRect(headRect.x, headRect.y, headRect.w, headRect.h);
    }

    ctx.save();
    ctx.font         = `${state.headlineFont} ${fontSize}px "Innovator Grotesk", sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
    ctx.textBaseline = 'top';
    ctx.textAlign    = 'left'; // always left; we compute x manually per line

    // Available text width mirrors the DOM element's rendered width exactly,
    // so canvas word-wrap matches the CSS pre-wrap line breaks.
    const availW = textEl
      ? textEl.getBoundingClientRect().width * ES
      : EW - padL - padR;

    // ── Word-wrap a single paragraph to fit availW ────────────
    function _wrapPara(para) {
      if (!para) return [''];
      const words = para.split(' ');
      const out   = [];
      let cur     = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (cur && ctx.measureText(test).width > availW) {
          out.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) out.push(cur);
      return out;
    }

    // Respect explicit \n breaks, then word-wrap each paragraph
    const wrappedLines = (state.headlineText || '')
      .split('\n')
      .flatMap(_wrapPara);

    // ── Highlight word set ────────────────────────────────────
    const hlWordSet = parseHighlightWords(state.headlineHighlightWords);
    const hlColor   = state.headlineHighlightColor || '#f66a24';

    const align = state.headlineAlign || 'center';

    // X origin for a line given its full measured width
    function _lineX(lineW) {
      if (align === 'center') return (EW - lineW) / 2;
      if (align === 'right')  return EW - padR - lineW;
      return padL;
    }

    // ── Draw each wrapped line ────────────────────────────────
    let y = textStartY;
    for (const line of wrappedLines) {
      if (!line) { y += lineH; continue; }

      const lineW    = ctx.measureText(line).width;
      const lineWordsArr = line.split(' ');
      const hasHL    = hlWordSet.size > 0 &&
                       lineWordsArr.some(w => hlWordSet.has(normalizeHighlightKey(w)));

      if (!hasHL) {
        // Fast path: draw the whole line at once
        ctx.fillStyle = textColor;
        ctx.fillText(line, _lineX(lineW), y);
      } else {
        // Slow path: draw word-by-word so highlights get a different colour
        let x = _lineX(lineW);
        lineWordsArr.forEach((word, i) => {
          if (i > 0) {
            ctx.fillStyle = textColor;
            ctx.fillText(' ', x, y);
            x += ctx.measureText(' ').width;
          }
          ctx.fillStyle = hlWordSet.has(normalizeHighlightKey(word)) ? hlColor : textColor;
          ctx.fillText(word, x, y);
          x += ctx.measureText(word).width;
        });
      }

      y += lineH;
    }

    ctx.restore();
  }

  window._exportCanvas = async () => {
    const ES  = 2;                      // export pixel multiplier (2× = retina)
    const EW  = cw * ES;
    const EH  = ch * ES;
    const artboard = document.getElementById('artboard');
    if (!artboard) return;
    const ab = artboard.getBoundingClientRect();

    // 1. Create export canvas
    const exp = document.createElement('canvas');
    exp.width  = EW;
    exp.height = EH;
    const ctx  = exp.getContext('2d');

    // 2. Draw p5 canvas (background + graphics)
    const p5c = document.querySelector('#p5-target canvas');
    if (p5c) ctx.drawImage(p5c, 0, 0, EW, EH);

    // 3. Composite overlays: image → headline → footer (top-most last)
    try {
      if (state.showImage)    await _drawImages(ctx, ab, ES);
      if (state.showHeadline)       _drawHeadline(ctx, ab, ES);
      if (state.showFooter)  await _drawFooter(ctx, ab, ES);
    } catch (err) {
      console.warn('Export overlay error:', err);
    }

    // 4. Emit PNG
    exp.toBlob(blob => {
      if (!blob) { console.error('Export toBlob failed'); return; }
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `generative-${Date.now()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
};

new p5(sketch);
