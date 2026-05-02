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
                char: window.editorState.charIdx
            }).then(() => {
                const indicator = document.getElementById('status-autosave');
                indicator.classList.add('visible');
                setTimeout(() => indicator.classList.remove('visible'), 2000);
            });
        }
    }, 500);
}

window.flushCursorNow = async function() {
    clearTimeout(saveCursorTimeout);
    if (window.editorState.filePath) {
        await API.saveCursor(window.editorState.filePath, {
            line: window.editorState.lineIdx,
            word: window.editorState.wordIdx,
            char: window.editorState.charIdx
        });
    }
};

document.addEventListener('keydown', (event) => {
    if (!window.editorState.filePath) return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    const consumedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape', 'Backspace', 'Delete'];
    
    // Check if it's a raw diacritic OR a mapped key in keymap.json
    const isRawDiacritic = /^[\u064B-\u0655\u0670]$/.test(event.key);
    const isMappedKey = window.KEYMAP && window.KEYMAP[event.code];

    if (consumedKeys.includes(event.key) || isRawDiacritic || isMappedKey) {
        event.preventDefault();
        handleEditorKeystroke(event);
    }
});

function handleEditorKeystroke(event) {
    const state = window.editorState;

    if (state.mode === 'word') {
        handleWordMode(event.key);
    } else if (state.mode === 'character') {
        // Route to Phase 3 handler, passing both key and code for keymap support
        if (typeof window.handleCharacterMode === 'function') {
            window.handleCharacterMode(event.key, event.code);
        }
    }
}

window.handleWordMode = function(key) {
    const state = window.editorState;
    const lines = state.lines;
    let moved = false;

    if (key === 'ArrowRight') {
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

    } else if (key === 'ArrowLeft') {
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

    } else if (key === 'ArrowDown') {
        if (state.lineIdx < lines.length - 1) {
            state.lineIdx++;
            window.clampCursorToNavigable();
            moved = true;
        }
    } else if (key === 'ArrowUp') {
        if (state.lineIdx > 0) {
            state.lineIdx--;
            window.clampCursorToNavigable();
            moved = true;
        }
    } else if (key === 'Enter') {
        if (typeof window.enterCharacterMode === 'function') {
            window.enterCharacterMode();
        }
    } else if (key === 'Tab') {
        console.log("Tab pressed: Jump to next undiacritized word (Phase 4)");
    }

    if (moved) {
        updateZenFocus();
        updateStatusBar();
        scheduleCursorSave();
    }
}