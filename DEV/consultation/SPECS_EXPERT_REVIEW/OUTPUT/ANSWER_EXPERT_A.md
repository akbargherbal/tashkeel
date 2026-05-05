As an expert in Arabic script linguistics and classical orthography, I have reviewed the specification and mockups. The application’s philosophy of non-destructive, keyboard-centric editing is excellent, but the validation logic (§8) relies on simplified pedagogical heuristics that will clash with the realities of classical Arabic texts.

Here is my evaluation of the four specific orthographic and linguistic issues you raised:

### 1. Mid-word Alef (ا) and Hamzat al-Wasl (§8.3 & §8.4)

**The rule:** _Warns when any diacritic is applied to a mid-word alef; suppresses amber highlight assuming it is a long vowel._

**The verdict:** This rule is too blunt and will result in both false warnings and silent failures.

- **Silent failures (False negatives):** While a bare mid-word _alif_ is usually a long vowel (_alif madd_), it frequently represents _hamzat al-waṣl_ following a prefix (e.g., فَاسْتَغْفَرَ, وَابْن). In classical manuscripts and rigorous modern editions, _hamzat al-waṣl_ is not a long vowel; it is an elided glottal stop. Depending on the editorial convention, it may require a _waṣla_ mark (ـٱ) or, in some traditions, a vowel indicating its underlying form. By suppressing the amber highlight on all mid-word _alifs_, the app will silently ignore missing _waṣlas_ or, worse, missing _hamzat al-qat'_ where the base text erroneously used a plain _alif_ (a very common OCR or typing error).
- **Incorrect warnings (False positives):** If a user correctly attempts to apply a _waṣla_ (if supported) or a legitimate phonetic marker to a mid-word _alif_, the app will incorrectly flag it with an amber warning, treating it as a long vowel violation.

### 2. Alef Maqsura (ى) and Tanwin (§8.3)

**The rule:** _Alef maqsura at word end can take Fathatan only. Warn on any other diacritic._

**The verdict:** This rule enforces a typographic error and misunderstands classical _tanwīn_ placement.

- In classical prose, _alif maqṣūra_ (ى) represents a final long vowel /ā/ and is overwhelmingly left **bare** (diacritic-free).
- When a noun ending in _alif maqṣūra_ is indefinite and requires _tanwīn fatḥ_ (e.g., هُدًى, فَتًى), classical orthographic tradition dictates that the _tanwīn_ sits on the **preceding consonant** (the _dāl_ in هُدًى or the _tāʾ_ in فَتًى), not on the _alif maqṣūra_ itself. This is because the _alif_ is silent in continuous speech, and the vowel belongs phonologically to the consonant.
- While some modern digital fonts lazily render the _tanwīn_ over the ى, a tool designed for classical correctness should not codify this as a rule. The app should expect the ى to remain bare, and the _fathatān_ to be applied to the preceding letter.

### 3. Waw (و) and Contextual vs. Positional Rules (§8.4)

**The rule:** _Waw is excluded from amber highlighting "following a damma."_

**The verdict:** This rule suffers from a critical dependency failure because it mixes a _contextual_ rule with a _positional_ one.

- "Following a _ḍamma_" means the **preceding letter** carries a _ḍamma_ (e.g., the _qāf_ in يَقُولُ).
- Because the app allows mixed-state texts, the preceding letter might currently be undiacritized (amber). If the app evaluates the _wāw_ while the preceding letter is bare, it cannot know if the _wāw_ is a long vowel or a consonant.
- Furthermore, morphological context is required to distinguish a long vowel _wāw_ from a consonantal _wāw_ with a _sukūn_ (e.g., the diphthong in يَوْم) or a geminate _wāw_ (e.g., عَدُوّ). A purely graphemic rule will fail here. The app will either incorrectly highlight long vowels (if it defaults to amber when the preceding letter is bare) or fail to highlight consonants that desperately need a _sukūn_ or _shadda_. The asymmetry between the purely positional _alif_ rule and the contextual _wāw/yāʾ_ rules will cause erratic UI behavior.

### 4. The Omission of Maddah and Hamza Variants

**The rule:** _Only Group A (base vowels) and Group B (shadda) are supported. No letter substitution is allowed (Out of Scope §18)._

**The verdict:** This is a fatal flaw for a classical Arabic proofreading tool.

- _Hamza_ is not a _haraka_ (vowel); it is a consonant. _Maddah_ (آ) is a morphological contraction of _hamza_ + _alif_.
- Because the spec explicitly forbids letter substitution (e.g., deleting ا and typing أ), a user correcting a text _must_ be able to add a combining _hamza_ above (U+0654), _hamza_ below (U+0655), or _maddah_ (U+0653) to a bare _alif_ carrier.
- Since these Unicode combining marks are entirely omitted from the Group A/B taxonomy, the user has no way to correct missing _hamzas_—which is arguably the single most common error in digital Arabic texts.
- If the source file already contains a combining _maddah_ or _hamza_, the app's validation logic (§8.2 "Max two combining characters") will likely crash, silently strip them when a Group A diacritic is applied, or render them incorrectly because it does not know how to stack them in its hierarchy.

**Recommendation for the Spec:**
The taxonomy in §8.1 must be expanded to include a **Group C (Consonantal/Orthographic Modifiers)** containing combining _hamza_ above, _hamza_ below, _maddah_, and _waṣla_. The validation logic must be updated to allow Group C marks to seat on _alif_, _wāw_, and _yāʾ_ carriers, and to stack correctly with Group A vowels (e.g., a combining _hamza_ + _ḍamma_ on a _wāw_). Furthermore, the soft rules regarding _alif maqṣūra_ and _tanwīn_ must be rewritten to reflect classical Basran/Kufan consensus on preceding-consonant placement.
