/**
 * diacritic-engine.test.js
 *
 * Tier 2 JavaScript unit tests for the pure-logic functions exported by
 * diacritic-engine.js.  All functions under test are stateless — they accept
 * string inputs and return new strings or booleans.  No DOM setup or
 * editorState mutation is required.
 *
 * Functions tested (27 tests total):
 *   parseCluster         T_JS_01 – T_JS_03   (3 tests)
 *   classifyMark         T_JS_04 – T_JS_07   (4 tests)
 *   hardRulesCheck       T_JS_08 – T_JS_14   (7 tests)
 *   applyDiacritic       T_JS_15 – T_JS_19   (5 tests)
 *   clearDiacritics      T_JS_20 – T_JS_21   (2 tests)
 *   isClusterComplete    T_JS_22 – T_JS_27   (6 tests)
 *
 * All window.* globals are loaded by vitest.setup.js before this file runs.
 *
 * Unicode quick reference used in these tests:
 *   U+0628  ب  Ba
 *   U+0627  ا  Alef
 *   U+064B  ً  Tanween Fatha (Group A)
 *   U+064E  َ  Fatha         (Group A)
 *   U+064F  ُ  Damma         (Group A)
 *   U+0650  ِ  Kasra         (Group A)
 *   U+0651  ّ  Shadda        (Group B)
 *   U+0652  ْ  Sukun         (Group A)
 *   U+0654  ٔ  Hamza Above   (Group C)
 *
 * See TESTING_PHASED_PLAN.md §Task 2.2.
 */

// ---------------------------------------------------------------------------
// parseCluster
// ---------------------------------------------------------------------------

