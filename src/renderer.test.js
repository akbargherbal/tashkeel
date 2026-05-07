/**
 * renderer.test.js
 * Task 2.6 — Tests for window.clampCursorToNavigable and window.segmentWord.
 * Both functions are defined in static/renderer.js and exposed on window.
 *
 * clampCursorToNavigable reads only window.editorState — no DOM access.
 * segmentWord wraps Intl.Segmenter('ar', { granularity: 'grapheme' }) —
 * requires Node ≥ 16 (confirmed in session 37 pre-coding checklist).
 *
 * See TESTING_PHASED_PLAN.md Task 2.6.
 */

// ---------------------------------------------------------------------------
// clampCursorToNavigable — 5 tests (T_RND_01 – T_RND_05)
// ---------------------------------------------------------------------------

describe('clampCursorToNavigable — cursor clamping', () => {

  // Helper: set up a single-line editorState with the given word descriptors.
  // Each entry in `words` is { isNavigable: boolean }.
  function setState(wordIdx, words) {
    window.editorState.lineIdx = 0;
    window.editorState.wordIdx = wordIdx;
    window.editorState.lines   = [{ words }];
  }

  test('T_RND_01 — wordIdx in bounds and navigable → unchanged', () => {
    setState(1, [
      { isNavigable: true },
      { isNavigable: true },
      { isNavigable: true },
    ]);
    window.clampCursorToNavigable();
    expect(window.editorState.wordIdx).toBe(1);
  });

  test('T_RND_02 — wordIdx out of bounds (>= words.length) → clamped to last word', () => {
    // Last word (index 1) is navigable, so clamp stops there.
    setState(5, [
      { isNavigable: true },
      { isNavigable: true },
    ]);
    window.clampCursorToNavigable();
    expect(window.editorState.wordIdx).toBe(1);
  });

  test('T_RND_03 — current word is non-navigable (punct) → scans backward to navigable', () => {
    // words: [nav, nav, punct]  — start at idx 2 (punct)
    // backward scan hits idx 1 (nav) and stops.
    setState(2, [
      { isNavigable: true  },
      { isNavigable: true  },
      { isNavigable: false },
    ]);
    window.clampCursorToNavigable();
    expect(window.editorState.wordIdx).toBe(1);
  });

  test('T_RND_04 — all words before current are non-navigable → falls to forward scan', () => {
    // words: [punct, punct, nav]  — start at idx 1
    // backward scan: idx 1 (punct) → idx 0 (punct) → idx -1 → triggers forward scan
    // forward scan: idx 0 (punct) → idx 1 (punct) → idx 2 (nav) → stops
    setState(1, [
      { isNavigable: false },
      { isNavigable: false },
      { isNavigable: true  },
    ]);
    window.clampCursorToNavigable();
    expect(window.editorState.wordIdx).toBe(2);
  });

  test('T_RND_05 — single navigable word surrounded by punct → always lands on it', () => {
    // words: [punct, nav, punct]  — start at idx 0
    // backward scan: idx 0 (punct) → idx -1 → forward scan → idx 1 (nav) → stops
    setState(0, [
      { isNavigable: false },
      { isNavigable: true  },
      { isNavigable: false },
    ]);
    window.clampCursorToNavigable();
    expect(window.editorState.wordIdx).toBe(1);
  });

});

// ---------------------------------------------------------------------------
// segmentWord — 3 tests (T_RND_06 – T_RND_08)
// ---------------------------------------------------------------------------

describe('segmentWord — Intl.Segmenter grapheme cluster wrapper', () => {

  test('T_RND_06 — ASCII word → each character is its own cluster', () => {
    const result = window.segmentWord('abc');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  test('T_RND_07 — Arabic diacritized word → correct cluster count (base + mark per cluster)', () => {
    // كِتَابٌ  (kitāb = "book")  — 4 base letters, each with a diacritic:
    //   كِ (kaf + kasra)
    //   تَ (ta  + fatha)
    //   ا  (alef, no diacritic)
    //   بٌ (ba  + dammatan)
    // Intl.Segmenter groups each base letter + its combining marks into one grapheme cluster.
    const result = window.segmentWord('كِتَابٌ');
    expect(result).toHaveLength(4);
    // Each cluster is a non-empty string.
    result.forEach(cluster => expect(cluster.length).toBeGreaterThan(0));
    // Verify the whole word reconstructs correctly.
    expect(result.join('')).toBe('كِتَابٌ');
  });

  test('T_RND_08 — non-canonical combining mark order preserved byte-for-byte', () => {
    // Canonical order for (ba + shadda + fatha) is: base → shadda(B) → fatha(A).
    // Non-canonical: base → fatha → shadda  (\u0628\u064E\u0651).
    // The segmenter must group these into ONE cluster but must NOT reorder the marks —
    // that would violate the byte-preservation contract (RULES.md §3.2).
    const nonCanonical = '\u0628\u064E\u0651'; // ba + fatha + shadda (non-canonical)
    const result = window.segmentWord(nonCanonical);
    expect(result).toHaveLength(1);
    // The cluster string is byte-for-byte identical to the input.
    expect(result[0]).toBe(nonCanonical);
  });

});
