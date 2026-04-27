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

// ── Per-Aspect-Ratio Layout Defaults ────────────────────────
// Applied automatically when the user switches aspect ratio.
// All values use the 2696px design-unit coordinate system
// (same as the CSS --scale calculations).
//
// 1:1 values derived from Figma node 95:50741 (1410×1410 canvas).
// Conversion: value_in_state = figma_px × (2696 / 1410).
// Original layout defaults (used by 4:5, 16:9, 9:16, 1.91:1).
// Stored here so switching away from 1:1 restores the correct values.
const _ORIGINAL_DEFAULTS = {
  headlineFontSize:   120,
  headlineYPos:       206.36,
  headlineTracking:   -4.8,
  headlineLineHeight: 1.1,
  headlineAlign:      'center',
  headlineFont:       '400',
  headlinePadding:    0,
  imageScale:         1.0,
  imageYOffset:       0,
  imageRadius:        12,
  bgColor:            '#0c0c0f',
};

const ASPECT_RATIO_DEFAULTS = {
  '1:1': {
    // Headline — from Figma node 206:78927 (1410×1410 canvas, scale 2696/1410 = 1.912)
    // Container: top=0, py=112px → text starts at 112px from top (top-aligned, keeping padding)
    // Text: fontSize=77px, tracking=-3.08px (−4%), lineHeight=1.1, centered, width=1056.194px
    headlineFontSize:   147,   // 77px × 1.912
    headlineYPos:       214,   // 112px × 1.912  (top padding = where text starts)
    headlineTracking:   -5.9,  // -3.08px × 1.912
    headlineLineHeight: 1.1,
    headlineAlign:      'center',
    headlineFont:       '400',
    headlinePadding:    338,   // (1410−1056.194)/2 × 1.912 — constrains text width to match Figma
    // Image card — fills lower portion of canvas
    imageScale:         1.46,  // 1270px / 869px (default rendered width)
    imageYOffset:       604,   // (608 − 292.6) × 1.912
    imageRadius:        18,    // 9.17px × 1.912
    // Background
    bgColor:            '#000000',
  },
  '4:5':    _ORIGINAL_DEFAULTS,
  '16:9':   _ORIGINAL_DEFAULTS,
  '9:16':   _ORIGINAL_DEFAULTS,
  '1.91:1': _ORIGINAL_DEFAULTS,
};

// ── Built-in Palettes ────────────────────────────────────────
const PALETTES = {
  custom: { label: 'Custom', stops: null },

  marketingWarm: {
    label: 'Warm-Dark',
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
    label: 'Cool-Dark Mode',
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
    label: 'Cool-Light',
    tone: 'cool',
    stops: [
      { stop: 0.0, color: '#c8e6ff' },
      { stop: 0.5, color: '#7ec8f7' },
      { stop: 1.0, color: '#1e88e5' },
    ],
  },
};

