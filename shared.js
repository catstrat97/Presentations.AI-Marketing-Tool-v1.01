// ── shared.js ─────────────────────────────────────────────────
// Loaded first. Globals: state, getCurveValue, sampleGradient,
// hexToRgb, lerpColor, rgbToHex, hslToHex, ASPECT_RATIOS,
// addGradientStop, subdivideGradient, PALETTES, BG_PALETTE_MAP

const ASPECT_RATIOS = {
  '1:1':  { w: 1, h: 1 },
  '4:5':  { w: 4, h: 5 },
  '16:9': { w: 16, h: 9 },
  '9:16': { w: 9, h: 16 },
  '1.91:1': { w: 1.91, h: 1 },
};

// ── Built-in Palettes ────────────────────────────────────────
const PALETTES = {
  custom: { label: 'Custom', stops: null },

  marketingWarm: {
    label: 'Marketing Warm',
    tone: 'warm',
    stops: [
      { stop: 0.00, color: '#ffb96e' },
      { stop: 0.20, color: '#ffa958' },
      { stop: 0.40, color: '#f66a24' },
      { stop: 0.60, color: '#f65324' },
      { stop: 0.80, color: '#df490b' },
      { stop: 1.00, color: '#c72405' },
    ],
  },

  marketingCool: {
    label: 'Marketing Cool',
    tone: 'cool',
    stops: [
      { stop: 0.00, color: '#cae2ff' },
      { stop: 0.20, color: '#a6d0ff' },
      { stop: 0.40, color: '#66a8ff' },
      { stop: 0.60, color: '#4374b9' },
      { stop: 0.80, color: '#23303b' },
      { stop: 1.00, color: '#002156' },
    ],
  },

  arctic: {
    label: 'Arctic',
    tone: 'cool',
    stops: [
      { stop: 0.0, color: '#c8e6ff' },
      { stop: 0.5, color: '#7ec8f7' },
      { stop: 1.0, color: '#1e88e5' },
    ],
  },
};

// ── Background Presets — filtered by palette tone ────────────
const BG_PALETTE_MAP = {
  warm: [
    { color: '#FFF0E5', label: 'Warm White' },
    { color: '#FFB96E', label: 'Sand' },
    { color: '#F66A24', label: 'Orange' },
    { color: '#F65324', label: 'Flame' },
    { color: '#DF490B', label: 'Ember' },
    { color: '#C72405', label: 'Brick' },
    { color: '#361E1C', label: 'Dark Umber' },
  ],
  cool: [
    { color: '#CAE2FF', label: 'Ice Blue' },
    { color: '#A6D0FF', label: 'Powder' },
    { color: '#66A8FF', label: 'Cornflower' },
    { color: '#4374B9', label: 'Steel' },
    { color: '#23303B', label: 'Slate' },
    { color: '#002156', label: 'Deep Navy' },
    { color: '#000D1F', label: 'Abyss' },
  ],
  custom: [
    { color: '#FEFEFF', label: 'White' },
    { color: '#FFF0E5', label: 'Warm White' },
    { color: '#F66A24', label: 'Orange' },
    { color: '#CAE2FF', label: 'Sky Blue' },
    { color: '#23303B', label: 'Slate' },
    { color: '#000E22', label: 'Navy' },
    { color: '#010101', label: 'Black' },
  ],
};

