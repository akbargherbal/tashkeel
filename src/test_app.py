"""
test_app.py — Tier 1 Flask route tests
=======================================
Phase 1 of TESTING_PHASED_PLAN.md (Plan v1.0), Session 35.

Coverage — 50 tests across 10 classes:
    Task 1.1  TestResolveSafe      (5 tests)  — _resolve_safe() path traversal guard
    Task 1.2  TestGetFileStatus    (5 tests)  — get_file_status() three-state logic
    Task 1.3  TestScanDirectory    (7 tests)  — scan_directory() inclusion/exclusion rules
    Task 1.4  TestApiConfig        (3 tests)  — GET  /api/config
    Task 1.5  TestApiFiles         (3 tests)  — GET  /api/files
    Task 1.6  TestApiOpen          (7 tests)  — POST /api/open
    Task 1.7  TestApiWriteChar     (8 tests)  — POST /api/write_char  ⚠️ highest-risk route
    Task 1.8  TestApiSaveCursor    (4 tests)  — POST /api/save_cursor
    Task 1.9  TestApiMarkComplete  (4 tests)  — POST /api/mark_complete
    Task 1.10 TestApiReset         (4 tests)  — POST /api/reset

Run with:
    pytest test_app.py -v
    pytest test_app.py -v --tb=short

Plan compliance notes
---------------------
* No production file (app.py, diacritic_engine.py) was modified.
* T_RS_04 deviation: Plan v1.0 assumed _resolve_safe(".") raises ValueError.
  Actual code behaviour: target.relative_to(ROOT_DIR) returns Path('.') without
  error when target == ROOT_DIR — no ValueError.  T_RS_04 is written to test the
  actual behaviour.  Downstream route handlers (file-not-found, is-a-directory)
  catch ROOT_DIR-as-path cases.  Flagged in Session 35 handover; no version bump
  required (scope unchanged, no production change).
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
import regex

import app as app_module
from app import _resolve_safe, get_file_status, scan_directory

# ---------------------------------------------------------------------------
# Small Arabic text fixtures
# ---------------------------------------------------------------------------

# Two-line, two-word plain text (no diacritics) — used by most route tests.
SAMPLE_TEXT = "بيت كتب\nقال رجل\n"

# One diacritised word across one line.
# Clusters: [بَ (U+0628 U+064E), يْ (U+064A U+0652), تٌ (U+062A U+064C)]
DIAC_WORD = "بَيْتٌ"
DIAC_LINE = DIAC_WORD + "\n"


# ---------------------------------------------------------------------------
# Module-level shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Flask test client with ROOT_DIR and KEYMAP_PATH isolated to tmp_path.

    Per TESTING_PHASED_PLAN.md Task 1.4 fixture specification.
    monkeypatch restores the original values after each test.
    """
    monkeypatch.setattr(app_module, "ROOT_DIR", tmp_path)
    monkeypatch.setattr(app_module, "KEYMAP_PATH", tmp_path / "keymap.json")
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


# ===========================================================================
# Task 1.1 — TestResolveSafe
# Verifies RULES.md §3.8: _resolve_safe() must be called on every route that
# accepts a user-supplied path below ROOT_DIR.
# ===========================================================================


class TestResolveSafe:
    """Tests for _resolve_safe() path traversal guard (RULES.md §3.8)."""

    @pytest.fixture(autouse=True)
    def _patch_root(self, tmp_path, monkeypatch):
        """Set app.ROOT_DIR to tmp_path for the duration of each test."""
        monkeypatch.setattr(app_module, "ROOT_DIR", tmp_path)
        self.root = tmp_path

    # T_RS_01 -----------------------------------------------------------------
    def test_T_RS_01_normal_relative_path(self):
        """Normal relative path inside ROOT_DIR → resolved absolute path."""
        result = _resolve_safe("subdir/file.txt")
        assert result == (self.root / "subdir" / "file.txt").resolve()

    # T_RS_02 -----------------------------------------------------------------
    def test_T_RS_02_traversal_attempt_raises(self):
        """'../…' traversal attempt → ValueError."""
        with pytest.raises(ValueError):
            _resolve_safe("../etc/passwd")

    # T_RS_03 -----------------------------------------------------------------
    def test_T_RS_03_absolute_path_outside_root_raises(self):
        """Absolute path outside ROOT_DIR → ValueError.

        On Windows, path('C:/Windows/…') is outside the temp ROOT_DIR.
        On POSIX, '/etc/passwd' is outside.  Both must raise.
        """
        import sys

        outside = (
            "C:/Windows/System32/drivers/etc/hosts"
            if sys.platform == "win32"
            else "/etc/passwd"
        )
        with pytest.raises(ValueError):
            _resolve_safe(outside)

    # T_RS_04 -----------------------------------------------------------------
    def test_T_RS_04_root_dir_itself_is_allowed(self):
        """'.' resolves to ROOT_DIR — _resolve_safe() does NOT raise ValueError.

        PLAN NOTE: TESTING_PHASED_PLAN.md v1.0 T_RS_04 assumed this would raise
        ValueError ("ROOT_DIR is not 'below' itself").  Inspection of the
        implementation shows that target.relative_to(ROOT_DIR) returns Path('.')
        without error when target == ROOT_DIR.  This is safe: downstream route
        handlers reject directories via file-existence and is-file checks.
        This test reflects the actual implemented behaviour.
        Flagged in Session 35 handover; no production change; no plan version bump.
        """
        result = _resolve_safe(".")
        assert result == self.root.resolve()

    # T_RS_05 -----------------------------------------------------------------
    def test_T_RS_05_nested_subdirectory_allowed(self):
        """Deeply nested path inside ROOT_DIR → allowed, correct absolute path."""
        result = _resolve_safe("a/b/c/file.txt")
        assert result == (self.root / "a" / "b" / "c" / "file.txt").resolve()


