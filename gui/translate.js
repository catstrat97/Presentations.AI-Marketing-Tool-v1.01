// ── gui/translate.js ──────────────────────────────────────────
// Translate panel UI + the worker call + the "export all languages
// as a zip" pipeline. Keeps the preview-language picker and the
// target-language checkbox list grouped together because they
// mutually depend on each other.

import {
  state,
  LANGUAGES,
  TRANSLATION_TARGET_LANGS,
  TRANSLATION_WORKER_URL,
  getEnglishSourceHash,
  isTranslationStale,
} from '../shared.js';
import { mkSubLabel } from './controls.js';
import { updateOverlays } from './overlays.js';

// ══════════════════════════════════════════════════════════════
// TRANSLATE SECTION
// ══════════════════════════════════════════════════════════════
export function buildTranslateSection(ct) {
  // ── Preview language picker ──────────────────────────────
  ct.appendChild(mkSubLabel('Preview', 0));

  const previewSel = document.createElement('select');
  previewSel.className = 'tp-custom-select translate-preview-sel';
  previewSel.id = 'ctrl-preview-lang';
  ct.appendChild(previewSel);

  function rebuildPreviewOptions() {
    const current = state.previewLang || 'en';
    previewSel.innerHTML = '';
    LANGUAGES.forEach(l => {
      const has = l.code === 'en' || (state.translations && state.translations[l.code]);
      if (!has) return;
      const opt = document.createElement('option');
      opt.value = l.code;
      const stale = isTranslationStale(l.code);
      opt.textContent = l.label + (stale ? ' (stale)' : '');
      if (current === l.code) opt.selected = true;
      previewSel.appendChild(opt);
    });
  }
  rebuildPreviewOptions();

  previewSel.addEventListener('focus', rebuildPreviewOptions);
  previewSel.addEventListener('change', () => {
    state.previewLang = previewSel.value;
    updateOverlays();
  });

  // ── Target language checkboxes ───────────────────────────
  ct.appendChild(mkSubLabel('Translate to'));

  const targetsBox = document.createElement('div');
  targetsBox.className = 'translate-targets';
  TRANSLATION_TARGET_LANGS.forEach(l => {
    const row = document.createElement('label');
    row.className = 'translate-target-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.dataset.lang = l.code;
    row.appendChild(cb);
    const text = document.createElement('span');
    text.textContent = l.label;
    row.appendChild(text);
    targetsBox.appendChild(row);
  });
  ct.appendChild(targetsBox);

  // ── Translate button + status ────────────────────────────
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn translate-btn';
  btn.textContent = 'Translate';
  ct.appendChild(btn);

  const status = document.createElement('div');
  status.className = 'translate-status';
  ct.appendChild(status);

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.classList.toggle('error', !!isError);
  }

  if (!TRANSLATION_WORKER_URL) {
    setStatus('Set TRANSLATION_WORKER_URL in shared.js to enable.');
  }

  btn.addEventListener('click', async () => {
    const checkedLangs = Array.from(targetsBox.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.dataset.lang);
    if (checkedLangs.length === 0) {
      setStatus('Pick at least one language.', true);
      return;
    }
    if (!TRANSLATION_WORKER_URL) {
      setStatus('Set TRANSLATION_WORKER_URL in shared.js first.', true);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Translating…';
    setStatus(`Translating to ${checkedLangs.length} language${checkedLangs.length === 1 ? '' : 's'}…`);
    try {
      const stored = await runTranslate(checkedLangs);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setStatus(`Translated ${stored} at ${time}.`);
      rebuildPreviewOptions();
      updateOverlays();
    } catch (err) {
      setStatus(err.message || String(err), true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Translate';
    }
  });

  // ── Export all languages (.zip) ──────────────────────────
  const exportAllBtn = document.createElement('button');
  exportAllBtn.type = 'button';
  exportAllBtn.className = 'btn translate-btn export-all-btn';
  exportAllBtn.textContent = '↓ Export all (.zip)';
  ct.appendChild(exportAllBtn);

  exportAllBtn.addEventListener('click', async () => {
    if (typeof JSZip === 'undefined') {
      setStatus('JSZip not loaded — check your internet connection.', true);
      return;
    }
    const langs = ['en', ...Object.keys(state.translations || {})];
    if (langs.length === 1) {
      setStatus('No translations stored — translate something first.', true);
      return;
    }
    exportAllBtn.disabled = true;
    btn.disabled = true;
    exportAllBtn.textContent = 'Exporting…';
    try {
      const zip = await runExportAll(langs, lang => {
        setStatus(`Rendering ${lang}…`);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      window._downloadBlob(zipBlob, `slides-${Date.now()}.zip`);
      setStatus(`Exported ${langs.length} languages.`);
    } catch (err) {
      setStatus(err.message || String(err), true);
    } finally {
      exportAllBtn.disabled = false;
      btn.disabled = false;
      exportAllBtn.textContent = '↓ Export all (.zip)';
    }
  });

  // Expose so randomize / preset-load paths can refresh the dropdown later
  window._translateRefresh = rebuildPreviewOptions;
}

async function runExportAll(langs, onProgress) {
  const zip = new JSZip();
  const savedLang = state.previewLang;
  try {
    for (const lang of langs) {
      onProgress?.(lang);
      state.previewLang = lang;
      updateOverlays();                    // updates DOM overlays
      if (window._p5Redraw) window._p5Redraw(); // synchronous redraw of p5 canvas
      // Yield once so the browser can apply layout from updateOverlays
      // (the export reads getBoundingClientRect on overlay elements).
      await new Promise(r => setTimeout(r, 0));
      const blob = await window._exportToBlob();
      if (blob) zip.file(`${lang}.png`, blob);
    }
  } finally {
    state.previewLang = savedLang;
    updateOverlays();
    if (window._p5Redraw) window._p5Redraw();
  }
  return zip;
}

async function runTranslate(targetLanguages) {
  const resp = await fetch(TRANSLATION_WORKER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      targetLanguages,
      headlineText:           state.headlineText || '',
      footerByline:           state.footerByline || '',
      headlineHighlightWords: state.headlineHighlightWords || '',
    }),
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json()).error || ''; } catch { /* ignore */ }
    throw new Error(`Worker ${resp.status}${detail ? ': ' + detail : ''}`);
  }
  const data = await resp.json();
  if (!data || typeof data.translations !== 'object' || data.translations === null) {
    throw new Error('Worker returned no translations object');
  }

  const sourceHash = getEnglishSourceHash();
  let stored = 0;
  for (const lang of targetLanguages) {
    const t = data.translations[lang];
    if (!t || typeof t !== 'object') continue;
    state.translations[lang] = {
      headlineText:           typeof t.headlineText === 'string'           ? t.headlineText           : '',
      footerByline:           typeof t.footerByline === 'string'           ? t.footerByline           : '',
      headlineHighlightWords: typeof t.headlineHighlightWords === 'string' ? t.headlineHighlightWords : '',
      sourceHash,
    };
    stored++;
  }
  if (stored === 0) throw new Error('No valid translations in response');
  return stored;
}
