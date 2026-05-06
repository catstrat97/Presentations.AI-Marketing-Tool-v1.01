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

// ── Translation ──────────────────────────────────────────────
// Paste the deployed Cloudflare Worker URL here. See worker/README.md.
const TRANSLATION_WORKER_URL = 'https://pai-translate.team-15d.workers.dev';

// English first (canonical source). The rest are the supported targets.
const LANGUAGES = [
  { code: 'en',    label: 'English (United States)', dir: 'ltr' },
  { code: 'pt-BR', label: 'Português (Brasil)',      dir: 'ltr' },
  { code: 'id',    label: 'Indonesian',              dir: 'ltr' },
  { code: 'es',    label: 'Español',                 dir: 'ltr' },
  { code: 'de',    label: 'Deutsch',                 dir: 'ltr' },
  { code: 'fr',    label: 'Français',                dir: 'ltr' },
  { code: 'tr',    label: 'Türkçe',                  dir: 'ltr' },
  { code: 'zh',    label: '中文',                     dir: 'ltr' },
  { code: 'ja',    label: '日本語',                   dir: 'ltr' },
  { code: 'ko',    label: '한국어',                    dir: 'ltr' },
  { code: 'ar',    label: 'عربي',                     dir: 'rtl' },
];

const TRANSLATION_TARGET_LANGS = LANGUAGES.filter(l => l.code !== 'en');

// ── Per-Aspect-Ratio Layout Defaults ────────────────────────
// Applied automatically when the user switches aspect ratio.
// All values use the 2696px design-unit coordinate system
// (same as the CSS --scale calculations).
//
// 1:1 values derived from Figma node 95:50741 (1410×1410 canvas).
// Conversion: value_in_state = figma_px × (2696 / 1410).
//
// Adding a knob that's identical across aspects: add it to _BASE alone.
// Adding a knob that varies: put a sensible value in _BASE if there is one,
// then list overrides only on aspects that actually differ.
const _ASPECT_DEFAULTS_BASE = {
  headlineAlign:        'center',
  headlineFont:         '400',
  headlineFillEnabled:  true,
  bgColor:              '#361E1C',
  headlineLineHeight:   1.1,   // landscape aspects override to 1.15
  imageRadius:          12,    // 1:1 and 9:16 override to 18
};

const _ASPECT_DEFAULTS_OVERRIDES = {
  // ── 1:1 Square ────────────────────────────────────────────
  '1:1': {
    headlineFontSize:        147,
    headlineYPos:            214,
    headlineTracking:        -5.9,
    headlinePadding:         338,
    headlineFillPaddingTop:  150,
    headlineFillPaddingBottom: 140,
    imageScale:              1.46,
    imageYOffset:            604,
    imageRadius:             18,
  },
  // ── 4:5 Portrait ──────────────────────────────────────────
  '4:5': {
    headlineFontSize:        127,
    headlineYPos:            206,
    headlineTracking:        -4.8,
    headlinePadding:         260,
    headlineFillPaddingTop:  170,
    headlineFillPaddingBottom: 160,
    imageScale:              1.55,
    imageYOffset:            590,
  },
  // ── 16:9 Landscape ────────────────────────────────────────
  '16:9': {
    headlineFontSize:        82,
    headlineYPos:            120,
    headlineTracking:        -3.2,
    headlineLineHeight:      1.15,
    headlinePadding:         420,
    headlineFillPaddingTop:  100,
    headlineFillPaddingBottom: 90,
    imageScale:              1.10,
    imageYOffset:            -90,
  },
  // ── 1.91:1 (almost identical to 16:9) ─────────────────────
  '1.91:1': {
    headlineFontSize:        82,
    headlineYPos:            120,
    headlineTracking:        -3.2,
    headlineLineHeight:      1.15,
    headlinePadding:         440,
    headlineFillPaddingTop:  100,
    headlineFillPaddingBottom: 90,
    imageScale:              1.10,
    imageYOffset:            -90,
  },
  // ── 9:16 Story ────────────────────────────────────────────
  '9:16': {
    headlineFontSize:        172,
    headlineYPos:            260,
    headlineTracking:        -6.9,
    headlinePadding:         140,
    headlineFillPaddingTop:  220,
    headlineFillPaddingBottom: 210,
    imageScale:              1.49,
    imageYOffset:            1430,
    imageRadius:             18,
  },
};

