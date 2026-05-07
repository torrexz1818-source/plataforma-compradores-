from pathlib import Path

import fitz


def read_pdf(path: Path) -> tuple[str, list[str]]:
    warnings: list[str] = []
    pages: list[str] = []

    with fitz.open(path) as document:
        for index, page in enumerate(document, start=1):
            text = page.get_text("text")
            if text.strip():
                pages.append(f"Página {index}\n{text}")

    combined = "\n\n".join(pages)
    if len(combined.strip()) < 120:
        warnings.append("El PDF tiene poco texto extraíble y podría requerir OCR.")

    return combined, warnings
