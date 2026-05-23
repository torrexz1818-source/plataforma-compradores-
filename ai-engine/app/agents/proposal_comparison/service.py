from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.agents.proposal_comparison.prompts import build_user_prompt
from app.agents.proposal_comparison.schemas import ExtractedDocument, ProposalComparisonResult
from app.agents.proposal_comparison.scoring import normalize_ranking
from app.ai.llm_client import analyze_with_openai
from app.config import get_settings
from app.document_processing.document_reader import read_document_text
from app.document_processing.file_detector import detect_file_type, validate_allowed_file
from app.utils.temp_files import cleanup_files, save_upload_temporarily


def extract_text_from_file(path: Path, filename: str) -> ExtractedDocument:
    text, file_type, warnings = read_document_text(path, filename)
    return ExtractedDocument(filename=filename, file_type=file_type, text=text, warnings=warnings)


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

    # criteria se conserva en la firma por compatibilidad con clientes antiguos,
    # pero este agente ahora genera criterios y pesos automaticamente.
    _ = criteria
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

        prompt = build_user_prompt(title, service, objective, documents_for_prompt)
        raw_result = await analyze_with_openai(prompt)
        normalized_result = normalize_ranking(raw_result)

        if len(normalized_result.get("suppliers", [])) < 2:
            raise HTTPException(
                status_code=502,
                detail="La IA no pudo identificar al menos dos proveedores en las propuestas.",
            )

        if not normalized_result.get("evaluation_matrix", {}).get("criteria"):
            raise HTTPException(
                status_code=502,
                detail="La IA no pudo generar criterios de evaluación para la matriz comparativa.",
            )

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