# ===========================================================================
# Task 1.2 — TestGetFileStatus
# ===========================================================================


class TestGetFileStatus:
    """Tests for get_file_status() — 'untouched' | 'in_progress' | 'complete'."""

    # T_GFS_01 ----------------------------------------------------------------
    def test_T_GFS_01_no_working_copy_is_untouched(self, tmp_path):
        """No working copy present → 'untouched'."""
        orig = tmp_path / "file.txt"
        orig.write_text("text", encoding="utf-8")
        assert get_file_status(orig) == "untouched"

    # T_GFS_02 ----------------------------------------------------------------
    def test_T_GFS_02_working_copy_no_sidecar_is_in_progress(self, tmp_path):
        """Working copy present, no sidecar → 'in_progress'."""
        orig = tmp_path / "file.txt"
        orig.write_text("text", encoding="utf-8")
        (tmp_path / "diac_file.txt").write_text("text", encoding="utf-8")
        assert get_file_status(orig) == "in_progress"

    # T_GFS_03 ----------------------------------------------------------------
    def test_T_GFS_03_sidecar_complete_returns_complete(self, tmp_path):
        """Sidecar has status='complete' → 'complete'."""
        orig = tmp_path / "file.txt"
        orig.write_text("text", encoding="utf-8")
        (tmp_path / "diac_file.txt").write_text("text", encoding="utf-8")
        sidecar = tmp_path / "diac_file.txt.diac_cursor.json"
        sidecar.write_text(json.dumps({"status": "complete"}), encoding="utf-8")
        assert get_file_status(orig) == "complete"

    # T_GFS_04 ----------------------------------------------------------------
    def test_T_GFS_04_sidecar_in_progress_returns_in_progress(self, tmp_path):
        """Sidecar has status='in_progress' → 'in_progress'."""
        orig = tmp_path / "file.txt"
        orig.write_text("text", encoding="utf-8")
        (tmp_path / "diac_file.txt").write_text("text", encoding="utf-8")
        sidecar = tmp_path / "diac_file.txt.diac_cursor.json"
        sidecar.write_text(json.dumps({"status": "in_progress"}), encoding="utf-8")
        assert get_file_status(orig) == "in_progress"

    # T_GFS_05 ----------------------------------------------------------------
    def test_T_GFS_05_corrupt_sidecar_returns_in_progress(self, tmp_path):
        """Corrupt sidecar JSON → 'in_progress' (falls back to defaults).

        _read_cursor() catches json.JSONDecodeError and returns _DEFAULT_CURSOR,
        which has status='in_progress'.  A corrupt sidecar must never return
        'complete' — that would lock the file incorrectly.
        """
        orig = tmp_path / "file.txt"
        orig.write_text("text", encoding="utf-8")
        (tmp_path / "diac_file.txt").write_text("text", encoding="utf-8")
        sidecar = tmp_path / "diac_file.txt.diac_cursor.json"
        sidecar.write_text("not json {{", encoding="utf-8")
        result = get_file_status(orig)
        assert (
            result == "in_progress"
        ), f"Corrupt sidecar must fall back to 'in_progress', got {result!r}"


# ===========================================================================
# Task 1.3 — TestScanDirectory
# ===========================================================================


