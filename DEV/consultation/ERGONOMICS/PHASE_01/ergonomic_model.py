"""
ergonomic_model.py  (updated Session 21)
==========================================
Quantifies physical discomfort and cognitive load for four diacritization
schemes across one or more Arabic sample files.

Schemes modelled:
  A — Current        Pre-Phase-1 baseline (Tab · Enter · Arrow×k · Escape)
  B — Phase 1        Enter + Arrows + Space-exit  [corrected from earlier model]
  C — Smart flow     Enter + auto-advance + Space-exit  (no Arrows on happy path)
  D — Full flow      Space-enter + auto-advance + Space-exit  (pinky for corrections only)

NOTE on the earlier model's Scheme B error:
  The previous model used space_thumb for Character Mode entry in Scheme B.
  Phase 1 did NOT add Space-as-entry — Enter (pinky stretch) is still required.
  Scheme B is corrected here to reflect the actual shipped implementation.

Usage (from src/ or any directory):
    python ergonomic_model.py                          # all sample_text_*.txt in default dir
    python ergonomic_model.py path/to/file.txt         # single file
    python ergonomic_model.py data/SAMPLE_TEXTS/       # all .txt files in directory

Output: bar charts + finger breakdown saved as ergonomic_report.png
        and a summary table printed to stdout.
"""

import re
import sys
import os
import unicodedata
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

# ── Optional matplotlib ───────────────────────────────────────────────────────
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    HAS_MPL = True
except ImportError:
    HAS_MPL = False
    print("[ergonomic_model] matplotlib not found — text output only.")
    print("  Install with:  pip install matplotlib\n")

# ─────────────────────────────────────────────────────────────────────────────
# 1.  Unicode helpers
# ─────────────────────────────────────────────────────────────────────────────
DIACRITICS = frozenset('\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0670')
ARABIC_LETTERS = frozenset(
    chr(c) for c in range(0x0621, 0x063B)
) | frozenset(
    chr(c) for c in range(0x0641, 0x064B)
)


def letters_needing_diac(token: str) -> int:
    """Count Arabic letters in *token* that have no following diacritic."""
    chars = list(token)
    n = 0
    i = 0
    while i < len(chars):
        c = chars[i]
        if c in ARABIC_LETTERS:
            j = i + 1
            has_diac = False
            while j < len(chars) and chars[j] in DIACRITICS:
                has_diac = True
                j += 1
            if not has_diac:
                n += 1
        i += 1
    return n


def analyse_file(path: str) -> Tuple[int, int, float]:
    """
    Returns (word_count, total_k, avg_k) for Arabic tokens in *path*.
    Only tokens with at least one Arabic letter and at least one letter
    needing a diacritic are counted (k > 0).
    """
    text = open(path, encoding="utf-8").read()
    words = 0
    total_k = 0
    for line in text.splitlines():
        for token in line.split():
            if not any(c in ARABIC_LETTERS for c in token):
                continue
            k = letters_needing_diac(token)
            if k > 0:
                words += 1
                total_k += k
    avg_k = (total_k / words) if words else 0.0
    return words, total_k, avg_k


# ─────────────────────────────────────────────────────────────────────────────
# 2.  Ergonomic cost model
# ─────────────────────────────────────────────────────────────────────────────
# Physical discomfort score per keypress.
# Values are dimensionless; relative ordering matters, not absolute numbers.
# Reference: index finger on home-row key = 1.0 (baseline).
#
# Weights sourced from Ergonomics_Design_Report_v1.4 §5.2.

PHYS = {
    # ── Navigation overhead keys ──────────────────────────────────────────────
    "enter_pinky_stretch":  2.5,   # Enter: right pinky + slight stretch
    "escape_pinky_stretch": 2.5,   # Escape: right pinky + stretch
    "arrow_pinky":          2.5,   # Arrow: right pinky, stretch
    "space_thumb":          0.5,   # Space: dominant thumb, natural rest position
    # ── Diacritic keys — numpad / number row ─────────────────────────────────
    # Simplified to a single average across the layout (v1.4 layout is more
    # uniform than the old layout; index/middle cover most keys).
    "diacritic_key":        1.4,   # Numpad or number-row diacritic press (avg)
    # ── Correction Arrow in smart / full flow ─────────────────────────────────
    # Same physical cost as arrow_pinky; labelled separately for clarity.
    "correction_arrow":     2.5,
}

# Cognitive load per keypress (v1.4 §5.2 values).
# 0.0 = fully automatic.  Higher = must recall / consult / count.

COG = {
    "automatic":       0.0,   # well-practised, no lookup
    "recall":          0.3,   # practised but not yet automatic
    "lookup":          1.0,   # must glance at overlay
    "count_position":  0.5,   # must track cursor position mentally
    "mode_switch":     0.2,   # enter/exit a sub-mode (small overhead)
}

