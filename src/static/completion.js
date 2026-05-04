/**
 * completion.js — Arabic Diacritics Editor
 * Phase 5: Completion banner, shortcuts overlay, read-only mode helpers.
 *
 * References: Plan §Tasks 5.1–5.5  |  Spec §12–13, §14
 *
 * Dependencies (must load before this file):
 *   editor-state.js  → window.editorState
 *
 * Exports on window:
 *   window.showCompletionBanner(outputPath)
 *   window.hideCompletionBanner()
 *   window.toggleShortcutsOverlay()
 */

// ---------------------------------------------------------------------------
// Completion banner (spec §12 step 6: "Complete — output saved to _diac_output/")
// ---------------------------------------------------------------------------

/**
 * Show the green completion banner with the output path.
 * Called by the Mark Complete handler in index.html after a successful API call.
 *
 * @param {string} outputPath — relative path returned by /api/mark_complete
 */
window.showCompletionBanner = function showCompletionBanner(outputPath) {
  const banner = document.getElementById("completion-banner");
  const msg = document.getElementById("completion-banner-msg");
  if (!banner || !msg) return;
  msg.textContent = `Complete — output saved to _diac_output/${outputPath}`;
  banner.classList.add("visible");
};

/**
 * Hide the completion banner.
 * Called by the Reset handler and by the dismiss button.
 */
window.hideCompletionBanner = function hideCompletionBanner() {
  const banner = document.getElementById("completion-banner");
  if (banner) banner.classList.remove("visible");
};

// Wire dismiss button once DOM is ready.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("completion-banner-dismiss");
  if (btn) {
    btn.addEventListener("click", window.hideCompletionBanner);
  }
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts overlay (Plan §Task 5.5 — '?' key)
// ---------------------------------------------------------------------------

window.toggleShortcutsOverlay = function toggleShortcutsOverlay() {
  const overlay = document.getElementById("shortcuts-overlay");
  if (!overlay) return;
  overlay.classList.toggle("visible");
};

// '?' key listener — fires regardless of whether a file is open,
// but must not fire when focus is inside an input/textarea.
document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")
    return;

  if (event.key === "?" || event.key === "\u061F") {
    // '?' is Shift+/ on Latin keyboards; U+061F (؟) is its Arabic-layout
    // equivalent on the same physical key. Both toggle the overlay.
    event.preventDefault();
    window.toggleShortcutsOverlay();
  }

  // Escape closes the overlay if it is open.
  if (event.key === "Escape") {
    const overlay = document.getElementById("shortcuts-overlay");
    if (overlay && overlay.classList.contains("visible")) {
      event.preventDefault();
      overlay.classList.remove("visible");
    }
  }
});