class TestScanDirectory:
    """Tests for scan_directory() inclusion/exclusion rules (spec §3)."""

    # T_SD_01 -----------------------------------------------------------------
    def test_T_SD_01_diac_prefix_excluded_original_included(self, tmp_path):
        """diac_ working copy excluded; original .txt included."""
        (tmp_path / "chapter.txt").write_text("x", encoding="utf-8")
        (tmp_path / "diac_chapter.txt").write_text("x", encoding="utf-8")
        results = scan_directory(tmp_path)
        paths = [r["path"] for r in results]
        assert "chapter.txt" in paths
        assert "diac_chapter.txt" not in paths

    # T_SD_02 -----------------------------------------------------------------
    def test_T_SD_02_cursor_sidecar_excluded(self, tmp_path):
        """.diac_cursor.json sidecar files excluded."""
        (tmp_path / "chapter.txt").write_text("x", encoding="utf-8")
        (tmp_path / "diac_chapter.txt.diac_cursor.json").write_text(
            "{}", encoding="utf-8"
        )
        results = scan_directory(tmp_path)
        paths = [r["path"] for r in results]
        assert not any(p.endswith(".diac_cursor.json") for p in paths)

    # T_SD_03 -----------------------------------------------------------------
    def test_T_SD_03_diac_output_subtree_excluded(self, tmp_path):
        """Files inside _diac_output/ excluded; sibling original included."""
        out_dir = tmp_path / "_diac_output"
        out_dir.mkdir()
        (out_dir / "chapter.txt").write_text("x", encoding="utf-8")
        (tmp_path / "original.txt").write_text("x", encoding="utf-8")
        results = scan_directory(tmp_path)
        paths = [r["path"] for r in results]
        assert "original.txt" in paths
        assert not any("_diac_output" in p for p in paths)

    # T_SD_04 -----------------------------------------------------------------
    def test_T_SD_04_non_eligible_extensions_excluded(self, tmp_path):
        """.py and .log files excluded (not in _ELIGIBLE_SUFFIXES)."""
        (tmp_path / "script.py").write_text("x", encoding="utf-8")
        (tmp_path / "debug.log").write_text("x", encoding="utf-8")
        results = scan_directory(tmp_path)
        paths = [r["path"] for r in results]
        assert not any(p.endswith(".py") or p.endswith(".log") for p in paths)

    # T_SD_05 -----------------------------------------------------------------
    def test_T_SD_05_txt_and_md_both_eligible(self, tmp_path):
        """Both .txt and .md files are included in results."""
        (tmp_path / "notes.txt").write_text("x", encoding="utf-8")
        (tmp_path / "readme.md").write_text("x", encoding="utf-8")
        results = scan_directory(tmp_path)
        paths = [r["path"] for r in results]
        assert "notes.txt" in paths
        assert "readme.md" in paths

    # T_SD_06 -----------------------------------------------------------------
    def test_T_SD_06_empty_directory_returns_empty_list(self, tmp_path):
        """Empty directory → empty list."""
        results = scan_directory(tmp_path)
        assert results == []

    # T_SD_07 -----------------------------------------------------------------
    def test_T_SD_07_all_exclusion_rules_combined(self, tmp_path):
        """All four exclusion rules fire simultaneously; exactly one file returned."""
        # The one eligible file
        (tmp_path / "original.txt").write_text("x", encoding="utf-8")
        # Excluded: diac_ prefix
        (tmp_path / "diac_original.txt").write_text("x", encoding="utf-8")
        # Excluded: cursor sidecar
        (tmp_path / "diac_original.txt.diac_cursor.json").write_text(
            "{}", encoding="utf-8"
        )
        # Excluded: _diac_output subtree
        out_dir = tmp_path / "_diac_output"
        out_dir.mkdir()
        (out_dir / "original.txt").write_text("x", encoding="utf-8")
        # Excluded: wrong extension
        (tmp_path / "notes.py").write_text("x", encoding="utf-8")

        results = scan_directory(tmp_path)
        assert len(results) == 1, (
            f"Expected exactly 1 result, got {len(results)}: "
            f"{[r['path'] for r in results]}"
        )
        assert results[0]["path"] == "original.txt"


# ===========================================================================
# Task 1.4 — TestApiConfig
# ===========================================================================


class TestApiConfig:
    """Tests for GET /api/config."""

    # T_CFG_01 ----------------------------------------------------------------
    def test_T_CFG_01_valid_keymap_returned(self, client, tmp_path):
        """keymap.json present and valid → response has 'keymap' key with contents."""
        keymap_data = {"bindings": {"Digit1": "\u064e", "Digit2": "\u0650"}}
        (tmp_path / "keymap.json").write_text(json.dumps(keymap_data), encoding="utf-8")
        resp = client.get("/api/config")
        assert resp.status_code == 200
        body = resp.get_json()
        assert "keymap" in body
        assert body["keymap"] == keymap_data

    # T_CFG_02 ----------------------------------------------------------------
    def test_T_CFG_02_absent_keymap_returns_empty(self, client, tmp_path):
        """keymap.json absent → response has keymap: {}."""
        assert not (tmp_path / "keymap.json").exists()
        resp = client.get("/api/config")
        assert resp.status_code == 200
        assert resp.get_json()["keymap"] == {}

    # T_CFG_03 ----------------------------------------------------------------
    def test_T_CFG_03_malformed_keymap_returns_empty(self, client, tmp_path):
        """Malformed keymap.json → response has keymap: {} (no exception raised)."""
        (tmp_path / "keymap.json").write_text("not valid json {{", encoding="utf-8")
        resp = client.get("/api/config")
        assert resp.status_code == 200
        assert resp.get_json()["keymap"] == {}


