"""
diacritic_engine.py — Arabic Diacritics Editor, Phase 1 Task 1.4
=================================================================
Core file-write engine.  No Flask, no UI.  This module is the
critical-path gate: it must pass all tests before any other
Phase 1 task is started (per Plan v1.1 §Task ordering note).

Two public functions:

    canonical_cluster(base, marks)  →  str
        Rebuild a MUTATED grapheme cluster in app-canonical order:
        Group C → Group B (Shadda) → Group A (vowel).
        Used ONLY for clusters the user has just edited.

    write_character(working_copy, line_idx, word_idx, char_idx, new_cluster)
        Splice new_cluster into the working copy at the given
        address.  Every other byte in the file is preserved verbatim.

Non-destructive contract
------------------------
Unedited grapheme clusters on the same line as the edit are written
back byte-for-byte as read.  The implementation segments the target
word into grapheme clusters with regex \\X, replaces only clusters[char_idx],
and joins the rest verbatim.  It never re-canonicalises untouched clusters.

No global Unicode normalisation is applied anywhere in this module
(spec §10.1).

Harakat taxonomy (spec §8.1)
-----------------------------
Group A — Base vowels (mutually exclusive, max ONE per cluster):
    U+064B Fathatan   U+064C Dammatan   U+064D Kasratan
    U+064E Fatha      U+064F Damma      U+0650 Kasra
    U+0652 Sukun

Group B — Modifier (stackable with one Group A, except Sukun):
    U+0651 Shadda

Group C — Orthographic modifiers (on alef/waw/ya carriers only):
    U+0653 Maddah above   U+0654 Hamza above
    U+0655 Hamza below    U+0670 Wasla (superscript alef)

Requirements
------------
    pip install regex        (not the stdlib 're' module)
    Python 3.10+
"""

from __future__ import annotations

import regex  # third-party; not stdlib 're'
from pathlib import Path

# ---------------------------------------------------------------------------
# Harakat taxonomy — codepoint sets
# ---------------------------------------------------------------------------

GROUP_A: frozenset[int] = frozenset({
    0x064B,  # Fathatan
    0x064C,  # Dammatan
    0x064D,  # Kasratan
    0x064E,  # Fatha
    0x064F,  # Damma
    0x0650,  # Kasra
    0x0652,  # Sukun
})

GROUP_B: frozenset[int] = frozenset({
    0x0651,  # Shadda
})

GROUP_C: frozenset[int] = frozenset({
    0x0653,  # Maddah above
    0x0654,  # Hamza above
    0x0655,  # Hamza below
    0x0670,  # Wasla (superscript alef)
})

ALL_DIACRITICS: frozenset[int] = GROUP_A | GROUP_B | GROUP_C

# Valid carrier codepoints for Group C marks (spec §8.2)
GROUP_C_CARRIERS: frozenset[int] = frozenset({
    0x0627,  # Alef  ا
    0x0648,  # Waw   و
    0x064A,  # Ya    ي
})
# Wasla is additionally restricted to alef only (spec §8.2)
WASLA_CARRIERS: frozenset[int] = frozenset({0x0627})


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def canonical_cluster(base: str, marks: set[str]) -> str:
    """Rebuild a grapheme cluster from base + mark set in canonical order.

    App-canonical order: Group C → Group B → Group A.
    Within each group, marks are sorted by codepoint for determinism.

    THIS FUNCTION IS FOR MUTATED CLUSTERS ONLY.
    Unedited clusters are always written back verbatim — they must never
    be passed through this function.

    Parameters
    ----------
    base : str
        A single Arabic base letter (one code point, CCC = 0).
    marks : set[str]
        Set of combining-mark characters (each one code point).
        Unknown codepoints (not in any group) are appended last,
        sorted by codepoint.

    Returns
    -------
    str
        Base letter followed by marks in canonical order.
    """
    if len(base) != 1:
        raise ValueError(f"base must be a single code point, got {base!r}")

    c_marks = sorted((m for m in marks if ord(m) in GROUP_C), key=ord)
    b_marks = sorted((m for m in marks if ord(m) in GROUP_B), key=ord)
    a_marks = sorted((m for m in marks if ord(m) in GROUP_A), key=ord)
    # Anything not in any known group — append at end, sorted, without dropping
    unknown = sorted(
        (m for m in marks if ord(m) not in ALL_DIACRITICS),
        key=ord,
    )

    return base + "".join(c_marks) + "".join(b_marks) + "".join(a_marks) + "".join(unknown)


def extract_cluster_parts(cluster: str) -> tuple[str, set[str]]:
    """Split a grapheme cluster string into (base_char, marks_set).

    Convenience function for callers that receive a raw cluster string
    from the segmenter and need to manipulate its marks.

    The base character is the first code point (CCC = 0).
    All subsequent code points are returned as the marks set.
    Order within the set is not meaningful — use canonical_cluster()
    to rebuild in canonical order.
    """
    if not cluster:
        raise ValueError("cluster must not be empty")
    return cluster[0], set(cluster[1:])


