/**
 * visual-hints.test.js
 * Task 2.4 — Tests for window.classifyAllWords and window.reclassifyWord
 *
 * Strategy: _isAmberCandidate is not exported; tests drive it by calling
 * classifyAllWords() with a carefully constructed editorState + real jsdom
 * DOM, then reading word.undiacCount and .amber-candidate class states.
 *
 * DOM approach: real jsdom elements (Decision #2, Session 36).
 * Each test appends a word element to document.body; afterEach removes all
 * elements whose id begins with "word-".
 *
 * updateStatusBar is mocked via vi.fn() to prevent renderer.js DOM side-effects.
 *
 * Tests: T_VH_01 – T_VH_13  (13 tests)
 */

'use strict';

// ---------------------------------------------------------------------------
// Arabic codepoints
// ---------------------------------------------------------------------------
const ALEF          = '\u0627'; // ا
const ALEF_MAQSURA  = '\u0649'; // ى
const WAW           = '\u0648'; // و
const YA            = '\u064A'; // ي
const BA            = '\u0628'; // ب (generic Arabic consonant, non-exempt)
const FATHA         = '\u064E'; // َ
const KASRA         = '\u0650'; // ِ
const DAMMA         = '\u064F'; // ُ

// ---------------------------------------------------------------------------
// Helper: build editorState + real jsdom word element
// ---------------------------------------------------------------------------

/**
 * Set window.editorState to a single-line, single-word document with the given
 * clusters, then append a real jsdom word element to document.body.  Each
 * cluster gets a <span class="letter-cluster"> child with data-char-idx.
 *
 * Returns { word, wordEl } for direct manipulation in tests.
 *
 * @param {string[]} clusters
 * @param {number} [li=0]  line index
 * @param {number} [wi=0]  word index
 */
function setupWordWithDOM(clusters, li = 0, wi = 0) {
  const word = { isNavigable: true, undiacCount: 0, clusters: [...clusters] };
  window.editorState.lines = [{ words: [word] }];
  window.editorState.totalUndiacCount = 0;

  // Remove any existing element with the same id
  const existing = document.getElementById(`word-${li}-${wi}`);
  if (existing) existing.remove();

  const wordEl = document.createElement('div');
  wordEl.id = `word-${li}-${wi}`;

  clusters.forEach((_, i) => {
    const span = document.createElement('span');
    span.className = 'letter-cluster';   // non-punct — eligible for amber
    span.dataset.charIdx = String(i);
    wordEl.appendChild(span);
  });

  document.body.appendChild(wordEl);
  return { word, wordEl };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Prevent renderer.js DOM access from throwing during status bar updates
  window.updateStatusBar = vi.fn();

  window.editorState.lines = [];
  window.editorState.totalUndiacCount = 0;
  window.editorState.lineIdx = 0;
  window.editorState.wordIdx = 0;
});

afterEach(() => {
  // Remove all word elements added during the test
  document.querySelectorAll('[id^="word-"]').forEach(el => el.remove());
});

// ---------------------------------------------------------------------------
// _isAmberCandidate — exempt rules (via classifyAllWords)
// ---------------------------------------------------------------------------

describe('_isAmberCandidate — alef exemption rules', () => {
  test('T_VH_01 — bare alef at non-initial position (idx > 0) → NOT amber (long-vowel exempt)', () => {
    const { word, wordEl } = setupWordWithDOM([BA, ALEF]);
    window.classifyAllWords();

    expect(word.undiacCount).toBe(1); // only BA is amber; ALEF at idx>0 is exempt
    const span1 = wordEl.querySelectorAll('.letter-cluster')[1];
    expect(span1.classList.contains('amber-candidate')).toBe(false);
  });

  test('T_VH_02 — bare alef at initial position (idx === 0) → IS amber', () => {
    const { word, wordEl } = setupWordWithDOM([ALEF, BA]);
    window.classifyAllWords();

    const span0 = wordEl.querySelectorAll('.letter-cluster')[0];
    expect(span0.classList.contains('amber-candidate')).toBe(true);
  });

  test('T_VH_03 — bare alef maqsura at final position → NOT amber (exempt)', () => {
    const { word, wordEl } = setupWordWithDOM([BA, ALEF_MAQSURA]);
    window.classifyAllWords();

    const span1 = wordEl.querySelectorAll('.letter-cluster')[1];
    expect(span1.classList.contains('amber-candidate')).toBe(false);
  });

  test('T_VH_04 — bare alef maqsura at non-final position → IS amber', () => {
    const { word, wordEl } = setupWordWithDOM([ALEF_MAQSURA, BA]);
    window.classifyAllWords();

    const span0 = wordEl.querySelectorAll('.letter-cluster')[0];
    expect(span0.classList.contains('amber-candidate')).toBe(true);
  });
});

