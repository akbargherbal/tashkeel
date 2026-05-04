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

Click **Open Folder** in the top-left of the sidebar, enter or browse to your
text directory, then click **Load**. The choice is saved to `config.json`
alongside `app.py` and restored automatically on the next launch.

Alternatively, set `TASHKEEL_ROOT` before starting the server (useful for
scripted or automated launches). `config.json` takes priority over the env var
if both are present.

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
| `Space` | Jump to next undiacritized word + enter Character Mode |
| `Shift+Tab` | Jump to previous undiacritized word (wraps at start of document) |
| `?` | Show / hide keyboard shortcuts overlay |

### Character Mode

| Key | Action |
|-----|--------|
| `←` Left Arrow | Next character (RTL); auto-exits at word boundary |
| `→` Right Arrow | Previous character; auto-exits at word boundary |
| `Escape` | Exit to Word Mode |
| Diacritic key | Apply / replace diacritic on current character; auto-advances to next character when cluster is complete |
| Same diacritic key again | Toggle off (remove) diacritic |
| `Delete` / `Backspace` | Clear all diacritics from current character |
| `Space` | Exit Character Mode + jump to next undiacritized word |

**Mis-press correction:** If smart-flow auto-advanced past a wrong diacritic, press `→` once to step back to the character, then apply the correct diacritic — auto-advance resumes. To return to a previous word entirely: `Escape` → `→` → `Enter`.

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

`config.json` is also created alongside `app.py` the first time you use **Open
Folder**. It stores the last-used project directory and is git-ignored.

---

## Custom Key Bindings

Edit `src/keymap.json` to map physical keys to diacritics. This is useful if
your OS Arabic layout assigns diacritics to inconvenient positions:

```json
{
  "bindings": {
    "Digit1":  "\u064E",
    "Digit2":  "\u0650",
    "Digit3":  "\u064F",
    "Digit7":  "\u064B",
    "Digit8":  "\u064D",
    "Digit9":  "\u064C",
    "Digit0":  "\u0652",
    "Numpad1": "\u064E",
    "Numpad2": "\u0650",
    "Numpad3": "\u064F",
    "Numpad7": "\u064B",
    "Numpad8": "\u064D",
    "Numpad9": "\u064C",
    "Numpad0": "\u0652"
  }
}
```

The above is the default layout shipped with the app. Keys are matched against
`event.code` (physical key, layout-independent). Values must be Unicode code
points in the diacritic range `U+064B–U+0655, U+0670`. Restart the Flask
server after editing `keymap.json`.

**Default diacritic layout:**

| Key | Diacritic |
|-----|-----------|
| `1` / `Numpad 1` | Fatha (U+064E) |
| `2` / `Numpad 2` | Kasra (U+0650) |
| `3` / `Numpad 3` | Damma (U+064F) |
| `7` / `Numpad 7` | Tanween Fatha (U+064B) |
| `8` / `Numpad 8` | Tanween Kasra (U+064D) |
| `9` / `Numpad 9` | Tanween Dhamma (U+064C) |
| `0` / `Numpad 0` | Sukoon (U+0652) |

**Note:** `Shift+0` and `Shift+Numpad0` are hardcoded to Shadda (U+0651) in
the application and cannot be remapped via `keymap.json`. Keys 4, 5, and 6
are intentionally unbound (reserved for a future Phase 2 compound-key
feature). Pressing them in Character Mode has no effect.

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