// ── Image Presets Registry ────────────────────────────────────
const IMAGE_STYLES = {
  style1: [
    'Image Presets/Style 1/Frame 2147229599.png',
    'Image Presets/Style 1/Frame 2147229600.png',
    'Image Presets/Style 1/Granola Series A Pitch Deck \u2014 Risk \u2014 Data Privacy Framework.png',
    'Image Presets/Style 1/Marriott Annual Board Review \u2014 Cover \u2014 Image BG Centered Logos.png',
    'Image Presets/Style 1/Solar Ops \u2014 Competitive Landscape \u2014 2x2 Quadrant.png',
  ],
  style2: [
    'Image Presets/Style 2/Ogilvy Capabilities Deck \u2014 Cover \u2014 Dark Image BG.png',
  ],
  style3: [
    'Image Presets/Style 3/Granola Series A Pitch Deck \u2014 Financial \u2014 ARR Growth.png',
  ],
  style4: [
    'Image Presets/Style 4/Frame 2147229599.png',
    'Image Presets/Style 4/Frame 2147229600.png',
    'Image Presets/Style 4/Granola Series A Pitch Deck \u2014 Chart \u2014 User Growth.png',
    'Image Presets/Style 4/Granola Series A Pitch Deck \u2014 Risk \u2014 Data Privacy Framework.png',
    'Image Presets/Style 4/Marriott Annual Board Review \u2014 Cover \u2014 Image BG Centered Logos.png',
  ],
  style5: [
    'Image Presets/Style 5/Marriott Annual Board Review \u2014 Goals \u2014 Strategic Priorities.png',
    'Image Presets/Style 5/Martin Casado Conference Keynote \u2014 Cover \u2014 Image Top Title Below.png',
    'Image Presets/Style 5/Rippling Sales Deck \u2014 Risk \u2014 Compliance Gap Analysis.png',
    'Image Presets/Style 5/Rippling Sales Deck \u2014 Timeline \u2014 Horizontal 3-Node.png',
    'Image Presets/Style 5/Shopify All Hands Meeting \u2014 DataTable \u2014 Product Launches.png',
  ],
};

// ── Centralized State ────────────────────────────────────────
const state = {
  aspectRatio: '1:1',

  compositionType: 'rectangle',      // 'rectangle' | 'circular'

  // Rectangle Composition
  rectCount:  12,
  spacing:    0,
  curveType:  'parabolic',
  flipCurve:  false,
  symmetry:   true,
  mirrorY:    false,
  baseline:   'bottom',

  // Circular Composition
  circleCount:      12,
  circleDiameter:   600,
  circleAlignment:  'bottom-center',
  circleMirrorXY:   false,
  circleSpacingX:   0,
  circleSpacingY:   0,
  circleFlipAnchor: false,
  circleStagger:    0,
  circleTextLink:   false,
  circleTextPadding: 0,

  // Shared
  gradientDirection: 'horizontal',
  extent:            0.85,

  palette: 'marketingWarm',
  gradientStops: JSON.parse(JSON.stringify(PALETTES.marketingWarm.stops)),

  opacity:      0.88,
  globalOpacity: false,
  blur:         0,
  bgColor:      '#0c0c0f',

  // ── Inner Glow (no spread — uniform across entire shape) ──
  innerGlow:          false,
  innerGlowIntensity: 0.6,

  // ── Depth Shadow (now edge highlight reflection) ──
  depthShadow: true,
  dsSpread: 0.28,
  dsOpacity: 0.50,

  // Layout Overlays
  showGraphics: true,
  showHeadline: true,
  headlineLine1:      'Start with a prompt',
  headlineLine2:      'End with a presentation',
  headlineAlign:      'center',
  headlineTracking:   -4.8,
  headlineLineHeight: 1.1,
  headlineFontSize:   120,
  headlineFont:       '400',
  headlineYPos:       206.36,
  headlinePadding:    0,

  showImage:       true,
  imageSrc:        '',
  imageScale:      1.0,
  imageYOffset:    0,
  imageStrokeStyle: 'marketing',
  imageRadius:     12,              // clamped 0–40 in GUI
  imageStrokeOp:   1.0,
  imageStrokeWeight: 20,

  // Image Distribution
  imageMulti:       false,
  imageDistMode:    'horizontal',
  imageMultiCount:  3,
  imageMultiSpacing: 40,

  // Image Presets
  imageStyle:       'style1',
  imageStyleIndex:  0,
  imageStyleOrder:  null,

  showFooter:      true,
  footerByline:    'Start for free today',
  footerAlign:     'left',
  footerTracking:  -1.63,
  footerFont:      '500',
};

// ── Helpers ──────────────────────────────────────────────────