# ===========================================================================
# Task 1.5 — TestApiFiles
# ===========================================================================


class TestApiFiles:
    """Tests for GET /api/files."""

    # T_FILES_01 --------------------------------------------------------------
    def test_T_FILES_01_empty_root_returns_empty_list(self, client):
        """Empty ROOT_DIR → {"files": []}."""
        resp = client.get("/api/files")
        assert resp.status_code == 200
        assert resp.get_json()["files"] == []

    # T_FILES_02 --------------------------------------------------------------
    def test_T_FILES_02_one_eligible_txt(self, client, tmp_path):
        """One eligible .txt → list with one entry, correct path and status."""
        (tmp_path / "sample.txt").write_text("text", encoding="utf-8")
        resp = client.get("/api/files")
        assert resp.status_code == 200
        files = resp.get_json()["files"]
        assert len(files) == 1
        assert files[0]["path"] == "sample.txt"
        assert files[0]["status"] == "untouched"

    # T_FILES_03 --------------------------------------------------------------
    def test_T_FILES_03_mix_returns_only_eligible(self, client, tmp_path):
        """Mix of eligible and excluded files → only the eligible .txt returned."""
        (tmp_path / "sample.txt").write_text("text", encoding="utf-8")
        (tmp_path / "diac_sample.txt").write_text("text", encoding="utf-8")
        (tmp_path / "script.py").write_text("x", encoding="utf-8")
        resp = client.get("/api/files")
        assert resp.status_code == 200
        paths = [f["path"] for f in resp.get_json()["files"]]
        assert paths == ["sample.txt"]


# ===========================================================================
# Task 1.6 — TestApiOpen
# ===========================================================================


class TestApiOpen:
    """Tests for POST /api/open."""

    def _make_original(self, tmp_path, name="sample.txt", content=None):
        p = tmp_path / name
        p.write_text(content or SAMPLE_TEXT, encoding="utf-8")
        return p

    # T_OPEN_01 ---------------------------------------------------------------
    def test_T_OPEN_01_first_open(self, client, tmp_path):
        """First open: working copy created; response has lines, cursor, status."""
        orig = self._make_original(tmp_path)
        orig_bytes = orig.read_bytes()  # Capture actual bytes written to disk
        wc = tmp_path / "diac_sample.txt"

        resp = client.post("/api/open", json={"file_path": "sample.txt"})
        assert resp.status_code == 200
        body = resp.get_json()
        assert "lines" in body
        assert "cursor" in body
        assert body["status"] == "in_progress"
        assert body["conflict_detected"] is False
        assert wc.exists(), "Working copy must be created on first open"
        # §3.1: original file must be byte-identical after the call
        assert (
            orig.read_bytes() == orig_bytes
        ), "§3.1 violated — original file was modified by /api/open"

    # T_OPEN_02 ---------------------------------------------------------------
    def test_T_OPEN_02_reopen_restores_cursor(self, client, tmp_path):
        """Re-open with an existing sidecar → cursor position restored."""
        self._make_original(tmp_path)
        # First open — creates working copy + default sidecar
        client.post("/api/open", json={"file_path": "sample.txt"})

        # Manually overwrite the sidecar with a known position
        sidecar = tmp_path / "diac_sample.txt.diac_cursor.json"
        sidecar.write_text(
            json.dumps(
                {
                    "line": 1,
                    "word": 0,
                    "char": None,
                    "status": "in_progress",
                    "last_seen_mtime": None,
                }
            ),
            encoding="utf-8",
        )

        resp = client.post("/api/open", json={"file_path": "sample.txt"})
        assert resp.status_code == 200
        cursor = resp.get_json()["cursor"]
        assert cursor["line"] == 1
        assert cursor["word"] == 0

    # T_OPEN_03 ---------------------------------------------------------------
    def test_T_OPEN_03_mtime_conflict_detected(self, client, tmp_path):
        """External modification of working copy → conflict_detected: true.

        Strategy: after the first open (which saves last_seen_mtime), directly
        overwrite the sidecar's last_seen_mtime with a value far in the past
        (epoch + 1 s).  The second open will then see abs(wc_mtime - 1.0) >> 0.01
        and set conflict_detected = true.  This is deterministic (no sleep needed).
        """
        self._make_original(tmp_path)
        # First open — creates working copy and writes current mtime to sidecar
        client.post("/api/open", json={"file_path": "sample.txt"})

        # Tamper with the sidecar: set last_seen_mtime to epoch + 1 s
        sidecar = tmp_path / "diac_sample.txt.diac_cursor.json"
        saved = json.loads(sidecar.read_text(encoding="utf-8"))
        saved["last_seen_mtime"] = 1.0  # 1970-01-01T00:00:01 UTC — way in the past
        sidecar.write_text(json.dumps(saved), encoding="utf-8")

        # Second open — working copy mtime is >> 1.0 → conflict
        resp = client.post("/api/open", json={"file_path": "sample.txt"})
        assert resp.status_code == 200
        assert resp.get_json()["conflict_detected"] is True

    # T_OPEN_04 ---------------------------------------------------------------
    def test_T_OPEN_04_missing_file_path_returns_400(self, client):
        """Missing file_path in request body → 400."""
        resp = client.post("/api/open", json={})
        assert resp.status_code == 400

    # T_OPEN_05 ---------------------------------------------------------------
    def test_T_OPEN_05_traversal_returns_400(self, client):
        """file_path outside ROOT_DIR (traversal) → 400 (§3.8)."""
        resp = client.post("/api/open", json={"file_path": "../../etc/passwd"})
        assert resp.status_code == 400

    # T_OPEN_06 ---------------------------------------------------------------
    def test_T_OPEN_06_nonexistent_file_returns_404(self, client):
        """file_path points to a non-existent file → 404."""
        resp = client.post("/api/open", json={"file_path": "ghost.txt"})
        assert resp.status_code == 404

    # T_OPEN_07 ---------------------------------------------------------------
    def test_T_OPEN_07_untouched_transitions_to_in_progress(self, client, tmp_path):
        """Status 'untouched' (no working copy) transitions to 'in_progress' on open."""
        self._make_original(tmp_path)
        resp = client.post("/api/open", json={"file_path": "sample.txt"})
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "in_progress"