describe('parseCluster', () => {
  test('T_JS_01 — bare letter returns base with empty marks set', () => {
    const result = window.parseCluster('\u0628'); // ب
    expect(result.base).toBe('\u0628');
    expect(result.marks).toBeInstanceOf(Set);
    expect(result.marks.size).toBe(0);
  });

  test('T_JS_02 — letter + fatha: base correct, marks contains fatha', () => {
    const result = window.parseCluster('\u0628\u064E'); // بَ
    expect(result.base).toBe('\u0628');
    expect(result.marks.has('\u064E')).toBe(true);
    expect(result.marks.size).toBe(1);
  });

  test('T_JS_03 — letter + shadda + fatha: marks contains both combining marks', () => {
    const result = window.parseCluster('\u0628\u0651\u064E'); // بّ + fatha
    expect(result.base).toBe('\u0628');
    expect(result.marks.has('\u0651')).toBe(true); // shadda
    expect(result.marks.has('\u064E')).toBe(true); // fatha
    expect(result.marks.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// classifyMark
// ---------------------------------------------------------------------------

describe('classifyMark', () => {
  test('T_JS_04 — fatha (U+064E) → Group A', () => {
    expect(window.classifyMark('\u064E')).toBe('A');
  });

  test('T_JS_05 — shadda (U+0651) → Group B', () => {
    expect(window.classifyMark('\u0651')).toBe('B');
  });

  test('T_JS_06 — hamza above (U+0654) → Group C', () => {
    expect(window.classifyMark('\u0654')).toBe('C');
  });

  test('T_JS_07 — unknown codepoint → null', () => {
    expect(window.classifyMark('x')).toBeNull();
    expect(window.classifyMark('A')).toBeNull();
    expect(window.classifyMark('\u0020')).toBeNull(); // space
  });
});

// ---------------------------------------------------------------------------
// hardRulesCheck
// ---------------------------------------------------------------------------

describe('hardRulesCheck', () => {
  test('T_JS_08 — sukun + add shadda blocked (Rule 1: sukun+shadda coexistence)', () => {
    // بْ = ba + sukun; try to add shadda
    const cluster = '\u0628\u0652';
    const result = window.hardRulesCheck(cluster, '\u0651');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/sukun/i);
  });

  test('T_JS_09 — shadda + add sukun blocked (Rule 1: reverse direction)', () => {
    // بّ = ba + shadda; try to add sukun
    const cluster = '\u0628\u0651';
    const result = window.hardRulesCheck(cluster, '\u0652');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/sukun/i);
  });

  test('T_JS_10 — Group C mark on non-carrier (ب) blocked (Rule 2)', () => {
    // Ba is not in GROUP_C_CARRIERS (only alef, waw, ya are)
    const cluster = '\u0628'; // bare ba
    const result = window.hardRulesCheck(cluster, '\u0654'); // hamza above
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/alef|waw|ya/i);
  });

  test('T_JS_11 — Group C mark on alef (valid carrier) allowed (Rule 2 passes)', () => {
    // Alef IS a valid carrier for Group C
    const cluster = '\u0627'; // bare alef
    const result = window.hardRulesCheck(cluster, '\u0654'); // hamza above
    expect(result.allowed).toBe(true);
  });

  test('T_JS_12 — 3 marks + Group A replace stays at 3 marks, allowed (Rule 3)', () => {
    // alef + hamzaAbove(C) + shadda(B) + fatha(A) = 3 combining marks
    // Adding kasra (Group A) replaces fatha → projected size = 3 → allowed
    const cluster = '\u0627\u0654\u0651\u064E';
    const result = window.hardRulesCheck(cluster, '\u0650'); // kasra
    expect(result.allowed).toBe(true);
  });

  test('T_JS_13 — 3 marks + Group B (add, no removal) would reach 4, blocked (Rule 3)', () => {
    // alef + hamzaAbove(C) + tanweenFatha(A) + fatha(A) = 3 marks (direct construction)
    // Adding shadda (Group B) is a plain add → projected size = 4 → blocked
    // Note: this cluster is not reachable via applyDiacritic (two Group A marks
    // cannot coexist normally); it is constructed directly to isolate Rule 3.
    const cluster = '\u0627\u0654\u064B\u064E';
    const result = window.hardRulesCheck(cluster, '\u0651'); // shadda
    expect(result.allowed).toBe(false);
  });

  test('T_JS_14 — toggle-off (mark already present) is always allowed regardless of other rules', () => {
    // بَ = ba + fatha; attempting to add fatha again → toggle-off path → allowed
    const cluster = '\u0628\u064E';
    const result = window.hardRulesCheck(cluster, '\u064E'); // fatha already present
    expect(result.allowed).toBe(true);
    // Confirm the toggle-off fast-path fires even when other rules could block:
    // sukun cluster, re-applying sukun → toggle-off, not Rule 1
    const clusterWithSukun = '\u0628\u0652';
    const resultSukun = window.hardRulesCheck(clusterWithSukun, '\u0652');
    expect(resultSukun.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyDiacritic
// ---------------------------------------------------------------------------

describe('applyDiacritic', () => {
  test('T_JS_15 — add fatha to bare letter produces letter+fatha', () => {
    const result = window.applyDiacritic('\u0628', '\u064E'); // ba → ba+fatha
    expect(result).toBe('\u0628\u064E');
  });

  test('T_JS_16 — Group A replace: kasra removed, fatha inserted', () => {
    // بِ = ba + kasra; apply fatha (Group A) → replaces kasra
    const result = window.applyDiacritic('\u0628\u0650', '\u064E');
    expect(result).toBe('\u0628\u064E'); // only fatha remains
  });

  test('T_JS_17 — toggle-off: applying same mark twice removes it', () => {
    // بَ + fatha again → toggle-off → bare ba
    const result = window.applyDiacritic('\u0628\u064E', '\u064E');
    expect(result).toBe('\u0628');
  });

  test('T_JS_18 — hard-blocked combination returns null (no write)', () => {
    // بْ (ba+sukun) + shadda → Rule 1 → null
    const result = window.applyDiacritic('\u0628\u0652', '\u0651');
    expect(result).toBeNull();
  });

  test('T_JS_19 — stack shadda onto letter+fatha: canonical C→B→A order in output', () => {
    // بَ (ba+fatha) + shadda → shadda stacks (Group B, no removal)
    // canonicalCluster produces: ba + shadda(B) + fatha(A)
    const result = window.applyDiacritic('\u0628\u064E', '\u0651');
    expect(result).toBe('\u0628\u0651\u064E'); // B before A in canonical order
  });
});

// ---------------------------------------------------------------------------
// clearDiacritics
// ---------------------------------------------------------------------------

describe('clearDiacritics', () => {
  test('T_JS_20 — cluster with marks returns bare base letter only', () => {
    expect(window.clearDiacritics('\u0628\u064E')).toBe('\u0628'); // ba+fatha → ba
    expect(window.clearDiacritics('\u0628\u0651\u064E')).toBe('\u0628'); // ba+shadda+fatha → ba
  });

  test('T_JS_21 — bare letter returns same letter (idempotent)', () => {
    expect(window.clearDiacritics('\u0628')).toBe('\u0628');
  });
});

// ---------------------------------------------------------------------------
// isClusterComplete
// ---------------------------------------------------------------------------

describe('isClusterComplete', () => {
  test('T_JS_22 — bare letter (no marks) → not complete', () => {
    expect(window.isClusterComplete('\u0628')).toBe(false);
  });

  test('T_JS_23 — shadda only (Group B, no Group A) → not complete', () => {
    expect(window.isClusterComplete('\u0628\u0651')).toBe(false);
  });

  test('T_JS_24 — fatha only (Group A) → complete', () => {
    expect(window.isClusterComplete('\u0628\u064E')).toBe(true);
  });

  test('T_JS_25 — shadda + fatha (Group B + Group A) → complete', () => {
    // shadda alone is not enough, but shadda + fatha contains Group A
    expect(window.isClusterComplete('\u0628\u0651\u064E')).toBe(true);
  });

  test('T_JS_26 — sukun (Group A) → complete', () => {
    expect(window.isClusterComplete('\u0628\u0652')).toBe(true);
  });

  test('T_JS_27 — tanween fatha (Group A) → complete', () => {
    expect(window.isClusterComplete('\u0628\u064B')).toBe(true);
  });
});
