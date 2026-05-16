#!/usr/bin/env python3
"""One-off: fill empty msgstr in bn_BD.po using Google Translate (en -> bn)."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import polib
from deep_translator import GoogleTranslator

PO_PATH = Path(__file__).resolve().parent.parent / "languages" / "helpmate-ai-chatbot-bn_BD.po"

# WordPress / sprintf placeholders — replace before MT, restore after (MT often mangles order).
PH_RE = re.compile(r"(%\d+\$[sd])|(%[sd])|(%\d+[sd])|(%%)")


def protect(s: str) -> tuple[str, list[str]]:
    slots: list[str] = []

    def repl(m: re.Match[str]) -> str:
        slots.append(m.group(0))
        return f"__HM{len(slots) - 1}__"

    return PH_RE.sub(repl, s), slots


def unprotect(s: str, slots: list[str]) -> str:
    for i, tok in enumerate(slots):
        s = s.replace(f"__HM{i}__", tok)
    return s


def translate_text(translator: GoogleTranslator, text: str, retries: int = 4) -> str:
    if not text.strip():
        return text
    protected, slots = protect(text)
    for attempt in range(retries):
        try:
            out = translator.translate(protected)
            return unprotect(out, slots)
        except Exception:
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
            else:
                raise
    return text


def main() -> int:
    po = polib.pofile(str(PO_PATH))
    translator = GoogleTranslator(source="en", target="bn")

    pending: list[polib.POEntry] = []
    plural_entries: list[polib.POEntry] = []

    for entry in po:
        if not entry.msgid:
            continue
        if entry.msgid_plural:
            # Bengali: forms 0 (one) and 1 (other)
            if not entry.msgstr_plural or entry.msgstr_plural.get(0) in ("", None) or entry.msgstr_plural.get(1) in ("", None):
                plural_entries.append(entry)
            continue
        if entry.msgstr:
            continue
        pending.append(entry)

    print(f"Singular strings to translate: {len(pending)}", file=sys.stderr)
    print(f"Plural entries: {len(plural_entries)}", file=sys.stderr)

    batch_size = 40
    done = 0
    for i in range(0, len(pending), batch_size):
        chunk = pending[i : i + batch_size]
        protected: list[str] = []
        slotss: list[list[str]] = []
        for e in chunk:
            p, sl = protect(e.msgid)
            protected.append(p)
            slotss.append(sl)
        try:
            results = translator.translate_batch(protected)
        except Exception as ex:
            print(f"batch fail, falling back: {ex}", file=sys.stderr)
            for e in chunk:
                try:
                    e.msgstr = translate_text(translator, e.msgid)
                    done += 1
                except Exception as e2:
                    print(f"FAIL singular: {e.msgid[:80]!r} -> {e2}", file=sys.stderr)
        else:
            for e, r, sl in zip(chunk, results, slotss):
                e.msgstr = unprotect(r, sl)
                done += 1
        print(f"  singular {min(i + batch_size, len(pending))}/{len(pending)}", file=sys.stderr)
        time.sleep(0.45)

    for e in plural_entries:
        try:
            e.msgstr_plural[0] = translate_text(translator, e.msgid)
            e.msgstr_plural[1] = translate_text(translator, e.msgid_plural)
        except Exception as ex:
            print(f"FAIL plural: {e.msgid!r} -> {ex}", file=sys.stderr)

    # Refresh header
    po.metadata["PO-Revision-Date"] = time.strftime("%Y-%m-%d %H:%M:%S+0000", time.gmtime())
    po.metadata["Last-Translator"] = "Helpmate Team (machine-assisted bn_BD fill)"

    po.save(str(PO_PATH))
    print(f"Saved {PO_PATH}; translated ~{done} singular + {len(plural_entries)} plural.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