// ── Background Gradient Presets — same stops as shape palettes ──
// Each entry mirrors the colour stops from the matching PALETTES entry
// so the background gradient always matches what's on the shapes.
const BG_GRADIENTS = {
  marketingWarm: {
    label: 'Warm-Dark',
    theme: 'warm',
    dir:   'vertical',
    get stops() { return JSON.parse(JSON.stringify(PALETTES.marketingWarm.stops)); },
  },
  marketingCool: {
    label: 'Cool-Dark Mode',
    theme: 'cool',
    dir:   'vertical',
    get stops() { return JSON.parse(JSON.stringify(PALETTES.marketingCool.stops)); },
  },
  arctic: {
    label: 'Cool-Light',
    theme: 'cool',
    dir:   'vertical',
    get stops() { return JSON.parse(JSON.stringify(PALETTES.arctic.stops)); },
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
  circleFlipAnchor:    false,
  circleStagger:       0,
  circleStaggerAuto:   true,
  circleTextLink:      false,
  circleTextPadding: 0,
  noiseSeed:        42,

  // Shared
  gradientDirection: 'horizontal',
  extent:            0.85,

  // Image composition
  imagePresetOpacity: 1.0,
  imagePresetSelected: 'dark',   // 'dark' | 'light'

  theme:       'warm',
  palette:     'marketingWarm',
  paletteMode: 'normal',        // 'normal' | 'symmetrical' | 'sync'
  gradientStops: JSON.parse(JSON.stringify(PALETTES.marketingWarm.stops)),

  opacity:      0.88,
  globalOpacity: false,
  blur:         0,
  bgColor:      '#0c0c0f',

  // Background gradient mode
  bgGradientMode:   false,
  bgGradientPreset: null,
  bgGradientStops:  [],
  bgGradientDir:    'vertical',
  bgGradientFlip:   false,

  // Bar gradient flip
  barFlipGradient: false,

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
  headlineText:           'Start with a prompt\nEnd with a presentation',
  headlineHighlightWords: '',
  headlineHighlightColor: '#f66a24',
  headlineTextBase:       '#ffffff',   // '#050505' | '#ffffff' — two-state toggle
  headlineTextOpacity:    1.0,          // 0–1, applied on top of base
  headlineTextColor:      '#ffffff',   // computed by applyTextAdaptation(), do not set manually
  headlineFillEnabled:    false,
  headlineFillColor:      '#000000',
  headlineFillOpacity:    0.5,
  headlineAlign:          'center',
  headlineTracking:       -4.8,
  headlineLineHeight:     1.1,
  headlineFontSize:       120,
  headlineFont:           '400',
  headlineYPos:           206.36,
  headlinePadding:        0,

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

  showFooter:       true,
  footerByline:     'Start for free today',
  footerTextBase:   '#ffffff',   // '#050505' | '#ffffff'
  footerTextOpacity: 1.0,
  footerTextColor:  '#ffffff',  // computed by applyTextAdaptation()
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

/** Returns the active theme ('warm' | 'cool'). Theme is the single source of truth. */
function getPaletteTone() {
  return state.theme || 'warm';
}

/** Returns the BG solid preset list for the active theme */
function getActiveBgPresets() {
  return BG_PALETTE_MAP[state.theme] || BG_PALETTE_MAP.custom;
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

// ── Seeded noise helpers ─────────────────────────────────────
// Integer hash → float in [0, 1).  Fast and well-distributed.
function seededHash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}
// 1-D value noise: smoothly interpolates between seeded lattice points.
// Returns [0, 1].  Changing seed gives a completely different curve shape.
function valueNoise1D(t, seed) {
  const GRID = 24;
  const ft   = t * GRID;
  const i    = Math.floor(ft);
  const f    = ft - i;
  const s    = f * f * (3 - 2 * f);          // smoothstep
  const v0   = seededHash(seed * 7919 + i);
  const v1   = seededHash(seed * 7919 + i + 1);
  return v0 + (v1 - v0) * s;
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
    case 'noise':      return valueNoise1D(t, (typeof state !== 'undefined' ? state.noiseSeed : 1));
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

// ── Default Presets ──────────────────────────────────────────
// Seeded into localStorage on first load if no presets exist yet.
// To reset to these defaults, clear localStorage key 'pai-tool-presets-v1'.
const DEFAULT_PRESETS = [
  {"id":1776944469865,"name":"1080x1080-Radial-Warm","snap":{"aspectRatio":"1:1","compositionType":"circular","rectCount":16,"spacing":0,"curveType":"parabolic","flipCurve":false,"symmetry":true,"mirrorY":false,"baseline":"bottom","circleCount":11,"circleDiameter":1157,"circleAlignment":"bottom-center","circleMirrorXY":false,"circleSpacingX":0,"circleSpacingY":0,"circleFlipAnchor":false,"circleStagger":375,"circleTextLink":false,"circleTextPadding":-40,"noiseSeed":217,"gradientDirection":"horizontal","extent":0.74,"palette":"marketingWarm","gradientStops":[{"stop":0,"color":"#ffb96e"},{"stop":0.2,"color":"#ffa958"},{"stop":0.4,"color":"#f66a24"},{"stop":0.6,"color":"#f65324"},{"stop":0.8,"color":"#df490b"},{"stop":1,"color":"#c72405"}],"opacity":0.72,"globalOpacity":false,"blur":0,"bgColor":"#FFB96E","bgGradientMode":false,"bgGradientPreset":"marketingWarm","bgGradientStops":[{"stop":0,"color":"#ffb96e"},{"stop":0.2,"color":"#ffa958"},{"stop":0.4,"color":"#f66a24"},{"stop":0.6,"color":"#f65324"},{"stop":0.8,"color":"#df490b"},{"stop":1,"color":"#c72405"}],"bgGradientDir":"vertical","bgGradientFlip":false,"barFlipGradient":false,"innerGlow":true,"innerGlowIntensity":0.55,"depthShadow":true,"dsSpread":0.07,"dsOpacity":0.18,"showGraphics":true,"showHeadline":true,"headlineText":"Stop reviewing decks for wrong colors and start reviewing  them for the right strategy.","headlineHighlightWords":"wrong colors right strategy  ","headlineHighlightColor":"#969696","headlineTextColor":"#ededed","headlineFillEnabled":true,"headlineFillColor":"#1f1200","headlineFillOpacity":1,"headlineAlign":"center","headlineTracking":-5.9,"headlineLineHeight":1.1,"headlineFontSize":147,"headlineFont":"400","headlineYPos":214,"headlinePadding":338,"showImage":true,"imageSrc":"","imageScale":1.4,"imageYOffset":660,"imageStrokeStyle":"marketing","imageRadius":9,"imageStrokeOp":1,"imageStrokeWeight":11,"imageMulti":false,"imageDistMode":"horizontal","imageMultiCount":3,"imageMultiSpacing":40,"imageStyle":"style5","imageStyleIndex":1,"imageStyleOrder":null,"showFooter":true,"footerByline":"Start for free today","footerTextColor":"#ffffff","footerAlign":"left","footerTracking":-1.63,"footerFont":"500"}},
  {"id":1776943571410,"name":"1920x1080-MirrorCircle-Warm","snap":{"aspectRatio":"16:9","compositionType":"circular","rectCount":69,"spacing":0,"curveType":"parabolic","flipCurve":false,"symmetry":true,"mirrorY":false,"baseline":"bottom","circleCount":3,"circleDiameter":830,"circleAlignment":"center-left","circleMirrorXY":true,"circleSpacingX":558,"circleSpacingY":-287,"circleFlipAnchor":false,"circleStagger":75,"circleTextLink":false,"circleTextPadding":-40,"noiseSeed":242,"gradientDirection":"vertical","extent":0.81,"palette":"marketingWarm","gradientStops":[{"stop":0,"color":"#fff0e4"},{"stop":0.2,"color":"#f65324"},{"stop":0.4,"color":"#f66a24"},{"stop":0.6,"color":"#f56a24"},{"stop":0.8,"color":"#f65324"},{"stop":1,"color":"#fff0e4"}],"opacity":0.42,"globalOpacity":false,"blur":7,"bgColor":"#361E1C","bgGradientMode":true,"bgGradientPreset":"marketingWarm","bgGradientStops":[{"stop":0,"color":"#ffb96e"},{"stop":0.2,"color":"#ffa958"},{"stop":0.4,"color":"#f66a24"},{"stop":0.6,"color":"#f65324"},{"stop":0.8,"color":"#df490b"},{"stop":1,"color":"#c72405"}],"bgGradientDir":"vertical","bgGradientFlip":true,"barFlipGradient":true,"innerGlow":true,"innerGlowIntensity":0.74,"depthShadow":true,"dsSpread":0.07,"dsOpacity":0.18,"showGraphics":true,"showHeadline":true,"headlineText":"Enterprise presentations \\nwithout enterprise chaos. \\nOnly with Presentations.AI","headlineHighlightWords":"Presentations.AI","headlineHighlightColor":"#000000","headlineTextColor":"#ededed","headlineFillEnabled":false,"headlineFillColor":"#ffffff","headlineFillOpacity":0.55,"headlineAlign":"center","headlineTracking":-4.8,"headlineLineHeight":1.1,"headlineFontSize":111,"headlineFont":"400","headlineYPos":72,"headlinePadding":0,"showImage":true,"imageSrc":"","imageScale":1,"imageYOffset":0,"imageStrokeStyle":"marketing","imageRadius":12,"imageStrokeOp":1,"imageStrokeWeight":20,"imageMulti":false,"imageDistMode":"horizontal","imageMultiCount":3,"imageMultiSpacing":40,"imageStyle":"style1","imageStyleIndex":0,"imageStyleOrder":null,"showFooter":true,"footerByline":"Start for free today","footerTextColor":"#ffffff","footerAlign":"left","footerTracking":-1.63,"footerFont":"500"}},
  {"id":1776943035700,"name":"1920x1080-MirrorCircle-Cool","snap":{"aspectRatio":"16:9","compositionType":"circular","rectCount":69,"spacing":0,"curveType":"parabolic","flipCurve":false,"symmetry":true,"mirrorY":false,"baseline":"bottom","circleCount":5,"circleDiameter":810,"circleAlignment":"center-left","circleMirrorXY":true,"circleSpacingX":558,"circleSpacingY":-287,"circleFlipAnchor":false,"circleStagger":90,"circleTextLink":false,"circleTextPadding":-40,"noiseSeed":242,"gradientDirection":"vertical","extent":0.81,"palette":"custom","gradientStops":[{"stop":0,"color":"#8bcdf8"},{"stop":0.5,"color":"#c2dcff"},{"stop":1,"color":"#8bcdf8"}],"opacity":1,"globalOpacity":true,"blur":7,"bgColor":"#CAE2FF","bgGradientMode":false,"bgGradientPreset":"arctic","bgGradientStops":[{"stop":0,"color":"#c8e6ff"},{"stop":0.5,"color":"#7ec8f7"},{"stop":1,"color":"#1e88e5"}],"bgGradientDir":"vertical","bgGradientFlip":false,"barFlipGradient":true,"innerGlow":false,"innerGlowIntensity":0.74,"depthShadow":true,"dsSpread":0.07,"dsOpacity":0.5,"showGraphics":true,"showHeadline":true,"headlineText":"Enterprise presentations \\nwithout enterprise chaos. \\nOnly with Presentations.AI","headlineHighlightWords":"Presentations.AI","headlineHighlightColor":"#000000","headlineTextColor":"#383838","headlineFillEnabled":false,"headlineFillColor":"#000000","headlineFillOpacity":0.5,"headlineAlign":"center","headlineTracking":-4.8,"headlineLineHeight":1.1,"headlineFontSize":111,"headlineFont":"400","headlineYPos":72,"headlinePadding":0,"showImage":true,"imageSrc":"","imageScale":1,"imageYOffset":0,"imageStrokeStyle":"frosty","imageRadius":12,"imageStrokeOp":1,"imageStrokeWeight":20,"imageMulti":false,"imageDistMode":"horizontal","imageMultiCount":3,"imageMultiSpacing":40,"imageStyle":"style1","imageStyleIndex":0,"imageStyleOrder":null,"showFooter":true,"footerByline":"Start for free today","footerTextColor":"#ffffff","footerAlign":"left","footerTracking":-1.63,"footerFont":"500"}},
  {"id":1776941548100,"name":"1080x1350-WarmNoise","snap":{"aspectRatio":"4:5","compositionType":"rectangle","rectCount":116,"spacing":4,"curveType":"noise","flipCurve":false,"symmetry":true,"mirrorY":true,"baseline":"bottom","circleCount":12,"circleDiameter":600,"circleAlignment":"bottom-center","circleMirrorXY":false,"circleSpacingX":0,"circleSpacingY":0,"circleFlipAnchor":false,"circleStagger":0,"circleTextLink":false,"circleTextPadding":0,"noiseSeed":42,"gradientDirection":"vertical","extent":0.85,"palette":"marketingWarm","gradientStops":[{"stop":0,"color":"#ffb96e"},{"stop":0.2,"color":"#ffa958"},{"stop":0.4,"color":"#f66a24"},{"stop":0.6,"color":"#f65324"},{"stop":0.8,"color":"#df490b"},{"stop":1,"color":"#c72405"}],"opacity":0.88,"globalOpacity":false,"blur":0,"bgColor":"#0c0c0f","bgGradientMode":false,"bgGradientPreset":"marketingCool","bgGradientStops":[{"stop":0,"color":"#cae2ff"},{"stop":0.2,"color":"#a6d0ff"},{"stop":0.4,"color":"#66a8ff"},{"stop":0.6,"color":"#4374b9"},{"stop":0.8,"color":"#23303b"},{"stop":1,"color":"#002156"}],"bgGradientDir":"vertical","bgGradientFlip":false,"barFlipGradient":false,"innerGlow":false,"innerGlowIntensity":0.6,"depthShadow":true,"dsSpread":0.28,"dsOpacity":0.5,"showGraphics":true,"showHeadline":true,"headlineText":"Stop reviewing decks for wrong colors \\n& start reviewing them for the \\nright strategy.","headlineHighlightWords":"wrong colors right strategy","headlineHighlightColor":"#f5f5f5","headlineTextColor":"#b3b3b3","headlineFillEnabled":true,"headlineFillColor":"#000000","headlineFillOpacity":1,"headlineAlign":"center","headlineTracking":-4.8,"headlineLineHeight":1.1,"headlineFontSize":127,"headlineFont":"400","headlineYPos":206.36,"headlinePadding":0,"showImage":true,"imageSrc":"","imageScale":1.55,"imageYOffset":590,"imageStrokeStyle":"marketing","imageRadius":12,"imageStrokeOp":1,"imageStrokeWeight":10,"imageMulti":false,"imageDistMode":"horizontal","imageMultiCount":3,"imageMultiSpacing":40,"imageStyle":"style3","imageStyleIndex":0,"imageStyleOrder":null,"showFooter":true,"footerByline":"Start for free today","footerTextColor":"#ffffff","footerAlign":"left","footerTracking":-1.63,"footerFont":"500"}},
  {"id":1776941472238,"name":"1080x1350-Noise01","snap":{"aspectRatio":"4:5","compositionType":"rectangle","rectCount":116,"spacing":4,"curveType":"noise","flipCurve":false,"symmetry":true,"mirrorY":true,"baseline":"bottom","circleCount":12,"circleDiameter":600,"circleAlignment":"bottom-center","circleMirrorXY":false,"circleSpacingX":0,"circleSpacingY":0,"circleFlipAnchor":false,"circleStagger":0,"circleTextLink":false,"circleTextPadding":0,"noiseSeed":42,"gradientDirection":"vertical","extent":0.85,"palette":"marketingCool","gradientStops":[{"stop":0,"color":"#cae2ff"},{"stop":0.2,"color":"#a6d0ff"},{"stop":0.4,"color":"#66a8ff"},{"stop":0.6,"color":"#4374b9"},{"stop":0.8,"color":"#23303b"},{"stop":1,"color":"#002156"}],"opacity":0.88,"globalOpacity":false,"blur":0,"bgColor":"#0c0c0f","bgGradientMode":false,"bgGradientPreset":"marketingCool","bgGradientStops":[{"stop":0,"color":"#cae2ff"},{"stop":0.2,"color":"#a6d0ff"},{"stop":0.4,"color":"#66a8ff"},{"stop":0.6,"color":"#4374b9"},{"stop":0.8,"color":"#23303b"},{"stop":1,"color":"#002156"}],"bgGradientDir":"vertical","bgGradientFlip":false,"barFlipGradient":false,"innerGlow":false,"innerGlowIntensity":0.6,"depthShadow":true,"dsSpread":0.28,"dsOpacity":0.5,"showGraphics":true,"showHeadline":true,"headlineText":"Stop reviewing decks for wrong colors \\n& start reviewing them for the \\nright strategy.","headlineHighlightWords":"wrong colors right strategy","headlineHighlightColor":"#f5f5f5","headlineTextColor":"#b3b3b3","headlineFillEnabled":true,"headlineFillColor":"#000000","headlineFillOpacity":1,"headlineAlign":"center","headlineTracking":-4.8,"headlineLineHeight":1.1,"headlineFontSize":127,"headlineFont":"400","headlineYPos":206.36,"headlinePadding":0,"showImage":true,"imageSrc":"","imageScale":1.55,"imageYOffset":590,"imageStrokeStyle":"frosty","imageRadius":12,"imageStrokeOp":1,"imageStrokeWeight":10,"imageMulti":false,"imageDistMode":"horizontal","imageMultiCount":3,"imageMultiSpacing":40,"imageStyle":"style3","imageStyleIndex":0,"imageStyleOrder":null,"showFooter":true,"footerByline":"Start for free today","footerTextColor":"#ffffff","footerAlign":"left","footerTracking":-1.63,"footerFont":"500"}}
];
