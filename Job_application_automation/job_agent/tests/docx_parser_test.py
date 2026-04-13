from __future__ import annotations

import sys
import os
import json
import logging

_HERE      = os.path.dirname(os.path.abspath(__file__))
_JOB_AGENT = os.path.dirname(_HERE)
_TOOLS     = os.path.join(_JOB_AGENT, "tools")

for _p in (_JOB_AGENT, _TOOLS):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ---------------------------------------------------------------------------
# Defaults to assets/base_cv.docx, but you can override it here
# ---------------------------------------------------------------------------
_ASSETS = os.path.join(_JOB_AGENT, "assets")
DOCX_PATH = os.path.join(_ASSETS, "base_cv.docx")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s  %(levelname)-8s  %(name)s - %(message)s",
)

import docx_parser as dp

PASS = "  [PASS]"
FAIL = "  [FAIL]"

_results: list[tuple[str, str, str]] = []


def _record(name: str, passed: bool, note: str = "") -> None:
    status = PASS if passed else FAIL
    _results.append((name, status, note))
    print(f"{status}  [{name}]  {note}")


def test_extract_raw_text(docx_path: str) -> None:
    """Checks that readable text was pulled out of the docx."""
    result = dp.extract_raw_text(docx_path)
    ok = bool(result.strip())
    print("\n--- Raw Extracted Text ---")
    print(result[:500])
    print("--- End of Preview ---\n")
    _record("extract_raw_text", ok,
            f"{len(result)} chars extracted" if ok else "nothing extracted - file may be empty or image-based")


def test_load_cv_from_docx(docx_path: str) -> None:
    """Runs the full pipeline: raw text -> LLM -> normalized dict. Requires Ollama."""
    result = dp.load_cv_from_docx(docx_path)

    missing = [k for k in dp.REQUIRED_KEYS if k not in result]
    if missing:
        _record("load_cv_from_docx", False, f"Missing required keys: {missing}")
        return

    populated = {k: v for k, v in result.items() if v and v != {} and v != []}
    empty     = [k for k, v in result.items() if not v or v == {} or v == []]

    all_ok = bool(result.get("name") or result.get("email") or result.get("skills"))
    _record(
        "load_cv_from_docx", all_ok,
        f"populated fields: {list(populated.keys())} | empty fields: {empty}",
    )

    print("\n--- Parsed CV Output (dict) ---")
    print(json.dumps(result, indent=2, ensure_ascii=True))
    print("-------------------------------\n")


def _print_summary() -> None:
    total  = len(_results)
    passed = sum(1 for _, s, _ in _results if s == PASS)
    failed = sum(1 for _, s, _ in _results if s == FAIL)

    print("\n" + "=" * 60)
    print("  TEST SUMMARY")
    print("=" * 60)
    for name, status, note in _results:
        print(f"  {status.strip():6s}  {name}")
        if note:
            print(f"           -> {note}")
    print("-" * 60)
    print(f"  Total: {total}  |  Passed: {passed}  |  Failed: {failed}")
    print("=" * 60)

    if failed:
        print("\n[!] Some tests FAILED. See details above.\n")
        sys.exit(1)
    else:
        print("\n[OK] All tests passed!\n")


if __name__ == "__main__":
    if not DOCX_PATH:
        print("\n[ERROR] DOCX_PATH is not set. Open this file and set it at the top.\n")
        sys.exit(1)

    if not os.path.isfile(DOCX_PATH):
        print(f"\n[ERROR] File not found: {DOCX_PATH}\n")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  docx_parser.py - Test Suite")
    print(f"  File: {DOCX_PATH}")
    print("=" * 60 + "\n")

    test_extract_raw_text(DOCX_PATH)
    test_load_cv_from_docx(DOCX_PATH)

    _print_summary()
