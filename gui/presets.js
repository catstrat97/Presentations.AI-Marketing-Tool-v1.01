// ── gui/presets.js ────────────────────────────────────────────
// localStorage-backed preset save / load UI. Seeds DEFAULT_PRESETS
// on first run, exposes buildPresetsContent() for the init module
// to drop into the Presets folder.

import {
  state,
  getColorLuma,
} from '../shared.js';
import { DEFAULT_PRESETS } from '../default-presets.js';

// ══════════════════════════════════════════════════════════════
// PRESETS (localStorage persistence)
// ══════════════════════════════════════════════════════════════
const _PRESETS_KEY = 'pai-tool-presets-v1';

function _loadPresets() {
  try { return JSON.parse(localStorage.getItem(_PRESETS_KEY)) || []; }
  catch { return []; }
}
function _savePresetsStore(list) {
  localStorage.setItem(_PRESETS_KEY, JSON.stringify(list));
}

// Seed DEFAULT_PRESETS into localStorage on first load. Only runs if
// the key is absent or empty — never overwrites user presets.
(function _seedDefaultPresets() {
  try {
    const existing = JSON.parse(localStorage.getItem(_PRESETS_KEY));
    if (!existing || existing.length === 0) {
      localStorage.setItem(_PRESETS_KEY, JSON.stringify(DEFAULT_PRESETS));
    }
  } catch { /* ignore */ }
})();

// Builds presets controls into a Tweakpane folder content area.
// `syncControlsToState` and `updateOverlays` are passed in to keep this
// module decoupled from the larger gui/randomize and overlays cycles.
export function buildPresetsContent(content, { syncControlsToState, updateOverlays }) {

  // ── Save row ────────────────────────────────────────────────
  const saveRow = document.createElement('div');
  saveRow.className = 'preset-save-row';

  const nameInput = document.createElement('input');
  nameInput.type        = 'text';
  nameInput.className   = 'text-input';
  nameInput.placeholder = 'Name this preset…';
  nameInput.style.flex  = '1';

  const saveBtn = document.createElement('button');
  saveBtn.className   = 'seg-btn';
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'flex-shrink:0;padding:0 12px;height:30px;';

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const list = _loadPresets();
    // Deep-copy state; drop transient fields that can't persist
    const snap = JSON.parse(JSON.stringify({
      ...state,
      imageSrc:        '',   // blob URL won't survive a session
      imageStyleOrder: null,
    }));
    list.unshift({ id: Date.now(), name, snap });
    _savePresetsStore(list);
    nameInput.value = '';
    renderList();
  });

  // Also save on Enter
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  saveRow.appendChild(nameInput);
  saveRow.appendChild(saveBtn);
  content.appendChild(saveRow);

  // ── Preset list ─────────────────────────────────────────────
  const listEl = document.createElement('div');
  listEl.className = 'preset-list';
  content.appendChild(listEl);

  function renderList() {
    const list = _loadPresets();
    listEl.innerHTML = '';

    if (list.length === 0) {
      const msg = document.createElement('p');
      msg.className   = 'preset-empty';
      msg.textContent = 'No presets yet — configure the tool and save.';
      listEl.appendChild(msg);
      return;
    }

    list.forEach((preset, idx) => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';

      const applyBtn = document.createElement('button');
      applyBtn.className   = 'preset-name';
      applyBtn.textContent = preset.name;
      applyBtn.title       = 'Apply preset';
      applyBtn.addEventListener('click', () => {
        Object.assign(state, preset.snap);
        // Migrate old presets that stored headlineTextColor/footerTextColor
        // as plain hex strings without the new base+opacity fields.
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
        syncControlsToState();
        updateOverlays();
        if (window._p5Resize) window._p5Resize();
      });

      const delBtn = document.createElement('button');
      delBtn.className   = 'preset-del';
      delBtn.textContent = '×';
      delBtn.title       = 'Delete preset';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        const updated = _loadPresets();
        updated.splice(idx, 1);
        _savePresetsStore(updated);
        renderList();
      });

      chip.appendChild(applyBtn);
      chip.appendChild(delBtn);
      listEl.appendChild(chip);
    });
  }

  renderList();
}
