"""
app.py — Arabic Diacritics Editor, Phase 1
==========================================
Flask scaffold implementing Tasks 1.1–1.5 (Plan v1.1).

Routes
------
GET  /                   → serves index.html
GET  /api/config         → returns keymap.json contents           (Task 1.1)
GET  /api/files          → returns file tree with statuses        (Task 1.2)
POST /api/open           → creates working copy, returns content  (Task 1.3)
POST /api/write_char     → mutates one grapheme cluster           (Task 1.4)
POST /api/save_cursor    → writes cursor sidecar (debounced)      (Task 1.5)
POST /api/mark_complete  → copies working copy to _diac_output/  (Task 1.5)
POST /api/reset          → deletes working copy + sidecar        (Task 1.5)

Configuration
-------------
Set ROOT_DIR via the TASHKEEL_ROOT environment variable to point the app
at your Arabic text files:

    Windows:    set TASHKEEL_ROOT=C:\\path\\to\\your\\texts && python app.py
    macOS/Linux: TASHKEEL_ROOT=/path/to/texts python app.py

Default: the current working directory (i.e. the TASHKEEL/ project folder
when launched from there during development).

Non-destructive contract (spec §2)
-----------------------------------
The original source file is NEVER modified.  All edits go to the diac_
working copy in the same directory as the original.  The working copy IS
the persistent state — no undo stack, no save button.

Unicode normalization policy (spec §10.1)
------------------------------------------
No global NFC/NFD/NFKC/NFKD normalization is applied anywhere in this
module.  Files are read as raw bytes and decoded to str via .decode("utf-8")
with no additional processing.  The write_character() engine in
diacritic_engine.py enforces the same policy.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from diacritic_engine import write_character

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Set TASHKEEL_ROOT to the root of your text files.
# During development this defaults to the project directory (TASHKEEL/).
ROOT_DIR: Path = Path(os.environ.get("TASHKEEL_ROOT", Path.cwd())).resolve()

# keymap.json lives alongside app.py, not inside ROOT_DIR.
KEYMAP_PATH: Path = Path(__file__).parent / "keymap.json"

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def _resolve_safe(rel_path: str) -> Path:
    """Resolve a user-supplied relative path inside ROOT_DIR.

    Raises ValueError if the resolved absolute path escapes ROOT_DIR.
    Always use this function — never ROOT_DIR / rel_path directly — for
    any path that arrives from a network request.
    """
    target = (ROOT_DIR / rel_path).resolve()
    # relative_to() raises ValueError if target is outside ROOT_DIR
    target.relative_to(ROOT_DIR)
    return target


def _working_copy_path(original: Path) -> Path:
    """Return the diac_ working copy path for an original file.

    spec §2.1: prepend 'diac_' to the filename in the same directory.
    Example: /project/chapter_1.txt → /project/diac_chapter_1.txt
    """
    return original.parent / f"diac_{original.name}"


def _cursor_sidecar_path(original: Path) -> Path:
    """Return the cursor sidecar path for an original file.

    spec §2.2: <working_copy>.diac_cursor.json alongside the working copy.
    Example: /project/diac_chapter_1.txt.diac_cursor.json
    """
    wc = _working_copy_path(original)
    return wc.parent / f"{wc.name}.diac_cursor.json"


# ---------------------------------------------------------------------------
# Cursor sidecar helpers
# ---------------------------------------------------------------------------

_DEFAULT_CURSOR: dict = {
    "line": 0,
    "word": 0,
    "char": None,
    "status": "in_progress",
    "last_seen_mtime": None,
}


def _read_cursor(original: Path) -> dict:
    """Read cursor sidecar; return defaults if the file is absent or corrupt."""
    sidecar = _cursor_sidecar_path(original)
    if sidecar.exists():
        try:
            data = json.loads(sidecar.read_text(encoding="utf-8"))
            # Merge with defaults so any missing key is always present.
            return {**_DEFAULT_CURSOR, **data}
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULT_CURSOR)


def _write_cursor(original: Path, cursor: dict) -> None:
    """Write cursor sidecar via a write-then-rename for atomicity.

    On Windows, Path.replace() on an existing destination raises OSError;
    use os.replace() which is atomic even on Windows NTFS.
    """
    sidecar = _cursor_sidecar_path(original)
    tmp = sidecar.with_suffix(".tmp")
    tmp.write_text(json.dumps(cursor, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, sidecar)


# ---------------------------------------------------------------------------
# File tree helpers — Task 1.2
# ---------------------------------------------------------------------------

_ELIGIBLE_SUFFIXES: frozenset[str] = frozenset({".txt", ".md"})

# The _diac_output subtree — resolved once at import time to avoid repeated
# Path construction inside the hot rglob loop.
_OUTPUT_DIR: Path = ROOT_DIR / "_diac_output"


def get_file_status(original: Path) -> str:
    """Return 'untouched' | 'in_progress' | 'complete'.

    Status logic (spec §11):
    - No working copy → 'untouched'
    - Working copy exists + sidecar status == 'complete' → 'complete'
    - Working copy exists, anything else → 'in_progress'
    """
    wc = _working_copy_path(original)
    if not wc.exists():
        return "untouched"
    cursor = _read_cursor(original)
    if cursor.get("status") == "complete":
        return "complete"
    return "in_progress"


def scan_directory(root: Path) -> list[dict]:
    """Recursively scan root for eligible source files.

    Inclusion:
        .txt and .md files only.

    Exclusion rules (spec §3):
        - Anything inside _diac_output/
        - Files with the 'diac_' prefix (working copies)
        - Files whose name ends with .diac_cursor.json (cursor sidecars)

    Returns a sorted list of dicts: [{path, status}, ...]
    where path is always a POSIX-style relative path (forward slashes).
    """
    results: list[dict] = []
    output_dir = root / "_diac_output"

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue

        # Exclude _diac_output/ subtree
        try:
            path.relative_to(output_dir)
            continue  # path is inside _diac_output — skip
        except ValueError:
            pass

        # Exclude working copies
        if path.name.startswith("diac_"):
            continue

        # Exclude cursor sidecar files
        if path.name.endswith(".diac_cursor.json"):
            continue

        # Eligible extension only
        if path.suffix not in _ELIGIBLE_SUFFIXES:
            continue

        rel = path.relative_to(root)
        results.append({
            "path": rel.as_posix(),   # always forward slashes — cross-platform
            "status": get_file_status(path),
        })

    return results


# ---------------------------------------------------------------------------
# Working copy helpers — Task 1.3
# ---------------------------------------------------------------------------

def ensure_working_copy(original: Path) -> Path:
    """Create the diac_ working copy if it does not already exist.

    Uses shutil.copy2 for a byte-for-byte duplicate with metadata preserved.
    Once created, the original is never read again (Plan §Task 1.3 key decision).
    """
    wc = _working_copy_path(original)
    if not wc.exists():
        shutil.copy2(original, wc)
    return wc


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# --- Task 1.1: Config -------------------------------------------------------

@app.route("/api/config")
def api_config():
    """Return keymap.json for the frontend to wire custom key bindings."""
    if KEYMAP_PATH.exists():
        try:
            keymap = json.loads(KEYMAP_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            app.logger.warning("keymap.json unreadable: %s", exc)
            keymap = {}
    else:
        keymap = {}
    return jsonify({"keymap": keymap})


# --- Task 1.2: File tree ----------------------------------------------------

@app.route("/api/files")
def api_files():
    """Return sorted list of eligible files with their statuses."""
    files = scan_directory(ROOT_DIR)
    return jsonify({"files": files})


# --- Task 1.3: Working copy contract ----------------------------------------

@app.route("/api/open", methods=["POST"])
def api_open():
    """Open a file: create working copy if needed, return content + cursor.

    Request body
    ------------
    {"file_path": "relative/path/to/file.txt"}

    Response (200)
    --------------
    {
        "lines":             [...],     // lines array (no line endings)
        "cursor":            {...},     // restored or default cursor
        "status":            "...",     // 'untouched'|'in_progress'|'complete'
        "conflict_detected": false      // true if mtime changed externally
    }

    mtime conflict detection (spec §2.5 / OQ5)
    -------------------------------------------
    On open, the working copy's current mtime is compared against the
    last_seen_mtime stored in the cursor sidecar.  A difference > 0.01s
    means the file was modified externally between sessions.
    The app continues normally — this is a non-blocking informational flag.
    The frontend surfaces a non-blocking warning banner (Phase 2).
    """
    data = request.get_json(silent=True) or {}
    rel = data.get("file_path")
    if not rel:
        return jsonify({"error": "file_path is required"}), 400

    try:
        original = _resolve_safe(rel)
    except ValueError:
        return jsonify({"error": "file_path is outside ROOT_DIR"}), 400

    if not original.exists():
        return jsonify({"error": f"file not found: {rel}"}), 404

    # Create working copy if absent (spec §2.1)
    wc = ensure_working_copy(original)

    # Read working copy — no normalisation (spec §10.1)
    try:
        raw = wc.read_bytes().decode("utf-8")
    except UnicodeDecodeError as exc:
        return jsonify({"error": f"UTF-8 decode failed: {exc}"}), 500

    # Split into lines without endings — the frontend doesn't need \r\n
    lines = raw.splitlines()

    # Restore cursor sidecar (spec §2.3)
    cursor = _read_cursor(original)

    # mtime conflict detection (spec §2.5)
    current_mtime = wc.stat().st_mtime
    conflict = False
    last_mtime = cursor.get("last_seen_mtime")
    if last_mtime is not None and abs(current_mtime - last_mtime) > 0.01:
        conflict = True
        app.logger.info("mtime conflict detected for %s (stored=%.3f, current=%.3f)",
                        rel, last_mtime, current_mtime)

    # Update last_seen_mtime for this session (spec §2.5)
    cursor["last_seen_mtime"] = current_mtime

    # Transition untouched → in_progress on first open
    if cursor.get("status") == "untouched":
        cursor["status"] = "in_progress"

    _write_cursor(original, cursor)

    return jsonify({
        "lines":             lines,
        "cursor":            cursor,
        "status":            cursor.get("status", "in_progress"),
        "conflict_detected": conflict,
    })


# --- Task 1.4: Diacritic write endpoint (as Flask endpoint) -----------------

@app.route("/api/write_char", methods=["POST"])
def api_write_char():
    """Mutate a single grapheme cluster in the working copy.

    Request body
    ------------
    {
        "file_path":   "relative/path/to/file.txt",
        "line_idx":    0,        // 0-based line index
        "word_idx":    0,        // 0-based word index on that line
        "char_idx":    0,        // 0-based grapheme cluster index in that word
        "new_cluster": "بَ"     // replacement cluster, already in canonical order
    }

    Response (200)
    --------------
    {"ok": true}

    Failure contract (Plan §Task 1.4)
    ----------------------------------
    ANY non-200 response from this endpoint is a fatal condition.
    The frontend MUST surface a blocking error banner and halt all further
    input until the user explicitly acknowledges.  A failed write that goes
    unnoticed causes the UI and the working copy to diverge silently — this
    is the worst failure mode in the entire app.
    """
    data = request.get_json(silent=True) or {}

    required = {"file_path", "line_idx", "word_idx", "char_idx", "new_cluster"}
    missing = required - data.keys()
    if missing:
        return jsonify({"error": f"missing fields: {sorted(missing)}"}), 400

    try:
        original = _resolve_safe(data["file_path"])
    except ValueError:
        return jsonify({"error": "file_path is outside ROOT_DIR"}), 400

    wc = _working_copy_path(original)
    if not wc.exists():
        return jsonify({
            "error": "working copy not found — call /api/open first"
        }), 400

    try:
        write_character(
            working_copy=wc,
            line_idx=int(data["line_idx"]),
            word_idx=int(data["word_idx"]),
            char_idx=int(data["char_idx"]),
            new_cluster=data["new_cluster"],
        )
    except IndexError as exc:
        return jsonify({"error": str(exc)}), 400
    except (ValueError, UnicodeDecodeError) as exc:
        return jsonify({"error": str(exc)}), 400
    except OSError as exc:
        return jsonify({"error": f"file write failed: {exc}"}), 500

    return jsonify({"ok": True})


# --- Task 1.5: Cursor save + status transitions ----------------------------

@app.route("/api/save_cursor", methods=["POST"])
def api_save_cursor():
    """Persist cursor position to the sidecar file.

    Called by the frontend at 500ms debounce after cursor moves,
    immediately on file-switch, and immediately on page unload (spec §10).

    Request body
    ------------
    {
        "file_path": "relative/path/to/file.txt",
        "cursor":    {"line": N, "word": N, "char": null}
    }

    Only the fields "line", "word", "char" from the incoming cursor are
    applied.  The "status" and "last_seen_mtime" fields are preserved from
    the existing sidecar — the frontend must never overwrite those via this
    endpoint (use /api/mark_complete or /api/reset for status changes).
    """
    data = request.get_json(silent=True) or {}
    rel = data.get("file_path")
    incoming = data.get("cursor")

    if not rel or not isinstance(incoming, dict):
        return jsonify({"error": "file_path and cursor object are required"}), 400

    try:
        original = _resolve_safe(rel)
    except ValueError:
        return jsonify({"error": "file_path is outside ROOT_DIR"}), 400

    # Merge incoming position into existing sidecar
    cursor = _read_cursor(original)
    for key in ("line", "word", "char"):
        if key in incoming:
            cursor[key] = incoming[key]

    # Update last_seen_mtime from the working copy (spec §2.5)
    wc = _working_copy_path(original)
    if wc.exists():
        cursor["last_seen_mtime"] = wc.stat().st_mtime

    _write_cursor(original, cursor)
    return jsonify({"ok": True})


@app.route("/api/mark_complete", methods=["POST"])
def api_mark_complete():
    """Copy working copy to _diac_output/ and set status to 'complete'.

    spec §12 / Plan §Task 1.5.

    The output file uses the original filename (no diac_ prefix) and
    mirrors the subdirectory structure under _diac_output/ (spec §2.4).

    Request body
    ------------
    {"file_path": "relative/path/to/file.txt"}

    Response (200)
    --------------
    {"ok": true, "output_path": "relative/path/to/file.txt"}

    Failure (500)
    -------------
    {"error": "output write failed: ..."} — frontend must show blocking
    error modal and revert status to in_progress (spec §12 failure mode).
    """
    data = request.get_json(silent=True) or {}
    rel = data.get("file_path")
    if not rel:
        return jsonify({"error": "file_path is required"}), 400

    try:
        original = _resolve_safe(rel)
    except ValueError:
        return jsonify({"error": "file_path is outside ROOT_DIR"}), 400

    wc = _working_copy_path(original)
    if not wc.exists():
        return jsonify({"error": "working copy not found"}), 400

    # Mirror directory structure under _diac_output/ (spec §2.4)
    rel_original = original.relative_to(ROOT_DIR)
    output_path = ROOT_DIR / "_diac_output" / rel_original

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(wc, output_path)
    except OSError as exc:
        return jsonify({"error": f"output write failed: {exc}"}), 500

    # Update sidecar: status → complete, mtime updated
    cursor = _read_cursor(original)
    cursor["status"] = "complete"
    cursor["last_seen_mtime"] = wc.stat().st_mtime
    _write_cursor(original, cursor)

    return jsonify({
        "ok": True,
        "output_path": rel_original.as_posix(),
    })


@app.route("/api/reset", methods=["POST"])
def api_reset():
    """Delete the working copy and cursor sidecar (spec §13 / Plan §Task 1.5).

    _diac_output/ is NOT affected by Reset.

    Request body
    ------------
    {"file_path": "relative/path/to/file.txt"}

    Response (200)
    --------------
    {"status": "untouched"}
    """
    data = request.get_json(silent=True) or {}
    rel = data.get("file_path")
    if not rel:
        return jsonify({"error": "file_path is required"}), 400

    try:
        original = _resolve_safe(rel)
    except ValueError:
        return jsonify({"error": "file_path is outside ROOT_DIR"}), 400

    wc = _working_copy_path(original)
    sidecar = _cursor_sidecar_path(original)

    if wc.exists():
        wc.unlink()
    if sidecar.exists():
        sidecar.unlink()

    return jsonify({"status": "untouched"})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.logger.info("ROOT_DIR: %s", ROOT_DIR)
    app.logger.info("KEYMAP:   %s", KEYMAP_PATH)
    app.run(debug=True, host="127.0.0.1", port=5000)
