/**
 * vitest.setup.js
 *
 * Replicates the index.html <script> load order so that every window.*
 * global is available before any test runs.
 *
 * Authoritative load order (index.html lines 1118–1134):
 *   api.js → editor-state.js → renderer.js → navigation.js →
 *   diacritic-engine.js → character-mode.js →
 *   visual-hints.js → soft-rules.js → completion.js
 *
 * ⚠  RULES.md §2 lists editor-state.js before api.js — that is incorrect.
 *    index.html is the authoritative source; api.js loads first.
 *    See Session 36 Handover for the discrepancy note.
 *
 * CDN scripts (Tailwind) are skipped — UI-only, unavailable in jsdom.
 * The DOMContentLoaded inline init script in index.html is also skipped;
 * window.KEYMAP is provided manually below (the only symbol it contributes
 * that production JS references at runtime).
 *
 * See TESTING_PHASED_PLAN.md §Task 2.1.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/**
 * Simulate a <script src="..."> tag.
 *
 * Reads the file, wraps it in a Function whose only parameter is named
 * 'window', and calls it with globalThis.  Inside the loaded file:
 *   • window.X = Y  → globalThis.X = Y  (exported to all tests)
 *   • document, API, …  → resolved as free globals → globalThis.document etc.
 *
 * This mirrors the browser behaviour where every script tag shares the
 * same global scope and can reference symbols set by earlier tags.
 *
 * @param {string} rel - path relative to this file (i.e. relative to src/)
 */
function load(rel) {
  const src = readFileSync(resolve(__dirname, rel), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', src)(globalThis);
}

// ---------------------------------------------------------------------------
// Global bootstrap
// ---------------------------------------------------------------------------

// Ensure window === globalThis (true in jsdom; this is a defensive no-op there).
// Some loaded files reference `window.X` and others reference bare globals;
// both resolve to the same object with this assignment.
globalThis.window = globalThis;

// window.KEYMAP is populated by the inline DOMContentLoaded script in
// index.html (which we skip).  Provide an empty bindings object so the
// navigation.js keydown handler's  `window.KEYMAP[event.code]`  check
// is falsy rather than throwing on undefined.
globalThis.KEYMAP = {};

// ---------------------------------------------------------------------------
// Load all modules in index.html <script> order
// ---------------------------------------------------------------------------
load('static/api.js');
load('static/editor-state.js');
load('static/renderer.js');
load('static/navigation.js');
load('static/diacritic-engine.js');
load('static/character-mode.js');
load('static/visual-hints.js');
load('static/soft-rules.js');
load('static/completion.js');