def segment_line_clusters(line: str) -> list[str]:
    """Segment a single line string into grapheme clusters using regex \\X.

    Spaces and line-ending characters appear as their own single-character
    clusters.  Callers that want only Arabic letter clusters must filter by
    checking whether a cluster's first code point is in the Arabic block.

    Used by write_character() internally and exposed for testing.
    """
    return regex.findall(r"\X", line)


def write_character(
    working_copy: Path,
    line_idx: int,
    word_idx: int,
    char_idx: int,
    new_cluster: str,
) -> None:
    """Mutate a single grapheme cluster in the working copy.

    Address model
    -------------
    line_idx  — 0-based index of the line in the file (splitlines with keepends)
    word_idx  — 0-based index of the word token on that line.
                Word tokens are non-whitespace runs produced by splitting the
                line on \\s+ (matching the frontend's tokenisation).
    char_idx  — 0-based index into the grapheme cluster array of that word.
                This is NEVER a raw string index (spec §5.4).

    Byte-preservation invariant
    ---------------------------
    Only the bytes of the target grapheme cluster change.  Every other byte
    in the file — including all other clusters on the same line, all other
    lines, and all whitespace/line-ending bytes — is written back verbatim.

    The implementation achieves this by:
      1. Splitting the file into lines with splitlines(keepends=True)
         so line endings (\r\n or \n) are preserved exactly.
      2. Splitting the target line into alternating [word, sep, word, sep, ...]
         tokens with a capturing split on (\\s+), preserving all whitespace.
      3. Segmenting only the target word token into grapheme clusters.
      4. Replacing only clusters[char_idx].
      5. Joining everything back and encoding to UTF-8 without normalisation.

    No global Unicode normalisation is applied at any point.

    Parameters
    ----------
    working_copy : Path
        Path to the diac_ working copy file.
    line_idx : int
        0-based line index.
    word_idx : int
        0-based word index on the line.
    char_idx : int
        0-based grapheme cluster index within the word.
    new_cluster : str
        The replacement grapheme cluster string, already in canonical order
        (built by canonical_cluster() before calling this function).

    Raises
    ------
    FileNotFoundError
        If working_copy does not exist.
    IndexError
        If line_idx, word_idx, or char_idx is out of range.
    ValueError
        If new_cluster is empty.
    UnicodeDecodeError
        If the file is not valid UTF-8.
    """
    if not new_cluster:
        raise ValueError("new_cluster must not be empty")
    if not working_copy.exists():
        raise FileNotFoundError(f"Working copy not found: {working_copy}")

    # --- Step 1: Read raw bytes, decode to str without normalisation ----------
    raw_bytes: bytes = working_copy.read_bytes()
    text: str = raw_bytes.decode("utf-8")
    # Note: .decode() with no errors= param uses 'strict' — raises on bad UTF-8.
    # We deliberately do NOT call unicodedata.normalize() here or anywhere below.

    # --- Step 2: Split into lines, preserving line endings -------------------
    lines: list[str] = text.splitlines(keepends=True)

    if line_idx >= len(lines):
        raise IndexError(
            f"line_idx {line_idx} is out of range — file has {len(lines)} lines"
        )

    target_line: str = lines[line_idx]

    # --- Step 3: Split target line into [word, sep, word, sep, ...] ----------
    # The capturing group keeps the separators so ''.join(tokens) == target_line.
    tokens: list[str] = regex.split(r"(\s+)", target_line)
    # e.g. 'word1 word2\r\n' → ['word1', ' ', 'word2', '\r\n', '']
    # Empty string at the end is harmless when joining.

    # Identify navigable word token positions (non-empty, not pure whitespace)
    _WHITESPACE_RE = regex.compile(r"^\s+$")
    word_token_positions: list[int] = [
        i for i, tok in enumerate(tokens)
        if tok and not _WHITESPACE_RE.match(tok)
    ]

    if word_idx >= len(word_token_positions):
        raise IndexError(
            f"word_idx {word_idx} is out of range — "
            f"line {line_idx!r} has {len(word_token_positions)} word token(s)"
        )

    tok_i: int = word_token_positions[word_idx]
    word_str: str = tokens[tok_i]

    # --- Step 4: Segment the word into grapheme clusters ---------------------
    clusters: list[str] = regex.findall(r"\X", word_str)

    if char_idx >= len(clusters):
        raise IndexError(
            f"char_idx {char_idx} is out of range — "
            f"word {word_idx!r} on line {line_idx!r} has {len(clusters)} cluster(s)"
        )

    # --- Step 5: Replace ONLY the target cluster --- all others are verbatim -
    clusters[char_idx] = new_cluster

    # --- Step 6: Reassemble word → line → file and write --------------------
    tokens[tok_i] = "".join(clusters)
    lines[line_idx] = "".join(tokens)

    result_bytes: bytes = "".join(lines).encode("utf-8")
    working_copy.write_bytes(result_bytes)
