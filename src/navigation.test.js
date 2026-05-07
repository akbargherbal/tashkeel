/**
 * navigation.test.js
 * Task 2.5 — Tests for window._tabJumpToNextUndiac and window._tabJumpToPrevUndiac
 *
 * Prerequisites:
 *   - navigation.js must have the one-line addition at its end:
 *       window._tabJumpToPrevUndiac = _tabJumpToPrevUndiac;
 *     (Task 2.5 production change — applied before running these tests.)
 *
 * Strategy: both functions are pure cursor-movement routines that read and
 * mutate window.editorState.  No DOM interaction.  Each test constructs a
 * minimal lines array, calls the function, then asserts the new cursor
 * position and return value.
 *
 * Tests: T_NAV_01 – T_NAV_10  (10 tests)
 */

'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal word object.
 * @param {number}  undiacCount
 * @param {boolean} [isNavigable=true]
 */
function makeWord(undiacCount, isNavigable = true) {
  return { isNavigable, undiacCount, clusters: [] };
}

/**
 * Set the relevant editorState fields before each assertion.
 * @param {number}   lineIdx
 * @param {number}   wordIdx
 * @param {Array}    lines        — array of { words: [...] }
 * @param {number}   total        — totalUndiacCount
 */
function setState(lineIdx, wordIdx, lines, total) {
  window.editorState.lineIdx          = lineIdx;
  window.editorState.wordIdx          = wordIdx;
  window.editorState.lines            = lines;
  window.editorState.totalUndiacCount = total;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  window.editorState.lines            = [];
  window.editorState.lineIdx          = 0;
  window.editorState.wordIdx          = 0;
  window.editorState.totalUndiacCount = 0;
});

// ---------------------------------------------------------------------------
// _tabJumpToNextUndiac — forward jump
// ---------------------------------------------------------------------------

describe('_tabJumpToNextUndiac — forward jump', () => {
  test('T_NAV_01 — totalUndiacCount === 0 → returns false, cursor unchanged', () => {
    setState(0, 0, [{ words: [makeWord(0)] }], 0);

    const result = window._tabJumpToNextUndiac();

    expect(result).toBe(false);
    expect(window.editorState.lineIdx).toBe(0);
    expect(window.editorState.wordIdx).toBe(0);
  });

  test('T_NAV_02 — next word on same line has undiacCount > 0 → moves there, returns true', () => {
    // Line 0: [diacritized (0), undiac (3)]  — cursor starts at word 0
    setState(0, 0, [{ words: [makeWord(0), makeWord(3)] }], 3);

    const result = window._tabJumpToNextUndiac();

    expect(result).toBe(true);
    expect(window.editorState.lineIdx).toBe(0);
    expect(window.editorState.wordIdx).toBe(1);
  });

  test('T_NAV_03 — no more undiac words on current line; next line has one → moves there', () => {
    // Line 0: [diacritized, diacritized]  Line 1: [undiac]
    // Cursor starts at (0, 1) — last word on line 0.
    setState(
      0, 1,
      [
        { words: [makeWord(0), makeWord(0)] },
        { words: [makeWord(2)] },
      ],
      2,
    );

    const result = window._tabJumpToNextUndiac();

    expect(result).toBe(true);
    expect(window.editorState.lineIdx).toBe(1);
    expect(window.editorState.wordIdx).toBe(0);
  });

  test('T_NAV_04 — cursor is on the last undiac word → wraps to first undiac word in document', () => {
    // Line 0: [undiac (2)]   Line 1: [undiac (3)]
    // Cursor at (1, 0) — the last undiac word; forward scan wraps to (0, 0).
    setState(
      1, 0,
      [
        { words: [makeWord(2)] },
        { words: [makeWord(3)] },
      ],
      5,
    );

    const result = window._tabJumpToNextUndiac();

    expect(result).toBe(true);
    expect(window.editorState.lineIdx).toBe(0);
    expect(window.editorState.wordIdx).toBe(0);
  });

  test('T_NAV_05 — only one undiac word in document and cursor is already on it → returns false', () => {
    // Only one undiac word; after exhausting forward scan, wrap finds the same word.
    setState(0, 0, [{ words: [makeWord(3)] }], 3);

    const result = window._tabJumpToNextUndiac();

    expect(result).toBe(false);
    // Cursor must not have moved
    expect(window.editorState.lineIdx).toBe(0);
    expect(window.editorState.wordIdx).toBe(0);
  });

  test('T_NAV_06 — non-navigable words (punct) are skipped; lands on first navigable undiac word', () => {
    // Line 0: [diacritized navigable (0), punct non-navigable (0), undiac navigable (2)]
    // Cursor at (0, 0); must skip idx 1 (non-navigable) and land on idx 2.
    setState(
      0, 0,
      [{ words: [makeWord(0), makeWord(0, false), makeWord(2)] }],
      2,
    );

    const result = window._tabJumpToNextUndiac();

    expect(result).toBe(true);
    expect(window.editorState.wordIdx).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// _tabJumpToPrevUndiac — backward jump
// ---------------------------------------------------------------------------

describe('_tabJumpToPrevUndiac — backward jump', () => {
  test('T_NAV_07 — totalUndiacCount === 0 → returns false, cursor unchanged', () => {
    setState(0, 0, [{ words: [makeWord(0)] }], 0);

    const result = window._tabJumpToPrevUndiac();

    expect(result).toBe(false);
    expect(window.editorState.lineIdx).toBe(0);
    expect(window.editorState.wordIdx).toBe(0);
  });

  test('T_NAV_08 — previous word on same line has undiacCount > 0 → moves there, returns true', () => {
    // Line 0: [undiac (2), diacritized (0)]  — cursor starts at word 1
    setState(0, 1, [{ words: [makeWord(2), makeWord(0)] }], 2);

    const result = window._tabJumpToPrevUndiac();

    expect(result).toBe(true);
    expect(window.editorState.lineIdx).toBe(0);
    expect(window.editorState.wordIdx).toBe(0);
  });

  test('T_NAV_09 — cursor is on the first undiac word → wraps to last undiac word in document', () => {
    // Line 0: [undiac (2)]   Line 1: [undiac (3)]
    // Cursor at (0, 0) — the first undiac word; backward scan wraps to (1, 0).
    setState(
      0, 0,
      [
        { words: [makeWord(2)] },
        { words: [makeWord(3)] },
      ],
      5,
    );

    const result = window._tabJumpToPrevUndiac();

    expect(result).toBe(true);
    expect(window.editorState.lineIdx).toBe(1);
    expect(window.editorState.wordIdx).toBe(0);
  });

  test('T_NAV_10 — only one undiac word in document and cursor is already on it → returns false', () => {
    setState(0, 0, [{ words: [makeWord(3)] }], 3);

    const result = window._tabJumpToPrevUndiac();

    expect(result).toBe(false);
    expect(window.editorState.lineIdx).toBe(0);
    expect(window.editorState.wordIdx).toBe(0);
  });
});
