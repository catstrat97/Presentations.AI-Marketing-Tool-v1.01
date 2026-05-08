// ── gui/presets.js ────────────────────────────────────────────
// localStorage-backed preset save / load UI. Seeds DEFAULT_PRESETS
// on first run, exposes buildPresetsContent() for the init module
// to drop into the Presets folder.

import {
  state,
  getColorLuma,
  IMAGE_STYLES,
} from '../shared.js';
import { DEFAULT_PRESETS } from '../default-presets.js';
import { randomize } from './randomize.js';

// Re-derive imageSrc from the saved imageStyle + imageStyleIndex so the
// slide visual rides along with each preset.
function _applyPresetSlide() {
  const imgs = IMAGE_STYLES[state.imageStyle] || [];
  const idx  = Math.max(0, Math.min(imgs.length - 1, state.imageStyleIndex || 0));
  state.imageStyleIndex = idx;
  state.imageSrc        = imgs[idx] || '';
}

// Public: apply the first preset for the active aspect (used at boot).
export function applyDefaultPreset() {
  const all = _loadPresets();
  const ratio = state.aspectRatio;
  const first = all.find(p => (p?.snap?.aspectRatio || '1:1') === ratio);
  if (!first) return false;
  Object.assign(state, first.snap);
  if (!first.snap.headlineTextBase) {
    const luma = getColorLuma(state.headlineTextColor || '#ffffff');
    state.headlineTextBase    = luma > 128 ? '#ffffff' : '#050505';
    state.headlineTextOpacity = 1.0;
  }
  if (!first.snap.footerTextBase) {
    const luma = getColorLuma(state.footerTextColor || '#ffffff');
    state.footerTextBase    = luma > 128 ? '#ffffff' : '#050505';
    state.footerTextOpacity = 1.0;
  }
  _applyPresetSlide();
  return true;
}

// ══════════════════════════════════════════════════════════════
// PRESETS (localStorage persistence)
// ══════════════════════════════════════════════════════════════
const _PRESETS_KEY = 'pai-tool-presets-v1';

function _loadPresets() {
  try { return JSON.parse(localStorage.getItem(_PRESETS_KEY)) || []; }
  catch { return []; }
}

// In-memory undo stack of full preset arrays. Every mutating call to
// _savePresetsStore() pushes the PRE-mutation snapshot here so Cmd+Z
// can pop it back. Capped at 30 entries.
const _undoStack = [];
const _UNDO_LIMIT = 30;
let _onUndoApplied = null; // set by buildPresetsContent → renderList()

function _savePresetsStore(list, { trackUndo = true } = {}) {
  if (trackUndo) {
    try {
      const before = localStorage.getItem(_PRESETS_KEY);
      _undoStack.push(before == null ? '[]' : before);
      if (_undoStack.length > _UNDO_LIMIT) _undoStack.shift();
    } catch { /* ignore */ }
  }
  localStorage.setItem(_PRESETS_KEY, JSON.stringify(list));
}

// Cmd/Ctrl+Z anywhere on the page (skip when typing in a text field)
window.addEventListener('keydown', e => {
  const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
  if (!isUndo) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (_undoStack.length === 0) return;
  e.preventDefault();
  const prev = _undoStack.pop();
  // Restore without re-pushing onto the stack
  localStorage.setItem(_PRESETS_KEY, prev);
  if (_onUndoApplied) _onUndoApplied();
});

// IDs of bundled default presets — always present, never deletable.
// Users can build on top (save new presets) but cannot remove these.
const _DEFAULT_IDS = new Set(DEFAULT_PRESETS.map(p => p.id));

// On every load: ensure all bundled defaults exist in localStorage.
// User-saved presets are preserved. Missing defaults get re-inserted at
// the position they appear in DEFAULT_PRESETS (top of the list, in order).
(function _ensureDefaultPresets() {
  try {
    let stored;
    try { stored = JSON.parse(localStorage.getItem(_PRESETS_KEY)) || []; }
    catch { stored = []; }

    const haveIds = new Set(stored.map(p => p?.id));
    const missing = DEFAULT_PRESETS.filter(p => !haveIds.has(p.id));
    if (missing.length === 0) return;

    // Re-add any missing defaults at the top, preserving user entries.
    const userEntries = stored.filter(p => !_DEFAULT_IDS.has(p?.id));
    const refreshed   = [...DEFAULT_PRESETS, ...userEntries];
    localStorage.setItem(_PRESETS_KEY, JSON.stringify(refreshed));
  } catch { /* ignore */ }
})();

