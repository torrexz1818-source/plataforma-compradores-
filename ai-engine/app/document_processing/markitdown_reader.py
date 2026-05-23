from __future__ import annotations

from pathlib import Path


def read_with_markitdown(path: Path) -> tuple[str, list[str]]:
    try:
        from markitdown import MarkItDown
    except Exception:
        return "", ["MarkItDown no esta disponible; se uso extractor fallback."]

    try:
        result = MarkItDown().convert(str(path))
        text = getattr(result, "text_content", "") or ""
        if not text.strip():
            return "", ["MarkItDown no devolvio texto suficiente; se uso extractor fallback."]
        return text, []
    except Exception:
        return "", ["MarkItDown no pudo convertir el archivo; se uso extractor fallback."]
