"""
test_diacritic_engine.py — Task 1.4 test suite
================================================
Tests for canonical_cluster() and write_character() in isolation.

Coverage (≥12 tests, matching Phase 1 deliverable requirement):

    canonical_cluster()
        T01  Group A only (single vowel)
        T02  Group B only (Shadda alone)
        T03  Group A + Group B in non-canonical input order (A before B)
        T04  Group C + Group A — canonical output C→A
        T05  All three groups — canonical output C→B→A
        T06  Empty marks set — returns bare base letter
        T07  Invalid base (multi-codepoint) raises ValueError

    write_character() / byte-preservation
        T08  Edit cluster on a line with no other clusters — roundtrip correct
        T09  Edit first cluster on a multi-cluster line — other clusters byte-identical
        T10  Edit last cluster on a multi-cluster line — other clusters byte-identical
        T11  Non-canonical cluster (KASRA before SHADDA) on the same line as an edit
             is preserved byte-for-byte  ← KEY CORPUS TEST using sample_text_05.txt
        T12  Correct bytes appear at the edited position after write
        T13  All bytes on OTHER lines are untouched after a write
        T14  CRLF line endings are preserved verbatim after a write
        T15  out-of-range line_idx raises IndexError
        T16  out-of-range word_idx raises IndexError
        T17  out-of-range char_idx raises IndexError

Run with:
    pytest test_diacritic_engine.py -v
    pytest test_diacritic_engine.py -v --tb=short   # for compact traces

Note on Group C corpus coverage
--------------------------------
Group C marks (hamza above/below, maddah, wasla) are absent from the
Al-Diwan corpus (all 3,821 poems use precomposed forms — see Session 1
handover §6).  Group C tests (T04, T05) therefore use synthetic clusters
constructed directly in this file, as agreed in the handover watch points.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
import regex

from diacritic_engine import (
    GROUP_A,
    GROUP_B,
    GROUP_C,
    canonical_cluster,
    extract_cluster_parts,
    segment_line_clusters,
    write_character,
)

# ---------------------------------------------------------------------------
# Paths — adjust if your SAMPLE_TEXTS directory is elsewhere
# ---------------------------------------------------------------------------
# Using files uploaded for Session 2.  The tests copy them to a tmp dir so
# originals are never modified.
CORPUS_DIR = Path("./data/SAMPLE_TEXTS")
SAMPLE_02 = CORPUS_DIR / "sample_text_02.txt"
SAMPLE_05 = CORPUS_DIR / "sample_text_05.txt"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _bytes_of_cluster(cluster: str) -> bytes:
    return cluster.encode("utf-8")


def _read_line_clusters(path: Path, line_idx: int, word_idx: int) -> list[str]:
    """Read grapheme clusters of a specific word from a file."""
    text = path.read_bytes().decode("utf-8")
    lines = text.splitlines(keepends=True)
    line = lines[line_idx]
    tokens = regex.split(r"(\s+)", line)
    word_positions = [
        i for i, t in enumerate(tokens) if t and not regex.match(r"^\s+$", t)
    ]
    word_str = tokens[word_positions[word_idx]]
    return regex.findall(r"\X", word_str)


# ===========================================================================
# T01–T07  canonical_cluster()
# ===========================================================================


class TestCanonicalCluster:

    def test_T01_group_a_only(self):
        """Single Group A vowel: base + Fatha → base + Fatha."""
        result = canonical_cluster("ب", {"\u064e"})  # ba + fatha
        assert result == "بَ"
        assert result.encode("utf-8") == "ب".encode("utf-8") + b"\xd9\x8e"

    def test_T02_group_b_only(self):
        """Shadda alone (no vowel) is valid — spec §8.2 'Shadda alone is valid'."""
        result = canonical_cluster("ب", {"\u0651"})  # ba + shadda
        assert result == "بّ"
        # Only one combining mark — Group B
        base, marks = extract_cluster_parts(result)
        assert base == "ب"
        assert marks == {"\u0651"}

    def test_T03_group_a_b_noncanonical_input_order(self):
        """Marks supplied as A then B in the set; output must be B then A."""
        # set order is irrelevant — canonical_cluster always orders B → A
        marks = {"\u064e", "\u0651"}  # fatha (A) + shadda (B)
        result = canonical_cluster("ب", marks)
        # Canonical: Group B first, then Group A
        expected = "ب" + "\u0651" + "\u064e"  # ba + shadda + fatha
        assert (
            result == expected
        ), f"Expected shadda before fatha; got bytes {result.encode('utf-8').hex()}"

    def test_T04_group_c_plus_group_a(self):
        """Group C + Group A: C must come first (C → A)."""
        # Alef + hamza-above (C) + fatha (A) — synthetic (not in corpus)
        marks = {"\u064e", "\u0654"}  # fatha(A) + hamza-above(C)
        result = canonical_cluster("\u0627", marks)  # alef base
        expected = "\u0627" + "\u0654" + "\u064e"  # alef + hamza-above(C) + fatha(A)
        assert (
            result == expected
        ), f"Expected C before A; got bytes {result.encode('utf-8').hex()}"

    def test_T05_all_three_groups(self):
        """All three groups: canonical output must be C → B → A."""
        # Alef + maddah(C) + shadda(B) + fatha(A) — synthetic
        marks = {"\u064e", "\u0651", "\u0653"}  # fatha(A) + shadda(B) + maddah(C)
        result = canonical_cluster("\u0627", marks)
        expected = "\u0627" + "\u0653" + "\u0651" + "\u064e"  # alef + C + B + A
        assert (
            result == expected
        ), f"Expected C→B→A; got bytes {result.encode('utf-8').hex()}"

    def test_T06_empty_marks_returns_bare_base(self):
        """Empty marks set — should return just the base letter."""
        result = canonical_cluster("ب", set())
        assert result == "ب"
        assert len(result) == 1

    def test_T07_multichar_base_raises(self):
        """Passing a multi-codepoint string as base should raise ValueError."""
        with pytest.raises(ValueError):
            canonical_cluster("بَ", {"\u064f"})  # 'بَ' has 2 code points


# ===========================================================================
# T08–T14  write_character() — byte-preservation and correctness
# ===========================================================================


class TestWriteCharacter:

    @pytest.fixture()
    def tmp_sample_02(self, tmp_path):
        """Fresh copy of sample_text_02.txt in a temp directory."""
        dest = tmp_path / "diac_sample_02.txt"
        shutil.copy2(SAMPLE_02, dest)
        return dest

    @pytest.fixture()
    def tmp_sample_05(self, tmp_path):
        """Fresh copy of sample_text_05.txt in a temp directory."""
        dest = tmp_path / "diac_sample_05.txt"
        shutil.copy2(SAMPLE_05, dest)
        return dest

    @pytest.fixture()
    def simple_crlf(self, tmp_path):
        """Minimal synthetic Arabic file with CRLF endings for targeted tests."""
        # Two lines:
        #   Line 0: "كَتَبَ"  (3 fully diacritized clusters)
        #   Line 1: "قَالَ بَيْتٌ"  (word0: 4 clusters, word1: 4 clusters)
        content = "كَتَبَ\r\nقَالَ بَيْتٌ\r\n"
        p = tmp_path / "diac_simple.txt"
        p.write_bytes(content.encode("utf-8"))
        return p

    # --- T08 ------------------------------------------------------------------
    def test_T08_single_cluster_line_roundtrip(self, tmp_path):
        """Edit the only cluster on a line — bytes before and after are correct."""
        # Single-word, single-cluster line
        original_content = "ب\r\nآخر\r\n"
        p = tmp_path / "diac_single.txt"
        p.write_bytes(original_content.encode("utf-8"))

        # Add Fatha to 'ب' (line 0, word 0, char 0)
        new_cluster = canonical_cluster("ب", {"\u064e"})  # بَ
        write_character(p, line_idx=0, word_idx=0, char_idx=0, new_cluster=new_cluster)

        result_bytes = p.read_bytes()
        result_text = result_bytes.decode("utf-8")
        lines = result_text.splitlines(keepends=True)

        # Line 0 should now be 'بَ\r\n'
        assert lines[0] == "بَ\r\n"
        # Line 1 must be completely untouched
        assert lines[1] == "آخر\r\n"

    # --- T09 ------------------------------------------------------------------
    def test_T09_edit_first_cluster_others_verbatim(self, simple_crlf):
        """Edit clusters[0] of a word — all subsequent clusters byte-identical."""
        p = simple_crlf
        # Line 1 word 0 is 'قَالَ' — clusters: [قَ, ا, لَ]
        # Actually let's inspect first
        clusters_before = _read_line_clusters(p, line_idx=1, word_idx=0)
        assert len(clusters_before) >= 2, "Fixture word too short for this test"

        # Record bytes of ALL clusters except the first
        other_bytes_before = [_bytes_of_cluster(c) for c in clusters_before[1:]]

        # Edit clusters[0]: strip all marks (Delete behaviour)
        base_char = clusters_before[0][0]
        new_cluster = canonical_cluster(base_char, set())  # bare base
        write_character(p, line_idx=1, word_idx=0, char_idx=0, new_cluster=new_cluster)

        clusters_after = _read_line_clusters(p, line_idx=1, word_idx=0)
        other_bytes_after = [_bytes_of_cluster(c) for c in clusters_after[1:]]

        assert (
            other_bytes_before == other_bytes_after
        ), "Clusters after the edited one changed — byte-preservation violated"

    # --- T10 ------------------------------------------------------------------
    def test_T10_edit_last_cluster_others_verbatim(self, simple_crlf):
        """Edit the last cluster of a word — all preceding clusters byte-identical."""
        p = simple_crlf
        clusters_before = _read_line_clusters(p, line_idx=1, word_idx=1)
        assert len(clusters_before) >= 2

        other_bytes_before = [_bytes_of_cluster(c) for c in clusters_before[:-1]]
        last_idx = len(clusters_before) - 1

        # Add Kasra to last cluster
        base_char = clusters_before[last_idx][0]
        existing_marks = set(clusters_before[last_idx][1:])
        existing_marks -= {chr(cp) for cp in GROUP_A}  # remove any existing Group A
        existing_marks.add("\u0650")  # add Kasra
        new_cluster = canonical_cluster(base_char, existing_marks)

        write_character(
            p, line_idx=1, word_idx=1, char_idx=last_idx, new_cluster=new_cluster
        )

        clusters_after = _read_line_clusters(p, line_idx=1, word_idx=1)
        other_bytes_after = [_bytes_of_cluster(c) for c in clusters_after[:-1]]

        assert other_bytes_before == other_bytes_after

    # --- T11 (KEY CORPUS TEST) ------------------------------------------------
    def test_T11_non_canonical_cluster_preserved_byte_for_byte(self, tmp_sample_05):
        """
        THE CRITICAL BYTE-PRESERVATION TEST.

        sample_text_05.txt line 11 (0-idx) contains:
            'قدّه صرفُ دهرهِ أيّ قدِّ\\r\\n'

        The last word 'قدِّ' has cluster [1] = دِّ encoded as:
            d8af  (DAL, U+062F)
            d990  (KASRA, U+0650 — Group A, CCC=32)
            d991  (SHADDA, U+0651 — Group B, CCC=33)

        This is a NON-CANONICAL order per our app editorial policy (A before B).
        It IS Unicode-CCC-canonical (lower CCC first), but our app orders B→A
        for mutated clusters.

        When we edit a DIFFERENT cluster on the same line (word 0, char 0),
        the دِّ cluster at word 4, char 1 must survive with exactly
        bytes d8af d990 d991 — unchanged.
        """
        p = tmp_sample_05
        NC_CLUSTER_BYTES = bytes.fromhex("d8afd990d991")  # DAL+KASRA+SHADDA

        # Verify the non-canonical cluster is present in the copy
        clusters_before = _read_line_clusters(p, line_idx=11, word_idx=4)
        assert _bytes_of_cluster(clusters_before[1]) == NC_CLUSTER_BYTES, (
            f"Precondition failed — expected d8afd990d991, "
            f"got {_bytes_of_cluster(clusters_before[1]).hex()}"
        )

        # Edit a DIFFERENT cluster: word 0, char 0 (the 'ق' in 'قدّه')
        # Add Fatha to it → new cluster = قَ
        new_cluster = canonical_cluster("ق", {"\u064e"})
        write_character(p, line_idx=11, word_idx=0, char_idx=0, new_cluster=new_cluster)

        # The non-canonical cluster at word 4, char 1 must be byte-identical
        clusters_after = _read_line_clusters(p, line_idx=11, word_idx=4)
        nc_bytes_after = _bytes_of_cluster(clusters_after[1])

        assert nc_bytes_after == NC_CLUSTER_BYTES, (
            f"NON-DESTRUCTIVE CONTRACT VIOLATED.\n"
            f"  Non-canonical cluster دِّ was silently reordered.\n"
            f"  Expected bytes: {NC_CLUSTER_BYTES.hex()}\n"
            f"  Got bytes:      {nc_bytes_after.hex()}\n"
            f"  The engine re-canonicalised an untouched cluster — "
            f"this is the worst failure mode."
        )

    # --- T12 ------------------------------------------------------------------
    def test_T12_edited_cluster_bytes_correct(self, tmp_sample_05):
        """The edited cluster's bytes at the target position are what we wrote."""
        p = tmp_sample_05
        # Add Shadda + Fatha to word 0, char 0 (bare 'ق' in 'قدّه' on line 11)
        # canonical order: Group B (Shadda) before Group A (Fatha)
        new_cluster = canonical_cluster("ق", {"\u0651", "\u064e"})  # قَّ  B→A
        expected_bytes = new_cluster.encode("utf-8")

        write_character(p, line_idx=11, word_idx=0, char_idx=0, new_cluster=new_cluster)

        clusters_after = _read_line_clusters(p, line_idx=11, word_idx=0)
        actual_bytes = _bytes_of_cluster(clusters_after[0])

        assert actual_bytes == expected_bytes, (
            f"Edited cluster bytes wrong.\n"
            f"  Expected: {expected_bytes.hex()} ({new_cluster!r})\n"
            f"  Got:      {actual_bytes.hex()}"
        )

    # --- T13 ------------------------------------------------------------------
    def test_T13_other_lines_untouched(self, tmp_sample_05):
        """Editing one line must leave all other lines byte-identical."""
        p = tmp_sample_05
        original_bytes = p.read_bytes()
        original_lines = original_bytes.decode("utf-8").splitlines(keepends=True)

        # Edit line 11, word 0, char 0
        new_cluster = canonical_cluster("ق", {"\u064e"})
        write_character(p, line_idx=11, word_idx=0, char_idx=0, new_cluster=new_cluster)

        after_bytes = p.read_bytes()
        after_lines = after_bytes.decode("utf-8").splitlines(keepends=True)

        assert len(original_lines) == len(after_lines), "Line count changed"

        for i, (orig, after) in enumerate(zip(original_lines, after_lines)):
            if i == 11:
                continue  # skip the edited line
            assert orig == after, (
                f"Line {i} was unexpectedly modified.\n"
                f"  Before: {orig.encode('utf-8').hex()}\n"
                f"  After:  {after.encode('utf-8').hex()}"
            )

    # --- T14 ------------------------------------------------------------------
    def test_T14_crlf_endings_preserved(self, tmp_sample_05):
        """CRLF line endings in the file survive after a write."""
        p = tmp_sample_05

        new_cluster = canonical_cluster("ق", {"\u064e"})
        write_character(p, line_idx=11, word_idx=0, char_idx=0, new_cluster=new_cluster)

        result_bytes = p.read_bytes()
        result_text = result_bytes.decode("utf-8")
        lines = result_text.splitlines(keepends=True)

        crlf_count = sum(1 for l in lines if l.endswith("\r\n"))
        lf_only = sum(1 for l in lines if l.endswith("\n") and not l.endswith("\r\n"))

        # Original file was all-CRLF (verified during corpus analysis)
        assert lf_only == 0, (
            f"CRLF endings were converted to LF — line ending corruption detected. "
            f"LF-only lines: {lf_only}"
        )
        assert crlf_count > 0, "No CRLF endings found — something went badly wrong"

    # --- T15–T17  Error handling ----------------------------------------------

    def test_T15_out_of_range_line_idx(self, tmp_sample_05):
        """line_idx beyond file length raises IndexError."""
        with pytest.raises(IndexError, match="line_idx"):
            write_character(
                tmp_sample_05, line_idx=9999, word_idx=0, char_idx=0, new_cluster="ق"
            )

    def test_T16_out_of_range_word_idx(self, tmp_sample_05):
        """word_idx beyond words on the line raises IndexError."""
        with pytest.raises(IndexError, match="word_idx"):
            write_character(
                tmp_sample_05, line_idx=0, word_idx=999, char_idx=0, new_cluster="ق"
            )

    def test_T17_out_of_range_char_idx(self, tmp_sample_05):
        """char_idx beyond clusters in the word raises IndexError."""
        with pytest.raises(IndexError, match="char_idx"):
            write_character(
                tmp_sample_05, line_idx=0, word_idx=0, char_idx=999, new_cluster="ق"
            )
