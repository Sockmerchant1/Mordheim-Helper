"""Helper for manual rules extraction.

This intentionally produces review material, not final app data. Use it to make
Broheim PDFs easier to inspect, then hand-review and encode concise summaries in
src/data/*.json with source/page references.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from pypdf import PdfReader


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract page text from a PDF for manual review.")
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("output_txt", type=Path)
    args = parser.parse_args()

    reader = PdfReader(str(args.input_pdf))
    chunks: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        chunks.append(f"\n\n--- Page {index} ---\n{text.strip()}\n")

    args.output_txt.parent.mkdir(parents=True, exist_ok=True)
    args.output_txt.write_text("".join(chunks), encoding="utf-8")
    print(f"Wrote {len(reader.pages)} pages to {args.output_txt}")


if __name__ == "__main__":
    main()
