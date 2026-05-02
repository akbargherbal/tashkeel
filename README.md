# Arabic Diacritics Editor (Tashkeel)

A locally-run, keyboard-centric web application for adding and correcting Arabic
diacritics (tashkeel / harakat) in plain-text files.

**Browser requirement: Google Chrome 87+** — Firefox and Safari are not
supported. The app uses `Intl.Segmenter` with grapheme granularity, which
requires a modern Chromium engine.

---

## Install

```bash
# 1. Clone or download the repository
git clone <repo-url> TASHKEEL
cd TASHKEEL/src

# 2. Install Python dependencies
pip install flask regex pytest

# 3. (Optional) Verify Intl.Segmenter is available in your Chrome console:
#    new Intl.Segmenter('ar', { granularity: 'grapheme' })
#    Should return a Segmenter object without error.
```

---

## Launch

```bash
# From the src/ directory:
python app.py
```

Then open **http://127.0.0.1:5000** in Chrome.

### Pointing at a different text directory

By default the app scans the current working directory for `.txt` and `.md`
files. Set `TASHKEEL_ROOT` to point at a different folder:

```bash
# Windows
set TASHKEEL_ROOT=C:\Users\you\manuscripts && python app.py

# macOS / Linux
TASHKEEL_ROOT=/home/you/manuscripts python app.py
```

---

## Keyboard Reference

### Word Mode (default)

| Key | Action |
|-----|--------|
| `←` Left Arrow | Next word (RTL direction) |
| `→` Right Arrow | Previous word |
| `↓` Down Arrow | Same word position, next line |
| `↑` Up Arrow | Same word position, previous line |
| `Enter` | Enter Character Mode for current word |
| `Tab` | Jump to next undiacritized word (wraps at end of document) |
| `?` | Show / hide keyboard shortcuts overlay |

### Character Mode

| Key | Action |
|-----|--------|
| `←` Left Arrow | Next character (RTL); auto-exits at word boundary |
| `→` Right Arrow | Previous character; auto-exits at word boundary |
| `Escape` | Exit to Word Mode |
| Diacritic key | Apply / replace diacritic on current character |
| Same diacritic key again | Toggle off (remove) diacritic |
| `Delete` / `Backspace` | Clear all diacritics from current character |

### Mouse-only Actions (intentional — prevents accidents)

| Action | Effect |
|--------|--------|
| **Mark Complete** | Copies working copy to `_diac_output/`; enters read-only mode |
| **Reset** | Deletes working copy and cursor progress; `_diac_output/` is untouched |

---

## File Structure

```
TASHKEEL/
└── src/
    ├── app.py                    Flask application + all API routes
    ├── diacritic_engine.py       Grapheme cluster write engine (no global NFC)
    ├── keymap.json               Custom key bindings (optional)
    ├── test_diacritic_engine.py  pytest suite
    │
    ├── data/
    │   └── SAMPLE_TEXTS/         Sample Arabic text files
    │
    ├── static/
    │   ├── api.js                API wrappers + file tree + error banner
    │   ├── editor-state.js       Central editorState object
    │   ├── renderer.js           Document rendering + Zen Focus teleprompter
    │   ├── navigation.js         Word Mode navigation + cursor debounce
    │   ├── diacritic-engine.js   Hard rules + apply/replace/toggle/clear
    │   ├── character-mode.js     Character Mode panel + inner-tier navigation
    │   ├── visual-hints.js       Amber highlighting + undiac count + Tab jump
    │   ├── soft-rules.js         Soft validation rules + tooltip rendering
    │   └── completion.js         Completion banner + shortcuts overlay
    │
    └── templates/
        └── index.html            Single-page app shell
```

### Working files created at runtime

For each source file `chapter_1.txt` opened in the editor:

```
chapter_1.txt                              ← Original — NEVER modified
diac_chapter_1.txt                         ← Working copy (all edits go here)
diac_chapter_1.txt.diac_cursor.json        ← Cursor position sidecar

_diac_output/
└── chapter_1.txt                          ← Final output (Mark Complete only)
```

The `diac_` prefix and `_diac_output/` directory are hidden from the file tree.
The original source file is never read after the working copy is created.

---

## Custom Key Bindings

Edit `src/keymap.json` to map physical keys to diacritics. This is useful if
your OS Arabic layout assigns diacritics to inconvenient positions:

```json
{
  "bindings": {
    "Numpad1": "\u064E",
    "Numpad2": "\u064F",
    "Numpad3": "\u0650",
    "Numpad4": "\u0651",
    "Numpad5": "\u0652"
  }
}
```

Keys are matched against `event.code` (physical key, layout-independent).
Values must be Unicode code points in the diacritic range `U+064B–U+0655, U+0670`.
Restart the Flask server after editing `keymap.json`.

---

## Running Tests

```bash
cd src
pytest test_diacritic_engine.py -v
```

---

## Known Limitations (v1)

- **Chrome 87+ only** — `Intl.Segmenter` grapheme API is required.
- **No undo/redo** — use replace mode (type a different diacritic) or toggle-off (press the same key again) to correct mistakes.
- **One file at a time** — only one file can be open simultaneously.
- **Diacritics only** — letter substitution, deletion, and insertion are out of scope.