# ===========================================================================
# Task 1.7 — TestApiWriteChar
# ⚠️ Highest-risk route in the app (ES §2.1, RULES.md §3.7).
# A silent failure causes the UI and the working copy to diverge.
# ===========================================================================


class TestApiWriteChar:
    """Tests for POST /api/write_char."""

    @pytest.fixture()
    def arabic_setup(self, tmp_path):
        """Original + working copy with the known DIAC_WORD fixture.

        File layout:
            tmp_path/sample.txt      ← original (DIAC_LINE)
            tmp_path/diac_sample.txt ← working copy (byte-for-byte copy)
        """
        orig = tmp_path / "sample.txt"
        wc = tmp_path / "diac_sample.txt"
        orig.write_text(DIAC_LINE, encoding="utf-8")
        shutil.copy2(orig, wc)
        return orig, wc

    # T_WC_01 -----------------------------------------------------------------
    def test_T_WC_01_valid_write_returns_ok(self, client, arabic_setup, tmp_path):
        """Valid write → 200 {"ok": true}; working copy bytes changed; original intact.

        Invariant §3.1: original file must be byte-identical after write.
        """
        orig, wc = arabic_setup
        orig_bytes = orig.read_bytes()
        wc_bytes_before = wc.read_bytes()

        resp = client.post(
            "/api/write_char",
            json={
                "file_path": "sample.txt",
                "line_idx": 0,
                "word_idx": 0,
                "char_idx": 0,
                "new_cluster": "ب",  # strip fatha from بَ → ب
            },
        )
        assert resp.status_code == 200
        assert resp.get_json()["ok"] is True
        # Working copy must have changed
        assert wc.read_bytes() != wc_bytes_before
        # §3.1: original must be unchanged
        assert orig.read_bytes() == orig_bytes, "§3.1 violated — original was modified"

    # T_WC_02 -----------------------------------------------------------------
    def test_T_WC_02_missing_field_returns_400(self, client):
        """One or more required fields absent → 400."""
        resp = client.post(
            "/api/write_char",
            json={
                "file_path": "sample.txt",
                "line_idx": 0,
                # word_idx, char_idx, new_cluster all missing
            },
        )
        assert resp.status_code == 400

    # T_WC_03 -----------------------------------------------------------------
    def test_T_WC_03_traversal_returns_400(self, client):
        """file_path outside ROOT_DIR → 400 (§3.8)."""
        resp = client.post(
            "/api/write_char",
            json={
                "file_path": "../../etc/passwd",
                "line_idx": 0,
                "word_idx": 0,
                "char_idx": 0,
                "new_cluster": "ب",
            },
        )
        assert resp.status_code == 400

    # T_WC_04 -----------------------------------------------------------------
    def test_T_WC_04_no_working_copy_returns_400(self, client, tmp_path):
        """Working copy absent (original exists, no diac_ copy) → 400."""
        (tmp_path / "sample.txt").write_text(DIAC_LINE, encoding="utf-8")
        # Deliberately do NOT create diac_sample.txt
        resp = client.post(
            "/api/write_char",
            json={
                "file_path": "sample.txt",
                "line_idx": 0,
                "word_idx": 0,
                "char_idx": 0,
                "new_cluster": "ب",
            },
        )
        assert resp.status_code == 400

    # T_WC_05 -----------------------------------------------------------------
    def test_T_WC_05_line_idx_out_of_range_returns_400(self, client, arabic_setup):
        """line_idx beyond file length → 400 (IndexError from engine)."""
        resp = client.post(
            "/api/write_char",
            json={
                "file_path": "sample.txt",
                "line_idx": 9999,
                "word_idx": 0,
                "char_idx": 0,
                "new_cluster": "ب",
            },
        )
        assert resp.status_code == 400

    # T_WC_06 -----------------------------------------------------------------
    def test_T_WC_06_word_idx_out_of_range_returns_400(self, client, arabic_setup):
        """word_idx beyond words on the line → 400."""
        resp = client.post(
            "/api/write_char",
            json={
                "file_path": "sample.txt",
                "line_idx": 0,
                "word_idx": 999,
                "char_idx": 0,
                "new_cluster": "ب",
            },
        )
        assert resp.status_code == 400

    # T_WC_07 -----------------------------------------------------------------
    def test_T_WC_07_char_idx_out_of_range_returns_400(self, client, arabic_setup):
        """char_idx beyond clusters in the word → 400."""
        resp = client.post(
            "/api/write_char",
            json={
                "file_path": "sample.txt",
                "line_idx": 0,
                "word_idx": 0,
                "char_idx": 999,
                "new_cluster": "ب",
            },
        )
        assert resp.status_code == 400

    # T_WC_08 -----------------------------------------------------------------
    def test_T_WC_08_byte_preservation_contract(self, client, arabic_setup, tmp_path):
        """After a write, untouched clusters on the edited line are byte-identical.

        Invariant §3.2: canonical_cluster() is called ONLY on the mutated cluster.
        Untouched clusters must be written back verbatim.

        Fixture:  DIAC_WORD = "بَيْتٌ"
        Clusters: [بَ (idx 0), يْ (idx 1), تٌ (idx 2)]
        Edit:     char_idx 0 → bare "ب"
        Assert:   bytes of clusters at idx 1 and 2 are byte-identical before and after.
        """
        orig, wc = arabic_setup

        # Capture bytes of the two untouched clusters (idx 1 and 2) before the write
        clusters_before = regex.findall(r"\X", DIAC_WORD)
        assert len(clusters_before) == 3, (
            f"Fixture precondition: expected 3 clusters in {DIAC_WORD!r}, "
            f"got {len(clusters_before)}"
        )
        untouched_before = [c.encode("utf-8") for c in clusters_before[1:]]

        # Write: strip fatha from cluster 0 (بَ → ب)
        resp = client.post(
            "/api/write_char",
            json={
                "file_path": "sample.txt",
                "line_idx": 0,
                "word_idx": 0,
                "char_idx": 0,
                "new_cluster": "ب",
            },
        )
        assert resp.status_code == 200

        # Read back and compare bytes of clusters 1 and 2
        result_text = wc.read_bytes().decode("utf-8")
        result_word = result_text.splitlines()[0]  # strip trailing newline
        clusters_after = regex.findall(r"\X", result_word)
        assert len(clusters_after) == 3
        untouched_after = [c.encode("utf-8") for c in clusters_after[1:]]

        assert untouched_before == untouched_after, (
            "§3.2 byte-preservation contract violated: "
            f"expected {[b.hex() for b in untouched_before]}, "
            f"got {[b.hex() for b in untouched_after]}"
        )


