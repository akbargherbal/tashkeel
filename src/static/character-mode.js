/**
 * character-mode.js — Arabic Diacritics Editor
 * Phase 3: Character Mode panel, inner-tier navigation, API write-through.
 *
 * References: Plan §Tasks 3.1–3.4  |  Spec §5.2, §8.2, §9, §16
 *
 * Dependencies (must load before this file):
 *   editor-state.js  → window.editorState
 *   renderer.js      → window.updateZenFocus, window.updateStatusBar
 *   navigation.js    → window.handleWordMode
 *   diacritic-engine.js → window.applyDiacritic, window.clearDiacritics, window.flashBlockedTile
 *   api.js           → API.writeChar
 *
 * Exports on window:
 *   window.enterCharacterMode()
 *   window.exitCharacterMode()
 *   window.handleCharacterMode(key, code)
 *   window.CHAR_PANEL_HEIGHT  (px integer — read by Zen Focus calc)
 */

// ---------------------------------------------------------------------------
// Named constant (spec §16 / Plan §Task 2.3)
// Must match the CSS value set on --char-panel-height when the panel is open.
// ---------------------------------------------------------------------------
const CHAR_PANEL_HEIGHT = 180; // px
window.CHAR_PANEL_HEIGHT = CHAR_PANEL_HEIGHT;

// Punctuation regex — mirrors renderer.js; used when rebuilding word spans.
const _PUNCT_RE = /^[\p{P}\p{S}]+$/u;

// ---------------------------------------------------------------------------
// Entry and Exit
// ---------------------------------------------------------------------------

/**
 * Enter Character Mode for the currently active word.
 * Called by navigation.js when Enter is pressed in Word Mode.
 *
 * - Guards against entering on non-navigable (punct) tokens.
 * - Sets charIdx = 0 (first cluster, visually rightmost in RTL).
 * - Opens the char panel and recalculates Zen Focus.
 */
window.enterCharacterMode = function enterCharacterMode() {
  const state = window.editorState;
  const line = state.lines[state.lineIdx];
  if (!line) return;

  const word = line.words[state.wordIdx];
  if (!word || !word.isNavigable || word.clusters.length === 0) return;

  state.mode = "character";
  state.charIdx = 0; // First cluster = rightmost in RTL display

  // Update CSS variable so Zen Focus trims the effective viewport height.
  document.documentElement.style.setProperty(
    "--char-panel-height",
    `${CHAR_PANEL_HEIGHT}px`,
  );

  // Reveal panel (overrides display:none in CSS).
  const panel = document.getElementById("char-panel");
  panel.style.display = "flex";

  _renderCharPanel();
  // Dim the active line to zen-far treatment while char mode is open.
  _applyCharModeLineStyle(true);
  window.updateStatusBar();
  _updateCharStatusBar();
};

/**
 * Exit Character Mode and return to Word Mode.
 * Preserves the current word position (spec §5.2: Escape keeps word position).
 */
window.exitCharacterMode = function exitCharacterMode() {
  const state = window.editorState;
  state.mode = "word";
  state.charIdx = 0;

  // Reset CSS variable → Zen Focus recalculates without panel reservation.
  document.documentElement.style.setProperty("--char-panel-height", "0px");

  // Hide and clear panel.
  const panel = document.getElementById("char-panel");
  panel.style.display = "none";
  panel.innerHTML = "";

  // Restore line opacity and word highlight.
  _applyCharModeLineStyle(false);
  window.updateZenFocus();
  window.updateStatusBar();

  // Hide char position field in status bar (spec §15: visible in char mode only).
  const charSpan = document.getElementById("status-char");
  if (charSpan) charSpan.style.display = "none";
};

// ---------------------------------------------------------------------------
// Panel rendering
// ---------------------------------------------------------------------------

/**
 * Render (or re-render) the character panel tiles for the current word.
 * Called on entry and after every character navigation or diacritic mutation.
 */
function _renderCharPanel() {
  const state = window.editorState;
  const word = state.lines[state.lineIdx]?.words[state.wordIdx];
  if (!word) return;

  const panel = document.getElementById("char-panel");
  panel.innerHTML = "";

  /*
   * Tile container: dir="rtl" so clusters[0] renders at the right edge,
   * matching the natural RTL reading order of the word.
   * Each tile is a <span class="char-tile"> with an explicit data attribute
   * for the cluster index.
   */
  const container = document.createElement("div");
  container.className = "char-tiles-container";
  container.setAttribute("dir", "rtl");

  word.clusters.forEach((cluster, idx) => {
    const tile = document.createElement("span");
    tile.className = "char-tile";
    tile.dataset.charIdx = idx;
    tile.textContent = cluster;

    if (idx === state.charIdx) {
      tile.classList.add("char-tile-active");
    }

    container.appendChild(tile);
  });

  panel.appendChild(container);

  // Fix 3 (Bug Report §Task 4.4): Soft rules are recomputed on every panel
  // render (Plan OQ4: ephemeral). The soft-rules.js JSDoc documents this as
  // the required call site; the call was previously missing.
  if (typeof window.checkSoftRulesAfterWrite === "function") {
    window.checkSoftRulesAfterWrite(
      state.lineIdx,
      state.wordIdx,
      state.charIdx,
    );
  }
}