// Builds presets controls into a Tweakpane folder content area.
// Returns a `renderList()` callback so callers (e.g. an aspect-ratio
// change handler) can refresh the filtered list after state.aspectRatio
// changes.
//
// Presets are scoped to the current aspect ratio: only entries whose
// snap.aspectRatio matches state.aspectRatio are rendered. Saving a
// preset stamps it with the current aspect implicitly (via `...state`).
export function buildPresetsContent(content, { syncControlsToState, updateOverlays }) {

  // ── Preset list (filtered by current aspect) ────────────────
  const listEl = document.createElement('div');
  listEl.className = 'preset-list';
  content.appendChild(listEl);

  // ── Action row (Save Preset + Shuffle) ──────────────────────
  const actionRow = document.createElement('div');
  actionRow.className = 'preset-action-row';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'grad-action-btn';
  saveBtn.title = 'Save current configuration as a preset for this aspect';
  saveBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 2h8l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
      <path d="M5 2v4h6V2"/><path d="M5 11h6"/>
    </svg>
    <span>Save Preset</span>`;
  saveBtn.addEventListener('click', () => {
    const ratio = state.aspectRatio;
    // Auto-name as Style-N, where N is the next number in this aspect.
    const all = _loadPresets();
    const inThisAspect = all.filter(p => (p?.snap?.aspectRatio || '1:1') === ratio);
    const usedNumbers = new Set(
      inThisAspect.map(p => {
        const m = /^Style-(\d+)$/.exec(p.name || '');
        return m ? parseInt(m[1], 10) : NaN;
      }).filter(n => !isNaN(n))
    );
    let n = 1;
    while (usedNumbers.has(n)) n++;
    const name = `Style-${n}`;

    // Save the full state (including imageStyle, imageStyleIndex, and
    // imageStyleOrder) so the slide context restores on apply.
    // imageSrc is dropped intentionally — it's a session-scoped blob URL
    // for user uploads; for preset slides we re-derive imageSrc from
    // imageStyle + imageStyleIndex via _applyPresetSlide().
    const snap = JSON.parse(JSON.stringify({
      ...state,
      imageSrc: '',
    }));
    all.unshift({ id: Date.now(), name, snap });
    _savePresetsStore(all);
    renderList();
  });

  const randomBtn = document.createElement('button');
  randomBtn.type = 'button';
  randomBtn.className = 'grad-action-btn';
  randomBtn.title = 'Randomise the design';
  randomBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2"/>
      <circle cx="5.5" cy="5.5" r="0.9" fill="currentColor"/>
      <circle cx="10.5" cy="5.5" r="0.9" fill="currentColor"/>
      <circle cx="8" cy="8" r="0.9" fill="currentColor"/>
      <circle cx="5.5" cy="10.5" r="0.9" fill="currentColor"/>
      <circle cx="10.5" cy="10.5" r="0.9" fill="currentColor"/>
    </svg>
    <span>Random</span>`;
  randomBtn.addEventListener('click', () => randomize());

  actionRow.appendChild(saveBtn);
  actionRow.appendChild(randomBtn);
  content.appendChild(actionRow);

  function renderList() {
    const all = _loadPresets();
    const ratio = state.aspectRatio;
    // Only show presets that belong to the active aspect ratio.
    const visible = all.filter(p => (p?.snap?.aspectRatio || '1:1') === ratio);

    listEl.innerHTML = '';

    if (visible.length === 0) {
      const msg = document.createElement('p');
      msg.className   = 'preset-empty';
      msg.textContent = `No presets yet for ${ratio}.`;
      listEl.appendChild(msg);
      return;
    }

    visible.forEach(preset => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';

      const applyBtn = document.createElement('button');
      applyBtn.className   = 'preset-name';
      applyBtn.textContent = preset.name;
      applyBtn.title       = 'Apply preset';
      applyBtn.addEventListener('click', () => {
        Object.assign(state, preset.snap);
        if (!preset.snap.headlineTextBase) {
          const luma = getColorLuma(state.headlineTextColor || '#ffffff');
          state.headlineTextBase    = luma > 128 ? '#ffffff' : '#050505';
          state.headlineTextOpacity = 1.0;
        }
        if (!preset.snap.footerTextBase) {
          const luma = getColorLuma(state.footerTextColor || '#ffffff');
          state.footerTextBase    = luma > 128 ? '#ffffff' : '#050505';
          state.footerTextOpacity = 1.0;
        }
        // Re-derive the slide image from the saved style+index so the
        // visual that was active when the preset was saved is restored.
        _applyPresetSlide();
        syncControlsToState();
        updateOverlays();
        if (window._p5Resize) window._p5Resize();
        // Aspect may have changed
        renderList();
      });

      chip.appendChild(applyBtn);

      // Bundled defaults can't be deleted — only user-saved presets.
      if (!_DEFAULT_IDS.has(preset.id)) {
        const delBtn = document.createElement('button');
        delBtn.className   = 'preset-del';
        delBtn.textContent = '×';
        delBtn.title       = 'Delete preset';
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          const updated = _loadPresets().filter(p => p.id !== preset.id && !_DEFAULT_IDS.has(p.id) || _DEFAULT_IDS.has(p.id));
          // Equivalent: drop only this id, never any default.
          _savePresetsStore(_loadPresets().filter(p => p.id !== preset.id));
          renderList();
        });
        chip.appendChild(delBtn);
      } else {
        // Optional visual cue: subtle "default" badge in place of the
        // delete control so the chip feels balanced and the user knows
        // this preset is locked.
        const badge = document.createElement('span');
        badge.className = 'preset-default-badge';
        badge.title = 'Built-in preset (cannot be deleted)';
        badge.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="7" width="10" height="7" rx="1.5"/>
            <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
          </svg>`;
        chip.appendChild(badge);
      }

      listEl.appendChild(chip);
    });
  }

  // Hook the undo handler so Cmd+Z restores the chip list
  _onUndoApplied = renderList;

  renderList();
  return renderList;
}
