/**
 * visual-hints.js — Arabic Diacritics Editor
 * Phase 4: Letter-level amber colouring, word-level undiac indicator,
 * live undiacritized count.
 *
 * References: Plan §Tasks 4.1–4.3  |  Spec §6, §8.4
 *
 * Dependencies (must load before this file):
 *   editor-state.js     → window.editorState
 *   renderer.js         → window.updateStatusBar
 *   diacritic-engine.js → window.parseCluster
 *
 * Exports on window:
 *   window.classifyAllWords()            — call on file open, after renderDocument()
 *   window.reclassifyWord(li, wi)        — call after every diacritic write or clear
 *
 * DOM contract:
 *   renderer.js and character-mode.js must wrap every grapheme cluster inside a
 *   word span as:
 *     <span class="letter-cluster [punct]" data-char-idx="N">…</span>
 *   This file adds/removes .amber-candidate and .word-has-undiac based on that.
 */

'use strict';

// ---------------------------------------------------------------------------
// Codepoints used for exempt classification (spec §8.4)
// ---------------------------------------------------------------------------

/** Arabic Unicode block boundary check */
const _AR_MIN = 0x0621;
const _AR_MAX = 0x06FF;

const _CP_ALEF         = '\u0627'; // ا  Alef
const _CP_WAW          = '\u0648'; // و  Waw
const _CP_YA           = '\u064A'; // ي  Ya
const _CP_ALEF_MAQSURA = '\u0649'; // ى  Alef maqsura
const _CP_DAMMA        = '\u064F'; // ُ  Damma
const _CP_KASRA        = '\u0650'; // ِ  Kasra

// ---------------------------------------------------------------------------
// Core classification
// ---------------------------------------------------------------------------

/**
 * Decide whether the cluster at `idx` in `clusters[]` is an amber candidate.
 *
 * Amber = no combining marks AND not in the canonical-exempt list (spec §8.4).
 *
 * Exempt rules:
 *   • Alef (ا) at idx > 0              — non-initial alef is a long vowel
 *   • Alef maqsura (ى) at final idx    — typically bare in classical prose
 *   • Waw (و) when preceding cluster
 *     carries Damma                    — long-vowel role
 *   • Ya  (ي) when preceding cluster
 *     carries Kasra                    — long-vowel role
 *
 * Pragmatic fallback (spec §8.4 note):
 *   If the preceding cluster is undiacritized, waw/ya context cannot be
 *   evaluated → they default to amber.
 *
 * @param {string[]} clusters  — grapheme cluster array for the word
 * @param {number}   idx       — 0-based cluster index to evaluate
 * @returns {boolean}
 */
function _isAmberCandidate(clusters, idx) {
    const cluster = clusters[idx];
    const { base, marks } = window.parseCluster(cluster);

    // Already has at least one combining mark → diacritized → not amber
    if (marks.size > 0) return false;

    // Only classify Arabic letters (skip digits, Latin, punctuation, etc.)
    const cp = base.codePointAt(0);
    if (cp < _AR_MIN || cp > _AR_MAX) return false;

    // --- Canonical-exempt checks (spec §8.4) ---

    // Alef maqsura in final position
    if (base === _CP_ALEF_MAQSURA && idx === clusters.length - 1) return false;

    // Alef in non-initial position (mid/end role = long vowel)
    if (base === _CP_ALEF && idx > 0) return false;

    // Waw: preceding letter carries Damma → waw is a long vowel
    if (base === _CP_WAW && idx > 0) {
        const prev = window.parseCluster(clusters[idx - 1]);
        if (prev.marks.has(_CP_DAMMA)) return false;
        // Preceding undiacritized → cannot evaluate → amber (spec §8.4 pragmatic note)
    }

    // Ya: preceding letter carries Kasra → ya is a long vowel
    if (base === _CP_YA && idx > 0) {
        const prev = window.parseCluster(clusters[idx - 1]);
        if (prev.marks.has(_CP_KASRA)) return false;
    }

    return true;
}

// ---------------------------------------------------------------------------
// Internal: classify one word, updating the DOM and word.undiacCount
// ---------------------------------------------------------------------------

/**
 * Classify all clusters in the word at (lineIdx, wordIdx).
 *
 * For each cluster span found via `.letter-cluster[data-char-idx]`:
 *   - Adds `.amber-candidate` if the cluster is an undiacritized candidate.
 *   - Removes `.amber-candidate` otherwise.
 * Toggles `.word-has-undiac` on the word span based on the new count.
 * Writes the new count back to `word.undiacCount`.
 *
 * @param {number} lineIdx
 * @param {number} wordIdx
 */
function _classifyWord(lineIdx, wordIdx) {
    const state = window.editorState;
    const line  = state.lines[lineIdx];
    if (!line) return;

    const word = line.words[wordIdx];
    if (!word || !word.isNavigable) return;

    const clusters = word.clusters;
    const wordEl   = document.getElementById(`word-${lineIdx}-${wordIdx}`);
    if (!wordEl) return;

    // All cluster spans in DOM order — matches clusters[] order
    const clSpans = wordEl.querySelectorAll('.letter-cluster');

    let undiacCount = 0;

    clusters.forEach((cluster, idx) => {
        const span = clSpans[idx];
        if (!span) return;

        // Punctuation clusters are never amber
        if (span.classList.contains('punct')) return;

        const isAmber = _isAmberCandidate(clusters, idx);
        span.classList.toggle('amber-candidate', isAmber);
        if (isAmber) undiacCount++;
    });

    word.undiacCount = undiacCount;

    // Word-level indicator: CSS ::after dot is driven by this class
    wordEl.classList.toggle('word-has-undiac', undiacCount > 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify every word in the open document for amber highlighting.
 *
 * Call once after renderDocument() on file open (and on re-open).
 * Populates word.undiacCount for all words, sums into totalUndiacCount,
 * and refreshes the status bar.
 */
window.classifyAllWords = function classifyAllWords() {
    const state = window.editorState;
    let total   = 0;

    state.lines.forEach((line, li) => {
        line.words.forEach((word, wi) => {
            if (!word.isNavigable) {
                word.undiacCount = 0;
                return;
            }
            _classifyWord(li, wi);
            total += word.undiacCount;
        });
    });

    state.totalUndiacCount = total;

    if (typeof window.updateStatusBar === 'function') {
        window.updateStatusBar();
    }
};

/**
 * Re-classify a single word after a diacritic write or clear.
 *
 * Computes the delta vs the previous undiacCount and adjusts
 * totalUndiacCount accordingly — no full document rescan.
 *
 * @param {number} lineIdx
 * @param {number} wordIdx
 */
window.reclassifyWord = function reclassifyWord(lineIdx, wordIdx) {
    const state = window.editorState;
    const word  = state.lines[lineIdx]?.words[wordIdx];
    if (!word || !word.isNavigable) return;

    const oldCount = word.undiacCount;
    _classifyWord(lineIdx, wordIdx);
    const delta = word.undiacCount - oldCount;

    if (delta !== 0) {
        state.totalUndiacCount = Math.max(0, state.totalUndiacCount + delta);
        if (typeof window.updateStatusBar === 'function') {
            window.updateStatusBar();
        }
    }
};