# Correction rate assumption for smart flow and full flow:
# fraction of characters where the user needs to step back after a mis-press.
CORRECTION_RATE = 0.10   # 10% of characters need one Arrow correction


@dataclass
class Scheme:
    name: str
    label: str                       # short label for charts
    phys_per_word:  object           # callable(k: int) -> float
    cog_per_word:   object           # callable(k: int) -> float
    finger_profile: object           # callable(k: float) -> Dict[str, float]


# ── Scheme A: Current (pre-Phase-1) ──────────────────────────────────────────
# Per word: Tab (jump) + Enter (enter char mode) + k×Arrow + k×diacritic + Escape
# Tab is excluded from the per-word model (it is a word-selection cost shared
# across all schemes); the comparison focuses on within-word overhead.

def _A_phys(k: int) -> float:
    return (
        PHYS["enter_pinky_stretch"]        # Enter char mode
        + k * PHYS["arrow_pinky"]          # k Arrow presses (step through chars)
        + k * PHYS["diacritic_key"]        # k diacritic presses
        + PHYS["escape_pinky_stretch"]     # Escape to exit
    )

def _A_cog(k: int) -> float:
    return (
        COG["mode_switch"]                                          # enter char mode
        + k * COG["count_position"]                                 # track which char
        + k * (COG["lookup"] * 0.4 + COG["recall"] * 0.6)          # mixed layout recall
        + COG["mode_switch"]                                        # exit char mode
    )

def _A_fingers(k: float) -> Dict[str, float]:
    return {
        "Pinky — Enter":        1.0,
        "Pinky — Arrow × k":    k,
        "Pinky — Escape":       1.0,
        "Diacritic keys":       k,
    }


# ── Scheme B: Phase 1 (actual shipped behaviour, corrected) ──────────────────
# Space in Word Mode = jump to next amber word (thumb).
# Enter still required to enter Character Mode (pinky).
# k × Arrow still required to step through characters (pinky).
# Space in Character Mode = exit + jump to next word (thumb).
# Correction from earlier model: entry into char mode was wrongly priced at
# space_thumb (0.5); it costs enter_pinky_stretch (2.5).

def _B_phys(k: int) -> float:
    return (
        PHYS["enter_pinky_stretch"]        # Enter char mode  ← corrected from space_thumb
        + k * PHYS["arrow_pinky"]          # k Arrow presses (unchanged)
        + k * PHYS["diacritic_key"]        # k diacritic presses
        + PHYS["space_thumb"]              # Space to exit + advance
    )

def _B_cog(k: int) -> float:
    return (
        COG["mode_switch"]
        + k * COG["count_position"]                                 # still counting manually
        + k * (COG["lookup"] * 0.3 + COG["recall"] * 0.7)          # layout slightly more familiar
        + COG["mode_switch"]
    )

def _B_fingers(k: float) -> Dict[str, float]:
    return {
        "Pinky — Enter":        1.0,
        "Pinky — Arrow × k":    k,
        "Thumb — Space (exit)": 1.0,
        "Diacritic keys":       k,
    }


# ── Scheme C: Smart flow ──────────────────────────────────────────────────────
# Enter: still required (pinky) — entering Character Mode is unchanged.
# Auto-advance: fires after each completed cluster. No Arrow on the happy path.
# Correction budget: CORRECTION_RATE × k Arrow presses for mis-presses.
# Space in Character Mode: exit + jump (thumb).

def _C_phys(k: int) -> float:
    return (
        PHYS["enter_pinky_stretch"]                           # Enter char mode (pinky)
        + k * PHYS["diacritic_key"]                           # k diacritic presses
        + CORRECTION_RATE * k * PHYS["correction_arrow"]      # correction budget
        + PHYS["space_thumb"]                                 # Space exit + advance
    )

def _C_cog(k: int) -> float:
    return (
        COG["mode_switch"]
        + k * COG["recall"]          # layout now more automatic; no position counting
        # no count_position: auto-advance handles cursor tracking
        + COG["mode_switch"]
    )

def _C_fingers(k: float) -> Dict[str, float]:
    return {
        "Pinky — Enter":              1.0,
        "Pinky — correction Arrows":  CORRECTION_RATE * k,
        "Thumb — Space (exit)":       1.0,
        "Diacritic keys":             k,
    }


# ── Scheme D: Full flow (smart flow + Space-as-enter) ────────────────────────
# Space in Word Mode: jump to next amber word AND enter Character Mode (thumb).
# Auto-advance: fires after each completed cluster. No Arrow on happy path.
# Correction budget: CORRECTION_RATE × k Arrow presses (pinky — intentional).
# Space in Character Mode: exit + jump to next word (thumb).
# Net pinky presses on the forward path: zero.

