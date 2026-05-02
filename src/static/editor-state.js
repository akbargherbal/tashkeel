/**
 * editor-state.js
 * Central source of truth for the editor's state.
 */

window.editorState = {
    // File
    filePath: null,
    status: 'untouched',

    // Mode
    mode: 'word', // 'word' | 'character'

    // Word Mode cursor
    lineIdx: 0,
    wordIdx: 0,

    // Character Mode cursor
    charIdx: 0, // Index into clusters[] array — NEVER a raw string index

    // Document data
    lines: [],
    /*
      lines[i] = {
        words: [
          {
            index: 0,               // Matches backend word_idx
            clusters: [],           // Array of grapheme cluster strings
            isNavigable: true,      // False if token is purely punctuation
            undiacCount: 0,         // Phase 4
            hasSoftWarning: false   // Phase 4
          }
        ]
      }
    */

    // Document-level counts
    totalUndiacCount: 0,

    // UI state
    lastSaveTime: null
};