const ASPECT_RATIO_DEFAULTS = Object.fromEntries(
  Object.entries(_ASPECT_DEFAULTS_OVERRIDES).map(
    ([k, v]) => [k, { ..._ASPECT_DEFAULTS_BASE, ...v }]
  )
);

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

  // Temporary warm-light palette — shapes work on light backgrounds
  marketingWarmLight: {
    label: 'Warm-Light',
    tone: 'warm',
    stops: [
      { stop: 0.00, color: '#FFE0CC' },
      { stop: 0.20, color: '#FFB96E' },
      { stop: 0.50, color: '#F88030' },
      { stop: 0.75, color: '#F66A24' },
      { stop: 1.00, color: '#DC4A00' },
    ],
  },
};

// ── Background Gradient Presets — same stops as shape palettes ──
// Each entry mirrors the colour stops from the matching PALETTES entry
// so the background gradient always matches what's on the shapes.
const BG_GRADIENTS = {
  marketingWarm: {
    label: 'Warm Dark',
    theme: 'warm',
    mode:  'dark',
    dir:   'vertical',
    get stops() { return JSON.parse(JSON.stringify(PALETTES.marketingWarm.stops)); },
  },
  marketingWarmLight: {
    label: 'Warm Light',
    theme: 'warm',
    mode:  'light',
    dir:   'vertical',
    get stops() { return JSON.parse(JSON.stringify(PALETTES.marketingWarmLight.stops)); },
  },
  marketingCool: {
    label: 'Cool Dark',
    theme: 'cool',
    mode:  'dark',
    dir:   'vertical',
    get stops() { return JSON.parse(JSON.stringify(PALETTES.marketingCool.stops)); },
  },
  arctic: {
    label: 'Cool Light',
    theme: 'cool',
    mode:  'light',
    dir:   'vertical',
    get stops() { return JSON.parse(JSON.stringify(PALETTES.arctic.stops)); },
  },
};

