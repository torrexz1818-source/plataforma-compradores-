from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.agents.proposal_comparison.prompts import SYSTEM_PROMPT, build_user_prompt
from app.agents.proposal_comparison.schemas import ExtractedDocument, ProposalComparisonResult
from app.agents.proposal_comparison.scoring import normalize_ranking
from app.ai.llm_client import generate_agent_response
from app.config import get_settings
from app.document_processing.file_detector import detect_file_type, validate_allowed_file
from app.document_processing.structured_document import build_public_document_warning, build_structured_document_payload, evidence_text
from app.utils.temp_files import cleanup_files, save_upload_temporarily


def extract_text_from_file(path: Path, filename: str) -> ExtractedDocument:
    trace = build_structured_document_payload(path, filename)
    text = evidence_text(trace)
    file_type = str(trace.get("fileType") or detect_file_type(filename))
    warnings = [*trace.get("warnings", []), *build_public_document_warning(trace)]
    return ExtractedDocument(filename=filename, file_type=file_type, text=text, warnings=warnings)


def build_proposal_document_context(path: Path, filename: str) -> dict:
    trace = build_structured_document_payload(path, filename)
    return {
        "fileName": trace["fileName"],
        "fileType": trace["fileType"],
        "fileSize": trace["fileSize"],
        "extractionStatus": trace["extractionStatus"],
        "totalCharactersExtracted": trace["totalCharactersExtracted"],
        "totalCharactersSentToModel": trace["totalCharactersSentToModel"],
        "wasTruncated": trace["wasTruncated"],
        "truncationReason": trace["truncationReason"],
        "pagesDetected": trace["pagesDetected"],
        "sheetsDetected": trace["sheetsDetected"],
        "columnsDetected": trace["columnsDetected"],
        "rowsDetected": trace["rowsDetected"],
        "warnings": trace["warnings"],
        "publicWarnings": trace["publicWarnings"],
        "minimumEvidenceRequired": {
            "supplierName": "extraer si existe",
            "priceOrAmount": "extraer si existe",
            "currency": "extraer si existe",
            "deliveryTerm": "extraer si existe",
            "scope": "extraer si existe",
            "commercialTerms": "extraer si existe",
            "exclusions": "extraer si existe",
            "risks": "extraer si existe",
            "strengths": "extraer si existe",
            "weaknesses": "extraer si existe",
            "sourceEvidence": "citar bloque, pagina, hoja o tabla usada",
        },
        "evidenceBlocks": trace["evidenceBlocks"],
        "tables": trace["tables"],
    }


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

    # criteria se conserva por compatibilidad y se usa como instruccion opcional
    # para pesos, prioridades o criterios declarados por el usuario.
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

        documents_for_prompt = [
            build_proposal_document_context(path, upload.filename or path.name)
            for path, upload in zip(temp_paths, files)
        ]

        prompt = build_user_prompt(title, service, objective, criteria, documents_for_prompt)
        raw_result = await generate_agent_response(
            agentType="proposal_comparison",
            systemPrompt=SYSTEM_PROMPT,
            userPrompt=prompt,
            documentPayload=documents_for_prompt,
            outputContract={
                "required": [
                    "analysis_title",
                    "suppliers",
                    "evaluation_matrix",
                    "ranking",
                    "recommendation",
                    "risks",
                    "missing_information",
                ],
                "quality": [
                    "executiveSummary",
                    "findings",
                    "tables",
                    "recommendations",
                    "risks",
                    "missingCriticalData",
                    "evidenceReferences",
                    "downloadReadiness",
                    "qualityWarnings",
                ],
            },
        )
        raw_usage = raw_result.pop("_usage", {})
        raw_model = raw_result.pop("_model", None)
        raw_result.pop("_warnings", None)
        raw_result["document_traceability"] = documents_for_prompt
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
        normalized_result["document_traceability"] = documents_for_prompt
        normalized_result["downloadReadiness"] = {
            "status": "ready" if len(normalized_result.get("suppliers", [])) >= 2 else "blocked",
            "reason": "Comparativo con al menos dos proveedores identificados."
            if len(normalized_result.get("suppliers", [])) >= 2
            else "Se requieren al menos dos proveedores comparables con evidencia documental.",
        }
        normalized_result.setdefault(
            "disclaimer",
            "Este análisis es una recomendación asistida por IA y debe ser validado por el comprador antes de tomar una decisión final.",
        )

        normalized_result["model_provider"] = "anthropic"
        normalized_result["model_name"] = raw_model or settings.anthropic_model
        if isinstance(raw_usage, dict):
            normalized_result["tokens_input"] = raw_usage.get("tokens_input")
            normalized_result["tokens_output"] = raw_usage.get("tokens_output")

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
