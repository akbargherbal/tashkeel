/**
 * diacritic-engine.js — Arabic Diacritics Editor
 * Phase 3: Hard rules, canonical ordering, replace/toggle/clear logic.
 *
 * References: Plan §Task 3.3  |  Spec §8.2, §9, §10
 *
 * Exports (all on window):
 *   window.parseCluster(cluster)           → { base, marks }
 *   window.classifyMark(cp)                → 'A' | 'B' | 'C' | null
 *   window.canonicalCluster(base, marks)   → cluster string (C → B → A order)
 *   window.hardRulesCheck(cluster, cp)     → { allowed, reason }
 *   window.applyDiacritic(cluster, cp)     → new cluster string | null (blocked)
 *   window.clearDiacritics(cluster)        → bare base character string
 *   window.flashBlockedTile()              → brief visual rejection flash
 *
 * Unicode normalization policy (spec §10.1):
 *   No NFC/NFD/NFKC/NFKD normalization is applied here.
 *   Files are read as raw bytes; we only re-serialize the MUTATED cluster in
 *   canonical order.  All other clusters on the line are written back verbatim.
 */

// ---------------------------------------------------------------------------
// Diacritic group sets  (hardcoded membership — spec §8.2; never computed)
// ---------------------------------------------------------------------------

/** Group A — vowels and sukun */
const GROUP_A = new Set([
    '\u064B', // Fathatan   (tanwin fath)
    '\u064C', // Dammatan   (tanwin damm)
    '\u064D', // Kasratan   (tanwin kasr)
    '\u064E', // Fatha
    '\u064F', // Damma
    '\u0650', // Kasra
    '\u0652', // Sukun
    '\u0670', // Superscript Alef (long-vowel marker)
]);

/** Group B — Shadda */
const GROUP_B = new Set([
    '\u0651', // Shadda
]);

/** Group C — hamza/maddah combining marks */
const GROUP_C = new Set([
    '\u0653', // Maddah Above
    '\u0654', // Hamza Above
    '\u0655', // Hamza Below
]);

/**
 * Carrier letters on which Group C marks are valid (spec §8.2).
 * Only alef, waw, and ya are permitted carriers in v1.
 */
