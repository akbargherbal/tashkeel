/**
 * completion.test.js
 * Task 2.7 — Tests for window.toggleShortcutsOverlay and the document keydown
 * listener registered in completion.js (§3.10 '?' / '؟' union condition).
 *
 * The keydown listener is registered once at module load time (during
 * vitest.setup.js).  All five tests share that single listener instance.
 * Each test creates a fresh #shortcuts-overlay element in beforeEach and
 * removes it in afterEach to avoid cross-test state leakage.
 *
 * See TESTING_PHASED_PLAN.md Task 2.7.
 * See RULES.md §3.10 — '?' key Escape scope.
 */

describe('completion.js — shortcuts overlay', () => {

  let overlay;

  beforeEach(() => {
    overlay = document.createElement('div');
    overlay.id = 'shortcuts-overlay';
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    // Remove overlay so the next test starts from a clean DOM.
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  });

  // -----------------------------------------------------------------------
  // toggleShortcutsOverlay direct calls
  // -----------------------------------------------------------------------

  test('T_CMP_01 — toggleShortcutsOverlay adds "visible" class when overlay is hidden', () => {
    expect(overlay.classList.contains('visible')).toBe(false);
    window.toggleShortcutsOverlay();
    expect(overlay.classList.contains('visible')).toBe(true);
  });

  test('T_CMP_02 — toggleShortcutsOverlay called twice removes "visible" (toggle semantics)', () => {
    window.toggleShortcutsOverlay(); // → visible
    window.toggleShortcutsOverlay(); // → hidden
    expect(overlay.classList.contains('visible')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // keydown listener — '?' / '؟' key (§3.10 union condition)
  // -----------------------------------------------------------------------

  test('T_CMP_03 — Latin "?" keydown toggles the overlay (§3.10)', () => {
    expect(overlay.classList.contains('visible')).toBe(false);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true })
    );
    expect(overlay.classList.contains('visible')).toBe(true);
  });

  test('T_CMP_04 — Arabic "؟" (U+061F) keydown toggles the overlay (§3.10)', () => {
    // U+061F is the Arabic question mark, typed with Shift+/ on an Arabic
    // keyboard layout. The handler must catch it with the union condition
    // (event.key === '?' || event.key === '\u061F') — not an event.code check.
    expect(overlay.classList.contains('visible')).toBe(false);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '\u061F', bubbles: true, cancelable: true })
    );
    expect(overlay.classList.contains('visible')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Escape key — closes overlay only when visible (§3.10 Escape scope)
  // -----------------------------------------------------------------------

  test('T_CMP_05 — Escape keydown when overlay is visible closes the overlay', () => {
    // Pre-condition: overlay is open.
    overlay.classList.add('visible');
    expect(overlay.classList.contains('visible')).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );

    // The completion.js Escape handler removes 'visible' only when the overlay
    // is open.  Character Mode Escape (navigation.js) is not triggered here
    // because editorState.mode is 'word' by default.
    expect(overlay.classList.contains('visible')).toBe(false);
  });

});
