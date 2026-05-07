import json
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.agents.proposal_comparison.prompts import build_user_prompt
from app.agents.proposal_comparison.schemas import ExtractedDocument, ProposalComparisonResult
from app.agents.proposal_comparison.scoring import normalize_ranking
from app.ai.llm_client import analyze_with_openai
from app.config import get_settings
from app.document_processing.file_detector import detect_file_type, validate_allowed_file
from app.document_processing.text_cleaner import clean_text
from app.document_processing.pdf_reader import read_pdf
from app.document_processing.docx_reader import read_docx
from app.document_processing.xlsx_reader import read_xlsx
from app.document_processing.csv_reader import read_csv
from app.document_processing.image_ocr import read_image
from app.utils.temp_files import save_upload_temporarily, cleanup_files


DEFAULT_CRITERIA = [
    {"name": "Precio", "weight": 25},
    {"name": "Alcance técnico", "weight": 20},
    {"name": "Condiciones comerciales", "weight": 15},
    {"name": "Garantía", "weight": 10},
    {"name": "Experiencia", "weight": 10},
    {"name": "Certificaciones", "weight": 10},
    {"name": "Riesgo operativo", "weight": 10},
]


def parse_criteria(criteria: str | None) -> list[dict]:
    if not criteria:
        return DEFAULT_CRITERIA

    try:
        parsed = json.loads(criteria)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Los criterios deben enviarse como JSON válido.") from exc

    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="Los criterios deben ser una lista JSON.")

    return parsed


def extract_text_from_file(path: Path, filename: str) -> ExtractedDocument:
    file_type = detect_file_type(filename)
    warnings: list[str] = []

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

    return ExtractedDocument(filename=filename, file_type=file_type, text=cleaned, warnings=warnings)


async def analyze_proposals(
    title: str | None,
    service: str,
    objective: str | None,
    criteria: str | None,
    files: list[UploadFile],
) -> ProposalComparisonResult:
    settings = get_settings()
    service = service.strip()

    if not service:
        raise HTTPException(status_code=400, detail="El campo service es obligatorio.")

    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Sube al menos 2 propuestas de proveedores.")

    if len(files) > settings.max_files_per_analysis:
        raise HTTPException(
            status_code=400,
            detail=f"Puedes subir como máximo {settings.max_files_per_analysis} archivos por análisis.",
        )

    parsed_criteria = parse_criteria(criteria)
    temp_paths: list[Path] = []

    try:
        for upload in files:
            validate_allowed_file(upload.filename or "")
            temp_paths.append(await save_upload_temporarily(upload, settings.max_file_size_mb))

        print(
            "proposal_comparison_analysis_started",
            {
                "file_count": len(files),
                "file_types": [detect_file_type(file.filename or "") for file in files],
            },
        )

        extracted_documents = [
            extract_text_from_file(path, upload.filename or path.name)
            for path, upload in zip(temp_paths, files)
        ]

        documents_for_prompt = [
            {
                "filename": doc.filename,
                "file_type": doc.file_type,
                "warnings": doc.warnings,
                "text": doc.text,
            }
            for doc in extracted_documents
        ]

        prompt = build_user_prompt(title, service, objective, parsed_criteria, documents_for_prompt)
        raw_result = await analyze_with_openai(prompt)
        normalized_result = normalize_ranking(raw_result)

        normalized_result.setdefault("analysis_title", title or "Comparativo de propuestas de proveedores")
        normalized_result.setdefault("service", service)
        normalized_result.setdefault("objective", objective or "No especificado")
        normalized_result.setdefault(
            "disclaimer",
            "Este análisis es una recomendación asistida por IA y debe ser validado por el comprador antes de tomar una decisión final.",
        )

        print("proposal_comparison_analysis_completed", {"file_count": len(files)})
        return ProposalComparisonResult.model_validate(normalized_result)
    except HTTPException:
        raise
    except Exception as exc:
        print("proposal_comparison_analysis_failed", {"file_count": len(files)})
        raise HTTPException(
            status_code=502,
            detail="No se pudo completar el análisis. Verifica la configuración del AI Engine y vuelve a intentar.",
        ) from exc
    finally:
        if settings.delete_temp_files:
            cleanup_files(temp_paths)
