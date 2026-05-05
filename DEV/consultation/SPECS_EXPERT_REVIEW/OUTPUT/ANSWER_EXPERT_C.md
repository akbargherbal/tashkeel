Here is a technical analysis of the keyboard event handling architecture proposed in the specification, addressing the three critical domain questions.

### 1. Interception Strategy: `event.code` vs `event.key` and the "ShiftQ" Flaw

The spec’s proposed abstraction in §7.2 (`"ShiftQ": "U+0651"`) is fundamentally flawed for this use case. It conflates physical key positions (`event.code`) with logical characters (`event.key`), and in doing so, it accidentally hardcodes the **macOS Arabic layout** while breaking the promise in §7.1 that the app "matches how they would work in any word processor."

**The OS Layout Reality:**

- On **macOS Arabic**, pressing `Shift + Q` produces Shadda (`ّ`).
- On **Windows Arabic (101)**, pressing `Shift + Q` produces Fatha (`َ`). Shadda is mapped to `Shift + ~` (Tilde).

If the app implements the `keymap.json` using `event.code === "KeyQ" && event.shiftKey`, a Windows user pressing `Shift + Q` (expecting a Fatha) will get a Shadda.

**The Correct Strategy:**
Because the spec intends to capture _the character the user intended to type_, the app must intercept **`event.key`**, not `event.code`. Furthermore, standard Arabic OS layouts do not use a composition buffer (IME) for diacritics; they fire standard `keydown` events where `event.key` is immediately resolved to the correct Unicode combining character.

The keymap abstraction should not map physical keys to Unicode; it should map **logical Unicode characters to application actions**. In fact, for standard typing, you don't need a keymap for diacritics at all—you just capture the keystroke if `event.key` falls within the Arabic Harakat Unicode block.

```javascript
// Correct approach: Listen to the resolved character (event.key)
document.addEventListener("keydown", (event) => {
  // event.key will be "ّ" (Shadda) on Mac when pressing Shift+Q
  // event.key will be "َ" (Fatha) on Windows when pressing Shift+Q

  const isDiacritic = /^[\u064B-\u0652]$/.test(event.key);

  if (isDiacritic) {
    event.preventDefault(); // Suppress default insertion
    applyDiacriticToCurrentCharacter(event.key);
  }
});
```

### 2. Document-Level Listeners and Browser Default Suppression

A document-level `keydown` listener is the correct architectural choice for a non-`<input>` UI like the one shown in the mockups. However, **the spec completely fails to specify `event.preventDefault()` calls**, which will result in severe UX conflicts with browser defaults.

If the app attaches a global listener without suppressing defaults, the following will happen:

| Key                        | Spec Action (§5.2)     | Browser Default Behavior                          | Result without `preventDefault()`                                                                                        |
| :------------------------- | :--------------------- | :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| `Backspace`                | Remove diacritic       | **Navigate Back** (Firefox, Safari, older Chrome) | User deletes a diacritic, the browser navigates to the previous page, and the session unloads.                           |
| `ArrowDown` / `ArrowUp`    | Move to next/prev line | **Scroll page**                                   | The active line changes, but the browser also scrolls the window, fighting the app's "Zen Focus" `translateY` centering. |
| `ArrowLeft` / `ArrowRight` | Move character/word    | **Scroll horizontally**                           | If the window is narrow, the page will jitter horizontally.                                                              |
| `Escape`                   | Exit Character Mode    | **Dismiss UI**                                    | May exit fullscreen mode or dismiss native browser popups unintentionally.                                               |

**Implementation Requirement:**
The global keydown handler must explicitly call `event.preventDefault()` **only for the keys the app consumes**, and it must do so synchronously.

```javascript
document.addEventListener("keydown", (event) => {
  // Ignore events if user is somehow in a native input field
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")
    return;

  const consumedKeys = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Backspace",
    "Escape",
    "Enter",
    "Delete",
  ];

  if (consumedKeys.includes(event.key) || /^[\u064B-\u0652]$/.test(event.key)) {
    event.preventDefault(); // Crucial: Stops scrolling, back-navigation, etc.

    // Dispatch to Word Mode or Character Mode logic
    handleEditorKeystroke(event);
  }
});
```

### 3. Runtime Layout Changes and `keymap.json` Validity

The spec's unexamined assumption is that physical keys map 1:1 to diacritics across all users. Because of this, it proposes a static `keymap.json` read at startup.

**Is runtime layout detection needed?**
If the app is built correctly using `event.key` (as recommended in Point 1), **runtime layout detection is a non-issue**. The browser and the OS handle the layout translation dynamically. If a user switches from Windows Arabic to macOS Arabic mid-session, the OS immediately changes what `event.key` reports. The app simply receives the new Unicode character and applies it.

However, if the developer strictly follows the spec's `"ShiftQ"` (`event.code`) architecture, the keymap **will become invalid** the moment the user switches OS layouts, because `KeyQ` will suddenly represent a different intended diacritic, and the browser provides no reliable API to detect OS layout changes synchronously.

**Recommendation for the Spec:**

1. Abandon the `"ShiftQ"` syntax in `keymap.json`.
2. If a keymap is needed for _custom_ shortcuts (e.g., mapping a non-standard key like `Numpad1` to Fatha), the config should map `event.code` to Unicode: `{"Numpad1": "\u064E"}`.
3. For standard typing, rely entirely on `event.key` and let the OS Input Method Editor do the heavy lifting. Because Arabic diacritics do not trigger `compositionstart` / `compositionend` buffering on standard layouts, `event.key` on `keydown` is 100% reliable.
