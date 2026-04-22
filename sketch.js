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

  // ── Stagger ───────────────────────────────────────────────────
  // Each circle is offset from the anchor toward the canvas centre by
  // (fillT × effectiveStagger).  fillT = 0 → largest at anchor;
  // fillT = 1 → smallest furthest inward.
  //
  // Direction is always from the anchor toward the canvas midpoint,
  // so the composition fans inward regardless of which anchor is chosen.
  const staggerDirX = Math.sign(cw / 2 - anchorX);
  const staggerDirY = Math.sign(ch / 2 - anchorY);

  // Mirror-mode guard: cap stagger so no circle crosses the canvas midpoint,
  // guaranteeing the two reflected groups never overlap.
  // (circles may still bleed outside the canvas — size is never deformed.)
  let effectiveStagger = state.circleStagger;
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

    function moveAndDraw(px, py, flipX = false) {
      const vx = px - cw / 2, vy = py - ch / 2;
      const dx = Math.abs(vx) < 0.5 ? 0 : Math.sign(vx);
      const dy = Math.abs(vy) < 0.5 ? 0 : Math.sign(vy);
      const finalX = px + dx * state.circleSpacingX;
      const finalY = py + dy * state.circleSpacingY;

      const alpha   = state.opacity;
      const fill    = computeRectFill(dc, fillT, finalX - R, finalY - R, currentD, currentD, alpha, flipX);
      const fillRgb = state.innerGlow ? extractFillRgb(fillT, flipX) : null;
      renderCircle(p, finalX, finalY, R, fill, fillRgb);
    }

    moveAndDraw(cx, cy, false);

    if (state.circleMirrorXY) {
      // Reflect the staggered (cx, cy) around the canvas midpoint.
      // Because stagger is capped above, the reflected group cascades
      // symmetrically from the opposite edge with no overlap.
      const mx = cw - cx;
      const my = ch - cy;
      const notCenterH = Math.abs(cx - cw / 2) > 0.5;
      const notCenterV = Math.abs(cy - ch / 2) > 0.5;
      if (notCenterH)               moveAndDraw(mx, cy, true);
      if (notCenterV)               moveAndDraw(cx, my, false);
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

  // ── Export: rasterize artboard (p5 canvas + HTML overlays) ──
  window._exportCanvas = () => {
    const artboard = document.getElementById('artboard');
    if (!artboard) return;

    html2canvas(artboard, {
      backgroundColor: state.bgColor,
      useCORS: true,
      allowTaint: true,
      scale: 2,
      logging: false,
      imageTimeout: 0,
      removeContainer: true,
      ignoreElements: (el) => el.id === 'panel' || el.classList.contains('ignore-export'),
    }).then(canvas => {
      canvas.toBlob(blob => {
        if (!blob) throw new Error('Canvas toBlob failed');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `generative-${Date.now()}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    }).catch(err => {
      console.error('Export failed:', err);
      // Fallback: export just the p5 canvas if html2canvas chokes (e.g. tainted)
      const p5canvas = document.querySelector('#p5-target canvas');
      if (p5canvas) {
        p5canvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link2 = document.createElement('a');
          link2.download = `generative-shapes-${Date.now()}.png`;
          link2.href = url;
          document.body.appendChild(link2);
          link2.click();
          document.body.removeChild(link2);
          URL.revokeObjectURL(url);
        }, 'image/png');
      }
    });
  };
};

new p5(sketch);
