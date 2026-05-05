import os
import re
import json
import datetime
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

ELIGIBLE_EXTENSIONS = {".txt", ".md"}


# ── Helpers ──────────────────────────────────────────────────────────────────


def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_config(data):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def sidecar_path(file_path):
    return file_path + ".proof.json"


def read_sidecar(file_path):
    sc = sidecar_path(file_path)
    if not os.path.exists(sc):
        return None
    try:
        with open(sc, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        print(f"[WARN] Malformed sidecar, treating as missing: {sc}")
        return None


def file_status(file_path):
    sc = read_sidecar(file_path)
    if sc is None:
        return "untouched"
    return "complete" if sc.get("status") == "complete" else "in_progress"


def is_eligible(filename):
    _, ext = os.path.splitext(filename)
    return ext.lower() in ELIGIBLE_EXTENSIONS


def is_sidecar(filename):
    return ".proof.json" in filename


def scan_directory(folder):
    """Recursively scan folder and return tree list."""
    entries = []
    try:
        items = sorted(
            os.scandir(folder), key=lambda e: (not e.is_dir(), e.name.lower())
        )
    except PermissionError:
        return entries

    for item in items:
        if item.name.startswith("."):
            continue
        if is_sidecar(item.name):
            continue
        # Skip the _proof_output directory entirely at any nesting level
        if item.is_dir(follow_symlinks=False) and item.name == "_proof_output":
            continue

        if item.is_dir(follow_symlinks=False):
            children = scan_directory(item.path)
            if children:  # only include folder if it has eligible files
                entries.append(
                    {
                        "type": "folder",
                        "name": item.name,
                        "path": item.path,
                        "children": children,
                    }
                )
        elif item.is_file() and is_eligible(item.name):
            entries.append(
                {
                    "type": "file",
                    "name": item.name,
                    "path": item.path,
                    "status": file_status(item.path),
                }
            )

    return entries


def tokenize_lines(text):
    """Split text into lines, then each line into words (for index purposes).

    Empty lines are preserved as empty lists.
    Words are split by whitespace only; punctuation and diacritics are kept.
    """
    lines = text.split("\n")
    result = []
    for line in lines:
        words = [w for w in line.split() if w]
        result.append(words)
    return result


def generate_annotated_copy(content, flagged):
    """Return the source content with flagged words wrapped in <edit>...</edit>.

    Whitespace is preserved exactly — the output is a byte-for-byte match of the
    source except for the inserted <edit> tags around flagged words.

    Algorithm (§11):
      For each line, use re.split(r'(\\s+)', line) to get alternating
      [word, whitespace, word, whitespace, ...] chunks.
      Increment word_index only on non-whitespace chunks.
      Wrap flagged chunks; rejoin without adding any extra whitespace.
    """
    raw_lines = content.split("\n")
    annotated_lines = []

    for line_idx, line in enumerate(raw_lines):
        if line == "":
            annotated_lines.append("")
            continue

        # re.split with a capturing group yields alternating text/whitespace chunks
        chunks = re.split(r"(\s+)", line)
        word_index = 0
        flagged_indices = set(flagged.get(str(line_idx), []))
        out_chunks = []

        for chunk in chunks:
            if chunk == "":
                # split artefact at start/end — skip
                continue
            if re.match(r"\s+", chunk):
                # pure whitespace — pass through unchanged
                out_chunks.append(chunk)
            else:
                # this is a word token
                if word_index in flagged_indices:
                    out_chunks.append(f"<edit>{chunk}</edit>")
                else:
                    out_chunks.append(chunk)
                word_index += 1

        annotated_lines.append("".join(out_chunks))

    return "\n".join(annotated_lines)


def _resolve_proof_output_paths(source_path, project_root):
    """Return (output_dir_root, annotated_copy_dest) for the given source file."""
    proof_output_root = os.path.join(project_root, "_proof_output")
    rel_path = os.path.relpath(source_path, project_root)
    copy_dest = os.path.join(proof_output_root, rel_path)
    return proof_output_root, copy_dest


def _get_project_root(source_path):
    """Derive the project root from config.json; fall back to source file's dir."""
    cfg = load_config()
    project_root = cfg.get("last_folder") or os.path.dirname(source_path)
    try:
        rel = os.path.relpath(source_path, project_root)
        if rel.startswith(".."):
            project_root = os.path.dirname(source_path)
    except ValueError:
        # Different drives on Windows
        project_root = os.path.dirname(source_path)
    return project_root


# ── Routes ────────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify(load_config())


@app.route("/api/config", methods=["POST"])
def post_config():
    data = request.get_json(force=True)
    cfg = load_config()
    if "last_folder" in data:
        cfg["last_folder"] = data["last_folder"]
    if "last_open_file" in data:
        cfg["last_open_file"] = data["last_open_file"]
    save_config(cfg)
    return jsonify({"ok": True})


@app.route("/api/project")
def get_project():
    folder = request.args.get("folder", "").strip()
    if not folder:
        return jsonify({"error": "No folder specified"}), 400
    if not os.path.isdir(folder):
        return jsonify({"error": f"Folder not found: {folder}"}), 404

    tree = scan_directory(folder)
    return jsonify({"folder": folder, "tree": tree})


@app.route("/api/file")
def get_file():
    path = request.args.get("path", "").strip()
    if not path:
        return jsonify({"error": "No path specified"}), 400
    if not os.path.isfile(path):
        return jsonify({"error": f"File not found: {path}"}), 404
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return jsonify({"content": content})
    except OSError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/progress")
def get_progress():
    path = request.args.get("path", "").strip()
    if not path:
        return jsonify({"error": "No path specified"}), 400
    sc = read_sidecar(path)
    return jsonify(sc if sc else {})


@app.route("/api/progress", methods=["POST"])
def post_progress():
    data = request.get_json(force=True)
    source_path = data.get("source_path")
    if not source_path:
        return jsonify({"error": "No source_path in body"}), 400

    data["last_modified"] = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")

    sc = sidecar_path(source_path)
    try:
        with open(sc, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"ok": True})
    except OSError as e:
        return jsonify({"error": str(e)}), 500