# ===========================================================================
# Task 1.8 — TestApiSaveCursor
# ===========================================================================


class TestApiSaveCursor:
    """Tests for POST /api/save_cursor.

    Critical invariant: only 'line', 'word', 'char' are merged from the
    incoming payload.  'status' and 'last_seen_mtime' must not be overwritten
    by the frontend — they are updated by the server's own logic only.
    """

    @pytest.fixture()
    def open_file(self, client, tmp_path):
        """Open sample.txt so a working copy + sidecar exist."""
        (tmp_path / "sample.txt").write_text(SAMPLE_TEXT, encoding="utf-8")
        client.post("/api/open", json={"file_path": "sample.txt"})
        return "sample.txt"

    # T_SC_01 -----------------------------------------------------------------
    def test_T_SC_01_valid_cursor_saved(self, client, open_file, tmp_path):
        """Valid cursor payload → sidecar updated with line/word/char."""
        resp = client.post(
            "/api/save_cursor",
            json={
                "file_path": open_file,
                "cursor": {"line": 1, "word": 2, "char": None},
            },
        )
        assert resp.status_code == 200
        assert resp.get_json()["ok"] is True

        sidecar = tmp_path / "diac_sample.txt.diac_cursor.json"
        saved = json.loads(sidecar.read_text(encoding="utf-8"))
        assert saved["line"] == 1
        assert saved["word"] == 2
        assert saved["char"] is None

    # T_SC_02 -----------------------------------------------------------------
    def test_T_SC_02_status_not_overwritten_by_payload(
        self, client, open_file, tmp_path
    ):
        """Payload 'status' field is ignored — sidecar status remains 'in_progress'.

        The /api/open call sets status to 'in_progress'.  Sending status='complete'
        in the cursor payload must not overwrite it.  Only /api/mark_complete may
        change status to 'complete'.
        """
        resp = client.post(
            "/api/save_cursor",
            json={
                "file_path": open_file,
                "cursor": {"line": 0, "word": 0, "char": None, "status": "complete"},
            },
        )
        assert resp.status_code == 200

        sidecar = tmp_path / "diac_sample.txt.diac_cursor.json"
        saved = json.loads(sidecar.read_text(encoding="utf-8"))
        assert saved["status"] == "in_progress", (
            "save_cursor must not allow the frontend to set status='complete' "
            f"directly; got {saved['status']!r}"
        )

    # T_SC_03 -----------------------------------------------------------------
    def test_T_SC_03_last_seen_mtime_set_from_wc_not_payload(
        self, client, open_file, tmp_path
    ):
        """last_seen_mtime is set from wc.stat().st_mtime, not from payload.

        The route merges only 'line', 'word', 'char'.  Even if the payload
        sends 'last_seen_mtime': 0.0, the sidecar must contain the actual
        working copy mtime, not 0.0.
        """
        wc = tmp_path / "diac_sample.txt"
        wc_mtime = wc.stat().st_mtime  # capture before the call

        resp = client.post(
            "/api/save_cursor",
            json={
                "file_path": open_file,
                "cursor": {"line": 0, "word": 0, "char": None, "last_seen_mtime": 0.0},
            },
        )
        assert resp.status_code == 200

        sidecar = tmp_path / "diac_sample.txt.diac_cursor.json"
        saved = json.loads(sidecar.read_text(encoding="utf-8"))

        # The saved mtime must be close to the real wc mtime — not 0.0
        assert saved.get("last_seen_mtime") is not None
        assert abs(saved["last_seen_mtime"] - wc_mtime) < 1.0, (
            f"last_seen_mtime was overwritten by payload (got {saved['last_seen_mtime']!r}, "
            f"expected ~{wc_mtime!r})"
        )

    # T_SC_04 -----------------------------------------------------------------
    def test_T_SC_04_missing_required_fields_returns_400(self, client):
        """Missing file_path → 400; missing cursor → 400."""
        resp_a = client.post(
            "/api/save_cursor",
            json={
                "cursor": {"line": 0, "word": 0, "char": None},
                # file_path absent
            },
        )
        assert resp_a.status_code == 400

        resp_b = client.post(
            "/api/save_cursor",
            json={
                "file_path": "sample.txt",
                # cursor absent
            },
        )
        assert resp_b.status_code == 400


