/**
 * soft-rules.test.js
 * Task 2.3 — Tests for window.checkSoftRulesAfterWrite
 *
 * Strategy: _runSoftRules is not exported; tests drive it via
 * checkSoftRulesAfterWrite(lineIdx, wordIdx, charIdx), inspecting both
 * word.hasSoftWarning and the DOM mutations on #char-panel tiles.
 *
 * DOM approach: real jsdom elements appended to document.body (Decision #2,
 * Session 36 — jsdom's real DOM is used; the plan's minimal stub was not applied).
 * Each test builds a fresh #char-panel and removes it in afterEach.
 *
 * Tests: T_SR_01 – T_SR_09  (9 tests)
 */

'use strict';

// ---------------------------------------------------------------------------
// Arabic codepoints
// ---------------------------------------------------------------------------
const ALEF          = '\u0627'; // ا
const ALEF_MAQSURA  = '\u0649'; // ى
const LAM           = '\u0644'; // ل
const BA            = '\u0628'; // ب
const TA            = '\u062A'; // ت
const FATHA         = '\u064E'; // َ
const TANWIN_F      = '\u064B'; // ً  tanwin fatha (Group A + tanwin)

// ---------------------------------------------------------------------------
// Helper: build editorState + real jsdom #char-panel
// ---------------------------------------------------------------------------

/**
 * Set window.editorState to a single-line, single-word document with the given
 * clusters, then append a real jsdom #char-panel to document.body with one
 * .char-tile per cluster.
 *
 * Returns the panel element so callers can query tiles.
 */
function setupWord(clusters) {
  // Remove any leftover panel from a previous test
  const existing = document.getElementById('char-panel');
  if (existing) existing.remove();

  window.editorState.lines = [
    { words: [{ clusters, isNavigable: true, hasSoftWarning: false }] },
  ];

  const panel = document.createElement('div');
  panel.id = 'char-panel';
  clusters.forEach((_, i) => {
    const tile = document.createElement('span');
    tile.className = 'char-tile';
    tile.dataset.charIdx = String(i);
    panel.appendChild(tile);
  });
  document.body.appendChild(panel);
  return panel;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  const panel = document.getElementById('char-panel');
  if (panel) panel.remove();
  // Reset editorState to a clean slate
  window.editorState.lines = [];
});

// ---------------------------------------------------------------------------
// Rule 1 — Tanwin on non-final cluster
// ---------------------------------------------------------------------------

