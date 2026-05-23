from pathlib import Path

from fastapi import HTTPException

from app.agents.terms_of_reference.schemas import SupportingDocumentSummary
from app.document_processing.document_reader import read_document_text
from app.document_processing.file_detector import detect_file_type

MAX_DOCUMENT_CONTEXT_CHARS = 6000


def extract_supporting_document(path: Path, filename: str) -> tuple[dict, SupportingDocumentSummary]:
    file_type = detect_file_type(filename)
    warnings: list[str] = []

    try:
        text, file_type, warnings = read_document_text(path, filename)
    except HTTPException:
        raise
    except Exception:
        text = ""
        warnings = ["No se pudo leer correctamente el archivo. El proceso continuara sin detenerse."]

    if not text:
        warnings.append("No se pudo extraer texto suficiente del archivo.")

    context = {
        "file_name": filename,
        "detected_type": file_type,
        "extracted_text": text[:MAX_DOCUMENT_CONTEXT_CHARS],
        "limitations": warnings,
    }
    summary = SupportingDocumentSummary(
        file_name=filename,
        detected_type=file_type,
        relevant_findings=[],
        limitations=warnings,
    )
    return context, summary


def split_lines(value: str | None) -> list[str]:
    if not value:
        return []
    raw_items = value.replace(";", "\n").splitlines()
    return [item.strip(" -\t") for item in raw_items if item.strip(" -\t")]