describe('_isAmberCandidate — waw and ya long-vowel exemptions', () => {
  test('T_VH_05 — bare waw whose preceding cluster carries damma → NOT amber (long-vowel role)', () => {
    // Ba+damma (idx 0), Waw (idx 1) — waw follows damma → exempt
    const { word, wordEl } = setupWordWithDOM([BA + DAMMA, WAW]);
    window.classifyAllWords();

    const span1 = wordEl.querySelectorAll('.letter-cluster')[1];
    expect(span1.classList.contains('amber-candidate')).toBe(false);
  });

  test('T_VH_06 — bare waw whose preceding cluster carries kasra (not damma) → IS amber', () => {
    // Ba+kasra (idx 0), Waw (idx 1) — preceding vowel is kasra, not damma → not exempt
    const { word, wordEl } = setupWordWithDOM([BA + KASRA, WAW]);
    window.classifyAllWords();

    const span1 = wordEl.querySelectorAll('.letter-cluster')[1];
    expect(span1.classList.contains('amber-candidate')).toBe(true);
  });

  test('T_VH_07 — bare waw at idx 0 (no preceding cluster) → IS amber (pragmatic fallback)', () => {
    // No preceding cluster to evaluate → defaults to amber (spec §8.4 pragmatic note)
    const { word, wordEl } = setupWordWithDOM([WAW, BA]);
    window.classifyAllWords();

    const span0 = wordEl.querySelectorAll('.letter-cluster')[0];
    expect(span0.classList.contains('amber-candidate')).toBe(true);
  });

  test('T_VH_08 — bare ya whose preceding cluster carries kasra → NOT amber (long-vowel role)', () => {
    // Ba+kasra (idx 0), Ya (idx 1) — ya follows kasra → exempt
    const { word, wordEl } = setupWordWithDOM([BA + KASRA, YA]);
    window.classifyAllWords();

    const span1 = wordEl.querySelectorAll('.letter-cluster')[1];
    expect(span1.classList.contains('amber-candidate')).toBe(false);
  });
});

describe('_isAmberCandidate — already-diacritized and non-Arabic', () => {
  test('T_VH_09 — cluster that already carries a combining mark → NOT amber', () => {
    // Ba+fatha is diacritized → marks.size > 0 → not amber
    const { word, wordEl } = setupWordWithDOM([BA + FATHA]);
    window.classifyAllWords();

    expect(word.undiacCount).toBe(0);
    const span0 = wordEl.querySelectorAll('.letter-cluster')[0];
    expect(span0.classList.contains('amber-candidate')).toBe(false);
  });

  test('T_VH_10 — Latin character → NOT amber (outside Arabic Unicode block)', () => {
    // 'a' has codepoint 97, below _AR_MIN (0x0621) → not in Arabic block
    const { word, wordEl } = setupWordWithDOM(['a', BA]);
    window.classifyAllWords();

    const span0 = wordEl.querySelectorAll('.letter-cluster')[0];
    expect(span0.classList.contains('amber-candidate')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reclassifyWord — delta arithmetic
// ---------------------------------------------------------------------------

describe('reclassifyWord — totalUndiacCount delta arithmetic', () => {
  test('T_VH_11 — diacritize one of two amber clusters → totalUndiacCount decreases by 1', () => {
    // Setup: both BA and another BA are amber initially
    const { word } = setupWordWithDOM([BA, BA]);
    window.classifyAllWords();

    expect(word.undiacCount).toBe(2);
    expect(window.editorState.totalUndiacCount).toBe(2);

    // Simulate diacritizing cluster 0: add fatha to it
    word.clusters[0] = BA + FATHA;
    window.reclassifyWord(0, 0);

    expect(word.undiacCount).toBe(1);
    expect(window.editorState.totalUndiacCount).toBe(1);
  });

  test('T_VH_12 — clear diacritic from a previously-diacritized cluster → totalUndiacCount increases by 1', () => {
    // Setup: one diacritized, one bare — only one amber initially
    const { word } = setupWordWithDOM([BA + FATHA, BA]);
    window.classifyAllWords();

    expect(word.undiacCount).toBe(1);
    expect(window.editorState.totalUndiacCount).toBe(1);

    // Simulate clearing cluster 0: remove the fatha
    word.clusters[0] = BA;
    window.reclassifyWord(0, 0);

    expect(word.undiacCount).toBe(2);
    expect(window.editorState.totalUndiacCount).toBe(2);
  });

  test('T_VH_13 — Math.max guard: delta cannot push totalUndiacCount below zero', () => {
    // Setup: no amber clusters, but artificially claim oldCount=1 and total=0
    // to exercise the Math.max(0, ...) guard in reclassifyWord.
    const { word } = setupWordWithDOM([BA + FATHA]);
    word.undiacCount = 1;                   // stale/inconsistent stored count
    window.editorState.totalUndiacCount = 0; // already at floor

    window.reclassifyWord(0, 0);
    // After reclassify: undiacCount = 0, delta = -1,
    // totalUndiacCount = Math.max(0, 0 + (-1)) = 0  (not -1)
    expect(window.editorState.totalUndiacCount).toBe(0);
  });
});
