/**
 * navigation.js
 * Word Mode keyboard navigation and cursor saving.
 */

let saveCursorTimeout = null;

function scheduleCursorSave() {
  clearTimeout(saveCursorTimeout);
  saveCursorTimeout = setTimeout(() => {
    if (window.editorState.filePath) {
      API.saveCursor(window.editorState.filePath, {
        line: window.editorState.lineIdx,
        word: window.editorState.wordIdx,
        char: window.editorState.charIdx,
      }).then(() => {
        const indicator = document.getElementById("status-autosave");
        indicator.classList.add("visible");
        setTimeout(() => indicator.classList.remove("visible"), 2000);
      });
    }
  }, 500);
}

window.scheduleCursorSave = scheduleCursorSave;

window.flushCursorNow = async function () {
  clearTimeout(saveCursorTimeout);
  if (window.editorState.filePath) {
    await API.saveCursor(window.editorState.filePath, {
      line: window.editorState.lineIdx,
      word: window.editorState.wordIdx,
      char: window.editorState.charIdx,
    });
  }
};

document.addEventListener("keydown", (event) => {
  if (!window.editorState.filePath) return;
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")
    return;

  const consumedKeys = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Enter",
    "Tab",
    "Escape",
    "Backspace",
    "Delete",
    " ",
  ];

  // Check if it's a raw diacritic OR a mapped key in keymap.json
  const isRawDiacritic = /^[\u064B-\u0655\u0670]$/.test(event.key);
  const isMappedKey = window.KEYMAP && window.KEYMAP[event.code];

  // Allow any printable character through IF we are in Character Mode (for the language warning)
  const isCharModePrintable =
    window.editorState.mode === "character" && event.key.length === 1;

  if (
    consumedKeys.includes(event.key) ||
    isRawDiacritic ||
    isMappedKey ||
    isCharModePrintable
  ) {
    event.preventDefault();
    handleEditorKeystroke(event);
  }
});

function handleEditorKeystroke(event) {
  const state = window.editorState;

  if (state.mode === "word") {
    const key = event.shiftKey && event.key === "Tab" ? "ShiftTab" : event.key;
    handleWordMode(key);
  } else if (state.mode === "character") {
    // Route to Phase 3 handler, passing both key and code for keymap support
    if (typeof window.handleCharacterMode === "function") {
      window.handleCharacterMode(event.key, event.code, event.shiftKey);
    }
  }
}

window.handleWordMode = function (key) {
  const state = window.editorState;
  const lines = state.lines;
  let moved = false;

  if (key === "ArrowRight") {
    do {
      state.wordIdx--;
      if (state.wordIdx < 0) {
        if (state.lineIdx > 0) {
          state.lineIdx--;
          state.wordIdx = lines[state.lineIdx].words.length - 1;
        } else {
          state.wordIdx = 0;
          window.clampCursorToNavigable(); // Gap 5 Fix: Ensure boundary is navigable
          break;
        }
      }
    } while (!lines[state.lineIdx].words[state.wordIdx].isNavigable);
    moved = true;
  } else if (key === "ArrowLeft") {
    do {
      state.wordIdx++;
      if (state.wordIdx >= lines[state.lineIdx].words.length) {
        if (state.lineIdx < lines.length - 1) {
          state.lineIdx++;
          state.wordIdx = 0;
        } else {
          state.wordIdx = lines[state.lineIdx].words.length - 1;
          window.clampCursorToNavigable(); // Gap 5 Fix: Ensure boundary is navigable
          break;
        }
      }
    } while (!lines[state.lineIdx].words[state.wordIdx].isNavigable);
    moved = true;
  } else if (key === "ArrowDown") {
    if (state.lineIdx < lines.length - 1) {
      state.lineIdx++;
      window.clampCursorToNavigable();
      moved = true;
    }
  } else if (key === "ArrowUp") {
    if (state.lineIdx > 0) {
      state.lineIdx--;
      window.clampCursorToNavigable();
      moved = true;
    }
  } else if (key === "Enter") {
    if (typeof window.enterCharacterMode === "function") {
      window.enterCharacterMode();
    }
  } else if (key === "Tab") {
    // Phase 4: Jump to next undiacritized word
    if (_tabJumpToNextUndiac()) {
      moved = true;
    }
  } else if (key === " ") {
    // Phase 1 Ergonomics: Space acts as single-key advance (same as Tab)
    if (_tabJumpToNextUndiac()) {
      moved = true;
    }
  } else if (key === "ShiftTab") {
    // Phase 1 Ergonomics: Shift+Tab jumps backward
    if (_tabJumpToPrevUndiac()) {
      moved = true;
    }
  }

  if (moved) {
    updateZenFocus();
    updateStatusBar();
    scheduleCursorSave();
  }

  // Phase 2 Full flow: Space in Word Mode jumps AND enters Character Mode.
  // enterCharacterMode() fires AFTER updateZenFocus() so that
  // _applyCharModeLineStyle() (which dims the line and removes zen-active)
  // runs last and wins over the zen class assignments from updateZenFocus().
  if (key === " " && moved && typeof window.enterCharacterMode === "function") {
    window.enterCharacterMode();
  }
};