# ── Atomic mark-complete ───────────────────────────────────────────────────────


@app.route("/api/complete", methods=["POST"])
def post_complete():
    """
    Atomically:
      1. Reads and tokenises the source file.
      2. Checks for line/word-count mismatch → 409 if detected.
      3. Writes the sidecar with status="complete".
      4. Writes the annotated copy to _proof_output/<rel_path>.
      5. If step 4 fails → restore previous sidecar content, return 500.

    Only ONE file is written to _proof_output/: the annotated copy.
    There is no separate report file (§11, §18).
    """
    data = request.get_json(force=True)
    source_path = data.get("source_path")
    cursor = data.get("cursor", {})
    flagged = data.get("flagged", {})

    if not source_path:
        return jsonify({"error": "No source_path in body"}), 400
    if not os.path.isfile(source_path):
        return jsonify({"error": "Source file not found"}), 404

    # Read source file
    try:
        with open(source_path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError as e:
        return jsonify({"error": str(e)}), 500

    lines = tokenize_lines(content)

    # Mismatch check — any flagged line key must be within bounds
    sidecar_line_keys = [int(k) for k in flagged.keys()] if flagged else []
    if sidecar_line_keys and max(sidecar_line_keys, default=-1) >= len(lines):
        return (
            jsonify(
                {
                    "error": (
                        "Source file appears to have been modified externally. "
                        "Line count mismatch detected."
                    )
                }
            ),
            409,
        )

    # Read previous sidecar content for rollback
    sc_path = sidecar_path(source_path)
    previous_sidecar_content = None
    sidecar_existed = os.path.exists(sc_path)
    if sidecar_existed:
        try:
            with open(sc_path, "r", encoding="utf-8") as f:
                previous_sidecar_content = f.read()
        except OSError:
            pass

    # Write sidecar with status=complete
    now = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    new_sidecar = {
        "source_path": source_path,
        "status": "complete",
        "cursor": cursor,
        "flagged": flagged,
        "last_modified": now,
    }
    try:
        with open(sc_path, "w", encoding="utf-8") as f:
            json.dump(new_sidecar, f, ensure_ascii=False, indent=2)
    except OSError as e:
        return jsonify({"error": f"Could not write sidecar: {e}"}), 500

    # Resolve output path
    project_root = _get_project_root(source_path)
    proof_output_root, copy_dest = _resolve_proof_output_paths(
        source_path, project_root
    )

    # Build annotated copy content
    annotated = generate_annotated_copy(content, flagged)

    # Rollback helper
    def rollback_sidecar():
        try:
            if previous_sidecar_content is not None:
                with open(sc_path, "w", encoding="utf-8") as f:
                    f.write(previous_sidecar_content)
            elif sidecar_existed is False:
                os.remove(sc_path)
        except OSError:
            pass

    # Write annotated copy — roll back sidecar on failure
    try:
        os.makedirs(os.path.dirname(copy_dest), exist_ok=True)
        with open(copy_dest, "w", encoding="utf-8") as f:
            f.write(annotated)
    except OSError as e:
        rollback_sidecar()
        return jsonify({"error": f"Could not write annotated copy: {e}"}), 500

    return jsonify({"ok": True, "annotated_copy_path": copy_dest})


# ── Export / re-generate annotated copy ───────────────────────────────────────


@app.route("/api/export")
def export_annotated_copy():
    """
    Re-generate the annotated copy for a completed document.
    Called by the "Download Annotated Copy" button in the complete banner.
    Returns { "annotated_copy_path": "..." }.
    """
    path = request.args.get("path", "").strip()
    if not path:
        return jsonify({"error": "No path specified"}), 400
    if not os.path.isfile(path):
        return jsonify({"error": "Source file not found"}), 404

    sc = read_sidecar(path)
    if not sc:
        return jsonify({"error": "No sidecar found for this file"}), 404

    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError as e:
        return jsonify({"error": str(e)}), 500

    lines = tokenize_lines(content)
    flagged = sc.get("flagged", {})

    # Mismatch check
    sidecar_line_keys = [int(k) for k in flagged.keys()] if flagged else []
    if sidecar_line_keys and max(sidecar_line_keys, default=-1) >= len(lines):
        return (
            jsonify(
                {
                    "error": (
                        "Source file appears to have been modified externally. "
                        "Line count mismatch detected. Annotated copy not written."
                    )
                }
            ),
            409,
        )

    project_root = _get_project_root(path)
    _, copy_dest = _resolve_proof_output_paths(path, project_root)

    annotated = generate_annotated_copy(content, flagged)

    try:
        os.makedirs(os.path.dirname(copy_dest), exist_ok=True)
        with open(copy_dest, "w", encoding="utf-8") as f:
            f.write(annotated)
        return jsonify({"annotated_copy_path": copy_dest})
    except OSError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/browse")
def browse_folder():
    """Open a native OS folder-picker dialog and return the chosen path."""
    try:
        import tkinter as tk
    except ImportError:
        return (
            jsonify(
                {
                    "error": (
                        "tkinter is not available in this Python environment. "
                        "Please type or paste the folder path manually."
                    )
                }
            ),
            200,
        )

    try:
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.call("wm", "attributes", ".", "-topmost", True)
        chosen = filedialog.askdirectory(title="Select Project Folder")
        root.destroy()
        if not chosen:
            return jsonify({"cancelled": True})
        return jsonify({"path": chosen})
    except Exception as e:
        return (
            jsonify(
                {
                    "error": (
                        f"Could not open folder picker: {e}. "
                        "Please type or paste the folder path manually."
                    )
                }
            ),
            200,
        )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