/**
 * Update the #status-char span (spec §15: "Char N / Total in word").
 * The span is only visible while in Character Mode.
 */
function _updateCharStatusBar() {
  const state = window.editorState;
  if (state.mode !== "character") return;

  const word = state.lines[state.lineIdx]?.words[state.wordIdx];
  const total = word ? word.clusters.length : 0;

  const charSpan = document.getElementById("status-char");
  if (charSpan) {
    charSpan.textContent = `Char ${state.charIdx + 1} / ${total}`;
    charSpan.style.display = "inline";
  }
}

/**
 * Apply or remove Character Mode visual treatment on the active line.
 * When entering: the line text dims to zen-far so the char panel is the focus.
 * When exiting: zen classes are restored by updateZenFocus().
 *
 * @param {boolean} entering — true when entering, false when exiting
 */
function _applyCharModeLineStyle(entering) {
  const state = window.editorState;
  const activeLineEl = document.getElementById(`line-${state.lineIdx}`);
  if (!activeLineEl) return;

  if (entering) {
    activeLineEl.classList.remove("zen-active");
    activeLineEl.classList.add("zen-far");
    // Also remove the word-active highlight — the panel is the focus now.
    const wordEl = document.getElementById(
      `word-${state.lineIdx}-${state.wordIdx}`,
    );
    if (wordEl) wordEl.classList.remove("word-active");
  }
  // On exit, updateZenFocus() re-applies the correct classes.
}

// ---------------------------------------------------------------------------
// Character Mode keystroke handler
// Called by navigation.js handleEditorKeystroke() when state.mode === 'character'
// ---------------------------------------------------------------------------

/**
 * Handle a keydown event while in Character Mode.
 *
 * Routing:
 *   Escape       → exitCharacterMode()
 *   ArrowLeft    → next cluster (RTL, toward word start); auto-exit at boundary
 *   ArrowRight   → previous cluster; auto-exit at boundary
 *   Delete/Backspace → clearDiacritics on current cluster
 *   Diacritic key (raw or keymap-mapped) → applyDiacritic on current cluster
 *
 * @param {string} key  — event.key
 * @param {string} code — event.code (for keymap lookup)
 */
window.handleCharacterMode = function handleCharacterMode(key, code) {
  const state = window.editorState;
  const word = state.lines[state.lineIdx]?.words[state.wordIdx];
  if (!word) return;

  const clusters = word.clusters;

  // ---- Escape: exit to Word Mode, keep word position (spec §5.2) ----
  if (key === "Escape") {
    window.exitCharacterMode();
    return;
  }

  // ---- ArrowLeft: next character in RTL reading order ----
  //      In RTL, ← advances toward the start of the word (clusters[0] is rightmost).
  //      charIdx 0 → rightmost; charIdx (length-1) → leftmost.
  //      Pressing ← from charIdx 0 does NOT advance (we're at the right edge — no prev word there).
  //      Wait, re-reading the spec §5.2:
  //      "← past the last character → auto-exit and advance to next word"
  //      "→ past the first character → auto-exit and move to previous word"
  //      The "last character" in RTL reading order is the leftmost (highest index).
  if (key === "ArrowLeft") {
    const nextIdx = state.charIdx + 1;
    if (nextIdx >= clusters.length) {
      // Past the last character — auto-exit, advance to next word (ArrowLeft in Word Mode)
      window.exitCharacterMode();
      window.handleWordMode("ArrowLeft");
    } else {
      state.charIdx = nextIdx;
      _renderCharPanel();
      _updateCharStatusBar();
    }
    return;
  }

  // ---- ArrowRight: previous character ----
  if (key === "ArrowRight") {
    const prevIdx = state.charIdx - 1;
    if (prevIdx < 0) {
      // Past the first character — auto-exit, move to previous word (ArrowRight in Word Mode)
      window.exitCharacterMode();
      window.handleWordMode("ArrowRight");
    } else {
      state.charIdx = prevIdx;
      _renderCharPanel();
      _updateCharStatusBar();
    }
    return;
  }

  // ---- Delete / Backspace: clear all diacritics from current cluster ----
  if (key === "Delete" || key === "Backspace") {
    _handleClearDiacritics();
    return;
  }

  // ---- Diacritic key: raw Unicode or keymap-mapped ----
  let diacriticCp = null;

  if (/^[\u064B-\u0655\u0670]$/.test(key)) {
    // Raw diacritic from Arabic keyboard layout
    diacriticCp = key;
  } else if (window.KEYMAP && window.KEYMAP[code]) {
    // Custom mapping from keymap.json (Plan §Task 4.5)
    diacriticCp = window.KEYMAP[code];
  }

  if (diacriticCp) {
    _handleDiacriticKey(diacriticCp);
  }
};

