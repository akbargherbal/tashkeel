/**
 * smoke.test.js — TEMPORARY
 *
 * Verify that vitest.setup.js loaded all window.* globals without error.
 * Run once:  npm test smoke.test.js
 * Then DELETE this file before proceeding to Task 2.2.
 *
 * See TESTING_PHASED_PLAN.md §Task 2.1 verification steps.
 */

test('window.parseCluster is a function', () => {
  expect(typeof window.parseCluster).toBe('function');
});

test('window.applyDiacritic is a function', () => {
  expect(typeof window.applyDiacritic).toBe('function');
});

test('window.clearDiacritics is a function', () => {
  expect(typeof window.clearDiacritics).toBe('function');
});

test('window.isClusterComplete is a function', () => {
  expect(typeof window.isClusterComplete).toBe('function');
});

test('window.hardRulesCheck is a function', () => {
  expect(typeof window.hardRulesCheck).toBe('function');
});

test('window.classifyMark is a function', () => {
  expect(typeof window.classifyMark).toBe('function');
});

test('window.canonicalCluster is a function', () => {
  expect(typeof window.canonicalCluster).toBe('function');
});

test('window.editorState is an object with the correct schema fields', () => {
  const s = window.editorState;
  expect(typeof s).toBe('object');
  expect(s).toHaveProperty('filePath');
  expect(s).toHaveProperty('status');
  expect(s).toHaveProperty('mode');
  expect(s).toHaveProperty('lineIdx');
  expect(s).toHaveProperty('wordIdx');
  expect(s).toHaveProperty('charIdx');
  expect(s).toHaveProperty('lines');
  expect(s).toHaveProperty('totalUndiacCount');
  expect(s).toHaveProperty('lastSaveTime');
});

test('window._tabJumpToNextUndiac is a function', () => {
  expect(typeof window._tabJumpToNextUndiac).toBe('function');
});

test('window.segmentWord is a function', () => {
  expect(typeof window.segmentWord).toBe('function');
});

test('window.clampCursorToNavigable is a function', () => {
  expect(typeof window.clampCursorToNavigable).toBe('function');
});

test('window.checkSoftRulesAfterWrite is a function', () => {
  expect(typeof window.checkSoftRulesAfterWrite).toBe('function');
});

test('window.classifyAllWords is a function', () => {
  expect(typeof window.classifyAllWords).toBe('function');
});

test('window.reclassifyWord is a function', () => {
  expect(typeof window.reclassifyWord).toBe('function');
});

test('window.toggleShortcutsOverlay is a function', () => {
  expect(typeof window.toggleShortcutsOverlay).toBe('function');
});