/** Returns luma (0–255) for a hex color */
function getColorLuma(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Returns 'black' or 'white' for text over the given bg hex */
function getTextColorForBg(hex) {
  return getColorLuma(hex) > 140 ? '#000000' : '#ffffff';
}

/** Returns the current palette tone ('warm' | 'cool' | 'custom') */
function getPaletteTone() {
  const p = PALETTES[state.palette];
  return (p && p.tone) ? p.tone : 'custom';
}

/** Returns the BG preset list appropriate for the current palette */
function getActiveBgPresets() {
  return BG_PALETTE_MAP[getPaletteTone()] || BG_PALETTE_MAP.custom;
}

// ── Curve ────────────────────────────────────────────────────
function _bx(t, p1x, p2x) { return 3*p1x*t*(1-t)*(1-t) + 3*p2x*t*t*(1-t) + t*t*t; }
function _by(t, p1y, p2y) { return 3*p1y*t*(1-t)*(1-t) + 3*p2y*t*t*(1-t) + t*t*t; }
function cubicBezier(t, p1x, p1y, p2x, p2y) {
  let tg = t;
  for (let i = 0; i < 8; i++) {
    const err = _bx(tg, p1x, p2x) - t;
    const d   = 3*p1x*(1-tg)*(1-tg) + 6*(p2x-p1x)*tg*(1-tg) + 3*(1-p2x)*tg*tg;
    if (Math.abs(d) < 1e-6) break;
    tg = Math.max(0, Math.min(1, tg - err / d));
  }
  return _by(tg, p1y, p2y);
}

function getCurveValue(t, type) {
  if (type === 'flat') return 1;
  switch (type) {
    case 'linear':     return t;
    case 'quadratic':  return t * t;
    case 'cubic':      return t * t * t;
    case 'parabolic':  return 1 - Math.pow(2 * t - 1, 2);
    case 'hyperbolic': return (t / (1 - 0.85 * t)) / (1 / (1 - 0.85));
    case 'bezier':     return cubicBezier(t, 0.42, 0, 0.58, 1);
    default:           return t;
  }
}

// ── Color Utilities ──────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
}
function lerpColor(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}
function hslToHex(h, s, l) {
  s/=100; l/=100;
  const a = s * Math.min(l, 1-l);
  const f = n => { const k=(n+h/30)%12, v=l-a*Math.max(-1,Math.min(k-3,9-k,1)); return Math.round(v*255).toString(16).padStart(2,'0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ── Gradient Sampling ────────────────────────────────────────
function sampleGradient(t, stops) {
  if (!stops || !stops.length) return [255,255,255];
  const s = [...stops].sort((a,b) => a.stop - b.stop);
  if (t <= s[0].stop)           return hexToRgb(s[0].color);
  if (t >= s[s.length-1].stop) return hexToRgb(s[s.length-1].color);
  for (let i = 0; i < s.length-1; i++) {
    if (t >= s[i].stop && t <= s[i+1].stop) {
      const lt = (t - s[i].stop) / (s[i+1].stop - s[i].stop);
      return lerpColor(hexToRgb(s[i].color), hexToRgb(s[i+1].color), lt);
    }
  }
  return hexToRgb(s[s.length-1].color);
}

// ── Gradient Stop Helpers ────────────────────────────────────
function addGradientStop(position) {
  const t = Math.max(0, Math.min(1, position));
  const rgb = sampleGradient(t, state.gradientStops);
  state.gradientStops.push({ stop: t, color: rgbToHex(...rgb) });
  state.gradientStops.sort((a,b) => a.stop - b.stop);
}

function subdivideGradient(n) {
  const sorted = [...state.gradientStops].sort((a,b) => a.stop - b.stop);
  const result = [...sorted];
  for (let i = 0; i < sorted.length-1; i++) {
    const s0 = sorted[i].stop, s1 = sorted[i+1].stop;
    for (let j = 1; j <= n; j++) {
      const t   = s0 + (s1 - s0) * (j / (n+1));
      const rgb = sampleGradient(t, state.gradientStops);
      result.push({ stop: +t.toFixed(3), color: rgbToHex(...rgb) });
    }
  }
  state.gradientStops = result.sort((a,b) => a.stop - b.stop);
}

function applyPalette(key) {
  const p = PALETTES[key];
  if (!p || !p.stops) return;
  state.gradientStops = JSON.parse(JSON.stringify(p.stops));
}

// ── Image Style Helpers ──────────────────────────────────────
function getStyleImages() {
  const order = state.imageStyleOrder;
  const imgs  = IMAGE_STYLES[state.imageStyle] || [];
  if (!order || order.length !== imgs.length) return imgs;
  return order.map(i => imgs[i]);
}

function shuffleStyleImages() {
  const imgs = IMAGE_STYLES[state.imageStyle] || [];
  const idx  = imgs.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  state.imageStyleOrder = idx;
}