def _D_phys(k: int) -> float:
    return (
        PHYS["space_thumb"]                                    # Space: jump + enter char mode
        + k * PHYS["diacritic_key"]                            # k diacritic presses
        + CORRECTION_RATE * k * PHYS["correction_arrow"]       # correction budget (pinky)
        + PHYS["space_thumb"]                                  # Space: exit + advance
    )

def _D_cog(k: int) -> float:
    return (
        COG["mode_switch"]
        + k * COG["recall"]          # same as smart flow
        + COG["mode_switch"]
    )

def _D_fingers(k: float) -> Dict[str, float]:
    return {
        "Thumb — Space (enter + exit)": 2.0,
        "Pinky — correction Arrows":    CORRECTION_RATE * k,
        "Diacritic keys":               k,
    }


SCHEMES: List[Scheme] = [
    Scheme("A — Current",     "Current",    _A_phys, _A_cog, _A_fingers),
    Scheme("B — Phase 1",     "Phase 1",    _B_phys, _B_cog, _B_fingers),
    Scheme("C — Smart flow",  "Smart flow", _C_phys, _C_cog, _C_fingers),
    Scheme("D — Full flow",   "Full flow",  _D_phys, _D_cog, _D_fingers),
]


# ─────────────────────────────────────────────────────────────────────────────
# 3.  Score computation
# ─────────────────────────────────────────────────────────────────────────────

