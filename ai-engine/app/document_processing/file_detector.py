from pathlib import Path

from fastapi import HTTPException

ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx", "csv", "jpg", "jpeg", "png"}


def detect_file_type(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")


def validate_allowed_file(filename: str) -> None:
    file_type = detect_file_type(filename)
    if file_type not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado para {filename}. Formatos permitidos: {allowed}.",
        )
