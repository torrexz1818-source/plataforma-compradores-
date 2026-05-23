from __future__ import annotations

from pathlib import Path


def read_with_markitdown(path: Path) -> tuple[str, list[str]]:
    try:
        from markitdown import MarkItDown
    except Exception:
        return "", ["Documento leido con extractor alternativo; MarkItDown no esta disponible."]

    try:
        result = MarkItDown().convert(str(path))
        text = getattr(result, "text_content", "") or ""
        if not text.strip():
            return "", ["Documento leido con extractor alternativo; MarkItDown no devolvio texto suficiente."]
        return text, []
    except Exception:
        return "", ["Documento leido con extractor alternativo; MarkItDown no pudo convertir el archivo."]