def compute_scores(words: int, total_k: int, avg_k: float):
    results = []
    for s in SCHEMES:
        k = round(avg_k)
        phys = sum(s.phys_per_word(k) for _ in range(words))
        cog  = sum(s.cog_per_word(k)  for _ in range(words))
        results.append({
            "name":    s.name,
            "label":   s.label,
            "phys":    phys,
            "cog":     cog,
            "total":   phys + cog,
            "fingers": {fk: fv * words for fk, fv in s.finger_profile(avg_k).items()},
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 4.  Text output
# ─────────────────────────────────────────────────────────────────────────────

def print_table(file_label: str, words: int, total_k: int, avg_k: float, results):
    sep = "─" * 76
    print(f"\n{sep}")
    print(f"  File : {file_label}")
    print(f"  Words: {words}   Letters needing diacritics: {total_k}   Avg k: {avg_k:.2f}")
    print(f"  Correction rate assumption: {CORRECTION_RATE*100:.0f}% of characters")
    print(sep)
    print(f"  {'Scheme':<26} {'Phys score':>12} {'Cog score':>12} {'Total':>10}")
    print(f"  {'─'*26} {'─'*12} {'─'*12} {'─'*10}")
    for r in results:
        print(f"  {r['name']:<26} {r['phys']:>12.1f} {r['cog']:>12.1f} {r['total']:>10.1f}")
    print(sep)
    for r in results:
        print(f"\n  [{r['name']}] Finger usage breakdown:")
        for finger, presses in r["fingers"].items():
            bar = "█" * int(presses / max(1, total_k) * 30)
            print(f"    {finger:<34} {presses:>8.0f} wt-presses  {bar}")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# 5.  Chart output
# ─────────────────────────────────────────────────────────────────────────────

COLORS = {
    "Current":    "#d94f3d",
    "Phase 1":    "#e8a838",
    "Smart flow": "#4caf78",
    "Full flow":  "#3a9bd5",
}

def render_charts(all_file_results: List[Tuple[str, dict]], out_path: str):
    if not HAS_MPL:
        return

    n_files    = len(all_file_results)
    labels     = [s.label for s in SCHEMES]
    fig, axes  = plt.subplots(
        n_files, 3,
        figsize=(18, 5 * n_files),
        squeeze=False,
    )
    fig.suptitle(
        "Tashkeel Ergonomic Model — Physical Discomfort · Cognitive Load · Pinky Load\n"
        f"(Session 21 update · correction rate = {CORRECTION_RATE*100:.0f}%)",
        fontsize=13, fontweight="bold", y=1.02,
    )

    for row_i, (file_label, scheme_results) in enumerate(all_file_results):
        ax_phys, ax_cog, ax_pinky = axes[row_i]
        title_prefix = f"{file_label}\n"

        # ── Physical discomfort ───────────────────────────────────────────────
        phys_vals = [scheme_results[s.name]["phys"] for s in SCHEMES]
        bars = ax_phys.bar(
            labels, phys_vals,
            color=[COLORS[s.label] for s in SCHEMES],
            edgecolor="white", linewidth=0.8,
        )
        ax_phys.set_title(title_prefix + "Physical Discomfort Score", fontsize=10)
        ax_phys.set_ylabel("Weighted keypress cost")
        ax_phys.bar_label(bars, fmt="%.0f", padding=3, fontsize=9)
        ax_phys.set_ylim(0, max(phys_vals) * 1.25)
        ax_phys.tick_params(axis="x", labelsize=8)

        # ── Cognitive load ────────────────────────────────────────────────────
        cog_vals = [scheme_results[s.name]["cog"] for s in SCHEMES]
        bars = ax_cog.bar(
            labels, cog_vals,
            color=[COLORS[s.label] for s in SCHEMES],
            edgecolor="white", linewidth=0.8,
        )
        ax_cog.set_title(title_prefix + "Cognitive Load Score", fontsize=10)
        ax_cog.set_ylabel("Weighted cognitive cost")
        ax_cog.bar_label(bars, fmt="%.0f", padding=3, fontsize=9)
        ax_cog.set_ylim(0, max(cog_vals) * 1.25)
        ax_cog.tick_params(axis="x", labelsize=8)

        # ── Pinky load comparison across all schemes ──────────────────────────
        # Sum all finger entries that contain "Pinky" for each scheme.
        pinky_vals = []
        for s in SCHEMES:
            fingers = scheme_results[s.name]["fingers"]
            pinky_total = sum(v for k, v in fingers.items() if "Pinky" in k)
            pinky_vals.append(pinky_total)

        bars = ax_pinky.bar(
            labels, pinky_vals,
            color=[COLORS[s.label] for s in SCHEMES],
            edgecolor="white", linewidth=0.8,
        )
        ax_pinky.set_title(title_prefix + "Pinky-Finger Load (weighted presses)", fontsize=10)
        ax_pinky.set_ylabel("Pinky weighted presses")
        ax_pinky.bar_label(bars, fmt="%.0f", padding=3, fontsize=9)
        ax_pinky.set_ylim(0, max(pinky_vals) * 1.25)
        ax_pinky.tick_params(axis="x", labelsize=8)

    fig.tight_layout(pad=2.5)
    fig.savefig(out_path, dpi=120, bbox_inches="tight")
    print(f"[ergonomic_model] Chart saved → {out_path}")


# ─────────────────────────────────────────────────────────────────────────────
# 6.  Main
# ─────────────────────────────────────────────────────────────────────────────

def collect_files(args: List[str]) -> List[str]:
    if not args:
        base = Path(__file__).parent
        candidates = (
            list(base.glob("data/SAMPLE_TEXTS/sample_text_*.txt")) +
            list(base.glob("sample_text_*.txt"))
        )
        if not candidates:
            print("[ergonomic_model] No sample files found. Pass a file or directory path.")
            sys.exit(1)
        return [str(p) for p in sorted(candidates)]
    files = []
    for arg in args:
        p = Path(arg)
        if p.is_dir():
            files.extend(str(f) for f in sorted(p.glob("*.txt")))
        elif p.is_file():
            files.append(str(p))
        else:
            print(f"[ergonomic_model] Warning: {arg!r} not found, skipping.")
    return files


def main():
    files = collect_files(sys.argv[1:])
    if not files:
        print("[ergonomic_model] No files to process.")
        sys.exit(1)

    all_file_results = []

    for fpath in files:
        file_label = Path(fpath).name
        words, total_k, avg_k = analyse_file(fpath)
        if words == 0:
            print(f"[ergonomic_model] {file_label}: no Arabic words requiring diacritics — skipping.")
            continue
        results      = compute_scores(words, total_k, avg_k)
        scheme_map   = {r["name"]: r for r in results}
        all_file_results.append((file_label, scheme_map))
        print_table(file_label, words, total_k, avg_k, results)

    if not all_file_results:
        print("[ergonomic_model] Nothing to chart.")
        return

    out_png = str(Path(__file__).parent / "ergonomic_report.png")
    render_charts(all_file_results, out_png)

    if len(all_file_results) > 1:
        print("\n" + "═" * 76)
        print("  AGGREGATE ACROSS ALL FILES")
        print("═" * 76)
        totals = {s.name: {"phys": 0.0, "cog": 0.0} for s in SCHEMES}
        for _, sr in all_file_results:
            for sname, r in sr.items():
                totals[sname]["phys"] += r["phys"]
                totals[sname]["cog"]  += r["cog"]
        print(f"  {'Scheme':<26} {'Total Phys':>12} {'Total Cog':>12} {'Grand Total':>12}")
        print(f"  {'─'*26} {'─'*12} {'─'*12} {'─'*12}")
        for s in SCHEMES:
            t = totals[s.name]
            grand = t["phys"] + t["cog"]
            print(f"  {s.name:<26} {t['phys']:>12.1f} {t['cog']:>12.1f} {grand:>12.1f}")
        print()


if __name__ == "__main__":
    main()
