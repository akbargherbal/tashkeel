### 📄 Executive Summary: Full-Flow Auto-Continue

**The Friction Point**
Currently, when a user fully diacritizes a word, the smart-flow auto-advances past the last character, jumps to the next undiacritized word, and _stops in Word Mode_. The user must manually press `Enter` to begin editing the new word. This is an unnecessary context switch in a sequential workflow.

**The Intended Behavior**
When smart-flow completes a word, it should automatically jump to the next undiacritized word **and** enter Character Mode on it, ready for immediate typing.

**The Technical Solution**
This is a design gap, not a bug. The fix requires exactly one line of code added to `_smartFlowAdvance()` in `static/character-mode.js`.
After `window._tabJumpToNextUndiac()` returns true and `window.updateZenFocus()` fires, we simply call `window.enterCharacterMode()`.

**Regression Safety & Invariants (Pre-Verified)**

1. **Zen Focus Ordering:** By calling `enterCharacterMode()` _after_ `updateZenFocus()`, we preserve the `RULES.md` §1 invariant (matching the existing Space-in-Word-Mode pattern).
2. **Explicit Stops Preserved:** Pressing `Space` or `Escape` in Character Mode will still exit to Word Mode without auto-entering the next word. Manual `←` navigation past the word boundary is also unaffected.
3. **End of Document:** If no undiacritized words remain, `_tabJumpToNextUndiac()` returns false, safely leaving the user in Word Mode to see the completion banner.
4. **Read-Only Mode:** If the document is marked complete, `totalUndiacCount` is 0, preventing the jump and the auto-enter entirely.

**Next Steps (Session 29)**
Draft a formal Phased Plan based on this summary, then execute the one-line fix.