// ---------------------------------------------------------------------------
// Diacritic mutation + API write-through
// ---------------------------------------------------------------------------

/**
 * Apply a diacritic to the current cluster and write to disk.
 * Per-keystroke write-through (Plan locked decision: "per-keystroke").
 *
 * On API failure: API.writeChar shows the blocking error banner and returns
 * false. We revert the in-memory state to keep UI and file in sync.
 *
 * @param {string} incoming — diacritic code point
 */
async function _handleDiacriticKey(incoming) {
  const state = window.editorState;
  const word = state.lines[state.lineIdx]?.words[state.wordIdx];
  if (!word) return;

  const originalCluster = word.clusters[state.charIdx];
  const newCluster = window.applyDiacritic(originalCluster, incoming);

  if (newCluster === null) {
    // Hard-blocked — flash the panel and do nothing else.
    window.flashBlockedTile();
    return;
  }

  // Optimistic in-memory update
  word.clusters[state.charIdx] = newCluster;

  // Write to disk — blocking error banner is handled inside API.writeChar
  const success = await API.writeChar({
    file_path: state.filePath,
    line_idx: state.lineIdx,
    word_idx: state.wordIdx,
    char_idx: state.charIdx,
    new_cluster: newCluster,
  });

  if (!success) {
    // Revert in-memory state so UI and file remain in sync
    word.clusters[state.charIdx] = originalCluster;
    _renderCharPanel();
    return;
  }

  // Reflect the change in the word span in the document pane
  _updateWordSpanText(state.lineIdx, state.wordIdx, word.clusters);
  _renderCharPanel();

  // Fix 1 (Bug Report §Task 4.1): Re-classify the affected word so amber
  // highlights clear immediately and totalUndiacCount stays accurate.
  // Must come AFTER _updateWordSpanText() so .letter-cluster spans exist.
  window.reclassifyWord(state.lineIdx, state.wordIdx);
}

/**
 * Clear all diacritics from the current cluster and write to disk.
 */
async function _handleClearDiacritics() {
  const state = window.editorState;
  const word = state.lines[state.lineIdx]?.words[state.wordIdx];
  if (!word) return;

  const originalCluster = word.clusters[state.charIdx];
  const newCluster = window.clearDiacritics(originalCluster);

  // Nothing to do if the cluster is already bare
  if (newCluster === originalCluster) return;

  word.clusters[state.charIdx] = newCluster;

  const success = await API.writeChar({
    file_path: state.filePath,
    line_idx: state.lineIdx,
    word_idx: state.wordIdx,
    char_idx: state.charIdx,
    new_cluster: newCluster,
  });

  if (!success) {
    word.clusters[state.charIdx] = originalCluster;
    _renderCharPanel();
    return;
  }

  _updateWordSpanText(state.lineIdx, state.wordIdx, word.clusters);
  _renderCharPanel();

  // Fix 1 (Bug Report §Task 4.1): same as _handleDiacriticKey — must
  // reclassify after clearing so the amber dot and count update immediately.
  window.reclassifyWord(state.lineIdx, state.wordIdx);
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Rebuild the word's `<span class="word">` in the document pane to reflect
 * the updated clusters array after a diacritic mutation.
 *
 * Mirrors the rendering logic in renderer.js so the document pane stays
 * visually consistent with editorState.
 *
 * @param {number}   lineIdx  — 0-based line index
 * @param {number}   wordIdx  — 0-based word index
 * @param {string[]} clusters — updated clusters array
 */
function _updateWordSpanText(lineIdx, wordIdx, clusters) {
  const wordEl = document.getElementById(`word-${lineIdx}-${wordIdx}`);
  if (!wordEl) return;

  wordEl.innerHTML = "";

  // Fix 2 (Bug Report §Task 4.1): Mirror the Phase 4 rendering pattern from
  // renderer.js exactly. Every cluster must be a
  //   <span class="letter-cluster [punct]" data-char-idx="N">
  // element so that _classifyWord() in visual-hints.js can locate them via
  // .querySelectorAll('.letter-cluster') and apply .amber-candidate.
  // Using bare createTextNode() here caused _classifyWord() to find nothing
  // and silently fail even when reclassifyWord() was called.
  clusters.forEach((cluster, idx) => {
    const clSpan = document.createElement("span");
    clSpan.dataset.charIdx = idx;
    clSpan.className = _PUNCT_RE.test(cluster)
      ? "letter-cluster punct"
      : "letter-cluster";
    clSpan.textContent = cluster;
    wordEl.appendChild(clSpan);
  });
}