# ===========================================================================
# Task 1.9 — TestApiMarkComplete
# ===========================================================================


class TestApiMarkComplete:
    """Tests for POST /api/mark_complete."""

    @pytest.fixture()
    def open_file(self, client, tmp_path):
        """Open sample.txt to create working copy; return (rel_path, orig, wc)."""
        orig = tmp_path / "sample.txt"
        orig.write_text(SAMPLE_TEXT, encoding="utf-8")
        client.post("/api/open", json={"file_path": "sample.txt"})
        wc = tmp_path / "diac_sample.txt"
        return "sample.txt", orig, wc

    # T_MC_01 -----------------------------------------------------------------
    def test_T_MC_01_happy_path(self, client, open_file, tmp_path):
        """Output file at _diac_output/sample.txt; sidecar → complete; original intact.

        Invariant §3.1: original unchanged after mark_complete.
        """
        path_str, orig, wc = open_file
        orig_bytes = orig.read_bytes()
        wc_bytes = wc.read_bytes()

        resp = client.post("/api/mark_complete", json={"file_path": path_str})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["ok"] is True
        assert body["output_path"] == "sample.txt"

        output = tmp_path / "_diac_output" / "sample.txt"
        assert output.exists(), "_diac_output/sample.txt must exist after mark_complete"
        # Byte-exact copy of the working copy
        assert output.read_bytes() == wc_bytes
        # §3.1: original untouched
        assert (
            orig.read_bytes() == orig_bytes
        ), "§3.1 — original modified by mark_complete"
        # Sidecar status must be 'complete'
        sidecar = tmp_path / "diac_sample.txt.diac_cursor.json"
        saved = json.loads(sidecar.read_text(encoding="utf-8"))
        assert saved["status"] == "complete"

    # T_MC_02 -----------------------------------------------------------------
    def test_T_MC_02_subdirectory_mirrored(self, client, tmp_path):
        """subdir/sample.txt → _diac_output/subdir/sample.txt (spec §2.4)."""
        sub = tmp_path / "subdir"
        sub.mkdir()
        (sub / "sample.txt").write_text(SAMPLE_TEXT, encoding="utf-8")
        client.post("/api/open", json={"file_path": "subdir/sample.txt"})

        resp = client.post(
            "/api/mark_complete", json={"file_path": "subdir/sample.txt"}
        )
        assert resp.status_code == 200
        output = tmp_path / "_diac_output" / "subdir" / "sample.txt"
        assert (
            output.exists()
        ), "Subdirectory structure must be mirrored under _diac_output/"

    # T_MC_03 -----------------------------------------------------------------
    def test_T_MC_03_no_working_copy_returns_400(self, client, tmp_path):
        """Working copy absent → 400 (no crash)."""
        (tmp_path / "sample.txt").write_text(SAMPLE_TEXT, encoding="utf-8")
        # Deliberately do NOT create working copy
        resp = client.post("/api/mark_complete", json={"file_path": "sample.txt"})
        assert resp.status_code == 400

    # T_MC_04 -----------------------------------------------------------------
    def test_T_MC_04_traversal_returns_400(self, client):
        """file_path outside ROOT_DIR → 400 (§3.8)."""
        resp = client.post("/api/mark_complete", json={"file_path": "../../etc/passwd"})
        assert resp.status_code == 400


