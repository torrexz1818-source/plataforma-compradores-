from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from app.document_processing.csv_reader import read_csv
from app.document_processing.docx_reader import read_docx
from app.document_processing.file_detector import detect_file_type
from app.document_processing.image_ocr import read_image
from app.document_processing.markitdown_reader import read_with_markitdown
from app.document_processing.pdf_reader import read_pdf
from app.document_processing.text_cleaner import clean_text
from app.document_processing.xlsx_reader import read_xlsx


def read_document_text(path: Path, filename: str) -> tuple[str, str, list[str]]:
    file_type = detect_file_type(filename)
    warnings: list[str] = []

    if file_type in {"pdf", "docx", "xlsx", "csv"}:
        markdown_text, markdown_warnings = read_with_markitdown(path)
        warnings.extend(markdown_warnings)
        cleaned_markdown = clean_text(markdown_text)
        if cleaned_markdown:
            return cleaned_markdown, file_type, warnings

    if file_type == "pdf":
        text, file_warnings = read_pdf(path)
        warnings.extend(file_warnings)
    elif file_type == "docx":
        text = read_docx(path)
    elif file_type == "xlsx":
        text = read_xlsx(path)
    elif file_type == "csv":
        text = read_csv(path)
    elif file_type in {"jpg", "jpeg", "png"}:
        text, file_warnings = read_image(path)
        warnings.extend(file_warnings)
    else:
        raise HTTPException(status_code=400, detail=f"Formato no soportado: {filename}")

    cleaned = clean_text(text)
    if not cleaned:
        warnings.append("No se pudo extraer texto suficiente del archivo.")

    return cleaned, file_type, warnings