/**
 * Phase 4: Scan forward for the next word with undiacCount > 0.
 * Wraps around at the end of the document.
 * Returns true if the cursor moved, false if no other undiacritized words exist.
 */
function _tabJumpToNextUndiac() {
  const state = window.editorState;
  const lines = state.lines;

  if (state.totalUndiacCount === 0) return false;

  // Phase 1: search from next word to end of document
  for (let li = state.lineIdx; li < lines.length; li++) {
    const startWi = li === state.lineIdx ? state.wordIdx + 1 : 0;
    for (let wi = startWi; wi < lines[li].words.length; wi++) {
      const word = lines[li].words[wi];
      if (word.isNavigable && word.undiacCount > 0) {
        state.lineIdx = li;
        state.wordIdx = wi;
        return true;
      }
    }
  }

  // Phase 2: wrap — search from start of document to current word (inclusive)
  for (let li = 0; li <= state.lineIdx; li++) {
    const endWi =
      li === state.lineIdx ? state.wordIdx : lines[li].words.length - 1;
    for (let wi = 0; wi <= endWi; wi++) {
      const word = lines[li].words[wi];
      if (word.isNavigable && word.undiacCount > 0) {
        // If it wrapped all the way around to the exact same word, don't "move"
        if (li === state.lineIdx && wi === state.wordIdx) return false;

        state.lineIdx = li;
        state.wordIdx = wi;
        return true;
      }
    }
  }

  return false;
}

window._tabJumpToNextUndiac = _tabJumpToNextUndiac;

/**
 * Scan backward for the previous word with undiacCount > 0.
 * Wraps at the start of the document.
 * Returns true if the cursor moved, false if no other undiacritized words exist.
 */
function _tabJumpToPrevUndiac() {
  const state = window.editorState;
  const lines = state.lines;

  if (state.totalUndiacCount === 0) return false;

  // Phase 1: search backward from previous word to start of document
  for (let li = state.lineIdx; li >= 0; li--) {
    const startWi =
      li === state.lineIdx ? state.wordIdx - 1 : lines[li].words.length - 1;
    for (let wi = startWi; wi >= 0; wi--) {
      const word = lines[li].words[wi];
      if (word.isNavigable && word.undiacCount > 0) {
        state.lineIdx = li;
        state.wordIdx = wi;
        return true;
      }
    }
  }

  // Phase 2: wrap — search backward from end of document to current word (inclusive)
  for (let li = lines.length - 1; li >= state.lineIdx; li--) {
    const endWi =
      li === state.lineIdx ? state.wordIdx : lines[li].words.length - 1;
    for (let wi = endWi; wi >= 0; wi--) {
      const word = lines[li].words[wi];
      if (word.isNavigable && word.undiacCount > 0) {
        if (li === state.lineIdx && wi === state.wordIdx) return false;
        state.lineIdx = li;
        state.wordIdx = wi;
        return true;
      }
    }
  }

  return false;
}
