/**
 * soft-rules.js — Arabic Diacritics Editor
 * Phase 4: Soft validation rules — amber wavy underline + tooltip on char tiles.
 *
 * References: Plan §Task 4.4  |  Spec §8.3
 *
 * Soft rules fire when the char panel renders and do NOT block the edit.
 * Warnings are ephemeral (locked decision OQ4): recomputed from current cluster
 * state each time the panel renders, never stored in the cursor sidecar.
 *
 * Dependencies (must load before this file):
 *   diacritic-engine.js → window.parseCluster
 *   character-mode.js   → DOM: #char-panel, .char-tile[data-char-idx]
 *
 * Exports on window:
 *   window.checkSoftRulesAfterWrite(lineIdx, wordIdx, charIdx)
 *       Run by _renderCharPanel() at the end of every panel render.
 *   window.clearSoftWarnings()
 *       Utility to strip all soft warning markup without a full panel re-render.
 */

'use strict';

// ---------------------------------------------------------------------------
// Codepoints and sets
// ---------------------------------------------------------------------------

const _SR_ALEF         = '\u0627'; // ا  Alef
const _SR_ALEF_MAQSURA = '\u0649'; // ى  Alef maqsura
const _SR_LAM          = '\u0644'; // ل  Lam  (for ال detection)

/** Tanwin marks (Fathatan / Dammatan / Kasratan) */
const _SR_TANWIN = new Set(['\u064B', '\u064C', '\u064D']);

/** Group A vowel marks + sukun */
const _SR_GROUP_A = new Set([
    '\u064B', '\u064C', '\u064D', // tanwin
    '\u064E',                      // Fatha
    '\u064F',                      // Damma
    '\u0650',                      // Kasra
    '\u0652',                      // Sukun
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** True when the word's first two clusters are Alef + Lam (i.e., word starts with ال). */
function _startsWithAL(clusters) {
    if (clusters.length < 2) return false;
    return (
        window.parseCluster(clusters[0]).base === _SR_ALEF &&
        window.parseCluster(clusters[1]).base === _SR_LAM
    );
}

/** True when the mark set contains any Group A vowel. */
function _hasGroupA(marks) {
    for (const m of marks) {
        if (_SR_GROUP_A.has(m)) return true;
    }
    return false;
}

/** True when the mark set contains any tanwin mark. */
function _hasTanwin(marks) {
    for (const m of marks) {
        if (_SR_TANWIN.has(m)) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Core: evaluate all 5 soft rules for the word's current cluster array
// ---------------------------------------------------------------------------

/**
 * Run all soft rules against the current in-memory state of `clusters`.
 *
 * Returns a Map<charIdx, warningText>.  Only the first triggered rule per
 * cluster is recorded (rules are listed in spec priority order).
 *
 * Rules (spec §8.3):
 *   1. Tanwin on non-final character
 *   2. Group A diacritic on mid-position alef (long-vowel role)
 *   3. Group A diacritic on alef of ال (definite article)
 *   4. Any diacritic on word-final alef maqsura
 *   5. ال + tanwin coexistence (word-level, applied to tanwin-bearing clusters)
 *
 * @param {string[]} clusters
 * @returns {Map<number, string>}
 */
function _runSoftRules(clusters) {
    const warnings = new Map();
    const lastIdx  = clusters.length - 1;
    const isAL     = _startsWithAL(clusters);

    // --- Per-cluster rules (1–4) ---
    clusters.forEach((cluster, idx) => {
        const { base, marks } = window.parseCluster(cluster);
        if (marks.size === 0) return; // bare cluster — no rules can fire

        // Rule 1: Tanwin on non-final character
        if (_hasTanwin(marks) && idx < lastIdx) {
            warnings.set(idx, 'Tanwin usually appears at the last letter of a word');
            return;
        }

        // Rule 3: Group A on alef of ال (takes priority over rule 2)
        if (isAL && idx === 0 && base === _SR_ALEF && _hasGroupA(marks)) {
            warnings.set(idx, 'The alef of ال (definite article) conventionally takes no vowel mark');
            return;
        }

        // Rule 2: Group A on a mid-position alef (long-vowel role)
        // "mid-position" = idx > 0 AND not the last cluster
        if (base === _SR_ALEF && idx > 0 && idx < lastIdx && _hasGroupA(marks)) {
            warnings.set(idx, 'Mid-word alef is typically a long vowel — vowel marks are unusual here');
            return;
        }

        // Rule 4: Any diacritic on word-final alef maqsura
        if (base === _SR_ALEF_MAQSURA && idx === lastIdx) {
            warnings.set(idx, 'Final alef maqsura is typically left bare in classical prose');
            return;
        }
    });

    // --- Rule 5: ال + tanwin coexistence (word-level) ---
    if (isAL) {
        clusters.forEach((cluster, idx) => {
            const { marks } = window.parseCluster(cluster);
            if (_hasTanwin(marks) && !warnings.has(idx)) {
                warnings.set(idx, 'Tanwin and ال (definite article) cannot coexist on the same word');
            }
        });
    }

    return warnings;
}

// ---------------------------------------------------------------------------
// DOM: apply warnings to the char panel tiles
// ---------------------------------------------------------------------------

/**
 * Stamp soft-warning markup onto the panel tiles.
 *
 * For each charIdx in `warnings`:
 *   - Adds class .soft-warning-underline (amber wavy underline — CSS pre-defined)
 *   - Appends a <span class="char-soft-tooltip"> with the warning text
 *
 * For tiles NOT in `warnings`, any previous warning markup is stripped.
 *
 * @param {Map<number, string>} warnings — charIdx → warning message
 */
function _applyWarningsToPanel(warnings) {
    const panel = document.getElementById('char-panel');
    if (!panel) return;

    panel.querySelectorAll('.char-tile').forEach(tile => {
        const idx = parseInt(tile.dataset.charIdx, 10);

        // Always reset previous state first
        tile.classList.remove('soft-warning-underline');
        const prev = tile.querySelector('.char-soft-tooltip');
        if (prev) prev.remove();

        if (warnings.has(idx)) {
            tile.classList.add('soft-warning-underline');

            const tooltip = document.createElement('span');
            tooltip.className = 'char-soft-tooltip';
            tooltip.textContent = warnings.get(idx);
            tile.appendChild(tooltip);
        }
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate soft rules for the word at (lineIdx, wordIdx) and stamp the
 * char panel tiles with amber underlines and tooltips.
 *
 * Called at the end of every _renderCharPanel() invocation so that warnings
 * always reflect the current cluster state — both after writes and after
 * navigating between clusters.
 *
 * @param {number} lineIdx
 * @param {number} wordIdx
 * @param {number} charIdx  — the active cluster index (supplied for future use;
 *                            rules currently evaluate all clusters in the word)
 */
window.checkSoftRulesAfterWrite = function checkSoftRulesAfterWrite(lineIdx, wordIdx, charIdx) {
    const state = window.editorState;
    const word  = state.lines[lineIdx]?.words[wordIdx];
    if (!word) return;

    const warnings = _runSoftRules(word.clusters);
    _applyWarningsToPanel(warnings);

    // Persist the flag on the word object so Phase 5 / status bar can read it
    word.hasSoftWarning = warnings.size > 0;
};

/**
 * Remove all soft warning classes and tooltips from the char panel without
 * triggering a full panel re-render.  Called when exiting character mode.
 */
window.clearSoftWarnings = function clearSoftWarnings() {
    _applyWarningsToPanel(new Map());
};