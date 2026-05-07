from pathlib import Path

from fastapi import HTTPException

from app.agents.terms_of_reference.schemas import SupportingDocumentSummary
from app.document_processing.csv_reader import read_csv
from app.document_processing.docx_reader import read_docx
from app.document_processing.file_detector import detect_file_type
from app.document_processing.image_ocr import read_image
from app.document_processing.pdf_reader import read_pdf
from app.document_processing.text_cleaner import clean_text
from app.document_processing.xlsx_reader import read_xlsx

MAX_DOCUMENT_CONTEXT_CHARS = 6000


def extract_supporting_document(path: Path, filename: str) -> tuple[dict, SupportingDocumentSummary]:
    file_type = detect_file_type(filename)
    warnings: list[str] = []

    try:
        if file_type == "pdf":
            raw_text, warnings = read_pdf(path)
        elif file_type == "docx":
            raw_text = read_docx(path)
        elif file_type == "xlsx":
            raw_text = read_xlsx(path)
        elif file_type == "csv":
            raw_text = read_csv(path)
        elif file_type in {"jpg", "jpeg", "png"}:
            raw_text, warnings = read_image(path)
        else:
            raise HTTPException(status_code=400, detail=f"Formato no soportado: {filename}")
    except HTTPException:
        raise
    except Exception:
        raw_text = ""
        warnings = ["No se pudo leer correctamente el archivo. El proceso continuara sin detenerse."]

    text = clean_text(raw_text)
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
