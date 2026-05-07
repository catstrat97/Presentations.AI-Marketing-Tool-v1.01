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

  const shuffleBtn = document.createElement('button');
  shuffleBtn.type = 'button';
  shuffleBtn.className = 'grad-action-btn';
  shuffleBtn.title = 'Shuffle the preset order for this aspect';
  shuffleBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 4h3l3 8h3"/><path d="M2 12h3l3-8h3"/>
      <path d="M11 2l3 2-3 2"/><path d="M11 10l3 2-3 2"/>
    </svg>
    <span>Shuffle</span>`;
  shuffleBtn.addEventListener('click', () => {
    const ratio = state.aspectRatio;
    const visible = _loadPresets().filter(p => (p?.snap?.aspectRatio || '1:1') === ratio);
    if (visible.length === 0) return;

    // Pick a random preset for this aspect — different from the one
    // currently applied, when there's more than one to choose from.
    let pick = visible[Math.floor(Math.random() * visible.length)];
    if (visible.length > 1) {
      // crude "current" detection: matches by headlineText + bgColor + imageStyle
      const isCurrent = p =>
        p.snap.headlineText === state.headlineText &&
        p.snap.bgColor      === state.bgColor &&
        p.snap.imageStyle   === state.imageStyle;
      let guard = 0;
      while (isCurrent(pick) && guard++ < 8) {
        pick = visible[Math.floor(Math.random() * visible.length)];
      }
    }

    // Apply the picked preset (same flow as clicking its chip)
    Object.assign(state, pick.snap);
    if (!pick.snap.headlineTextBase) {
      const luma = getColorLuma(state.headlineTextColor || '#ffffff');
      state.headlineTextBase    = luma > 128 ? '#ffffff' : '#050505';
      state.headlineTextOpacity = 1.0;
    }
    if (!pick.snap.footerTextBase) {
      const luma = getColorLuma(state.footerTextColor || '#ffffff');
      state.footerTextBase    = luma > 128 ? '#ffffff' : '#050505';
      state.footerTextOpacity = 1.0;
    }
    _applyPresetSlide();
    syncControlsToState();
    updateOverlays();
    if (window._p5Resize) window._p5Resize();
    renderList();
  });

  actionRow.appendChild(saveBtn);
  actionRow.appendChild(shuffleBtn);
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
      }

      listEl.appendChild(chip);
    });
  }

  // Hook the undo handler so Cmd+Z restores the chip list
  _onUndoApplied = renderList;

  renderList();
  return renderList;
}