# ===========================================================================
# Task 1.10 — TestApiReset
# ===========================================================================


class TestApiReset:
    """Tests for POST /api/reset.

    Critical: _diac_output/ must NOT be affected by reset.
    """

    @pytest.fixture()
    def open_file(self, client, tmp_path):
        """Open sample.txt to create working copy + sidecar; return orig Path."""
        orig = tmp_path / "sample.txt"
        orig.write_text(SAMPLE_TEXT, encoding="utf-8")
        client.post("/api/open", json={"file_path": "sample.txt"})
        return orig

    # T_RST_01 ----------------------------------------------------------------
    def test_T_RST_01_happy_path(self, client, open_file, tmp_path):
        """Working copy and sidecar deleted; response {"status": "untouched"}.

        Invariant §3.1: original file must be present and unchanged after reset.
        """
        orig = open_file
        orig_bytes = orig.read_bytes()
        wc = tmp_path / "diac_sample.txt"
        sidecar = tmp_path / "diac_sample.txt.diac_cursor.json"
        assert wc.exists()
        assert sidecar.exists()

        resp = client.post("/api/reset", json={"file_path": "sample.txt"})
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "untouched"
        assert not wc.exists(), "Working copy must be deleted by reset"
        assert not sidecar.exists(), "Cursor sidecar must be deleted by reset"
        # §3.1: original must be untouched
        assert orig.read_bytes() == orig_bytes, "§3.1 — original modified by reset"

    # T_RST_02 ----------------------------------------------------------------
    def test_T_RST_02_diac_output_not_deleted(self, client, open_file, tmp_path):
        """_diac_output/ copy is NOT deleted or modified by reset."""
        # Mark complete first to create the output file
        client.post("/api/mark_complete", json={"file_path": "sample.txt"})
        output = tmp_path / "_diac_output" / "sample.txt"
        assert output.exists()
        output_bytes = output.read_bytes()

        resp = client.post("/api/reset", json={"file_path": "sample.txt"})
        assert resp.status_code == 200
        # Output file must still exist and be byte-identical
        assert output.exists(), "_diac_output/ copy must not be deleted by reset"
        assert (
            output.read_bytes() == output_bytes
        ), "_diac_output/ copy bytes changed after reset"

    # T_RST_03 ----------------------------------------------------------------
    def test_T_RST_03_idempotent_no_working_copy(self, client, tmp_path):
        """Reset when no working copy exists → 200, no crash (idempotent)."""
        (tmp_path / "sample.txt").write_text(SAMPLE_TEXT, encoding="utf-8")
        # No working copy created
        resp = client.post("/api/reset", json={"file_path": "sample.txt"})
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "untouched"

    # T_RST_04 ----------------------------------------------------------------
    def test_T_RST_04_traversal_returns_400(self, client):
        """file_path outside ROOT_DIR → 400 (§3.8)."""
        resp = client.post("/api/reset", json={"file_path": "../../etc/passwd"})
        assert resp.status_code == 400