// ── Background Presets — filtered by palette tone + mode ─────
const BG_PALETTE_MAP = {
  // Dark mode swatches (default)
  'warm-dark': [
    { color: '#361E1C', label: 'Dark Umber' },
    { color: '#C72405', label: 'Brick' },
    { color: '#DF490B', label: 'Ember' },
    { color: '#F65324', label: 'Flame' },
    { color: '#F66A24', label: 'Orange' },
    { color: '#FFB96E', label: 'Sand' },
    { color: '#FFF0E5', label: 'Warm White' },
  ],
  'cool-dark': [
    { color: '#000D1F', label: 'Abyss' },
    { color: '#002156', label: 'Deep Navy' },
    { color: '#23303B', label: 'Slate' },
    { color: '#4374B9', label: 'Steel' },
    { color: '#66A8FF', label: 'Cornflower' },
    { color: '#A6D0FF', label: 'Powder' },
    { color: '#CAE2FF', label: 'Ice Blue' },
  ],
  // Light mode swatches
  'warm-light': [
    { color: '#FFF0E5', label: 'Warm White' },
    { color: '#FFE0CC', label: 'Peach Cream' },
    { color: '#FFB96E', label: 'Sand' },
    { color: '#F88030', label: 'Tangerine' },
    { color: '#F66A24', label: 'Orange' },
    { color: '#DC4A00', label: 'Rust' },
    { color: '#A83200', label: 'Sienna' },
  ],
  'cool-light': [
    { color: '#EEF6FF', label: 'Alice Blue' },
    { color: '#C8E6FF', label: 'Sky' },
    { color: '#7EC8F7', label: 'Cerulean' },
    { color: '#4BA3E3', label: 'Cornflower' },
    { color: '#1E88E5', label: 'Cobalt' },
    { color: '#1565C0', label: 'Royal' },
    { color: '#0D47A1', label: 'Sapphire' },
  ],
  // Legacy keys (kept for backwards compatibility)
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
  colorMode:   'dark',            // 'dark' | 'light'
  palette:     'marketingWarm',
  paletteMode: 'normal',        // 'normal' | 'symmetrical' | 'sync'
  gradientStops: JSON.parse(JSON.stringify(PALETTES.marketingWarm.stops)),

  opacity:      0.88,
  globalOpacity: false,
  blur:         0,
  bgColor:      '#361E1C',  // Warm-Dark "Dark Umber" — default sits in the warm palette

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
  headlineFillEnabled:    true,
  headlineFillColor:      '#121212',
  headlineFillOpacity:    1.0,  // locked to 1; no UI control
  // Dynamic fill-box paddings (design units). Per-aspect defaults
  // override these via ASPECT_RATIO_DEFAULTS.
  headlineFillPaddingTop:    214,
  headlineFillPaddingBottom: 201,
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

  // ── Translation ──
  // previewLang: which language the canvas displays. 'en' = canonical source.
  // translations: { [lang]: { headlineText, footerByline, headlineHighlightWords, sourceHash } }
  // sourceHash records the English inputs at translate time so we can detect staleness.
  previewLang:   'en',
  translations:  {},
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

/** Returns the BG solid preset list for the active theme + colorMode */
function getActiveBgPresets() {
  const key = state.theme + '-' + (state.colorMode || 'dark');
  return BG_PALETTE_MAP[key] || BG_PALETTE_MAP[state.theme] || BG_PALETTE_MAP.custom;
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

// ── Translation Helpers ──────────────────────────────────────
// getDisplayText is the single source of truth for "what text should be
// rendered right now" — both the live DOM update and the canvas export
// path call it, so they cannot drift across English vs translations.

function _hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function getEnglishSourceHash() {
  // Concatenate fields with a NUL byte so 'ab|cd' and 'a|bcd' don't collide.
  // String.fromCharCode keeps the separator out of source-code byte form so
  // editors/formatters can't silently mangle it.
  const sep = String.fromCharCode(0);
  return _hashString(
    (state.headlineText || '') + sep +
    (state.footerByline || '') + sep +
    (state.headlineHighlightWords || '')
  );
}

function getDisplayText() {
  const lang = state.previewLang || 'en';
  const t = (lang !== 'en' && state.translations) ? state.translations[lang] : null;
  if (!t) {
    return {
      lang: 'en',
      headlineText:           state.headlineText || '',
      footerByline:           state.footerByline || '',
      headlineHighlightWords: state.headlineHighlightWords || '',
      isStale: false,
    };
  }
  return {
    lang,
    headlineText:           t.headlineText || '',
    footerByline:           t.footerByline || '',
    headlineHighlightWords: t.headlineHighlightWords || '',
    isStale: t.sourceHash !== getEnglishSourceHash(),
  };
}

function isTranslationStale(lang) {
  const t = state.translations && state.translations[lang];
  if (!t) return false;
  return t.sourceHash !== getEnglishSourceHash();
}

function getLangDir(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.dir : 'ltr';
}

// ── Headline Highlight Helpers ───────────────────────────────
// Both the live DOM headline (gui.js) and the PNG export (sketch.js)
// match against this same parsed set so the two render paths cannot drift.
function parseHighlightWords(str) {
  return new Set(
    (str || '')
      .split(/[\s,]+/)
      .map(w => w.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Keeps straight + curly apostrophes so "don't" matches either form.
function normalizeHighlightKey(word) {
  return word.toLowerCase().replace(/[^a-z0-9'‘’-]/g, '');
}