const GROUP_C_CARRIERS = new Set([
    '\u0627', // Alef  ا
    '\u0648', // Waw   و
    '\u064A', // Ya    ي
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Classify a single combining mark code point into its group.
 * Returns 'A', 'B', 'C', or null if the code point is not a known mark.
 */
window.classifyMark = function classifyMark(cp) {
    if (GROUP_A.has(cp)) return 'A';
    if (GROUP_B.has(cp)) return 'B';
    if (GROUP_C.has(cp)) return 'C';
    return null;
};

/**
 * Parse a grapheme cluster string into its base letter and combining marks.
 *
 * Returns { base: string, marks: Set<string> }
 * where `base` is the first code point and `marks` contains the rest.
 *
 * Uses [...cluster] (spread) to correctly handle surrogate pairs in the
 * base letter (e.g., rare supplementary Arabic characters).
 */
window.parseCluster = function parseCluster(cluster) {
    const codepoints = [...cluster];
    return {
        base:  codepoints[0],
        marks: new Set(codepoints.slice(1)),
    };
};

/**
 * Rebuild a grapheme cluster from a base letter and a set of combining marks
 * in the app's canonical editorial order: Group C → Group B → Group A.
 *
 * This order is our editorial policy (Plan §Task 1.4) — it is NOT the same as
 * Unicode CCC canonical order.  Only MUTATED clusters are serialised this way;
 * untouched clusters are written back verbatim.
 *
 * @param {string}      base   — single base letter
 * @param {Set<string>} marks  — combining mark code points (any order)
 * @returns {string}           — cluster in C → B → A order
 */
window.canonicalCluster = function canonicalCluster(base, marks) {
    const c = [...marks].filter(m => GROUP_C.has(m));
    const b = [...marks].filter(m => GROUP_B.has(m));
    const a = [...marks].filter(m => GROUP_A.has(m));
    // Within each group there should be at most one mark in normal Arabic usage,
    // but we concatenate all members in case of future extension.
    return base + c.join('') + b.join('') + a.join('');
};

// ---------------------------------------------------------------------------
// Hard rules (spec §8.2) — all checks run BEFORE any mutation
// ---------------------------------------------------------------------------

/**
 * Check hard rules for applying `incoming` to `cluster`.
 *
 * Hard rules (silent rejection — no write, brief flash):
 *   1. Sukun + Shadda coexistence — blocked in either direction.
 *   2. Group C mark on a non-carrier letter (not alef/waw/ya).
 *   3. Total combining marks after the operation would exceed 3.
 *
 * NOT a hard block (handled elsewhere):
 *   - Different Group A already present → Replace mode, not a block.
 *   - Incoming already present → Toggle-off, not a block.
 *
 * @param {string} cluster  — current grapheme cluster
 * @param {string} incoming — incoming diacritic code point
 * @returns {{ allowed: boolean, reason: string }}
 */
window.hardRulesCheck = function hardRulesCheck(cluster, incoming) {
    const { base, marks } = window.parseCluster(cluster);

    // Toggle-off is always allowed — remove it from consideration immediately.
    if (marks.has(incoming)) {
        return { allowed: true, reason: '' };
    }

    const incomingGroup = window.classifyMark(incoming);

    // Rule 1: Sukun (U+0652) and Shadda (U+0651) may not coexist.
    if (incoming === '\u0651' && marks.has('\u0652')) {
        return { allowed: false, reason: 'Sukun + Shadda conflict' };
    }
    if (incoming === '\u0652' && marks.has('\u0651')) {
        return { allowed: false, reason: 'Sukun + Shadda conflict' };
    }

    // Rule 2: Group C marks are only valid on alef, waw, ya.
    if (incomingGroup === 'C' && !GROUP_C_CARRIERS.has(base)) {
        return { allowed: false, reason: 'Group C mark only valid on alef, waw, or ya' };
    }

    // Rule 3: Maximum 3 combining marks total.
    // For Group A, the operation is a REPLACE (old Group A removed first),
    // so the count after is (existing − GroupA members) + 1.
    // For Group B or C, the operation is an ADD, so count is existing + 1.
    const projectedMarks = new Set(marks);
    if (incomingGroup === 'A') {
        for (const m of [...projectedMarks]) {
            if (GROUP_A.has(m)) projectedMarks.delete(m);
        }
    }
    projectedMarks.add(incoming);

    if (projectedMarks.size > 3) {
        return { allowed: false, reason: 'Maximum 3 combining marks exceeded' };
    }

    return { allowed: true, reason: '' };
};

// ---------------------------------------------------------------------------
// Core mutation functions (spec §9)
// ---------------------------------------------------------------------------

/**
 * Apply `incoming` diacritic code point to `cluster`.
 *
 * Behaviour (in evaluation order):
 *   1. Toggle-off — if incoming is already in the cluster's marks, remove it.
 *   2. Hard rules — if blocked, return null (caller must flash and not write).
 *   3. Replace mode — if incoming is Group A and a different Group A exists,
 *      strip the old Group A mark and insert the new one.
 *   4. Stack — add the incoming mark alongside existing marks.
 *
 * Returns the new canonical cluster string, or null if hard-blocked.
 *
 * @param {string} cluster  — current grapheme cluster
 * @param {string} incoming — diacritic code point to apply
 * @returns {string|null}
 */
window.applyDiacritic = function applyDiacritic(cluster, incoming) {
    const { base, marks } = window.parseCluster(cluster);

    // --- Toggle-off ---
    if (marks.has(incoming)) {
        const newMarks = new Set(marks);
        newMarks.delete(incoming);
        return window.canonicalCluster(base, newMarks);
    }

    // --- Hard rules ---
    const check = window.hardRulesCheck(cluster, incoming);
    if (!check.allowed) {
        return null; // caller must call flashBlockedTile()
    }

    const newMarks = new Set(marks);
    const incomingGroup = window.classifyMark(incoming);

    // --- Replace mode (Group A) ---
    // Strip any existing Group A mark before adding the new one.
    if (incomingGroup === 'A') {
        for (const m of [...newMarks]) {
            if (GROUP_A.has(m)) newMarks.delete(m);
        }
    }

    // --- Stack (Group B, C, or no-conflict Group A) ---
    newMarks.add(incoming);
    return window.canonicalCluster(base, newMarks);
};

/**
 * Remove ALL combining marks from `cluster` (Delete / Backspace behaviour).
 * Returns the bare base character as a string.
 *
 * @param {string} cluster
 * @returns {string} — bare base character only
 */
window.clearDiacritics = function clearDiacritics(cluster) {
    return window.parseCluster(cluster).base;
};

// ---------------------------------------------------------------------------
// UI feedback
// ---------------------------------------------------------------------------

/**
 * Flash the character panel briefly to signal a hard-rule rejection.
 * Adds `.flash-blocked` to #char-panel for 220ms; CSS handles the animation.
 */
window.flashBlockedTile = function flashBlockedTile() {
    const panel = document.getElementById('char-panel');
    if (!panel) return;
    panel.classList.remove('flash-blocked'); // reset if already animating
    // Force reflow so re-adding the class re-triggers the animation
    void panel.offsetWidth;
    panel.classList.add('flash-blocked');
    setTimeout(() => panel.classList.remove('flash-blocked'), 220);
};

/**
 * Return true if the grapheme cluster is phonologically complete — i.e.,
 * it carries at least one Group A mark (vowel or sukoon).
 *
 * Completeness rules (spec §Smart-flow):
 *   Has a short vowel (no shadda)        → complete
 *   Has tanween (no shadda)              → complete
 *   Has sukoon                           → complete
 *   Has shadda only                      → NOT complete (awaits vowel)
 *   Has shadda + vowel or tanween        → complete
 *   Bare (no marks at all)               → NOT complete
 *   Has only Group C marks               → NOT complete
 *
 * Used by character-mode.js _handleDiacriticKey to determine whether
 * to trigger smart-flow auto-advance after a successful write.
 *
 * @param {string} cluster — grapheme cluster string
 * @returns {boolean}
 */
window.isClusterComplete = function isClusterComplete(cluster) {
    const { marks } = window.parseCluster(cluster);
    return [...marks].some(m => GROUP_A.has(m));
};