describe('checkSoftRulesAfterWrite — Rule 1 (tanwin on non-final cluster)', () => {
  test('T_SR_01 — tanwin on non-final cluster → hasSoftWarning true, tile gets soft-warning-underline', () => {
    // Cluster 0: Ba + tanwin-fatha (non-final).  Cluster 1: Ta (final, bare).
    const panel = setupWord([BA + TANWIN_F, TA]);
    window.checkSoftRulesAfterWrite(0, 0, 0);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(true);

    const tile0 = panel.querySelector('[data-char-idx="0"]');
    expect(tile0.classList.contains('soft-warning-underline')).toBe(true);
  });

  test('T_SR_02 — tanwin on final cluster → no warning', () => {
    // Cluster 0: Ba (bare).  Cluster 1: Ta + tanwin-fatha (final).
    const panel = setupWord([BA, TA + TANWIN_F]);
    window.checkSoftRulesAfterWrite(0, 0, 1);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(false);

    const tile1 = panel.querySelector('[data-char-idx="1"]');
    expect(tile1.classList.contains('soft-warning-underline')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 2 — Group A on mid-position alef (long-vowel role)
// ---------------------------------------------------------------------------

describe('checkSoftRulesAfterWrite — Rule 2 (Group A on mid-position alef)', () => {
  test('T_SR_03 — Group A on mid-position alef → warning on that tile', () => {
    // Ba (idx 0) | Alef+fatha (idx 1, mid-position) | Ta (idx 2)
    const panel = setupWord([BA, ALEF + FATHA, TA]);
    window.checkSoftRulesAfterWrite(0, 0, 1);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(true);

    const tile1 = panel.querySelector('[data-char-idx="1"]');
    expect(tile1.classList.contains('soft-warning-underline')).toBe(true);
  });

  test('T_SR_04 — Group A on initial alef (idx === 0) and word is not ال → no Rule-2 warning', () => {
    // Alef+fatha at idx 0: Rule 2 requires idx > 0, so it cannot fire here.
    // Word is not ال (clusters[1] is Ba, not Lam), so Rule 3 also does not fire.
    const panel = setupWord([ALEF + FATHA, BA, TA]);
    window.checkSoftRulesAfterWrite(0, 0, 0);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(false);

    const tile0 = panel.querySelector('[data-char-idx="0"]');
    expect(tile0.classList.contains('soft-warning-underline')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 3 — Group A on alef of ال (definite article)
// ---------------------------------------------------------------------------

describe('checkSoftRulesAfterWrite — Rule 3 (Group A on alef of ال)', () => {
  test('T_SR_05 — Group A on alef of ال → Rule-3 warning; tooltip mentions "definite article"', () => {
    // ال word: Alef+fatha (idx 0) | Lam (idx 1) | Ba (idx 2)
    const panel = setupWord([ALEF + FATHA, LAM, BA]);
    window.checkSoftRulesAfterWrite(0, 0, 0);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(true);

    const tile0 = panel.querySelector('[data-char-idx="0"]');
    expect(tile0.classList.contains('soft-warning-underline')).toBe(true);

    const tooltip = tile0.querySelector('.char-soft-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent.toLowerCase()).toContain('definite article');
  });
});

// ---------------------------------------------------------------------------
// Rule 4 — Any diacritic on word-final alef maqsura
// ---------------------------------------------------------------------------

describe('checkSoftRulesAfterWrite — Rule 4 (diacritic on final alef maqsura)', () => {
  test('T_SR_06 — any diacritic on word-final alef maqsura → warning on last tile', () => {
    // Ba (idx 0) | AlefMaqsura+fatha (idx 1, final)
    const panel = setupWord([BA, ALEF_MAQSURA + FATHA]);
    window.checkSoftRulesAfterWrite(0, 0, 1);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(true);

    const tile1 = panel.querySelector('[data-char-idx="1"]');
    expect(tile1.classList.contains('soft-warning-underline')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule 5 — ال + tanwin coexistence
// ---------------------------------------------------------------------------

describe('checkSoftRulesAfterWrite — Rule 5 (ال + tanwin coexistence)', () => {
  test('T_SR_07 — ال word + tanwin on final cluster → Rule-5 warning; tooltip mentions "definite article"', () => {
    // Alef (idx 0, bare) | Lam (idx 1, bare) | Ba+tanwin-fatha (idx 2, final)
    // Rule 1 does NOT fire: tanwin is on the final cluster (idx 2 === lastIdx 2).
    // Rule 5 fires because isAL is true and idx 2 has tanwin and no prior warning.
    const panel = setupWord([ALEF, LAM, BA + TANWIN_F]);
    window.checkSoftRulesAfterWrite(0, 0, 2);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(true);

    const tile2 = panel.querySelector('[data-char-idx="2"]');
    expect(tile2.classList.contains('soft-warning-underline')).toBe(true);

    const tooltip = tile2.querySelector('.char-soft-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent.toLowerCase()).toContain('definite article');
  });
});

// ---------------------------------------------------------------------------
// Rule priority — Rule 3 beats Rule 2
// ---------------------------------------------------------------------------

describe('checkSoftRulesAfterWrite — rule priority', () => {
  test('T_SR_08 — Rule 3 fires for alef at idx 0 in ال word; exactly one warning; message is Rule 3', () => {
    // Alef+fatha (idx 0) | Lam (idx 1) | Ba (idx 2)
    // Rule 3 fires on idx 0 (isAL && idx===0 && base===alef && GroupA mark present).
    // Rule 2 requires idx > 0, so it cannot fire on idx 0.
    // Assert: only tile 0 has a warning, and its tooltip is the Rule-3 message.
    const panel = setupWord([ALEF + FATHA, LAM, BA]);
    window.checkSoftRulesAfterWrite(0, 0, 0);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(true);

    const tile0 = panel.querySelector('[data-char-idx="0"]');
    const tile1 = panel.querySelector('[data-char-idx="1"]');
    const tile2 = panel.querySelector('[data-char-idx="2"]');

    // Only idx 0 gets a warning
    expect(tile0.classList.contains('soft-warning-underline')).toBe(true);
    expect(tile1.classList.contains('soft-warning-underline')).toBe(false);
    expect(tile2.classList.contains('soft-warning-underline')).toBe(false);

    // Tooltip message must be Rule 3 (definite article), not Rule 2 (long vowel)
    const tooltip = tile0.querySelector('.char-soft-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent.toLowerCase()).toContain('definite article');
  });
});

// ---------------------------------------------------------------------------
// No marks — no warnings
// ---------------------------------------------------------------------------

describe('checkSoftRulesAfterWrite — no marks on any cluster', () => {
  test('T_SR_09 — bare clusters only → no warnings, hasSoftWarning false', () => {
    const panel = setupWord([BA, TA, ALEF]);
    window.checkSoftRulesAfterWrite(0, 0, 0);

    const word = window.editorState.lines[0].words[0];
    expect(word.hasSoftWarning).toBe(false);

    const tiles = panel.querySelectorAll('.char-tile');
    tiles.forEach(tile => {
      expect(tile.classList.contains('soft-warning-underline')).toBe(false);
      expect(tile.querySelector('.char-soft-tooltip')).toBeNull();
    });
  });
});
